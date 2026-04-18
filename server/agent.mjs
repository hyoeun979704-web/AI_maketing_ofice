// Agent runner. Core philosophy: the office always produces useful output.
// When something goes wrong (API down, URL unreachable, missing data), we
// fall back to framework-level output rather than blocking the task — and
// we annotate the response so the human knows why the fallback happened.

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCompany, isProfileReady, contextBlock, pickTargetForSkill, SKILL_TARGET_PREFERENCES } from './company.mjs';
import { fetchPage } from './tools/fetch-page.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 800;
const API_RETRIES = 2;       // transient failures get 2 retries
const API_RETRY_BASE_MS = 800;

const systemPromptCache = new Map();

async function loadSystemPrompt(skillName) {
  if (systemPromptCache.has(skillName)) return systemPromptCache.get(skillName);
  try {
    const text = await readFile(join(SKILLS_DIR, skillName, 'SKILL.md'), 'utf8');
    systemPromptCache.set(skillName, text);
    return text;
  } catch {
    return `You are the ${skillName} marketing agent.`;
  }
}

export function hasApiKey() { return Boolean(API_KEY); }

export function workLatency() { return 2200 + Math.random() * 2200; }

// URL-analyzable skills. Picks the skill-specific target and fetches it.
// Fetch failure degrades gracefully — we still call the API with just
// the company context instead of blocking the task.
const URL_ANALYZING_SKILLS = new Set([
  'seo-audit', 'ai-seo', 'schema-markup', 'site-architecture',
  'copywriting', 'copy-editing', 'page-cro',
  'analytics-tracking', 'product-marketing-context',
]);

// Skills that benefit from external data (ad accounts, CRM, ESPs...).
// When the data is missing we DON'T refuse — we produce a framework-level
// answer and list what would make it more accurate.
export const SKILLS_NEEDING_EXTERNAL_DATA = {
  'paid-ads':            ['Google Ads / Meta Ads / TikTok Ads 계정 연동', '최근 7-30일 캠페인 성과 데이터'],
  'ad-creative':         ['현재 광고셋 성과 데이터', '브랜드 크리에이티브 가이드'],
  'ab-test-setup':       ['진행 중 실험 ID / Optimizely·Statsig·자체 실험 시스템'],
  'email-sequence':      ['이메일 ESP 연동 (Mailchimp / Customer.io / Resend / 스티비)'],
  'cold-email':          ['리드 리스트 + ESP 발송 권한'],
  'churn-prevention':    ['결제·구독 데이터 (Stripe / 토스페이먼츠) + 해지 이유 코드'],
  'revops':              ['CRM 연동 (HubSpot / Salesforce) + 리드 라우팅 룰'],
  'sales-enablement':    ['세일즈 통화·이메일 기록 + 진행 중 딜 단계'],
  'referral-program':    ['Rewardful / Tolt 등 레퍼럴 시스템'],
  'lead-magnets':        ['리드 수집 폼 데이터 + 이메일 시퀀스 연결'],
  'free-tool-strategy':  ['툴 사용 데이터'],
  'community-marketing': ['커뮤니티 플랫폼 (Discord / Slack / Naver Cafe) 통계'],
  'pricing-strategy':    ['결제 데이터 + 코호트별 LTV / 가격 민감도 데이터'],
  'paywall-upgrade-cro': ['업그레이드 퍼널 분석 + 페이월 노출·전환 로그'],
  'naver-kin-automation': ['네이버 검색 오픈API 키 (NAVER_CLIENT_ID/SECRET)'],
};

