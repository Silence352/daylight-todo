/**
 * Daylight To-Do v2 · Daily Dashboard
 * CRUD, projects, priorities, due dates, estimates, focus tasks,
 * progress ring & insights — with v1 localStorage migration
 */

// ========================================
// State Management
// ========================================

/**
 * Application state (single source of truth)
 * @type {Object}
 */
const state = {
    todos: [],
    projects: [],
    currentFilter: 'all',
    currentProjectId: 'all',
    editingId: null,
    formOpen: false,
    formError: null,
    // v4 Smart Extraction
    extractionDrafts: [],
    extractionLoading: false,
    extractionError: null,
    // v5 Account & Cloud Workspace
    auth: { user: null, loading: false },
    cloudTasks: [],
    authModalTab: 'login',
    // v6 Local-to-Cloud Sync
    sync: { confirming: false, loading: false, error: null }
};

// Local Storage key & schema version
const STORAGE_KEY = 'simple-todo-list';
const SCHEMA_VERSION = 2;

// Field constraints
const TITLE_MAX = 150;
const PROJECT_NAME_MAX = 30;
const ESTIMATE_MIN = 1;
const ESTIMATE_MAX = 600;

// Progress ring geometry (viewBox 120, circle r=52)
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ========================================
// DOM Elements
// ========================================

const elements = {
    // Center column
    mainColumn: document.getElementById('mainColumn'),
    todoForm: document.getElementById('todoForm'),
    todoInput: document.getElementById('todoInput'),
    openDetailForm: document.getElementById('openDetailForm'),
    detailFormSection: document.getElementById('detailFormSection'),
    filterButtons: document.querySelectorAll('.filter-btn'),
    todoCount: document.getElementById('todoCount'),
    todoList: document.getElementById('todoList'),
    emptyState: document.getElementById('emptyState'),
    emptyText: document.querySelector('#emptyState .empty-text'),
    emptyHint: document.querySelector('#emptyState .empty-hint'),
    clearCompleted: document.getElementById('clearCompleted'),
    focusPanel: document.getElementById('focusPanel'),
    // v4 Smart Extraction
    extractBtn: document.getElementById('extractBtn'),
    extractionResults: document.getElementById('extractionResults'),
    // Left column
    navEntryList: document.getElementById('navEntryList'),
    projectForm: document.getElementById('projectForm'),
    projectInput: document.getElementById('projectInput'),
    projectError: document.getElementById('projectError'),
    // Right column
    progressRing: document.getElementById('progressRing'),
    ringProgress: document.getElementById('ringProgress'),
    ringPercent: document.getElementById('ringPercent'),
    ringSummary: document.getElementById('ringSummary'),
    doneLeftSummary: document.getElementById('doneLeftSummary'),
    insightDoneToday: document.getElementById('insightDoneToday'),
    insightOverdue: document.getElementById('insightOverdue'),
    insightHighOpen: document.getElementById('insightHighOpen'),
    // v5 Account & Cloud Workspace
    authBtn: document.getElementById('authBtn'),
    authLogoutBtn: document.getElementById('authLogoutBtn'),
    authModal: document.getElementById('authModal'),
    authError: document.getElementById('authError'),
    authLoginForm: document.getElementById('authLoginForm'),
    authRegisterForm: document.getElementById('authRegisterForm'),
    authTabs: document.querySelectorAll('.auth-tab'),
    cloudWorkspaceSection: document.getElementById('cloudWorkspaceSection'),
    cloudTaskList: document.getElementById('cloudTaskList'),
    // v6 Local-to-Cloud Sync
    syncBtn: document.getElementById('syncBtn'),
    syncConfirmCard: document.getElementById('syncConfirmCard'),
    syncConfirmHint: document.getElementById('syncConfirmHint'),
    syncError: document.getElementById('syncError'),
    syncConfirmBtn: document.getElementById('syncConfirmBtn'),
    syncCancelBtn: document.getElementById('syncCancelBtn')
};

// The account dialog is authored beside its trigger in the header, but a
// transformed header becomes the containing block for `position: fixed`.
// Mount it at the document root so its overlay always covers the viewport.
const mountAuthModalAtDocumentRoot = () => {
    if (elements.authModal && elements.authModal.parentElement !== document.body) {
        document.body.append(elements.authModal);
    }
};

// ========================================
// Local Storage Functions (envelope + migration)
// ========================================

/**
 * Returns an empty workspace payload
 * @returns {Object} Blank envelope
 */
const emptyWorkspace = () => ({
    schemaVersion: SCHEMA_VERSION,
    todos: [],
    projects: []
});

/**
 * Migrates a single raw todo to the v2 model ("fill only if missing",
 * idempotent, unknown fields passed through untouched)
 * @param {*} raw - Raw todo record
 * @returns {Object} Migrated todo
 */
const migrateTodo = (raw) => {
    const defaults = () => ({
        id: generateId(),
        text: '',
        completed: false,
        createdAt: new Date().toISOString(),
        projectId: null,
        priority: 'medium',
        dueDate: null,
        estimateMinutes: null,
        focused: false,
        completedAt: null
    });

    if (!raw || typeof raw !== 'object') {
        return defaults();
    }

    const todo = { ...raw };
    if (typeof todo.id !== 'string' || !todo.id) todo.id = generateId();
    if (typeof todo.text !== 'string') todo.text = String(todo.text ?? '');
    if (typeof todo.completed !== 'boolean') todo.completed = Boolean(todo.completed);
    if (typeof todo.createdAt !== 'string') todo.createdAt = new Date().toISOString();
    if (todo.projectId === undefined) todo.projectId = null;
    if (todo.priority === undefined) todo.priority = 'medium';
    if (todo.dueDate === undefined) todo.dueDate = null;
    if (todo.estimateMinutes === undefined) todo.estimateMinutes = null;
    if (todo.focused === undefined) todo.focused = false;
    if (todo.completedAt === undefined) todo.completedAt = null;
    return todo;
};

/**
 * Loads the workspace from localStorage.
 * Decision table:
 *   - key missing / JSON.parse throws  -> blank envelope
 *   - Array                            -> v1 legacy array, migrate each item
 *   - object with todos array          -> v2 envelope
 *   - anything else                    -> corrupted, blank envelope
 * Read-time migration only: nothing is written back here.
 * @returns {Object} { schemaVersion, todos, projects }
 */
const loadWorkspace = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return emptyWorkspace();

        const raw = JSON.parse(data);

        if (Array.isArray(raw)) {
            return { schemaVersion: SCHEMA_VERSION, todos: raw.map(migrateTodo), projects: [] };
        }

        if (raw && typeof raw === 'object' && Array.isArray(raw.todos)) {
            const projects = Array.isArray(raw.projects)
                ? raw.projects.filter(p => p && typeof p === 'object'
                    && typeof p.id === 'string' && p.id
                    && typeof p.name === 'string' && p.name)
                : [];
            return { schemaVersion: SCHEMA_VERSION, todos: raw.todos.map(migrateTodo), projects };
        }

        return emptyWorkspace();
    } catch (error) {
        console.error('LocalStorage read error:', error);
        return emptyWorkspace();
    }
};

/**
 * Saves the workspace as a v2 envelope to the original key.
 * Write failures are caught (memory state stays intact) and a
 * light in-page notice is shown; the app keeps working.
 */
const saveWorkspace = () => {
    try {
        const payload = {
            schemaVersion: SCHEMA_VERSION,
            todos: state.todos,
            projects: state.projects
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.error('LocalStorage write error:', error);
        showSaveFailedToast();
    }
};

// ========================================
// Utilities
// ========================================

/**
 * Generates a unique ID
 * @returns {string} Unique ID
 */
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

/**
 * Escapes HTML characters (XSS protection)
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

/**
 * Returns today's local calendar date as YYYY-MM-DD
 * @returns {string} Today string
 */
const todayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/**
 * Formats a YYYY-MM-DD date for display using the current language
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {string} Localized date text
 */
const formatDueDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return dateStr;
    const locale = currentLang === 'en' ? 'en-US' : 'zh-CN';
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
};

// ========================================
// Light Notices (save failure / transient hint)
// ========================================

let saveFailedToastTimer = null;

/**
 * Shows an in-page toast for about 2 seconds
 * @param {string} message - Text to display
 */
const showToast = (message) => {
    let toast = document.getElementById('saveToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'saveToast';
        toast.className = 'save-toast';
        toast.setAttribute('role', 'alert');
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    if (saveFailedToastTimer) clearTimeout(saveFailedToastTimer);
    saveFailedToastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
};

/**
 * Shows the save-failure notice
 */
const showSaveFailedToast = () => {
    showToast(t('error.saveFailed'));
};

let transientPlaceholderTimer = null;

/**
 * Temporarily replaces the quick-add input placeholder with a hint
 * @param {string} messageKey - i18n key of the hint
 */
const showTransientPlaceholder = (messageKey) => {
    const input = elements.todoInput;
    input.setAttribute('placeholder', t(messageKey));
    if (transientPlaceholderTimer) clearTimeout(transientPlaceholderTimer);
    transientPlaceholderTimer = setTimeout(() => {
        input.setAttribute('placeholder', t('placeholder.addTask'));
    }, 2000);
};

// ========================================
// Validation (single point of maintenance)
// ========================================

/**
 * Validates a task form input
 * @param {Object} input - { text, dueDate, estimateMinutes }
 * @returns {string|null} First error message key, or null if valid
 */
const validateTask = (input) => {
    const text = input.text.trim();
    if (!text) return 'error.titleEmpty';
    if (text.length > TITLE_MAX) return 'error.titleTooLong';

    if (input.estimateMinutes !== null && input.estimateMinutes !== undefined) {
        const n = Number(input.estimateMinutes);
        if (!Number.isInteger(n) || n < ESTIMATE_MIN || n > ESTIMATE_MAX) {
            return 'error.estimateRange';
        }
    }

    if (input.dueDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)
            || Number.isNaN(new Date(`${input.dueDate}T00:00:00`).getTime())) {
            return 'error.dateInvalid';
        }
    }

    return null;
};

// ========================================
// Queries (pure derivations from state)
// ========================================

/**
 * Builds a project predicate for an entry id
 * @param {string} entryId - 'all' | 'inbox' | project id
 * @returns {Function} Predicate over todos
 */
const projectPredicate = (entryId) => {
    if (entryId === 'all') return () => true;
    if (entryId === 'inbox') {
        return (todo) => !todo.projectId
            || !state.projects.some(p => p.id === todo.projectId);
    }
    return (todo) => todo.projectId === entryId;
};

/**
 * Returns todos visible under the combined
 * project predicate x status filter (composed in this order)
 * @returns {Array} Visible todos
 */
const getVisibleTodos = () => {
    const byProject = state.todos.filter(projectPredicate(state.currentProjectId));
    switch (state.currentFilter) {
        case 'active':
            return byProject.filter(todo => !todo.completed);
        case 'completed':
            return byProject.filter(todo => todo.completed);
        default:
            return byProject;
    }
};

/**
 * Returns the todo count for a navigation entry
 * @param {string} entryId - 'all' | 'inbox' | project id
 * @returns {number} Count
 */
const getEntryCount = (entryId) => {
    const predicate = projectPredicate(entryId);
    return state.todos.filter(predicate).length;
};

/**
 * Returns all focused todos: unfinished first, completed last,
 * stable within each group; state.todos order is untouched
 * @returns {Array} Focus todos
 */
