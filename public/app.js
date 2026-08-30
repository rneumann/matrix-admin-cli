const state = {
  tree: { topLevelIds: [], nodes: {} },
  selectedId: null,
  expandedIds: new Set(),
};

const el = {
  loginView: document.getElementById('login-view'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  appView: document.getElementById('app-view'),
  currentUser: document.getElementById('current-user'),
  logoutBtn: document.getElementById('logout-btn'),
  treeRoot: document.getElementById('tree-root'),
  contextLabel: document.getElementById('context-label'),
  detailPanel: document.getElementById('detail-panel'),
  newSpaceBtn: document.getElementById('new-space-btn'),
  newRoomBtn: document.getElementById('new-room-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
  modalOverlay: document.getElementById('modal-overlay'),
  modal: document.getElementById('modal'),
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function loadingHtml(text) {
  return `<div class="loading"><span class="spinner"></span>${text}</div>`;
}

function setButtonBusy(button, busy, busyText) {
  if (!button) return;
  if (busy) {
    if (button.dataset.originalHtml === undefined) {
      button.dataset.originalHtml = button.innerHTML;
    }
    const light = button.classList.contains('primary-btn') || button.closest('.login-form');
    const spinnerClass = light ? 'spinner spinner-inline-light' : 'spinner spinner-inline';
    button.innerHTML = `<span class="${spinnerClass}"></span>${busyText || 'Bitte warten…'}`;
    button.disabled = true;
  } else {
    button.innerHTML = button.dataset.originalHtml ?? button.innerHTML;
    delete button.dataset.originalHtml;
    button.disabled = false;
  }
}

function setToolbarBusy(busy) {
  el.newSpaceBtn.disabled = busy;
  el.newRoomBtn.disabled = busy;
  el.refreshBtn.disabled = busy;
}

function showApp(userId) {
  el.currentUser.textContent = userId;
  el.loginView.classList.add('hidden');
  el.appView.classList.remove('hidden');
}

function showLogin() {
  el.appView.classList.add('hidden');
  el.loginView.classList.remove('hidden');
}

async function checkSession() {
  try {
    const { userId } = await api('/api/me');
    showApp(userId);
    await loadTree();
  } catch {
    showLogin();
  }
}

el.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.loginError.textContent = '';
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const submitBtn = el.loginForm.querySelector('button[type="submit"]');

  setButtonBusy(submitBtn, true, 'Anmelden…');
  try {
    const { userId } = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    document.getElementById('login-password').value = '';
    showApp(userId);
    await loadTree();
  } catch (err) {
    el.loginError.textContent = err.message;
  } finally {
    setButtonBusy(submitBtn, false);
  }
});

el.logoutBtn.addEventListener('click', async () => {
  setButtonBusy(el.logoutBtn, true, 'Abmelden…');
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  state.selectedId = null;
  showLogin();
  setButtonBusy(el.logoutBtn, false);
});

el.refreshBtn.addEventListener('click', () => loadTree());
el.newSpaceBtn.addEventListener('click', () => openCreateModal(true));
el.newRoomBtn.addEventListener('click', () => openCreateModal(false));

async function loadTree() {
  setToolbarBusy(true);
  el.treeRoot.innerHTML = loadingHtml('Lade Spaces/Räume…');

  try {
    state.tree = await api('/api/tree');
    if (state.selectedId && !state.tree.nodes[state.selectedId]) {
      state.selectedId = null;
    }
    renderTree();
    updateContextLabel();
    if (state.selectedId) {
      loadDetail(state.selectedId);
    }
  } catch (err) {
    el.treeRoot.innerHTML = `<p class="error">Fehler beim Laden: ${err.message}</p>`;
  } finally {
    setToolbarBusy(false);
  }
}

function nodeLabel(node) {
  if (!node) return '(unbekannt)';
  if (node.unresolved) return `${node.room_id} (nicht auflösbar)`;
  return node.name || node.canonical_alias || node.room_id;
}

function badgeFor(node) {
  if (node.unresolved) return { cls: 'unresolved', text: '?' };
  return node.room_type === 'm.space' ? { cls: 'space', text: 'Space' } : { cls: 'room', text: 'Raum' };
}

function buildNodeEl(nodeId) {
  const node = state.tree.nodes[nodeId];
  const li = document.createElement('li');

  const row = document.createElement('div');
  row.className = 'node' + (state.selectedId === nodeId ? ' selected' : '');
  row.dataset.id = nodeId;

  const hasChildren = Boolean(node.children && node.children.length > 0);
  const expanded = state.expandedIds.has(nodeId);

  const toggle = document.createElement('span');
  toggle.className = 'toggle' + (hasChildren ? '' : ' toggle-empty');
  if (hasChildren) {
    toggle.textContent = expanded ? '▾' : '▸';
    toggle.title = expanded ? 'Einklappen' : 'Aufklappen';
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.expandedIds.has(nodeId)) {
        state.expandedIds.delete(nodeId);
      } else {
        state.expandedIds.add(nodeId);
      }
      renderTree();
    });
  }

  const badge = badgeFor(node);
  const badgeEl = document.createElement('span');
  badgeEl.className = `badge ${badge.cls}`;
  badgeEl.textContent = badge.text;

  const nameEl = document.createElement('span');
  nameEl.className = 'name';
  nameEl.textContent = nodeLabel(node);
  nameEl.title = nodeId;

  row.append(toggle, badgeEl, nameEl);
  row.addEventListener('click', () => selectNode(nodeId));
  li.appendChild(row);

  if (hasChildren && expanded) {
    const ul = document.createElement('ul');
    for (const childId of node.children) {
      ul.appendChild(buildNodeEl(childId));
    }
    li.appendChild(ul);
  }

  return li;
}

