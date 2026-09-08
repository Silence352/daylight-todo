/**
 * taskExtractions 路由处理函数测试（node:test + node:assert）
 *
 * 不启动 express，直接调用 createTaskExtractionsHandler 返回的纯函数，
 * 用 mock req/res 验证 status 与 json 响应。这样测试不依赖 express 的 HTTP 层。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTaskExtractionsHandler } from '../routes/taskExtractions.js';

const VALID_ENV = {
    MODEL_BASE_URL: 'https://model.example.com',
    MODEL_NAME: 'gpt-4o-mini',
    MODEL_API_KEY: 'sk-test-key-123'
};

/**
 * 构造一个 mock res：捕获 status() 与 json() 调用
 * @returns {{ status: Function, json: Function, statusCode: number, body: Object }}
 */
const mockRes = () => {
    const r = { statusCode: 200, body: null };
    r.status = (code) => { r.statusCode = code; return r; };
    r.json = (obj) => { r.body = obj; return r; };
    return r;
};

const mockReq = (body = {}, headers = {}) => ({ body, headers });

/** 一个返回合法草稿的 fetchImpl */
const successFetch = (content) => async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] })
});

// ----------------------------------------
// 400 空描述
// ----------------------------------------

test('handler: description 为空 → 400 EMPTY_DESCRIPTION', async () => {
    const handler = createTaskExtractionsHandler({ env: VALID_ENV });
    const req = mockReq({ description: '   ' });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'EMPTY_DESCRIPTION');
});

test('handler: description 缺失 → 400 EMPTY_DESCRIPTION', async () => {
    const handler = createTaskExtractionsHandler({ env: VALID_ENV });
    const req = mockReq({});
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
});

test('handler: body 为空对象 → 400', async () => {
    const handler = createTaskExtractionsHandler({ env: VALID_ENV });
    const req = mockReq();
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
});

// ----------------------------------------
// 503 未配置
// ----------------------------------------

test('handler: 模型未配置 → 503 MODEL_NOT_CONFIGURED', async () => {
    const handler = createTaskExtractionsHandler({
        env: { ...VALID_ENV, MODEL_API_KEY: '' }
    });
    const req = mockReq({ description: '写报告' });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error, 'MODEL_NOT_CONFIGURED');
});

// ----------------------------------------
// 502 模型错误
// ----------------------------------------

test('handler: 模型返回 500 → 502 MODEL_ERROR', async () => {
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const handler = createTaskExtractionsHandler({ env: VALID_ENV, fetchImpl });
    const req = mockReq({ description: '写报告' });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'MODEL_ERROR');
});

test('handler: 模型返回无效 JSON → 502 MODEL_ERROR', async () => {
    const fetchImpl = successFetch('完全不是 JSON');
    const handler = createTaskExtractionsHandler({ env: VALID_ENV, fetchImpl });
    const req = mockReq({ description: '写报告' });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.error, 'MODEL_ERROR');
});

test('handler: 模型返回空 tasks → 502 MODEL_ERROR', async () => {
    const fetchImpl = successFetch('{"tasks":[]}');
    const handler = createTaskExtractionsHandler({ env: VALID_ENV, fetchImpl });
    const req = mockReq({ description: '写报告' });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 502);
});

// ----------------------------------------
// 200 成功
// ----------------------------------------

test('handler: 模型返回合法草稿 → 200 + 规范化 tasks', async () => {
    const content = JSON.stringify({
        tasks: [
            { title: '写季度报告', project: '财务', priority: 'high', dueDate: '2026-09-30', estimatedMinutes: 90 },
            { title: '发邮件' }
        ]
    });
    const handler = createTaskExtractionsHandler({
        env: VALID_ENV,
        fetchImpl: successFetch(content)
    });
    const req = mockReq({ description: '准备季度汇报' });
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.tasks.length, 2);
    assert.equal(res.body.tasks[0].title, '写季度报告');
    assert.equal(res.body.tasks[0].priority, 'high');
    assert.equal(res.body.tasks[1].priority, 'medium');
    assert.equal(res.body.tasks[1].estimatedMinutes, 25);
});

// ----------------------------------------
// 密钥不泄露
// ----------------------------------------

test('handler: 任何错误响应都不包含密钥', async () => {
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
    const handler = createTaskExtractionsHandler({ env: VALID_ENV, fetchImpl });
    const req = mockReq({ description: 'x' });
    const res = mockRes();
    await handler(req, res);
    assert.doesNotMatch(JSON.stringify(res.body), /sk-test-key-123/);
});

// ----------------------------------------
// 双语 message
// ----------------------------------------

test('handler: Accept-Language=en → message 为英文', async () => {
    const handler = createTaskExtractionsHandler({
        env: { ...VALID_ENV, MODEL_API_KEY: '' }
    });
    const req = mockReq({ description: 'x' }, { 'accept-language': 'en-US,en;q=0.9' });
    const res = mockRes();
    await handler(req, res);
    assert.match(res.body.message, /not configured/);
});

test('handler: Accept-Language=zh → message 为中文', async () => {
    const handler = createTaskExtractionsHandler({
        env: { ...VALID_ENV, MODEL_API_KEY: '' }
    });
    const req = mockReq({ description: 'x' }, { 'accept-language': 'zh-CN' });
    const res = mockRes();
    await handler(req, res);
    assert.match(res.body.message, /未配置/);
});