const getFocusTodos = () => {
    const focused = state.todos.filter(todo => todo.focused);
    return [
        ...focused.filter(todo => !todo.completed),
        ...focused.filter(todo => todo.completed)
    ];
};

/**
 * Computes all insight figures (single calculation point)
 * @returns {Object} { total, completed, remaining, percent, doneToday, overdue, highOpen }
 */
const computeInsights = () => {
    const total = state.todos.length;
    const completed = state.todos.filter(todo => todo.completed).length;
    const remaining = total - completed;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    const today = todayStr();
    const doneToday = state.todos.filter(todo =>
        todo.completed && todo.completedAt
        && typeof todo.completedAt === 'string'
        && todo.completedAt.slice(0, 10) === today).length;
    const overdue = state.todos.filter(todo =>
        !todo.completed && todo.dueDate && todo.dueDate < today).length;
    const highOpen = state.todos.filter(todo =>
        todo.priority === 'high' && !todo.completed).length;
    return { total, completed, remaining, percent, doneToday, overdue, highOpen };
};

// ========================================
// CRUD & Command Operations
// ========================================

/**
 * Quick add: title-only task, defaults for the other fields.
 * Created at top; inherits the current project unless on
 * "All Tasks" or "Inbox".
 * @param {string} text - Task title
 */
const addQuickTodo = (text) => {
    const trimmedText = text.trim();
    if (!trimmedText) {
        showTransientPlaceholder('error.titleEmpty');
        elements.todoInput.focus();
        return;
    }

    const projectId = (state.currentProjectId !== 'all' && state.currentProjectId !== 'inbox')
        ? state.currentProjectId
        : null;

    state.todos.unshift({
        id: generateId(),
        text: trimmedText,
        completed: false,
        createdAt: new Date().toISOString(),
        projectId,
        priority: 'medium',
        dueDate: null,
        estimateMinutes: null,
        focused: false,
        completedAt: null
    });
    commit();
};

/**
 * Toggles a todo's completed state (completedAt maintained here only)
 * @param {string} id - Todo ID
 */
const toggleTodo = (id) => {
    const todo = state.todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        todo.completedAt = todo.completed ? new Date().toISOString() : null;
        commit();
    }
};

/**
 * Deletes a todo (with a short exit animation)
 * @param {string} id - Todo ID
 * @param {HTMLElement} [itemEl] - Element to animate (optional)
 */
const deleteTodo = (id, itemEl) => {
    const todoElement = itemEl
        || elements.todoList.querySelector(`.todo-item[data-id="${id}"]`);

    if (todoElement) {
        todoElement.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            state.todos = state.todos.filter(todo => todo.id !== id);
            commit();
        }, 300);
    }
};

/**
 * Enters edit mode: the todo item is replaced by the full field form
 * @param {string} id - Todo ID
 */
const startEditTodo = (id) => {
    state.editingId = id;
    state.formOpen = false;
    state.formError = null;
    renderTodos();
    renderDetailFormArea();

    const titleInput = document.querySelector('.todo-item.editing input[name="title"]');
    if (titleInput) {
        titleInput.focus();
        titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
    }
};

/**
 * Cancels a todo edit (no persistence; original values restored by re-render)
 */
const cancelEditTodo = () => {
    state.editingId = null;
    state.formError = null;
    renderTodos();
    renderDetailFormArea();
};

/**
 * Toggles the focus flag of a todo (multiple focus tasks allowed)
 * @param {string} id - Todo ID
 */
const toggleFocus = (id) => {
    const todo = state.todos.find(t => t.id === id);
    if (todo) {
        todo.focused = !todo.focused;
        commit();
    }
};

/**
 * Removes all completed todos
 */
const clearCompleted = () => {
    const completedItems = elements.todoList.querySelectorAll('.todo-item.completed');

    completedItems.forEach((item, index) => {
        setTimeout(() => {
            item.style.animation = 'slideOut 0.3s ease forwards';
        }, index * 50);
    });

    setTimeout(() => {
        state.todos = state.todos.filter(todo => !todo.completed);
        commit();
    }, completedItems.length * 50 + 300);
};

// ========================================
// Form Commands (detail add / edit)
// ========================================

/**
 * Opens the detail add form (cancels any active edit)
 */
const openDetailForm = () => {
    state.formOpen = true;
    state.formError = null;
    state.editingId = null;
    renderTodos();
    renderDetailFormArea();

    const titleInput = document.querySelector('#taskDetailForm input[name="title"]');
    if (titleInput) titleInput.focus();
};

/**
 * Closes the detail add form (clears formError & temporary input,
 * same path as Escape / Cancel, nothing persisted)
 */
const closeForm = () => {
    state.formOpen = false;
    state.formError = null;
    renderDetailFormArea();
};

/**
 * Closes whichever form is open (edit or detail add)
 */
const closeOrCancelForm = () => {
    if (state.editingId) {
        cancelEditTodo();
    } else {
        closeForm();
    }
};

/**
 * Handles the detail form submit: validates, then creates or updates
 * according to the data-todo-id attribute
 * @param {HTMLFormElement} form - Submitted form
 */
const submitTaskForm = (form) => {
    const editingId = form.dataset.todoId || null;
    const input = {
        text: form.elements.title.value,
        projectId: form.elements.project.value || null,
        priority: form.elements.priority.value,
        dueDate: form.elements.dueDate.value || null,
        estimateMinutes: form.elements.estimate.value === ''
            ? null
            : Number(form.elements.estimate.value),
        focused: form.elements.focused.checked
    };

    const errorKey = validateTask(input);
    if (errorKey) {
        state.formError = errorKey;
        const errorEl = form.querySelector('.form-error');
        if (errorEl) errorEl.textContent = t(errorKey);
        const titleInput = form.querySelector('input[name="title"]');
        if (titleInput) titleInput.focus();
        return;
    }

    if (editingId) {
        const todo = state.todos.find(t => t.id === editingId);
        if (todo) {
            todo.text = input.text;
            todo.projectId = input.projectId;
            todo.priority = input.priority;
            todo.dueDate = input.dueDate;
            todo.estimateMinutes = input.estimateMinutes;
            todo.focused = input.focused;
        }
        state.editingId = null;
    } else {
        state.todos.unshift({
            id: generateId(),
            text: input.text,
            completed: false,
            createdAt: new Date().toISOString(),
            projectId: input.projectId,
            priority: input.priority,
            dueDate: input.dueDate,
            estimateMinutes: input.estimateMinutes,
            focused: input.focused,
            completedAt: null
        });
        state.formOpen = false;
    }

    state.formError = null;
    commit();
    renderDetailFormArea();
};

// ========================================
// Project Operations
// ========================================

/**
 * Creates a project after validation (non-empty, <=30 chars, unique)
 * @param {string} name - Project name
 * @returns {boolean} Whether the project was created
 */
const createProject = (name) => {
    const trimmed = name.trim();
    let errorKey = null;
    if (!trimmed) errorKey = 'project.error.empty';
    else if (trimmed.length > PROJECT_NAME_MAX) errorKey = 'project.error.tooLong';
    else if (state.projects.some(p => p.name === trimmed)) errorKey = 'project.error.duplicate';

    if (errorKey) {
        elements.projectError.textContent = t(errorKey);
        return false;
    }

    state.projects.push({
        id: generateId(),
        name: trimmed,
        createdAt: new Date().toISOString()
    });
    elements.projectError.textContent = '';
    commit();
    return true;
};

/**
 * Selects a navigation entry (view switch only, nothing persisted)
 * @param {string} entryId - 'all' | 'inbox' | project id
 */
const selectProject = (entryId) => {
    state.currentProjectId = entryId;
    renderProjectsNav();
    renderTodos();
};

// ========================================
// Filter Functions
// ========================================

/**
 * Changes the active status filter
 * @param {string} filter - Filter type (all, active, completed)
 */
const setFilter = (filter) => {
    state.currentFilter = filter;

    elements.filterButtons.forEach(btn => {
        const isActive = btn.dataset.filter === filter;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive);
    });

    renderTodos();
    updateStats();
};

// ========================================
// Drag and Drop Functions
// ========================================

// ID of the dragged todo (we use the ID instead of the DOM index so that
// the correct item is moved even when a filter is active)
let draggedId = null;

/**
 * Clears the visual feedback on the dragged-over item
 */
const clearDragIndicators = () => {
    elements.todoList.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
};

/**
 * Fired when dragging starts
 * @param {DragEvent} event
 */
const handleDragStart = (event) => {
    const todoItem = event.target.closest('.todo-item');
    if (!todoItem) return;

    draggedId = todoItem.dataset.id;
    todoItem.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedId);
};

/**
 * Fired while dragging over an element
 * @param {DragEvent} event
 */
const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const todoItem = event.target.closest('.todo-item');
    if (!todoItem || todoItem.dataset.id === draggedId) return;

    const rect = todoItem.getBoundingClientRect();
    const isAbove = event.clientY < rect.top + rect.height / 2;

    todoItem.classList.toggle('drag-over-top', isAbove);
    todoItem.classList.toggle('drag-over-bottom', !isAbove);
};

/**
 * Fired when leaving an element during drag
 * @param {DragEvent} event
 */
const handleDragLeave = (event) => {
    const todoItem = event.target.closest('.todo-item');
    if (todoItem) {
        todoItem.classList.remove('drag-over-top', 'drag-over-bottom');
    }
};

/**
 * Fired on drop - reorders state.todos using IDs
 * @param {DragEvent} event
 */
const handleDrop = (event) => {
    event.preventDefault();

    const todoItem = event.target.closest('.todo-item');
    if (!todoItem) return;

    const targetId = todoItem.dataset.id;
    if (!targetId || targetId === draggedId) return;

    const rect = todoItem.getBoundingClientRect();
    const insertAfter = event.clientY > rect.top + rect.height / 2;

    const draggedPos = state.todos.findIndex(todo => todo.id === draggedId);
    if (draggedPos === -1) return;

    const [draggedTodo] = state.todos.splice(draggedPos, 1);

    const targetPos = state.todos.findIndex(todo => todo.id === targetId);
    if (targetPos === -1) {
        state.todos.push(draggedTodo);
    } else {
        state.todos.splice(insertAfter ? targetPos + 1 : targetPos, 0, draggedTodo);
    }

    commit();
    clearDragIndicators();
};

/**
 * Fired when dragging ends - clears all visual states
 */
const handleDragEnd = () => {
    const draggedItem = elements.todoList.querySelector('.dragging');
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
    }
    clearDragIndicators();
    draggedId = null;
};

// ========================================
// Render Pipeline
// ========================================

/**
 * Unified mutation pipeline: every data change goes through here
 * (save -> project nav -> focus panel -> task flow -> stats)
 */
const commit = () => {
    saveWorkspace();
    renderProjectsNav();
    renderFocusPanel();
    renderTodos();
    updateStats();
    // v6: 本地任务数量变化时同步入口可见性也变化
    renderSyncEntry();
};

/**
 * Re-renders all dynamic regions without saving
 * (used by language switch and initial load)
 */
const renderAll = () => {
    renderProjectsNav();
    renderFocusPanel();
    renderTodos();
    updateStats();
    renderSyncEntry();
};

/**
 * Renders the left navigation: fixed entries (All/Inbox) + user projects,
 * live counts, current highlight with aria-current
 */
