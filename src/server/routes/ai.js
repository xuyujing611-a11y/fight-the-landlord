/**
 * src/server/routes/ai.js - AI 出牌决策 API
 *
 * POST /api/ai/play
 *   Body: { hand: [{suit,rank}], lastPlay: [{suit,rank}]|null, difficulty?: 'easy'|'normal'|'hard' }
 *   Response: { choice: { cards:[], type, typeName }, explanation: string, isValid: bool }
 *
 * 对接 MiniMax / DeepSeek 进行智能决策。
 * 默认使用策略引擎 + 大模型兜底。
 */

const express = require('express');
const router = express.Router();
const cardUtils = require('../utils/cardUtils');
const { callLLMForPlay } = require('../services/llmService');

const { Doudizhu, HAND_TYPES, HAND_TYPE_NAMES } = cardUtils;

// 策略权重配置（由难到易）
const STRATEGY_WEIGHTS = {
  aggressive: { bomb: 10, rocket: 10, big: 8, medium: 5, small: 2, pass: 1 },
  normal:     { bomb: 8, rocket: 10, big: 6, medium: 6, small: 4, pass: 5 },
  defensive:  { bomb: 5, rocket: 10, big: 4, medium: 6, small: 8, pass: 8 },
};

/**
 * 策略引擎：根据手牌和局面选出最优出牌
 */
function strategyPlay(hand, lastPlay, difficulty) {
  const handCards = cardUtils.toCards(hand);
  const lastCards = lastPlay ? cardUtils.toCards(lastPlay) : null;

  // 枚举所有合法出牌
  const validPlays = Doudizhu.findValidPlays(handCards, lastCards);

  if (!validPlays || validPlays.length === 0) {
    // 没有能出的牌
    return null;
  }

  // 自由出牌（先手）：选择最优策略
  if (!lastCards || lastCards.length === 0) {
    return chooseFirstPlay(validPlays, handCards, difficulty);
  }

  // 跟牌：选择能压住的最优解
  return chooseFollowPlay(validPlays, handCards, lastCards, difficulty);
}

/**
 * 先手出牌策略
 */
function chooseFirstPlay(plays, hand, difficulty) {
  // 按类型优先级排序
  const typePriority = {
    SINGLE: 5, PAIR: 4, TRIPLE: 3,
    TRIPLE_PLUS_ONE: 3, TRIPLE_PLUS_TWO: 2,
    STRAIGHT: 2, CONSECUTIVE_PAIRS: 2, AIRPLANE: 1,
    BOMB: 0, ROCKET: 0, FOUR_PLUS_TWO: 1
  };

  // 评估每个出牌的得分
  let bestPlay = plays[0];
  let bestScore = -1;

  for (const play of plays) {
    const info = Doudizhu.identifyType(play);
    let score = 0;

    // 基础分：牌型优先级
    score += (typePriority[info.type] || 5) * 10;

    // 手牌数越少，越应该出能一次走完的牌
    const remainingAfter = hand.length - play.length;
    if (remainingAfter === 0) {
      score += 100; // 一手出完！
    } else if (remainingAfter <= 3) {
      score += 40; // 接近胜利
    }

    // rank 评估：大的 rank 高分（单张/对子），小的 rank 优先出
    if (info.type === HAND_TYPES.SINGLE || info.type === HAND_TYPES.PAIR) {
      if (info.rank <= 6) score += 20;  // 3-6 先出小牌
      else if (info.rank <= 10) score += 10; // 中等
      else if (info.rank === 14) score -= 10; // 大王保留
    }

    // 保留炸弹和火箭
    if (info.type === HAND_TYPES.BOMB || info.type === HAND_TYPES.ROCKET) {
      score -= 30;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPlay = play;
    }
  }

  return bestPlay;
}

/**
 * 跟牌策略
 */
function chooseFollowPlay(plays, hand, lastPlay, difficulty) {
  const lastInfo = Doudizhu.identifyType(lastPlay);
  if (!lastInfo || lastInfo.type === HAND_TYPES.INVALID) return null;

  // 如果对手出的是炸弹/火箭，评估是否用更大的炸弹或火箭压
  if (lastInfo.type === HAND_TYPES.BOMB || lastInfo.type === HAND_TYPES.ROCKET) {
    // 用更大的炸弹或火箭压
    for (const play of plays) {
      const info = Doudizhu.identifyType(play);
      if (info.type === HAND_TYPES.ROCKET) return play;
      if (info.type === HAND_TYPES.BOMB && info.rank > lastInfo.rank) return play;
    }
    return null; // 压不住
  }

  // 普通牌型：找最经济的出法
  let bestPlay = null;

  for (const play of plays) {
    const info = Doudizhu.identifyType(play);

    // 普通牌型，直接找 rank 最小的能压的
    if (info.type === lastInfo.type && info.length === lastInfo.length) {
      if (!bestPlay) {
        bestPlay = play;
      } else {
        // 选 rank 最小的（最经济）
        const bestInfo = Doudizhu.identifyType(bestPlay);
        if (info.rank < bestInfo.rank) {
          bestPlay = play;
        }
      }
    }

    // 用炸弹压（保留选项，除非没有其他选择）
  }

  // 如果没有普通牌能压，考虑用炸弹
  if (!bestPlay) {
    for (const play of plays) {
      const info = Doudizhu.identifyType(play);
      if (info.type === HAND_TYPES.BOMB) {
        if (!bestPlay) bestPlay = play;
      }
    }
  }

  // 还没有就出火箭
  if (!bestPlay) {
    for (const play of plays) {
      const info = Doudizhu.identifyType(play);
      if (info.type === HAND_TYPES.ROCKET) {
        bestPlay = play;
      }
    }
  }

  return bestPlay;
}

