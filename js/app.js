/**
 * Simple To-Do List Application
 * CRUD islemleri ve localStorage ile kalici veri saklama
 * 
 * @author GitHub Bootcamp
 * @version 1.0.0
 */

// ========================================
// State Management
// ========================================

/**
 * Uygulama durumu
 * @type {Object}
 */
const state = {
    todos: [],
    currentFilter: 'all',
    editingId: null
};

// Local Storage key
const STORAGE_KEY = 'simple-todo-list';

// ========================================
// DOM Elements
// ========================================

const elements = {
    todoForm: document.getElementById('todoForm'),
    todoInput: document.getElementById('todoInput'),
    todoList: document.getElementById('todoList'),
    todoCount: document.getElementById('todoCount'),
    emptyState: document.getElementById('emptyState'),
    clearCompleted: document.getElementById('clearCompleted'),
    filterButtons: document.querySelectorAll('.filter-btn')
};

// ========================================
// Local Storage Functions
// ========================================

/**
 * Verileri localStorage'dan yukler
 * @returns {Array} Todo listesi
 */
const loadFromStorage = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('LocalStorage okuma hatasi:', error);
        return [];
    }
};

/**
 * Verileri localStorage'a kaydeder
 * @param {Array} todos - Todo listesi
 */
const saveToStorage = (todos) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch (error) {
        console.error('LocalStorage yazma hatasi:', error);
    }
};

// ========================================
// CRUD Operations
// ========================================

/**
 * Benzersiz ID olusturur
 * @returns {string} Benzersiz ID
 */
const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

/**
 * Yeni todo ekler
 * @param {string} text - Todo metni
 */
const addTodo = (text) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    const newTodo = {
        id: generateId(),
        text: trimmedText,
        completed: false,
        createdAt: new Date().toISOString()
    };

    state.todos.unshift(newTodo);
    saveToStorage(state.todos);
    renderTodos();
    updateStats();
};

/**
 * Todo siler
 * @param {string} id - Silinecek todo ID'si
 */
const deleteTodo = (id) => {
    const todoElement = document.querySelector(`[data-id="${id}"]`);
    
    if (todoElement) {
        todoElement.style.animation = 'slideOut 0.3s ease forwards';
        
        setTimeout(() => {
            state.todos = state.todos.filter(todo => todo.id !== id);
            saveToStorage(state.todos);
            renderTodos();
            updateStats();
        }, 300);
    }
};

/**
 * Todo tamamlama durumunu degistirir
 * @param {string} id - Todo ID'si
 */
const toggleTodo = (id) => {
    const todo = state.todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        saveToStorage(state.todos);
        renderTodos();
        updateStats();
    }
};

/**
 * Todo duzenleme moduna gecer
 * @param {string} id - Todo ID'si
 */
const startEditTodo = (id) => {
    state.editingId = id;
    renderTodos();
    
    // Input'a focus ver
    const editInput = document.querySelector('.todo-edit-input');
    if (editInput) {
        editInput.focus();
        editInput.setSelectionRange(editInput.value.length, editInput.value.length);
    }
};

/**
 * Todo duzenlemeyi kaydeder
 * @param {string} id - Todo ID'si
 * @param {string} newText - Yeni metin
 */
const saveEditTodo = (id, newText) => {
    const trimmedText = newText.trim();
    if (!trimmedText) {
        cancelEditTodo();
        return;
    }

    const todo = state.todos.find(t => t.id === id);
    if (todo) {
        todo.text = trimmedText;
        saveToStorage(state.todos);
    }
    
    state.editingId = null;
    renderTodos();
};

/**
 * Todo duzenlemeyi iptal eder
 */
const cancelEditTodo = () => {
    state.editingId = null;
    renderTodos();
};

/**
 * Tamamlanan todolari siler
 */
