// Autonomous task scheduler. Seeds the queue at startup, then periodically
// spawns fresh tasks so the office feels alive. The orchestrator executes
// tasks through runTask() and mediates approvals.

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_TASKS, decideAction } from './policies.mjs';
import { runTask, workLatency } from './agent.mjs';
import * as queue from './queue.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_JSON = join(ROOT, 'dashboard', 'data', 'skills.json');

let allAgents = []; // [{name, displayName, department, ...}]

async function loadAgents() {
  const raw = await readFile(SKILLS_JSON, 'utf8');
  const data = JSON.parse(raw);
  allAgents = data.skills;
  for (const a of allAgents) queue.setAgentStatus(a.name, 'idle');
}

function randomTaskFor(skillName) {
  const bank = SEED_TASKS[skillName];
  if (!bank || bank.length === 0) {
    return { title: `${skillName} 일상 업무`, kind: 'draft' };
  }
  return bank[Math.floor(Math.random() * bank.length)];
}

function pickRandomAgent() {
  if (allAgents.length === 0) return null;
  return allAgents[Math.floor(Math.random() * allAgents.length)];
}

// ---------- Task execution ----------
// Each task goes through: queued → working → [awaiting_approval →] completed/rejected/failed.
// If policy says the action requires approval, we pause BEFORE calling the
// agent for that action (the agent may still do a separate "draft" call).

async function executeTask(taskId) {
  const task = queue.getTask(taskId);
  if (!task || task.status !== 'queued') return;

  // Possibly simulate a collaborative meeting before the primary agent
  // runs the task. See COLLABORATION_MAP.
  await maybeRunMeeting(task);

  queue.updateTask(taskId, { status: 'working', startedAt: Date.now() });
  queue.setAgentStatus(task.agent, 'working');

  // Show animation while the API (or the simulator) produces output.
  await sleep(workLatency());

  try {
    const result = await runTask(task);
    const { output, systemPrompt, userPrompt, mode } = result;
    queue.updateTask(taskId, {
      output, systemPrompt, userPrompt, mode,
      fetchedUrl: result.fetchedUrl,
      missingData: result.missingData,
      fetchError: result.fetchError,
      apiError: result.apiError,
    });

    // Only these modes mean "we really couldn't do the work":
    //   blocked        — prerequisites missing (no company, no target)
    // All others (api, api-with-warnings, simulation, fallback-simulation,
    // framework-only) represent *some* useful output — they go through
    // the normal completion / approval path.
    if (mode === 'blocked') {
      queue.updateTask(taskId, { status: 'blocked', finishedAt: Date.now() });
      queue.setAgentStatus(task.agent, 'idle');
      return;
    }

    const decision = decideAction(task.agent, task.kind);
    if (!decision.autonomous) {
      queue.requestApproval(taskId, decision.reason, task.title);
      return;
    }
    queue.updateTask(taskId, { status: 'completed', finishedAt: Date.now() });
    queue.setAgentStatus(task.agent, 'idle');
  } catch (err) {
    queue.updateTask(taskId, {
      status: 'failed',
      finishedAt: Date.now(),
      output: `⚠️ 예상치 못한 오류: ${err.message}`,
    });
    queue.setAgentStatus(task.agent, 'idle');
  }
}

// ---------- Collaboration map ----------
// When the primary agent's work touches these skills, the primary "calls a
// short meeting" with the listed collaborator(s) before starting. The UI
// renders this as bubble exchanges (no actual second API call — it's a
// coordination moment). Chance of triggering is probabilistic; not every
// task leads to a meeting.

