/**
 * Daylight To-Do v4 — Task Extractor (pure functions)
 *
 * 把模型返回的文本解析为 JSON，再将每个草稿规范化为
 * { title, project, priority, dueDate, estimatedMinutes }。
 *
 * 全部为纯函数，不依赖任何 IO，便于用 node:test 直接覆盖。
 */

/** 草稿字段约束（与前端 v3 的 validateTask 保持一致） */
export const TITLE_MAX = 150;
export const PRIORITY_VALUES = ['high', 'medium', 'low'];
export const ESTIMATE_MIN = 1;
export const ESTIMATE_MAX = 600;
export const ESTIMATE_DEFAULT = 25;

/**
 * 自定义错误类型，便于路由层按 code 区分响应
 */
export class ExtractionError extends Error {
    /**
     * @param {string} message - 人类可读的错误信息
     * @param {string} code - 稳定错误码（INVALID_JSON / MISSING_TITLE / EMPTY_TASKS ...）
     */
    constructor(message, code) {
        super(message);
        this.name = 'ExtractionError';
        this.code = code;
    }
}

/**
 * 尝试从 markdown ```json``` 代码块中提取内容。
 * 只取第一个匹配到的代码块；找不到则返回 null。
 * @param {string} text
 * @returns {string|null}
 */
const extractJsonCodeBlock = (text) => {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return match ? match[1].trim() : null;
};

/**
 * 解析模型返回的文本为原始 JSON 对象。
 *
 * 解析顺序：
 *   1. 直接 JSON.parse
 *   2. 从 ```json``` 代码块提取后再 JSON.parse
 *   3. 全部失败 → 抛 ExtractionError('INVALID_JSON')
 *
 * @param {string} rawText - 模型返回的原始文本
 * @returns {Object} 解析后的原始对象
 * @throws {ExtractionError} code='INVALID_JSON'
 */
export const parseModelResponse = (rawText) => {
    if (typeof rawText !== 'string' || rawText.trim() === '') {
        throw new ExtractionError('Model returned empty content', 'INVALID_JSON');
    }

    const candidates = [rawText.trim()];
    const block = extractJsonCodeBlock(rawText);
    if (block) candidates.push(block);

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
        } catch {
            // 继续尝试下一个候选
        }
    }

    throw new ExtractionError('Model response is not valid JSON', 'INVALID_JSON');
};

/**
 * 校验并规范化单个日期字符串为 YYYY-MM-DD 或 null。
 * 非法格式或非真实日历日归 null。
 * @param {*} value
 * @returns {string|null}
 */
const normalizeDueDate = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (
        Number.isNaN(date.getTime())
        || date.getFullYear() !== y
        || date.getMonth() !== m - 1
        || date.getDate() !== d
    ) {
        return null;
    }
    return value;
};

/**
 * 校验并规范化预估时长为正整数（1–600），非法值归默认 25。
 * @param {*} value
 * @returns {number}
 */
const normalizeEstimatedMinutes = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || !Number.isInteger(n)
        || n < ESTIMATE_MIN || n > ESTIMATE_MAX) {
        return ESTIMATE_DEFAULT;
    }
    return n;
};

/**
 * 将单个草稿规范化为 { title, project, priority, dueDate, estimatedMinutes }。
 *
 * 规则：
 *   - title: string, 必填, trim, max 150；缺失或空 → 抛 ExtractionError('MISSING_TITLE')
 *   - project: string, 可选, trim, 默认 ''
 *   - priority: 'high'|'medium'|'low', 默认 'medium', 非法值归 'medium'
 *   - dueDate: YYYY-MM-DD 或 null, 非法格式归 null
 *   - estimatedMinutes: 正整数 1–600, 默认 25, 非法值归 25
 *
 * @param {Object} rawDraft - 模型返回的单个草稿
 * @returns {Object} 规范化后的草稿
 * @throws {ExtractionError} code='MISSING_TITLE'
 */
export const normalizeDraft = (rawDraft) => {
    if (!rawDraft || typeof rawDraft !== 'object') {
        throw new ExtractionError('Draft is missing a title', 'MISSING_TITLE');
    }

    const rawTitle = typeof rawDraft.title === 'string' ? rawDraft.title.trim() : '';
    if (!rawTitle) {
        throw new ExtractionError('Draft is missing a title', 'MISSING_TITLE');
    }
    const title = rawTitle.slice(0, TITLE_MAX);

    const project = typeof rawDraft.project === 'string'
        ? rawDraft.project.trim().slice(0, 150)
        : '';

    const priority = PRIORITY_VALUES.includes(rawDraft.priority)
        ? rawDraft.priority
        : 'medium';

    const dueDate = normalizeDueDate(rawDraft.dueDate);

    const estimatedMinutes = normalizeEstimatedMinutes(rawDraft.estimatedMinutes);

    return { title, project, priority, dueDate, estimatedMinutes };
};

/**
 * 解析模型返回文本并规范化全部草稿。
 *
 * 期望模型返回 `{ tasks: [...] }`；若顶层是数组也兼容；
 * 若解析后没有可用草稿 → 抛 ExtractionError('EMPTY_TASKS')。
 *
 * @param {string} rawText - 模型返回的原始文本
 * @returns {{ tasks: Array<Object> }} 规范化后的草稿数组
 * @throws {ExtractionError}
 */
export const extractTasks = (rawText) => {
    const parsed = parseModelResponse(rawText);

    let rawTasks = null;
    if (Array.isArray(parsed)) {
        rawTasks = parsed;
    } else if (parsed && Array.isArray(parsed.tasks)) {
        rawTasks = parsed.tasks;
    }

    if (!rawTasks || rawTasks.length === 0) {
        throw new ExtractionError('No tasks found in model response', 'EMPTY_TASKS');
    }

    const tasks = rawTasks.map(normalizeDraft);
    return { tasks };
};