const clearCompleted = () => {
    const completedItems = document.querySelectorAll('.todo-item.completed');
    
    completedItems.forEach((item, index) => {
        setTimeout(() => {
            item.style.animation = 'slideOut 0.3s ease forwards';
        }, index * 50);
    });

    setTimeout(() => {
        state.todos = state.todos.filter(todo => !todo.completed);
        saveToStorage(state.todos);
        renderTodos();
        updateStats();
    }, completedItems.length * 50 + 300);
};

// ========================================
// Filter Functions
// ========================================

/**
 * Filtreyi degistirir
 * @param {string} filter - Filtre tipi (all, active, completed)
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

/**
 * Filtrelenmis todolari getirir
 * @returns {Array} Filtrelenmis todo listesi
 */
const getFilteredTodos = () => {
    switch (state.currentFilter) {
        case 'active':
            return state.todos.filter(todo => !todo.completed);
        case 'completed':
            return state.todos.filter(todo => todo.completed);
        default:
            return state.todos;
    }
};

// ========================================
// Drag and Drop Functions
// ========================================

// Suruklenen todo'nun ID'si (DOM indeksi yerine ID kullaniyoruz; boylece
// filtre aktifken de dogru ogeyi tasiriz)
let draggedId = null;

/**
 * Suruklenen ogedeki gorsel geri bildirimi temizler
 */
const clearDragIndicators = () => {
    elements.todoList.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
};

/**
 * Drag basladiginda
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
 * Drag sirasinda element uzerinde
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
 * Drag element disina ciktiginda
 * @param {DragEvent} event
 */
const handleDragLeave = (event) => {
    const todoItem = event.target.closest('.todo-item');
    if (todoItem) {
        todoItem.classList.remove('drag-over-top', 'drag-over-bottom');
    }
};

/**
 * Drop yapildiginda - state.todos'u ID'ler uzerinden yeniden siralar
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

    saveToStorage(state.todos);
    renderTodos();
    clearDragIndicators();
};

/**
 * Drag bittiginde tum gorsel durumlari temizler
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
// Render Functions
// ========================================

/**
 * Todo item HTML'i olusturur
 * @param {Object} todo - Todo objesi
 * @returns {string} HTML string
 */
