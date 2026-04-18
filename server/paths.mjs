// Resolve a writable data directory, surviving Windows' protected
// locations (e.g. C:\Users\ direct children block mkdir for normal users).
//
// Resolution order:
//   1. $AMO_DATA_DIR (explicit override)
//   2. <repo>/.agents (cross-platform convention used by marketing skills)
//   3. <home>/.ai-marketing-office (safe fallback)
//
// If a candidate is unwritable, we move on and log which path won.

import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function canWrite(dir) {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, '.write-test-' + Date.now());
    writeFileSync(probe, 'ok');
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

let resolved = null;

export function dataDir() {
  if (resolved) return resolved;
  const candidates = [
    process.env.AMO_DATA_DIR,
    join(REPO_ROOT, '.agents'),
    join(homedir(), '.ai-marketing-office'),
  ].filter(Boolean);

  for (const c of candidates) {
    if (canWrite(c)) {
      resolved = c;
      return c;
    }
  }
  // Last resort: tmpdir equivalent won't lose critical data but user won't be
  // able to persist between sessions. Throw rather than silently degrade.
  throw new Error(
    '쓰기 가능한 데이터 디렉터리를 찾지 못했습니다. 다음 중 하나로 해결하세요:\n' +
    '  1) 저장소 폴더를 권한 없는 위치(C:\\Users\\ 직속)에서 바탕화면/Documents로 이동\n' +
    '  2) 환경변수 AMO_DATA_DIR=C:\\쓸수있는\\경로\\data 지정'
  );
}

export function logDataDir() {
  const dir = dataDir();
  console.log(`💾 데이터 디렉터리: ${dir}`);
  return dir;
}
