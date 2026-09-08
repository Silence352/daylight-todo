/**
 * Daylight To-Do — i18n Module
 * Zero-dependency lightweight i18n: zh/en dictionaries,
 * data-i18n attribute replacement, localStorage persistence
 *
 * Usage:
 *   - Static texts: add data-i18n / data-i18n-placeholder / data-i18n-aria
 *     attributes in HTML, then call applyI18n() after language switch
 *   - Dynamic texts: call t(key, params) in JS
 */

// Local Storage key for language preference
const I18N_STORAGE_KEY = 'daylight-lang';

/**
 * Message dictionaries
 * @type {Object<string, Object<string, string>>}
 */
const I18N_MESSAGES = {
    zh: {
        'meta.title': '待办 · 晨光',
        'app.title': '待办',
        'app.subtitle': '规划你的任务，从容开启每一天。',
        'placeholder.addTask': '添加新任务…',
        'btn.add': '添加',
        'filter.all': '全部',
        'filter.active': '进行中',
        'filter.completed': '已完成',
        'empty.text': '还没有任务',
        'empty.hint': '在上方输入框写下你的第一个任务吧',
        'btn.clearCompleted': '清除已完成',
        'stats.tasks': '{n} 项任务',
        'stats.taskOne': '{n} 项任务',
        'stats.active': '{n} 项进行中',
        'stats.completed': '{n} 项已完成',
        'aria.addInput': '添加新任务',
        'aria.add': '添加任务',
        'aria.filters': '任务筛选',
        'aria.todoList': '任务列表',
        'aria.langSwitch': '切换语言',
        'aria.clearCompleted': '清除已完成任务',
        'aria.editTask': '编辑任务',
        'aria.save': '保存',
        'aria.cancel': '取消',
        'aria.edit': '编辑',
        'aria.delete': '删除',
        'aria.markCompleted': '标记为已完成',
        'aria.markNotCompleted': '标记为未完成',
        'aria.itemCompleted': '已完成',
        'aria.itemActive': '进行中'
    },
    en: {
        'meta.title': 'Daylight To-Do',
        'app.title': 'To-Do',
        'app.subtitle': 'Organize your tasks, stay productive.',
        'placeholder.addTask': 'Add a new task...',
        'btn.add': 'Add',
        'filter.all': 'All',
        'filter.active': 'Active',
        'filter.completed': 'Completed',
        'empty.text': 'No tasks yet',
        'empty.hint': 'Type in the field above to add your first task',
        'btn.clearCompleted': 'Clear Completed',
        'stats.tasks': '{n} tasks',
        'stats.taskOne': '{n} task',
        'stats.active': '{n} active',
        'stats.completed': '{n} completed',
        'aria.addInput': 'Add a new task',
        'aria.add': 'Add task',
        'aria.filters': 'Task filters',
        'aria.todoList': 'Task list',
        'aria.langSwitch': 'Switch language',
        'aria.clearCompleted': 'Clear completed tasks',
        'aria.editTask': 'Edit task',
        'aria.save': 'Save',
        'aria.cancel': 'Cancel',
        'aria.edit': 'Edit',
        'aria.delete': 'Delete',
        'aria.markCompleted': 'Mark as completed',
        'aria.markNotCompleted': 'Mark as not completed',
        'aria.itemCompleted': 'completed',
        'aria.itemActive': 'active'
    }
};

/**
 * Current language
 * @type {string}
 */
let currentLang = 'zh';

/**
 * Translates a key with optional interpolation
 * @param {string} key - Message key
 * @param {Object} [params] - Interpolation params, e.g. { n: 3 }
 * @returns {string} Translated text
 */
const t = (key, params) => {
    const dict = I18N_MESSAGES[currentLang] || I18N_MESSAGES.zh;
    let text = dict[key] ?? I18N_MESSAGES.zh[key] ?? key;
    if (params) {
        Object.keys(params).forEach(name => {
            text = text.replaceAll(`{${name}}`, params[name]);
        });
    }
    return text;
};

/**
 * Applies translations to all elements carrying data-i18n attributes
 */
const applyI18n = () => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    document.title = t('meta.title');
};

/**
 * Syncs the visual state of the language switch buttons
 */
const syncLangSwitch = () => {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        const isActive = btn.dataset.lang === currentLang;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive);
    });
};

/**
 * Applies the given language globally and notifies the app
 * @param {string} lang - Target language code ('zh' or 'en')
 */
const setLanguage = (lang) => {
    if (!I18N_MESSAGES[lang] || lang === currentLang) return;

    currentLang = lang;
    try {
        localStorage.setItem(I18N_STORAGE_KEY, currentLang);
    } catch (error) {
        console.error('LocalStorage write error:', error);
    }

    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
    applyI18n();
    syncLangSwitch();
    document.dispatchEvent(new CustomEvent('languagechange'));
};

/**
 * Initializes i18n: restores saved language, applies translations,
 * and binds the language switch buttons
 */
const initI18n = () => {
    try {
        const saved = localStorage.getItem(I18N_STORAGE_KEY);
        if (saved && I18N_MESSAGES[saved]) {
            currentLang = saved;
        }
    } catch (error) {
        console.error('LocalStorage read error:', error);
    }

    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
    applyI18n();
    syncLangSwitch();

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });
};