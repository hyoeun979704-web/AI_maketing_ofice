// Frontend engine: wires SSE → DOM. Owns local state mirror of the server.

import { buildRoom, setAgentStatus, showBubble, hideBubble, startLiveness } from './characters.js';

// ---------- State ----------
const state = {
  skills: null,
  agentsByName: new Map(),
  tasks: new Map(),
  approvals: new Map(),
  agentStatus: new Map(),
  activity: [],
  apiKeyPresent: false,
  company: null,
  companyReady: false,
  zoom: 1,
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
  state.company = initial.company;
  state.companyReady = initial.companyReady;
  updateApiStatusPill();
  renderCompanyCard();

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
  sse.addEventListener('meeting.started', (ev) => onMeetingStarted(JSON.parse(ev.data)));
  sse.addEventListener('meeting.ended', (ev) => onMeetingEnded(JSON.parse(ev.data)));
  sse.onerror = () => console.warn('SSE connection error; browser will auto-retry.');

  // Start idle NPC liveness loop
  startLiveness();

  // Wire desk clicks for agent detail modal
  wireDeskClicks();

  // Wire zoom + pan controls
  wireScene();

  // Wire company modal
  wireCompanyModal();

  // If no company registered yet, open the modal automatically
  if (!state.companyReady) setTimeout(() => openCompanyModal(), 500);
}

function renderCompanyCard() {
  const card = document.getElementById('company-card');
  const nameEl = document.getElementById('company-name');
  const urlEl = document.getElementById('company-url');
  if (state.companyReady && state.company) {
    card.classList.remove('unset');
    nameEl.textContent = state.company.name;
    urlEl.textContent = state.company.url;
    urlEl.title = state.company.description;
  } else {
    card.classList.add('unset');
    nameEl.textContent = '미등록';
    urlEl.textContent = '회사·URL을 등록하면 직원들이 실제로 일을 시작합니다.';
  }
}

// ---------- Scene zoom + pan ----------
function wireScene() {
  const scene = document.getElementById('scene');
  const room = document.getElementById('room');

  const apply = () => room.style.setProperty('--zoom', state.zoom);
  document.getElementById('ctrl-zoom-in').addEventListener('click', () => {
    state.zoom = Math.min(1.6, state.zoom + 0.15);
    apply();
  });
  document.getElementById('ctrl-zoom-out').addEventListener('click', () => {
    state.zoom = Math.max(0.5, state.zoom - 0.15);
    apply();
  });
  document.getElementById('ctrl-fit').addEventListener('click', () => {
    state.zoom = 1;
    apply();
    // also re-center
    scene.scrollTo({
      left: (scene.scrollWidth - scene.clientWidth) / 2,
      top: (scene.scrollHeight - scene.clientHeight) / 2,
      behavior: 'smooth',
    });
  });

  // Drag-to-pan
  let dragging = false;
  let startX = 0, startY = 0, scrollX = 0, scrollY = 0;
  scene.addEventListener('mousedown', (e) => {
    // Only start panning when clicking outside an interactive element
    if (e.target.closest('.desk-slot, .scene__ctrl, button, a, input, textarea')) return;
    dragging = true;
    scene.classList.add('dragging');
    startX = e.pageX; startY = e.pageY;
    scrollX = scene.scrollLeft; scrollY = scene.scrollTop;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    scene.scrollLeft = scrollX - (e.pageX - startX);
    scene.scrollTop  = scrollY - (e.pageY - startY);
  });
  document.addEventListener('mouseup', () => { dragging = false; scene.classList.remove('dragging'); });

  // Center the room initially
  setTimeout(() => {
    scene.scrollTo({
      left: (scene.scrollWidth - scene.clientWidth) / 2,
      top:  (scene.scrollHeight - scene.clientHeight) / 2,
    });
  }, 100);
}

// ---------- Company modal ----------
const companyModal = document.getElementById('company-modal');
function openCompanyModal() {
  const form = document.getElementById('company-form');
  const c = state.company || {};
  for (const field of form.elements) {
    if (field.name && field.name in c) field.value = c[field.name] || '';
  }
  companyModal.hidden = false;
  // Focus the first empty field
  setTimeout(() => {
    for (const field of form.elements) {
      if (field.name && !field.value) { field.focus(); break; }
    }
  }, 50);
}
function closeCompanyModal() { companyModal.hidden = true; }
function wireCompanyModal() {
  document.getElementById('btn-edit-company').addEventListener('click', openCompanyModal);
  companyModal.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]') || (!e.target.closest('.modal__card'))) closeCompanyModal();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !companyModal.hidden) closeCompanyModal(); });

  document.getElementById('company-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const res = await fetch('/api/company', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      alert('저장 실패: ' + (await res.text()));
      return;
    }
    state.company = await res.json();
    state.companyReady = Boolean(state.company.name && state.company.url && state.company.description);
    renderCompanyCard();
    closeCompanyModal();
  });
}

