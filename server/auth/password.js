/**
 * Daylight To-Do v5 — 密码摘要与校验（纯函数，可测试）
 *
 * 安全原则：
 *   - 用 Node 内置 crypto.scrypt（单向摘要）+ 16 字节随机盐
 *   - hash 与 salt 以 hex 编码存储
 *   - **绝不存/打印/回传明文密码**；密码只在校验时短暂存在于内存
 *   - 不引入 bcrypt 等第三方库
 *
 * 导出：
 *   - hashPassword(password) → { hash, salt }（异步，scrypt 回调风格）
 *   - verifyPassword(password, hash, salt) → boolean
 *   - validateEmail(email) → { valid, value }
 *   - validatePassword(password) → { valid }
 */

import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

/** 盐长度（字节） */
const SALT_BYTES = 16;
/** scrypt 密钥长度（字节） */
const KEY_BYTES = 32;
/** scrypt 计算参数（N/r/p），使用 Node 默认值，平衡安全与性能 */
const SCRYPT_OPTIONS = {};

/** 邮箱正则（简单、实用；不追求 RFC 5322 完整覆盖） */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 密码最小长度 */
const PASSWORD_MIN_LENGTH = 8;

/**
 * 用 scrypt + 随机盐对密码做单向摘要。
 *
 * @param {string} password - 明文密码（仅在此函数内短暂存在）
 * @returns {Promise<{ hash: string, salt: string }>} hex 编码的 hash 与 salt
 * @throws {Error} password 非字符串或为空
 */
export const hashPassword = async (password) => {
    if (typeof password !== 'string' || password.length === 0) {
        throw new Error('Password must be a non-empty string');
    }
    const salt = crypto.randomBytes(SALT_BYTES);
    const derived = await scrypt(password, salt, KEY_BYTES, SCRYPT_OPTIONS);
    return {
        hash: derived.toString('hex'),
        salt: salt.toString('hex')
    };
};

/**
 * 用 scrypt 验证密码是否匹配已存储的 hash + salt。
 * 用 timingSafeEqual 做常量时间比较，避免时序侧信道。
 *
 * @param {string} password - 待校验明文密码
 * @param {string} hash - 已存储的 hex hash
 * @param {string} salt - 已存储的 hex salt
 * @returns {Promise<boolean>}
 */
export const verifyPassword = async (password, hash, salt) => {
    if (typeof password !== 'string' || typeof hash !== 'string' || typeof salt !== 'string') {
        return false;
    }
    if (hash.length === 0 || salt.length === 0) {
        return false;
    }
    try {
        const saltBuf = Buffer.from(salt, 'hex');
        const hashBuf = Buffer.from(hash, 'hex');
        const derived = await scrypt(password, saltBuf, hashBuf.length, SCRYPT_OPTIONS);
        // 长度不同直接返回 false，避免 timingSafeEqual 抛错
        if (derived.length !== hashBuf.length) return false;
        return crypto.timingSafeEqual(derived, hashBuf);
    } catch {
        return false;
    }
};

/**
 * 校验并规范化邮箱：trim + lowercase + 正则。
 *
 * @param {string} email
 * @returns {{ valid: boolean, value: string }}
 */
export const validateEmail = (email) => {
    if (typeof email !== 'string') return { valid: false, value: '' };
    const value = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(value)) return { valid: false, value: '' };
    return { valid: true, value };
};

/**
 * 校验密码：最少 8 字符。
 *
 * @param {string} password
 * @returns {{ valid: boolean }}
 */
export const validatePassword = (password) => {
    if (typeof password !== 'string') return { valid: false };
    return { valid: password.length >= PASSWORD_MIN_LENGTH };
};

/**
 * 返回密码最小长度（供路由层构造错误消息）
 * @returns {number}
 */
export const getPasswordMinLength = () => PASSWORD_MIN_LENGTH;