// Автоматически определяем API: локальный для разработки, удаленный для продакшена
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '/api'
  : 'https://tasktrackr-kg3v.onrender.com/api';
const TASKS_API = `${API_BASE}/tasks`;
const AUTH_API = `${API_BASE}/auth`;
const TOKEN_KEY = 'tasktrackr_token';

const authState = {
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
};

// отображение статусов по-русски
function getStatusLabel(status) {
  switch (status) {
    case 'todo':
      return 'Запланировано';
    case 'in-progress':
      return 'В работе';
    case 'done':
      return 'Готово';
    default:
      return 'Неизвестно';
  }
}

// отображение категорий по-русски
function getCategoryLabel(category) {
  switch (category) {
    case 'study':
      return 'Учебная';
    case 'work':
      return 'Рабочая';
    case 'practice':
      return 'Практика';
    case 'personal':
      return 'Личная';
    default:
      return 'Не указана';
  }
}

// 3.1 Приветствие по времени суток
function setGreeting() {
  const el = document.getElementById('greeting');
  if (!el) return;
  const hour = new Date().getHours();
  let text = 'Доброе время суток!';
  if (hour < 12) text = 'Доброе утро!';
  else if (hour < 18) text = 'Добрый день!';
  else text = 'Добрый вечер!';
  el.textContent = text;
}

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString();
}

function createEmptyStats() {
  return {
    total: 0,
    byStatus: {
      todo: 0,
      'in-progress': 0,
      done: 0,
    },
    withoutDue: 0,
    categories: {
      study: { total: 0, todo: 0, 'in-progress': 0, done: 0 },
      project: { total: 0, todo: 0, 'in-progress': 0, done: 0 },
    },
  };
}

function setToken(token) {
  authState.token = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function jsonRequest(url, options = {}, extra = {}) {
  const config = { ...options };
  config.headers = { ...(options.headers || {}) };
  const needsBodyHeader =
    config.body && !config.headers['Content-Type'] && !(config.body instanceof FormData);
  if (needsBodyHeader) {
    config.headers['Content-Type'] = 'application/json';
  }

  const shouldAuth = extra.auth !== false;
  if (shouldAuth) {
    if (!authState.token) throw new Error('Требуется авторизация');
    config.headers.Authorization = `Bearer ${authState.token}`;
  }

  const response = await fetch(url, config);
  let data = {};
  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }

  if (response.status === 401 && shouldAuth) {
    handleUnauthorized();
  }

  if (!response.ok) {
    let errorMessage = data.error || 'Ошибка запроса';
    if (response.status === 404) {
      if (url.includes('tasktrackr-kg3v.onrender.com')) {
        errorMessage = 'Сервер недоступен. Проверьте, что сервис на Render запущен и доступен.';
      } else {
        errorMessage = 'Эндпоинт не найден. Проверьте правильность URL.';
      }
    }
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  return data;
}

function handleUnauthorized() {
  setToken(null);
  authState.user = null;
  updateAuthUI();
}

function resetTasksUI() {
  const tbody = document.getElementById('tasks-body');
  if (tbody) {
    tbody.innerHTML = '';
  }
  updateStatsDom(createEmptyStats());
  alignActionsHeader();
}

function updateAuthUI() {
  const isAuthed = Boolean(authState.token && authState.user);
  const guardedSections = document.querySelectorAll('[data-auth-guard="required"]');
  guardedSections.forEach((section) => {
    if (section) section.hidden = !isAuthed;
  });

  const lockedBlocks = document.querySelectorAll('.auth-locked');
  lockedBlocks.forEach((section) => {
    if (section) section.hidden = isAuthed;
  });

  const authSection = document.getElementById('auth-section');
  if (authSection) {
    authSection.hidden = isAuthed;
  }

  const panel = document.getElementById('auth-panel');
  if (panel) {
    const title = document.getElementById('auth-panel-title');
    const subtitle = document.getElementById('auth-panel-subtitle');
    const loginLink = document.getElementById('auth-login-link');
    const logoutBtn = document.getElementById('auth-logout-btn');

    if (isAuthed) {
      if (title) title.textContent = authState.user.name;
      if (subtitle) subtitle.textContent = authState.user.email;
    } else {
      if (title) title.textContent = 'Гость';
      if (subtitle)
        subtitle.textContent = 'Войдите, чтобы увидеть задачи';
    }
    if (loginLink) {
      loginLink.hidden = isAuthed;
      loginLink.style.display = isAuthed ? 'none' : '';
    }
    if (logoutBtn) {
      logoutBtn.hidden = !isAuthed;
      logoutBtn.style.display = !isAuthed ? 'none' : '';
    }
  }

  if (!isAuthed) {
    resetTasksUI();
  }
}

async function restoreSession() {
  try {
    const data = await jsonRequest(`${AUTH_API}/me`);
    authState.user = data.user;
    updateAuthUI();
    await loadAndRender();
  } catch (err) {
    // already handled in jsonRequest
  }
}

function toggleFormLoading(form, isLoading) {
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = Boolean(isLoading);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorEl = document.getElementById('login-error');
  if (errorEl) errorEl.hidden = true;
  toggleFormLoading(form, true);

  try {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    if (payload.email) payload.email = payload.email.trim();
    const data = await jsonRequest(
      `${AUTH_API}/login`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { auth: false }
    );
    setToken(data.token);
    authState.user = data.user;
    form.reset();
    updateAuthUI();
    await loadAndRender();
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Ошибка входа';
      errorEl.hidden = false;
    }
  } finally {
    toggleFormLoading(form, false);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorEl = document.getElementById('register-error');
  if (errorEl) errorEl.hidden = true;
  toggleFormLoading(form, true);

  try {
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    if (payload.email) payload.email = payload.email.trim();
    const data = await jsonRequest(
      `${AUTH_API}/register`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { auth: false }
    );
    setToken(data.token);
    authState.user = data.user;
    form.reset();
    updateAuthUI();
    await loadAndRender();
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || 'Ошибка регистрации';
      errorEl.hidden = false;
    }
  } finally {
    toggleFormLoading(form, false);
  }
}

