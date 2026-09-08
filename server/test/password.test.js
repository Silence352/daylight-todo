/**
 * Daylight To-Do v5 — password 模块测试
 *
 * 覆盖：
 *   - hashPassword 返回 { hash, salt }，hex 编码、非空、非明文
 *   - verifyPassword 正确/错误密码
 *   - 不同密码生成不同 hash；相同密码 + 不同盐生成不同 hash
 *   - validateEmail 合法/非法
 *   - validatePassword 合法/非法（最少 8 字符）
 *   - getPasswordMinLength 返回 8
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    hashPassword,
    verifyPassword,
    validateEmail,
    validatePassword,
    getPasswordMinLength
} from '../auth/password.js';

// ----------------------------------------
// hashPassword
// ----------------------------------------

test('hashPassword: 返回 { hash, salt }，均为非空 hex 字符串', async () => {
    const { hash, salt } = await hashPassword('correct horse battery staple');
    assert.equal(typeof hash, 'string');
    assert.equal(typeof salt, 'string');
    assert.ok(hash.length > 0, 'hash 非空');
    assert.ok(salt.length > 0, 'salt 非空');
    // hex 编码：只含 0-9a-f
    assert.match(hash, /^[0-9a-f]+$/);
    assert.match(salt, /^[0-9a-f]+$/);
});

test('hashPassword: salt 长度 16 字节 = 32 hex 字符', async () => {
    const { salt } = await hashPassword('some-pwd');
    assert.equal(salt.length, 32);
});

test('hashPassword: hash 长度 32 字节 = 64 hex 字符', async () => {
    const { hash } = await hashPassword('some-pwd');
    assert.equal(hash.length, 64);
});

test('hashPassword: 绝不返回明文密码', async () => {
    const pwd = 'never-plaintext-me-123';
    const { hash, salt } = await hashPassword(pwd);
    assert.doesNotMatch(hash, new RegExp(pwd));
    assert.doesNotMatch(salt, new RegExp(pwd));
});

test('hashPassword: 相同密码两次生成不同 hash（随机盐）', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    assert.notEqual(a.hash, b.hash);
    assert.notEqual(a.salt, b.salt);
});

test('hashPassword: 空字符串 → 抛错', async () => {
    await assert.rejects(hashPassword(''));
});

test('hashPassword: 非字符串 → 抛错', async () => {
    await assert.rejects(hashPassword(null));
    await assert.rejects(hashPassword(123));
    await assert.rejects(hashPassword(undefined));
});

// ----------------------------------------
// verifyPassword
// ----------------------------------------

test('verifyPassword: 正确密码 → true', async () => {
    const { hash, salt } = await hashPassword('my-correct-pwd');
    const ok = await verifyPassword('my-correct-pwd', hash, salt);
    assert.equal(ok, true);
});

test('verifyPassword: 错误密码 → false', async () => {
    const { hash, salt } = await hashPassword('my-correct-pwd');
    const ok = await verifyPassword('wrong-pwd', hash, salt);
    assert.equal(ok, false);
});

test('verifyPassword: 不同密码的 hash 互不匹配', async () => {
    const a = await hashPassword('pwd-a');
    const b = await hashPassword('pwd-b');
    assert.equal(await verifyPassword('pwd-a', b.hash, b.salt), false);
    assert.equal(await verifyPassword('pwd-b', a.hash, a.salt), false);
});

test('verifyPassword: 非法输入 → false（不抛错）', async () => {
    assert.equal(await verifyPassword('x', '', ''), false);
    assert.equal(await verifyPassword('x', null, 'salt'), false);
    assert.equal(await verifyPassword('x', 'hash', null), false);
    assert.equal(await verifyPassword(null, 'hash', 'salt'), false);
    assert.equal(await verifyPassword('x', 'not-hex!@#', 'salt'), false);
});

// ----------------------------------------
// validateEmail
// ----------------------------------------

test('validateEmail: 合法邮箱 → valid + 规范化（trim + lowercase）', () => {
    const r = validateEmail('  Alice@Example.COM  ');
    assert.equal(r.valid, true);
    assert.equal(r.value, 'alice@example.com');
});

test('validateEmail: 各种合法格式', () => {
    assert.equal(validateEmail('a@b.co').valid, true);
    assert.equal(validateEmail('user.name@sub.domain.org').valid, true);
    assert.equal(validateEmail('x@y.io').valid, true);
});

test('validateEmail: 缺 @ → invalid', () => {
    assert.equal(validateEmail('no-at-sign').valid, false);
});

test('validateEmail: 缺域名 → invalid', () => {
    assert.equal(validateEmail('a@').valid, false);
    assert.equal(validateEmail('a@b').valid, false);
});

test('validateEmail: 含空格 → invalid', () => {
    assert.equal(validateEmail('a b@c.com').valid, false);
    assert.equal(validateEmail('a@b .com').valid, false);
});

test('validateEmail: 非字符串 → invalid', () => {
    assert.equal(validateEmail(null).valid, false);
    assert.equal(validateEmail(123).valid, false);
    assert.equal(validateEmail(undefined).valid, false);
    assert.equal(validateEmail({}).valid, false);
});

// ----------------------------------------
// validatePassword
// ----------------------------------------

test('validatePassword: 8 字符 → valid', () => {
    assert.equal(validatePassword('12345678').valid, true);
});

test('validatePassword: > 8 字符 → valid', () => {
    assert.equal(validatePassword('a-very-long-password-123').valid, true);
});

test('validatePassword: 7 字符 → invalid', () => {
    assert.equal(validatePassword('1234567').valid, false);
});

test('validatePassword: 空字符串 → invalid', () => {
    assert.equal(validatePassword('').valid, false);
});

test('validatePassword: 非字符串 → invalid', () => {
    assert.equal(validatePassword(null).valid, false);
    assert.equal(validatePassword(12345678).valid, false);
    assert.equal(validatePassword(undefined).valid, false);
});

// ----------------------------------------
// getPasswordMinLength
// ----------------------------------------

test('getPasswordMinLength: 返回 8', () => {
    assert.equal(getPasswordMinLength(), 8);
});