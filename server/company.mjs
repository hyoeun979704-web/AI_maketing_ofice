// Company profile. New schema (2026-04):
//   - targets[]  : list of URLs with role (website / landing / appstore /
//                  blog / social_*). Different skills pick different
//                  targets (aso-audit → appstore, social-content → social_*).
//   - goals[]    : array of keys from PREDEFINED_GOALS (multi-select UI).
//   - customGoals: optional free-text for goals not in the list.
//
// Persisted as JSON + a human-readable markdown copy that stays compatible
// with existing product-marketing-context.md consumers.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir } from './paths.mjs';

const EMPTY = {
  name: '',
  description: '',
  audience: '',
  voice: '',
  competitors: '',
  notes: '',
  goals: [],
  customGoals: '',
  targets: [],
  updatedAt: null,
};

export const PREDEFINED_GOALS = [
  { key: 'new_user_growth', label: '신규 가입 증가' },
  { key: 'trial_to_paid', label: '유료 전환율 개선' },
  { key: 'retention', label: '고객 유지·재방문 상승' },
  { key: 'churn_reduction', label: '이탈률 감소' },
  { key: 'ltv_growth', label: '고객 생애 가치 확대' },
  { key: 'arr_growth', label: 'ARR·매출 성장' },
  { key: 'lead_gen', label: 'B2B 리드 생성' },
  { key: 'brand_awareness', label: '브랜드 인지도 상승' },
  { key: 'seo_traffic', label: 'SEO 오가닉 트래픽 증가' },
  { key: 'social_following', label: '소셜 팔로워 증가' },
  { key: 'content_engagement', label: '콘텐츠 참여도 상승' },
  { key: 'email_performance', label: '이메일 오픈·클릭률 개선' },
  { key: 'ad_roas', label: '광고 ROAS 개선' },
  { key: 'onboarding_ttv', label: '온보딩 Time-to-Value 단축' },
  { key: 'pricing_efficiency', label: '가격 정책 최적화' },
  { key: 'community_growth', label: '커뮤니티 성장' },
];

export const TARGET_KINDS = [
  { key: 'website', label: '웹사이트 (메인)' },
  { key: 'landing', label: '랜딩페이지' },
  { key: 'blog', label: '블로그' },
  { key: 'appstore_ios', label: '앱스토어 (iOS)' },
  { key: 'appstore_android', label: 'Play 스토어 (Android)' },
  { key: 'social_youtube', label: 'YouTube 채널' },
  { key: 'social_instagram', label: 'Instagram' },
  { key: 'social_tiktok', label: 'TikTok' },
  { key: 'social_facebook', label: 'Facebook 페이지' },
  { key: 'social_naver_blog', label: '네이버 블로그' },
  { key: 'social_x', label: 'X (Twitter)' },
  { key: 'other', label: '기타' },
];

let cache = null;

async function paths() {
  const dir = dataDir();
  await mkdir(dir, { recursive: true });
  return {
    json: join(dir, 'company.json'),
    md: join(dir, 'product-marketing-context.md'),
  };
}

export async function getCompany() {
  if (cache) return cache;
  const { json } = await paths();
  if (existsSync(json)) {
    try {
      const raw = JSON.parse(await readFile(json, 'utf8'));
      cache = migrate(raw);
      return cache;
    } catch {}
  }
  cache = { ...EMPTY };
  return cache;
}

// Backwards compat: old schema had a single `url` field.
function migrate(raw) {
  const out = { ...EMPTY, ...raw };
  if (!Array.isArray(out.goals)) out.goals = [];
  if (!Array.isArray(out.targets)) out.targets = [];
  if (raw.url && out.targets.length === 0) {
    out.targets.push({ kind: 'website', label: '메인 사이트', url: raw.url });
  }
  delete out.url;
  return out;
}

export async function saveCompany(input) {
  const prev = cache || { ...EMPTY };
  const merged = { ...prev, ...input };
  if (!Array.isArray(merged.goals)) merged.goals = [];
  if (!Array.isArray(merged.targets)) merged.targets = [];
  // Drop empty target rows (kind/url both empty) for clean persistence
  merged.targets = merged.targets.filter((t) => t && (t.url || '').trim());
  merged.updatedAt = new Date().toISOString();
  cache = merged;
  const { json, md } = await paths();
  await writeFile(json, JSON.stringify(merged, null, 2), 'utf8');
  await writeFile(md, renderMarkdown(merged), 'utf8');
  return merged;
}

export function isProfileReady(p) {
  if (!p) return false;
  if (!p.name || !p.description) return false;
  return Array.isArray(p.targets) && p.targets.length > 0 && p.targets.some((t) => t.url);
}

export function goalLabels(keys) {
  return (keys || []).map((k) => PREDEFINED_GOALS.find((g) => g.key === k)?.label || k);
}

