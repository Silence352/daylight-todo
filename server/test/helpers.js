/**
 * Daylight To-Do v5 — 测试辅助
 *
 * 职责：
 *   - createTestApp()：创建独立临时 SQLite 文件的 Express app + 启动随机端口 HTTP 服务器
 *   - registerAndLogin(app, opts)：注册并登录，返回 { baseUrl, cookie, user, jar }
 *   - 临时 DB 文件在 closeTestApp() 时清理
 *
 * 设计：
 *   - 每个测试用独立临时 DB 文件，避免跨测试污染
 *   - 用 Node 内置 fetch 起真实 HTTP 服务器（listen(0) 随机端口），最贴近生产行为
 *   - SESSION_SECRET 用固定测试值，避免 env 漂移
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../index.js';
import { closeDb, resetDbForTest } from '../db/database.js';

/** 测试用固定 SESSION_SECRET（绝不与生产共用） */
export const TEST_SESSION_SECRET = 'test-session-secret-do-not-use-in-prod';

/** 测试用 env 模板 */
export const baseTestEnv = (overrides = {}) => ({
    SESSION_SECRET: TEST_SESSION_SECRET,
    NODE_ENV: 'development',
    // 模型配置占位（v4 路由测试用真实 mock，这里仅占位避免误读 process.env）
    MODEL_BASE_URL: 'https://model.example.com',
    MODEL_NAME: 'gpt-4o-mini',
    MODEL_API_KEY: 'test-key',
    ...overrides
});

/**
 * 创建一个临时文件路径（在 OS 临时目录下）。
 * @param {string} [prefix='v5-test-']
 * @returns {string}
 */
const tempDbPath = (prefix = 'v5-test-') => path.join(
    os.tmpdir(),
    `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.db`
);

/**
 * 创建测试 app + 启动 HTTP 服务器。
 *
 * @param {Object} [options]
 * @param {Object} [options.env] - 环境变量覆盖
 * @param {string} [options.dbPath] - 显式 DB 路径（默认临时文件）
 * @param {boolean} [options.memory] - 用 :memory: DB（默认 false，用临时文件以便测试重启后持久化）
 * @returns {Promise<{ app, server, baseUrl, dbPath, env, close }>}
 */
export const createTestApp = async (options = {}) => {
    const dbPath = options.dbPath || (options.memory ? ':memory:' : tempDbPath());
    const env = baseTestEnv({ DB_PATH: dbPath, ...(options.env || {}) });

    // 重置 DB 单例并指向新路径
    resetDbForTest(dbPath);

    const app = createApp({ env, runMigrations: true });

    // 启动随机端口
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const close = async () => {
        await new Promise((resolve) => server.close(resolve));
        closeDb();
        // 清理临时 DB 文件（含 WAL/SHM 副本）
        if (dbPath !== ':memory:') {
            for (const suffix of ['', '-wal', '-shm', '-journal']) {
                try { fs.unlinkSync(dbPath + suffix); } catch { /* ignore */ }
            }
        }
    };

    return { app, server, baseUrl, dbPath, env, close };
};

/**
 * 解析 Set-Cookie 头，返回 cookie 名值映射。
 * 支持单个字符串或数组。
 * @param {string|string[]} setCookie
 * @returns {Object<string, string>}
 */
export const parseSetCookie = (setCookie) => {
    const list = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
    const cookies = {};
    for (const entry of list) {
        const first = entry.split(';')[0];
        const eq = first.indexOf('=');
        if (eq > 0) {
            cookies[first.slice(0, eq).trim()] = first.slice(eq + 1).trim();
        }
    }
    return cookies;
};

/**
 * 把 cookie 映射序列化为 Cookie 请求头字符串。
 * @param {Object<string, string>} cookies
 * @returns {string}
 */
export const cookieHeader = (cookies) => Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

/**
 * 注册并登录（注册成功即自动登录，返回 cookie）。
 *
 * @param {{ baseUrl: string }} ctx
 * @param {Object} [opts]
 * @param {string} [opts.email] - 默认随机邮箱
 * @param {string} [opts.password] - 默认 'test-password-123'
 * @returns {Promise<{ cookie: string, cookies: Object, user: { id: string, email: string }, raw: any }>}
 */
export const registerAndLogin = async (ctx, opts = {}) => {
    const email = opts.email || `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}@test.local`;
    const password = opts.password || 'test-password-123';

    const res = await fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    if (!res.ok) {
        throw new Error(`register failed (${res.status}): ${JSON.stringify(body)}`);
    }
    const cookies = parseSetCookie(res.headers.get('set-cookie'));
    const cookie = cookieHeader(cookies);
    return { cookie, cookies, user: body.user, raw: body };
};

/**
 * 用给定 cookie 调用 fetch，返回响应 + 解析后的 json。
 *
 * @param {string} url
 * @param {Object} [options]
 * @param {string} [options.cookie]
 * @returns {Promise<{ res, body, status }>}
 */
export const fetchJson = async (url, options = {}) => {
    const { cookie, headers, ...rest } = options;
    const finalHeaders = { ...(headers || {}) };
    if (cookie) finalHeaders.Cookie = cookie;
    const res = await fetch(url, { ...rest, headers: finalHeaders });
    let body;
    try { body = await res.json(); } catch { body = null; }
    return { res, body, status: res.status };
};