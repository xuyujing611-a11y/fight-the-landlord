/**
 * src/server/routes/result.js - 游戏结算 API
 *
 * POST /api/game/result
 *
 * Body: {
 *   winner: 'player'|'duidui'|'tiantian',  // 谁赢了
 *   baseScore: number,          // 底分(叫分结果)
 *   bombMultiplier: number,     // 炸弹翻倍次数
 *   chaosScore: number,         // 搞事情得分
 *   remainingCards: number,     // 赢家剩余手牌数
 *   playerHandCards: number     // 玩家手牌张数（用于负数扣分）
 * }
 *
 * Response: {
 *   result: 'win'|'lose',
 *   totalScore: number,
 *   breakdown: { base, bombBonus, chaosBonus, handCardBonus },
 *   winnerName: string
 * }
 */

const express = require('express');
const router = express.Router();

const WINNER_NAMES = {
  player: '你',
  duidui: '王怼怼',
  tiantian: '苏甜甜'
};

// 每张剩余牌的计分权重
const HAND_CARD_UNIT = 4;

/**
 * POST /api/game/result - 游戏结算
 */
router.post('/', (req, res) => {
  try {
    const { winner, baseScore, bombMultiplier, chaosScore, remainingCards, playerHandCards } = req.body;

    // 参数校验
    if (!winner || !['player', 'duidui', 'tiantian'].includes(winner)) {
      return res.status(400).json({ error: 'winner must be "player", "duidui", or "tiantian"' });
    }
    if (baseScore === undefined || typeof baseScore !== 'number') {
      return res.status(400).json({ error: 'baseScore is required and must be a number' });
    }

    const isPlayerWin = winner === 'player';
    const result = isPlayerWin ? 'win' : 'lose';
    const winnerName = WINNER_NAMES[winner] || '未知';
    const bomb = Math.max(bombMultiplier || 1, 1);
    const chaos = chaosScore || 0;
    const remain = remainingCards || 0;
    const playerCards = playerHandCards || 0;

    // ── 分数计算 ──────────────────────────────────────
    //
    // 基础分 = 底分 × 8（地主赢普通倍率）
    // 炸弹加成 = 基础分 × (炸弹倍数 - 1)（每多一颗炸弹多一倍）
    // 搞事情加成 = 搞事情得分
    // 手牌加成:
    //   玩家赢 → 赢家剩余手牌越少奖励越多，capped
    //   玩家输 → 按玩家剩余手牌数扣分
    //

    let base, bombBonus, handCardBonus;

    if (isPlayerWin) {
      // 玩家赢：正向计分
      base = baseScore * 8;
      bombBonus = base * (bomb - 1);
      handCardBonus = remain * HAND_CARD_UNIT;
    } else {
      // 玩家输：罚分（负数）
      base = -(baseScore * 8);
      bombBonus = -(baseScore * 8 * (bomb - 1));
      handCardBonus = -(playerCards * HAND_CARD_UNIT);
    }

    const chaosBonus = isPlayerWin ? chaos : -chaos;

    const totalScore = base + bombBonus + chaosBonus + handCardBonus;

    res.json({
      result,
      totalScore,
      breakdown: { base, bombBonus, chaosBonus, handCardBonus },
      winnerName
    });

  } catch (err) {
    console.error('Game result error:', err);
    res.status(500).json({ error: 'Score calculation failed', message: err.message });
  }
});

module.exports = router;