export function kindLabel(k) {
  return TARGET_KINDS.find((x) => x.key === k)?.label || k;
}

function renderMarkdown(p) {
  const goalText = [
    ...goalLabels(p.goals),
    ...(p.customGoals ? [p.customGoals] : []),
  ].map((g) => `- ${g}`).join('\n') || '—';
  const targetText = (p.targets || []).map(
    (t) => `- **${kindLabel(t.kind) || 'URL'}** (${t.label || '—'}): ${t.url}`
  ).join('\n') || '—';
  return `# Product Marketing Context

*최근 업데이트: ${p.updatedAt || '—'}*

## 회사
- **이름:** ${p.name || '—'}
- **설명:** ${p.description || '—'}

## 타겟 자산
${targetText}

## 타겟 오디언스
${p.audience || '—'}

## 브랜드 보이스
${p.voice || '—'}

## 비즈니스 목표
${goalText}

## 경쟁사 / 대안
${p.competitors || '—'}

## 추가 메모
${p.notes || '—'}
`;
}

// The context block injected into every agent's user prompt.
export function contextBlock(profile) {
  if (!isProfileReady(profile)) return null;
  const goals = [
    ...goalLabels(profile.goals),
    ...(profile.customGoals ? [profile.customGoals] : []),
  ];
  const targetLines = (profile.targets || []).map(
    (t) => `  - [${t.kind}] ${t.label || ''}: ${t.url}`
  ).join('\n');

  return `# 회사 프로필 (모든 작업의 기반)

- 회사: ${profile.name}
- 설명: ${profile.description}
- 타겟 오디언스: ${profile.audience || '미정'}
- 브랜드 톤: ${profile.voice || '미정'}
- 경쟁사: ${profile.competitors || '미정'}
- 비즈니스 목표:
${goals.length ? goals.map((g) => `  - ${g}`).join('\n') : '  - 미정'}
- 등록된 타겟 자산:
${targetLines || '  - (없음)'}
${profile.notes ? '\n참고 메모:\n' + profile.notes : ''}

위 정보를 모든 작업·결정의 기준으로 사용하세요.`;
}

// Pick the best target URL for a given skill. Returns { url, label, kind } or null.
export function pickTargetForSkill(profile, skillName) {
  if (!profile || !Array.isArray(profile.targets) || profile.targets.length === 0) return null;
  const preferred = SKILL_TARGET_PREFERENCES[skillName] || ['website', 'landing'];
  for (const kind of preferred) {
    const hit = profile.targets.find((t) => t.kind === kind && t.url);
    if (hit) return hit;
  }
  // Wildcard match — e.g. social-content accepts any social_*
  for (const kind of preferred) {
    if (kind.endsWith('*')) {
      const prefix = kind.slice(0, -1);
      const hit = profile.targets.find((t) => t.kind?.startsWith(prefix) && t.url);
      if (hit) return hit;
    }
  }
  // Fallback: first target with a URL
  return profile.targets.find((t) => t.url) || null;
}

// Per-skill target preference list. First match wins. '*' at end means
// prefix match (any social_* etc.).
export const SKILL_TARGET_PREFERENCES = {
  'seo-audit':            ['website', 'landing'],
  'ai-seo':               ['website', 'blog', 'landing'],
  'schema-markup':        ['website', 'landing'],
  'site-architecture':    ['website'],
  'programmatic-seo':     ['website', 'landing'],
  'competitor-alternatives': ['website', 'landing'],
  'content-strategy':     ['website', 'blog'],
  'copywriting':          ['landing', 'website'],
  'copy-editing':         ['landing', 'website', 'blog'],
  'page-cro':             ['landing', 'website'],
  'signup-flow-cro':      ['landing', 'website'],
  'onboarding-cro':       ['website', 'landing'],
  'form-cro':             ['landing', 'website'],
  'popup-cro':            ['landing', 'website'],
  'paywall-upgrade-cro':  ['website', 'landing'],
  'analytics-tracking':   ['website', 'landing'],
  'ab-test-setup':        ['landing', 'website'],
  'marketing-ideas':      ['website'],
  'marketing-psychology': ['landing', 'website'],
  'launch-strategy':      ['website', 'landing'],
  'pricing-strategy':     ['website', 'landing'],
  'customer-research':    ['website'],
  'product-marketing-context': ['website'],
  'sales-enablement':     ['website', 'landing'],
  'lead-magnets':         ['landing', 'website'],
  'free-tool-strategy':   ['website'],
  'aso-audit':            ['appstore_ios', 'appstore_android'],
  'social-content':       ['social_youtube', 'social_instagram', 'social_tiktok', 'social_facebook', 'social_x', 'social_naver_blog'],
  'community-marketing':  ['social_*', 'blog'],
  'video-script-automation': ['social_youtube', 'social_tiktok', 'social_instagram'],
  'ad-creative':          ['landing', 'website'],
};
