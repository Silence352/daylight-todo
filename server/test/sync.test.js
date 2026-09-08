/**
 * Daylight To-Do v6 — 本地→云端同步路由测试
 *
 * 覆盖：
 *   1. 未登录 → 401
 *   2. 首次同步：3 个任务 → { added: 3, skipped: 0, total: 3 }
 *   3. 云端已有 1 个：sync 3 个（含已存在 id）→ { added: 2, skipped: 1, total: 3 }
 *   4. 重复同步同一批：第二次 → { added: 0, skipped: 3, total: 3 }
 *   5. 重复同步 N 次：云端总数不变，不创建副本
 *   6. 云端任务不被覆盖：先 POST {text:'原始'} → sync 同 id {text:'修改后'} → 云端仍为 '原始'
 *   7. 空数组 → { added: 0, skipped: 0, total: K }
 *   8. 跨账号隔离：A sync → B sync 同 id → 两人各有自己的副本
 *   9. 非法任务（缺 id / 缺 text）被忽略，不计数
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
    createTestApp,
    registerAndLogin,
    fetchJson
} from './helpers.js';

let ctx;

before(async () => {
    ctx = await createTestApp();
});

after(async () => {
    await ctx.close();
});

/**
 * 构造一个本地任务对象（与前端 state.todos 结构对齐）
 * @param {Object} [overrides]
 * @returns {Object}
 */
const makeLocalTask = (overrides = {}) => ({
    id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    text: '本地任务',
    completed: false,
    createdAt: new Date().toISOString(),
    projectId: null,
    priority: 'medium',
    dueDate: null,
    estimateMinutes: null,
    focused: false,
    completedAt: null,
    ...overrides
});

const syncUrl = (ctx) => `${ctx.baseUrl}/api/cloud/sync`;
const cloudTasksUrl = (ctx) => `${ctx.baseUrl}/api/cloud/tasks`;

// ----------------------------------------
// 1. 未登录 → 401
// ----------------------------------------

test('未登录 POST /api/cloud/sync → 401', async () => {
    const { status, body } = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: [makeLocalTask()] })
    });
    assert.equal(status, 401);
    assert.equal(body.error, 'UNAUTHORIZED');
});

// ----------------------------------------
// 2. 首次同步
// ----------------------------------------

test('首次同步 3 个任务 → { added: 3, skipped: 0, total: 3 }', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const tasks = [
        makeLocalTask({ text: '任务一' }),
        makeLocalTask({ text: '任务二' }),
        makeLocalTask({ text: '任务三' })
    ];
    const { status, body } = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
        cookie
    });
    assert.equal(status, 200);
    assert.equal(body.added, 3);
    assert.equal(body.skipped, 0);
    assert.equal(body.total, 3);
});

// ----------------------------------------
// 3. 云端已有任务
// ----------------------------------------

test('云端已有 1 个：sync 3 个（含已存在 id）→ { added: 2, skipped: 1, total: 3 }', async () => {
    const { cookie } = await registerAndLogin(ctx);
    // 先 POST 1 个到云端（服务端生成 id）
    const { body: created } = await fetchJson(cloudTasksUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '已在云端' }),
        cookie
    });
    const existingId = created.task.id;

    // sync 3 个，其中 1 个 id = 已存在的，另 2 个新 id
    const tasks = [
        makeLocalTask({ id: existingId, text: '已在云端' }),
        makeLocalTask({ text: '新增 A' }),
        makeLocalTask({ text: '新增 B' })
    ];
    const { status, body } = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
        cookie
    });
    assert.equal(status, 200);
    assert.equal(body.added, 2);
    assert.equal(body.skipped, 1);
    assert.equal(body.total, 3);
});

// ----------------------------------------
// 4. 重复同步同一批
// ----------------------------------------

test('重复同步同一批：第二次 → { added: 0, skipped: 3, total: 3 }', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const tasks = [
        makeLocalTask({ text: '重复一' }),
        makeLocalTask({ text: '重复二' }),
        makeLocalTask({ text: '重复三' })
    ];
    // 第一次
    const r1 = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
        cookie
    });
    assert.equal(r1.status, 200);
    assert.equal(r1.body.added, 3);
    // 第二次（同一批）
    const r2 = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
        cookie
    });
    assert.equal(r2.status, 200);
    assert.equal(r2.body.added, 0);
    assert.equal(r2.body.skipped, 3);
    assert.equal(r2.body.total, 3);
});

// ----------------------------------------
// 5. 重复同步 N 次，云端总数不变
// ----------------------------------------

test('重复同步 N 次：云端总数不变，不创建副本', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const tasks = [
        makeLocalTask({ text: '幂等一' }),
        makeLocalTask({ text: '幂等二' })
    ];
    for (let i = 0; i < 5; i += 1) {
        const { status, body } = await fetchJson(syncUrl(ctx), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks }),
            cookie
        });
        assert.equal(status, 200);
        assert.equal(body.total, 2, `第 ${i + 1} 次同步后云端总数应仍为 2`);
    }
    // 最终 GET 确认只有 2 条
    const { body: list } = await fetchJson(cloudTasksUrl(ctx), { cookie });
    assert.equal(list.tasks.length, 2);
});

// ----------------------------------------
// 6. 云端任务不被覆盖
// ----------------------------------------

