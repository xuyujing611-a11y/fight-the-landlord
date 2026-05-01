/**
 * src/server/utils/cardUtils.js
 *
 * 封装牌引擎的常用操作，给后端 API 使用。
 * 去重引用 CardEngine 的公共方法，统一异常处理。
 */

const path = require('path');
const Doudizhu = require(path.resolve(__dirname, '../../client/js/CardEngine.js'));

// ============================================================
// 字符串 ↔ Card 对象转换（方便 API 传参）
// ============================================================

const RANK_TO_STR = {
  0: '3', 1: '4', 2: '5', 3: '6', 4: '7', 5: '8', 6: '9',
  7: '10', 8: 'J', 9: 'Q', 10: 'K', 11: 'A', 12: '2',
  13: 'SJ', 14: 'BJ'
};

const STR_TO_RANK = {
  '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5, '9': 6,
  '10': 7, 'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12,
  'SJ': 13, 'BJ': 14
};

const SUITS = ['spade', 'heart', 'club', 'diamond'];

/**
 * 将 {suit, rank} 对象数组转为 Card 实例数组
 */
function toCards(arr) {
  if (!Array.isArray(arr)) throw new Error('cards must be an array');
  return arr.map((c, i) => {
    if (typeof c === 'number') {
      // 紧凑格式: 仅 rank，自动分配花色
      const suit = c >= 13 ? 'joker' : SUITS[i % 4];
      return new Doudizhu.Card(suit, c);
    }
    if (c.suit && c.rank !== undefined) {
      return new Doudizhu.Card(c.suit, c.rank);
    }
    throw new Error(`Invalid card at index ${i}: ${JSON.stringify(c)}`);
  });
}

/**
 * Card 实例 → 序列化对象 {suit, rank, display, isRed}
 */
function cardToObj(card) {
  return {
    suit: card.suit,
    rank: card.rank,
    display: card.displayName(),
    isRed: card.isRed()
  };
}

/**
 * 手牌数组 → 精简序列化数组
 */
function serializeCards(cards) {
  return cards.map(cardToObj);
}

/**
 * 有效 rank 范围 0-14
 */
function isValidRank(rank) {
  return Number.isInteger(rank) && rank >= 0 && rank <= 14;
}

/**
 * 快速构造测试用卡片数组（按 rank 数组）
 * 例: createCardsByRank([0,0,0,1,1,1]) → 333444
 *
 * @throws {Error} 如果 rank 不在 0-14 范围内
 */
function createCardsByRank(ranks) {
  return ranks.map((rank, i) => {
    if (!isValidRank(rank)) {
      throw new Error(`Invalid rank at index ${i}: ${rank}. Rank must be 0-14.`);
    }
    if (rank === 13) return new Doudizhu.Card('joker', 13);
    if (rank === 14) return new Doudizhu.Card('joker', 14);
    return new Doudizhu.Card(SUITS[i % 4], rank);
  });
}

// ============================================================
// 牌型识别
// ============================================================

/**
 * 识别牌型，返回可序列化的结果
 */
function identify(cards) {
  const cardInstances = typeof cards[0] === 'object' && cards[0] instanceof Doudizhu.Card
    ? cards : toCards(cards);
  const info = Doudizhu.identifyType(cardInstances);
  return {
    type: info.type,
    typeName: Doudizhu.HAND_TYPE_NAMES[info.type] || info.type,
    rank: info.rank,
    length: info.length,
    valid: info.type !== Doudizhu.HAND_TYPES.INVALID
  };
}

// ============================================================
// 出牌校验
// ============================================================

/**
 * 校验 current 是否能压住 last
 */
function checkCanBeat(current, last) {
  const curCards = typeof current[0] === 'object' && current[0] instanceof Doudizhu.Card
    ? current : toCards(current);
  const lastCards = typeof last[0] === 'object' && last[0] instanceof Doudizhu.Card
    ? last : toCards(last);
  return Doudizhu.canBeat(curCards, lastCards);
}

// ============================================================
// 合法出牌枚举
// ============================================================

/**
 * 枚举手牌中所有合法出牌
 * @param {Array} hand - 手牌数组
 * @param {Array|null} lastPlay - 上家出的牌（null = 自由出牌）
 * @returns {Array} 合法出牌列表（每项是 Card 数组）
 */