const createTodoItemHTML = (todo) => {
    const isEditing = state.editingId === todo.id;
    
    if (isEditing) {
        return `
            <li class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
                <input 
                    type="text" 
                    class="todo-edit-input" 
                    value="${escapeHtml(todo.text)}"
                    aria-label="Görevi düzenle"
                >
                <div class="todo-actions" style="opacity: 1;">
                    <button class="todo-action-btn save" data-action="save" aria-label="Kaydet">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                    <button class="todo-action-btn cancel" data-action="cancel" aria-label="İptal">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </li>
        `;
    }
    
    return `
        <li class="todo-item ${todo.completed ? 'completed' : ''}" 
            data-id="${todo.id}" 
            draggable="true"
            aria-label="${escapeHtml(todo.text)}, ${todo.completed ? 'tamamlandı' : 'aktif'}">
            <div class="drag-handle" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="5" r="1"></circle>
                    <circle cx="9" cy="12" r="1"></circle>
                    <circle cx="9" cy="19" r="1"></circle>
                    <circle cx="15" cy="5" r="1"></circle>
                    <circle cx="15" cy="12" r="1"></circle>
                    <circle cx="15" cy="19" r="1"></circle>
                </svg>
            </div>
            <label class="todo-checkbox">
                <input 
                    type="checkbox" 
                    ${todo.completed ? 'checked' : ''} 
                    data-action="toggle"
                    aria-label="${todo.completed ? 'Tamamlanmadı olarak işaretle' : 'Tamamlandı olarak işaretle'}"
                >
                <span class="checkmark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </span>
            </label>
            <span class="todo-text">${escapeHtml(todo.text)}</span>
            <div class="todo-actions">
                <button class="todo-action-btn edit" data-action="edit" aria-label="Düzenle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="todo-action-btn delete" data-action="delete" aria-label="Sil">
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
 * HTML karakterlerini escape eder (XSS koruması)
 * @param {string} text - Escape edilecek metin
 * @returns {string} Escape edilmis metin
 */
const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

/**
 * Todo listesini render eder
 */
const renderTodos = () => {
    const filteredTodos = getFilteredTodos();
    
    if (filteredTodos.length === 0) {
        elements.todoList.innerHTML = '';
        elements.emptyState.classList.add('show');
    } else {
        elements.emptyState.classList.remove('show');
        elements.todoList.innerHTML = filteredTodos.map(createTodoItemHTML).join('');
        
        // Drag and drop event listener'larini ekle
        elements.todoList.querySelectorAll('.todo-item').forEach(item => {
            item.addEventListener('dragstart', handleDragStart);
            item.addEventListener('dragend', handleDragEnd);
        });
    }
};

/**
 * Istatistikleri gunceller
 */
const updateStats = () => {
    const total = state.todos.length;
    const active = state.todos.filter(t => !t.completed).length;
    const completed = state.todos.filter(t => t.completed).length;
    
    // Gorev sayisini guncelle
    let countText = '';
    switch (state.currentFilter) {
        case 'active':
            countText = `${active} aktif görev`;
            break;
        case 'completed':
            countText = `${completed} tamamlanan`;
            break;
        default:
            countText = `${total} görev`;
    }
    elements.todoCount.textContent = countText;
    
    // "Tamamlananlari Temizle" butonunu goster/gizle
    if (completed > 0) {
        elements.clearCompleted.classList.add('show');
    } else {
        elements.clearCompleted.classList.remove('show');
    }
};

// ========================================
// Event Handlers
// ========================================

/**
 * Form submit handler
 * @param {Event} event
 */
const handleFormSubmit = (event) => {
    event.preventDefault();
    const text = elements.todoInput.value;
    addTodo(text);
    elements.todoInput.value = '';
    elements.todoInput.focus();
};

/**
 * Todo list click handler (event delegation)
 * @param {Event} event
 */
const handleTodoListClick = (event) => {
    const target = event.target;
    const todoItem = target.closest('.todo-item');
    if (!todoItem) return;
    
    const todoId = todoItem.dataset.id;
    const action = target.closest('[data-action]')?.dataset.action;
    
    switch (action) {
        case 'toggle':
            toggleTodo(todoId);
            break;
        case 'delete':
            deleteTodo(todoId);
            break;
        case 'edit':
            startEditTodo(todoId);
            break;
        case 'save':
            const editInput = todoItem.querySelector('.todo-edit-input');
            if (editInput) {
                saveEditTodo(todoId, editInput.value);
            }
            break;
        case 'cancel':
            cancelEditTodo();
            break;
    }
};

/**
 * Edit input keyboard handler
 * @param {KeyboardEvent} event
 */
const handleEditKeydown = (event) => {
    if (event.target.classList.contains('todo-edit-input')) {
        const todoItem = event.target.closest('.todo-item');
        const todoId = todoItem?.dataset.id;
        
        if (event.key === 'Enter') {
            event.preventDefault();
            saveEditTodo(todoId, event.target.value);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelEditTodo();
        }
    }
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
 * Uygulamayi baslatir
 */
const init = () => {
    // LocalStorage'dan verileri yukle
    state.todos = loadFromStorage();
    
    // Ilk render
    renderTodos();
    updateStats();
    
    // Event listener'lari ekle
    elements.todoForm.addEventListener('submit', handleFormSubmit);
    elements.todoList.addEventListener('click', handleTodoListClick);
    elements.todoList.addEventListener('keydown', handleEditKeydown);
    elements.todoList.addEventListener('dragover', handleDragOver);
    elements.todoList.addEventListener('dragleave', handleDragLeave);
    elements.todoList.addEventListener('drop', handleDrop);
    elements.clearCompleted.addEventListener('click', clearCompleted);
    
    // Filtre butonlari
    elements.filterButtons.forEach(btn => {
        btn.addEventListener('click', handleFilterClick);
    });
    
    // Input'a focus
    elements.todoInput.focus();
};

// DOM hazir oldugunda baslat
document.addEventListener('DOMContentLoaded', init);