// ---------- Meetings ----------
function onMeetingStarted({ meeting }) {
  const { primary, collaborator, topic } = meeting;
  const primName = state.agentsByName.get(primary)?.displayName || primary;
  const colabName = state.agentsByName.get(collaborator)?.displayName || collaborator;
  showBubble(primary, `💬 ${colabName}와(과) 회의 중 — "${truncate(topic, 30)}"`, null);
  showBubble(collaborator, `💬 ${primName} 지원 중`, null);
  pushActivityText(`🤝 ${primName} × ${colabName} — 회의 시작: ${topic}`, '🤝');
  renderActivity();
}
function onMeetingEnded({ meeting }) {
  hideBubble(meeting.primary);
  hideBubble(meeting.collaborator);
  const primName = state.agentsByName.get(meeting.primary)?.displayName || meeting.primary;
  const colabName = state.agentsByName.get(meeting.collaborator)?.displayName || meeting.collaborator;
  pushActivityText(`🤝 ${primName} × ${colabName} — 회의 종료, 실행으로 전환`, '✅');
  renderActivity();
}

function pushActivityText(text, emoji) {
  state.activity.unshift({ text, emoji: emoji || '', timestamp: Date.now() });
  if (state.activity.length > 60) state.activity.length = 60;
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

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
  renderCompleted();
  renderActivity();
}

function renderCompleted() {
  const el = document.getElementById('completed-list');
  const done = [...state.tasks.values()]
    .filter((t) => t.status === 'completed' || t.status === 'rejected' || t.status === 'failed' || t.status === 'blocked')
    .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))
    .slice(0, 15);
  document.getElementById('completed-count').textContent = done.length;
  if (done.length === 0) {
    el.innerHTML = '<li class="empty">아직 완료된 업무가 없습니다.</li>';
    return;
  }
  el.innerHTML = '';
  for (const t of done) {
    const agent = state.agentsByName.get(t.agent);
    const row = document.createElement('li');
    row.className = 'task-row'
      + (t.status === 'failed' ? ' is-failed'
      : t.status === 'rejected' ? ' is-rejected'
      : t.status === 'blocked' ? ' is-blocked'
      : '');
    row.innerHTML = `
      <span class="task-row__emoji">${agent?.emoji || '🧑‍💼'}</span>
      <span class="task-row__title">
        ${escape(t.title)}
        <span class="task-row__agent">${escape(agent?.displayName || t.agent)}</span>
      </span>
      <span class="task-row__state ${t.status}">${renderStatus(t.status)}</span>
    `;
    row.addEventListener('click', () => openTaskModal(t));
    el.appendChild(row);
  }
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
    row.className = 'task-row'
      + (t.status === 'failed' ? ' is-failed'
      : t.status === 'rejected' ? ' is-rejected'
      : t.status === 'blocked' ? ' is-blocked'
      : '');
    row.innerHTML = `
      <span class="task-row__emoji">${agent?.emoji || '🧑‍💼'}</span>
      <span class="task-row__title">
        ${escape(t.title)}
        <span class="task-row__agent">${escape(agent?.displayName || t.agent)}</span>
      </span>
      <span class="task-row__state ${t.status === 'awaiting_approval' ? 'awaiting' : t.status}">${renderStatus(t.status)}</span>
    `;
    row.addEventListener('click', () => openTaskModal(t));
    el.appendChild(row);
  }
}

// ---------- Desk click → agent detail modal ----------
function wireDeskClicks() {
  document.getElementById('room').addEventListener('click', (e) => {
    const slot = e.target.closest('.desk-slot');
    if (!slot) return;
    const name = slot.dataset.name;
    const agent = state.agentsByName.get(name);
    if (!agent) return;
    openAgentModal(agent);
  });
  // Keyboard support
  document.getElementById('room').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const slot = e.target.closest('.desk-slot');
    if (!slot) return;
    e.preventDefault();
    const agent = state.agentsByName.get(slot.dataset.name);
    if (agent) openAgentModal(agent);
  });
}

