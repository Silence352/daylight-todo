/**
 * Daylight To-Do v5 — 云端任务路由
 *
 * 端点（全部挂 requireAuth，req.user.id 为当前用户）：
 *   - GET    /api/cloud/tasks       → 200 { tasks: [...] }
 *   - POST   /api/cloud/tasks       → 201 { task }
 *   - PUT    /api/cloud/tasks/:id   → 200 { task }（先校验所有权，不匹配 403）
 *   - DELETE /api/cloud/tasks/:id   → 200（同所有权校验）
 *
 * 安全：
 *   - 所有查询带 WHERE user_id = ?，**绝不让用户读写他人数据**
 *   - PUT/DELETE 先查 task.user_id === req.user.id，不匹配返回 403
 *   - 响应只含任务字段，不含 user_id 之外的用户敏感信息
 */

import express from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import { createAuthMiddleware } from '../auth/middleware.js';

/** 任务文本最大长度 */
const TASK_TEXT_MAX = 500;
/** 合法优先级 */
const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);

/**
 * 生成任务 id（32 字节 hex）。
 * @returns {string}
 */
const generateTaskId = () => crypto.randomBytes(16).toString('hex');

/**
 * 把数据库行转成 API 响应对象。
 * @param {Object} row
 * @returns {Object}
 */
const rowToTask = (row) => ({
    id: row.id,
    text: row.text,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    projectId: row.project_id,
    priority: row.priority,
    dueDate: row.due_date,
    estimateMinutes: row.estimate_minutes,
    focused: Boolean(row.focused),
    completedAt: row.completed_at
});

/**
 * 校验并规范化任务字段（POST/PUT 共用）。
 * 返回 { valid, value, error }。
 *
 * @param {Object} body
 * @param {boolean} partial - true 表示部分更新（PUT），允许 text 缺失
 * @returns {{ valid: boolean, value?: Object, error?: string }}
 */
const validateTaskFields = (body, partial) => {
    const value = {};

    // text
    if (body.text !== undefined) {
        if (typeof body.text !== 'string' || body.text.trim().length === 0) {
            return { valid: false, error: 'INVALID_TEXT' };
        }
        if (body.text.length > TASK_TEXT_MAX) {
            return { valid: false, error: 'TEXT_TOO_LONG' };
        }
        value.text = body.text.trim();
    } else if (!partial) {
        return { valid: false, error: 'INVALID_TEXT' };
    }

    // completed
    if (body.completed !== undefined) {
        if (typeof body.completed !== 'boolean') {
            return { valid: false, error: 'INVALID_COMPLETED' };
        }
        value.completed = body.completed;
    }

    // projectId
    if (body.projectId !== undefined) {
        if (body.projectId === null || typeof body.projectId === 'string') {
            value.projectId = body.projectId;
        } else {
            return { valid: false, error: 'INVALID_PROJECT' };
        }
    }

    // priority
    if (body.priority !== undefined) {
        if (body.priority === null || VALID_PRIORITIES.has(body.priority)) {
            value.priority = body.priority;
        } else {
            return { valid: false, error: 'INVALID_PRIORITY' };
        }
    }

    // dueDate
    if (body.dueDate !== undefined) {
        if (body.dueDate === null || typeof body.dueDate === 'string') {
            value.dueDate = body.dueDate;
        } else {
            return { valid: false, error: 'INVALID_DUE_DATE' };
        }
    }

    // estimateMinutes
    if (body.estimateMinutes !== undefined) {
        if (body.estimateMinutes === null ||
            (Number.isInteger(body.estimateMinutes) && body.estimateMinutes >= 0)) {
            value.estimateMinutes = body.estimateMinutes;
        } else {
            return { valid: false, error: 'INVALID_ESTIMATE' };
        }
    }

    // focused
    if (body.focused !== undefined) {
        if (typeof body.focused === 'boolean') {
            value.focused = body.focused;
        } else {
            return { valid: false, error: 'INVALID_FOCUSED' };
        }
    }

    return { valid: true, value };
};

/**
 * 构造云端任务路由器。
 *
 * @param {Object} [deps]
 * @param {Object} [deps.env]
 * @returns {import('express').Router}
 */
