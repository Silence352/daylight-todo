/**
 * Daylight To-Do v5 — 认证路由
 *
 * 端点：
 *   - POST /api/auth/register  { email, password } → 200 { user: { id, email } } + cookie
 *   - POST /api/auth/login     { email, password } → 200 { user } + cookie
 *   - POST /api/auth/logout    → 200 + 清 cookie
 *   - GET  /api/auth/me        → 200 { user: null } 或 200 { user: { id, email } }
 *
 * 错误1:
 *   - 邮箱已存在 → 409 { error: 'EMAIL_EXISTS' }
 *   - 凭证错误   → 401 { error: 'INVALID_CREDENTIALS' }
 *   - 校验失败   → 400 { error: 'INVALID_EMAIL' | 'PASSWORD_TOO_SHORT' | 'PASSWORD_MISMATCH' }
 *
 * 安全：
 *   - **错误响应不含密码或 hash**
 *   - 登录失败不区分"邮箱不存在"与"密码错误"，统一 INVALID_CREDENTIALS（防用户枚举）
 *   - 响应只返回 { id, email }，绝不返回 password_hash/salt
 */

import express from 'express';
import crypto from 'node:crypto';
import { getDb } from '../db/database.js';
import {
    hashPassword,
    verifyPassword,
    validateEmail,
    validatePassword,
    getPasswordMinLength
} from '../auth/password.js';
import {
    createSession,
    destroySession,
    setSessionCookie,
    clearSessionCookie,
    readSessionCookie
} from '../auth/session.js';
import { createAuthMiddleware } from '../auth/middleware.js';

/**
 * 生成用户 id（32 字节 hex）。
 * @returns {string}
 */
const generateUserId = () => crypto.randomBytes(16).toString('hex');

/**
 * 构造认证路由器。
 *
 * @param {Object} [deps]
 * @param {Object} [deps.env] - 环境变量（默认 process.env）
 * @returns {import('express').Router}
 */
export const createAuthRouter = (deps = {}) => {
    const env = deps.env || process.env;
    const router = express.Router();
    const { optionalAuth } = createAuthMiddleware({ env });

    // ------------------------------
    // POST /api/auth/register
    // ------------------------------
    router.post('/register', async (req, res) => {
        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        const emailRaw = typeof body.email === 'string' ? body.email : '';
        const password = typeof body.password === 'string' ? body.password : '';

        // 校验邮箱
        const emailCheck = validateEmail(emailRaw);
        if (!emailCheck.valid) {
            res.status(400).json({ error: 'INVALID_EMAIL' });
            return;
        }
        const email = emailCheck.value;

        // 校验密码
        const pwdCheck = validatePassword(password);
        if (!pwdCheck.valid) {
            res.status(400).json({
                error: 'PASSWORD_TOO_SHORT',
                min: getPasswordMinLength()
            });
            return;
        }

        // 查重（邮箱唯一）
        const db = getDb();
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            res.status(409).json({ error: 'EMAIL_EXISTS' });
            return;
        }

        // 摘要密码（绝不存明文）
        let hashed;
        try {
            hashed = await hashPassword(password);
        } catch {
            res.status(500).json({ error: 'INTERNAL' });
            return;
        }

        // 写入用户
        const userId = generateUserId();
        const createdAt = new Date().toISOString();
        try {
            db.prepare(
                `INSERT INTO users (id, email, password_hash, password_salt, created_at)
                 VALUES (?, ?, ?, ?, ?)`
            ).run(userId, email, hashed.hash, hashed.salt, createdAt);
        } catch (err) {
            // 并BETTER-sqlite3 唯一约束冲突也会到这里，统一 409
            if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                res.status(409).json({ error: 'EMAIL_EXISTS' });
                return;
            }
            res.status(500).json({ error: 'INTERNAL' });
            return;
        }

        // 创建会话并设置 cookie
        const sessionId = createSession(userId, { env });
        setSessionCookie(res, sessionId, { env });

        // 响应只含 { id, email }，绝不返回密码/hash
        res.status(200).json({ user: { id: userId, email } });
    });

    // ------------------------------
    // POST /api/auth/login
    // ------------------------------
    router.post('/login', async (req, res) => {
        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        const emailRaw = typeof body.email === 'string' ? body.email : '';
        const password = typeof body.password === 'string' ? body.password : '';

        const emailCheck = validateEmail(emailRaw);
        if (!emailCheck.valid) {
            // 邮箱格式错也用 INVALID_CREDENTIALS，避免用户枚举
            res.status(401).json({ error: 'INVALID_CREDENTIALS' });
            return;
        }
        const email = emailCheck.value;

        const db = getDb();
        const row = db.prepare(
            'SELECT id, email, password_hash, password_salt FROM users WHERE email = ?'
        ).get(email);

        // 用户不存在：统一 INVALID_CREDENTIALS
        if (!row) {
            res.status(401).json({ error: 'INVALID_CREDENTIALS' });
            return;
        }

        // 校验密码
        const ok = await verifyPassword(password, row.password_hash, row.password_salt);
        if (!ok) {
            res.status(401).json({ error: 'INVALID_CREDENTIALS' });
            return;
        }

        // 创建会话并设置 cookie
        const sessionId = createSession(row.id, { env });
        setSessionCookie(res, sessionId, { env });

        res.status(200).json({ user: { id: row.id, email: row.email } });
    });

    // ------------------------------
    // POST /api/auth/logout
    // ------------------------------
    router.post('/logout', (req, res) => {
        const sessionId = readSessionCookie(req, { env });
        if (sessionId) {
            destroySession(sessionId);
        }
        clearSessionCookie(res, { env });
        res.status(200).json({ ok: true });
    });

    // ------------------------------
    // GET /api/auth/me
    // ------------------------------
    router.get('/me', optionalAuth, (req, res) => {
        if (req.user) {
            res.status(200).json({ user: { id: req.user.id, email: req.user.email } });
        } else {
            res.status(200).json({ user: null });
        }
    });

    return router;
};