function renderTree() {
  el.treeRoot.innerHTML = '';
  const ul = document.createElement('ul');
  for (const id of state.tree.topLevelIds) {
    ul.appendChild(buildNodeEl(id));
  }
  el.treeRoot.appendChild(ul);

  if (state.tree.topLevelIds.length === 0) {
    el.treeRoot.innerHTML = '<p class="hint">Keine Raeume/Spaces gefunden.</p>';
  }
}

function updateContextLabel() {
  const node = state.selectedId ? state.tree.nodes[state.selectedId] : null;
  if (node && node.room_type === 'm.space') {
    el.contextLabel.textContent = nodeLabel(node);
  } else {
    el.contextLabel.textContent = 'Wurzel';
  }
}

function selectNode(nodeId) {
  state.selectedId = nodeId;
  renderTree();
  updateContextLabel();
  loadDetail(nodeId);
}

function currentParentContext() {
  const node = state.selectedId ? state.tree.nodes[state.selectedId] : null;
  return node && node.room_type === 'm.space' && !node.unresolved ? state.selectedId : null;
}

async function loadDetail(nodeId) {
  const node = state.tree.nodes[nodeId];
  if (!node) return;

  el.detailPanel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'detail-header';
  const h2 = document.createElement('h2');
  h2.textContent = nodeLabel(node);
  header.appendChild(h2);
  el.detailPanel.appendChild(header);

  const meta = document.createElement('div');
  meta.className = 'detail-meta';
  meta.textContent = `${node.room_id}${node.canonical_alias ? ' · ' + node.canonical_alias : ''}`;
  el.detailPanel.appendChild(meta);

  if (node.unresolved) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Dieser Raum ist auf diesem Server nicht auflösbar (z.B. fremder Homeserver).';
    el.detailPanel.appendChild(hint);
    return;
  }

  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  const moveBtn = document.createElement('button');
  moveBtn.textContent = 'Verschieben…';
  moveBtn.addEventListener('click', () => openMoveModal(nodeId));
  actions.appendChild(moveBtn);
  el.detailPanel.appendChild(actions);

  const membersSection = document.createElement('div');
  membersSection.innerHTML = loadingHtml('Lade Mitglieder…');
  el.detailPanel.appendChild(membersSection);

  try {
    const { groups } = await api(`/api/rooms/${encodeURIComponent(nodeId)}/members`);
    membersSection.innerHTML = '';

    if (groups.length === 0) {
      membersSection.innerHTML = '<p class="hint">Keine Mitglieder.</p>';
      return;
    }

    for (const group of groups) {
      const wrap = document.createElement('div');
      wrap.className = 'power-group';
      const h3 = document.createElement('h3');
      h3.textContent = `Power-Level ${group.level} (${group.userIds.length})`;
      wrap.appendChild(h3);
      const ul = document.createElement('ul');
      for (const userId of group.userIds) {
        const li = document.createElement('li');
        li.textContent = userId;
        ul.appendChild(li);
      }
      wrap.appendChild(ul);
      membersSection.appendChild(wrap);
    }
  } catch (err) {
    membersSection.innerHTML = `<p class="error">Fehler beim Laden der Mitglieder: ${err.message}</p>`;
  }
}

