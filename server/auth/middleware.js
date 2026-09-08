/**
 * Daylight To-Do v5 — 认证中间件
 *
 * 职责：
 *   - requireAuth：读 session cookie → 查 session → 查 user → 挂 req.user；
 *     未登录返回 401 { error: 'UNAUTHORIZED' }
 *   - optionalAuth：同上但未登录不报错，req.user 可能为 null
 *
 * 安全：
 *   - 不泄露具体原因（cookie 缺失/签名错误/session 过期/user 不存在）统一 401
 *   - req.user 只含 { id, email }，绝不挂 password_hash/salt
 */

import { getDb } from '../db/database.js';
import { readSessionCookie, getSession } from './session.js';

/**
 * 根据 session 查询用户，返回 { id, email } 或 null。
 * @param {string} sessionId
 * @returns {{ id: string, email: string } | null}
 */
const loadUserFromSession = (sessionId) => {
    const session = getSession(sessionId);
    if (!session) return null;
    const db = getDb();
    const row = db.prepare(
        'SELECT id, email FROM users WHERE id = ?'
    ).get(session.userId);
    if (!row) return null;
    return { id: row.id, email: row.email };
};

/**
 * 要求登录：未登录返回 401 { error: 'UNAUTHORIZED' }。
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 * @param {Object} [deps]
 * @param {Object} [deps.env]
 */
export const requireAuth = (req, res, next, deps = {}) => {
    const sessionId = readSessionCookie(req, deps);
    if (!sessionId) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
    }
    const user = loadUserFromSession(sessionId);
    if (!user) {
        res.status(401).json({ error: 'UNAUTHORIZED' });
        return;
    }
    req.user = user;
    req.sessionId = sessionId;
    next();
};

/**
 * 可选认证：登录则挂 req.user，未登录则 req.user = null，不报错。
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {Function} next
 * @param {Object} [deps]
 * @param {Object} [deps.env]
 */
export const optionalAuth = (req, res, next, deps = {}) => {
    const sessionId = readSessionCookie(req, deps);
    if (sessionId) {
        const user = loadUserFromSession(sessionId);
        if (user) {
            req.user = user;
            req.sessionId = sessionId;
        }
    }
    if (!req.user) {
        req.user = null;
    }
    next();
};

/**
 * 工厂：返回绑定 deps 的 requireAuth/optionalAuth，便于测试注入 env。
 * Express 中间件签名是 (req, res, next)，故用闭包绑定 deps。
 *
 * @param {Object} deps
 * @returns {{ requireAuth: Function, optionalAuth: Function }}
 */
export const createAuthMiddleware = (deps = {}) => ({
    requireAuth: (req, res, next) => requireAuth(req, res, next, deps),
    optionalAuth: (req, res, next) => optionalAuth(req, res, next, deps)
});