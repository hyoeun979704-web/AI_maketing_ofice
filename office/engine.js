// Frontend engine: wires SSE → DOM. Owns local state mirror of the server.

import { buildRoom, setAgentStatus, showBubble, hideBubble } from './characters.js';

// ---------- State ----------
const state = {
  skills: null,
  agentsByName: new Map(),
  tasks: new Map(),
  approvals: new Map(),
  agentStatus: new Map(),
  activity: [],
  apiKeyPresent: false,
};

// ---------- Skills data (shared with build-data.mjs) ----------
export async function fetchSkills() {
  if (state.skills) return state.skills;
  const res = await fetch('/data/skills.json');
  const data = await res.json();
  state.skills = data;
  for (const s of data.skills) state.agentsByName.set(s.name, s);
  return data;
}

// ---------- SSE + REST ----------
async function bootstrap() {
  await fetchSkills();
  await buildRoom();

  const initial = await fetch('/api/state').then((r) => r.json());
  state.apiKeyPresent = initial.apiKeyPresent;
  updateApiStatusPill();

  applySnapshot(initial);
  renderAll();

  const sse = new EventSource('/api/stream');
  sse.addEventListener('snapshot', (ev) => applySnapshot(JSON.parse(ev.data)));
  sse.addEventListener('task.created', (ev) => onTaskEvent(JSON.parse(ev.data)));
  sse.addEventListener('task.updated', (ev) => onTaskEvent(JSON.parse(ev.data)));
  sse.addEventListener('approval.requested', (ev) => onApprovalEvent(JSON.parse(ev.data)));
  sse.addEventListener('approval.resolved', (ev) => onApprovalEvent(JSON.parse(ev.data)));
  sse.addEventListener('agent.status', (ev) => {
    const { agent, status } = JSON.parse(ev.data);
    state.agentStatus.set(agent, status);
    setAgentStatus(agent, status);
    renderKpis();
  });
  sse.onerror = () => console.warn('SSE connection error; browser will auto-retry.');
}

function applySnapshot(snap) {
  state.tasks.clear();
  state.approvals.clear();
  state.agentStatus.clear();
  for (const t of snap.tasks || []) state.tasks.set(t.id, t);
  for (const a of snap.approvals || []) state.approvals.set(a.id, a);
  for (const [k, v] of Object.entries(snap.agentStatus || {})) state.agentStatus.set(k, v);
  state.activity = snap.activity || [];
  for (const [name, status] of state.agentStatus.entries()) setAgentStatus(name, status);
}

function updateApiStatusPill() {
  const el = document.getElementById('api-status');
  if (state.apiKeyPresent) {
    el.textContent = '● LIVE — Claude API';
    el.classList.add('live');
  } else {
    el.textContent = '● 시뮬레이션 — API 키 없음';
    el.classList.add('sim');
  }
}

function onTaskEvent({ type, task }) {
  const prev = state.tasks.get(task.id);
  state.tasks.set(task.id, task);

  // Bubble on transitions
  if (type === 'task.updated' || type === 'task.created') {
    if (task.status === 'working' && prev?.status !== 'working') {
      showBubble(task.agent, task.title, null);
    }
    if (task.status === 'completed' && prev?.status !== 'completed') {
      showBubble(task.agent, '✅ 완료', 'done');
    }
    if (task.status === 'rejected' && prev?.status !== 'rejected') {
      showBubble(task.agent, '🚫 거절', 'alert');
    }
    if (task.status === 'failed') {
      showBubble(task.agent, '⚠️ 실행 실패', 'alert');
    }
  }
  pushActivity(task);
  renderAll();
}

function onApprovalEvent({ type, approval }) {
  if (approval.status === 'pending') {
    state.approvals.set(approval.id, approval);
    showBubble(approval.agent, '⚠️ 승인 필요', 'alert');
  } else {
    state.approvals.delete(approval.id);
    hideBubble(approval.agent);
  }
  renderAll();
}

function pushActivity(task) {
  const agent = state.agentsByName.get(task.agent);
  const emoji = agent?.emoji || '🧑‍💼';
  const label = agent?.displayName || task.agent;
  let verb = task.status;
  if (task.status === 'working') verb = '시작';
  if (task.status === 'completed') verb = '완료';
  if (task.status === 'awaiting_approval') verb = '승인 대기';
  if (task.status === 'rejected') verb = '거절';
  if (task.status === 'failed') verb = '실패';
  state.activity.unshift({
    emoji,
    text: `${label} — "${task.title}" ${verb}`,
    timestamp: Date.now(),
  });
  if (state.activity.length > 60) state.activity.length = 60;
}

// ---------- Render ----------
function renderAll() {
  renderKpis();
  renderApprovals();
  renderTasks();
  renderActivity();
}

function renderKpis() {
  const statuses = [...state.agentStatus.values()];
  document.getElementById('kpi-total').textContent = state.agentsByName.size || statuses.length;
  document.getElementById('kpi-working').textContent = statuses.filter((s) => s === 'working').length;
  document.getElementById('kpi-idle').textContent = statuses.filter((s) => s === 'idle').length;
  document.getElementById('kpi-awaiting').textContent = state.approvals.size;
}