let modalBusy = false;

function closeModal() {
  el.modalOverlay.classList.add('hidden');
  el.modal.innerHTML = '';
  modalBusy = false;
}

el.modalOverlay.addEventListener('click', (e) => {
  if (e.target === el.modalOverlay && !modalBusy) closeModal();
});

function openModal(contentEl) {
  el.modal.innerHTML = '';
  el.modal.appendChild(contentEl);
  el.modalOverlay.classList.remove('hidden');
}

function openCreateModal(isSpace) {
  const parentId = currentParentContext();
  const parentNode = parentId ? state.tree.nodes[parentId] : null;

  const form = document.createElement('form');
  form.innerHTML = `
    <h2>${isSpace ? 'Neuen Space' : 'Neuen Raum'} anlegen</h2>
    <p class="hint">Wird angelegt in: <strong>${parentNode ? nodeLabel(parentNode) : 'Wurzel (Toplevel)'}</strong></p>
    <label>Name<input name="name" type="text" required autofocus /></label>
    <label>Topic (optional)<input name="topic" type="text" /></label>
    <p class="error" data-error></p>
    <div class="modal-actions">
      <button type="button" data-cancel>Abbrechen</button>
      <button type="submit" class="primary-btn">Anlegen</button>
    </div>
  `;

  const cancelBtn = form.querySelector('[data-cancel]');
  cancelBtn.addEventListener('click', () => {
    if (!modalBusy) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const topic = form.topic.value.trim();
    const errorEl = form.querySelector('[data-error]');
    const submitBtn = form.querySelector('button[type="submit"]');

    modalBusy = true;
    setButtonBusy(submitBtn, true, 'Lege an…');
    cancelBtn.disabled = true;
    try {
      await api('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ name, isSpace, topic, parentId }),
      });
      closeModal();
      await loadTree();
    } catch (err) {
      errorEl.textContent = err.message;
      setButtonBusy(submitBtn, false);
      cancelBtn.disabled = false;
      modalBusy = false;
    }
  });

  openModal(form);
}

function openMoveModal(nodeId) {
  const node = state.tree.nodes[nodeId];
  const spaceOptions = Object.values(state.tree.nodes).filter(
    (n) => n.room_type === 'm.space' && !n.unresolved && n.room_id !== nodeId
  );

  const form = document.createElement('form');
  const optionsHtml = spaceOptions
    .map((n) => `<option value="${n.room_id}">${nodeLabel(n)}</option>`)
    .join('');

  form.innerHTML = `
    <h2>Verschieben</h2>
    <p class="hint">${nodeLabel(node)}</p>
    <label>
      Ziel
      <select name="target">
        <option value="">Toplevel-Ebene (kein Space)</option>
        ${optionsHtml}
      </select>
    </label>
    <p class="error" data-error></p>
    <div class="modal-actions">
      <button type="button" data-cancel>Abbrechen</button>
      <button type="submit" class="primary-btn">Verschieben</button>
    </div>
  `;

  const cancelBtn = form.querySelector('[data-cancel]');
  cancelBtn.addEventListener('click', () => {
    if (!modalBusy) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const toSpaceId = form.target.value || null;
    const errorEl = form.querySelector('[data-error]');
    const submitBtn = form.querySelector('button[type="submit"]');

    modalBusy = true;
    setButtonBusy(submitBtn, true, 'Verschiebe…');
    cancelBtn.disabled = true;
    form.target.disabled = true;
    try {
      await api(`/api/rooms/${encodeURIComponent(nodeId)}/move`, {
        method: 'POST',
        body: JSON.stringify({ toSpaceId }),
      });
      closeModal();
      await loadTree();
    } catch (err) {
      errorEl.textContent = err.message;
      setButtonBusy(submitBtn, false);
      cancelBtn.disabled = false;
      form.target.disabled = false;
      modalBusy = false;
    }
  });

  openModal(form);
}

checkSession();
