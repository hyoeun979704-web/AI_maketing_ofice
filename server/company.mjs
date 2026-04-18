// Company profile: who is the office actually marketing for?
// Persisted as .agents/product-marketing-context.md (markdown so it stays
// readable + matches what every existing skill already looks for) and a
// shadow .agents/company.json for structured fields.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS_DIR = join(ROOT, '.agents');
const JSON_PATH = join(AGENTS_DIR, 'company.json');
const MD_PATH = join(AGENTS_DIR, 'product-marketing-context.md');

const EMPTY = {
  name: '',
  url: '',
  description: '',
  audience: '',
  voice: '',
  goals: '',
  competitors: '',
  notes: '',
  updatedAt: null,
};

let cache = null;

export async function getCompany() {
  if (cache) return cache;
  if (existsSync(JSON_PATH)) {
    try {
      cache = JSON.parse(await readFile(JSON_PATH, 'utf8'));
      return cache;
    } catch {}
  }
  cache = { ...EMPTY };
  return cache;
}

export async function saveCompany(input) {
  const profile = { ...EMPTY, ...(cache || {}), ...input, updatedAt: new Date().toISOString() };
  cache = profile;
  await mkdir(AGENTS_DIR, { recursive: true });
  await writeFile(JSON_PATH, JSON.stringify(profile, null, 2), 'utf8');
  await writeFile(MD_PATH, renderMarkdown(profile), 'utf8');
  return profile;
}

export function isProfileReady(profile) {
  if (!profile) return false;
  return Boolean(profile.name && profile.url && profile.description);
}

function renderMarkdown(p) {
  return `# Product Marketing Context

*최근 업데이트: ${p.updatedAt || '—'}*

## 회사
- **이름:** ${p.name || '—'}
- **사이트:** ${p.url || '—'}
- **설명:** ${p.description || '—'}

## 타겟 오디언스
${p.audience || '—'}

## 브랜드 보이스
${p.voice || '—'}

## 비즈니스 목표
${p.goals || '—'}

## 경쟁사 / 대안
${p.competitors || '—'}

## 추가 메모
${p.notes || '—'}
`;
}

// Build the context block to prepend to every agent's user prompt.
// Returns null if no profile registered (agents will respond with
// "데이터 연결 필요" instead of pretending).
export function contextBlock(profile) {
  if (!isProfileReady(profile)) return null;
  return `# 회사 프로필 (모든 작업의 기반)

- 회사: ${profile.name}
- 사이트: ${profile.url}
- 설명: ${profile.description}
- 타겟: ${profile.audience || '미정'}
- 톤: ${profile.voice || '미정'}
- 목표: ${profile.goals || '미정'}
- 경쟁사: ${profile.competitors || '미정'}
${profile.notes ? '\n참고:\n' + profile.notes : ''}

위 정보를 모든 작업·결정의 기준으로 사용하세요.`;
}
