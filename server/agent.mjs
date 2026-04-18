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

// Build the user-facing prompt for a task. Split out so the scheduler can
// attach it to the task record for UI transparency.
export function buildUserPrompt({ title, kind }) {
  return `다음 업무를 수행하고 결과를 **한국어로 상세히** 보고하세요.

업무: ${title}
종류: ${kind === 'publish' ? '대외 업로드 (승인 대상)' : kind === 'spend' ? '예산 집행 (승인 대상)' : '초안 작성'}

실제 서비스 데이터에는 접근할 수 없으니 합리적 가정을 명시적으로 적고, 프레임워크·체크리스트·다음 24시간 안에 할 구체 행동까지 포함하세요. bullet list 8줄 이내, 중요한 수치는 실증 근거가 필요함을 주석.`;
}

/**
 * Run a task: return concise Korean output (string). Throws on failure.
 * When in simulation mode, produces a plausible stub so the UI can show work.
 */
export async function runTask({ agent, title, kind }) {
  const system = await loadSystemPrompt(agent);
  const userPrompt = buildUserPrompt({ title, kind });

  if (!API_KEY) {
    return {
      output: simulateOutput({ agent, title, kind }),
      systemPrompt: system,
      userPrompt,
      mode: 'simulation',
    };
  }

  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
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
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json.content?.[0]?.text?.trim();
  if (!content) throw new Error('empty response from Anthropic API');
  return {
    output: content,
    systemPrompt: system,
    userPrompt,
    mode: 'api',
    model: MODEL,
    usage: json.usage,
  };
}

