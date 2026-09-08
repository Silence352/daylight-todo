/**
 * Daylight To-Do v4 — Model Client
 *
 * 按 OpenAI 兼容协议调用 chat completions 接口。
 * - buildModelRequest(description, env)：纯函数，构造 { url, options }
 * - callModel(description, env, { fetchImpl, timeoutMs })：发起请求，返回文本
 *
 * 密钥只在请求头 Authorization: Bearer ${MODEL_API_KEY}，绝不 log、绝不返回给调用方。
 * 使用 Node 18+ 内置 fetch；测试可注入 fetchImpl 进行 mock。
 */

export const DEFAULT_TIMEOUT_MS = 30000;
export const DEFAULT_TEMPERATURE = 0.2;

/**
 * 检查模型配置是否齐全。
 * @param {Object} env - 环境变量对象（通常是 process.env 的子集）
 * @returns {boolean}
 */
export const isModelConfigured = (env = {}) => {
    return Boolean(env.MODEL_BASE_URL && env.MODEL_NAME && env.MODEL_API_KEY);
};

/**
 * 构造 system prompt：指示模型只返回 JSON 草稿数组。
 * @returns {string}
 */
const buildSystemPrompt = () => {
    return [
        'You are a task extraction assistant.',
        'Read the user\'s natural-language description and break it down into actionable to-do tasks.',
        'Return ONLY a JSON object with this exact shape (no prose, no markdown fences):',
        '{ "tasks": [ { "title": string, "project": string, "priority": "high"|"medium"|"low", "dueDate": "YYYY-MM-DD"|null, "estimatedMinutes": number }, ... ] }',
        'Rules:',
        '- title: required, concise, imperative mood, <= 150 chars.',
        '- project: optional grouping name; empty string if none.',
        '- priority: one of high|medium|low; default medium.',
        '- dueDate: ISO date YYYY-MM-DD or null if not mentioned.',
        '- estimatedMinutes: positive integer minutes; default 25.',
        '- Do not invent details not implied by the description.',
        '- Output must be valid JSON parseable by JSON.parse.'
    ].join('\n');
};

/**
 * 纯函数：构造发往模型服务的 { url, options }。
 * 不发起任何网络请求，便于测试断言 url/headers/body。
 *
 * @param {string} description - 用户的自然语言任务描述
 * @param {Object} env - 环境变量（MODEL_BASE_URL / MODEL_NAME / MODEL_API_KEY）
 * @returns {{ url: string, options: Object }}
 */
export const buildModelRequest = (description, env = {}) => {
    const baseUrl = (env.MODEL_BASE_URL || '').replace(/\/+$/, '');
    const url = `${baseUrl}/v1/chat/completions`;

    const body = {
        model: env.MODEL_NAME,
        messages: [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: String(description) }
        ],
        temperature: DEFAULT_TEMPERATURE,
        response_format: { type: 'json_object' }
    };

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.MODEL_API_KEY}`
        },
        body: JSON.stringify(body)
    };

    return { url, options };
};

/**
 * 自定义错误类型，便于路由层按 code 区分响应
 */
export class ModelClientError extends Error {
    /**
     * @param {string} message
     * @param {string} code - NOT_CONFIGURED | HTTP_ERROR | TIMEOUT | NETWORK_ERROR | EMPTY_CONTENT
     */
    constructor(message, code) {
        super(message);
        this.name = 'ModelClientError';
        this.code = code;
    }
}

/**
 * 调用模型服务并返回 assistant 文本内容。
 *
 * @param {string} description - 用户的自然语言任务描述
 * @param {Object} env - 环境变量
 * @param {Object} [deps] - 依赖注入
 * @param {Function} [deps.fetchImpl] - fetch 实现（默认用全局 fetch）
 * @param {number} [deps.timeoutMs] - 超时毫秒（默认 30000）
 * @returns {Promise<string>} assistant 返回的文本
 * @throws {ModelClientError}
 */
export const callModel = async (description, env = {}, deps = {}) => {
    if (!isModelConfigured(env)) {
        throw new ModelClientError('Model is not configured', 'NOT_CONFIGURED');
    }

    const fetchImpl = deps.fetchImpl || fetch;
    const timeoutMs = deps.timeoutMs && deps.timeoutMs > 0
        ? deps.timeoutMs
        : DEFAULT_TIMEOUT_MS;

    const { url, options } = buildModelRequest(description, env);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await fetchImpl(url, { ...options, signal: controller.signal });
    } catch (error) {
        clearTimeout(timer);
        if (error && error.name === 'AbortError') {
            throw new ModelClientError('Model request timed out', 'TIMEOUT');
        }
        // 不暴露原始 error 的细节，避免泄露内部信息
        throw new ModelClientError('Failed to reach model service', 'NETWORK_ERROR');
    }

    clearTimeout(timer);

    if (!response.ok) {
        // 不读取 body 细节进 message，避免泄露上游错误文本；仅带状态码
        throw new ModelClientError(
            `Model service returned HTTP ${response.status}`,
            'HTTP_ERROR'
        );
    }

    let data;
    try {
        data = await response.json();
    } catch {
        throw new ModelClientError('Model response was not valid JSON', 'HTTP_ERROR');
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
        throw new ModelClientError('Model returned empty content', 'EMPTY_CONTENT');
    }

    return content;
};