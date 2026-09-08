/**
 * Daylight To-Do v5 — Express 入口
 *
 * 职责：
 *   1. createApp({ env, staticRoot, runMigrations }) 工厂：构造 Express app
 *      （挂载路由 + 静态资源 + 兜底），不启动监听。测试用此工厂注入临时 DB。
 *   2. 直接 `node server/index.js` 启动：读 process.env.PORT || 8105 监听。
 *
 * 挂载路由：
 *   - POST /api/task-extractions（v4 智能拆解）
 *   - /api/auth/*（v5 注册/登录/退出/me）
 *   - /api/cloud/tasks（v5 云端任务 CRUD）
 *   - POST /api/cloud/sync（v6 本地→云端显式同步，追加合并 + 不可变 ID 去重 + 幂等）
 *
 * 密钥只在服务端 process.env 中读取，绝不写入前端产物。
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTaskExtractionsRouter } from './routes/taskExtractions.js';
import { createAuthRouter } from './routes/auth.js';
import { createCloudTasksRouter } from './routes/cloudTasks.js';
import { createSyncRouter } from './routes/sync.js';
import { runMigrations, closeDb } from './db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 创建 Express app（不启动监听）。
 *
 * @param {Object} [options]
 * @param {Object} [options.env] - 环境变量（默认 process.env）
 * @param {string} [options.staticRoot] - 静态资源根目录（默认仓库根）
 * @param {boolean} [options.runMigrations=true] - 是否执行迁移
 * @returns {import('express').Express}
 */
export const createApp = (options = {}) => {
    const env = options.env || process.env;
    const shouldMigrate = options.runMigrations !== false;
    const STATIC_ROOT = options.staticRoot || path.resolve(__dirname, '..');

    if (shouldMigrate) {
        runMigrations();
    }

    const app = express();

    // 解析 JSON 请求体（限制 16KB，防止过大描述打爆模型）
    app.use(express.json({ limit: '16kb' }));

    // API 路由
    app.use('/api/task-extractions', createTaskExtractionsRouter({ env }));
    app.use('/api/auth', createAuthRouter({ env }));
    app.use('/api/cloud/tasks', createCloudTasksRouter({ env }));
    app.use('/api/cloud', createSyncRouter({ env }));

    // 静态资源：前端根目录（index.html / css / js）
    app.use(express.static(STATIC_ROOT, {
        index: 'index.html',
        extensions: ['html'],
        setHeaders: (res, filePath) => {
            // 静态资源用短缓存；HTML 不缓存以保证发版即时生效
            if (filePath.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-cache');
            }
        }
    }));

    // 健康检查
    app.get('/api/health', (_req, res) => {
        res.json({ ok: true });
    });

    // 兜底：未匹配的非 API 请求回退到 index.html（SPA 风格）
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api/')) {
            res.sendFile(path.join(STATIC_ROOT, 'index.html'));
            return;
        }
        next();
    });

    return app;
};

// ----------------------------------------------
// 直接启动入口：`node server/index.js`
// ----------------------------------------------
const isMain = process.argv[1] === __filename;

if (isMain) {
    const PORT = process.env.PORT || 8105;
    const app = createApp();
    const server = app.listen(PORT, () => {
        // 不输出任何密钥或环境敏感值
        console.log(`[v6] Daylight To-Do server listening on http://localhost:${PORT}`);
    });

    // 优雅关闭：关闭数据库连接
    const shutdown = () => {
        closeDb();
        server.close(() => process.exit(0));
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