// ---------- Agent detail modal ----------
const agentModal = document.getElementById('agent-modal');
function openAgentModal(agent) {
  const history = [...state.tasks.values()]
    .filter((t) => t.agent === agent.name)
    .sort((a, b) => (b.finishedAt || b.startedAt || b.createdAt) - (a.finishedAt || a.startedAt || a.createdAt));
  const status = state.agentStatus.get(agent.name) || 'idle';
  const statusLabels = { idle: '🟢 대기', working: '🔵 업무 중', awaiting: '🟡 승인 대기', meeting: '💬 회의 중' };

  document.getElementById('agent-modal-avatar').textContent = agent.emoji;
  document.getElementById('agent-modal-title').textContent = agent.displayName;
  document.getElementById('agent-modal-sub').textContent = `${agent.name} · v${agent.version}${agent.koVersion ? ' · ko ' + agent.koVersion : ''}`;

  const badges = document.getElementById('agent-modal-badges');
  badges.innerHTML = '';
  const deptLabel = state.skills?.departments?.[agent.department]?.label || agent.department;
  addBadgeTo(badges, deptLabel, 'badge');
  if (agent.koOnly) addBadgeTo(badges, '한국 전용', 'chip chip--alert');
  else if (agent.localized) addBadgeTo(badges, 'KO 번역', 'chip');

  document.getElementById('agent-modal-role').textContent = agent.role || '(역할 요약 없음)';
  document.getElementById('agent-modal-status').textContent = statusLabels[status] || status;
  document.getElementById('agent-modal-count').textContent = history.length;

  const list = document.getElementById('agent-modal-history');
  if (history.length === 0) {
    list.innerHTML = '<li class="empty">아직 수행한 업무가 없습니다.</li>';
  } else {
    list.innerHTML = '';
    for (const t of history.slice(0, 20)) {
      const item = document.createElement('li');
      item.className = 'task-history__item';
      const preview = (t.output || '(아직 결과 없음)').slice(0, 160);
      item.innerHTML = `
        <div class="task-history__top">
          <span class="task-history__title">${escape(t.title)}</span>
          <span class="task-history__state ${t.status === 'awaiting_approval' ? 'awaiting' : t.status}">${renderStatus(t.status)}</span>
        </div>
        <div class="task-history__preview">${escape(preview)}</div>
        <div class="task-history__meta">${fmtTime(t.finishedAt || t.startedAt || t.createdAt)}${t.mode ? ' · ' + t.mode : ''}</div>
      `;
      item.addEventListener('click', () => {
        closeAgentModal();
        openTaskModal(t);
      });
      list.appendChild(item);
    }
  }
  agentModal.hidden = false;
}
function closeAgentModal() { agentModal.hidden = true; }
agentModal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]') || !e.target.closest('.modal__card')) closeAgentModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !agentModal.hidden) closeAgentModal(); });

// ---------- Task detail modal (full prompt/response) ----------
const taskModal = document.getElementById('task-modal');
function openTaskModal(task) {
  const agent = state.agentsByName.get(task.agent);
  document.getElementById('task-modal-avatar').textContent = agent?.emoji || '🧑‍💼';
  document.getElementById('task-modal-title').textContent = task.title;
  document.getElementById('task-modal-sub').textContent = `${agent?.displayName || task.agent} · ${renderStatus(task.status)}`;
  const badges = document.getElementById('task-modal-badges');
  badges.innerHTML = '';
  addBadgeTo(badges, task.kind || 'draft', 'badge');
  if (task.mode === 'api') addBadgeTo(badges, 'Claude API', 'chip chip--alert');
  else if (task.mode === 'simulation') addBadgeTo(badges, '시뮬레이션', 'chip');
  else if (task.mode === 'blocked') addBadgeTo(badges, '회사 미등록', 'chip chip--alert');
  else if (task.mode === 'data-needed') addBadgeTo(badges, '데이터 연결 필요', 'chip chip--alert');
  else if (task.mode === 'fetch-failed') addBadgeTo(badges, 'URL 가져오기 실패', 'chip chip--alert');
  if (task.fetchedUrl) addBadgeTo(badges, '🌐 ' + truncate(task.fetchedUrl, 40), 'badge');

  // Error banner for failures
  const errBanner = document.getElementById('task-modal-error');
  if (task.status === 'failed' || task.status === 'blocked' || task.mode === 'fetch-failed' || task.mode === 'data-needed' || task.mode === 'blocked') {
    let title = '실행이 멈춘 이유';
    let detail = '';
    if (task.mode === 'blocked') { title = '회사 정보 미등록'; detail = '사이드바의 "회사 정보" 버튼에서 회사명·URL·설명을 등록한 뒤 다시 시도하세요.'; }
    else if (task.mode === 'data-needed') { title = '외부 데이터 연결 필요'; detail = (task.missingData || []).map((m) => '• ' + m).join('\n'); }
    else if (task.mode === 'fetch-failed') { title = 'URL 가져오기 실패'; detail = task.fetchError || ''; }
    else if (task.status === 'failed') { title = '실행 실패'; detail = (task.output || '').replace(/^⚠️ 실행 실패:\s*/, ''); }
    errBanner.hidden = false;
    errBanner.innerHTML = `<strong>${escape(title)}</strong>${escape(detail || '')}`;
  } else {
    errBanner.hidden = true;
    errBanner.innerHTML = '';
  }

  document.getElementById('task-modal-user-prompt').textContent = task.userPrompt || '(요청 정보 없음)';
  document.getElementById('task-modal-output').textContent = task.output || '(작업 중이거나 결과 없음)';
  document.getElementById('task-modal-system-prompt').textContent = task.systemPrompt || '(시스템 프롬프트 정보 없음 — 레거시 태스크거나 아직 시작 전)';

  taskModal.hidden = false;
}
function closeTaskModal() { taskModal.hidden = true; }
taskModal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]') || !e.target.closest('.modal__card')) closeTaskModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !taskModal.hidden) closeTaskModal(); });

function addBadgeTo(el, text, cls) {
  const b = document.createElement('span');
  b.className = cls;
  b.textContent = text;
  el.appendChild(b);
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
    blocked: '진행 불가',
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
