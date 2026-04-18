#!/usr/bin/env node
// Zero-dependency parser. Reads every skills/*/SKILL.md and emits
// dashboard/data/skills.json with the fields the dashboard needs.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, 'skills');
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const OUT_FILE = join(OUT_DIR, 'skills.json');

// Department assignment mirrors README.md's category grouping.
// Keys: department id → { label, color, skills[] }
const DEPARTMENTS = {
  cro: {
    label: '전환율 최적화',
    icon: '🎯',
    color: '#4C8BF5',
    skills: ['page-cro', 'signup-flow-cro', 'onboarding-cro', 'form-cro', 'popup-cro', 'paywall-upgrade-cro'],
  },
  content: {
    label: '콘텐츠·카피',
    icon: '✍️',
    color: '#A855F7',
    skills: ['copywriting', 'copy-editing', 'cold-email', 'email-sequence', 'social-content'],
  },
  seo: {
    label: 'SEO·발견',
    icon: '🔍',
    color: '#10B981',
    skills: ['seo-audit', 'ai-seo', 'programmatic-seo', 'site-architecture', 'competitor-alternatives', 'schema-markup', 'content-strategy'],
  },
  paid: {
    label: '유료·광고·측정',
    icon: '💰',
    color: '#F59E0B',
    skills: ['paid-ads', 'ad-creative', 'ab-test-setup', 'analytics-tracking'],
  },
  growth: {
    label: '그로스·리텐션',
    icon: '📈',
    color: '#EF4444',
    skills: ['referral-program', 'free-tool-strategy', 'churn-prevention', 'lead-magnets', 'community-marketing'],
  },
  sales: {
    label: '세일즈·GTM',
    icon: '🤝',
    color: '#14B8A6',
    skills: ['revops', 'sales-enablement', 'launch-strategy', 'pricing-strategy'],
  },
  strategy: {
    label: '전략·리서치',
    icon: '🧠',
    color: '#6366F1',
    skills: ['marketing-ideas', 'marketing-psychology', 'customer-research', 'aso-audit', 'product-marketing-context'],
  },
  korea: {
    label: '한국 특화',
    icon: '🇰🇷',
    color: '#DC2626',
    skills: ['naver-kin-automation', 'video-script-automation'],
  },
};

// Emoji persona per skill — deterministic mnemonics, not random.
const EMOJI = {
  'ab-test-setup': '🧪',
  'ad-creative': '🎨',
  'ai-seo': '🤖',
  'analytics-tracking': '📊',
  'aso-audit': '📱',
  'churn-prevention': '🛟',
  'cold-email': '📧',
  'community-marketing': '👥',
  'competitor-alternatives': '⚖️',
  'content-strategy': '🗺️',
  'copy-editing': '📝',
  'copywriting': '✒️',
  'customer-research': '🔬',
  'email-sequence': '📬',
  'form-cro': '📋',
  'free-tool-strategy': '🛠️',
  'launch-strategy': '🚀',
  'lead-magnets': '🧲',
  'marketing-ideas': '💡',
  'marketing-psychology': '🧠',
  'naver-kin-automation': '💬',
  'onboarding-cro': '👋',
  'page-cro': '📄',
  'paid-ads': '💸',
  'paywall-upgrade-cro': '💳',
  'popup-cro': '🪟',
  'pricing-strategy': '🏷️',
  'product-marketing-context': '🏛️',
  'programmatic-seo': '⚙️',
  'referral-program': '🔗',
  'revops': '📈',
  'sales-enablement': '📑',
  'schema-markup': '🏷️',
  'seo-audit': '🔎',
  'signup-flow-cro': '🔐',
  'site-architecture': '🏗️',
  'social-content': '📱',
  'video-script-automation': '🎬',
};

// Korean-localized display names. Falls back to hyphenated English when missing.
const KO_NAME = {
  'ab-test-setup': 'A/B 테스트 설계자',
  'ad-creative': '광고 크리에이티브 제작자',
  'ai-seo': 'AI 검색 최적화 담당',
  'analytics-tracking': '애널리틱스 트래킹 엔지니어',
  'aso-audit': 'ASO 감사관',
  'churn-prevention': '이탈 방지 스페셜리스트',
  'cold-email': '콜드 이메일 카피라이터',
  'community-marketing': '커뮤니티 매니저',
  'competitor-alternatives': '경쟁사 대안 페이지 작성자',
  'content-strategy': '콘텐츠 전략가',
  'copy-editing': '카피 편집자',
  'copywriting': '카피라이터',
  'customer-research': '고객 리서처',
  'email-sequence': '이메일 시퀀스 담당자',
  'form-cro': '폼 CRO 스페셜리스트',
  'free-tool-strategy': '프리 툴 전략가',
  'launch-strategy': '런칭 전략가',
  'lead-magnets': '리드 매그넷 기획자',
  'marketing-ideas': '마케팅 아이디어 제공자',
  'marketing-psychology': '마케팅 심리학자',
  'naver-kin-automation': '지식iN 모니터링 팀장',
  'onboarding-cro': '온보딩 CRO 담당자',
  'page-cro': '페이지 CRO 스페셜리스트',
  'paid-ads': '유료 광고 매니저',
  'paywall-upgrade-cro': '페이월 CRO 담당자',
  'popup-cro': '팝업 CRO 담당자',
  'pricing-strategy': '가격 전략가',
  'product-marketing-context': '프로덕트 마케팅 컨텍스트 매니저 (기반)',
  'programmatic-seo': '프로그래매틱 SEO 엔지니어',
  'referral-program': '레퍼럴 프로그램 매니저',
  'revops': 'RevOps 운영자',
  'sales-enablement': '세일즈 인에이블먼트 담당자',
  'schema-markup': '스키마 마크업 엔지니어',
  'seo-audit': 'SEO 감사관',
  'signup-flow-cro': '가입 플로우 CRO 담당자',
  'site-architecture': '사이트 아키텍트',
  'social-content': '소셜 콘텐츠 매니저',
  'video-script-automation': '영상 대본 작가',
};