function renderApprovals() {
  const el = document.getElementById('approval-list');
  document.getElementById('approval-count').textContent = state.approvals.size;
  if (state.approvals.size === 0) {
    el.innerHTML = '<li class="empty">대기 중인 승인이 없습니다.</li>';
    return;
  }
  el.innerHTML = '';
  for (const approval of state.approvals.values()) {
    const agent = state.agentsByName.get(approval.agent);
    const card = document.createElement('li');
    card.className = 'approval-card';
    card.innerHTML = `
      <p class="approval-card__title">${escape(approval.title)}</p>
      <div class="approval-card__meta">
        <span>${agent?.emoji || '🧑‍💼'} ${escape(agent?.displayName || approval.agent)}</span>
      </div>
      <p class="approval-card__reason">⚠ ${escape(approval.reason)}</p>
    `;
    card.addEventListener('click', () => openApprovalModal(approval));
    el.appendChild(card);
  }
}

function renderTasks() {
  const el = document.getElementById('task-list');
  const live = [...state.tasks.values()]
    .filter((t) => t.status === 'working' || t.status === 'queued' || t.status === 'awaiting_approval')
    .slice(0, 15);
  document.getElementById('task-count').textContent = live.length;
  if (live.length === 0) {
    el.innerHTML = '<li class="empty">진행 중인 업무가 없습니다.</li>';
    return;
  }
  el.innerHTML = '';
  for (const t of live) {
    const agent = state.agentsByName.get(t.agent);
    const row = document.createElement('li');
    row.className = 'task-row';
    row.innerHTML = `
      <span class="task-row__emoji">${agent?.emoji || '🧑‍💼'}</span>
      <span class="task-row__title">
        ${escape(t.title)}
        <span class="task-row__agent">${escape(agent?.displayName || t.agent)}</span>
      </span>
      <span class="task-row__state ${t.status === 'awaiting_approval' ? 'awaiting' : t.status}">${renderStatus(t.status)}</span>
    `;
    el.appendChild(row);
  }
}

function renderActivity() {
  const el = document.getElementById('activity-list');
  if (state.activity.length === 0) {
    el.innerHTML = '<li class="empty">아직 활동 기록이 없습니다.</li>';
    return;
  }
  el.innerHTML = '';
  for (const a of state.activity.slice(0, 20)) {
    const row = document.createElement('li');
    row.className = 'activity-row';
    row.innerHTML = `<span class="activity-row__time">${fmtTime(a.timestamp)}</span><span class="activity-row__emoji">${a.emoji || ''}</span>${escape(a.text)}`;
    el.appendChild(row);
  }
}

function renderStatus(s) {
  return {
    queued: '대기',
    working: '업무중',
    awaiting_approval: '승인대기',
    completed: '완료',
    rejected: '거절',
    failed: '실패',
  }[s] || s;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function escape(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Approval modal ----------
const modal = document.getElementById('modal');
let currentApproval = null;

function openApprovalModal(approval) {
  currentApproval = approval;
  const agent = state.agentsByName.get(approval.agent);
  const task = state.tasks.get(approval.taskId);
  document.getElementById('modal-avatar').textContent = agent?.emoji || '🧑‍💼';
  document.getElementById('modal-title').textContent = approval.title;
  document.getElementById('modal-agent').textContent = `${agent?.displayName || approval.agent} · ${approval.agent}`;
  document.getElementById('modal-reason').textContent = approval.reason;
  document.getElementById('modal-action').textContent = approval.proposedAction;
  document.getElementById('modal-output').textContent = task?.output || '(작업 결과 없음)';
  modal.hidden = false;
}

function closeModal() {
  modal.hidden = true;
  currentApproval = null;
}

modal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) { closeModal(); return; }
  if (!e.target.closest('.modal__card')) closeModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

document.getElementById('btn-approve').addEventListener('click', async () => {
  if (!currentApproval) return;
  const id = currentApproval.id;
  await fetch(`/api/approvals/${id}`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({ decision: 'approve' }),
  });
  closeModal();
});
document.getElementById('btn-reject').addEventListener('click', async () => {
  if (!currentApproval) return;
  const id = currentApproval.id;
  await fetch(`/api/approvals/${id}`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({ decision: 'reject' }),
  });
  closeModal();
});

// ---------- Manual spawn ----------
document.getElementById('btn-spawn').addEventListener('click', async () => {
  const skills = [...state.agentsByName.values()];
  const agent = skills[Math.floor(Math.random() * skills.length)];
  if (!agent) return;
  await fetch('/api/tasks', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({ agent: agent.name, title: `수동 요청: ${agent.displayName}`, kind: 'draft' }),
  });
});

// ---------- Boot ----------
bootstrap().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend',
    `<div style="position:fixed;top:20px;right:20px;background:white;padding:20px;border:2px solid red;border-radius:8px;font-family:ui-monospace;max-width:420px">
      <strong style="color:red">오피스 서버에 연결할 수 없습니다</strong><br>
      <small>터미널에서 <code>node server/server.mjs</code>를 먼저 실행하세요.</small><br><br>
      <code style="font-size:11px">${err.message}</code>
    </div>`);
});
