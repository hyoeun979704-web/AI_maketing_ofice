// Zero-dependency Node HTTP server. Serves the static office app,
// exposes the REST + SSE surface the frontend talks to.
//
// Environment:
//   ANTHROPIC_API_KEY    (optional) real Claude execution; otherwise simulation
//   ANTHROPIC_MODEL      default claude-haiku-4-5
//   PORT                 default 8787
//
// Variables can be set inline, exported in the shell, or written to a
// `.env` file at the repo root (auto-loaded by env.mjs below).

import './env.mjs';

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

import * as queue from './queue.mjs';
import * as scheduler from './scheduler.mjs';
import { hasApiKey } from './agent.mjs';
import { getCompany, saveCompany, isProfileReady } from './company.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_ROOT = join(ROOT, 'office');
const DASHBOARD_DATA = join(ROOT, 'dashboard', 'data');
const PORT = Number(process.env.PORT || 8787);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function handleStatic(req, res) {
  // Normalize path. Default to /office/index.html for '/' and '/office'.
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '/office' || urlPath === '/office/') {
    urlPath = '/index.html';
    const file = join(STATIC_ROOT, 'index.html');
    return serveFile(file, res);
  }

  // Serve /office/data/skills.json from dashboard/data (shared)
  if (urlPath === '/data/skills.json') {
    return serveFile(join(DASHBOARD_DATA, 'skills.json'), res);
  }

  // Guard against traversal
  const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const file = join(STATIC_ROOT, safe);
  if (!file.startsWith(STATIC_ROOT)) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  return serveFile(file, res);
}

async function serveFile(file, res) {
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  try {
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('server error: ' + err.message);
  }
}

function handleSSE(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    'connection': 'keep-alive',
  });
  // Snapshot on connect so late-joining clients see state.
  res.write(`event: snapshot\ndata: ${JSON.stringify(queue.getSnapshot())}\n\n`);

  const unsubscribe = queue.subscribe((event) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });

  // Keepalive ping every 25s to keep proxies from timing out.
  const keepalive = setInterval(() => res.write(': ping\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(keepalive);
    unsubscribe();
  });
}

// ---------- Router ----------
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // CORS (same-origin only in practice, but keep explicit)
  res.setHeader('access-control-allow-origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    if (url.pathname === '/api/state' && req.method === 'GET') {
      const company = await getCompany();
      return json(res, 200, {
        ...queue.getSnapshot(),
        apiKeyPresent: hasApiKey(),
        company,
        companyReady: isProfileReady(company),
      });
    }
    if (url.pathname === '/api/company' && req.method === 'GET') {
      return json(res, 200, await getCompany());
    }
    if (url.pathname === '/api/company' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object') return json(res, 400, { error: 'JSON body required' });
      const saved = await saveCompany(body);
      return json(res, 200, saved);
    }
    if (url.pathname === '/api/stream' && req.method === 'GET') {
      return handleSSE(req, res);
    }
    if (url.pathname === '/api/tasks' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body || !body.agent || !body.title) return json(res, 400, { error: 'agent and title required' });
      const task = scheduler.triggerManualTask({ agent: body.agent, title: body.title, kind: body.kind || 'draft' });
      return json(res, 201, task);
    }
    if (url.pathname.startsWith('/api/approvals/') && req.method === 'POST') {
      const id = url.pathname.split('/').pop();
      const body = await readBody(req);
      if (!body || !['approve', 'reject'].includes(body.decision)) {
        return json(res, 400, { error: 'decision must be approve|reject' });
      }
      const approval = queue.resolveApproval(id, body.decision);
      if (!approval) return json(res, 404, { error: 'approval not found or already resolved' });
      return json(res, 200, approval);
    }
    if (url.pathname.startsWith('/api/')) {
      return json(res, 404, { error: 'not found' });
    }
    return handleStatic(req, res);
  } catch (err) {
    console.error('request error', err);
    return json(res, 500, { error: err.message });
  }
});

server.listen(PORT, async () => {
  console.log(`🏢 AI Marketing Office server listening on http://localhost:${PORT}`);
  console.log(`   API key: ${hasApiKey() ? 'present — real Claude execution' : 'not set — simulation mode'}`);
  console.log(`   Model  : ${process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'}`);
  await scheduler.start({ seedCount: 6, spawnIntervalMs: 15_000 });
  console.log(`   Scheduler: seeded 6 tasks, auto-spawn every 15s`);
});
