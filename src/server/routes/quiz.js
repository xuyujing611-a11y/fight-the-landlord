/**
 * src/server/routes/quiz.js - 出题系统 API
 *
 * POST /api/quiz/generate
 *   Body: {
 *     type: 'all'|'identify'|'canBeat'|'findPlay',
 *     difficulty: 'easy'|'normal'|'hard',
 *     count: 1-10 (default 1)
 *   }
 *
 * 支持题型:
 *   identify  - 识别牌型
 *   canBeat   - 判断能否压过
 *   findPlay  - 找出能压的牌
 */

const express = require('express');
const router = express.Router();
const cardUtils = require('../utils/cardUtils');

const { Doudizhu, HAND_TYPES, HAND_TYPE_NAMES } = cardUtils;

// ============================================================
// 题型数据生成器
// ============================================================

/**
 * 【题型1】识别牌型 - 给出一组牌，问是什么牌型
 */
function generateIdentifyQuestion(difficulty) {
  // 预定义的牌型样例 (rank数组)
  const samples = [
    { cards: [0], type: HAND_TYPES.SINGLE, desc: '单张 3' },
    { cards: [11], type: HAND_TYPES.SINGLE, desc: '单张 A' },
    { cards: [14], type: HAND_TYPES.SINGLE, desc: '单张 大王' },
    { cards: [3, 3], type: HAND_TYPES.PAIR, desc: '对子 77' },
    { cards: [12, 12], type: HAND_TYPES.PAIR, desc: '对子 22' },
    { cards: [0, 0, 0], type: HAND_TYPES.TRIPLE, desc: '三张 333' },
    { cards: [0, 0, 0, 1], type: HAND_TYPES.TRIPLE_PLUS_ONE, desc: '三带一 333+4' },
    { cards: [0, 0, 0, 1, 1], type: HAND_TYPES.TRIPLE_PLUS_TWO, desc: '三带二 333+44' },
    { cards: [0, 1, 2, 3, 4], type: HAND_TYPES.STRAIGHT, desc: '顺子 34567' },
    { cards: [7, 8, 9, 10, 11], type: HAND_TYPES.STRAIGHT, desc: '顺子 10JQKA' },
    { cards: [0, 0, 1, 1, 2, 2], type: HAND_TYPES.CONSECUTIVE_PAIRS, desc: '连对 334455' },
    { cards: [0, 0, 0, 1, 1, 1], type: HAND_TYPES.AIRPLANE, desc: '飞机 333444' },
    { cards: [0, 0, 0, 0], type: HAND_TYPES.BOMB, desc: '炸弹 3333' },
    { cards: [13, 14], type: HAND_TYPES.ROCKET, desc: '火箭' },
    { cards: [0, 0, 0, 0, 1, 2], type: HAND_TYPES.FOUR_PLUS_TWO, desc: '四带二 3333+4+5' },
    { cards: [0, 0, 0, 0, 1, 1, 2, 2], type: HAND_TYPES.FOUR_PLUS_TWO_PAIRS, desc: '四带两对 3333+44+55' },
  ];

  // 根据难度筛选
  const diffMap = { easy: { maxIdx: 6 }, normal: { maxIdx: 12 }, hard: { maxIdx: 15 } };
  const limit = diffMap[difficulty] || diffMap.normal;
  const pool = samples.slice(0, limit.maxIdx + 1);

  // 随机选一个
  const sample = pool[Math.floor(Math.random() * pool.length)];
  const cardInstances = cardUtils.createCardsByRank(sample.cards);
  const info = Doudizhu.identifyType(cardInstances);

  // 生成干扰项
  const wrongTypes = Object.values(HAND_TYPES)
    .filter(t => t !== sample.type && t !== HAND_TYPES.INVALID);

  // 选4个干扰项（包括正确答案的位置随机）
  const shuffledWrong = shuffleArray(wrongTypes).slice(0, 3);
  const allOptions = shuffleArray([
    { label: HAND_TYPE_NAMES[sample.type], value: sample.type, correct: true },
    ...shuffledWrong.map(t => ({ label: HAND_TYPE_NAMES[t], value: t, correct: false }))
  ]);

  return {
    type: 'identify',
    difficulty,
    question: '请识别以下牌型：',
    cards: cardUtils.serializeCards(cardInstances),
    options: allOptions.map(o => o.label),
    answer: HAND_TYPE_NAMES[sample.type],
    answerValue: sample.type,
    answerIndex: allOptions.findIndex(o => o.correct)
  };
}

/**
 * 【题型2】能否压过 - 给出两组牌，判断能否压过
 */