const renderProjectsNav = () => {
    const entries = [
        { id: 'all', label: t('nav.all') },
        { id: 'inbox', label: t('nav.inbox') },
        ...state.projects.map(p => ({ id: p.id, label: p.name }))
    ];

    elements.navEntryList.innerHTML = entries.map(entry => {
        const active = state.currentProjectId === entry.id;
        return `
            <li>
                <button type="button"
                    class="project-entry ${active ? 'active' : ''}"
                    data-action="select-project"
                    data-project-id="${escapeHtml(entry.id)}"
                    ${active ? 'aria-current="true"' : ''}
                >
                    <span class="project-name">${escapeHtml(entry.label)}</span>
                    <span class="project-count">${getEntryCount(entry.id)}</span>
                </button>
            </li>
        `;
    }).join('');
};

/**
 * Renders the "Today's Focus" panel: aggregated focus tasks
 * (reuses the card builder, no dragging), or an empty-state hint
 */
const renderFocusPanel = () => {
    const focusTodos = getFocusTodos();

    if (focusTodos.length === 0) {
        elements.focusPanel.innerHTML = `
            <div class="focus-empty">
                <p class="focus-empty-title">${t('focus.emptyTitle')}</p>
                <p class="focus-empty-hint">${t('focus.emptyHint')}</p>
            </div>
        `;
        return;
    }

    elements.focusPanel.innerHTML = focusTodos
        .map(todo => createTodoItemHTML(todo, { draggable: false }))
        .join('');
};

/**
 * Builds the detail add/edit form HTML.
 * - Add mode (todo=null): defaults (inbox / medium / no due / no estimate / not focused)
 * - Edit mode: all fields echoed from the original task
 * @param {Object|null} todo - Todo to edit, or null for add mode
 * @returns {string} HTML string
 */
