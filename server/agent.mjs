// Agent runner: loads a skill's SKILL.md as system prompt, calls Claude API
// with a short user task. Falls back to a realistic simulation when no
// ANTHROPIC_API_KEY is present, so the UI still works end-to-end.

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 512;

// Cache loaded SKILL.md content
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

/**
 * Run a task: return concise Korean output (string). Throws on failure.
 * When in simulation mode, produces a plausible stub so the UI can show work.
 */
export async function runTask({ agent, title, kind }) {
  const system = await loadSystemPrompt(agent);

  if (!API_KEY) return simulateOutput({ agent, title, kind });

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{
      role: 'user',
      content: `다음 업무를 수행하고 결과를 **한국어로, 6줄 이내 bullet list**로 간결하게 보고하세요.\n\n업무: ${title}\n\n컨텍스트 정보가 부족하면 합리적인 가정을 적고 계속 진행하세요. 실제 서비스 데이터 접근은 없으므로 논리적 프레임워크와 다음 행동을 중심으로 답변하세요.`,
    }],
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
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json.content?.[0]?.text?.trim();
  if (!content) throw new Error('empty response from Anthropic API');
  return content;
}

// ---------- Simulation ----------
// Produces varied, plausible Korean bullet outputs per skill family. The goal
// isn't to be accurate, it's to demonstrate the UI flow end-to-end so the
// user can evaluate the system without burning API credits or a key.

const TEMPLATES = {
  seo: [
    '- 인덱스 페이지 중 meta description 누락 12건 발견',
    '- Core Web Vitals LCP 2.8s → 2.3s 개선 기회',
    '- 내부 링크 그래프에서 orphan page 4개 식별',
    '- 다음 조치: 메타 누락 페이지 재배포 + LCP 이미지 lazy-load',
  ],
  copy: [
    '- 기존 헤드라인: 기능 중심 / 제안: benefit + 구체 수치',
    '- A안: "3분만에 월간 리포트 자동 완성"',
    '- B안: "새벽 엑셀 작업, 이제 끝"',
    '- C안: "2,000팀이 선택한 자동화"',
  ],
  cro: [
    '- 히어로 섹션 이탈률 58% (벤치 42%)',
    '- 주요 원인: 가치 제안 추상적, 사회적 증거 부족',
    '- 실험안 1: 구체 수치로 헤드라인 교체',
    '- 실험안 2: 상단에 고객 로고 행 추가',
  ],
  ads: [
    '- 지난 7일 ROAS: 2.1 → 2.4 (목표 2.5)',
    '- Meta 캠페인 A 성과 저조 → 예산 30% 축소 제안',
    '- 새 오디언스 "SaaS 마케터 직무" 테스트 제안',
    '- 크리에이티브 피로도 관찰 → 신규 5종 집행 권장',
  ],
  email: [
    '- 지난 발송 오픈율 38% / 클릭 6.2%',
    '- 주제 문장 "이번 달만" 성과 우수',
    '- 시퀀스 3단계에서 이탈 집중 → 발송 간격 재조정 제안',
    '- 대본 초안 3종 발송 대기 중 (승인 필요)',
  ],
  korea: [
    '- 지식iN 모니터링: 타겟 키워드 질문 23건 수집',
    '- 대응 후보 (60+ 점) 5건 식별',
    '- 답변 초안 2건 작성 완료 — 닉네임·태그 전략 적용',
    '- 다음 단계: 컴플라이언스 체크 후 등록 승인 요청',
  ],
  default: [
    '- 과제 범위·기대 결과 명확화 완료',
    '- 가설 3개 도출, 우선순위 스코어링',
    '- 데이터 소스 필요: [analytics, CRM, 고객 인터뷰]',
    '- 다음 24시간 내 초안 완성 예정',
  ],
};

function simulateOutput({ agent, title, kind }) {
  // Classify agent into a template family
  let family = 'default';
  if (/seo|schema|site-architecture|programmatic/.test(agent)) family = 'seo';
  else if (/copy|content-strategy|marketing-ideas/.test(agent)) family = 'copy';
  else if (/cro|page-cro|signup|onboarding|form|popup|paywall/.test(agent)) family = 'cro';
  else if (/paid-ads|ad-creative|analytics-tracking|ab-test/.test(agent)) family = 'ads';
  else if (/email|cold-email/.test(agent)) family = 'email';
  else if (/naver|video-script/.test(agent)) family = 'korea';

  const header = `📋 ${title}\n\n`;
  const bullets = TEMPLATES[family].join('\n');
  const footer = kind === 'publish' || kind === 'spend'
    ? '\n\n⚠️ 이 작업은 ' + (kind === 'spend' ? '예산 집행' : '대외 업로드') + '을 포함하므로 승인 대기 상태로 전환합니다.'
    : '\n\n✅ 초안 완료 — 리포트 저장됨';
  return header + bullets + footer;
}

/**
 * Pretend work takes a few seconds even in API mode, so the UI shows
 * a typing/working animation. Keep it short for UX.
 */
export function workLatency() {
  return 2500 + Math.random() * 3500;
}
