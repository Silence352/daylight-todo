/**
 * Daylight To-Do v4 — Express 入口
 *
 * 职责：
 *   1. 托管前端静态资源（index.html、css/、js/）
 *   2. 挂载 POST /api/task-extractions 路由
 *   3. 监听 process.env.PORT || 8104
 *
 * 密钥只在服务端 process.env 中读取，绝不写入前端产物。
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTaskExtractionsRouter } from './routes/taskExtractions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8104;
const STATIC_ROOT = path.resolve(__dirname, '..');

const app = express();

// 解析 JSON 请求体（限制 16KB，防止过大描述打爆模型）
app.use(express.json({ limit: '16kb' }));

// API 路由
app.use('/api/task-extractions', createTaskExtractionsRouter());

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

app.listen(PORT, () => {
    // 不输出任何密钥或环境敏感值
    console.log(`[v4] Daylight To-Do server listening on http://localhost:${PORT}`);
});