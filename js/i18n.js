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
        'btn.clearCompleted': '清除已完成',

        'filter.all': '全部',
        'filter.active': '进行中',
        'filter.completed': '已完成',

        'empty.text': '还没有任务',
        'empty.hint': '在上方输入框写下你的第一个任务吧',
        'empty.projectText': '这个项目还没有任务',
        'empty.projectHint': '切换到其他项目，或在这里添加新任务',

        'stats.tasks': '{n} 项任务',
        'stats.taskOne': '{n} 项任务',
        'stats.active': '{n} 项进行中',
        'stats.completed': '{n} 项已完成',

        'nav.title': '项目导航',
        'nav.all': '全部任务',
        'nav.inbox': '收集箱',
        'nav.newProjectPlaceholder': '新建项目…',
        'nav.addProject': '添加',

        'focus.title': '今日焦点',
        'focus.set': '设为焦点任务',
        'focus.unset': '取消焦点任务',
        'focus.emptyTitle': '暂无焦点任务',
        'focus.emptyHint': '将最重要的任务设为焦点，它会在这里等你',

        // Focus Flow (v3) — immersive focus session
        'focus.startFocus': '开始专注',
        'focus.chooseDuration': '选择专注时长',
        'focus.duration25': '25 分钟',
        'focus.duration45': '45 分钟',
        'focus.durationLabel': '时长',
        'focus.pause': '暂停',
        'focus.resume': '继续',
        'focus.end': '结束专注',
        'focus.backToDashboard': '返回驾驶舱',
        'focus.remaining': '剩余时间',
        'focus.elapsed': '已专注',
        'focus.completed': '专注完成',
        'focus.completedHint': '一次漂亮的专注，节奏已被记录',
        'focus.markTaskDone': '标记任务完成',
        'focus.taskMarkedDone': '任务已标记完成',
        'focus.sessionRestored': '已恢复未完成的专注会话',
        'focus.confirmEnd': '确定结束本次专注？',
        'focus.modeTitle': '专注模式',
        'focus.taskMissing': '关联任务已不存在',
        'focus.pausedLabel': '已暂停',

        'insight.title': '工作节奏',
        'insight.todayProgress': '今日进度',
        'insight.ringSummary': '已完成 {completed} · 共 {total}',
        'insight.doneLeft': '{done} 已完成 · {left} 剩余',
        'insight.doneToday': '今日完成',
        'insight.overdue': '逾期未完成',
        'insight.highOpen': '高优先级待办',
        'insight.ringAria': '今日进度 {pct}%，已完成 {done} 项，共 {total} 项',

        'priority.high': '高',
        'priority.medium': '中',
        'priority.low': '低',

        'form.openDetail': '详细添加',
        'form.title': '标题',
        'form.titlePlaceholder': '任务标题…',
        'form.project': '项目',
        'form.priority': '优先级',
        'form.dueDate': '截止日期',
        'form.estimate': '预计时长（分钟）',
        'form.estimateUnit': '分钟',
        'form.focused': '设为焦点任务',
        'form.inboxOption': '收集箱',
        'form.save': '保存任务',
        'form.cancel': '取消',

        'error.titleEmpty': '请输入任务标题',
        'error.titleTooLong': '标题不能超过 150 个字符',
        'error.estimateRange': '预计时长需为 1–600 之间的整数',
        'error.dateInvalid': '截止日期格式不正确',
        'error.saveFailed': '保存失败：浏览器存储不可用，更改仅在本页生效',

        'project.error.empty': '请输入项目名称',
        'project.error.tooLong': '项目名称不能超过 30 个字符',
        'project.error.duplicate': '已存在同名项目',

        'overdue.label': '已逾期',

        'aria.addInput': '添加新任务',
        'aria.add': '添加任务',
        'aria.filters': '任务筛选',
        'aria.todoList': '任务列表',
        'aria.langSwitch': '切换语言',
        'aria.clearCompleted': '清除已完成任务',
        'aria.save': '保存',
        'aria.cancel': '取消',
        'aria.edit': '编辑',
        'aria.delete': '删除',
        'aria.markCompleted': '标记为已完成',
        'aria.markNotCompleted': '标记为未完成',
        'aria.itemCompleted': '已完成',
        'aria.itemActive': '进行中',
        'aria.projectNav': '项目导航',
        'aria.projectList': '项目列表',
        'aria.projectInput': '项目名称输入',
        'aria.addProject': '添加项目',
        'aria.focusPanel': '今日焦点区',
        'aria.focusStar': '焦点星标',
        'aria.insightPanel': '工作节奏面板',
        'aria.insightList': '洞察指标',
        'aria.taskForm': '任务详细表单',
        'aria.openDetailForm': '打开详细添加表单',
        'aria.titleInput': '任务标题输入',
        'aria.projectSelect': '选择项目',
        'aria.prioritySelect': '选择优先级',
        'aria.dueDateInput': '选择截止日期',
        'aria.estimateInput': '输入预计时长（分钟）',
        'aria.focusedCheckbox': '设为焦点任务',
        'aria.focusStart': '开始专注',
        'aria.focusDurationPicker': '选择专注时长',
        'aria.focusDuration25': '专注 25 分钟',
        'aria.focusDuration45': '专注 45 分钟',
        'aria.focusOverlay': '专注沉浸层',
        'aria.focusRing': '专注进度环',
        'aria.focusPause': '暂停专注',
        'aria.focusResume': '继续专注',
        'aria.focusEnd': '结束专注并返回',
        'aria.focusBack': '返回驾驶舱',
        'aria.focusMarkDone': '将关联任务标记为已完成',
        'aria.focusCloseCompleted': '关闭专注完成提示'
    },
    en: {
        'meta.title': 'Daylight To-Do',
        'app.title': 'To-Do',
        'app.subtitle': 'Organize your tasks, stay productive.',
        'placeholder.addTask': 'Add a new task...',
        'btn.add': 'Add',
        'btn.clearCompleted': 'Clear Completed',

        'filter.all': 'All',
        'filter.active': 'Active',
        'filter.completed': 'Completed',

        'empty.text': 'No tasks yet',
        'empty.hint': 'Type in the field above to add your first task',
        'empty.projectText': 'No tasks in this project',
        'empty.projectHint': 'Switch to another project, or add a new task here',

        'stats.tasks': '{n} tasks',
        'stats.taskOne': '{n} task',
        'stats.active': '{n} active',
        'stats.completed': '{n} completed',

        'nav.title': 'Projects',
        'nav.all': 'All Tasks',
        'nav.inbox': 'Inbox',
        'nav.newProjectPlaceholder': 'New project...',
        'nav.addProject': 'Add',

        'focus.title': 'Today\'s Focus',
        'focus.set': 'Set as focus task',
        'focus.unset': 'Remove focus task',
        'focus.emptyTitle': 'No focus tasks',
        'focus.emptyHint': 'Star your most important task and it will wait for you here',

        // Focus Flow (v3) — immersive focus session
        'focus.startFocus': 'Start Focus',
        'focus.chooseDuration': 'Choose focus duration',
        'focus.duration25': '25 min',
        'focus.duration45': '45 min',
        'focus.durationLabel': 'Duration',
        'focus.pause': 'Pause',
        'focus.resume': 'Resume',
        'focus.end': 'End Focus',
        'focus.backToDashboard': 'Back to dashboard',
        'focus.remaining': 'Remaining',
        'focus.elapsed': 'Focused',
        'focus.completed': 'Focus complete',
        'focus.completedHint': 'A clean focus session — your pace has been recorded',
        'focus.markTaskDone': 'Mark task done',
        'focus.taskMarkedDone': 'Task marked as done',
        'focus.sessionRestored': 'Resumed an unfinished focus session',
        'focus.confirmEnd': 'End this focus session?',
        'focus.modeTitle': 'Focus Mode',
        'focus.taskMissing': 'Linked task no longer exists',
        'focus.pausedLabel': 'Paused',

        'insight.title': 'Work Pace',
        'insight.todayProgress': 'Today\'s Progress',
        'insight.ringSummary': '{completed} done of {total}',
        'insight.doneLeft': '{done} done · {left} left',
        'insight.doneToday': 'Done today',
        'insight.overdue': 'Overdue',
        'insight.highOpen': 'High priority open',
        'insight.ringAria': 'Today\'s progress {pct}%, {done} of {total} tasks completed',

        'priority.high': 'High',
        'priority.medium': 'Med',
        'priority.low': 'Low',

        'form.openDetail': 'Details',
        'form.title': 'Title',
        'form.titlePlaceholder': 'Task title...',
        'form.project': 'Project',
        'form.priority': 'Priority',
        'form.dueDate': 'Due date',
        'form.estimate': 'Estimate (minutes)',
        'form.estimateUnit': 'min',
        'form.focused': 'Set as focus task',
        'form.inboxOption': 'Inbox',
        'form.save': 'Save Task',
        'form.cancel': 'Cancel',

        'error.titleEmpty': 'Please enter a task title',
        'error.titleTooLong': 'Title must be 150 characters or fewer',
        'error.estimateRange': 'Estimate must be an integer between 1 and 600',
        'error.dateInvalid': 'Due date format is invalid',
        'error.saveFailed': 'Save failed: browser storage is unavailable, changes apply to this page only',

        'project.error.empty': 'Please enter a project name',
        'project.error.tooLong': 'Project name must be 30 characters or fewer',
        'project.error.duplicate': 'A project with this name already exists',

        'overdue.label': 'Overdue',

        'aria.addInput': 'Add a new task',
        'aria.add': 'Add task',
        'aria.filters': 'Task filters',
        'aria.todoList': 'Task list',
        'aria.langSwitch': 'Switch language',
        'aria.clearCompleted': 'Clear completed tasks',
        'aria.save': 'Save',
        'aria.cancel': 'Cancel',
        'aria.edit': 'Edit',
        'aria.delete': 'Delete',
        'aria.markCompleted': 'Mark as completed',
        'aria.markNotCompleted': 'Mark as not completed',
        'aria.itemCompleted': 'completed',
        'aria.itemActive': 'active',
        'aria.projectNav': 'Project navigation',
        'aria.projectList': 'Project list',
        'aria.projectInput': 'Project name input',
        'aria.addProject': 'Add project',
        'aria.focusPanel': 'Today\'s focus panel',
        'aria.focusStar': 'Focus star',
        'aria.insightPanel': 'Work pace panel',
        'aria.insightList': 'Insight metrics',
        'aria.taskForm': 'Task detail form',
        'aria.openDetailForm': 'Open the detail add form',
        'aria.titleInput': 'Task title input',
        'aria.projectSelect': 'Select project',
        'aria.prioritySelect': 'Select priority',
        'aria.dueDateInput': 'Select due date',
        'aria.estimateInput': 'Enter estimate in minutes',
        'aria.focusedCheckbox': 'Set as focus task',
        'aria.focusStart': 'Start focus',
        'aria.focusDurationPicker': 'Choose focus duration',
        'aria.focusDuration25': 'Focus for 25 minutes',
        'aria.focusDuration45': 'Focus for 45 minutes',
        'aria.focusOverlay': 'Focus immersive overlay',
        'aria.focusRing': 'Focus progress ring',
        'aria.focusPause': 'Pause focus',
        'aria.focusResume': 'Resume focus',
        'aria.focusEnd': 'End focus and return',
        'aria.focusBack': 'Back to dashboard',
        'aria.focusMarkDone': 'Mark linked task as completed',
        'aria.focusCloseCompleted': 'Close focus completion notice'
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
