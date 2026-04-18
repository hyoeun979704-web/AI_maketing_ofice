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
