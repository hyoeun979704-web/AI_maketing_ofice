// Agent runner. Core decisions:
//
// 1. If no company profile is registered, agent does not pretend — returns
//    a single explicit message asking the human to register the target.
// 2. If company is registered AND the task is one of the URL-analyzable
//    skills, the runner first fetches the registered URL and feeds the
//    parsed structured data into the user prompt before calling Claude.
//    This means the SEO audit, schema audit, copy review, etc. operate on
//    REAL site data instead of fabricated numbers.
// 3. If task requires data we don't have access to (GA4, CRM, ad accounts,
//    email tool stats), the agent returns an explicit "데이터 연결 필요"
//    response listing what would be needed. No fabricated metrics.
// 4. If ANTHROPIC_API_KEY is set, calls Claude with the assembled prompt;
//    otherwise produces a deterministic but obviously-labeled simulation
//    that still uses the real fetched data when available.

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCompany, isProfileReady, contextBlock, pickTargetForSkill } from './company.mjs';
import { fetchPage } from './tools/fetch-page.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 800;

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

// Used by the scheduler to keep the working-state animation visible for
// at least a couple seconds even when the API responds quickly.
export function workLatency() { return 2200 + Math.random() * 2200; }

// Skills that can do real work by fetching the registered URL and analyzing
// the page. Each agent gets the parsed page summary in its prompt.
const URL_ANALYZING_SKILLS = new Set([
  'seo-audit', 'ai-seo', 'schema-markup', 'site-architecture',
  'copywriting', 'copy-editing', 'page-cro',
  'analytics-tracking', 'product-marketing-context',
]);

// Skills that genuinely need data sources we don't have access to.
// We don't fabricate output — we tell the human what's missing.
const SKILLS_NEEDING_EXTERNAL_DATA = {
  'paid-ads':           ['Google Ads / Meta Ads / TikTok Ads 계정 연동', '최근 7-30일 캠페인 성과 데이터'],
  'ad-creative':        ['플랫폼별 권장 규격 + 현재 광고셋 성과 데이터'],
  'ab-test-setup':      ['진행 중 실험 ID / Optimizely·Statsig·자체 실험 시스템'],
  'email-sequence':     ['이메일 ESP 연동 (Mailchimp / Customer.io / Resend / 스티비)'],
  'cold-email':         ['리드 리스트 + ESP 발송 권한'],
  'churn-prevention':   ['결제·구독 데이터 (Stripe / 토스페이먼츠) + 해지 이유 코드'],
  'revops':             ['CRM 연동 (HubSpot / Salesforce) + 리드 라우팅 룰'],
  'sales-enablement':   ['세일즈 통화·이메일 기록 + 진행 중 딜 단계'],
  'referral-program':   ['Rewardful / Tolt 등 레퍼럴 시스템'],
  'lead-magnets':       ['리드 수집 폼 데이터 + 이메일 시퀀스 연결'],
  'free-tool-strategy': ['툴 사용 데이터'],
  'community-marketing': ['커뮤니티 플랫폼 (Discord / Slack / Naver Cafe) 통계'],
  'pricing-strategy':   ['결제 데이터 + 코호트별 LTV / 가격 민감도 데이터'],
  'paywall-upgrade-cro': ['업그레이드 퍼널 분석 + 페이월 노출·전환 로그'],
  'naver-kin-automation': ['네이버 검색 오픈API 키 (NAVER_CLIENT_ID/SECRET)'],
};

export function buildUserPrompt({ title, kind }) {
  return `다음 업무를 수행하고 결과를 한국어로 보고하세요.

업무: ${title}
종류: ${kind === 'publish' ? '대외 업로드 (승인 대상)' : kind === 'spend' ? '예산 집행 (승인 대상)' : '초안 작성'}`;
}

/**
 * Run a task. Returns { output, systemPrompt, userPrompt, mode, model, usage,
 * fetchedUrl?, missingData? }.
 */
