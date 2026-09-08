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
    formError: null
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
    insightHighOpen: document.getElementById('insightHighOpen')
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
    });

    // Attach event listeners (container-level delegation, one listener each)
    elements.todoForm.addEventListener('submit', handleQuickFormSubmit);
    elements.openDetailForm.addEventListener('click', openDetailForm);
    elements.mainColumn.addEventListener('submit', handleMainSubmit);
    elements.mainColumn.addEventListener('keydown', handleFormKeydown);
    elements.mainColumn.addEventListener('click', handleFormActionClick);
    elements.todoList.addEventListener('click', handleCardClick);
    elements.focusPanel.addEventListener('click', handleCardClick);
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

    // Focus the input
    elements.todoInput.focus();
};

// Initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', init);
