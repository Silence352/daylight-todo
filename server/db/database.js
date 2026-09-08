/**
 * Daylight To-Do v5 — SQLite 数据库层
 *
 * 职责：
 *   1. 用 better-sqlite3 打开/创建 SQLite 数据库（路径来自 DB_PATH 环境变量，
 *      默认 server/data/daylight.db；测试可传入 ':memory:'）
 *   2. 建表与迁移：users / sessions / cloud_tasks / schema_migrations（IF NOT EXISTS）
 *   3. 导出单例 getDb()、closeDb()、runMigrations()
 *
 * 安全：
 *   - 数据库文件目录自动创建（仅文件 SQLite，内存数据库无需目录）
 *   - 所有建表使用 IF NOT EXISTS，幂等
 *   - 外键约束在每次连接时开启（PRAGMA foreign_keys = ON）
 *
 * 设计说明：
 *   - 单例 db 持有在模块作用域；测试可通过 resetDbForTest() 重置（仅测试用）
 *   - runMigrations() 用 schema_migrations 表记录已执行迁移，避免重复
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 当前 schema 版本（与迁移列表长度对应） */
const SCHEMA_VERSION = 2;

/**
 * 迁移列表：每个迁移是一次性 DDL，按顺序执行。
 * 已执行的迁移名记录在 schema_migrations 表中。
 */
const MIGRATIONS = [
    {
        name: '001_create_users',
        sql: `
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        `
    },
    {
        name: '002_create_sessions',
        sql: `
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        `
    },
    {
        name: '003_create_cloud_tasks',
        sql: `
            CREATE TABLE IF NOT EXISTS cloud_tasks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                text TEXT NOT NULL,
                completed INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                project_id TEXT,
                priority TEXT,
                due_date TEXT,
                estimate_minutes INTEGER,
                focused INTEGER,
                completed_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        `
    },
    {
        // v6: 把 cloud_tasks 主键从全局 id 改为复合 (id, user_id)，
        // 使不同用户可以持有相同 id 的任务（本地→云端同步的跨账号隔离前提）。
        // 重建表：建新表 → 拷贝 → 删旧 → 改名。
        name: '004_cloud_tasks_composite_pk',
        sql: `
            CREATE TABLE IF NOT EXISTS cloud_tasks_v6 (
                id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                text TEXT NOT NULL,
                completed INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                project_id TEXT,
                priority TEXT,
                due_date TEXT,
                estimate_minutes INTEGER,
                focused INTEGER,
                completed_at TEXT,
                PRIMARY KEY (id, user_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            INSERT INTO cloud_tasks_v6
                (id, user_id, text, completed, created_at, project_id,
                 priority, due_date, estimate_minutes, focused, completed_at)
            SELECT id, user_id, text, completed, created_at, project_id,
                   priority, due_date, estimate_minutes, focused, completed_at
            FROM cloud_tasks;
            DROP TABLE cloud_tasks;
            ALTER TABLE cloud_tasks_v6 RENAME TO cloud_tasks;
        `
    }
];

/** 模块级单例 */
let db = null;
/** 当前数据库路径（用于 reset 后重新打开） */
let currentDbPath = null;

/**
 * 解析数据库路径：
 *   - 显式传入 dbPath 优先（测试用）
 *   - 否则读 process.env.DB_PATH
 *   - 默认 server/data/daylight.db（相对于本文件）
 *
 * @param {string} [explicit] - 显式路径或 ':memory:'
 * @returns {string}
 */
const resolveDbPath = (explicit) => {
    if (explicit) return explicit;
    if (process.env.DB_PATH) return process.env.DB_PATH;
    return path.resolve(__dirname, '..', 'data', 'daylight.db');
};

/**
 * 打开数据库并开启外键约束。
 * 对文件数据库，确保目录存在。
 *
 * @param {string} dbPath - 数据库路径或 ':memory:'
 * @returns {import('better-sqlite3').Database}
 */
const openDatabase = (dbPath) => {
    if (dbPath !== ':memory:') {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    const database = new Database(dbPath);
    // 开启外键约束（SQLite 默认关闭）
    database.pragma('journal_mode = WAL');
    database.pragma('foreign_keys = ON');
    return database;
};

/**
 * 获取数据库单例。首次调用时打开数据库。
 *
 * @param {Object} [options] - 仅测试应传入
 * @param {string} [options.dbPath] - 显式数据库路径
 * @returns {import('better-sqlite3').Database}
 */
export const getDb = (options = {}) => {
    if (db) return db;
    currentDbPath = resolveDbPath(options.dbPath);
    db = openDatabase(currentDbPath);
    return db;
};

/**
 * 关闭数据库单例。
 */
export const closeDb = () => {
    if (db) {
        db.close();
        db = null;
        currentDbPath = null;
    }
};

/**
 * 执行所有未应用的迁移。
 * 用 schema_migrations 表记录已执行迁移名。
 * 幂等：重复调用不会重复执行已记录的迁移。
 *
 * @param {Object} [options] - 同 getDb
 * @returns {string[]} 本次执行了的迁移名列表
 */
export const runMigrations = (options = {}) => {
    const database = getDb(options);

    // 迁移追踪表
    database.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        );
    `);

    const applied = database.prepare(
        'SELECT name FROM schema_migrations'
    ).all().map(row => row.name);

    const newlyApplied = [];
    const insertMigration = database.prepare(
        'INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)'
    );

    const apply = database.transaction((toApply) => {
        for (const migration of toApply) {
            database.exec(migration.sql);
            insertMigration.run(migration.name, new Date().toISOString());
            newlyApplied.push(migration.name);
        }
    });

    const pending = MIGRATIONS.filter(m => !applied.includes(m.name));
    if (pending.length > 0) {
        apply(pending);
    }

    return newlyApplied;
};

/**
 * 仅测试用：重置单例并可选重新打开。
 * 不导出给生产代码路径。
 *
 * @param {string} [dbPath] - 新数据库路径
 * @returns {import('better-sqlite3').Database}
 */
export const resetDbForTest = (dbPath) => {
    closeDb();
    return getDb({ dbPath });
};

/**
 * 仅测试用：获取当前 schema 版本（迁移数量）。
 * @returns {number}
 */
export const getSchemaVersion = () => SCHEMA_VERSION;