function handleLogout() {
  setToken(null);
  authState.user = null;
  updateAuthUI();
}

function initAuth() {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
  const logoutBtn = document.getElementById('auth-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  updateAuthUI();
  if (authState.token) {
    restoreSession();
  }
}

// ====== Модальное окно задачи ======

function openTaskModal(task) {
  const overlay = document.getElementById('task-modal-overlay');
  if (!overlay) return;

  const titleEl = document.getElementById('modal-title');
  const categoryEl = document.getElementById('modal-category');
  const statusEl = document.getElementById('modal-status');
  const dueEl = document.getElementById('modal-due');
  const descEl = document.getElementById('modal-description');
  const jsonEl = document.getElementById('modal-json');
  const xmlEl = document.getElementById('modal-xml');

  titleEl.textContent = task.title || 'Без названия';
  categoryEl.textContent = getCategoryLabel(task.category);
  statusEl.textContent = getStatusLabel(task.status);
  dueEl.textContent = formatDate(task.dueDate);
  descEl.textContent = task.description || '—';

  const compactTask = {
    id: task._id,
    title: task.title,
    description: task.description,
    status: task.status,
    category: task.category,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
  jsonEl.textContent = JSON.stringify(compactTask, null, 2);

  const xml =
    '<task>' +
    `<id>${task._id}</id>` +
    `<title>${task.title}</title>` +
    `<status>${task.status}</status>` +
    `<category>${task.category || ''}</category>` +
    `<dueDate>${task.dueDate || ''}</dueDate>` +
    '</task>';
  xmlEl.textContent = xml;

  // Ensure modal has action buttons (useful for mobile where table buttons are hidden)
  const modal = overlay.querySelector('.modal');
  if (modal) {
    let actionsContainer = modal.querySelector('#modal-actions');
    if (!actionsContainer) {
      actionsContainer = document.createElement('div');
      actionsContainer.id = 'modal-actions';
      actionsContainer.style.marginTop = '0.8rem';
      actionsContainer.style.display = 'flex';
      actionsContainer.style.gap = '0.5rem';
      actionsContainer.style.justifyContent = 'flex-end';
      modal.appendChild(actionsContainer);
    }

    // Clear previous buttons
    actionsContainer.innerHTML = '';

    const btnDoneModal = document.createElement('button');
    btnDoneModal.textContent = 'Готово';
    btnDoneModal.className = '';
    btnDoneModal.addEventListener('click', (e) => {
      e.stopPropagation();
      updateTask(task._id, { status: 'done' });
      closeTaskModal();
    });

    const btnDeleteModal = document.createElement('button');
    btnDeleteModal.textContent = 'Удалить';
    btnDeleteModal.className = 'secondary';
    btnDeleteModal.addEventListener('click', (e) => {
      e.stopPropagation();
      // simple confirmation
      if (confirm('Вы уверены, что хотите удалить эту задачу?')) {
        deleteTask(task._id);
        closeTaskModal();
      }
    });

    actionsContainer.append(btnDoneModal, btnDeleteModal);
  }

  overlay.classList.add('visible');
}

function closeTaskModal() {
  const overlay = document.getElementById('task-modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('visible');
}

// 3.2 Скрытие/показ списка задач
// initToggleTasks removed — toggle button no longer present

// Mobile nav toggle
function initMobileNav() {
  const toggle = document.querySelector('.mobile-nav-toggle');
  const headerInner = document.querySelector('.header-inner');
  const nav = document.getElementById('site-nav');
  if (!toggle || !headerInner) return;

  toggle.addEventListener('click', () => {
    const isOpen = headerInner.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // close nav when viewport becomes large again
  const mq = window.matchMedia('(min-width: 641px)');
  const mqHandler = (e) => {
    if (e.matches) {
      headerInner.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  };
  try {
    mq.addEventListener('change', mqHandler);
  } catch (err) {
    // fallback for older browsers
    mq.addListener(mqHandler);
  }

  // close nav when a link is clicked (good for single-page navigation)
  if (nav) {
    nav.querySelectorAll('.nav-link').forEach((a) =>
      a.addEventListener('click', () => {
        headerInner.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      })
    );
  }
}

// 4.2 Динамическое создание HTML элементов
function renderTasks(tasks) {
  const tbody = document.getElementById('tasks-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  tasks.forEach((task) => {
    const tr = document.createElement('tr');

  const tdTitle = document.createElement('td');
  tdTitle.setAttribute('data-label', 'Название');
  const spanTitle = document.createElement('span');
  spanTitle.className = 'td-value';
  spanTitle.textContent = task.title || '';
  tdTitle.appendChild(spanTitle);

  const tdCategory = document.createElement('td');
  tdCategory.setAttribute('data-label', 'Категория');
  const spanCat = document.createElement('span');
  spanCat.className = 'td-value';
  spanCat.textContent = getCategoryLabel(task.category);
  tdCategory.appendChild(spanCat);

  const tdStatus = document.createElement('td');
  tdStatus.setAttribute('data-label', 'Статус');
  const spanStatus = document.createElement('span');
  spanStatus.className = 'td-value';
  spanStatus.textContent = getStatusLabel(task.status);
  tdStatus.appendChild(spanStatus);

    const tdDue = document.createElement('td');
    tdDue.setAttribute('data-label', 'Дедлайн');
    const spanDue = document.createElement('span');
    spanDue.className = 'td-value';
    spanDue.textContent = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString()
      : '—';
    tdDue.appendChild(spanDue);

  const tdActions = document.createElement('td');
  tdActions.classList.add('action-col');
  tdActions.setAttribute('data-label', 'Действия');
    const btnDone = document.createElement('button');
    btnDone.textContent = 'Готово';
    btnDone.addEventListener('click', (e) => {
      e.stopPropagation();
      updateTask(task._id, { status: 'done' });
    });

    const btnDelete = document.createElement('button');
    btnDelete.textContent = 'Удалить';
    btnDelete.classList.add('secondary');
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(task._id);
    });

  // wrap action buttons so we can measure the group and align the header above it
  const btnGroup = document.createElement('div');
  btnGroup.className = 'action-buttons';
  btnGroup.append(btnDone, btnDelete);
  tdActions.append(btnGroup);
    tr.append(tdTitle, tdCategory, tdStatus, tdDue, tdActions);

    tr.addEventListener('click', () => openTaskModal(task));

    tbody.appendChild(tr);
  });

  if (!tasks.length) {
    const tr = document.createElement('tr');
    tr.classList.add('empty-row');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.textContent = 'Задачи не найдены';
    td.style.textAlign = 'center';
    td.style.padding = '1.2rem 0';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
}

// ====== Блок статистики для stats.html ======

function computeStats(tasks) {
  const collection = Array.isArray(tasks) ? tasks : [];
  const stats = createEmptyStats();
  stats.total = collection.length;

  collection.forEach((task) => {
    const status = task.status || 'todo';
    const cat = task.category || 'study';

    if (stats.byStatus[status] !== undefined) {
      stats.byStatus[status] += 1;
    }

    if (!task.dueDate) {
      stats.withoutDue += 1;
    }

    // условно считаем: study -> "Учёба", остальные -> "Проекты"
    const bucket =
      cat === 'study' ? stats.categories.study : stats.categories.project;

    bucket.total += 1;
    if (bucket[status] !== undefined) {
      bucket[status] += 1;
    }
  });

  return stats;
}

function updateStatsDom(stats) {
  if (!stats) return;
  const totalEl = document.getElementById('stat-total');
  const inProgressEl = document.getElementById('stat-in-progress');
  const doneEl = document.getElementById('stat-done');
  const withoutDueEl = document.getElementById('stat-without-due');

  if (totalEl) totalEl.textContent = stats.total;
  if (inProgressEl) inProgressEl.textContent = stats.byStatus['in-progress'];
  if (doneEl) doneEl.textContent = stats.byStatus.done;
  if (withoutDueEl) withoutDueEl.textContent = stats.withoutDue;

  const study = stats.categories.study;
  const studyTotal = document.getElementById('cat-study-total');
  const studyTodo = document.getElementById('cat-study-todo');
  const studyInProgress = document.getElementById('cat-study-in-progress');
  const studyDone = document.getElementById('cat-study-done');

  if (studyTotal) studyTotal.textContent = study.total;
  if (studyTodo) studyTodo.textContent = study.todo;
  if (studyInProgress) studyInProgress.textContent = study['in-progress'];
  if (studyDone) studyDone.textContent = study.done;

  const proj = stats.categories.project;
  const projTotal = document.getElementById('cat-project-total');
  const projTodo = document.getElementById('cat-project-todo');
  const projInProgress = document.getElementById('cat-project-in-progress');
  const projDone = document.getElementById('cat-project-done');

  if (projTotal) projTotal.textContent = proj.total;
  if (projTodo) projTodo.textContent = proj.todo;
  if (projInProgress) projInProgress.textContent = proj['in-progress'];
  if (projDone) projDone.textContent = proj.done;
}

// 5.1/5.2 async/await + REST API

async function fetchTasks() {
  return jsonRequest(TASKS_API);
}

async function createTask(data) {
  return jsonRequest(TASKS_API, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function updateTask(id, data) {
  await jsonRequest(`${TASKS_API}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  await loadAndRender();
}

async function deleteTask(id) {
  await jsonRequest(`${TASKS_API}/${id}`, { method: 'DELETE' });
  await loadAndRender();
}

async function loadAndRender() {
  if (!authState.token || !authState.user) {
    resetTasksUI();
    return;
  }
  try {
    const tasks = await fetchTasks();
    renderTasks(tasks);
    const stats = computeStats(tasks);
    updateStatsDom(stats);
    // align the header above the action button group after tasks render
    alignActionsHeader();
  } catch (e) {
    console.error(e);
  }
}

// Align the 'Действия' header text above the actual action button group.
// This measures the first row's button-group center and shifts the header text by that offset.
function alignActionsHeader() {
  const th = document.querySelector('th.actions-header');
  if (!th) return;
  const headerText = th.querySelector('.actions-header-text') || th;

  // find the first visible button group in the table body
  const firstGroup = document.querySelector('#tasks-body tr td.action-col .action-buttons');
  if (!firstGroup) {
    // no rows: reset any transform
    headerText.style.transform = '';
    return;
  }

  const thRect = th.getBoundingClientRect();
  const gRect = firstGroup.getBoundingClientRect();

  const thCenter = thRect.left + thRect.width / 2;
  const groupCenter = gRect.left + gRect.width / 2;

  const offset = Math.round(groupCenter - thCenter);
  // apply transform to the inner text element
  headerText.style.transform = `translateX(${offset}px)`;
}

// Recompute when the window resizes (debounced)
let _alignTimeout = null;
window.addEventListener('resize', () => {
  clearTimeout(_alignTimeout);
  _alignTimeout = setTimeout(() => alignActionsHeader(), 120);
});

// 3.5 Клиентская валидация формы
function initForm() {
  const form = document.getElementById('task-form');
  const errorEl = document.getElementById('form-error');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('title-input');
    if (!titleInput.value || titleInput.value.length < 3) {
      errorEl.textContent = 'Название должно быть не короче 3 символов';
      errorEl.hidden = false;
      return;
    }
    errorEl.hidden = true;

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    if (!data.dueDate) {
      delete data.dueDate;
    }
    try {
      await createTask(data);
      form.reset();
      await loadAndRender();
    } catch (err) {
      errorEl.textContent = 'Ошибка сохранения задачи';
      errorEl.hidden = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setGreeting();
  initForm();
  initMobileNav();
  initAuth();

  const overlay = document.getElementById('task-modal-overlay');
  const closeBtn = document.getElementById('task-modal-close');

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeTaskModal();
      }
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', closeTaskModal);
  }

});
