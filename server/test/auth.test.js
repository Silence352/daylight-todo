/**
 * Daylight To-Do v5 — 认证路由测试
 *
 * 覆盖：
 *   - 注册成功 → 200 + Set-Cookie + user（无密码字段）
 *   - 注册重复邮箱 → 409
 *   - 注册非法邮箱 → 400
 *   - 注册短密码 → 400
 *   - 登录成功 → 200 + Set-Cookie
 *   - 登录错误密码 → 401
 *   - 登录不存在邮箱 → 401（统一 INVALID_CREDENTIALS，防用户枚举）
 *   - logout → 清 cookie
 *   - me 未登录 → { user: null }
 *   - me 登录后 → { user: { id, email } }
 *   - 密码明文不出现在任何响应
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
    createTestApp,
    registerAndLogin,
    parseSetCookie,
    cookieHeader,
    fetchJson
} from './helpers.js';

let ctx;

before(async () => {
    ctx = await createTestApp();
});

after(async () => {
    await ctx.close();
});

const randomEmail = () => `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}@test.local`;

// ----------------------------------------
// POST /api/auth/register — 成功
// ----------------------------------------

test('register: 成功 → 200 + Set-Cookie + user（无密码字段）', async () => {
    const email = randomEmail();
    const password = 'valid-password-123';
    const res = await fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.user, 'body.user 存在');
    assert.equal(body.user.email, email);
    assert.ok(body.user.id, 'user.id 存在');
    // 不含密码字段
    assert.equal(body.user.password, undefined);
    assert.equal(body.user.passwordHash, undefined);
    assert.equal(body.user.password_hash, undefined);
    assert.equal(body.user.salt, undefined);
    // Set-Cookie 存在且 HttpOnly
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Set-Cookie 存在');
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /daylight_sid=/);
});

test('register: 邮箱被规范化为小写 + trim', async () => {
    const email = randomEmail().toUpperCase();
    const res = await fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `  ${email}  `, password: 'valid-password-123' })
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.user.email, email.toLowerCase());
});

// ----------------------------------------
// POST /api/auth/register — 错误
// ----------------------------------------

test('register: 重复邮箱 → 409 EMAIL_EXISTS', async () => {
    const email = randomEmail();
    const password = 'valid-password-123';
    // 第一次注册
    await fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    // 第二次：重复
    const res = await fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    assert.equal(res.status, 409);
    assert.equal(body.error, 'EMAIL_EXISTS');
});

test('register: 非法邮箱 → 400 INVALID_EMAIL', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: 'valid-password-123' })
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.error, 'INVALID_EMAIL');
});

test('register: 短密码 → 400 PASSWORD_TOO_SHORT', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: randomEmail(), password: 'short' })
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.error, 'PASSWORD_TOO_SHORT');
    assert.equal(body.min, 8);
});

test('register: 缺 email → 400', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'valid-password-123' })
    });
    assert.equal(res.status, 400);
});

test('register: 缺 password → 400', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: randomEmail() })
    });
    assert.equal(res.status, 400);
});

// ----------------------------------------
// POST /api/auth/login — 成功
// ----------------------------------------

test('login: 正确凭证 → 200 + Set-Cookie + user', async () => {
    const email = randomEmail();
    const password = 'valid-password-123';
    // 先注册
    await fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    // 登录
    const res = await fetch(`${ctx.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.user);
    assert.equal(body.user.email, email);
    assert.ok(res.headers.get('set-cookie'));
});

// ----------------------------------------
// POST /api/auth/login — 错误
// ----------------------------------------

test('login: 错误密码 → 401 INVALID_CREDENTIALS', async () => {
    const email = randomEmail();
    const password = 'valid-password-123';
    await fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const res = await fetch(`${ctx.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'wrong-password' })
    });
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error, 'INVALID_CREDENTIALS');
});

test('login: 不存在邮箱 → 401 INVALID_CREDENTIALS（不暴露用户存在性）', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@test.local', password: 'any-password' })
    });
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error, 'INVALID_CREDENTIALS');
});

test('login: 非法邮箱格式 → 401（统一 INVALID_CREDENTIALS，不暴露格式校验）', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: 'any-password' })
    });
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error, 'INVALID_CREDENTIALS');
});

// ----------------------------------------
// POST /api/auth/logout
// ----------------------------------------

test('logout: 清 cookie + 200', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const res = await fetch(`${ctx.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: cookie }
    });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie);
    // Max-Age=0 表示清除
    assert.match(setCookie, /Max-Age=0/);
});

test('logout: 未登录也返回 200（幂等）', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/auth/logout`, { method: 'POST' });
    assert.equal(res.status, 200);
});

// ----------------------------------------
// GET /api/auth/me
// ----------------------------------------

test('me: 未登录 → 200 { user: null }', async () => {
    const { body, status } = await fetchJson(`${ctx.baseUrl}/api/auth/me`);
    assert.equal(status, 200);
    assert.deepEqual(body, { user: null });
});

test('me: 登录后 → 200 { user: { id, email } }', async () => {
    const { cookie, user } = await registerAndLogin(ctx);
    const { body, status } = await fetchJson(`${ctx.baseUrl}/api/auth/me`, { cookie });
    assert.equal(status, 200);
    assert.equal(body.user.id, user.id);
    assert.equal(body.user.email, user.email);
});

test('me: logout 后 → user: null', async () => {
    const { cookie } = await registerAndLogin(ctx);
    // 退出
    await fetch(`${ctx.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: cookie }
    });
    // 用同一 cookie 再查 me（cookie 已被服务端 session 删除）
    const { body } = await fetchJson(`${ctx.baseUrl}/api/auth/me`, { cookie });
    assert.deepEqual(body, { user: null });
});

test('me: 篡改 cookie → user: null', async () => {
    const tampered = 'daylight_sid=fake-id.fake-signature';
    const { body, status } = await fetchJson(`${ctx.baseUrl}/api/auth/me`, { cookie: tampered });
    assert.equal(status, 200);
    assert.deepEqual(body, { user: null });
});

// ----------------------------------------
// 密码不泄露自审
// ----------------------------------------

test('安全: 任何认证响应都不含密码明文', async () => {
    const password = 'never-leak-this-pwd-xyz';
    const email = randomEmail();
    // 注册
    const regRes = await fetch(`${ctx.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const regBody = await regRes.text();
    assert.doesNotMatch(regBody, new RegExp(password));
    // 登录
    const loginRes = await fetch(`${ctx.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const loginBody = await loginRes.text();
    assert.doesNotMatch(loginBody, new RegExp(password));
    // 错误登录
    const errRes = await fetch(`${ctx.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'wrong' })
    });
    const errBody = await errRes.text();
    assert.doesNotMatch(errBody, /password/i);
    assert.doesNotMatch(errBody, /hash/i);
    assert.doesNotMatch(errBody, /salt/i);
});

test('安全: me 响应不含 password_hash / salt', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { body } = await fetchJson(`${ctx.baseUrl}/api/auth/me`, { cookie });
    const serialized = JSON.stringify(body);
    assert.doesNotMatch(serialized, /password_hash/i);
    assert.doesNotMatch(serialized, /password_salt/i);
    assert.doesNotMatch(serialized, /passwordHash/i);
    assert.doesNotMatch(serialized, /salt/i);
});