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
// POST /api/chaos/card-change - 答题后换牌/选牌触发逻辑
//
// Body: {
//   gameState: {
//     round: number,
//     correct: bool,         // 是否答对
//     score: number,
//     playerCardCount: number,  // 玩家手牌数
//     aiCardCounts: [number, number]  // AI1, AI2手牌数
//   },
//   playerHand: [Card],      // 玩家当前手牌（可选，用于前端验证）
//   ai1Hand: [Card],         // 王怼怼手牌（可选）
//   ai2Hand: [Card]          // 苏甜甜手牌（可选）
// }
//
// Response: {
//   triggered: bool,           // 是否触发了换牌
//   action: 'cardChange'|null, // 触发的事件类型
//   fromAi: 'duidui'|'tiantian'|null,  // 从哪个AI换牌
//   swapPool: [Card],         // 玩家可选牌的池子
//   maxSelect: number,        // 最多换几张
//   aiTaunt: string,          // AI的嘲讽/宣言
//   reason: string            // 触发原因
// }
// ============================================================
router.post('/card-change', (req, res) => {
  try {
    const { gameState, playerHand, ai1Hand, ai2Hand } = req.body;

    if (!gameState) {
      return res.status(400).json({ error: 'gameState is required' });
    }

    const round = gameState.round || 1;
    const correct = gameState.correct === true;
    const score = gameState.score || 0;

    // 换牌触发条件
    // 1. 答对题 + 至少第3回合 → 大概率触发
    // 2. 答错题 + 较高回合 → 小概率触发安慰换牌
    let shouldTrigger = false;
    let reason = '';
    let fromAi = null;
    let maxSelect = 0;

    if (correct) {
      // 正确：按回合数递增概率
      const baseRate = round >= 5 ? 0.7 : round >= 3 ? 0.5 : 0.25;
      shouldTrigger = Math.random() < baseRate;
      reason = '答题正确，AI决定奖励你一次换牌机会！';
      maxSelect = round >= 5 ? 2 : 1;
      fromAi = round % 2 === 0 ? 'tiantian' : 'duidui';
    } else {
      // 错误：低概率安慰换牌
      const consolationRate = round >= 5 ? 0.3 : 0.1;
      shouldTrigger = Math.random() < consolationRate;
      reason = '答错了……AI于心不忍，给你一张好的。';
      maxSelect = 1;
      fromAi = 'duidui';
    }

    if (!shouldTrigger) {
      // 没触发但后端给出不触发的结果
      return res.json({
        triggered: false,
        action: null,
        fromAi: null,
        swapPool: [],
        maxSelect: 0,
        aiTaunt: '',
        reason: ''
      });
    }

    // 生成换牌池 —— 从对应AI手牌中抽取高价值牌给玩家选
    const aiHand = fromAi === 'duidui' ? ai1Hand : ai2Hand;
    const aiName = fromAi === 'duidui' ? '王怼怼' : '苏甜甜';

    let swapPool = [];

    if (aiHand && Array.isArray(aiHand) && aiHand.length > 0) {
      // 从AI手牌中选出价值较高的牌组成候选池
      const candidates = aiHand.filter(c => {
        // 排除王和2（太强了不直接给），除非AI手牌太少
        const isStrong = c.rank >= 12 || c.rank <= 0;
        return !isStrong;
      });

      // 如果AI没啥可给的，就放宽限制
      const poolSource = candidates.length >= 3 ? candidates : aiHand;

      // 随机打乱，取最多4张给玩家选择
      const shuffled = [...poolSource].sort(() => Math.random() - 0.5);
      swapPool = shuffled.slice(0, Math.min(4, shuffled.length));
    } else {
      // 没有AI手牌数据时，用默认牌池
      const suits = ['spade', 'heart', 'club', 'diamond'];
      const ranks = [7, 8, 9, 10]; // 8-10（对应10/J/Q/K，偏大牌）
      for (let i = 0; i < 4; i++) {
        swapPool.push({
          suit: suits[i % 4],
          rank: ranks[i],
          display: '',
          isRed: suits[i % 4] === 'heart' || suits[i % 4] === 'diamond'
        });
      }
    }

    // AI 嘲讽台词
    const taunts = fromAi === 'duidui'
      ? [
          '来，挑一张，别辜负我的「好意」。',
          '给你一个换牌的机会，可别说我欺负人。',
          '你选走了我也不会输，因为——我是AI。',
          '挑吧，反正你换了也打不过我。'
        ]
      : [
          '分享牌牌～你一张我一张我们就是好朋友！',
          '选你喜欢的！我可以再抽！',
          '送你一张好牌！不用谢我！要谢就谢你自己的努力！',
          '快选快选！我手都举酸了！'
        ];

    const aiTaunt = taunts[Math.floor(Math.random() * taunts.length)];

    res.json({
      triggered: true,
      action: 'cardChange',
      fromAi,
      swapPool,
      maxSelect,
      aiTaunt,
      reason
    });

  } catch (err) {
    console.error('Chaos card-change error:', err);
    res.status(500).json({ error: 'Card change trigger failed', message: err.message });
  }
});

// ============================================================
// GET /api/chaos/types - 题型列表
// ============================================================
router.get('/types', (req, res) => {
  res.json(questionTemplates.TYPE_META);
});

module.exports = router;
