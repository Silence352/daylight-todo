/**
 * taskExtractor 单元测试（node:test + node:assert）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseModelResponse,
    normalizeDraft,
    extractTasks,
    ExtractionError
} from '../taskExtractor.js';

// ----------------------------------------
// parseModelResponse
// ----------------------------------------

test('parseModelResponse: 合法 JSON 对象 → 返回原对象', () => {
    const raw = '{"tasks":[{"title":"写报告"}]}';
    const parsed = parseModelResponse(raw);
    assert.deepEqual(parsed, { tasks: [{ title: '写报告' }] });
});

test('parseModelResponse: markdown ```json 代码块 → 提取并解析', () => {
    const raw = '```json\n{"tasks":[{"title":"A"}]}\n```';
    const parsed = parseModelResponse(raw);
    assert.deepEqual(parsed, { tasks: [{ title: 'A' }] });
});

test('parseModelResponse: markdown 无语言标记代码块 → 提取并解析', () => {
    const raw = '前缀文字\n```\n{"tasks":[]}\n```\n后缀';
    const parsed = parseModelResponse(raw);
    assert.deepEqual(parsed, { tasks: [] });
});

test('parseModelResponse: 非 JSON 文本 → 抛 INVALID_JSON', () => {
    assert.throws(
        () => parseModelResponse('这不是 JSON'),
        (err) => err instanceof ExtractionError && err.code === 'INVALID_JSON'
    );
});

test('parseModelResponse: 空字符串 → 抛 INVALID_JSON', () => {
    assert.throws(
        () => parseModelResponse(''),
        (err) => err instanceof ExtractionError && err.code === 'INVALID_JSON'
    );
});

test('parseModelResponse: JSON 外层包了 prose 但无代码块 → 抛 INVALID_JSON', () => {
    assert.throws(
        () => parseModelResponse('结果是 {"tasks":[]} 完毕'),
        (err) => err instanceof ExtractionError && err.code === 'INVALID_JSON'
    );
});

// ----------------------------------------
// normalizeDraft
// ----------------------------------------

test('normalizeDraft: 完整合法草稿 → 原样保留', () => {
    const draft = {
        title: '完成季度报告',
        project: '财务',
        priority: 'high',
        dueDate: '2026-09-30',
        estimatedMinutes: 90
    };
    assert.deepEqual(normalizeDraft(draft), draft);
});

test('normalizeDraft: 缺失可选字段 → 用默认值填充', () => {
    const result = normalizeDraft({ title: '买牛奶' });
    assert.deepEqual(result, {
        title: '买牛奶',
        project: '',
        priority: 'medium',
        dueDate: null,
        estimatedMinutes: 25
    });
});

test('normalizeDraft: title 前后空格被 trim', () => {
    const result = normalizeDraft({ title: '  整理邮箱  ' });
    assert.equal(result.title, '整理邮箱');
});

test('normalizeDraft: title 超过 150 字符 → 截断到 150', () => {
    const long = 'A'.repeat(200);
    const result = normalizeDraft({ title: long });
    assert.equal(result.title.length, 150);
});

test('normalizeDraft: title 缺失 → 抛 MISSING_TITLE', () => {
    assert.throws(
        () => normalizeDraft({ project: 'x' }),
        (err) => err instanceof ExtractionError && err.code === 'MISSING_TITLE'
    );
});

test('normalizeDraft: title 为空字符串 → 抛 MISSING_TITLE', () => {
    assert.throws(
        () => normalizeDraft({ title: '   ' }),
        (err) => err instanceof ExtractionError && err.code === 'MISSING_TITLE'
    );
});

test('normalizeDraft: title 非字符串 → 抛 MISSING_TITLE', () => {
    assert.throws(
        () => normalizeDraft({ title: 123 }),
        (err) => err instanceof ExtractionError && err.code === 'MISSING_TITLE'
    );
});

test('normalizeDraft: 非法 priority → 归 medium', () => {
    assert.equal(normalizeDraft({ title: 'x', priority: 'urgent' }).priority, 'medium');
    assert.equal(normalizeDraft({ title: 'x', priority: null }).priority, 'medium');
    assert.equal(normalizeDraft({ title: 'x', priority: 5 }).priority, 'medium');
});

test('normalizeDraft: 合法 priority 保留', () => {
    assert.equal(normalizeDraft({ title: 'x', priority: 'high' }).priority, 'high');
    assert.equal(normalizeDraft({ title: 'x', priority: 'low' }).priority, 'low');
});

test('normalizeDraft: 非法 dueDate → 归 null', () => {
    assert.equal(normalizeDraft({ title: 'x', dueDate: 'not-a-date' }).dueDate, null);
    assert.equal(normalizeDraft({ title: 'x', dueDate: '2026/09/30' }).dueDate, null);
    assert.equal(normalizeDraft({ title: 'x', dueDate: '2026-13-01' }).dueDate, null);
    assert.equal(normalizeDraft({ title: 'x', dueDate: '2026-02-30' }).dueDate, null);
    assert.equal(normalizeDraft({ title: 'x', dueDate: 12345 }).dueDate, null);
});

test('normalizeDraft: 合法 dueDate 保留', () => {
    assert.equal(normalizeDraft({ title: 'x', dueDate: '2026-09-30' }).dueDate, '2026-09-30');
    assert.equal(normalizeDraft({ title: 'x', dueDate: null }).dueDate, null);
    assert.equal(normalizeDraft({ title: 'x', dueDate: '' }).dueDate, null);
});

test('normalizeDraft: 非法 estimatedMinutes → 归 25', () => {
    assert.equal(normalizeDraft({ title: 'x', estimatedMinutes: 'abc' }).estimatedMinutes, 25);
    assert.equal(normalizeDraft({ title: 'x', estimatedMinutes: -5 }).estimatedMinutes, 25);
    assert.equal(normalizeDraft({ title: 'x', estimatedMinutes: 0 }).estimatedMinutes, 25);
    assert.equal(normalizeDraft({ title: 'x', estimatedMinutes: 601 }).estimatedMinutes, 25);
    assert.equal(normalizeDraft({ title: 'x', estimatedMinutes: 3.5 }).estimatedMinutes, 25);
    assert.equal(normalizeDraft({ title: 'x', estimatedMinutes: null }).estimatedMinutes, 25);
});

test('normalizeDraft: 合法 estimatedMinutes 保留', () => {
    assert.equal(normalizeDraft({ title: 'x', estimatedMinutes: 1 }).estimatedMinutes, 1);
    assert.equal(normalizeDraft({ title: 'x', estimatedMinutes: 600 }).estimatedMinutes, 600);
    assert.equal(normalizeDraft({ title: 'x', estimatedMinutes: '45' }).estimatedMinutes, 45);
});

test('normalizeDraft: project 非 string → 归空字符串', () => {
    assert.equal(normalizeDraft({ title: 'x', project: 123 }).project, '');
    assert.equal(normalizeDraft({ title: 'x', project: null }).project, '');
});

// ----------------------------------------
// extractTasks
// ----------------------------------------

test('extractTasks: 标准 { tasks: [...] } → 规范化全部草稿', () => {
    const raw = JSON.stringify({
        tasks: [
            { title: '任务一', project: 'P1', priority: 'high', dueDate: '2026-09-30', estimatedMinutes: 60 },
            { title: '任务二' }
        ]
    });
    const { tasks } = extractTasks(raw);
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].title, '任务一');
    assert.equal(tasks[0].priority, 'high');
    assert.equal(tasks[1].title, '任务二');
    assert.equal(tasks[1].priority, 'medium');
    assert.equal(tasks[1].estimatedMinutes, 25);
});

test('extractTasks: 顶层是数组 → 兼容', () => {
    const raw = JSON.stringify([{ title: 'A' }, { title: 'B' }]);
    const { tasks } = extractTasks(raw);
    assert.equal(tasks.length, 2);
});

test('extractTasks: markdown 代码块包裹 → 正确提取', () => {
    const raw = '```json\n{"tasks":[{"title":"草稿"}]}\n```';
    const { tasks } = extractTasks(raw);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].title, '草稿');
});

test('extractTasks: tasks 为空数组 → 抛 EMPTY_TASKS', () => {
    assert.throws(
        () => extractTasks('{"tasks":[]}'),
        (err) => err instanceof ExtractionError && err.code === 'EMPTY_TASKS'
    );
});

test('extractTasks: 缺少 tasks 字段 → 抛 EMPTY_TASKS', () => {
    assert.throws(
        () => extractTasks('{"foo":"bar"}'),
        (err) => err instanceof ExtractionError && err.code === 'EMPTY_TASKS'
    );
});

test('extractTasks: 任一草稿 title 缺失 → 抛 MISSING_TITLE', () => {
    const raw = JSON.stringify({ tasks: [{ title: 'OK' }, { project: 'no-title' }] });
    assert.throws(
        () => extractTasks(raw),
        (err) => err instanceof ExtractionError && err.code === 'MISSING_TITLE'
    );
});

test('extractTasks: 无效 JSON → 抛 INVALID_JSON', () => {
    assert.throws(
        () => extractTasks('完全不是 JSON'),
        (err) => err instanceof ExtractionError && err.code === 'INVALID_JSON'
    );
});