const createTaskFormHTML = (todo = null) => {
    const isEdit = todo !== null;
    const projectValue = isEdit && todo.projectId ? todo.projectId : '';
    const priorityValue = isEdit && todo.priority ? todo.priority : 'medium';
    const dueValue = isEdit && todo.dueDate ? todo.dueDate : '';
    const estimateValue = isEdit
        && todo.estimateMinutes !== null && todo.estimateMinutes !== undefined
        ? todo.estimateMinutes
        : '';
    const focusedChecked = isEdit && todo.focused ? 'checked' : '';

    const projectOptions = [
        `<option value="" ${projectValue === '' ? 'selected' : ''}>${t('form.inboxOption')}</option>`,
        ...state.projects.map(p =>
            `<option value="${escapeHtml(p.id)}" ${projectValue === p.id ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
    ].join('');

    const priorityOptions = ['high', 'medium', 'low'].map(p =>
        `<option value="${p}" ${priorityValue === p ? 'selected' : ''}>${t(`priority.${p}`)}</option>`
    ).join('');

    return `
        <form id="taskDetailForm" class="task-detail-form" data-todo-id="${isEdit ? todo.id : ''}" novalidate>
            <div class="form-row">
                <label for="tfTitle">${t('form.title')}</label>
                <input
                    type="text"
                    id="tfTitle"
                    name="title"
                    maxlength="150"
                    autocomplete="off"
                    value="${isEdit ? escapeHtml(todo.text) : ''}"
                    placeholder="${t('form.titlePlaceholder')}"
                    aria-label="${t('aria.titleInput')}"
                >
            </div>
            <div class="form-row-grid">
                <div class="form-field">
                    <label for="tfProject">${t('form.project')}</label>
                    <select id="tfProject" name="project" aria-label="${t('aria.projectSelect')}">
                        ${projectOptions}
                    </select>
                </div>
                <div class="form-field">
                    <label for="tfPriority">${t('form.priority')}</label>
                    <select id="tfPriority" name="priority" aria-label="${t('aria.prioritySelect')}">
                        ${priorityOptions}
                    </select>
                </div>
                <div class="form-field">
                    <label for="tfDue">${t('form.dueDate')}</label>
                    <input type="date" id="tfDue" name="dueDate" value="${dueValue}" aria-label="${t('aria.dueDateInput')}">
                </div>
                <div class="form-field">
                    <label for="tfEstimate">${t('form.estimate')}</label>
                    <input type="number" id="tfEstimate" name="estimate" min="1" max="600" step="1" value="${estimateValue}" aria-label="${t('aria.estimateInput')}">
                </div>
            </div>
            <div class="form-footer">
                <label class="form-checkbox">
                    <input type="checkbox" name="focused" ${focusedChecked} aria-label="${t('aria.focusedCheckbox')}">
                    <span>${t('form.focused')}</span>
                </label>
                <div class="form-buttons">
                    <p class="form-error" role="alert">${state.formError ? t(state.formError) : ''}</p>
                    <button type="button" class="btn btn-ghost" data-form-action="cancel" aria-label="${t('aria.cancel')}">${t('form.cancel')}</button>
                    <button type="submit" class="btn btn-add" aria-label="${t('aria.save')}">${t('form.save')}</button>
                </div>
            </div>
        </form>
    `;
};

/**
 * Renders the detail form section according to
 * state.formOpen / state.editingId
 */
const renderDetailFormArea = () => {
    if (state.formOpen || state.editingId) {
        const todo = state.editingId
            ? state.todos.find(t => t.id === state.editingId)
            : null;
        elements.detailFormSection.innerHTML = createTaskFormHTML(todo);
        elements.detailFormSection.classList.remove('hidden');
    } else {
        elements.detailFormSection.innerHTML = '';
        elements.detailFormSection.classList.add('hidden');
    }
};

/**
 * Re-renders the detail form while preserving the user's draft
 * (used on language switch so no input is lost)
 */
const rerenderFormPreservingDraft = () => {
    const form = document.getElementById('taskDetailForm');
    if (!form) {
        renderDetailFormArea();
        return;
    }

    const draft = {
        text: form.elements.title.value,
        projectId: form.elements.project.value,
        priority: form.elements.priority.value,
        dueDate: form.elements.dueDate.value,
        estimate: form.elements.estimate.value,
        focused: form.elements.focused.checked
    };

    renderDetailFormArea();

    const newForm = document.getElementById('taskDetailForm');
    if (newForm) {
        newForm.elements.title.value = draft.text;
        newForm.elements.project.value = draft.projectId;
        newForm.elements.priority.value = draft.priority;
        newForm.elements.dueDate.value = draft.dueDate;
        newForm.elements.estimate.value = draft.estimate;
        newForm.elements.focused.checked = draft.focused;
        if (state.formError) {
            const errorEl = newForm.querySelector('.form-error');
            if (errorEl) errorEl.textContent = t(state.formError);
        }
    }
};

/**
 * Builds the HTML for a todo item (full-field summary card).
 * Empty optional fields render no badge; user content is escaped.
 * @param {Object} todo - Todo object
 * @param {Object} [options] - { draggable: boolean }
 * @returns {string} HTML string
 */
const createTodoItemHTML = (todo, options = {}) => {
    const { draggable = true } = options;
    const today = todayStr();
    const isOverdue = !todo.completed && !!todo.dueDate && todo.dueDate < today;
    const priority = todo.priority || 'medium';
    const project = todo.projectId
        ? state.projects.find(p => p.id === todo.projectId)
        : null;

    const metaBadges = [];
    if (project) {
        metaBadges.push(`<span class="meta-badge meta-project">${escapeHtml(project.name)}</span>`);
    }
    metaBadges.push(
        `<span class="meta-badge meta-priority meta-priority-${escapeHtml(priority)}">${t(`priority.${priority}`)}</span>`
    );
    if (todo.dueDate) {
        const overdueTag = isOverdue ? `<span class="overdue-tag">${t('overdue.label')}</span>` : '';
        metaBadges.push(
            `<span class="meta-badge meta-due ${isOverdue ? 'is-overdue-date' : ''}">${formatDueDate(todo.dueDate)}${overdueTag}</span>`
        );
    }
    if (todo.estimateMinutes !== null && todo.estimateMinutes !== undefined) {
        metaBadges.push(
            `<span class="meta-badge meta-estimate">${escapeHtml(String(todo.estimateMinutes))} ${t('form.estimateUnit')}</span>`
        );
    }

    const dragHandle = draggable ? `
            <div class="drag-handle" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="5" r="1"></circle>
                    <circle cx="9" cy="12" r="1"></circle>
                    <circle cx="9" cy="19" r="1"></circle>
                    <circle cx="15" cy="5" r="1"></circle>
                    <circle cx="15" cy="12" r="1"></circle>
                    <circle cx="15" cy="19" r="1"></circle>
                </svg>
            </div>` : '';

    return `
        <li class="todo-item ${todo.completed ? 'completed' : ''} priority-${escapeHtml(priority)} ${isOverdue ? 'is-overdue' : ''}"
            data-id="${todo.id}"
            ${draggable ? 'draggable="true"' : ''}
            aria-label="${escapeHtml(todo.text)}, ${todo.completed ? t('aria.itemCompleted') : t('aria.itemActive')}">
            ${dragHandle}
            <label class="todo-checkbox">
                <input
                    type="checkbox"
                    ${todo.completed ? 'checked' : ''}
                    data-action="toggle"
                    aria-label="${todo.completed ? t('aria.markNotCompleted') : t('aria.markCompleted')}"
                >
                <span class="checkmark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </span>
            </label>
            <button type="button"
                class="focus-star ${todo.focused ? 'focused' : ''}"
                data-action="focus"
                aria-pressed="${todo.focused}"
                aria-label="${todo.focused ? t('focus.unset') : t('focus.set')}">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.9 6.26 6.6.57-5 4.36 1.5 6.45L12 16.9 5.99 19.64l1.5-6.45-5-4.36 6.6-.57z"></path>
                </svg>
            </button>
            <div class="todo-content">
                <span class="todo-text">${escapeHtml(todo.text)}</span>
                ${metaBadges.length > 0 ? `<div class="todo-meta">${metaBadges.join('')}</div>` : ''}
            </div>
            <div class="todo-actions">
                <button class="todo-action-btn start-focus" data-action="start-focus" aria-label="${t('aria.focusStart')}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="9"></circle>
                        <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
                    </svg>
                </button>
                <button class="todo-action-btn edit" data-action="edit" aria-label="${t('aria.edit')}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="todo-action-btn delete" data-action="delete" aria-label="${t('aria.delete')}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </div>
        </li>
    `;
};

/**
 * Renders the todo list (editing todo replaced by the full form;
 * empty state text adapts to the current project view)
 */
const renderTodos = () => {
    const filteredTodos = getVisibleTodos();

    if (filteredTodos.length === 0) {
        elements.todoList.innerHTML = '';
        if (state.currentProjectId !== 'all') {
            elements.emptyText.textContent = t('empty.projectText');
            elements.emptyHint.textContent = t('empty.projectHint');
        } else {
            elements.emptyText.textContent = t('empty.text');
            elements.emptyHint.textContent = t('empty.hint');
        }
        elements.emptyState.classList.add('show');
    } else {
        elements.emptyState.classList.remove('show');
        elements.todoList.innerHTML = filteredTodos.map(todo => {
            if (state.editingId === todo.id) {
                return `<li class="todo-item editing" data-id="${todo.id}">${createTaskFormHTML(todo)}</li>`;
            }
            return createTodoItemHTML(todo);
        }).join('');

        // Attach drag and drop event listeners
        elements.todoList.querySelectorAll('.todo-item:not(.editing)').forEach(item => {
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
        });
    }
};

/**
 * Updates the stats: count text, clear-completed visibility,
 * progress ring, done/left summary and the three insight values.
 * The only place where statistics are rendered (DRY).
 */
const updateStats = () => {
    const insights = computeInsights();
    const { total, completed, remaining, percent } = insights;

    // Task count text (plural/singular branches)
    let countText = '';
    switch (state.currentFilter) {
        case 'active':
            countText = t('stats.active', { n: remaining });
            break;
        case 'completed':
            countText = t('stats.completed', { n: completed });
            break;
        default:
            countText = t(total === 1 ? 'stats.taskOne' : 'stats.tasks', { n: total });
    }
    elements.todoCount.textContent = countText;

    // Show/hide the "Clear Completed" button
    if (completed > 0) {
        elements.clearCompleted.classList.add('show');
    } else {
        elements.clearCompleted.classList.remove('show');
    }

    // Progress ring (SVG stroke-dashoffset; JS does no per-frame interpolation)
    elements.ringProgress.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
    elements.ringProgress.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - percent / 100)}`;
    elements.ringPercent.textContent = `${percent}%`;
    elements.progressRing.setAttribute('aria-label',
        t('insight.ringAria', { pct: percent, done: completed, total }));

    // Ring summary & done/left
    elements.ringSummary.textContent = t('insight.ringSummary', { completed, total });
    elements.doneLeftSummary.textContent = t('insight.doneLeft', { done: completed, left: remaining });

    // Insight values
    elements.insightDoneToday.textContent = insights.doneToday;
    elements.insightOverdue.textContent = insights.overdue;
    elements.insightHighOpen.textContent = insights.highOpen;
};

// ========================================
// Event Handlers
// ========================================

/**
 * Quick add form submit handler
 * @param {Event} event
 */
const handleQuickFormSubmit = (event) => {
    event.preventDefault();
    const text = elements.todoInput.value;
    addQuickTodo(text);
    elements.todoInput.value = '';
    elements.todoInput.focus();
};

/**
 * Card click handler (event delegation over task flow & focus panel)
 * @param {Event} event
 */
const handleCardClick = (event) => {
    const target = event.target;
    const todoItem = target.closest('.todo-item');
    if (!todoItem || todoItem.classList.contains('editing')) return;

    const todoId = todoItem.dataset.id;
    const action = target.closest('[data-action]')?.dataset.action;

    switch (action) {
        case 'toggle':
            toggleTodo(todoId);
            break;
        case 'focus':
            toggleFocus(todoId);
            break;
        case 'delete':
            deleteTodo(todoId, todoItem);
            break;
        case 'edit':
            startEditTodo(todoId);
            break;
        case 'start-focus':
            openFocusDurationPicker(todoId, todoItem);
            break;
    }
};

/**
 * Form action click handler (delegated on the center column):
 * Cancel button of the detail/edit form
 * @param {Event} event
 */
const handleFormActionClick = (event) => {
    const actionEl = event.target.closest('[data-form-action]');
    if (!actionEl) return;

    if (actionEl.dataset.formAction === 'cancel') {
        event.preventDefault();
        closeOrCancelForm();
    }
};

/**
 * Submit handler delegated on the center column (covers the dynamic
 * detail add form and the edit form inside a todo item)
 * @param {Event} event
 */
const handleMainSubmit = (event) => {
    if (event.target.id === 'taskDetailForm') {
        event.preventDefault();
        submitTaskForm(event.target);
    }
};

/**
 * Keyboard handler delegated on the center column:
 * Escape closes/cancels the detail or edit form (Enter submits natively)
 * @param {KeyboardEvent} event
 */
const handleFormKeydown = (event) => {
    if (event.key !== 'Escape') return;

    const form = event.target.closest('form');
    if (!form || form.id !== 'taskDetailForm') return;

    event.preventDefault();
    closeOrCancelForm();
};

/**
 * Project navigation click handler (delegated)
 * @param {Event} event
 */
const handleProjectNavClick = (event) => {
    const entry = event.target.closest('[data-action="select-project"]');
    if (!entry) return;
    selectProject(entry.dataset.projectId);
};

/**
 * New project form submit handler
 * @param {Event} event
 */
const handleProjectFormSubmit = (event) => {
    event.preventDefault();
    const created = createProject(elements.projectInput.value);
    if (created) {
        elements.projectInput.value = '';
    }
    elements.projectInput.focus();
};

/**
 * Filter button click handler
 * @param {Event} event
 */
const handleFilterClick = (event) => {
    const filter = event.target.dataset.filter;
    if (filter) {
        setFilter(filter);
    }
};

// ========================================
// Focus Flow (v3) — immersive focus session
// 状态机：idle → running ⇄ paused → completed
// 持久化：localStorage 'daylight-focus-session'
// 计时：setInterval(250ms) 仅刷新显示，剩余时间始终由 (duration - elapsedMs) 计算
// ========================================

const FOCUS_STORAGE_KEY = 'daylight-focus-session';
const FOCUS_TICK_MS = 250;
const FOCUS_PERSIST_INTERVAL_MS = 5000;
const FOCUS_DURATION_PRESETS = [25, 45];

/**
 * Focus session state (single source of truth for the overlay)
 * @type {Object|null}
 */
let focusSession = null;

/** @type {number|null} setInterval handle for the visible tick */
let focusTickHandle = null;

/** @type {number|null} timestamp of last periodic persist */
let focusLastPersistAt = null;

/**
 * Reads the saved focus session from localStorage (defensive)
 * @returns {Object|null}
 */
const readFocusSession = () => {
    try {
        const raw = localStorage.getItem(FOCUS_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch (error) {
        console.error('Focus session read error:', error);
        return null;
    }
};

/**
 * Persists the focus session to localStorage (defensive)
 * @param {Object|null} session
 */
const writeFocusSession = (session) => {
    try {
        if (session) {
            localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(session));
        } else {
            localStorage.removeItem(FOCUS_STORAGE_KEY);
        }
    } catch (error) {
        console.error('Focus session write error:', error);
    }
};

/**
 * Formats milliseconds as mm:ss (clamped at 0)
 * @param {number} ms
 * @returns {string}
 */
const formatFocusClock = (ms) => {
    const clamped = Math.max(0, ms);
    const totalSec = Math.floor(clamped / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
};

/**
 * Returns the live remaining milliseconds for a running session,
 * accounting for time elapsed since lastTickAt. For paused sessions
 * returns the frozen remaining value. Never negative.
 * @param {Object} session
 * @returns {number}
 */
const computeFocusRemainingMs = (session) => {
    if (session.status === 'running' && typeof session.lastTickAt === 'number') {
        const now = Date.now();
        const advanced = now - session.lastTickAt;
        return Math.max(0, session.duration - session.elapsedMs - advanced);
    }
    return Math.max(0, session.duration - session.elapsedMs);
};

/**
 * Returns the live elapsed milliseconds (running: includes unsaved advance)
 * @param {Object} session
 * @returns {number}
 */
const computeFocusElapsedMs = (session) => {
    return Math.max(0, session.duration - computeFocusRemainingMs(session));
};

// ----------------------------------------
// Duration picker popover (entry point)
// ----------------------------------------

/**
 * Closes any open duration picker (and its backdrop)
 */
const closeFocusDurationPicker = () => {
    const popover = document.querySelector('.focus-duration-popover');
    const backdrop = document.querySelector('.focus-duration-backdrop');
    if (popover) popover.remove();
    if (backdrop) backdrop.remove();
};

/**
 * Opens the duration picker anchored above the start-focus button
 * @param {string} todoId
 * @param {HTMLElement} anchorItem - todo item element (for positioning)
 */
const openFocusDurationPicker = (todoId, anchorItem) => {
    closeFocusDurationPicker();

    const todo = state.todos.find(t => t.id === todoId);
    if (!todo) return;

    // Don't allow starting focus on a completed task
    if (todo.completed) return;

    const popover = document.createElement('div');
    popover.className = 'focus-duration-popover';
    popover.setAttribute('role', 'menu');
    popover.setAttribute('aria-label', t('aria.focusDurationPicker'));

    popover.innerHTML = `
        <span class="focus-duration-popover-title">${t('focus.chooseDuration')}</span>
        ${FOCUS_DURATION_PRESETS.map(min => `
            <button type="button"
                class="focus-duration-option"
                role="menuitem"
                data-focus-duration="${min}"
                aria-label="${min === 25 ? t('aria.focusDuration25') : t('aria.focusDuration45')}">
                <span>${t(`focus.duration${min}`)}</span>
                <span class="duration-min">${min} ${t('form.estimateUnit')}</span>
            </button>
        `).join('')}
    `;

    // Position: place above the anchor item, aligned to its right edge
    const rect = anchorItem.getBoundingClientRect();
    const popoverWidth = 180;
    const popoverHeight = 120;
    popover.style.position = 'fixed';
    popover.style.top = `${Math.max(8, rect.top - popoverHeight - 8)}px`;
    popover.style.left = `${Math.min(window.innerWidth - popoverWidth - 8, Math.max(8, rect.right - popoverWidth))}px`;

    document.body.appendChild(popover);

    const backdrop = document.createElement('div');
    backdrop.className = 'focus-duration-backdrop';
    backdrop.addEventListener('click', closeFocusDurationPicker);
    document.body.appendChild(backdrop);

    popover.addEventListener('click', (event) => {
        const opt = event.target.closest('[data-focus-duration]');
        if (!opt) return;
        const minutes = Number(opt.dataset.focusDuration);
        closeFocusDurationPicker();
        startFocusSession(todoId, minutes);
    });

    // Keyboard: Esc closes, first option focusable
    popover.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeFocusDurationPicker();
        }
    });

    const firstOption = popover.querySelector('.focus-duration-option');
    if (firstOption) firstOption.focus();
};

// ----------------------------------------
// Session lifecycle
// ----------------------------------------

/**
 * Starts a new focus session for a todo
 * @param {string} todoId
 * @param {number} minutes - 25 or 45
 */
const startFocusSession = (todoId, minutes) => {
    const todo = state.todos.find(t => t.id === todoId);
    if (!todo) return;
    if (todo.completed) return;

    const now = Date.now();
    focusSession = {
        todoId,
        duration: minutes * 60 * 1000,
        startedAt: now,
        elapsedMs: 0,
        status: 'running',
        lastTickAt: now
    };
    focusLastPersistAt = now;
    writeFocusSession(focusSession);
    renderFocusOverlay();
    startFocusTick();
};

/**
 * Pauses a running session (freezes elapsedMs at the live value)
 */
const pauseFocusSession = () => {
    if (!focusSession || focusSession.status !== 'running') return;
    focusSession.elapsedMs = computeFocusElapsedMs(focusSession);
    focusSession.status = 'paused';
    focusSession.lastTickAt = null;
    stopFocusTick();
    writeFocusSession(focusSession);
    renderFocusOverlay();
};

/**
 * Resumes a paused session
 */
const resumeFocusSession = () => {
    if (!focusSession || focusSession.status !== 'paused') return;
    const now = Date.now();
    focusSession.status = 'running';
    focusSession.lastTickAt = now;
    focusLastPersistAt = now;
    writeFocusSession(focusSession);
    renderFocusOverlay();
    startFocusTick();
};

/**
 * Ends the session early (user-initiated). Triggers completion path
 * but does NOT auto-mark the linked task done (user can opt-in).
 */
const endFocusSession = () => {
    if (!focusSession) return;
    if (focusSession.status === 'running') {
        focusSession.elapsedMs = computeFocusElapsedMs(focusSession);
    }
    focusSession.status = 'completed';
    focusSession.lastTickAt = null;
    stopFocusTick();
    writeFocusSession(focusSession);
    renderFocusOverlay();
    // Insights/ring already reflect todo state; we keep them in sync via commit()
    // in case the user later marks the task done.
};

/**
 * Marks the linked task as completed and refreshes dashboard
 */
const markFocusTaskDone = () => {
    if (!focusSession) return;
    const todo = state.todos.find(t => t.id === focusSession.todoId);
    if (!todo || todo.completed) return;
    todo.completed = true;
    todo.completedAt = new Date().toISOString();
    commit();
    // Update the mark-done button visual state
    const btn = document.querySelector('.focus-mark-done');
    if (btn) {
        btn.classList.add('is-done');
        btn.setAttribute('aria-disabled', 'true');
    }
    showToast(t('focus.taskMarkedDone'));
};

/**
 * Closes the overlay and clears the session entirely
 * (called from "Back to dashboard" after completion)
 */
const closeFocusOverlay = () => {
    stopFocusTick();
    focusSession = null;
    focusLastPersistAt = null;
    writeFocusSession(null);
    const overlay = document.querySelector('.focus-overlay');
    if (overlay) overlay.remove();
};

// ----------------------------------------
// Tick (display refresh + periodic persist)
// ----------------------------------------

/**
 * Starts the visible tick (250ms). The tick only refreshes the display
 * and periodically persists; the remaining time is always recomputed
 * from (duration - elapsedMs - advance) so there is no drift.
 */
const startFocusTick = () => {
    stopFocusTick();
    focusTickHandle = setInterval(() => {
        if (!focusSession || focusSession.status !== 'running') return;
        refreshFocusOverlayTime();
        const now = Date.now();
        if (focusLastPersistAt === null
            || now - focusLastPersistAt >= FOCUS_PERSIST_INTERVAL_MS) {
            // Persist a snapshot with the live elapsedMs folded in
            const snapshot = {
                ...focusSession,
                elapsedMs: computeFocusElapsedMs(focusSession),
                lastTickAt: now
            };
            focusSession = snapshot;
            writeFocusSession(snapshot);
            focusLastPersistAt = now;
        }
        // Auto-complete when time runs out
        if (computeFocusRemainingMs(focusSession) <= 0) {
            focusSession.elapsedMs = focusSession.duration;
            focusSession.status = 'completed';
            focusSession.lastTickAt = null;
            stopFocusTick();
            writeFocusSession(focusSession);
            renderFocusOverlay();
        }
    }, FOCUS_TICK_MS);
};

/**
 * Stops the visible tick
 */
const stopFocusTick = () => {
    if (focusTickHandle !== null) {
        clearInterval(focusTickHandle);
        focusTickHandle = null;
    }
};

/**
 * Refreshes only the time display & ring (lightweight, no full re-render)
 */
const refreshFocusOverlayTime = () => {
    if (!focusSession) return;
    const remainingMs = computeFocusRemainingMs(focusSession);
    const elapsedMs = computeFocusElapsedMs(focusSession);
    const display = document.querySelector('.focus-time-display');
    if (display) display.textContent = formatFocusClock(remainingMs);

    const ring = document.querySelector('.focus-ring-progress');
    if (ring) {
        const r = 52;
        const circumference = 2 * Math.PI * r;
        const fraction = focusSession.duration > 0
            ? Math.min(1, elapsedMs / focusSession.duration)
            : 0;
        ring.style.strokeDasharray = `${circumference}`;
        ring.style.strokeDashoffset = `${circumference * (1 - fraction)}`;
    }

    const ringAria = document.querySelector('.focus-time-ring');
    if (ringAria) {
        ringAria.setAttribute('aria-label',
            `${t('focus.remaining')} ${formatFocusClock(remainingMs)}`);
    }
};

// ----------------------------------------
// Overlay rendering
// ----------------------------------------

/**
 * Builds the immersive overlay HTML for the current focusSession
 * @returns {string}
 */
const buildFocusOverlayHTML = () => {
    const session = focusSession;
    const todo = state.todos.find(t => t.id === session.todoId);
    const taskTitle = todo ? todo.text : t('focus.taskMissing');
    const taskOpen = todo && !todo.completed;
    const remainingMs = computeFocusRemainingMs(session);
    const elapsedMs = computeFocusElapsedMs(session);
    const isCompleted = session.status === 'completed';
    const isPaused = session.status === 'paused';

    const r = 52;
    const circumference = 2 * Math.PI * r;
    const fraction = session.duration > 0
        ? Math.min(1, elapsedMs / session.duration)
        : 0;
    const dashOffset = circumference * (1 - fraction);

    const primaryBtn = isCompleted
        ? `<button type="button" class="focus-btn focus-btn-primary" data-focus-action="close">
             <span>${t('focus.backToDashboard')}</span>
           </button>`
        : (isPaused
            ? `<button type="button" class="focus-btn focus-btn-primary" data-focus-action="resume" aria-label="${t('aria.focusResume')}">
                 <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
                 <span>${t('focus.resume')}</span>
               </button>`
            : `<button type="button" class="focus-btn focus-btn-primary" data-focus-action="pause" aria-label="${t('aria.focusPause')}">
                 <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"></rect><rect x="14" y="5" width="4" height="14"></rect></svg>
                 <span>${t('focus.pause')}</span>
               </button>`);

    const endBtn = isCompleted
        ? ''
        : `<button type="button" class="focus-btn focus-btn-danger" data-focus-action="end" aria-label="${t('aria.focusEnd')}">
             <span>${t('focus.end')}</span>
           </button>`;

    const markDoneBtn = (isCompleted && taskOpen)
        ? `<button type="button" class="focus-mark-done" data-focus-action="mark-done" aria-label="${t('aria.focusMarkDone')}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
             <span>${t('focus.markTaskDone')}</span>
           </button>`
        : '';

    const statusLabel = isCompleted
        ? t('focus.completed')
        : (isPaused ? t('focus.pausedLabel') : t('focus.modeTitle'));

    return `
        <div class="focus-overlay-card" role="dialog" aria-modal="true" aria-labelledby="focusModeLabel">
            <span class="focus-mode-label" id="focusModeLabel">${t('focus.modeTitle')}</span>
            <p class="focus-task-title">${escapeHtml(taskTitle)}</p>
            <div class="focus-time-ring" role="img" aria-label="${t('focus.remaining')} ${formatFocusClock(remainingMs)}">
                <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                    <circle class="focus-ring-track" cx="60" cy="60" r="52"></circle>
                    <circle class="focus-ring-progress" cx="60" cy="60" r="52"
                        style="stroke-dasharray:${circumference};stroke-dashoffset:${dashOffset}"></circle>
                </svg>
                <span class="focus-time-display">${formatFocusClock(remainingMs)}</span>
                <span class="focus-time-status">${statusLabel}</span>
            </div>
            <div class="focus-completed-banner">
                <span class="focus-completed-title">${t('focus.completed')}</span>
                <span class="focus-completed-hint">${t('focus.completedHint')}</span>
            </div>
            ${markDoneBtn}
            <div class="focus-controls">
                ${primaryBtn}
                ${endBtn}
            </div>
        </div>
    `;
};

/**
 * (Re)renders the immersive overlay to reflect the current session state.
 * Re-uses the existing element when possible to preserve focus.
 */
const renderFocusOverlay = () => {
    if (!focusSession) return;

    let overlay = document.querySelector('.focus-overlay');
    const isCompleted = focusSession.status === 'completed';
    const isPaused = focusSession.status === 'paused';
    const todo = state.todos.find(t => t.id === focusSession.todoId);
    const showMarkDone = isCompleted && todo && !todo.completed;

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'focus-overlay';
        overlay.setAttribute('role', 'region');
        overlay.setAttribute('aria-label', t('aria.focusOverlay'));
        overlay.addEventListener('click', handleFocusOverlayClick);
        overlay.addEventListener('keydown', handleFocusOverlayKeydown);
        document.body.appendChild(overlay);
    }

    overlay.classList.toggle('is-paused', isPaused);
    overlay.classList.toggle('is-completed', isCompleted);
    overlay.classList.toggle('show-mark-done', showMarkDone);
    overlay.innerHTML = buildFocusOverlayHTML();

    // Auto-focus the primary button for keyboard users
    const primary = overlay.querySelector('.focus-btn-primary, .focus-mark-done');
    if (primary) primary.focus();
};