function findAllPlays(hand, lastPlay) {
  const handCards = typeof hand[0] === 'object' && hand[0] instanceof Doudizhu.Card
    ? hand : toCards(hand);
  const lastCards = lastPlay
    ? (typeof lastPlay[0] === 'object' && lastPlay[0] instanceof Doudizhu.Card
      ? lastPlay : toCards(lastPlay))
    : null;
  return Doudizhu.findValidPlays(handCards, lastCards);
}

// ============================================================
// 牌型生成器（用于出题系统）
// ============================================================================================

/**
 * 生成指定牌型的样例手牌
 * @param {string} type - HAND_TYPES 中的一个
 * @param {number} difficulty - 0=easy, 1=normal, 2=hard
 * @returns {Object} { question: 描述, hand: 手牌array, answer: 正确出牌的描述 }
 */
function generateExamplePlay(type, difficulty) {
  const examples = {
    SINGLE: [
      { hand: [0, 1, 2, 10, 11, 12, 13], answer: { cards: [10], type: 'SINGLE' }, desc: '出单张 K' },
      { hand: [0, 3, 5, 7, 9, 11, 14], answer: { cards: [14], type: 'SINGLE' }, desc: '出大王' },
    ],
    PAIR: [
      { hand: [0, 0, 1, 2, 10, 11, 11], answer: { cards: [11, 11], type: 'PAIR' }, desc: '出对 A' },
      { hand: [3, 3, 4, 4, 5, 7, 8], answer: { cards: [4, 4], type: 'PAIR' }, desc: '出对 7' },
    ],
    TRIPLE_PLUS_ONE: [
      { hand: [0, 0, 0, 1, 2, 3, 4], answer: { cards: [0, 0, 0, 1], type: 'TRIPLE_PLUS_ONE' }, desc: '三带一：333+4' },
      { hand: [8, 8, 8, 9, 10, 11, 12], answer: { cards: [8, 8, 8, 9], type: 'TRIPLE_PLUS_ONE' }, desc: '三带一：JJJ+Q' },
    ],
    STRAIGHT: [
      { hand: [0, 1, 2, 3, 4, 5, 6, 10, 12], answer: { cards: [0, 1, 2, 3, 4, 5, 6], type: 'STRAIGHT' }, desc: '顺子 3456789' },
      { hand: [5, 6, 7, 8, 9, 10, 11, 0, 0], answer: { cards: [5, 6, 7, 8, 9, 10, 11], type: 'STRAIGHT' }, desc: '顺子 8910JQKA' },
    ],
    BOMB: [
      { hand: [0, 0, 0, 0, 1, 2, 3, 4, 5], answer: { cards: [0, 0, 0, 0], type: 'BOMB' }, desc: '炸弹 3333' },
    ],
  };

  const pool = examples[type];
  if (!pool || pool.length === 0) return null;

  const idx = Math.min(difficulty || 0, pool.length - 1);
  const ex = pool[idx];

  // 构建手牌对象
  const handCards = createCardsByRank(ex.hand);
  const answerCards = createCardsByRank(ex.answer.cards);

  return {
    type: 'identify_play',
    difficulty: ['easy', 'normal', 'hard'][difficulty || 0],
    question: `以下手牌中，哪一组是合法的"${Doudizhu.HAND_TYPE_NAMES[type] || type}"？`,
    hand: serializeCards(handCards),
    answer: {
      cards: serializeCards(answerCards),
      type: ex.answer.type,
      desc: ex.desc
    },
    hint: `提示：${Doudizhu.HAND_TYPE_NAMES[type] || type} 需要 ${getTypeCardCount(type)} 张牌`
  };
}

function getTypeCardCount(type) {
  const map = {
    SINGLE: 1, PAIR: 2, TRIPLE: 3, TRIPLE_PLUS_ONE: 4, TRIPLE_PLUS_TWO: 5,
    STRAIGHT: '≥5', CONSECUTIVE_PAIRS: '≥6', AIRPLANE: '≥6',
    BOMB: 4, FOUR_PLUS_TWO: 6, FOUR_PLUS_TWO_PAIRS: 8
  };
  return map[type] || '?';
}

// ============================================================
// 导出
// ============================================================
module.exports = {
  Doudizhu,               // 原始牌引擎
  toCards,
  cardToObj,
  serializeCards,
  createCardsByRank,
  identify,
  checkCanBeat,
  findAllPlays,
  generateExamplePlay,
  Card: Doudizhu.Card,
  Deck: Doudizhu.Deck,
  HAND_TYPES: Doudizhu.HAND_TYPES,
  HAND_TYPE_NAMES: Doudizhu.HAND_TYPE_NAMES
};
