/**
 * modelClient 单元测试（node:test + node:assert）
 * 通过注入 fetchImpl mock 测试，不发起真实网络请求。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildModelRequest,
    callModel,
    isModelConfigured,
    ModelClientError,
    DEFAULT_TIMEOUT_MS
} from '../modelClient.js';

const VALID_ENV = {
    MODEL_BASE_URL: 'https://model.example.com',
    MODEL_NAME: 'gpt-4o-mini',
    MODEL_API_KEY: 'sk-test-key-123'
};

// ----------------------------------------
// isModelConfigured
// ----------------------------------------

test('isModelConfigured: 三项齐全 → true', () => {
    assert.equal(isModelConfigured(VALID_ENV), true);
});

test('isModelConfigured: 缺任意一项 → false', () => {
    assert.equal(isModelConfigured({ ...VALID_ENV, MODEL_API_KEY: '' }), false);
    assert.equal(isModelConfigured({ ...VALID_ENV, MODEL_BASE_URL: undefined }), false);
    assert.equal(isModelConfigured({ ...VALID_ENV, MODEL_NAME: '' }), false);
    assert.equal(isModelConfigured({}), false);
    assert.equal(isModelConfigured(undefined), false);
});

// ----------------------------------------
// buildModelRequest
// ----------------------------------------

test('buildModelRequest: 正确构造 url（去除尾部斜杠）', () => {
    const { url } = buildModelRequest('描述', { ...VALID_ENV, MODEL_BASE_URL: 'https://x.com/' });
    assert.equal(url, 'https://x.com/v1/chat/completions');
});

test('buildModelRequest: headers 含 Authorization Bearer 与 Content-Type', () => {
    const { options } = buildModelRequest('描述', VALID_ENV);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.equal(options.headers.Authorization, 'Bearer sk-test-key-123');
});

test('buildModelRequest: body 含 model / messages / temperature / response_format', () => {
    const { options } = buildModelRequest('写报告', VALID_ENV);
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'gpt-4o-mini');
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.messages[1].role, 'user');
    assert.equal(body.messages[1].content, '写报告');
    assert.equal(typeof body.temperature, 'number');
    assert.deepEqual(body.response_format, { type: 'json_object' });
});

test('buildModelRequest: 不在 body 中泄露密钥', () => {
    const { options } = buildModelRequest('x', VALID_ENV);
    assert.doesNotMatch(options.body, /sk-test-key-123/);
});

// ----------------------------------------
// callModel — 成功
// ----------------------------------------

test('callModel: fetchImpl 返回 200 + JSON → 返回 assistant content 文本', async () => {
    const fetchImpl = async () => ({
        ok: true,
        json: async () => ({
            choices: [{ message: { content: '{"tasks":[]}' } }]
        })
    });
    const text = await callModel('描述', VALID_ENV, { fetchImpl });
    assert.equal(text, '{"tasks":[]}');
});

test('callModel: 把 signal 传给 fetchImpl', async () => {
    let receivedSignal;
    const fetchImpl = async (_url, opts) => {
        receivedSignal = opts.signal;
        return { ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) };
    };
    await callModel('描述', VALID_ENV, { fetchImpl });
    assert.ok(receivedSignal && typeof receivedSignal.aborted === 'boolean');
});

// ----------------------------------------
// callModel — 错误
// ----------------------------------------

test('callModel: 未配置密钥 → 抛 NOT_CONFIGURED（不调用 fetch）', async () => {
    let called = false;
    const fetchImpl = async () => { called = true; return { ok: true, json: async () => ({}) }; };
    await assert.rejects(
        callModel('x', { ...VALID_ENV, MODEL_API_KEY: '' }, { fetchImpl }),
        (err) => err instanceof ModelClientError && err.code === 'NOT_CONFIGURED'
    );
    assert.equal(called, false);
});

test('callModel: fetchImpl 返回 500 → 抛 HTTP_ERROR', async () => {
    const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}) });
    await assert.rejects(
        callModel('x', VALID_ENV, { fetchImpl }),
        (err) => err instanceof ModelClientError && err.code === 'HTTP_ERROR'
    );
});

test('callModel: fetchImpl 返回 200 但 body 无 choices → 抛 EMPTY_CONTENT', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({}) });
    await assert.rejects(
        callModel('x', VALID_ENV, { fetchImpl }),
        (err) => err instanceof ModelClientError && err.code === 'EMPTY_CONTENT'
    );
});

test('callModel: fetchImpl 返回 200 但 content 非字符串 → 抛 EMPTY_CONTENT', async () => {
    const fetchImpl = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 123 } }] }) });
    await assert.rejects(
        callModel('x', VALID_ENV, { fetchImpl }),
        (err) => err instanceof ModelClientError && err.code === 'EMPTY_CONTENT'
    );
});

test('callModel: fetchImpl 抛普通错误 → 抛 NETWORK_ERROR（不泄露原始信息）', async () => {
    const fetchImpl = async () => { throw new Error('ECONNREFUSED internal detail'); };
    await assert.rejects(
        callModel('x', VALID_ENV, { fetchImpl }),
        (err) => {
            assert.equal(err instanceof ModelClientError, true);
            assert.equal(err.code, 'NETWORK_ERROR');
            assert.doesNotMatch(err.message, /ECONNREFUSED/);
            return true;
        }
    );
});

// ----------------------------------------
// callModel — 超时
// ----------------------------------------

test('callModel: fetchImpl 响应 abort signal → 超时抛 TIMEOUT', async () => {
    // mock fetch 模拟真实 fetch 行为：监听 signal，abort 时以 AbortError reject
    const fetchImpl = (_url, opts) => new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
        });
    });
    await assert.rejects(
        callModel('x', VALID_ENV, { fetchImpl, timeoutMs: 50 }),
        (err) => err instanceof ModelClientError && err.code === 'TIMEOUT'
    );
});

test('callModel: 默认超时为 30000ms', () => {
    assert.equal(DEFAULT_TIMEOUT_MS, 30000);
});