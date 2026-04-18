// Renders the isometric room + 38 agent characters grouped by department.
// Exposes a small API used by engine.js to apply status/bubble updates.

import { fetchSkills } from './engine.js';

const room = document.getElementById('room');
const bubblesLayer = document.getElementById('bubbles');
const legendEl = document.getElementById('legend');

// Map: skillName → agent DOM element
const agentNodes = new Map();
// Map: skillName → bubble DOM element (or null)
const bubbleNodes = new Map();

let roomBuilt = false;

export async function buildRoom() {
  if (roomBuilt) return;
  const { departments, skills } = await fetchSkills();

  room.innerHTML = '';
  legendEl.innerHTML = buildLegend(departments);

  // Layout: 4 columns × 2 rows = 8 zones, one per department.
  const deptOrder = ['cro', 'content', 'seo', 'paid', 'growth', 'sales', 'strategy', 'korea'];
  for (const deptId of deptOrder) {
    const dept = departments[deptId];
    if (!dept) continue;

    const zone = document.createElement('div');
    zone.className = 'dept-zone';
    zone.style.setProperty('--dept-color', dept.color);
    zone.innerHTML = `
      <div class="dept-zone__label">${dept.icon} ${dept.label}</div>
      <div class="dept-zone__desks" data-dept="${deptId}"></div>
    `;
    room.appendChild(zone);

    const desksEl = zone.querySelector('.dept-zone__desks');
    const zoneSkills = skills.filter((s) => s.department === deptId);
    for (const skill of zoneSkills) desksEl.appendChild(buildDeskSlot(skill, dept));
  }

  roomBuilt = true;
}

function buildDeskSlot(skill, dept) {
  const slot = document.createElement('div');
  slot.className = 'desk-slot';
  slot.dataset.name = skill.name;
  slot.setAttribute('role', 'button');
  slot.setAttribute('tabindex', '0');
  slot.setAttribute('aria-label', `${skill.displayName} 책상`);
  slot.style.setProperty('--dept-color', dept.color);

  slot.innerHTML = `
    <div class="desk-monitor"></div>
    <div class="desk-top"></div>
    <div class="agent idle" data-agent="${skill.name}">
      <div class="agent__body">
        <div class="agent__face">${skill.emoji}</div>
      </div>
      ${skill.localized ? '<div class="agent__badge">KO</div>' : ''}
    </div>
    <div class="agent-name">${shortName(skill.displayName)}</div>
  `;

  const agentEl = slot.querySelector('.agent');
  agentNodes.set(skill.name, agentEl);
  return slot;
}

function shortName(displayName) {
  // The nameplate is small; trim long names.
  if (displayName.length <= 10) return displayName;
  return displayName.slice(0, 9) + '…';
}

function buildLegend(departments) {
  const keys = [
    ['idle', '🟢 대기', '일감 없음'],
    ['working', '🔵 업무중', '능동 실행'],
    ['awaiting', '🟡 승인대기', '금전·업로드 등 중요 이벤트 보류'],
  ];
  return `
    <div><strong>🏢 AI Marketing Office</strong> — ${Object.keys(departments).length}개 부서 · 자율 실행</div>
    ${keys.map(([k, t, d]) => `<div><strong>${t}</strong> ${d}</div>`).join('')}
  `;
}

// ---------- Public API for engine.js ----------

export function setAgentStatus(skillName, status) {
  const el = agentNodes.get(skillName);
  if (!el) return;
  el.classList.remove('idle', 'working', 'awaiting');
  el.classList.add(status === 'awaiting' ? 'awaiting' : status === 'working' ? 'working' : 'idle');
}

