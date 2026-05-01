/**
 * src/server/routes/chaos.js - 搞事情系统 API 路由
 *
 * API:
 *   POST /api/chaos/generate-question - 生成题目（用产品设计模板）
 *   POST /api/chaos/trigger          - 触发随机事件
 *   POST /api/chaos/check-trigger    - 检查游戏状态是否应触发事件
 *   GET  /api/chaos/events           - 获取事件目录
 *   GET  /api/chaos/event-log        - 获取事件日志
 *   GET  /api/chaos/event-stats      - 事件统计
 */

const express = require('express');
const router = express.Router();
const questionTemplates = require('../services/questionTemplates');
const eventEngine = require('../services/eventEngine');

// ============================================================
// POST /api/chaos/generate-question
//
// Body: {
//   type: 'vocabulary'|'expression'|'trivia'|'life_hack'|'bomb_mixed'|'random',
//   difficulty: 'easy'|'normal'|'hard'|'extreme',
//   count: 1-10 (default 1)
// }
// ============================================================
router.post('/generate-question', async (req, res) => {
  try {
    let { type, difficulty, count } = req.body;
    const diff = difficulty || 'normal';
    const num = Math.min(count || 1, 10);

    let questionType = type;
    if (!type || type === 'random') {
      const types = ['vocabulary', 'expression', 'trivia', 'life_hack', 'bomb_mixed'];
      questionType = types[Math.floor(Math.random() * types.length)];
    }

    if (!questionTemplates.TYPE_META[questionType]) {
      return res.status(400).json({
        error: `Unknown question type: ${questionType}`,
        available: Object.keys(questionTemplates.TYPE_META)
      });
    }

    const questions = await questionTemplates.generateBatch(questionType, diff, num);

    res.json({
      success: true,
      type: questionType,
      difficulty: diff,
      count: questions.length,
      questions
    });

  } catch (err) {
    console.error('Chaos generate-question error:', err);
    res.status(500).json({ error: 'Failed to generate question', message: err.message });
  }
});

// ============================================================
// POST /api/chaos/trigger - 触发随机事件
//
// Body: {
//   gameState: {
//     round: number,
//     consecutiveCorrect: number,
//     consecutiveWrong: number,
//     playerId: string,
//     gameId: string
//   }
// }
// ============================================================
router.post('/trigger', (req, res) => {
  try {
    const { gameState } = req.body;
    if (!gameState || gameState.round === undefined) {
      return res.status(400).json({ error: 'gameState with round is required' });
    }

    const defaultState = {
      round: 1,
      consecutiveCorrect: 0,
      consecutiveWrong: 0,
      playerId: 'anonymous',
      gameId: 'unknown'
    };

    const state = { ...defaultState, ...gameState };
    const event = eventEngine.pickEvent(state);

    res.json({
      triggered: !!event,
      event,
      state
    });

  } catch (err) {
    console.error('Chaos trigger error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/chaos/check-trigger - 检查是否触发事件
//
// 按概率触发（非100%触发）
// ============================================================
router.post('/check-trigger', (req, res) => {
  try {
    const { gameState, triggerRate } = req.body;
    if (!gameState || gameState.round === undefined) {
      return res.status(400).json({ error: 'gameState with round is required' });
    }

    const rate = triggerRate ?? 0.4; // 默认40%概率触发
    const shouldTrigger = Math.random() < rate;

    if (!shouldTrigger) {
      return res.json({ triggered: false, event: null, state: gameState });
    }

    const defaultState = {
      round: 1, consecutiveCorrect: 0, consecutiveWrong: 0,
      playerId: 'anonymous', gameId: 'unknown'
    };
    const state = { ...defaultState, ...gameState };
    const event = eventEngine.pickEvent(state);

    res.json({
      triggered: !!event,
      event,
      triggerRate: rate,
      state
    });

  } catch (err) {
    console.error('Chaos check-trigger error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/chaos/events - 事件目录
// ============================================================
router.get('/events', (req, res) => {
  res.json({
    total: eventEngine.getEventCatalog().length,
    events: eventEngine.getEventCatalog()
  });
});

// ============================================================
// GET /api/chaos/event-log - 事件日志
// ============================================================
router.get('/event-log', (req, res) => {
  const { eventId, playerId, gameId, limit } = req.query;
  const logs = eventEngine.getEventLogs({
    eventId: eventId || undefined,
    playerId: playerId || undefined,
    gameId: gameId || undefined,
    limit: limit ? parseInt(limit) : undefined
  });
  res.json({ total: logs.length, logs });
});

// ============================================================
// GET /api/chaos/event-stats - 事件统计
// ============================================================
router.get('/event-stats', (req, res) => {
  const stats = eventEngine.getEventStats();
  res.json(stats);
});

// ============================================================
// GET /api/chaos/types - 题型列表
// ============================================================
router.get('/types', (req, res) => {
  res.json(questionTemplates.TYPE_META);
});

module.exports = router;
