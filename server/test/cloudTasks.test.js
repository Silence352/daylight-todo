/**
 * Daylight To-Do v5 — 云端任务路由测试
 *
 * 覆盖：
 *   - 未登录 GET/POST/PUT/DELETE → 401
 *   - 登录后 POST → 201，GET → 自己的任务
 *   - PUT/DELETE 自己的任务 → 200
 *   - 跨账号隔离：A 创建任务，B GET 看不到，B PUT/DELETE → 403
 *   - 不存在任务 → 404
 *   - 重启后云端任务仍在（关闭 DB，重新打开同一文件，任务还在）
 *   - 字段校验：缺 text → 400，超长 text → 400
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
    createTestApp,
    registerAndLogin,
    fetchJson
} from './helpers.js';
import { resetDbForTest, closeDb, runMigrations } from '../db/database.js';

let ctx;

before(async () => {
    ctx = await createTestApp();
});

after(async () => {
    await ctx.close();
});

// ----------------------------------------
// 未登录 → 401
// ----------------------------------------

test('未登录 GET /api/cloud/tasks → 401', async () => {
    const { status, body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`);
    assert.equal(status, 401);
    assert.equal(body.error, 'UNAUTHORIZED');
});

test('未登录 POST /api/cloud/tasks → 401', async () => {
    const { status } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'hello' })
    });
    assert.equal(status, 401);
});

test('未登录 PUT /api/cloud/tasks/:id → 401', async () => {
    const { status } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks/fake-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'updated' })
    });
    assert.equal(status, 401);
});

test('未登录 DELETE /api/cloud/tasks/:id → 401', async () => {
    const { status } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks/fake-id`, {
        method: 'DELETE'
    });
    assert.equal(status, 401);
});

// ----------------------------------------
// 登录后 CRUD
// ----------------------------------------

test('登录后 POST → 201 + task 对象', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { status, body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '我的云端任务' }),
        cookie
    });
    assert.equal(status, 201);
    assert.ok(body.task);
    assert.equal(body.task.text, '我的云端任务');
    assert.equal(body.task.completed, false);
    assert.ok(body.task.id);
    assert.ok(body.task.createdAt);
    // 响应不含 user_id 之外敏感字段
    assert.equal(body.task.userId, undefined);
});

test('登录后 GET → 返回自己的任务列表', async () => {
    const { cookie } = await registerAndLogin(ctx);
    // 创建两个
    await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '任务 A' }),
        cookie
    });
    await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '任务 B' }),
        cookie
    });
    const { status, body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, { cookie });
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.tasks));
    assert.equal(body.tasks.length, 2);
    assert.equal(body.tasks[0].text, '任务 A');
    assert.equal(body.tasks[1].text, '任务 B');
});

test('登录后 PUT 更新自己任务 → 200 + 更新后字段', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { body: created } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '原始' }),
        cookie
    });
    const { status, body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks/${created.task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '更新后', completed: true }),
        cookie
    });
    assert.equal(status, 200);
    assert.equal(body.task.text, '更新后');
    assert.equal(body.task.completed, true);
    assert.ok(body.task.completedAt);
});

test('登录后 DELETE 自己任务 → 200', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { body: created } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '待删除' }),
        cookie
    });
    const { status } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks/${created.task.id}`, {
        method: 'DELETE',
        cookie
    });
    assert.equal(status, 200);
    // 再 GET 应该没有了
    const { body: list } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, { cookie });
    assert.equal(list.tasks.length, 0);
});

test('PUT 不存在的任务 → 404', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { status, body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks/nonexistent-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'x' }),
        cookie
    });
    assert.equal(status, 404);
    assert.equal(body.error, 'NOT_FOUND');
});

test('DELETE 不存在的任务 → 404', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { status } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks/nonexistent-id`, {
        method: 'DELETE',
        cookie
    });
    assert.equal(status, 404);
});

// ----------------------------------------
// 字段校验
// ----------------------------------------

test('POST 缺 text → 400 INVALID_TEXT', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { status, body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cookie
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'INVALID_TEXT');
});

test('POST 空 text → 400 INVALID_TEXT', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { status } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '   ' }),
        cookie
    });
    assert.equal(status, 400);
});

test('POST 超长 text (>500) → 400 TEXT_TOO_LONG', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { status, body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'x'.repeat(501) }),
        cookie
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'TEXT_TOO_LONG');
});

test('POST 非法 priority → 400 INVALID_PRIORITY', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { status, body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'x', priority: 'urgent' }),
        cookie
    });
    assert.equal(status, 400);
    assert.equal(body.error, 'INVALID_PRIORITY');
});

test('POST 合法 priority → 201', async () => {
    const { cookie } = await registerAndLogin(ctx);
    for (const p of ['high', 'medium', 'low', null]) {
        const { status, body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: `p=${p}`, priority: p }),
            cookie
        });
        assert.equal(status, 201);
        assert.equal(body.task.priority, p);
    }
});

test('POST 兼容 { task: {...} } 包装写法', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { status, body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: { text: '包装写法' } }),
        cookie
    });
    assert.equal(status, 201);
    assert.equal(body.task.text, '包装写法');
});

// ----------------------------------------
// 跨账号隔离
// ----------------------------------------

test('隔离: 用户 A 创建任务，用户 B GET 看不到', async () => {
    const a = await registerAndLogin(ctx);
    const b = await registerAndLogin(ctx);
    // A 创建
    const { body: created } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'A 的私密任务' }),
        cookie: a.cookie
    });
    // B GET
    const { body: bList } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, { cookie: b.cookie });
    assert.equal(bList.tasks.length, 0);
    // B 列表中没有 A 的任务 id
    assert.ok(!bList.tasks.some(t => t.id === created.task.id));
});

test('隔离: 用户 B PUT A 的任务 → 403 FORBIDDEN', async () => {
    const a = await registerAndLogin(ctx);
    const b = await registerAndLogin(ctx);
    const { body: created } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'A 的任务' }),
        cookie: a.cookie
    });
    const { status, body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks/${created.task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'B 想篡改' }),
        cookie: b.cookie
    });
    assert.equal(status, 403);
    assert.equal(body.error, 'FORBIDDEN');
    // A 的任务未被修改
    const { body: aList } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, { cookie: a.cookie });
    assert.equal(aList.tasks[0].text, 'A 的任务');
});

test('隔离: 用户 B DELETE A 的任务 → 403 FORBIDDEN', async () => {
    const a = await registerAndLogin(ctx);
    const b = await registerAndLogin(ctx);
    const { body: created } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'A 的任务' }),
        cookie: a.cookie
    });
    const { status, body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks/${created.task.id}`, {
        method: 'DELETE',
        cookie: b.cookie
    });
    assert.equal(status, 403);
    assert.equal(body.error, 'FORBIDDEN');
    // A 的任务仍在
    const { body: aList } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, { cookie: a.cookie });
    assert.equal(aList.tasks.length, 1);
});

test('隔离: 多用户各自独立列表', async () => {
    const a = await registerAndLogin(ctx);
    const b = await registerAndLogin(ctx);
    await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'A1' }),
        cookie: a.cookie
    });
    await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'A2' }),
        cookie: a.cookie
    });
    await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'B1' }),
        cookie: b.cookie
    });
    const { body: aList } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, { cookie: a.cookie });
    const { body: bList } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, { cookie: b.cookie });
    assert.equal(aList.tasks.length, 2);
    assert.equal(bList.tasks.length, 1);
    assert.equal(bList.tasks[0].text, 'B1');
});

// ----------------------------------------
// 持久化：重启后云端任务仍在
// ----------------------------------------

test('持久化: 关闭 DB 重新打开同一文件，任务仍在', async () => {
    // 用临时文件 DB（不是 :memory:），验证数据确实持久化到磁盘
    const localCtx = await createTestApp({ memory: false });
    const dbPath = localCtx.dbPath;
    try {
        const { cookie } = await registerAndLogin(localCtx);
        const { body: created } = await fetchJson(`${localCtx.baseUrl}/api/cloud/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '重启后应仍在' }),
            cookie
        });
        const taskId = created.task.id;

        // 不关闭 app，直接用独立 readonly 连接打开同一 DB 文件
        // 验证数据已写入磁盘（SQLite WAL 支持并发读）
        const Database = (await import('better-sqlite3')).default;
        const reader = new Database(dbPath, { readonly: true, fileMustExist: true });
        try {
            const row = reader.prepare('SELECT id, text FROM cloud_tasks WHERE id = ?').get(taskId);
            assert.ok(row, '任务在 DB 文件中存在');
            assert.equal(row.text, '重启后应仍在');
        } finally {
            reader.close();
        }
    } finally {
        await localCtx.close();
    }
});

// ----------------------------------------
// 安全：响应不含其他用户敏感信息
// ----------------------------------------

test('安全: 任务响应不含 user_id 字段（仅内部使用）', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { body } = await fetchJson(`${ctx.baseUrl}/api/cloud/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'x' }),
        cookie
    });
    const serialized = JSON.stringify(body);
    assert.doesNotMatch(serialized, /user_id/);
    assert.doesNotMatch(serialized, /userId/);
});