function generateCanBeatQuestion(difficulty) {
  const pairs = [
    // current, last, expected
    { current: [1], last: [0], canBeat: true, desc: '4 能压 3' },
    { current: [0], last: [1], canBeat: false, desc: '3 不能压 4' },
    { current: [14], last: [13], canBeat: true, desc: '大王能压小王' },
    { current: [13], last: [14], canBeat: false, desc: '小王不能压大王' },
    { current: [1, 1], last: [0, 0], canBeat: true, desc: '44 能压 33' },
    { current: [12, 12], last: [11, 11], canBeat: true, desc: '22 能压 AA' },
    { current: [0, 0, 0, 0], last: [1, 1], canBeat: true, desc: '炸弹 3333 能压 44' },
    { current: [13, 14], last: [0, 0, 0, 0], canBeat: true, desc: '火箭能压炸弹' },
    { current: [0, 0, 0, 1], last: [1, 1, 1, 2], canBeat: false, desc: '333+4 不能压 444+5' },
    { current: [2, 3, 4, 5, 6], last: [1, 2, 3, 4, 5], canBeat: true, desc: '56789 能压 45678' },
    { current: [0, 1, 2, 3, 4], last: [1, 2, 3, 4, 5], canBeat: false, desc: '34567 不能压 45678' },
  ];

  const pool = pairs;

  const p = pool[Math.floor(Math.random() * pool.length)];
  const curCards = cardUtils.createCardsByRank(p.current);
  const lastCards = cardUtils.createCardsByRank(p.last);

  return {
    type: 'canBeat',
    difficulty,
    question: p.desc,
    currentPlay: cardUtils.serializeCards(curCards),
    lastPlay: cardUtils.serializeCards(lastCards),
    answer: p.canBeat,
    explanation: p.canBeat ? '可以压过' : '不能压过'
  };
}

/**
 * 【题型3】找出能压的牌 - 给手牌和上家牌，找出正确的出牌
 */
function generateFindPlayQuestion(difficulty) {
  const samples = [
    {
      hand: [0, 1, 2, 3, 4, 10, 11],
      lastPlay: [0, 1, 2, 3, 4],
      answerCards: [1, 2, 3, 4, 5],
      desc: '上家出34567，找更大的顺子'
    },
    {
      hand: [0, 0, 1, 1, 2, 10, 11],
      lastPlay: [0, 0],
      answerCards: [1, 1],
      desc: '上家出33，找更大的对子'
    },
    {
      hand: [0, 0, 0, 1, 2, 3, 4],
      lastPlay: [1, 1, 1],
      answerCards: [0, 0, 0],
      desc: '上家出444，找更大的三张'
    },
    {
      hand: [0, 0, 0, 0, 1, 2, 3, 4, 5],
      lastPlay: [1, 1, 1, 1],
      answerCards: [0, 0, 0, 0],
      desc: '上家出4444炸弹，找更大的炸弹'
    },
  ];

  const s = samples[Math.floor(Math.random() * samples.length)];
  const handCards = cardUtils.createCardsByRank(s.hand);
  const lastCards = cardUtils.createCardsByRank(s.lastPlay);
  const answerCards = cardUtils.createCardsByRank(s.answerCards);

  const allPlays = Doudizhu.findValidPlays(handCards, lastCards);

  return {
    type: 'findPlay',
    difficulty,
    question: s.desc,
    hand: cardUtils.serializeCards(handCards),
    lastPlay: cardUtils.serializeCards(lastCards),
    // 正确答案放在 options 里，同时加几个干扰
    answer: cardUtils.serializeCards(answerCards),
    validPlaysCount: allPlays.length,
    hint: allPlays.length > 0
      ? `有 ${allPlays.length} 种出法，试试找最小的`
      : '没有能压的牌'
  };
}

// ============================================================
// POST /api/quiz/generate
// ============================================================
router.post('/generate', (req, res) => {
  try {
    const { type, difficulty, count } = req.body;

    const diff = difficulty || 'normal';
    const num = Math.min(count || 1, 10);

    const questions = [];
    for (let i = 0; i < num; i++) {
      let q;
      switch (type) {
        case 'identify':
          q = generateIdentifyQuestion(diff);
          break;
        case 'canBeat':
          q = generateCanBeatQuestion(diff);
          break;
        case 'findPlay':
          q = generateFindPlayQuestion(diff);
          break;
        default:
          // 'all' - 随机出题型
          const types = ['identify', 'canBeat', 'findPlay'];
          const randType = types[Math.floor(Math.random() * types.length)];
          switch (randType) {
            case 'identify': q = generateIdentifyQuestion(diff); break;
            case 'canBeat': q = generateCanBeatQuestion(diff); break;
            case 'findPlay': q = generateFindPlayQuestion(diff); break;
          }
      }
      questions.push({ ...q, id: `${Date.now()}-${i}` });
    }

    res.json({
      success: true,
      count: questions.length,
      difficulty: diff,
      questions
    });

  } catch (err) {
    console.error('Quiz generate error:', err);
    res.status(500).json({ error: 'Failed to generate quiz', message: err.message });
  }
});

// ============================================================
// 工具
// ============================================================
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = router;
