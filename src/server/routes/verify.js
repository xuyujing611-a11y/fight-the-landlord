/**
 * src/server/routes/verify.js - 出牌验证 API
 *
 * 核心功能:
 *   POST /api/verify/play      - 出牌合法性验证
 *   POST /api/verify/find      - 枚举所有合法出牌
 *   POST /api/verify/identify  - 纯牌型识别
 */

const express = require('express');
const router = express.Router();
const cardUtils = require('../utils/cardUtils');

const { Doudizhu, HAND_TYPES, HAND_TYPE_NAMES } = cardUtils;

// ============================================================
// POST /api/verify/play - 验证出牌合法性
//
// Body: {
//   current: [{suit,rank}],     // 当前要出的牌
//   lastPlay: [{suit,rank}]|null, // 上家出的牌（null=自由出牌）
//   hand: [{suit,rank}]|null     // 玩家手牌（可选，用于验证是否能出这些牌）
// }
//
// Response: {
//   valid: bool,
//   type: { type, typeName, rank, length },
//   canBeat: bool|null,          // 是否能压过 lastPlay
//   inHand: bool|null,           // 是否在手牌中
//   error: string|null
// }
// ============================================================
router.post('/play', (req, res) => {
  try {
    const { current, lastPlay, hand } = req.body;

    // 参数校验
    if (!current || !Array.isArray(current) || current.length === 0) {
      return res.status(400).json({
        valid: false,
        error: 'current is required and must be a non-empty array'
      });
    }

    // 转换牌对象
    let currentCards;
    try {
      currentCards = cardUtils.toCards(current);
    } catch (e) {
      return res.status(400).json({
        valid: false,
        error: 'Invalid card format: ' + e.message
      });
    }

    // 识别牌型
    const typeInfo = Doudizhu.identifyType(currentCards);
    const isValid = typeInfo.type !== HAND_TYPES.INVALID;
    const result = {
      valid: isValid,
      type: {
        type: typeInfo.type,
        typeName: HAND_TYPE_NAMES[typeInfo.type] || typeInfo.type,
        rank: typeInfo.rank,
        length: typeInfo.length
      },
      canBeat: null,
      inHand: null,
      error: isValid ? null : '非法牌型组合'
    };

    // 如果不合法，直接返回
    if (!isValid) {
      return res.json(result);
    }

    // 验证是否能压过上家的牌
    if (lastPlay && Array.isArray(lastPlay) && lastPlay.length > 0) {
      try {
        const lastCards = cardUtils.toCards(lastPlay);
        const lastType = Doudizhu.identifyType(lastCards);

        if (lastType.type === HAND_TYPES.INVALID) {
          result.canBeat = false;
          result.error = '上家出的牌无效';
        } else {
          result.canBeat = Doudizhu.canBeat(currentCards, lastCards);
          if (!result.canBeat) {
            result.error = `不能压过上家的 ${HAND_TYPE_NAMES[lastType.type] || lastType.type}`;
          }
        }
      } catch (e) {
        result.canBeat = false;
        result.error = '解析上家牌失败: ' + e.message;
      }
    }

    // 验证牌是否在手牌中
    if (hand && Array.isArray(hand) && hand.length > 0) {
      try {
        const handCards = cardUtils.toCards(hand);
        result.inHand = isSubset(currentCards, handCards);
        if (!result.inHand) {
          result.error = result.error
            ? result.error + '；且该牌不在你的手牌中'
            : '该牌不在你的手牌中';
        }
      } catch (e) {
        result.inHand = false;
      }
    }

    res.json(result);

  } catch (err) {
    console.error('Verify play error:', err);
    res.status(500).json({ valid: false, error: err.message });
  }
});

