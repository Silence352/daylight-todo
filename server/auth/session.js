/**
 * Daylight To-Do v5 — 会话管理
 *
 * 职责：
 *   - createSession(userId)：生成随机 session id，写入 sessions 表，7 天过期，返回 id
 *   - getSession(sessionId)：查 sessions 表，过期则删除并返回 null
 *   - destroySession(sessionId)：删除 session
 *   - setSessionCookie / clearSessionCookie / readSessionCookie：HttpOnly cookie 读写
 *
 * 安全：
 *   - cookie HttpOnly + SameSite=Lax + Secure(生产) + Max-Age=7天 + Path=/
 *   - SESSION_SECRET 从 env 读，用 HMAC-SHA256 对 session id 签名，cookie 存"签名值"
 *     防止客户端篡改 session id
 *   - 不引入 express-session 等第三方库
 */

import crypto from 'node:crypto';
import { getDb } from '../db/database.js';

/** 会话有效期：7 天（秒） */
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
/** cookie 名 */
export const SESSION_COOKIE_NAME = 'daylight_sid';

/**
 * 读取 SESSION_SECRET；若未设置则用开发默认值并警告（生产必须设置）。
 * @param {Object} [env]
 * @returns {string}
 */
const getSessionSecret = (env = process.env) => {
    const secret = env.SESSION_SECRET;
    if (!secret) {
        if (env.NODE_ENV === 'production') {
            // 生产环境缺密钥是严重问题；但仍返回一个值让进程能启动，
            // 由部署方尽快补上 SESSION_SECRET
            console.error('[v5] WARNING: SESSION_SECRET not set in production!');
        }
        return 'dev-insecure-session-secret-change-me';
    }
    return secret;
};

/**
 * 用 HMAC-SHA256 对 session id 签名，返回 hex 签名值（作为 cookie 值）。
 * @param {string} sessionId
 * @param {string} secret
 * @returns {string}
 */
const signSessionId = (sessionId, secret) => {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(sessionId);
    return `${sessionId}.${hmac.digest('hex')}`;
};

/**
 * 验证签名值并返回原始 session id；无效返回 null。
 * 用 timingSafeEqual 做常量时间比较。
 * @param {string} signedValue
 * @param {string} secret
 * @returns {string|null}
 */
const verifySignedSessionId = (signedValue, secret) => {
    if (typeof signedValue !== 'string') return null;
    const dot = signedValue.lastIndexOf('.');
    if (dot <= 0 || dot === signedValue.length - 1) return null;
    const sessionId = signedValue.slice(0, dot);
    const sig = signedValue.slice(dot + 1);
    const expected = crypto.createHmac('sha256', secret).update(sessionId).digest('hex');
    try {
        const sigBuf = Buffer.from(sig, 'hex');
        const expBuf = Buffer.from(expected, 'hex');
        if (sigBuf.length !== expBuf.length) return null;
        if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
        return sessionId;
    } catch {
        return null;
    }
};

/**
 * 生成随机 session id（32 字节 hex）。
 * @returns {string}
 */
const generateSessionId = () => crypto.randomBytes(32).toString('hex');

/**
 * 创建会话：写入 sessions 表，返回 session id（未签名）。
 *
 * @param {string} userId
 * @param {Object} [deps]
 * @param {Object} [deps.env]
 * @returns {string} session id
 */
export const createSession = (userId, deps = {}) => {
    const db = getDb();
    const id = generateSessionId();
    const now = new Date();
    const createdAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();

    db.prepare(
        `INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`
    ).run(id, userId, createdAt, expiresAt);

    return id;
};

/**
 * 查询会话：未过期返回 { id, userId, createdAt, expiresAt }，过期/不存在返回 null。
 * 过期会话会被删除。
 *
 * @param {string} sessionId
 * @returns {{ id: string, userId: string, createdAt: string, expiresAt: string } | null}
 */
export const getSession = (sessionId) => {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return null;
    const db = getDb();
    const row = db.prepare(
        `SELECT id, user_id, created_at, expires_at FROM sessions WHERE id = ?`
    ).get(sessionId);

    if (!row) return null;

    // 过期检查
    if (new Date(row.expires_at).getTime() <= Date.now()) {
        db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
        return null;
    }

    return {
        id: row.id,
        userId: row.user_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at
    };
};

/**
 * 删除会话。
 * @param {string} sessionId
 */
export const destroySession = (sessionId) => {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return;
    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
};

/**
 * 设置会话 cookie：签名 session id 后写入 Set-Cookie。
 *
 * @param {import('express').Response} res
 * @param {string} sessionId
 * @param {Object} [deps]
 * @param {Object} [deps.env]
 */
export const setSessionCookie = (res, sessionId, deps = {}) => {
    const env = deps.env || process.env;
    const secret = getSessionSecret(env);
    const signed = signSessionId(sessionId, secret);
    const parts = [
        `${SESSION_COOKIE_NAME}=${signed}`,
        'Path=/',
        `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
        'HttpOnly',
        'SameSite=Lax'
    ];
    if (env.NODE_ENV === 'production') {
        parts.push('Secure');
    }
    res.setHeader('Set-Cookie', parts.join('; '));
};

/**
 * 清除会话 cookie：同名 cookie 立即过期。
 *
 * @param {import('express').Response} res
 * @param {Object} [deps]
 * @param {Object} [deps.env]
 */
export const clearSessionCookie = (res, deps = {}) => {
    const env = deps.env || process.env;
    const parts = [
        `${SESSION_COOKIE_NAME}=`,
        'Path=/',
        'Max-Age=0',
        'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
        'HttpOnly',
        'SameSite=Lax'
    ];
    if (env.NODE_ENV === 'production') {
        parts.push('Secure');
    }
    res.setHeader('Set-Cookie', parts.join('; '));
};

/**
 * 从请求 Cookie 头读出已签名的 session id，验证签名后返回原始 session id。
 * 无效或缺失返回 null。
 *
 * @param {import('express').Request} req
 * @param {Object} [deps]
 * @param {Object} [deps.env]
 * @returns {string|null}
 */
export const readSessionCookie = (req, deps = {}) => {
    const env = deps.env || process.env;
    const secret = getSessionSecret(env);
    const cookieHeader = req.headers && req.headers.cookie;
    if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) return null;

    // 简单解析 Cookie 头（不引 cookie 包）
    const cookies = {};
    for (const part of cookieHeader.split(';')) {
        const eq = part.indexOf('=');
        if (eq > 0) {
            const key = part.slice(0, eq).trim();
            const val = part.slice(eq + 1).trim();
            cookies[key] = val;
        }
    }

    const signed = cookies[SESSION_COOKIE_NAME];
    if (!signed) return null;
    return verifySignedSessionId(signed, secret);
};

/**
 * 返回会话有效期（秒），供测试断言。
 * @returns {number}
 */
export const getSessionMaxAge = () => SESSION_MAX_AGE_SECONDS;