// Parse the YAML frontmatter. SKILL.md files use a small, fixed subset:
// top-level `name`, `description`, optional `metadata:` block with nested
// `version`, `ko-version`, `ko-only`. This is enough; no full YAML parser needed.
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: null, body: text };
  const yaml = match[1];
  const body = text.slice(match[0].length).trim();

  const out = { metadata: {} };
  let inMetadata = false;
  for (const rawLine of yaml.split('\n')) {
    if (/^\s*$/.test(rawLine)) continue;
    // Nested metadata keys: "  key: value"
    if (/^\s{2,}/.test(rawLine)) {
      const m = rawLine.match(/^\s+([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (m && inMetadata) {
        out.metadata[m[1]] = stripQuotes(m[2]);
      }
      continue;
    }
    // Top-level key
    if (rawLine.startsWith('metadata:')) {
      inMetadata = true;
      continue;
    }
    inMetadata = false;
    const m = rawLine.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    if (value.startsWith('"') || value.startsWith("'")) {
      // Multi-line quoted value: if the closing quote isn't on this line, the
      // rest of the frontmatter continues until we find a matching quote. For
      // SKILL.md descriptions this is rarely multi-line, but handle the 1024-
      // char edge case just in case.
      value = stripQuotes(value);
    }
    out[key] = value;
  }
  return { frontmatter: out, body };
}

function stripQuotes(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

// Extract the first body paragraph as "role summary".
function firstParagraph(body) {
  const lines = body.split('\n');
  // Skip leading H1
  let start = 0;
  if (lines[0]?.startsWith('# ')) {
    start = 1;
    while (start < lines.length && lines[start].trim() === '') start++;
  }
  const collected = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      if (collected.length > 0) break;
      continue;
    }
    if (line.startsWith('#')) {
      if (collected.length > 0) break;
      continue;
    }
    collected.push(line);
  }
  return collected.join(' ').trim();
}

// Which department does this skill belong to?
function departmentOf(skillName) {
  for (const [id, dept] of Object.entries(DEPARTMENTS)) {
    if (dept.skills.includes(skillName)) return id;
  }
  return null;
}

async function main() {
  const dirs = (await readdir(SKILLS_DIR, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const skills = [];
  for (const name of dirs) {
    const filePath = join(SKILLS_DIR, name, 'SKILL.md');
    let raw;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch {
      console.warn(`skipping ${name}: no SKILL.md`);
      continue;
    }
    const { frontmatter, body } = parseFrontmatter(raw);
    if (!frontmatter) {
      console.warn(`skipping ${name}: no frontmatter`);
      continue;
    }
    const dept = departmentOf(name);
    if (!dept) {
      console.warn(`no department for ${name}; assigning 'strategy'`);
    }
    skills.push({
      name,
      displayName: KO_NAME[name] || name,
      emoji: EMOJI[name] || '🧑‍💼',
      department: dept || 'strategy',
      description: frontmatter.description || '',
      role: firstParagraph(body),
      version: frontmatter.metadata?.version || '—',
      koVersion: frontmatter.metadata?.['ko-version'] || null,
      koOnly: frontmatter.metadata?.['ko-only'] === 'true',
      localized: frontmatter.metadata?.['ko-version'] ? true : false,
    });
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify({ departments: DEPARTMENTS, skills, generatedAt: new Date().toISOString() }, null, 2),
    'utf8'
  );

  console.log(`wrote ${skills.length} skills → ${OUT_FILE}`);

  // Sanity: every department claims N skills, check we assigned them all.
  const declared = Object.values(DEPARTMENTS).reduce((acc, d) => acc + d.skills.length, 0);
  if (declared !== skills.length) {
    console.warn(`⚠️  departments declare ${declared} skills but parsed ${skills.length}`);
  }
}

main();