// ============================================================
// POST /api/ai/play
// ============================================================
router.post('/play', async (req, res) => {
  try {
    const { hand, lastPlay, difficulty, mode } = req.body;

    // 参数校验
    if (!hand || !Array.isArray(hand) || hand.length === 0) {
      return res.status(400).json({ error: 'hand is required and must be a non-empty array' });
    }

    const diff = difficulty || 'normal';
    const useLLM = mode === 'llm'; // 可选：强制用大模型

    // Step 1: 策略引擎给出基准
    let chosenPlay = strategyPlay(hand, lastPlay, diff);

    // Step 2: 如果启用 LLM，用大模型优化
    if (useLLM && process.env.LLM_API_KEY) {
      try {
        const llmResult = await callLLMForPlay(hand, lastPlay, diff);
        if (llmResult && llmResult.cards) {
          const llmCards = cardUtils.toCards(llmResult.cards);
          const allPlays = Doudizhu.findValidPlays(
            cardUtils.toCards(hand),
            lastPlay ? cardUtils.toCards(lastPlay) : null
          );
          // 验证 LLM 出的牌是合法的
          const isValid = allPlays.some(p => {
            if (p.length !== llmCards.length) return false;
            const ranks1 = p.map(c => c.rank).sort().join(',');
            const ranks2 = llmCards.map(c => c.rank).sort().join(',');
            return ranks1 === ranks2;
          });
          if (isValid) {
            chosenPlay = llmCards;
          }
        }
      } catch (llmErr) {
        console.warn('LLM fallback failed, using strategy engine:', llmErr.message);
      }
    }

    // Step 3: 无法出牌
    if (!chosenPlay) {
      return res.json({
        choice: null,
        explanation: '没有可以出的牌',
        handRemaining: hand.length,
        canPlay: false
      });
    }

    const info = Doudizhu.identifyType(chosenPlay);

    res.json({
      choice: {
        cards: cardUtils.serializeCards(chosenPlay),
        type: info.type,
        typeName: HAND_TYPE_NAMES[info.type] || info.type,
        rank: info.rank
      },
      explanation: `出 ${HAND_TYPE_NAMES[info.type] || info.type}`,
      handRemaining: hand.length - chosenPlay.length,
      canPlay: true
    });

  } catch (err) {
    console.error('AI play error:', err);
    res.status(500).json({ error: 'AI decision failed', message: err.message });
  }
});

/**
 * POST /api/ai/evaluate - 评估手牌强度
 */
router.post('/evaluate', (req, res) => {
  try {
    const { hand } = req.body;
    if (!hand || !Array.isArray(hand)) {
      return res.status(400).json({ error: 'hand is required' });
    }

    const handCards = cardUtils.toCards(hand);
    const groups = Doudizhu.groupByRank(handCards);
    const allPlays = Doudizhu.findValidPlays(handCards, null);

    // 统计各类牌型数量
    let stats = { singles: 0, pairs: 0, triples: 0, bombs: 0, hasRocket: false, straights: 0 };

    const seenTypes = {};
    for (const play of allPlays) {
      const info = Doudizhu.identifyType(play);
      const key = info.type;
      if (!seenTypes[key]) seenTypes[key] = new Set();
      seenTypes[key].add(info.rank);
    }

    stats.singles = (seenTypes.SINGLE || new Set()).size;
    stats.pairs = (seenTypes.PAIR || new Set()).size;
    stats.triples = (seenTypes.TRIPLE || new Set()).size;
    stats.bombs = (seenTypes.BOMB || new Set()).size;
    stats.hasRocket = !!(groups[13] && groups[14]);
    stats.straights = (seenTypes.STRAIGHT || new Set()).size;

    // 简单评分
    let score = 0;
    score += stats.bombs * 15;
    score += stats.hasRocket ? 20 : 0;
    score -= stats.singles * 2;
    score += stats.pairs * 1;
    score += stats.straights * 3;

    res.json({
      handSize: hand.length,
      stats,
      score: Math.max(0, score),
      evaluation: score >= 30 ? 'strong' : score >= 15 ? 'medium' : 'weak'
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
