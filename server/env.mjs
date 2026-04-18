// Tiny zero-dep .env loader. Reads ./<repo>/.env if it exists and copies any
// `KEY=VALUE` lines into process.env (without overwriting existing values).
// Comments (# ...) and blank lines are skipped. Surrounding single/double
// quotes are stripped. Multi-line values not supported — keep keys on one line.

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');

if (existsSync(ENV_PATH)) {
  let loaded = 0;
  for (const rawLine of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let [, key, value] = m;
    // Strip optional surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
      loaded++;
    }
  }
  if (loaded > 0) console.log(`📄 .env loaded — ${loaded} variable(s)`);
}
