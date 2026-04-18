// In-memory task queue and event bus. No persistence — restart resets state.
// Every state change pushes an event through the bus so the SSE endpoint can
// stream it to connected browser clients.

import { randomUUID } from 'node:crypto';

/** @typedef {'queued'|'working'|'awaiting_approval'|'completed'|'rejected'|'failed'} TaskStatus */

const tasks = new Map();   // id → task
const approvals = new Map(); // id → approval record
const agentStatus = new Map(); // skillName → 'idle'|'working'|'awaiting'
const activity = [];       // recent events (ring buffer, max 200)

const subscribers = new Set(); // Set<(event) => void>

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function publish(event) {
  activity.unshift({ ...event, timestamp: Date.now() });
  if (activity.length > 200) activity.length = 200;
  for (const fn of subscribers) {
    try { fn(event); } catch (err) { console.error('subscriber failed', err); }
  }
}

export function getSnapshot() {
  return {
    tasks: Array.from(tasks.values()).sort((a, b) => b.createdAt - a.createdAt),
    approvals: Array.from(approvals.values()).filter((a) => a.status === 'pending'),
    agentStatus: Object.fromEntries(agentStatus),
    activity: activity.slice(0, 50),
  };
}

export function setAgentStatus(skillName, status) {
  const prev = agentStatus.get(skillName);
  if (prev === status) return;
  agentStatus.set(skillName, status);
  publish({ type: 'agent.status', agent: skillName, status });
}

export function createTask({ agent, title, kind = 'draft' }) {
  const id = randomUUID();
  const task = {
    id,
    agent,
    title,
    kind,
    status: /** @type {TaskStatus} */ ('queued'),
    output: null,
    createdAt: Date.now(),
    startedAt: null,
    finishedAt: null,
  };
  tasks.set(id, task);
  publish({ type: 'task.created', task });
  return task;
}

export function updateTask(id, patch) {
  const task = tasks.get(id);
  if (!task) return null;
  Object.assign(task, patch);
  publish({ type: 'task.updated', task });
  return task;
}

export function requestApproval(taskId, reason, proposedAction) {
  const task = tasks.get(taskId);
  if (!task) return null;
  const id = randomUUID();
  const approval = {
    id,
    taskId,
    agent: task.agent,
    title: task.title,
    reason,
    proposedAction,
    status: 'pending',
    createdAt: Date.now(),
  };
  approvals.set(id, approval);
  updateTask(taskId, { status: 'awaiting_approval', approvalId: id });
  setAgentStatus(task.agent, 'awaiting');
  publish({ type: 'approval.requested', approval });
  return approval;
}

export function resolveApproval(id, decision) {
  const approval = approvals.get(id);
  if (!approval || approval.status !== 'pending') return null;
  approval.status = decision; // 'approve' | 'reject'
  approval.resolvedAt = Date.now();
  publish({ type: 'approval.resolved', approval });
  return approval;
}

export function getTask(id) { return tasks.get(id); }
export function getApproval(id) { return approvals.get(id); }