export async function runTask({ agent, title, kind }) {
  const company = await getCompany();
  const sysPrompt = await loadSystemPrompt(agent);

  // Refuse to fabricate work if no company is registered.
  if (!isProfileReady(company)) {
    return {
      output: `🛑 작업을 시작할 수 없습니다.

회사·타겟 정보가 등록되지 않았습니다.
사이드바 상단의 "회사 정보" 버튼에서 다음을 등록한 뒤 다시 시도하세요:
- 회사명
- 타겟 사이트 URL
- 한 줄 설명

이 정보가 모든 마케팅 작업의 기반입니다.`,
      systemPrompt: sysPrompt,
      userPrompt: '(회사 미등록)',
      mode: 'blocked',
      missingData: ['회사 프로필 (사이드바에서 등록)'],
    };
  }

  // Honest about external data dependencies before doing anything.
  const missing = SKILLS_NEEDING_EXTERNAL_DATA[agent];
  if (missing) {
    const output = `⚠️ 이 업무는 외부 데이터 연결이 필요해 진짜 분석이 불가능합니다.

업무: ${title}
회사: ${company.name} (${company.url})

필요 데이터:
${missing.map((m) => `- ${m}`).join('\n')}

위 데이터를 연결하기 전까지 이 직원은 다음 행동만 할 수 있습니다:
- 일반 프레임워크·체크리스트 안내
- 등록된 회사 컨텍스트 기반 정성적 추천
- 실제 수치·실험·집행은 데이터 연결 후

데이터 연결 방법을 결정하시면 (예: "Google Ads API 키 등록", "ESP 웹훅 추가") 다시 의뢰해주세요.`;
    return {
      output,
      systemPrompt: sysPrompt,
      userPrompt: buildUserPrompt({ title, kind }),
      mode: 'data-needed',
      missingData: missing,
    };
  }

  // For URL-analyzable skills, pick the most appropriate target for THIS
  // skill (aso-audit → appstore, social-content → a social URL, etc.)
  // and fetch it.
  let pageContext = '';
  let fetchedUrl = null;
  let fetchedLabel = null;
  if (URL_ANALYZING_SKILLS.has(agent)) {
    const target = pickTargetForSkill(company, agent);
    if (!target || !target.url) {
      return {
        output: `⚠️ 이 직원이 분석할 타겟 URL이 등록되어 있지 않습니다.

스킬: ${agent}
권장 타겟 종류: ${(await import('./company.mjs')).SKILL_TARGET_PREFERENCES?.[agent]?.join(', ') || 'website'}

"회사 정보" 모달에서 해당 종류의 타겟을 추가해주세요.`,
        systemPrompt: sysPrompt,
        userPrompt: buildUserPrompt({ title, kind }),
        mode: 'blocked',
        missingData: ['해당 스킬용 타겟 URL'],
      };
    }
    try {
      const page = await fetchPage(target.url);
      fetchedUrl = page.url;
      fetchedLabel = target.label || target.kind;
      pageContext = `# 사이트 데이터 (${fetchedLabel} · ${target.kind})\n` + formatPageForPrompt(page);
    } catch (err) {
      return {
        output: `❌ 등록된 타겟 "${target.label || target.kind}"(${target.url})을 가져오지 못해 작업을 진행할 수 없습니다.

오류: ${err.message}

확인:
- URL이 올바른가요? (예: https://example.com)
- 사이트가 응답하나요? 브라우저에서 직접 열어보세요.
- 로그인이 필요한 페이지면 공개 페이지로 변경해주세요.`,
        systemPrompt: sysPrompt,
        userPrompt: buildUserPrompt({ title, kind }),
        mode: 'fetch-failed',
        fetchError: err.message,
        fetchedUrl: target.url,
      };
    }
  }

  const ctx = contextBlock(company);
  const userPrompt = [
    ctx,
    pageContext,
    '',
    `# 업무`,
    `${title}`,
    `(종류: ${kind === 'publish' ? '대외 업로드' : kind === 'spend' ? '예산 집행' : '초안'})`,
    '',
    `위 회사 컨텍스트${pageContext ? ' + 사이트 데이터' : ''}만을 근거로 보고하세요. 가정·추측에는 명시적으로 "[추정]" 표시. 실제 데이터에 없는 수치는 만들지 마세요.`,
  ].filter(Boolean).join('\n');

  if (!API_KEY) {
    return {
      output: simulateOutput({ agent, title, kind, company, pageContext }),
      systemPrompt: sysPrompt,
      userPrompt,
      mode: 'simulation',
      fetchedUrl,
    };
  }

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: sysPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json.content?.[0]?.text?.trim();
  if (!content) throw new Error('Anthropic API에서 빈 응답');
  return {
    output: content,
    systemPrompt: sysPrompt,
    userPrompt,
    mode: 'api',
    model: MODEL,
    usage: json.usage,
    fetchedUrl,
  };
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

function simulateOutput({ agent, title, kind, company, pageContext }) {
  // We *do* still write a stub when no API key, but we use the real
  // fetched data so the output references the actual site.
  const header = `📋 ${title}\n회사: ${company.name} — ${company.url}\n`;
  const dataLine = pageContext ? '\n(아래 분석은 위 사이트 데이터에 기반)\n' : '\n(컨텍스트만 사용 — 사이트 데이터 미가져옴)\n';
  const body = pageContext
    ? `\n시뮬레이션 모드(API 키 없음): 실제 권장사항은 ANTHROPIC_API_KEY를 .env에 등록하세요.\n\n사이트에서 발견된 신호 요약:\n${pageContext.split('\n').slice(0, 12).join('\n')}\n\n다음 단계: API 키 등록 → 본 직원이 위 데이터를 근거로 구체 액션 보고`
    : `\n시뮬레이션 모드. 이 직원은 회사 컨텍스트만 보고 일반 프레임워크를 안내할 수 있습니다.\nANTHROPIC_API_KEY를 .env에 등록하면 회사 컨텍스트 기반 실제 권장사항을 작성합니다.`;
  return header + dataLine + body;
}