export function buildUserPrompt({ title, kind }) {
  return `다음 업무를 수행하고 결과를 한국어로 보고하세요.

업무: ${title}
종류: ${kind === 'publish' ? '대외 업로드 (승인 대상)' : kind === 'spend' ? '예산 집행 (승인 대상)' : '초안 작성'}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wraps the Claude API call with retries + exponential backoff. On final
// failure, throws — caller decides how to fall back.
async function callClaude({ sysPrompt, userPrompt }) {
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: sysPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };
  let lastErr = null;
  for (let attempt = 0; attempt <= API_RETRIES; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 150)}`);
        if (attempt < API_RETRIES) {
          await sleep(API_RETRY_BASE_MS * Math.pow(2, attempt));
          continue;
        }
        throw lastErr;
      }
      if (!res.ok) {
        throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      const json = await res.json();
      const content = json.content?.[0]?.text?.trim();
      if (!content) throw new Error('Anthropic API에서 빈 응답');
      return { content, usage: json.usage };
    } catch (err) {
      lastErr = err;
      // Network / DNS errors → retry
      if (attempt < API_RETRIES && /fetch failed|network|timed out|ETIMEDOUT|ECONNRESET/i.test(err.message)) {
        await sleep(API_RETRY_BASE_MS * Math.pow(2, attempt));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr;
}

/**
 * Run a task. The return shape stays consistent — always has {output,
 * systemPrompt, userPrompt, mode}. Modes that mean "work happened":
 *   'api'                 — Claude API succeeded
 *   'api-with-warnings'   — succeeded but something degraded (URL fetch fail)
 *   'simulation'          — no API key present; template output
 *   'fallback-simulation' — API call failed after retries; template output
 *   'framework-only'      — external data missing; framework answer
 * Modes that mean "blocked":
 *   'blocked'             — prerequisites not met (no company, no target)
 */
export async function runTask({ agent, title, kind }) {
  const company = await getCompany();
  const sysPrompt = await loadSystemPrompt(agent);

  // Gate 1: company must be registered.
  if (!isProfileReady(company)) {
    return {
      output: `🛑 회사 정보가 등록되어 있지 않아 작업을 시작할 수 없습니다.

사이드바 상단 "회사 정보" 버튼에서 등록하세요:
- 회사명
- 타겟 자산 (최소 1개 URL)
- 한 줄 설명

이 정보가 모든 마케팅 작업의 기반입니다.`,
      systemPrompt: sysPrompt,
      userPrompt: '(회사 미등록)',
      mode: 'blocked',
      missingData: ['회사 프로필 (사이드바에서 등록)'],
    };
  }

  // For URL-analyzing skills: pick the best target and fetch. If no target
  // of the right kind exists, tell the user which kind is missing.
  let pageContext = '';
  let fetchedUrl = null;
  let fetchNote = '';
  if (URL_ANALYZING_SKILLS.has(agent)) {
    const target = pickTargetForSkill(company, agent);
    if (!target || !target.url) {
      const preferred = SKILL_TARGET_PREFERENCES?.[agent]?.join(', ') || 'website';
      return {
        output: `⚠️ 이 직원이 분석할 타겟 URL이 등록되어 있지 않습니다.

스킬: ${agent}
권장 타겟 종류: ${preferred}

"회사 정보" 모달에서 해당 종류의 타겟을 추가하면 다음 스핀부터 정상 실행됩니다.`,
        systemPrompt: sysPrompt,
        userPrompt: buildUserPrompt({ title, kind }),
        mode: 'blocked',
        missingData: ['해당 스킬용 타겟 URL'],
      };
    }
    try {
      const page = await fetchPage(target.url);
      fetchedUrl = page.url;
      pageContext = `# 사이트 데이터 (${target.label || target.kind} · ${target.kind})\n` + formatPageForPrompt(page);
    } catch (err) {
      // Don't block — proceed with just the company context, and annotate.
      fetchNote = `⚠️ 등록된 "${target.label || target.kind}" (${target.url}) 가져오기 실패: ${err.message}. 사이트 데이터 없이 프레임워크 수준으로 답변.`;
      fetchedUrl = target.url;
    }
  }

  // For data-dependent skills: produce a framework-level answer AND
  // surface what would make it more precise. Don't refuse.
  const missing = SKILLS_NEEDING_EXTERNAL_DATA[agent];
  const dataNote = missing
    ? `# ⚠️ 데이터 연결 안됨\n이 업무는 보통 아래 데이터를 참조하지만 현재 연결되어 있지 않습니다:\n${missing.map((m) => `- ${m}`).join('\n')}\n→ 구체 수치·실험 결과는 제시할 수 없고, 프레임워크·체크리스트·의사결정 기준만 제공합니다.\n`
    : '';

  const ctx = contextBlock(company);
  const userPrompt = [
    ctx,
    pageContext,
    dataNote,
    fetchNote,
    '',
    `# 업무`,
    `${title}`,
    `(종류: ${kind === 'publish' ? '대외 업로드' : kind === 'spend' ? '예산 집행' : '초안'})`,
    '',
    `회사 프로필${pageContext ? ' + 사이트 데이터' : ''}${dataNote ? ' (외부 데이터 없이)' : ''}를 근거로 한국어로 보고하세요.
실제 데이터에 없는 수치는 만들지 말고, 가정·추정은 "[추정]" 표시. bullet list, 다음 행동 3가지 이상 포함.`,
  ].filter((line) => line !== null && line !== undefined && line !== '').join('\n');

  // No API key → simulation mode
  if (!API_KEY) {
    return {
      output: simulateOutput({ agent, title, kind, company, pageContext, dataNote, fetchNote }),
      systemPrompt: sysPrompt,
      userPrompt,
      mode: 'simulation',
      fetchedUrl,
      missingData: missing || undefined,
    };
  }

  // Real API call with retry + fallback
  try {
    const { content, usage } = await callClaude({ sysPrompt, userPrompt });
    const modeAnnotation = fetchNote
      ? 'api-with-warnings'
      : missing ? 'framework-only' : 'api';
    return {
      output: content,
      systemPrompt: sysPrompt,
      userPrompt,
      mode: modeAnnotation,
      model: MODEL,
      usage,
      fetchedUrl,
      fetchError: fetchNote || undefined,
      missingData: missing || undefined,
    };
  } catch (err) {
    // Final fallback: simulation output so the office keeps moving.
    return {
      output: simulateOutput({ agent, title, kind, company, pageContext, dataNote, fetchNote })
        + `\n\n⚠️ API 호출 ${API_RETRIES + 1}회 시도 후 실패로 시뮬레이션 결과로 대체했습니다.\n마지막 오류: ${err.message}`,
      systemPrompt: sysPrompt,
      userPrompt,
      mode: 'fallback-simulation',
      fetchedUrl,
      fetchError: fetchNote || undefined,
      apiError: err.message,
      missingData: missing || undefined,
    };
  }
}

function formatPageForPrompt(page) {
  const s = page.summary || {};
  const lines = [];
  lines.push(`- URL: ${page.url}`);
  lines.push(`- HTTP ${page.status} · ${page.contentType || ''} · ${page.bytes || 0} bytes`);
  if (s.title) lines.push(`- title: "${s.title}"`);
  if (s.metaDescription) lines.push(`- meta description (${s.metaDescription.length}자): "${s.metaDescription}"`);
  else lines.push(`- meta description: ❌ 누락`);
  if (s.canonical) lines.push(`- canonical: ${s.canonical}`);
  if (s.metaRobots) lines.push(`- robots: ${s.metaRobots}`);
  if (s.htmlLang) lines.push(`- html lang: ${s.htmlLang}`);
  lines.push(`- og:title: ${s.ogTitle || '❌ 없음'}`);
  lines.push(`- og:image: ${s.ogImage || '❌ 없음'}`);
  if (s.h1?.length) lines.push(`- h1 (${s.h1.length}): ${s.h1.map((x) => `"${x}"`).join(', ').slice(0, 200)}`);
  else lines.push(`- h1: ❌ 없음`);
  if (s.h2?.length) lines.push(`- h2 (${s.h2.length}): ${s.h2.slice(0, 5).map((x) => `"${x.slice(0, 50)}"`).join(', ')}`);
  lines.push(`- 이미지: ${s.images?.length ?? 0}개, alt 누락 ${s.imagesMissingAlt ?? 0}개`);
  lines.push(`- 내부 링크: ${s.internalLinks ?? 0} / 외부 링크: ${s.externalLinks ?? 0}`);
  lines.push(`- 추적: ${[
    s.hasGtm && 'GTM',
    s.hasGa4 && 'GA4',
    s.hasMetaPixel && 'Meta Pixel',
    s.hasGoogleAdsConv && 'Google Ads Conv',
    s.hasAmplitude && 'Amplitude',
    s.hasMixpanel && 'Mixpanel',
  ].filter(Boolean).join(', ') || '❌ 감지된 것 없음'}`);
  if (s.schemaJsonLd?.length) {
    lines.push(`- JSON-LD 스키마: ${s.schemaJsonLd.map((x) => x.types.join('/')).join(', ')}`);
  } else {
    lines.push(`- JSON-LD 스키마: ❌ 없음`);
  }
  if (s.bodyTextSample) lines.push(`- 본문 샘플 (${s.bodyTextSample.length}자): "${s.bodyTextSample.slice(0, 600)}..."`);
  return lines.join('\n');
}

function simulateOutput({ agent, title, kind, company, pageContext, dataNote, fetchNote }) {
  const lines = [];
  lines.push(`📋 ${title}`);
  lines.push(`회사: ${company.name}${company.targets?.[0]?.url ? ' — ' + company.targets[0].url : ''}`);
  if (fetchNote) lines.push(fetchNote);
  if (pageContext) lines.push('\n(아래 분석은 위 사이트 데이터에 기반)');
  else lines.push('\n(사이트 데이터 없이 회사 컨텍스트만 사용)');
  if (dataNote) lines.push('\n' + dataNote);
  lines.push('\n— 시뮬레이션 출력 —');
  lines.push('- 실제 Claude 응답은 ANTHROPIC_API_KEY를 .env에 등록하면 활성화됩니다.');
  lines.push('- 등록된 컨텍스트 요약:');
  lines.push(`  · 타겟 오디언스: ${company.audience || '미정'}`);
  lines.push(`  · 브랜드 톤: ${company.voice || '미정'}`);
  lines.push(`  · 비즈니스 목표: ${(company.goals || []).join(', ') || '미정'}`);
  lines.push('- 다음 행동:');
  lines.push('  1) 세부 가설 도출');
  lines.push('  2) 필요 데이터 연결 결정');
  lines.push('  3) API 모드로 전환해 구체 권장사항 받기');
  return lines.join('\n');
}