/**
 * Click delegation inside the overlay
 * @param {Event} event
 */
const handleFocusOverlayClick = (event) => {
    const btn = event.target.closest('[data-focus-action]');
    if (!btn) return;
    const action = btn.dataset.focusAction;
    switch (action) {
        case 'pause':
            pauseFocusSession();
            break;
        case 'resume':
            resumeFocusSession();
            break;
        case 'end':
            endFocusSession();
            break;
        case 'close':
            closeFocusOverlay();
            break;
        case 'mark-done':
            markFocusTaskDone();
            break;
    }
};

/**
 * Keyboard: Esc ends (or closes if completed); Space toggles pause/resume
 * @param {KeyboardEvent} event
 */
const handleFocusOverlayKeydown = (event) => {
    if (!focusSession) return;
    const isCompleted = focusSession.status === 'completed';

    if (event.key === 'Escape') {
        event.preventDefault();
        if (isCompleted) {
            closeFocusOverlay();
        } else {
            endFocusSession();
        }
        return;
    }

    if (event.code === 'Space' || event.key === ' ') {
        // Avoid stealing space from buttons (let button activation happen natively)
        if (event.target.closest('button')) return;
        event.preventDefault();
        if (isCompleted) return;
        if (focusSession.status === 'running') {
            pauseFocusSession();
        } else if (focusSession.status === 'paused') {
            resumeFocusSession();
        }
    }
};

// ----------------------------------------
// Restore on page load
// ----------------------------------------

/**
 * Restores an in-progress or paused focus session on page load.
 * - running: fold in time elapsed since lastTickAt; if elapsed ≥ duration,
 *   mark completed (no overlay re-open); otherwise resume the overlay + tick
 * - paused: re-open the overlay in paused state, no tick
 * - completed: do not re-open the overlay (one-shot completion notice)
 */
const restoreFocusSession = () => {
    const saved = readFocusSession();
    if (!saved) return;

    // Validate shape
    if (typeof saved.todoId !== 'string'
        || typeof saved.duration !== 'number'
        || typeof saved.elapsedMs !== 'number'
        || (saved.status !== 'running' && saved.status !== 'paused' && saved.status !== 'completed')) {
        writeFocusSession(null);
        return;
    }

    const now = Date.now();

    if (saved.status === 'running') {
        const lastTick = typeof saved.lastTickAt === 'number' ? saved.lastTickAt : now;
        const advanced = Math.max(0, now - lastTick);
        const newElapsed = saved.elapsedMs + advanced;
        if (newElapsed >= saved.duration) {
            // Session completed while the tab was closed — do not re-open overlay
            const completed = {
                ...saved,
                elapsedMs: saved.duration,
                status: 'completed',
                lastTickAt: null
            };
            writeFocusSession(completed);
            return;
        }
        focusSession = {
            ...saved,
            elapsedMs: newElapsed,
            lastTickAt: now
        };
        focusLastPersistAt = now;
        writeFocusSession(focusSession);
        renderFocusOverlay();
        startFocusTick();
        showFocusRestoredToast();
        return;
    }

    if (saved.status === 'paused') {
        focusSession = { ...saved, lastTickAt: null };
        focusLastPersistAt = null;
        renderFocusOverlay();
        showFocusRestoredToast();
        return;
    }

    // status === 'completed' — leave it; overlay stays closed
};

