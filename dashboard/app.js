// AI Marketing Office dashboard — vanilla JS, no build.
// Loads dashboard/data/skills.json and renders the tycoon view.

const DATA_URL = './data/skills.json';

const els = {
  office: document.getElementById('office'),
  search: document.getElementById('search'),
  filterBar: document.getElementById('filter-bar'),
  modal: document.getElementById('modal'),
  statTotal: document.getElementById('stat-total'),
  statKo: document.getElementById('stat-ko'),
  statDept: document.getElementById('stat-dept'),
  statDate: document.getElementById('stat-date'),
  modalAvatar: document.getElementById('modal-avatar'),
  modalTitle: document.getElementById('modal-title'),
  modalSubtitle: document.getElementById('modal-subtitle'),
  modalBadges: document.getElementById('modal-badges'),
  modalRole: document.getElementById('modal-role'),
  modalDescription: document.getElementById('modal-description'),
  modalPrompt: document.getElementById('modal-prompt'),
  modalFiles: document.getElementById('modal-files'),
  btnCopy: document.getElementById('btn-copy'),
  copyStatus: document.getElementById('copy-status'),
};

const state = {
  data: null,
  filter: 'all',
  query: '',
  selected: null,
};

// ---------- Load ----------
async function load() {
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`failed to load ${DATA_URL}: ${res.status}`);
  state.data = await res.json();
  renderAll();
}

// ---------- Render ----------
function renderAll() {
  renderStats();
  renderFilters();
  renderOffice();
}

function renderStats() {
  const { skills, departments } = state.data;
  els.statTotal.textContent = skills.length;
  els.statKo.textContent = skills.filter((s) => s.localized).length;
  els.statDept.textContent = Object.keys(departments).length;
  els.statDate.textContent = new Date().toLocaleDateString('ko-KR');
}

function renderFilters() {
  const { departments, skills } = state.data;
  const chips = [
    { id: 'all', label: '🏢 전체', count: skills.length, color: 'var(--accent)' },
  ];
  for (const [id, dept] of Object.entries(departments)) {
    chips.push({
      id,
      label: `${dept.icon} ${dept.label}`,
      count: dept.skills.length,
      color: dept.color,
    });
  }
  els.filterBar.innerHTML = '';
  for (const c of chips) {
    const chip = document.createElement('button');
    chip.className = 'filter-chip' + (state.filter === c.id ? ' active' : '');
    chip.style.setProperty('--dept-color', c.color);
    chip.dataset.id = c.id;
    chip.innerHTML = `${c.label}<span class="count">${c.count}</span>`;
    chip.addEventListener('click', () => {
      state.filter = c.id;
      renderFilters();
      renderOffice();
    });
    els.filterBar.appendChild(chip);
  }
}

function renderOffice() {
  const { departments, skills } = state.data;
  els.office.innerHTML = '';
  const query = state.query.trim().toLowerCase();

  for (const [deptId, dept] of Object.entries(departments)) {
    if (state.filter !== 'all' && state.filter !== deptId) continue;

    const deptSkills = skills.filter((s) => s.department === deptId);
    const visibleSkills = deptSkills.filter((s) => matchesQuery(s, query));
    if (visibleSkills.length === 0 && query) continue;

    const section = document.createElement('section');
    section.className = 'department';
    section.style.setProperty('--dept-color', dept.color);
    section.innerHTML = `
      <header class="department__header">
        <div class="department__icon" style="border-color: ${dept.color}">${dept.icon}</div>
        <div>
          <h2 class="department__title">${dept.label}</h2>
          <span class="department__sub">${visibleSkills.length}/${deptSkills.length}명 표시 중</span>
        </div>
      </header>
      <div class="desks" data-dept="${deptId}"></div>
    `;
    els.office.appendChild(section);
    const desks = section.querySelector('.desks');
    for (const s of visibleSkills) desks.appendChild(renderDesk(s, dept));
  }

  // Empty state
  if (!els.office.children.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:60px 20px;color:var(--text-muted);';
    empty.innerHTML = `🕵️  "${query}"에 해당하는 직원이 없습니다.`;
    els.office.appendChild(empty);
  }
}

function matchesQuery(skill, q) {
  if (!q) return true;
  const hay = [skill.name, skill.displayName, skill.description, skill.role].join(' ').toLowerCase();
  return hay.includes(q);
}