// ============================================================
// POST /api/verify/find - 枚举所有合法出牌
//
// Body: {
//   hand: [{suit,rank}],
//   lastPlay: [{suit,rank}]|null,  // null = 自由出牌
//   page: number,                    // 分页（可选）
//   pageSize: number                 // 每页数量（可选）
// }
//
// Response: {
//   total: number,
//   totalTypeSummary: { typeName: count },
//   plays: [{ cards, type, typeName }],
//   page: number|null,
//   pageSize: number|null
// }
// ============================================================
router.post('/find', (req, res) => {
  try {
    const { hand, lastPlay, page, pageSize } = req.body;

    if (!hand || !Array.isArray(hand) || hand.length === 0) {
      return res.status(400).json({ error: 'hand is required and must be non-empty' });
    }

    const handCards = cardUtils.toCards(hand);
    const lastCards = lastPlay && lastPlay.length > 0 ? cardUtils.toCards(lastPlay) : null;

    const plays = Doudizhu.findValidPlays(handCards, lastCards);

    // 统计各牌型数量
    const typeSummary = {};
    const playResults = plays.map(p => {
      const info = Doudizhu.identifyType(p);
      const typeName = HAND_TYPE_NAMES[info.type] || info.type;
      typeSummary[typeName] = (typeSummary[typeName] || 0) + 1;
      return {
        cards: cardUtils.serializeCards(p),
        type: info.type,
        typeName,
        rank: info.rank
      };
    });

    // 按类型排序输出
    playResults.sort((a, b) => {
      const order = [
        'SINGLE', 'PAIR', 'TRIPLE', 'TRIPLE_PLUS_ONE', 'TRIPLE_PLUS_TWO',
        'STRAIGHT', 'CONSECUTIVE_PAIRS', 'AIRPLANE', 'AIRPLANE_PLUS_SINGLES',
        'AIRPLANE_PLUS_PAIRS', 'FOUR_PLUS_TWO', 'FOUR_PLUS_TWO_PAIRS',
        'BOMB', 'ROCKET'
      ];
      return (order.indexOf(a.type) !== -1 ? order.indexOf(a.type) : 99) -
             (order.indexOf(b.type) !== -1 ? order.indexOf(b.type) : 99);
    });

    const result = {
      total: playResults.length,
      totalTypeSummary: typeSummary,
      plays: playResults,
      page: null,
      pageSize: null
    };

    // 分页
    if (page !== undefined && pageSize !== undefined) {
      const p = Math.max(1, page);
      const ps = Math.max(1, Math.min(100, pageSize));
      const start = (p - 1) * ps;
      const end = start + ps;
      result.plays = playResults.slice(start, end);
      result.page = p;
      result.pageSize = ps;
    }

    res.json(result);

  } catch (err) {
    console.error('Find plays error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/verify/identify - 纯牌型识别
//
// Body: { cards: [{suit,rank}] }
// Response: { type, typeName, rank, length, valid, summary }
// ============================================================
router.post('/identify', (req, res) => {
  try {
    const { cards } = req.body;

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'cards is required and must be non-empty' });
    }

    const cardInstances = cardUtils.toCards(cards);
    const info = Doudizhu.identifyType(cardInstances);
    const isValid = info.type !== HAND_TYPES.INVALID;

    res.json({
      type: info.type,
      typeName: HAND_TYPE_NAMES[info.type] || info.type,
      rank: info.rank,
      length: info.length,
      valid: isValid,
      error: isValid ? null : '非法牌型',
      sortedCards: cardUtils.serializeCards(Doudizhu.sortCards(cardInstances))
    });

  } catch (err) {
    console.error('Identify error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 工具函数
// ============================================================

/**
 * 检查 childCards 是否是 parentCards 的子集
 * (按 rank 比较，不考虑花色)
 */
function isSubset(child, parent) {
  const parentRanks = parent.map(c => c.rank).sort((a, b) => a - b);
  const childRanks = child.map(c => c.rank).sort((a, b) => a - b);

  let pi = 0;
  for (let ci = 0; ci < childRanks.length; ci++) {
    while (pi < parentRanks.length && parentRanks[pi] < childRanks[ci]) pi++;
    if (pi >= parentRanks.length || parentRanks[pi] !== childRanks[ci]) {
      return false;
    }
    pi++;
  }
  return true;
}

module.exports = router;