/**
 * Shows a brief "session restored" toast
 */
let focusRestoredToastTimer = null;
const showFocusRestoredToast = () => {
    let toast = document.querySelector('.focus-restored-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'focus-restored-toast';
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
    }
    toast.textContent = t('focus.sessionRestored');
    toast.classList.add('show');
    if (focusRestoredToastTimer) clearTimeout(focusRestoredToastTimer);
    focusRestoredToastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
};

/**
 * Re-renders the focus overlay text when the language changes
 * (does not touch the timer state)
 */
const refreshFocusOverlayOnLangChange = () => {
    if (!focusSession) return;
    renderFocusOverlay();
};

// ========================================
// Smart Task Extraction (v4) — AI 草稿拆解
// 流程：用户输入自然语言 → POST /api/task-extractions → 展示可编辑草稿卡片
//       → 用户勾选并点"添加到今日" → 复用 v3 commit 管线写入工作区
// 不伪造不静默降级：失败时保留原始输入 + 真实错误消息
// ========================================

/**
 * 转义字符串以安全用作 HTML 属性值（在 escapeHtml 基础上再转义引号）
 * @param {string} text
 * @returns {string}
 */
const escapeAttr = (text) => escapeHtml(String(text ?? '')).replace(/"/g, '&quot;');

/**
 * 把草稿的 project 名称解析为 projectId：匹配已有项目则用其 id，
 * 否则在 state.projects 中新建（不 commit，由调用方统一 commit）
 * @param {string} projectName
 * @returns {string|null}
 */
const resolveProjectIdForDraft = (projectName) => {
    const trimmed = (projectName || '').trim();
    if (!trimmed) return null;
    const existing = state.projects.find(p => p.name === trimmed);
    if (existing) return existing.id;
    const newProject = {
        id: generateId(),
        name: trimmed.slice(0, PROJECT_NAME_MAX),
        createdAt: new Date().toISOString()
    };
    state.projects.push(newProject);
    return newProject.id;
};

/**
 * 设置智能拆解加载态：按钮 disabled + 文案切换
 * @param {boolean} loading
 */
const setExtractionLoading = (loading) => {
    state.extractionLoading = loading;
    const btn = elements.extractBtn;
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('is-loading', loading);
    btn.textContent = loading ? t('extraction.extracting') : t('extraction.action');
};

/**
 * 清空草稿区并隐藏
 */
const clearExtractionResults = () => {
    state.extractionDrafts = [];
    state.extractionError = null;
    elements.extractionResults.innerHTML = '';
    elements.extractionResults.classList.add('hidden');
};

/**
 * 构造单张草稿卡片 HTML（所有用户/模型字符串经 escapeHtml/escapeAttr）
 * @param {Object} draft - { id, selected, title, project, priority, dueDate, estimatedMinutes }
 * @param {number} index - 序号（用于 aria）
 * @returns {string}
 */
const createDraftCardHTML = (draft, index) => {
    const priorityOptions = ['high', 'medium', 'low'].map(p =>
        `<option value="${p}" ${draft.priority === p ? 'selected' : ''}>${t(`priority.${p}`)}</option>`
    ).join('');

    return `
        <li class="draft-card" data-draft-id="${escapeAttr(draft.id)}">
            <label class="draft-checkbox">
                <input
                    type="checkbox"
                    ${draft.selected ? 'checked' : ''}
                    data-draft-action="toggle"
                    aria-label="${t('aria.draftCheckbox')} ${index + 1}"
                >
                <span class="checkmark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </span>
            </label>
            <div class="draft-fields">
                <div class="draft-field draft-field-title">
                    <label class="draft-label">${t('extraction.draftTitle')}</label>
                    <input
                        type="text"
                        class="draft-input"
                        data-draft-field="title"
                        value="${escapeAttr(draft.title)}"
                        maxlength="150"
                        aria-label="${t('aria.draftTitleInput')}"
                    >
                </div>
                <div class="draft-field-grid">
                    <div class="draft-field">
                        <label class="draft-label">${t('extraction.draftProject')}</label>
                        <input
                            type="text"
                            class="draft-input"
                            data-draft-field="project"
                            value="${escapeAttr(draft.project)}"
                            maxlength="150"
                            aria-label="${t('aria.draftProjectInput')}"
                        >
                    </div>
                    <div class="draft-field">
                        <label class="draft-label">${t('extraction.draftPriority')}</label>
                        <select class="draft-select" data-draft-field="priority" aria-label="${t('aria.draftPrioritySelect')}">
                            ${priorityOptions}
                        </select>
                    </div>
                    <div class="draft-field">
                        <label class="draft-label">${t('extraction.draftDue')}</label>
                        <input
                            type="date"
                            class="draft-input"
                            data-draft-field="dueDate"
                            value="${escapeAttr(draft.dueDate || '')}"
                            aria-label="${t('aria.draftDueInput')}"
                        >
                    </div>
                    <div class="draft-field">
                        <label class="draft-label">${t('extraction.draftMinutes')}</label>
                        <input
                            type="number"
                            class="draft-input"
                            data-draft-field="estimatedMinutes"
                            value="${escapeAttr(draft.estimatedMinutes)}"
                            min="1"
                            max="600"
                            step="1"
                            aria-label="${t('aria.draftMinutesInput')}"
                        >
                    </div>
                </div>
            </div>
            <button
                type="button"
                class="draft-remove"
                data-draft-action="remove"
                aria-label="${t('aria.removeDraft')} ${index + 1}"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                </svg>
            </button>
        </li>
    `;
};

/**
 * 渲染草稿区：错误消息 / 草稿卡片列表 + 底部"添加到今日"按钮
 */
const renderExtractionResults = () => {
    const section = elements.extractionResults;

    if (state.extractionError) {
        section.innerHTML = `
            <div class="extraction-error" role="alert">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>${escapeHtml(state.extractionError)}</p>
            </div>
        `;
        section.classList.remove('hidden');
        return;
    }

    const drafts = state.extractionDrafts;
    if (!drafts || drafts.length === 0) {
        section.innerHTML = '';
        section.classList.add('hidden');
        return;
    }

    section.innerHTML = `
        <div class="extraction-header">
            <h3 class="extraction-title">${t('extraction.sectionTitle')}</h3>
            <p class="extraction-hint">${t('extraction.sectionHint')}</p>
        </div>
        <ul class="draft-list">
            ${drafts.map((draft, i) => createDraftCardHTML(draft, i)).join('')}
        </ul>
        <div class="extraction-footer">
            <button type="button" class="btn btn-extract-add" data-draft-action="add-selected" aria-label="${t('aria.addSelected')}">
                ${t('extraction.addSelected')}
            </button>
        </div>
    `;
    section.classList.remove('hidden');
};

/**
 * 触发智能拆解：读取输入 → 调用 API → 渲染草稿 / 错误
 * 失败时保留用户原始输入（不清空 #todoInput）
 */
const handleExtractClick = async () => {
    if (state.extractionLoading) return;

    const description = elements.todoInput.value.trim();
    if (!description) {
        showTransientPlaceholder('error.titleEmpty');
        elements.todoInput.focus();
        return;
    }

    clearExtractionResults();
    setExtractionLoading(true);

    try {
        const response = await fetch('/api/task-extractions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': currentLang === 'en' ? 'en' : 'zh'
            },
            body: JSON.stringify({ description })
        });

        const data = await response.json();

        if (!response.ok) {
            // 根据错误码选择最贴切的文案，绝不伪造草稿
            if (response.status === 503
                && data && data.error === 'MODEL_NOT_CONFIGURED') {
                state.extractionError = t('extraction.configMissing');
            } else {
                state.extractionError = t('extraction.error');
            }
            renderExtractionResults();
            return;
        }

        if (!data || !Array.isArray(data.tasks) || data.tasks.length === 0) {
            state.extractionError = t('extraction.empty');
            renderExtractionResults();
            return;
        }

        // 草稿默认全选
        state.extractionDrafts = data.tasks.map(task => ({
            id: generateId(),
            selected: true,
            title: task.title || '',
            project: task.project || '',
            priority: task.priority || 'medium',
            dueDate: task.dueDate || null,
            estimatedMinutes: task.estimatedMinutes || 25
        }));
        state.extractionError = null;
        renderExtractionResults();
    } catch (error) {
        // fetch 抛错（服务未启动 / 网络中断）→ 真实错误，保留原始输入
        console.error('Task extraction failed:', error);
        state.extractionError = t('extraction.networkError');
        renderExtractionResults();
    } finally {
        setExtractionLoading(false);
    }
};

/**
 * 草稿区点击事件委托：toggle / remove / add-selected
 * @param {Event} event
 */
const handleExtractionClick = (event) => {
    const actionEl = event.target.closest('[data-draft-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.draftAction;

    if (action === 'add-selected') {
        addSelectedDrafts();
        return;
    }

    const card = actionEl.closest('.draft-card');
    if (!card) return;
    const draftId = card.dataset.draftId;
    const draft = state.extractionDrafts.find(d => d.id === draftId);
    if (!draft) return;

    if (action === 'toggle') {
        draft.selected = !draft.selected;
        // checkbox 状态由浏览器切换，这里只同步数据；无需重渲染
    } else if (action === 'remove') {
        state.extractionDrafts = state.extractionDrafts.filter(d => d.id !== draftId);
        renderExtractionResults();
    }
};

/**
 * 草稿字段实时输入：直接更新草稿数据，不重渲染（保留焦点）
 * @param {Event} event
 */
const handleDraftFieldInput = (event) => {
    const fieldEl = event.target.closest('[data-draft-field]');
    if (!fieldEl) return;
    const card = fieldEl.closest('.draft-card');
    if (!card) return;
    const draft = state.extractionDrafts.find(d => d.id === card.dataset.draftId);
    if (!draft) return;

    const field = fieldEl.dataset.draftField;
    const value = fieldEl.value;
    if (field === 'estimatedMinutes') {
        const n = Number(value);
        draft.estimatedMinutes = (Number.isFinite(n) && n >= 1 && n <= 600) ? n : 25;
    } else if (field === 'dueDate') {
        draft.dueDate = value || null;
    } else if (field === 'priority') {
        draft.priority = ['high', 'medium', 'low'].includes(value) ? value : 'medium';
    } else {
        draft[field] = value;
    }
};

/**
 * 把勾选的草稿写入工作区（复用 v3 的 todo 结构 + commit 管线）
 * 项目名解析为 projectId（不存在则新建项目），写入后清空草稿区
 */
const addSelectedDrafts = () => {
    const selected = state.extractionDrafts.filter(d => d.selected);
    if (selected.length === 0) {
        showToast(t('extraction.noSelection'));
        return;
    }

    // 为每个草稿创建 todo（项目名→projectId，不存在则新建）
    selected.forEach(draft => {
        const projectId = resolveProjectIdForDraft(draft.project);
        state.todos.unshift({
            id: generateId(),
            text: draft.title.trim(),
            completed: false,
            createdAt: new Date().toISOString(),
            projectId,
            priority: draft.priority,
            dueDate: draft.dueDate,
            estimateMinutes: draft.estimatedMinutes,
            focused: false,
            completedAt: null
        });
    });

    commit();
    clearExtractionResults();
    elements.todoInput.value = '';
    elements.todoInput.focus();
};

// ========================================
// Account & Cloud Workspace (v5)
// 注册/登录/退出 + 云端任务展示
// 本地优先：未登录时 v4 行为完全不变；登录后云任务额外展示，不自动上传本地任务
// ========================================

/** 密码最小长度（与服务端保持一致） */
const AUTH_PASSWORD_MIN = 8;
/** 简单邮箱正则（与服务端粗校验对齐，最终以服务端为准） */
const AUTH_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 把服务端错误码映射成 i18n key
 * @param {string} code - 服务端返回的 error 字段
 * @returns {string} i18n key
 */
const authErrorKey = (code) => {
    switch (code) {
        case 'EMAIL_EXISTS': return 'account.errorEmailExists';
        case 'INVALID_CREDENTIALS': return 'account.errorInvalidCredentials';
        case 'INVALID_EMAIL': return 'account.errorEmailFormat';
        case 'PASSWORD_TOO_SHORT': return 'account.errorPasswordLength';
        case 'PASSWORD_MISMATCH': return 'account.errorPasswordMatch';
        default: return 'account.errorNetwork';
    }
};

/**
 * 在模态里显示一条错误文案（双语由 t() 处理）
 * @param {string} message - 已翻译的文案
 */
const showAuthError = (message) => {
    if (elements.authError) {
        elements.authError.textContent = message;
    }
};

/** 清空模态错误文案 */
const clearAuthError = () => {
    if (elements.authError) {
        elements.authError.textContent = '';
    }
};

/**
 * 切换模态 tab（登录 / 注册），同步表单与 aria
 * @param {string} tab - 'login' | 'register'
 */
const switchAuthTab = (tab) => {
    if (tab !== 'login' && tab !== 'register') return;
    state.authModalTab = tab;
    clearAuthError();

    elements.authTabs.forEach(btn => {
        const isActive = btn.dataset.authTab === tab;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive);
    });

    const isLogin = tab === 'login';
    elements.authLoginForm.classList.toggle('hidden', !isLogin);
    elements.authRegisterForm.classList.toggle('hidden', isLogin);

    // 把焦点放到刚显示的表单第一个输入框，方便键盘用户
    const firstInput = isLogin
        ? elements.authLoginForm.querySelector('input')
        : elements.authRegisterForm.querySelector('input');
    if (firstInput) firstInput.focus();
};

