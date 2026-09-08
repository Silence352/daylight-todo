/**
 * Daylight To-Do v6 — 本地→云端 同步路由
 *
 * 端点（挂 requireAuth，req.user.id 为当前用户）：
 *   - POST /api/cloud/sync  body { tasks: [...] }
 *       → 200 { added, skipped, total }
 *
 * 同步语义（显式同步 + 追加合并 + 不可变 ID 去重 + 服务端幂等）：
 *   - 对每个本地任务，按 (id, user_id) 查 cloud_tasks
 *     · 已存在 → 跳过（不覆盖、不 UPDATE，云端字段保持不变）
 *     · 不存在 → INSERT（user_id = req.user.id）
 *   - 全程用事务包裹：要么全部成功，要么全部回滚
 *   - 幂等：重复同步同一批任务不创建副本（已存在的全部跳过）
 *   - 不删本地任务：本路由不触及客户端本地存储，仅返回结果由前端展示
 *
 * 返回：
 *   - added   = 本次新插入云端的数量
 *   - skipped = 本次因已存在而跳过的数量
 *   - total   = 同步完成后该用户云端任务总数
 *
 * 安全：
 *   - 所有查询带 WHERE user_id = ?，绝不读写他人数据
 *   - 跨账号隔离：相同 id 在不同 user_id 下互不影响
 *   - 用户字符串原样写入（SQLite 参数化防注入；前端展示时 escapeHtml）
 *
 * 字段映射（本地 camelCase → cloud_tasks snake_case）：
 *   id, text, completed, createdAt, projectId, priority,
 *   dueDate, estimateMinutes, focused, completedAt
 * 缺失字段用安全默认值填充，非法字段归一化为 null。
 */

import express from 'express';
import { getDb } from '../db/database.js';
import { createAuthMiddleware } from '../auth/middleware.js';

/** 任务文本最大长度（与 cloudTasks.js 对齐） */
const TASK_TEXT_MAX = 500;
/** 合法优先级集合 */
const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);

/**
 * 把单个本地任务规范化为可写入 cloud_tasks 的字段集合。
 * 返回 null 表示该任务非法（缺 id 或 text），应被忽略且不计入 added/skipped。
 *
 * @param {*} raw - 本地任务对象
 * @returns {Object|null} 规范化字段，或 null
 */
const normalizeLocalTask = (raw) => {
    if (!raw || typeof raw !== 'object') return null;

    // id 必须是非空字符串（按 id 去重的关键）
    if (typeof raw.id !== 'string' || raw.id.length === 0) return null;

    // text 必须是非空字符串（cloud_tasks.text NOT NULL）
    if (typeof raw.text !== 'string' || raw.text.trim().length === 0) return null;
    if (raw.text.length > TASK_TEXT_MAX) return null;

    const completed = Boolean(raw.completed);
    const createdAt = typeof raw.createdAt === 'string' && raw.createdAt.length > 0
        ? raw.createdAt
        : new Date().toISOString();

    // projectId：string 保留，其余归 null
    const projectId = typeof raw.projectId === 'string' ? raw.projectId : null;

    // priority：仅接受 high/medium/low，其余归 null
    const priority = VALID_PRIORITIES.has(raw.priority) ? raw.priority : null;

    // dueDate：string 保留，其余归 null
    const dueDate = typeof raw.dueDate === 'string' ? raw.dueDate : null;

    // estimateMinutes：非负整数保留，其余归 null
    const estimateMinutes = Number.isInteger(raw.estimateMinutes) && raw.estimateMinutes >= 0
        ? raw.estimateMinutes
        : null;

    const focused = Boolean(raw.focused);

    // completedAt：string 保留；否则按 completed 推导
    const completedAt = typeof raw.completedAt === 'string' && raw.completedAt.length > 0
        ? raw.completedAt
        : (completed ? createdAt : null);

    return {
        id: raw.id,
        text: raw.text,
        completed,
        createdAt,
        projectId,
        priority,
        dueDate,
        estimateMinutes,
        focused,
        completedAt
    };
};

/**
 * 构造同步路由器。
 *
 * @param {Object} [deps]
 * @param {Object} [deps.env]
 * @returns {import('express').Router}
 */
export const createSyncRouter = (deps = {}) => {
    const env = deps.env || process.env;
    const router = express.Router();
    const { requireAuth } = createAuthMiddleware({ env });

    // 全部端点要求登录
    router.use(requireAuth);

    // ------------------------------
    // POST /api/cloud/sync
    // ------------------------------
    router.post('/sync', (req, res) => {
        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        const tasks = Array.isArray(body.tasks) ? body.tasks : [];

        const db = getDb();

        // 预编译语句（事务内重复执行）
        const checkExisting = db.prepare(
            'SELECT id FROM cloud_tasks WHERE id = ? AND user_id = ?'
        );
        const insertTask = db.prepare(
            `INSERT INTO cloud_tasks
                (id, user_id, text, completed, created_at, project_id,
                 priority, due_date, estimate_minutes, focused, completed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const countUserTasks = db.prepare(
            'SELECT COUNT(*) AS n FROM cloud_tasks WHERE user_id = ?'
        );

        let added = 0;
        let skipped = 0;

        // 用事务包裹全部查重 + 插入：原子提交，失败整体回滚
        const runSync = db.transaction(() => {
            for (const raw of tasks) {
                const task = normalizeLocalTask(raw);
                if (!task) continue; // 非法任务忽略，不计数

                const existing = checkExisting.get(task.id, req.user.id);
                if (existing) {
                    // 已存在 → 跳过，绝不覆盖
                    skipped += 1;
                    continue;
                }

                insertTask.run(
                    task.id,
                    req.user.id,
                    task.text,
                    task.completed ? 1 : 0,
                    task.createdAt,
                    task.projectId,
                    task.priority,
                    task.dueDate,
                    task.estimateMinutes,
                    task.focused ? 1 : 0,
                    task.completedAt
                );
                added += 1;
            }
        });

        try {
            runSync();
        } catch (error) {
            // 唯一可能的事务异常：INSERT 冲突（同 id 同 user_id 已存在但 check 没查到，
            // 理论上不会发生，因为 check 先行）。这里兜底返回 500，不泄露内部细节。
            console.error('Sync transaction failed:', error);
            res.status(500).json({ error: 'SYNC_FAILED' });
            return;
        }

        const total = countUserTasks.get(req.user.id).n;
        res.status(200).json({ added, skipped, total });
    });

    return router;
};