export const createCloudTasksRouter = (deps = {}) => {
    const env = deps.env || process.env;
    const router = express.Router();
    const { requireAuth } = createAuthMiddleware({ env });

    // 全部端点要求登录
    router.use(requireAuth);

    // ------------------------------
    // GET /api/cloud/tasks
    // ------------------------------
    router.get('/', (req, res) => {
        const db = getDb();
        const rows = db.prepare(
            `SELECT id, user_id, text, completed, created_at, project_id,
                    priority, due_date, estimate_minutes, focused, completed_at
             FROM cloud_tasks
             WHERE user_id = ?
             ORDER BY created_at ASC`
        ).all(req.user.id);
        res.status(200).json({ tasks: rows.map(rowToTask) });
    });

    // ------------------------------
    // POST /api/cloud/tasks
    // ------------------------------
    router.post('/', (req, res) => {
        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        // 兼容 { task: {...} } 与直接展开字段两种写法
        const payload = body.task && typeof body.task === 'object' ? body.task : body;

        const check = validateTaskFields(payload, false);
        if (!check.valid) {
            res.status(400).json({ error: check.error });
            return;
        }

        const db = getDb();
        const id = generateTaskId();
        const createdAt = new Date().toISOString();
        const completed = check.value.completed ?? false;
        const completedAt = completed ? createdAt : null;

        db.prepare(
            `INSERT INTO cloud_tasks
                (id, user_id, text, completed, created_at, project_id,
                 priority, due_date, estimate_minutes, focused, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            id,
            req.user.id,
            check.value.text,
            completed ? 1 : 0,
            createdAt,
            check.value.projectId ?? null,
            check.value.priority ?? null,
            check.value.dueDate ?? null,
            check.value.estimateMinutes ?? null,
            (check.value.focused ?? false) ? 1 : 0,
            completedAt
        );

        const row = db.prepare(
            `SELECT id, user_id, text, completed, created_at, project_id,
                    priority, due_date, estimate_minutes, focused, completed_at
             FROM cloud_tasks WHERE id = ?`
        ).get(id);
        res.status(201).json({ task: rowToTask(row) });
    });

    // ------------------------------
    // PUT /api/cloud/tasks/:id
    // ------------------------------
    router.put('/:id', (req, res) => {
        const taskId = req.params.id;
        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        const payload = body.task && typeof body.task === 'object' ? body.task : body;

        const check = validateTaskFields(payload, true);
        if (!check.valid) {
            res.status(400).json({ error: check.error });
            return;
        }

        const db = getDb();
        // 先查所有权
        const existing = db.prepare(
            'SELECT user_id FROM cloud_tasks WHERE id = ?'
        ).get(taskId);

        if (!existing) {
            res.status(404).json({ error: 'NOT_FOUND' });
            return;
        }
        if (existing.user_id !== req.user.id) {
            // 所有权不匹配：403，不泄露资源存在性
            res.status(403).json({ error: 'FORBIDDEN' });
            return;
        }

        // 动态构造 UPDATE
        const fields = [];
        const values = [];
        const map = {
            text: 'text',
            projectId: 'project_id',
            priority: 'priority',
            dueDate: 'due_date',
            estimateMinutes: 'estimate_minutes'
        };
        for (const [k, col] of Object.entries(map)) {
            if (check.value[k] !== undefined) {
                fields.push(`${col} = ?`);
                values.push(check.value[k]);
            }
        }
        if (check.value.completed !== undefined) {
            fields.push('completed = ?');
            values.push(check.value.completed ? 1 : 0);
            if (check.value.completed) {
                fields.push('completed_at = ?');
                values.push(new Date().toISOString());
            } else {
                fields.push('completed_at = ?');
                values.push(null);
            }
        }
        if (check.value.focused !== undefined) {
            fields.push('focused = ?');
            values.push(check.value.focused ? 1 : 0);
        }

        if (fields.length === 0) {
            // 没有可更新字段
            const row = db.prepare(
                `SELECT id, user_id, text, completed, created_at, project_id,
                        priority, due_date, estimate_minutes, focused, completed_at
                 FROM cloud_tasks WHERE id = ?`
            ).get(taskId);
            res.status(200).json({ task: rowToTask(row) });
            return;
        }

        values.push(taskId);
        db.prepare(`UPDATE cloud_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);

        const row = db.prepare(
            `SELECT id, user_id, text, completed, created_at, project_id,
                    priority, due_date, estimate_minutes, focused, completed_at
             FROM cloud_tasks WHERE id = ?`
        ).get(taskId);
        res.status(200).json({ task: rowToTask(row) });
    });

    // ------------------------------
    // DELETE /api/cloud/tasks/:id
    // ------------------------------
    router.delete('/:id', (req, res) => {
        const taskId = req.params.id;
        const db = getDb();

        const existing = db.prepare(
            'SELECT user_id FROM cloud_tasks WHERE id = ?'
        ).get(taskId);

        if (!existing) {
            res.status(404).json({ error: 'NOT_FOUND' });
            return;
        }
        if (existing.user_id !== req.user.id) {
            res.status(403).json({ error: 'FORBIDDEN' });
            return;
        }

        db.prepare('DELETE FROM cloud_tasks WHERE id = ?').run(taskId);
        res.status(200).json({ ok: true });
    });

    return router;
};