export function showBubble(skillName, text, variant) {
  // Clear any existing bubble for this agent
  hideBubble(skillName);

  const agentEl = agentNodes.get(skillName);
  if (!agentEl) return;

  // Get the slot's bounding box (relative to bubbles layer)
  const slot = agentEl.closest('.desk-slot');
  const slotRect = slot.getBoundingClientRect();
  const layerRect = bubblesLayer.getBoundingClientRect();

  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (variant ? ' bubble--' + variant : '');
  bubble.textContent = text;
  bubble.style.left = (slotRect.left - layerRect.left + slotRect.width / 2 - 20) + 'px';
  bubble.style.top  = (slotRect.top - layerRect.top - 40) + 'px';
  bubblesLayer.appendChild(bubble);
  bubbleNodes.set(skillName, bubble);

  // Auto-hide draft bubbles after 4.5s; keep alert bubbles until cleared.
  if (variant !== 'alert') {
    setTimeout(() => {
      if (bubbleNodes.get(skillName) === bubble) hideBubble(skillName);
    }, 4500);
  }
}

export function hideBubble(skillName) {
  const b = bubbleNodes.get(skillName);
  if (b) b.remove();
  bubbleNodes.delete(skillName);
}

// Reposition bubbles on window resize so they stay glued to their agents
window.addEventListener('resize', () => {
  for (const [name, bubble] of bubbleNodes.entries()) {
    const text = bubble.textContent;
    const variant = bubble.classList.contains('bubble--alert') ? 'alert'
      : bubble.classList.contains('bubble--done') ? 'done' : null;
    showBubble(name, text, variant);
  }
});

// ---------- Liveness driver ----------
// Makes idle agents feel alive: random blinks, occasional glances, some
// agents gently sway. Only affects agents in `idle` state so we don't
// interfere with working/awaiting animations. Runs forever at small
// intervals; CPU impact negligible (tens of element-class toggles / sec).

const IDLE_THOUGHTS = [
  '☕ 커피 한 잔',
  '🤔 음... 어떻게 할까',
  '📚 자료 찾는 중',
  '💡 아이디어 떠올랐어!',
  '🧘 잠깐 스트레칭',
  '📨 알림 확인',
  '📊 지표 보는 중',
  '😊',
  '👀',
];

export function startLiveness() {
  // Random blink — one agent per tick
  setInterval(() => {
    const all = [...agentNodes.values()].filter((el) => el.classList.contains('idle'));
    if (all.length === 0) return;
    const pick = all[Math.floor(Math.random() * all.length)];
    pick.classList.add('blink');
    setTimeout(() => pick.classList.remove('blink'), 220);
  }, 900);

  // Random glance left/right on a different cadence
  setInterval(() => {
    const all = [...agentNodes.values()].filter((el) => el.classList.contains('idle'));
    if (all.length === 0) return;
    const pick = all[Math.floor(Math.random() * all.length)];
    const dir = Math.random() < 0.5 ? 'glance-left' : 'glance-right';
    pick.classList.add(dir);
    setTimeout(() => pick.classList.remove(dir), 700 + Math.random() * 600);
  }, 2000);

  // Occasional gentle sway (couple agents at a time, toggles every ~8s)
  setInterval(() => {
    // Remove old sway
    for (const el of agentNodes.values()) el.classList.remove('sway');
    // Pick 2-3 idle agents to sway for a while
    const all = [...agentNodes.values()].filter((el) => el.classList.contains('idle'));
    const k = Math.min(3, all.length);
    for (let i = 0; i < k; i++) {
      const pick = all[Math.floor(Math.random() * all.length)];
      pick.classList.add('sway');
    }
  }, 8000);

  // Idle thought bubbles — rare, only when the agent is idle and silent
  setInterval(() => {
    const all = [...agentNodes.entries()].filter(([name, el]) =>
      el.classList.contains('idle') && !bubbleNodes.has(name));
    if (all.length === 0) return;
    const [name] = all[Math.floor(Math.random() * all.length)];
    const thought = IDLE_THOUGHTS[Math.floor(Math.random() * IDLE_THOUGHTS.length)];
    showBubble(name, thought, 'idle-thought');
    // Auto-hide after 3.5s
    setTimeout(() => hideBubble(name), 3500);
  }, 6000);
}
