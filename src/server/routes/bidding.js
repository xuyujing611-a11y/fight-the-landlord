/**
 * src/server/routes/bidding.js - 叫分 API
 *
 * POST /api/bidding/start     - 开始叫分，返回叫分顺序和初始状态
 * POST /api/bidding/place     - 玩家叫分 (bid: 0=不叫, 1/2/3=叫地主)
 * GET  /api/bidding/ai        - AI 根据手牌做叫分决策
 *
 * 叫分规则:
 *   1. 随机定一个玩家先叫，顺时针轮流
 *   2. 可叫1分、2分、3分，或选择不叫
 *   3. 最高分者为地主，获得3张底牌
 *   4. 全都不叫则重新发牌
 */

const express = require('express');
const router = express.Router();
const cardUtils = require('../utils/cardUtils');

const { Doudizhu } = cardUtils;

// 叫分状态（单局内存，生产环境应放 session/redis）
var biddingState = null;

function resetBidding() {
  biddingState = null;
}

/** 规范化单张牌：确保王牌的suit正确 */
function normalizeCard(c) {
  if (c.rank >= 13 && c.suit !== 'joker') {
    return { suit: 'joker', rank: c.rank };
  }
  if (c.rank < 13 && c.suit === 'joker') {
    return { suit: 'spade', rank: c.rank };
  }
  return { suit: c.suit || 'spade', rank: c.rank };
}

/** 规范化牌组 */
function normalizeCards(arr) {
  return (arr || []).map(c => normalizeCard(c));
}

/** 规范化每手牌 */
function normalizeHands(hands) {
  return (hands || []).map(h => normalizeCards(h));
}

// ============================================================
// 评估手牌强度（用于AI叫分）
// ============================================================
function evaluateHandStrength(handRanks) {
  const groups = {};
  for (const r of handRanks) groups[r] = (groups[r] || 0) + 1;

  let score = 0;
  let hasBomb = false;

  for (const [rank, count] of Object.entries(groups)) {
    const r = parseInt(rank);
    if (count === 4) {
      score += 12; // 炸弹
      hasBomb = true;
    } else if (count === 3) {
      score += 4;  // 三张
    } else if (count === 2) {
      score += 1;  // 对子
    }

    // 大牌加分
    if (r === 14) score += 6;  // 大王
    if (r === 13) score += 4;  // 小王
    if (r === 12) score += 2;  // 2
    if (r === 11) score += 1;  // A
  }

  // 至少有1个炸弹
  if (hasBomb) score += 5;
  // 有王
  if (groups[13] && groups[14]) score += 3;

  return score;
}

