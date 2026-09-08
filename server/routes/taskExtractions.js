/**
 * Daylight To-Do v4 — POST /api/task-extractions 路由
 *
 * 流程：读 { description } body → 检查 env 配置 → callModel → extractTasks → 返回 { tasks }
 *
 * 错误响应（绝不泄露密钥或内部堆栈）：
 *   - description 为空       → 400 { error: 'EMPTY_DESCRIPTION' }
 *   - 配置缺失               → 503 { error: 'MODEL_NOT_CONFIGURED' }
 *   - 模型错误/超时/无效 JSON → 502 { error: 'MODEL_ERROR' }
 *
 * 导出 createTaskExtractionsHandler(deps)（纯处理函数，不依赖 express，便于测试）
 * 以及 createTaskExtractionsRouter(deps)（挂到 express.Router）。
 */

import express from 'express';
import { callModel, isModelConfigured, ModelClientError } from '../modelClient.js';
import { extractTasks, ExtractionError } from '../taskExtractor.js';

/** 双语友好提示文案（路由层不依赖前端 i18n，自带最小集合） */
const MESSAGES = {
    EMPTY_DESCRIPTION: {
        zh: '请输入要拆解的任务描述',
        en: 'Please enter a task description to extract'
    },
    MODEL_NOT_CONFIGURED: {
        zh: '智能拆解未配置：管理员尚未设置模型服务密钥',
        en: 'Smart extraction is not configured: model API key is missing'
    },
    MODEL_ERROR: {
        zh: '模型服务暂时不可用，请稍后重试',
        en: 'Model service is unavailable, please try again later'
    }
};

/** Accept-Language 头解析出 zh/en，默认 zh */
const pickLang = (req) => {
    const header = req.headers && req.headers['accept-language'];
    if (typeof header === 'string' && header.toLowerCase().startsWith('en')) {
        return 'en';
    }
    return 'zh';
};

const messageFor = (code, lang) => {
    const pair = MESSAGES[code] || MESSAGES.MODEL_ERROR;
    return pair[lang] || pair.zh;
};

/**
 * 构造路由处理函数（依赖注入便于测试）。
 * @param {Object} [deps]
 * @param {Object} [deps.env] - 环境变量（默认 process.env）
 * @param {Function} [deps.fetchImpl] - fetch 注入
 * @param {number} [deps.timeoutMs] - 超时
 * @returns {Function} (req, res) => Promise<void>
 */
export const createTaskExtractionsHandler = (deps = {}) => {
    const env = deps.env || process.env;
    const callDeps = {};
    if (deps.fetchImpl) callDeps.fetchImpl = deps.fetchImpl;
    if (deps.timeoutMs) callDeps.timeoutMs = deps.timeoutMs;

    return async (req, res) => {
        const lang = pickLang(req);

        // express.json 中间件已解析 body；兼容 body 缺失
        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        const description = typeof body.description === 'string' ? body.description.trim() : '';

        if (!description) {
            res.status(400).json({
                error: 'EMPTY_DESCRIPTION',
                message: messageFor('EMPTY_DESCRIPTION', lang)
            });
            return;
        }

        if (!isModelConfigured(env)) {
            res.status(503).json({
                error: 'MODEL_NOT_CONFIGURED',
                message: messageFor('MODEL_NOT_CONFIGURED', lang)
            });
            return;
        }

        let rawText;
        try {
            rawText = await callModel(description, env, callDeps);
        } catch (error) {
            // 不区分 TIMEOUT / HTTP_ERROR / NETWORK_ERROR，统一 502，不泄露内部细节
            const code = error instanceof ModelClientError ? error.code : 'MODEL_ERROR';
            res.status(502).json({
                error: 'MODEL_ERROR',
                code,
                message: messageFor('MODEL_ERROR', lang)
            });
            return;
        }

        let result;
        try {
            result = extractTasks(rawText);
        } catch (error) {
            const code = error instanceof ExtractionError ? error.code : 'EXTRACTION_ERROR';
            res.status(502).json({
                error: 'MODEL_ERROR',
                code,
                message: messageFor('MODEL_ERROR', lang)
            });
            return;
        }

        res.status(200).json({ tasks: result.tasks });
    };
};

/**
 * 把路由挂到 express.Router 上。
 * @param {Object} [deps] - 同 createTaskExtractionsHandler
 * @returns {import('express').Router}
 */
export const createTaskExtractionsRouter = (deps = {}) => {
    const router = express.Router();
    router.post('/', createTaskExtractionsHandler(deps));
    return router;
};
