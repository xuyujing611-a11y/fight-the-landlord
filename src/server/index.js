/**
 * src/server/index.js - AI斗地主 后端 API 服务器
 *
 * 启动: node src/server/index.js
 * 端口: 3100 (可通过 PORT 环境变量覆盖)
 *
 * API 一览:
 *   POST /api/ai/play         - AI 出牌决策
 *   POST /api/quiz/generate   - 出题系统
 *   POST /api/verify/play     - 出牌验证
 *   POST /api/wrong-book      - 错题本记录
 *   GET  /api/wrong-book      - 错题本查询
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const aiRouter = require('./routes/ai');
const quizRouter = require('./routes/quiz');
const verifyRouter = require('./routes/verify');
const wrongbookRouter = require('./routes/wrongbook');
const chaosRouter = require('./routes/chaos');
const dialogueRouter = require('./routes/dialogue');
const { router: biddingRouter } = require('./routes/bidding');
const resultRouter = require('./routes/result');

const app = express();
const PORT = process.env.PORT || 3100;

// ============================================================
// 中间件
// ============================================================
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// 请求日志
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// ============================================================
// API 认证中间件
// ============================================================
const API_KEY = process.env.API_KEY;

/** 如果进程配置了 API_KEY，则所有 /api/* 请求必须携带 x-api-key 头 */
function checkAuth(req, res, next) {
  // 健康检查跳过认证
  if (req.path === '/health') return next();

  if (API_KEY) {
    const provided = req.headers['x-api-key'];
    if (!provided || provided !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized', message: 'x-api-key header is required' });
    }
  }
  next();
}

if (!API_KEY) {
  console.warn('⚠  WARNING: API_KEY not set. All API endpoints have no authentication.');
  console.warn('   Set API_KEY in .env for production deployment.');
}

// ============================================================
// 静态文件服务（前端页面）
// ============================================================
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// ============================================================
// 路由
// ============================================================
app.use('/api', checkAuth);
app.use('/api/ai', aiRouter);
app.use('/api/quiz', quizRouter);
app.use('/api/verify', verifyRouter);
app.use('/api/wrong-book', wrongbookRouter);
app.use('/api/chaos', chaosRouter);
app.use('/api/bidding', biddingRouter);
app.use('/api/ai/dialogue', dialogueRouter);
app.use('/api/game', resultRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl });
});

// 统一错误处理
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// ============================================================
// 启动
// ============================================================
app.listen(PORT, () => {
  console.log(`🃏 AI斗地主 API Server running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});