/**
 * 打开账号模态
 * @param {string} [tab='login'] - 初始 tab
 */
const openAuthModal = (tab = 'login') => {
    elements.authModal.classList.remove('hidden');
    switchAuthTab(tab);
};

/** 关闭账号模态并清空表单 */
const closeAuthModal = () => {
    elements.authModal.classList.add('hidden');
    elements.authLoginForm.reset();
    elements.authRegisterForm.reset();
    clearAuthError();
};

/**
 * 客户端基本校验，返回第一个错误的 i18n key，否则 null
 * @param {string} mode - 'login' | 'register'
 * @param {Object} fields - { email, password, confirmPassword? }
 * @returns {string|null}
 */
const validateAuthFields = (mode, fields) => {
    if (!AUTH_EMAIL_RE.test(fields.email)) {
        return 'account.errorEmailFormat';
    }
    if (fields.password.length < AUTH_PASSWORD_MIN) {
        return 'account.errorPasswordLength';
    }
    if (mode === 'register' && fields.password !== fields.confirmPassword) {
        return 'account.errorPasswordMatch';
    }
    return null;
};

/**
 * 处理登录/注册表单提交
 * 成功 → 设登录态 + 拉云任务 + 关模态 + toast
 * 失败 → 显示错误（双语）
 * @param {Event} event
 */
const handleAuthSubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const mode = form.dataset.authMode;
    if (mode !== 'login' && mode !== 'register') return;
    if (state.auth.loading) return;

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const confirmPassword = mode === 'register'
        ? form.elements.confirmPassword.value
        : undefined;

    const errorKey = validateAuthFields(mode, { email, password, confirmPassword });
    if (errorKey) {
        showAuthError(t(errorKey));
        return;
    }

    clearAuthError();
    state.auth.loading = true;
    const submitBtn = form.querySelector('.auth-submit');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const response = await fetch(`/api/auth/${mode}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': currentLang === 'en' ? 'en' : 'zh'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data || !data.user) {
            const code = data && data.error ? data.error : 'NETWORK';
            showAuthError(t(authErrorKey(code)));
            return;
        }

        state.auth.user = data.user;
        updateAuthUI();
        closeAuthModal();
        showToast(t(mode === 'login' ? 'account.loginSuccess' : 'account.registerSuccess'));
        await fetchCloudTasks();
    } catch (error) {
        console.error('Auth request failed:', error);
        showAuthError(t('account.errorNetwork'));
    } finally {
        state.auth.loading = false;
        if (submitBtn) submitBtn.disabled = false;
    }
};

/**
 * 退出登录：POST /api/auth/logout → 清登录态 + 清云任务 + 更新页头
 */
const handleLogout = async () => {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Accept-Language': currentLang === 'en' ? 'en' : 'zh' }
        });
    } catch (error) {
        // 即使请求失败也清本地态，避免卡在登录态
        console.error('Logout request failed:', error);
    }
    state.auth.user = null;
    state.cloudTasks = [];
    // v6: 退出时关闭同步确认卡并重置同步态
    state.sync.confirming = false;
    state.sync.loading = false;
    state.sync.error = null;
    elements.syncConfirmCard.classList.add('hidden');
    if (elements.syncError) elements.syncError.textContent = '';
    updateAuthUI();
    renderCloudWorkspace();
    showToast(t('account.logoutSuccess'));
};

/**
 * 拉取云端任务：GET /api/cloud/tasks → state.cloudTasks → renderCloudWorkspace
 * 未登录时不调用
 */
const fetchCloudTasks = async () => {
    if (!state.auth.user) return;
    try {
        const response = await fetch('/api/cloud/tasks', {
            headers: { 'Accept-Language': currentLang === 'en' ? 'en' : 'zh' }
        });
        if (!response.ok) {
            // 401 → 会话失效，清登录态
            if (response.status === 401) {
                state.auth.user = null;
                state.cloudTasks = [];
                updateAuthUI();
                renderCloudWorkspace();
            }
            return;
        }
        const data = await response.json().catch(() => ({ tasks: [] }));
        state.cloudTasks = Array.isArray(data.tasks) ? data.tasks : [];
        renderCloudWorkspace();
    } catch (error) {
        console.error('Fetch cloud tasks failed:', error);
    }
};

/**
 * 切换云端任务完成状态：PUT /api/cloud/tasks/:id
 * @param {string} taskId
 */
const toggleCloudTask = async (taskId) => {
    const task = state.cloudTasks.find(t => t.id === taskId);
    if (!task) return;
    const nextCompleted = !task.completed;

    // 乐观更新
    task.completed = nextCompleted;
    task.completedAt = nextCompleted ? new Date().toISOString() : null;
    renderCloudWorkspace();

    try {
        const response = await fetch(`/api/cloud/tasks/${encodeURIComponent(taskId)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': currentLang === 'en' ? 'en' : 'zh'
            },
            body: JSON.stringify({ completed: nextCompleted })
        });
        if (!response.ok) {
            // 回滚
            task.completed = !nextCompleted;
            task.completedAt = nextCompleted ? null : new Date().toISOString();
            renderCloudWorkspace();
            return;
        }
        const data = await response.json().catch(() => null);
        if (data && data.task) {
            // 用服务端返回的最新值替换
            const idx = state.cloudTasks.findIndex(t => t.id === taskId);
            if (idx !== -1) state.cloudTasks[idx] = data.task;
            renderCloudWorkspace();
        }
    } catch (error) {
        console.error('Toggle cloud task failed:', error);
        task.completed = !nextCompleted;
        task.completedAt = nextCompleted ? null : new Date().toISOString();
        renderCloudWorkspace();
    }
};

/**
 * 删除云端任务：DELETE /api/cloud/tasks/:id
 * @param {string} taskId
 */
const deleteCloudTask = async (taskId) => {
    const task = state.cloudTasks.find(t => t.id === taskId);
    if (!task) return;

    // 乐观移除
    state.cloudTasks = state.cloudTasks.filter(t => t.id !== taskId);
    renderCloudWorkspace();

    try {
        const response = await fetch(`/api/cloud/tasks/${encodeURIComponent(taskId)}`, {
            method: 'DELETE',
            headers: { 'Accept-Language': currentLang === 'en' ? 'en' : 'zh' }
        });
        if (!response.ok && response.status !== 404) {
            // 失败（非 404）→ 回滚
            state.cloudTasks.push(task);
            renderCloudWorkspace();
        }
    } catch (error) {
        console.error('Delete cloud task failed:', error);
        state.cloudTasks.push(task);
        renderCloudWorkspace();
    }
};

/**
 * 构造单条云端任务 HTML（用户字符串经 escapeHtml/escapeAttr）
 * @param {Object} task - 云任务
 * @returns {string}
 */
const createCloudTaskHTML = (task) => {
    const priority = task.priority || 'medium';
    const priorityLabel = t(`priority.${priority}`);
    return `
        <li class="cloud-task-item ${task.completed ? 'is-completed' : ''}" data-id="${escapeAttr(task.id)}">
            <button type="button"
                class="cloud-task-checkbox ${task.completed ? 'is-checked' : ''}"
                data-cloud-action="toggle"
                aria-pressed="${task.completed}"
                aria-label="${task.completed ? t('aria.markNotCompleted') : t('aria.markCompleted')}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </button>
            <span class="cloud-task-text">${escapeHtml(task.text || '')}</span>
            <span class="cloud-task-meta">
                <span class="cloud-task-badge priority-${escapeAttr(priority)}">${escapeHtml(priorityLabel)}</span>
            </span>
            <button type="button"
                class="cloud-task-delete"
                data-cloud-action="delete"
                aria-label="${t('aria.delete')}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                </svg>
            </button>
        </li>
    `;
};

/**
 * 渲染云端工作区：未登录不展示；登录后展示云任务列表
 * 区分 Local/Cloud：本地任务在主列表，云任务在此列表
 */
const renderCloudWorkspace = () => {
    if (!state.auth.user) {
        elements.cloudWorkspaceSection.classList.add('hidden');
        elements.cloudTaskList.innerHTML = '';
        renderSyncEntry();
        return;
    }

    elements.cloudWorkspaceSection.classList.remove('hidden');

    if (state.cloudTasks.length === 0) {
        elements.cloudTaskList.innerHTML = `<li class="cloud-empty">${t('account.noCloudTasks')}</li>`;
        renderSyncEntry();
        return;
    }

    elements.cloudTaskList.innerHTML = state.cloudTasks.map(createCloudTaskHTML).join('');
    renderSyncEntry();
};

/**
 * 更新页头账号入口：未登录显示"登录以同步"，登录显示邮箱 + 退出按钮
 * 邮箱写入 DOM 前 escapeHtml
 */