test('云端任务不被覆盖：sync 同 id 不同 text → 云端 text 不变', async () => {
    const { cookie } = await registerAndLogin(ctx);
    // 先 POST 一个到云端
    const { body: created } = await fetchJson(cloudTasksUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '原始' }),
        cookie
    });
    const existingId = created.task.id;

    // sync 同 id 但 text 改了
    const { status, body } = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: [makeLocalTask({ id: existingId, text: '修改后' })] }),
        cookie
    });
    assert.equal(status, 200);
    assert.equal(body.added, 0);
    assert.equal(body.skipped, 1);

    // 云端该任务 text 仍为 '原始'
    const { body: list } = await fetchJson(cloudTasksUrl(ctx), { cookie });
    const task = list.tasks.find(t => t.id === existingId);
    assert.ok(task, '云端应仍有该任务');
    assert.equal(task.text, '原始', '云端 text 不应被覆盖');
});

// ----------------------------------------
// 7. 空数组
// ----------------------------------------

test('空数组 → { added: 0, skipped: 0, total: K }', async () => {
    const { cookie } = await registerAndLogin(ctx);
    // 先 sync 2 个建立基线
    await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: [makeLocalTask(), makeLocalTask()] }),
        cookie
    });
    // 再 sync 空数组
    const { status, body } = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: [] }),
        cookie
    });
    assert.equal(status, 200);
    assert.equal(body.added, 0);
    assert.equal(body.skipped, 0);
    assert.equal(body.total, 2);
});

test('空数组（全新用户）→ { added: 0, skipped: 0, total: 0 }', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { status, body } = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: [] }),
        cookie
    });
    assert.equal(status, 200);
    assert.equal(body.added, 0);
    assert.equal(body.skipped, 0);
    assert.equal(body.total, 0);
});

// ----------------------------------------
// 8. 跨账号隔离
// ----------------------------------------

test('跨账号隔离：A sync → B sync 同 id → 两人各有副本', async () => {
    const a = await registerAndLogin(ctx);
    const b = await registerAndLogin(ctx);
    const sharedId = `shared-${Date.now().toString(36)}`;
    const taskA = makeLocalTask({ id: sharedId, text: 'A 的副本' });
    const taskB = makeLocalTask({ id: sharedId, text: 'B 的副本' });

    // A sync
    const ra = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: [taskA] }),
        cookie: a.cookie
    });
    assert.equal(ra.status, 200);
    assert.equal(ra.body.added, 1);
    assert.equal(ra.body.total, 1);

    // B sync 同 id
    const rb = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: [taskB] }),
        cookie: b.cookie
    });
    assert.equal(rb.status, 200);
    assert.equal(rb.body.added, 1, 'B 应能新增同 id 任务（不同 user_id）');
    assert.equal(rb.body.total, 1);

    // 两人各有自己的副本，text 各自独立
    const { body: aList } = await fetchJson(cloudTasksUrl(ctx), { cookie: a.cookie });
    const { body: bList } = await fetchJson(cloudTasksUrl(ctx), { cookie: b.cookie });
    assert.equal(aList.tasks.length, 1);
    assert.equal(bList.tasks.length, 1);
    assert.equal(aList.tasks[0].id, sharedId);
    assert.equal(bList.tasks[0].id, sharedId);
    assert.equal(aList.tasks[0].text, 'A 的副本');
    assert.equal(bList.tasks[0].text, 'B 的副本');
});

// ----------------------------------------
// 9. 非法任务被忽略
// ----------------------------------------

test('非法任务（缺 id / 缺 text / 非对象）被忽略，不计数', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const tasks = [
        makeLocalTask({ text: '合法任务' }),
        { text: '缺 id' },               // 缺 id → 忽略
        { id: 'has-id', text: '' },       // 空 text → 忽略
        { id: 'has-id-2', text: '   ' },  // 空白 text → 忽略
        null,                             // 非对象 → 忽略
        'string',                         // 非对象 → 忽略
        42                                // 非对象 → 忽略
    ];
    const { status, body } = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
        cookie
    });
    assert.equal(status, 200);
    assert.equal(body.added, 1, '只有 1 个合法任务被新增');
    assert.equal(body.skipped, 0);
    assert.equal(body.total, 1);
});

// ----------------------------------------
// 10. 字段映射：本地 camelCase → 云端字段
// ----------------------------------------

test('字段映射：本地任务字段正确写入云端', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const fixedId = `map-${Date.now().toString(36)}`;
    const task = makeLocalTask({
        id: fixedId,
        text: '字段映射测试',
        completed: true,
        priority: 'high',
        dueDate: '2026-12-31',
        estimateMinutes: 30,
        focused: true,
        projectId: 'proj-1'
    });
    const { status, body } = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: [task] }),
        cookie
    });
    assert.equal(status, 200);
    assert.equal(body.added, 1);

    const { body: list } = await fetchJson(cloudTasksUrl(ctx), { cookie });
    const synced = list.tasks.find(t => t.id === fixedId);
    assert.ok(synced);
    assert.equal(synced.text, '字段映射测试');
    assert.equal(synced.completed, true);
    assert.equal(synced.priority, 'high');
    assert.equal(synced.dueDate, '2026-12-31');
    assert.equal(synced.estimateMinutes, 30);
    assert.equal(synced.focused, true);
    assert.equal(synced.projectId, 'proj-1');
    assert.ok(synced.completedAt, 'completed 任务应有 completedAt');
});

// ----------------------------------------
// 11. body.tasks 非数组 → 视为空
// ----------------------------------------

test('body.tasks 缺失 → 视为空数组 → { added: 0, skipped: 0, total: 0 }', async () => {
    const { cookie } = await registerAndLogin(ctx);
    const { status, body } = await fetchJson(syncUrl(ctx), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        cookie
    });
    assert.equal(status, 200);
    assert.equal(body.added, 0);
    assert.equal(body.skipped, 0);
    assert.equal(body.total, 0);
});