function renderDesk(skill, dept) {
  const desk = document.createElement('div');
  desk.className = 'desk';
  desk.style.setProperty('--dept-color', dept.color);
  desk.dataset.name = skill.name;
  desk.innerHTML = `
    ${skill.localized ? '<div class="desk__ko">KO</div>' : ''}
    <div class="desk__monitor"></div>
    <div class="desk__avatar">${skill.emoji}</div>
    <div class="desk__name">${skill.displayName}</div>
    <div class="desk__id">${skill.name}</div>
    <div class="desk__status">대기 중</div>
  `;
  desk.addEventListener('click', () => openModal(skill, dept));
  return desk;
}

// ---------- Modal ----------
function openModal(skill, dept) {
  state.selected = skill;
  els.modalAvatar.textContent = skill.emoji;
  els.modalTitle.textContent = skill.displayName;
  els.modalSubtitle.textContent = `${dept.icon} ${dept.label} · 스킬 ID: ${skill.name}`;

  els.modalBadges.innerHTML = '';
  addBadge(`v${skill.version}`, 'badge');
  if (skill.koVersion) addBadge(`ko ${skill.koVersion}`, 'badge badge--ko');
  if (skill.koOnly) addBadge('한국 전용', 'badge badge--ko');
  addBadge(dept.label, 'badge badge--dept');

  els.modalRole.textContent = skill.role || '—';
  els.modalDescription.textContent = skill.description || '—';
  els.modalPrompt.textContent = buildPrompt(skill);

  els.modalFiles.innerHTML = '';
  const files = [
    `skills/${skill.name}/SKILL.md`,
    ...(skill.koVersion && !skill.koOnly ? [`skills/${skill.name}/SKILL.en.md`] : []),
    `skills/${skill.name}/references/`,
    `skills/${skill.name}/evals/evals.json`,
  ];
  for (const f of files) {
    const li = document.createElement('li');
    li.innerHTML = `<code>${f}</code>`;
    els.modalFiles.appendChild(li);
  }

  els.copyStatus.classList.remove('visible');
  els.copyStatus.textContent = '';
  els.modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function addBadge(text, cls) {
  const b = document.createElement('span');
  b.className = cls;
  b.textContent = text;
  els.modalBadges.appendChild(b);
}

function closeModal() {
  els.modal.hidden = true;
  document.body.style.overflow = '';
  state.selected = null;
}

// Build a prompt template the user can paste into Claude Code to invoke the skill.
function buildPrompt(skill) {
  // Synthesize a first-person instruction using Korean triggers where possible.
  // Keep it short; the skill's own description handles routing.
  const koTriggers = extractKoTriggers(skill.description);
  const trigger = koTriggers[0] || skill.displayName;
  return `${trigger} 관련해서 도움이 필요해.\n\n컨텍스트:\n- 제품/프로젝트: [여기에 제품 설명]\n- 현재 상황: [현재 데이터·지표·문제]\n- 목표: [원하는 결과]\n\n${skill.name} 스킬을 사용해서 도와줘.`;
}

// Quick heuristic: pull Korean trigger phrases from the bilingual description.
// Most descriptions follow the pattern "... Also use when the user says '...', '...', ..."
function extractKoTriggers(desc) {
  if (!desc) return [];
  const matches = desc.match(/'[^']*[\uAC00-\uD7A3][^']*'/g) || [];
  return matches.map((m) => m.replace(/^'|'$/g, ''));
}

// ---------- Copy to clipboard ----------
els.btnCopy.addEventListener('click', async () => {
  const text = els.modalPrompt.textContent;
  try {
    await navigator.clipboard.writeText(text);
    els.copyStatus.textContent = '✓ 복사됨! Claude Code에 붙여넣으세요.';
    els.copyStatus.classList.add('visible');
    setTimeout(() => els.copyStatus.classList.remove('visible'), 2500);
  } catch {
    els.copyStatus.textContent = '복사 실패 — 수동 선택해 복사하세요.';
    els.copyStatus.classList.add('visible');
  }
});

// ---------- Events ----------
els.modal.addEventListener('click', (e) => {
  if (e.target.dataset.close !== undefined) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !els.modal.hidden) closeModal();
});

let searchTimer;
els.search.addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = e.target.value;
    renderOffice();
  }, 120);
});

// ---------- Boot ----------
load().catch((err) => {
  els.office.innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:var(--danger);">
      <h3>⚠️ 데이터 로드 실패</h3>
      <p>${err.message}</p>
      <p style="color:var(--text-muted);font-size:13px;">
        <code>file://</code> 프로토콜로 열면 CORS 차단이 발생할 수 있습니다.<br>
        이 경우 저장소 루트에서 다음을 실행하세요:<br>
        <code>python3 -m http.server 8000</code> 또는 <code>npx serve dashboard</code><br>
        그 후 <code>http://localhost:8000/dashboard/</code> 접속.
      </p>
    </div>
  `;
});