const updateAuthUI = () => {
    const user = state.auth.user;
    if (user) {
        elements.authBtn.classList.add('is-signed-in');
        // 邮箱经 escapeHtml 防 XSS；textContent 也安全，但保持一致用 innerHTML
        elements.authBtn.textContent = user.email || '';
        elements.authLogoutBtn.classList.remove('hidden');
    } else {
        elements.authBtn.classList.remove('is-signed-in');
        elements.authBtn.textContent = t('account.signInToSync');
        elements.authLogoutBtn.classList.add('hidden');
    }
    // v6: 登录态变化时同步入口可见性也变化
    renderSyncEntry();
};

/**
 * 模态点击委托：close 按钮 / tab 切换
 * @param {Event} event
 */
const handleAuthModalClick = (event) => {
    // 点遮罩空白处关闭
    if (event.target === elements.authModal) {
        closeAuthModal();
        return;
    }

    const closeBtn = event.target.closest('[data-auth-action="close"]');
    if (closeBtn) {
        closeAuthModal();
        return;
    }

    const tabBtn = event.target.closest('[data-auth-tab]');
    if (tabBtn) {
        switchAuthTab(tabBtn.dataset.authTab);
    }
};

/**
 * 模态键盘：Escape 关闭
 * @param {KeyboardEvent} event
 */
const handleAuthModalKeydown = (event) => {
    if (event.key !== 'Escape') return;
    if (!elements.authModal.classList.contains('hidden')) {
        event.preventDefault();
        closeAuthModal();
    }
};

/**
 * 云任务列表点击委托：toggle / delete
 * @param {Event} event
 */
const handleCloudTaskClick = (event) => {
    const actionEl = event.target.closest('[data-cloud-action]');
    if (!actionEl) return;
    const item = actionEl.closest('.cloud-task-item');
    if (!item) return;
    const taskId = item.dataset.id;
    const action = actionEl.dataset.cloudAction;
    if (action === 'toggle') {
        toggleCloudTask(taskId);
    } else if (action === 'delete') {
        deleteCloudTask(taskId);
    }
};

// ========================================
// v6 Local-to-Cloud Sync
// 显式同步 + 追加合并 + 不可变 ID 去重 + 服务端幂等 + 不删本地
// ========================================

/**
 * 是否应展示同步入口：已登录且本地有任务
 * @returns {boolean}
 */
const canSync = () => !!state.auth.user && state.todos.length > 0;

/**
 * 根据登录态与本地任务数量切换同步按钮可见性
 * 在 commit / renderAll / updateAuthUI / renderCloudWorkspace 中调用
 */
const renderSyncEntry = () => {
    if (!elements.syncBtn) return;
    elements.syncBtn.classList.toggle('hidden', !canSync());
};

/**
 * 打开同步确认卡：展示即将同步的本地任务数量，未确认不上传
 */
const openSyncConfirm = () => {
    if (!canSync()) return;
    if (state.sync.loading) return;
    state.sync.confirming = true;
    state.sync.error = null;
    if (elements.syncError) elements.syncError.textContent = '';
    if (elements.syncConfirmHint) {
        elements.syncConfirmHint.textContent = t('sync.confirmHint', { n: state.todos.length });
    }
    elements.syncConfirmCard.classList.remove('hidden');
    // 聚焦确认按钮，方便键盘用户
    if (elements.syncConfirmBtn) elements.syncConfirmBtn.focus();
};

/**
 * 关闭同步确认卡并清空错误态（不中断进行中的请求）
 */
const closeSyncConfirm = () => {
    if (state.sync.loading) return; // 同步进行中不允许关闭
    state.sync.confirming = false;
    state.sync.error = null;
    elements.syncConfirmCard.classList.add('hidden');
    if (elements.syncError) elements.syncError.textContent = '';
};

/**
 * 在确认卡里显示一条错误文案（双语由 t() 处理）
 * @param {string} message - 已翻译的文案
 */
const showSyncError = (message) => {
    if (elements.syncError) elements.syncError.textContent = message;
};

/**
 * 执行同步：POST /api/cloud/sync { tasks: state.todos }
 * - 成功：不删本地任务，展示双语结果反馈，刷新云端工作区，关闭确认卡
 * - 失败：展示错误（双语），保留确认卡可重试
 */
const performSync = async () => {
    if (!canSync()) return;
    if (state.sync.loading) return;

    state.sync.loading = true;
    if (elements.syncConfirmBtn) elements.syncConfirmBtn.disabled = true;
    if (elements.syncCancelBtn) elements.syncCancelBtn.disabled = true;
    if (elements.syncConfirmBtn) elements.syncConfirmBtn.textContent = t('sync.syncing');
    showSyncError('');

    try {
        const response = await fetch('/api/cloud/sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept-Language': currentLang === 'en' ? 'en' : 'zh'
            },
            body: JSON.stringify({ tasks: state.todos })
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data) {
            const code = data && data.error ? data.error : 'NETWORK';
            showSyncError(t(code === 'UNAUTHORIZED' ? 'account.errorInvalidCredentials' : 'sync.error'));
            return;
        }

        // 成功：双语结果反馈（不删本地任务）
        showToast(t('sync.successDetail', {
            added: data.added ?? 0,
            skipped: data.skipped ?? 0,
            total: data.total ?? 0
        }));

        // 关闭确认卡
        state.sync.confirming = false;
        state.sync.error = null;
        elements.syncConfirmCard.classList.add('hidden');
        if (elements.syncError) elements.syncError.textContent = '';

        // 刷新云端工作区列表
        await fetchCloudTasks();
    } catch (error) {
        console.error('Sync request failed:', error);
        showSyncError(t('sync.errorNetwork'));
    } finally {
        state.sync.loading = false;
        if (elements.syncConfirmBtn) {
            elements.syncConfirmBtn.disabled = false;
            elements.syncConfirmBtn.textContent = t('sync.confirm');
        }
        if (elements.syncCancelBtn) elements.syncCancelBtn.disabled = false;
    }
};

/**
 * 同步确认卡点击委托：close / cancel / confirm
 * @param {Event} event
 */
const handleSyncConfirmClick = (event) => {
    const actionEl = event.target.closest('[data-sync-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.syncAction;
    if (action === 'close' || action === 'cancel') {
        closeSyncConfirm();
    } else if (action === 'confirm') {
        performSync();
    }
};

/**
 * 同步确认卡键盘：Escape 关闭（同步进行中除外）
 * @param {KeyboardEvent} event
 */
const handleSyncConfirmKeydown = (event) => {
    if (event.key !== 'Escape') return;
    if (!elements.syncConfirmCard.classList.contains('hidden')) {
        event.preventDefault();
        closeSyncConfirm();
    }
};

/**
 * 同步按钮点击：打开确认卡
 */
const handleSyncBtnClick = () => {
    openSyncConfirm();
};

/**
 * 初始化账号模块：GET /api/auth/me → 若登录设 state.auth.user + 拉云任务 + 更新页头
 * 未登录保持本地优先（v4 行为不变）
 */
const initAuth = async () => {
    mountAuthModalAtDocumentRoot();
    updateAuthUI();

    // 静态绑定事件（一次性）
    elements.authBtn.addEventListener('click', () => {
        if (state.auth.user) {
            // 已登录时点击邮箱也打开模态（可在模态里退出）
            openAuthModal('login');
        } else {
            openAuthModal('login');
        }
    });
    elements.authLogoutBtn.addEventListener('click', handleLogout);
    elements.authModal.addEventListener('click', handleAuthModalClick);
    elements.authModal.addEventListener('keydown', handleAuthModalKeydown);
    elements.authLoginForm.addEventListener('submit', handleAuthSubmit);
    elements.authRegisterForm.addEventListener('submit', handleAuthSubmit);
    elements.cloudTaskList.addEventListener('click', handleCloudTaskClick);

    // v6 Sync: 同步入口 + 确认卡
    elements.syncBtn.addEventListener('click', handleSyncBtnClick);
    elements.syncConfirmCard.addEventListener('click', handleSyncConfirmClick);
    elements.syncConfirmCard.addEventListener('keydown', handleSyncConfirmKeydown);

    // 页面加载时探测登录态（非阻断：失败按未登录处理，本地优先）
    try {
        const response = await fetch('/api/auth/me', {
            headers: { 'Accept-Language': currentLang === 'en' ? 'en' : 'zh' }
        });
        if (!response.ok) return;
        const data = await response.json().catch(() => null);
        if (data && data.user) {
            state.auth.user = data.user;
            updateAuthUI();
            await fetchCloudTasks();
        }
    } catch (error) {
        // 服务未启动 / 网络错误 → 静默按未登录处理，本地工作区照常可用
        console.error('Auth probe failed:', error);
    }
};

/**
 * 语言切换时重渲染账号入口、云端工作区与同步确认卡动态文案
 */
const refreshAuthOnLangChange = () => {
    updateAuthUI();
    renderCloudWorkspace();
    // v6: 确认卡 hint 是 JS 动态设置的，语言切换时需刷新
    if (elements.syncConfirmHint && state.sync.confirming) {
        elements.syncConfirmHint.textContent = t('sync.confirmHint', { n: state.todos.length });
    }
    // 同步按钮文案在 loading 时被改为 "同步中…"，语言切换时按当前态恢复
    if (elements.syncConfirmBtn) {
        elements.syncConfirmBtn.textContent = state.sync.loading ? t('sync.syncing') : t('sync.confirm');
    }
};

// ========================================
// Initialization
// ========================================

/**
 * Initializes the application
 */
const init = () => {
    // Initialize i18n (restores saved language, applies static translations)
    initI18n();

    // Load workspace from localStorage (read-time migration only, no write-back)
    const workspace = loadWorkspace();
    state.todos = workspace.todos;
    state.projects = workspace.projects;

    // Initial render
    renderAll();

    // Re-render dynamic texts when the language changes;
    // the open form is re-rendered with the user's draft preserved
    document.addEventListener('languagechange', () => {
        renderAll();
        rerenderFormPreservingDraft();
        refreshFocusOverlayOnLangChange();
        renderExtractionResults();
        refreshAuthOnLangChange();
    });

    // Attach event listeners (container-level delegation, one listener each)
    elements.todoForm.addEventListener('submit', handleQuickFormSubmit);
    elements.openDetailForm.addEventListener('click', openDetailForm);
    elements.extractBtn.addEventListener('click', handleExtractClick);
    elements.mainColumn.addEventListener('submit', handleMainSubmit);
    elements.mainColumn.addEventListener('keydown', handleFormKeydown);
    elements.mainColumn.addEventListener('click', handleFormActionClick);
    elements.todoList.addEventListener('click', handleCardClick);
    elements.focusPanel.addEventListener('click', handleCardClick);
    elements.extractionResults.addEventListener('click', handleExtractionClick);
    elements.extractionResults.addEventListener('input', handleDraftFieldInput);
    elements.extractionResults.addEventListener('change', handleDraftFieldInput);
    elements.todoList.addEventListener('dragover', handleDragOver);
    elements.todoList.addEventListener('dragleave', handleDragLeave);
    elements.todoList.addEventListener('drop', handleDrop);
    elements.navEntryList.addEventListener('click', handleProjectNavClick);
    elements.projectForm.addEventListener('submit', handleProjectFormSubmit);
    elements.clearCompleted.addEventListener('click', clearCompleted);

    // Filter buttons
    elements.filterButtons.forEach(btn => {
        btn.addEventListener('click', handleFilterClick);
    });

    // v3 Focus Flow: restore any in-progress session, then focus the input
    restoreFocusSession();

    // v5 Account & Cloud Workspace: probe login state (non-blocking, local-first)
    initAuth();

    // Focus the input
    elements.todoInput.focus();
};

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', init);