// ============================================================
// POST /api/bidding/start - 开始叫分
//
// Body: {
//   playerId: string,         // 玩家ID
//   hands: [                   // 三人手牌
//     [{suit, rank}, ...],     // 玩家自己的手牌
//     [{suit, rank}, ...],     // AI1 手牌
//     [{suit, rank}, ...]      // AI2 手牌
//   ],
//   remaining: [{suit, rank}, ...]  // 3张底牌
// }
//
// Response: {
//   biddingId: string,
//   turn: number,              // 当前应该叫分的玩家 (0=玩家, 1=AI1, 2=AI2)
//   firstBidder: number,       // 先叫的玩家
//   order: [0,1,2],            // 叫分顺序
//   bids: [null, null, null],  // 当前叫分结果
//   currentBid: 'waiting',     // 'waiting' | 'done'
//   message: string
// }
// ============================================================
router.post('/start', (req, res) => {
  try {
    const { playerId, hands, remaining } = req.body;

    if (!hands || !Array.isArray(hands) || hands.length !== 3) {
      return res.status(400).json({ error: 'hands must be an array of 3 hands' });
    }

    // 随机选定先叫的玩家
    const firstBidder = Math.floor(Math.random() * 3);

    // 叫分顺序: 从firstBidder开始，顺时针
    const order = [];
    for (let i = 0; i < 3; i++) {
      order.push((firstBidder + i) % 3);
    }

    biddingState = {
      id: `bid_${Date.now()}`,
      playerId: playerId || 'anonymous',
      hands: normalizeHands(hands),  // 0=玩家, 1=AI1, 2=AI2
      remaining: normalizeCards(remaining || []),
      order: order,
      firstBidder: firstBidder,
      currentTurnIndex: 0,       // order 数组的索引
      bids: [null, null, null],  // 叫分结果
      highestBid: 0,
      highestBidder: -1,
      passCount: 0,
      phase: 'bidding',
      startedAt: Date.now()
    };

    const turn = order[0]; // 当前应该叫分的人

    res.json({
      biddingId: biddingState.id,
      turn,
      firstBidder,
      order,
      bids: [null, null, null],
      currentBid: 'waiting',
      currentBidder: turn === 0 ? 'player' : (turn === 1 ? 'ai1' : 'ai2'),
      message: turn === 0
        ? '请叫分（叫地主1/2/3分，或不叫）'
        : 'AI思考中...',
      handStrength: turn === 0 ? evaluateHandStrength(
        hands[0].map(c => c.rank || c)
      ) : null
    });

  } catch (err) {
    console.error('Bidding start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/bidding/place - 玩家叫分
//
// Body: {
//   biddingId: string,
//   bid: number,        // 0=不叫, 1, 2, 3=叫地主
//   playerIndex: number  // 0=玩家, 1=AI1, 2=AI2
// }
//
// Response: {
//   phase: 'bidding' | 'done' | 'redeal',
//   turn: number | null,          // 下一个叫分的人，phase=done时null
//   currentBidder: string | null,
//   bids: [number|null, ...],
//   highestBid: number,
//   highestBidder: number,       // -1 = none
//   landlordCards: [{suit,rank}] | null,  // 地主获得的底牌
//   landlordHand: [{suit,rank}] | null,   // 地主完整手牌
//   winnerText: string | null,
//   message: string
// }
// ============================================================
router.post('/place', (req, res) => {
  try {
    const { biddingId, bid, playerIndex } = req.body;

    if (!biddingState) {
      return res.status(400).json({ error: 'No active bidding session. Call /bidding/start first.' });
    }

    if (biddingState.id !== biddingId) {
      return res.status(400).json({ error: 'Bidding ID mismatch. Session expired.' });
    }

    if (biddingState.phase !== 'bidding') {
      return res.status(400).json({ error: 'Bidding is already completed' });
    }

    // 验证玩家索引
    const idx = playerIndex;
    if (idx < 0 || idx > 2) {
      return res.status(400).json({ error: 'Invalid player index' });
    }

    // 验证叫分
    const validBids = [0, 1, 2, 3];
    if (!validBids.includes(bid)) {
      return res.status(400).json({ error: 'Bid must be 0 (pass), 1, 2, or 3' });
    }

    // 验证叫分顺序
    const expectedIdx = biddingState.order[biddingState.currentTurnIndex];
    if (idx !== expectedIdx) {
      return res.status(400).json({
        error: `Not your turn. Expected player ${expectedIdx}, got ${idx}`
      });
    }

    // 记录叫分
    biddingState.bids[idx] = bid;

    if (bid === 0) {
      biddingState.passCount++;
    } else {
      // 有效叫分
      if (bid > biddingState.highestBid) {
        biddingState.highestBid = bid;
        biddingState.highestBidder = idx;
      }
      // 叫3分直接地主
      if (bid === 3) {
        return finishBidding(res, idx);
      }
    }

    // 检查是否所有人都叫完了
    const nextTurnIndex = biddingState.currentTurnIndex + 1;

    // 如果所有人都叫完了（3人全部叫完）
    if (nextTurnIndex >= 3) {
      // 有人叫分
      if (biddingState.highestBidder >= 0) {
        return finishBidding(res, biddingState.highestBidder);
      } else {
        // 全都不叫
        biddingState.phase = 'redeal';
        return res.json({
          phase: 'redeal',
          turn: null,
          currentBidder: null,
          bids: biddingState.bids,
          highestBid: 0,
          highestBidder: -1,
          landlordCards: null,
          landlordHand: null,
          winnerText: null,
          message: '三家都不叫，重新发牌'
        });
      }
    }

    // 轮到下一个人
    biddingState.currentTurnIndex = nextTurnIndex;
    const nextPlayer = biddingState.order[nextTurnIndex];

    res.json({
      phase: 'bidding',
      turn: nextPlayer,
      currentBidder: nextPlayer === 0 ? 'player' : (nextPlayer === 1 ? 'ai1' : 'ai2'),
      bids: biddingState.bids,
      highestBid: biddingState.highestBid,
      highestBidder: biddingState.highestBidder,
      landlordCards: null,
      landlordHand: null,
      winnerText: null,
      message: nextPlayer === 0
        ? '轮到你了，请叫分'
        : (nextPlayer === 1 ? '王怼怼思考中...' : '苏甜甜思考中...')
    });

  } catch (err) {
    console.error('Bidding place error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 完成叫分，确定地主
 */
function finishBidding(res, landlordIndex) {
  const remaining = biddingState.remaining || [];
  const landlordHand = [
    ...biddingState.hands[landlordIndex].map(c =>
      typeof c === 'number' ? { suit: 'spade', rank: c } : c
    ),
    ...remaining.map(c =>
      typeof c === 'number' ? { suit: 'spade', rank: c } : c
    )
  ];

  biddingState.phase = 'done';
  biddingState.landlordIndex = landlordIndex;

  // 整理地主手牌
  const sortedLandlord = Doudizhu.sortCards(
    landlordHand.map(c => {
      const nc = normalizeCard(c);
      if (typeof nc.rank !== 'number') return c;
      try {
        return new Doudizhu.Card(nc.suit, nc.rank);
      } catch (e) {
        console.warn('Card creation failed:', nc, e.message);
        return c;
      }
    }).filter(Boolean)
  );

  const landlordName = landlordIndex === 0 ? '你' : (landlordIndex === 1 ? '王怼怼' : '苏甜甜');
  const bid = biddingState.bids[landlordIndex];

  res.json({
    phase: 'done',
    turn: null,
    currentBidder: null,
    bids: biddingState.bids,
    highestBid: biddingState.highestBid,
    highestBidder: landlordIndex,
    landlordIndex,
    landlordName,
    landlordCards: biddingState.remaining.map(c =>
      typeof c === 'object' && c.suit ? c : { suit: 'spade', rank: c }
    ),
    landlordHand: sortedLandlord.map(c => ({
      suit: c.suit,
      rank: c.rank,
      display: c.displayName(),
      isRed: c.isRed()
    })),
    winnerText: `${landlordName} 以 ${bid} 分成为地主！`,
    message: `${landlordName} 以 ${bid} 分成为地主！获得 3 张底牌`
  });
}

// ============================================================
// GET /api/bidding/ai - AI 叫分决策
//
// Query: hand=encoded_hand  (或直接传 body)
//        currentBid=number  (当前最高叫分)
//
// Response: { bid: 0|1|2|3, reason: string, strength: number }
// ============================================================
router.get('/ai', (req, res) => {
  try {
    const { hand, currentBid } = req.query;

    let handCards;
    if (hand) {
      try {
        handCards = JSON.parse(Buffer.from(hand, 'base64').toString());
      } catch {
        handCards = JSON.parse(hand);
      }
    } else if (req.body && req.body.hand) {
      handCards = req.body.hand;
    } else {
      return res.status(400).json({ error: 'hand is required' });
    }

    const currentBidValue = parseInt(currentBid) || 0;
    const strength = evaluateHandStrength(handCards.map(c => c.rank));

    // AI 叫分策略
    let bid = 0;
    let reason = '';

    if (strength >= 20) {
      bid = 3;
      reason = '手牌很强（炸弹+大牌），叫3分！';
    } else if (strength >= 14) {
      bid = Math.min(2, Math.max(1, strength >= 17 ? 2 : 1));
      reason = '手牌不错，叫' + bid + '分。';
    } else if (strength >= 9) {
      bid = 1;
      reason = '手牌一般，尝试叫1分。';
    } else {
      bid = 0;
      reason = '手牌太弱，不叫。';
    }

    // 如果当前最高叫分 >= AI 想叫的，AI 选择不叫或叫更高的
    if (bid <= currentBidValue) {
      if (strength >= 20 && currentBidValue < 3) {
        bid = 3;
        reason = '手牌有炸弹，必须抢！叫3分！';
      } else {
        bid = 0;
        reason = '当前叫分已到' + currentBidValue + '分，AI选择不叫。';
      }
    }

    res.json({
      bid,
      reason,
      strength,
      handStrengthLabel: strength >= 20 ? '极强' : (strength >= 14 ? '较强' : (strength >= 9 ? '一般' : '较弱'))
    });

  } catch (err) {
    console.error('AI bidding error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POST /api/bidding/reset - 重置叫分状态
// ============================================================
router.post('/reset', (req, res) => {
  resetBidding();
  res.json({ success: true, message: 'Bidding state reset' });
});

module.exports = { router, resetBidding };