// ---------- Simulation ----------
// Produces varied, plausible Korean outputs per skill + task, so the UI
// demo doesn't look robotic when no API key is present. Each call picks a
// template variant and interpolates numbers so two runs rarely look
// identical. Not an accuracy promise — real API is still the path for real
// work.

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rint(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
function rpct(min, max) { return (min + Math.random() * (max - min)).toFixed(1); }

function varySeo(title) {
  return [
    `📊 ${title}`,
    '',
    `**관찰:**`,
    `- 인덱스된 페이지 ${rint(180, 420)}개 중 meta description 누락 ${rint(6, 28)}건`,
    `- Core Web Vitals LCP 중앙값 ${rpct(2.1, 3.4)}s (목표 ≤ 2.5s)`,
    `- 인터널 링크 그래프에서 orphan page ${rint(2, 9)}개 식별`,
    `- 모바일 CLS ${rpct(0.08, 0.2)} (양호), INP ${rint(180, 420)}ms`,
    '',
    `**다음 24시간 액션:**`,
    `1. 메타 누락 페이지에 title·description 일괄 재배포 (30분)`,
    `2. 히어로 이미지 WebP 변환 + preload 적용`,
    `3. orphan 페이지는 관련 카테고리 허브에서 링크 추가`,
    '',
    `**가정·전제:**`,
    `- 상기 수치는 실제 GSC/Search Console 데이터 없이 일반 벤치에서 추정`,
    `- 실증을 위해선 Search Console·Lighthouse 실 데이터 연결 필요`,
  ].join('\n');
}

function varyCro(title) {
  return [
    `🎯 ${title}`,
    '',
    `**가설:**`,
    `- 현재 히어로 이탈률 ${rint(48, 62)}% (벤치 ${rint(38, 45)}%) → 가치 제안 추상적, 구체 수치 부재가 주요 원인`,
    '',
    `**실험안 3종:**`,
    `1. (H1 교체) "${rnd(['3분만에', '하루 만에', '설정 5분'])} ${rnd(['매출 리포트 자동화', '고객 유입 추적', '캠페인 ROAS 시각화'])}"`,
    `2. (증거 강화) 상단에 고객 로고 ${rint(5, 8)}개 행 + 주요 지표 1줄`,
    `3. (CTA 변경) "${rnd(['지금 시작 →', '14일 무료 →', '데모 예약 →'])}" 버튼으로 교체, above-the-fold 배치`,
    '',
    `**측정 계획:**`,
    `- 1차 지표: 히어로 CTA 클릭률`,
    `- 2차 지표: 가입 전환율, 평균 체류 시간`,
    `- 샘플 사이즈: 통계 유의성 확보를 위해 ${rint(8, 14)}일, 각 그룹 ${rint(2000, 5000)} 방문 필요`,
    '',
    `**다음 단계:** ab-test-setup 스킬과 연동해 실험 가설 문서화 → 개발팀 배포 티켓`,
  ].join('\n');
}

function varyCopy(title) {
  return [
    `✒️ ${title}`,
    '',
    `**대안 카피 3종:**`,
    `- A (혜택 강조): "${rnd(['야근 없이 끝내는', '3분이면 끝나는', '클릭 한 번으로'])} ${rnd(['월간 리포트', '캠페인 분석', '고객 인사이트'])}"`,
    `- B (불안 해소): "${rnd(['엑셀 무한 열기', '새벽 마감', '실수투성이 수작업'])}, 이제 그만"`,
    `- C (사회적 증거): "${rint(800, 4200)}팀이 선택한 마케팅 자동화"`,
    '',
    `**원칙 적용:**`,
    `- Jobs-to-be-Done: 고객이 '고용'하는 이유 = 시간 절약 + 실수 제거 + 의사결정 속도`,
    `- PAS 프레임: problem(야근)/agitate(마감 스트레스)/solution(자동화)`,
    `- 외래어 최소화, 2문장 이내, 모바일 읽기 속도 고려`,
    '',
    `**A/B 테스트 권장:** copywriting ↔ ab-test-setup 연동, 1차 지표 CTR`,
  ].join('\n');
}

function varyAds(title) {
  return [
    `💸 ${title}`,
    '',
    `**최근 7일 성과 요약:**`,
    `- 총 노출 ${rint(120, 480)}K, 클릭 ${rint(4, 18)}K, CTR ${rpct(1.2, 3.8)}%`,
    `- CPC 평균 ${rint(320, 980)}원, ROAS ${rpct(1.8, 3.2)} (목표 2.5)`,
    `- 전환 ${rint(120, 540)}건, CPA ${rint(11000, 42000)}원`,
    '',
    `**진단:**`,
    `- ${rnd(['캠페인 A', '캠페인 B', '오디언스 "관심사 SaaS"'])} 피로도 관찰 (CTR 주간 -${rpct(8, 22)}%)`,
    `- ${rnd(['리타게팅', '룩얼라이크 1%', '신규 관심사'])} 세그먼트는 CPA 양호`,
    '',
    `**제안 (승인 필요):**`,
    `- 피로한 광고셋 예산 ${rint(20, 40)}% 축소 → 성과 셋으로 이전`,
    `- 새 크리에이티브 ${rint(3, 6)}종 집행 (ad-creative 스킬 연동)`,
    `- 추정 일 예산 변동: +${rint(50, 250)}K원`,
    '',
    `⚠️ 예산 변경은 승인 후 실행합니다.`,
  ].join('\n');
}

function varyEmail(title) {
  return [
    `📧 ${title}`,
    '',
    `**지난 발송 성과 (n=${rint(2800, 18000)}):**`,
    `- 오픈율 ${rpct(22, 42)}%, 클릭률 ${rpct(2.1, 7.8)}%, 언서브 ${rpct(0.1, 0.8)}%`,
    `- Top 주제 문장: "${rnd(['이번 달만', 'OOO님, 놓치지 마세요', '새로 추가됐어요'])}"`,
    '',
    `**5단 시퀀스 초안:**`,
    `1. D+0: 환영 + 온보딩 3단계 체크리스트`,
    `2. D+2: 주요 기능 투어 + 데모 영상`,
    `3. D+5: 고객 사례 1 + CTA "무료 상담"`,
    `4. D+8: 자주 묻는 질문 Top 5`,
    `5. D+12: 업그레이드 혜택 요약 (할인 시즌성)`,
    '',
    `**컴플라이언스:**`,
    `- 광고성 정보 수신 동의 확인`,
    `- 수신거부 링크, 발신자 정보, 업체 주소 포함`,
    `- 정보통신망법 기준 야간(21-08시) 발송 금지`,
    '',
    `⚠️ 시퀀스 활성화는 승인 후 진행.`,
  ].join('\n');
}

function varyKoreaKin(title) {
  return [
    `💬 ${title}`,
    '',
    `**이번 주 모니터링 결과:**`,
    `- 타겟 키워드 3개 기준 질문 ${rint(18, 56)}건 수집`,
    `- 답변 기회 스코어 60+ 질문 ${rint(3, 11)}건 식별`,
    `- 자사 브랜드 언급 ${rint(0, 4)}건 (감성: 중립 위주)`,
    `- 경쟁사 언급 ${rint(1, 6)}건 — 비교 질문 ${rint(0, 3)}건 포함`,
    '',
    `**대응 후보 (상위 3건):**`,
    `1. "${rnd(['B2B SaaS 마케팅', '콜드 이메일 답장율', '스타트업 그로스'])} 어떻게 시작하나요" — 답변 0개, 최신`,
    `2. "${rnd(['CRM 추천', '이메일 마케팅 툴', '마케팅 자동화'])} 비교" — 답변 2개, 채택 없음`,
    `3. 가입 플로우 최적화 관련 — 구체적 상황 포함 고품질 질문`,
    '',
    `**답변 전략 적용:**`,
    `- 닉네임 "${rnd(['SaaS 그로스 12년차', 'B2B 현직 마케터', '마케팅 실무 10년'])}" 일관 사용`,
    `- 태그: #SaaS #B2B마케팅 #그로스 (일반 4 : 브랜드 1)`,
    `- 본문에 브랜드명 노출 금지 — 프로필 프로필 간접 노출만`,
    '',
    `⚠️ 등록은 컴플라이언스 체크 후 승인 요청.`,
  ].join('\n');
}

function varyKoreaVideo(title) {
  return [
    `🎬 ${title}`,
    '',
    `**대상 포맷·규격:**`,
    `- 플랫폼: ${rnd(['쿠팡라이브', '네이버쇼핑라이브', 'YouTube Shorts', 'Meta Reels 광고'])}`,
    `- 길이: ${rnd(['60분', '30초', '15초', '9초'])}, 해상도 ${rnd(['9:16 세로', '1:1', '16:9'])}`,
    '',
    `**구조:**`,
    `- Hook (0-3s): "${rnd(['월 30만원 절약한 비밀', '초보자가 흔히 실수하는 것', '광고비 2배 줄인 방법'])}"`,
    `- Problem (3-6s): 타겟 페인 구체화`,
    `- Solution (6-12s): 제품 시연 + 핵심 가치 1-2개`,
    `- CTA (12-15s): "지금 무료로 시작 →"`,
    '',
    `**한국어 자막:**`,
    `- 1초당 4-6음절, 줄당 ≤14자, 고딕 Bold`,
    `- 「광고」 라벨 좌상단 고정 (뒷광고 방지 가이드라인)`,
    '',
    `**컴플라이언스:**`,
    `- 수치 주장 실증 자료 필요`,
    `- ${rnd(['식약처 표시 규정', '전자상거래법 광고 표시', '개인정보 무단 노출 금지'])} 준수`,
    '',
    `⚠️ 영상 제작·업로드는 승인 후 진행.`,
  ].join('\n');
}

function varyDefault(title) {
  return [
    `📋 ${title}`,
    '',
    `**접근 프레임:**`,
    `1. 과제 명확화: 측정 가능한 성공 기준 정의`,
    `2. 가정 추출: 현재 데이터 기반 ${rint(2, 4)}개 가설`,
    `3. 우선순위: 영향 × 실행 용이성 매트릭스`,
    '',
    `**필요 데이터:**`,
    `- ${rnd(['GA4', '사용자 인터뷰', 'CRM 데이터', 'A/B 테스트 이력'])}`,
    `- ${rnd(['코호트 분석', '세그먼트 분해', '펀널 드롭오프'])}`,
    '',
    `**다음 24시간:**`,
    `- 초안 문서 1장 작성 (가정 + 제안 + 리스크)`,
    `- 관련 스킬(${rnd(['copywriting', 'ab-test-setup', 'customer-research'])})와 연동 포인트 확인`,
    `- 담당 stakeholder 1인 리뷰 요청`,
  ].join('\n');
}

function simulateOutput({ agent, title, kind }) {
  if (/naver-kin/.test(agent)) return varyKoreaKin(title);
  if (/video-script/.test(agent)) return varyKoreaVideo(title);
  if (/seo|schema|site-architecture|programmatic/.test(agent)) return varySeo(title);
  if (/copy|content-strategy|marketing-ideas|marketing-psych/.test(agent)) return varyCopy(title);
  if (/cro|page-cro|signup|onboarding|form|popup|paywall/.test(agent)) return varyCro(title);
  if (/paid-ads|ad-creative|analytics-tracking|ab-test|pricing|referral/.test(agent)) return varyAds(title);
  if (/email|cold-email/.test(agent)) return varyEmail(title);
  return varyDefault(title);
}

/**
 * Pretend work takes a few seconds even in API mode, so the UI shows
 * a typing/working animation. Keep it short for UX.
 */
export function workLatency() {
  return 2500 + Math.random() * 3500;
}
