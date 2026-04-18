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

  queue.updateTask(taskId, { status: 'working', startedAt: Date.now() });
  queue.setAgentStatus(task.agent, 'working');

  // Optional: throttle via workLatency so the UI shows animation even with fast API
  await sleep(workLatency());

  try {
    const output = await runTask(task);
    queue.updateTask(taskId, { output });

    const decision = decideAction(task.agent, task.kind);
    if (!decision.autonomous) {
      queue.requestApproval(taskId, decision.reason, task.title);
      // Wait for resolution (resolved by handleApprovalResolution below)
      return;
    }
    queue.updateTask(taskId, { status: 'completed', finishedAt: Date.now() });
    queue.setAgentStatus(task.agent, 'idle');
  } catch (err) {
    queue.updateTask(taskId, {
      status: 'failed',
      finishedAt: Date.now(),
      output: `⚠️ 실행 실패: ${err.message}`,
    });
    queue.setAgentStatus(task.agent, 'idle');
  }
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