const COLLABORATION_MAP = {
  'page-cro':            ['copywriting', 'ab-test-setup'],
  'signup-flow-cro':     ['customer-research', 'copywriting'],
  'onboarding-cro':      ['product-marketing-context', 'email-sequence'],
  'form-cro':            ['copywriting'],
  'popup-cro':           ['copywriting', 'marketing-psychology'],
  'paywall-upgrade-cro': ['pricing-strategy', 'copywriting'],
  'copywriting':         ['customer-research', 'product-marketing-context'],
  'copy-editing':        ['copywriting'],
  'cold-email':          ['customer-research'],
  'email-sequence':      ['copywriting', 'customer-research'],
  'social-content':      ['copywriting'],
  'seo-audit':           ['site-architecture'],
  'ai-seo':              ['schema-markup', 'content-strategy'],
  'programmatic-seo':    ['site-architecture', 'content-strategy'],
  'site-architecture':   ['seo-audit'],
  'competitor-alternatives': ['customer-research', 'copywriting'],
  'schema-markup':       ['ai-seo'],
  'content-strategy':    ['customer-research', 'seo-audit'],
  'paid-ads':            ['ad-creative', 'customer-research'],
  'ad-creative':         ['copywriting', 'video-script-automation'],
  'ab-test-setup':       ['analytics-tracking'],
  'analytics-tracking':  ['ab-test-setup'],
  'referral-program':    ['pricing-strategy', 'copywriting'],
  'free-tool-strategy':  ['marketing-ideas', 'seo-audit'],
  'churn-prevention':    ['customer-research', 'email-sequence'],
  'lead-magnets':        ['copywriting', 'customer-research'],
  'community-marketing': ['social-content'],
  'marketing-ideas':     ['customer-research', 'marketing-psychology'],
  'marketing-psychology': ['copywriting'],
  'launch-strategy':     ['social-content', 'paid-ads', 'copywriting'],
  'pricing-strategy':    ['customer-research', 'paywall-upgrade-cro'],
  'sales-enablement':    ['customer-research', 'copywriting'],
  'revops':              ['analytics-tracking'],
  'aso-audit':           ['copywriting', 'ai-seo'],
  'customer-research':   ['product-marketing-context'],
  'product-marketing-context': ['customer-research'],
  'naver-kin-automation': ['ai-seo', 'customer-research'],
  'video-script-automation': ['copywriting', 'ad-creative'],
};

function collaboratorsFor(skillName) {
  return COLLABORATION_MAP[skillName] || [];
}

async function maybeRunMeeting(task) {
  const pool = collaboratorsFor(task.agent);
  if (pool.length === 0) return;
  // 55% chance of a meeting — enough to feel collaborative without being noise.
  if (Math.random() > 0.55) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  // Don't pull someone who's busy
  if (queue.getSnapshot().agentStatus[pick] !== 'idle') return;

  queue.startMeeting({
    primary: task.agent,
    collaborator: pick,
    topic: task.title,
  });
  await sleep(4200 + Math.random() * 2500);
  queue.endMeeting({ primary: task.agent, collaborator: pick });
}

function handleApprovalResolution(event) {
  if (event.type !== 'approval.resolved') return;
  const { approval } = event;
  const task = queue.getTask(approval.taskId);
  if (!task) return;
  if (approval.status === 'approve') {
    queue.updateTask(task.id, {
      status: 'completed',
      finishedAt: Date.now(),
      output: (task.output || '') + '\n\n✅ 승인 완료 — 실행됨.',
    });
  } else {
    queue.updateTask(task.id, {
      status: 'rejected',
      finishedAt: Date.now(),
      output: (task.output || '') + '\n\n🚫 거절됨.',
    });
  }
  queue.setAgentStatus(task.agent, 'idle');
}

// ---------- Public ----------
export async function start({ seedCount = 8, spawnIntervalMs = 12000 } = {}) {
  await loadAgents();
  queue.subscribe(handleApprovalResolution);

  // Seed a backlog so the office looks busy from t=0
  for (let i = 0; i < seedCount; i++) {
    const agent = pickRandomAgent();
    if (!agent) break;
    const seed = randomTaskFor(agent.name);
    const task = queue.createTask({ agent: agent.name, title: seed.title, kind: seed.kind });
    // Stagger execution so they don't all fire at once
    setTimeout(() => executeTask(task.id), (i + 1) * 1500);
  }

  // Periodic spawn
  setInterval(() => {
    const agent = pickRandomAgent();
    if (!agent) return;
    if (queue.getSnapshot().agentStatus[agent.name] !== 'idle') return;
    const seed = randomTaskFor(agent.name);
    const task = queue.createTask({ agent: agent.name, title: seed.title, kind: seed.kind });
    executeTask(task.id);
  }, spawnIntervalMs);
}

export function triggerManualTask({ agent, title, kind = 'draft' }) {
  const task = queue.createTask({ agent, title, kind });
  executeTask(task.id);
  return task;
}

// ---------- Utils ----------
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
