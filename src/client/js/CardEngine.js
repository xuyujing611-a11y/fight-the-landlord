/**
 * card-engine.js - 斗地主牌引擎
 * 纯 JavaScript，无依赖，浏览器 / Node.js 通用
 *
 * API:
 *   Card(suit, rank)          - 牌对象
 *   Deck()                    - 54张牌、洗牌、发牌
 *   identifyType(cards)       - 牌型识别
 *   canBeat(current, last)    - 出牌校验
 *   findValidPlays(hand, lastPlay) - 合法出牌枚举
 *   sortCards(cards)          - 排序
 *   renderHTML(cards [, opts]) - HTML渲染
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Doudizhu = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ================================================================
  // 常量
  // ================================================================

  var SUITS = ['spade', 'heart', 'club', 'diamond', 'joker'];

  var SUIT_SYMBOLS = {
    spade: '\u2660',
    heart: '\u2665',
    club: '\u2663',
    diamond: '\u2666',
    joker: '\uD83C\uDCCF'
  };

  var RANK_NAMES = [
    '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'
  ];

  var RANK_NAME_MAP = {
    0: '3', 1: '4', 2: '5', 3: '6', 4: '7', 5: '8', 6: '9', 7: '10',
    8: 'J', 9: 'Q', 10: 'K', 11: 'A', 12: '2',
    13: '\u5C0F\u738B', 14: '\u5927\u738B'
  };

  // 顺子 / 连对 / 飞机可用的最大rank（不包括2和小王大王）
  var STRAIGHT_MAX_RANK = 11; // A

  var HAND_TYPES = {
    SINGLE: 'SINGLE',
    PAIR: 'PAIR',
    TRIPLE: 'TRIPLE',
    TRIPLE_PLUS_ONE: 'TRIPLE_PLUS_ONE',
    TRIPLE_PLUS_TWO: 'TRIPLE_PLUS_TWO',
    STRAIGHT: 'STRAIGHT',
    CONSECUTIVE_PAIRS: 'CONSECUTIVE_PAIRS',
    AIRPLANE: 'AIRPLANE',
    AIRPLANE_PLUS_SINGLES: 'AIRPLANE_PLUS_SINGLES',
    AIRPLANE_PLUS_PAIRS: 'AIRPLANE_PLUS_PAIRS',
    BOMB: 'BOMB',
    ROCKET: 'ROCKET',
    FOUR_PLUS_TWO: 'FOUR_PLUS_TWO',
    FOUR_PLUS_TWO_PAIRS: 'FOUR_PLUS_TWO_PAIRS',
    INVALID: 'INVALID'
  };

  var HAND_TYPE_NAMES = {};
  HAND_TYPE_NAMES[HAND_TYPES.SINGLE] = '\u5355\u5F20';
  HAND_TYPE_NAMES[HAND_TYPES.PAIR] = '\u5BF9\u5B50';
  HAND_TYPE_NAMES[HAND_TYPES.TRIPLE] = '\u4E09\u5F20';
  HAND_TYPE_NAMES[HAND_TYPES.TRIPLE_PLUS_ONE] = '\u4E09\u5E26\u4E00';
  HAND_TYPE_NAMES[HAND_TYPES.TRIPLE_PLUS_TWO] = '\u4E09\u5E26\u4E8C';
  HAND_TYPE_NAMES[HAND_TYPES.STRAIGHT] = '\u987A\u5B50';
  HAND_TYPE_NAMES[HAND_TYPES.CONSECUTIVE_PAIRS] = '\u8FDE\u5BF9';
  HAND_TYPE_NAMES[HAND_TYPES.AIRPLANE] = '\u98DE\u673A';
  HAND_TYPE_NAMES[HAND_TYPES.AIRPLANE_PLUS_SINGLES] = '\u98DE\u673A\u5E26\u5355';
  HAND_TYPE_NAMES[HAND_TYPES.AIRPLANE_PLUS_PAIRS] = '\u98DE\u673A\u5E26\u5BF9';
  HAND_TYPE_NAMES[HAND_TYPES.BOMB] = '\u70B8\u5F39';
  HAND_TYPE_NAMES[HAND_TYPES.ROCKET] = '\u706B\u7BAD';
  HAND_TYPE_NAMES[HAND_TYPES.FOUR_PLUS_TWO] = '\u56DB\u5E26\u4E8C';
  HAND_TYPE_NAMES[HAND_TYPES.FOUR_PLUS_TWO_PAIRS] = '\u56DB\u5E26\u4E24\u5BF9';

  // ================================================================
  // Card 类
  // ================================================================

  function Card(suit, rank) {
    if (typeof rank !== 'number' || rank < 0 || rank > 14) {
      throw new Error('Invalid card rank: ' + rank);
    }
    if (suit !== 'spade' && suit !== 'heart' && suit !== 'club' && suit !== 'diamond' && suit !== 'joker') {
      throw new Error('Invalid card suit: ' + suit);
    }
    if (rank < 13 && suit === 'joker') {
      throw new Error('Non-joker rank cannot have joker suit');
    }
    if (rank >= 13 && suit !== 'joker') {
      throw new Error('Joker rank must have joker suit');
    }
    this.suit = suit;
    this.rank = rank;
  }

  Card.prototype.displayName = function () {
    return RANK_NAME_MAP[this.rank] || '?';
  };

  Card.prototype.shortName = function () {
    if (this.rank === 13) return 'SJ';
    if (this.rank === 14) return 'BJ';
    return RANK_NAMES[this.rank];
  };

  Card.prototype.suitSymbol = function () {
    return SUIT_SYMBOLS[this.suit];
  };

  Card.prototype.isJoker = function () {
    return this.rank >= 13;
  };

  Card.prototype.isRed = function () {
    return this.suit === 'heart' || this.suit === 'diamond' || this.rank === 14;
  };

  Card.prototype.toString = function () {
    if (this.rank === 13) return '\uD83C\uDCCF SJ';
    if (this.rank === 14) return '\uD83C\uDCCF BJ';
    return this.suitSymbol() + this.shortName();
  };

  Card.prototype.clone = function () {
    return new Card(this.suit, this.rank);
  };

  // 从字符串创建（方便测试）
  // 格式: "♠3" "♥K" "🃏SJ" "🃏BJ"
  Card.fromString = function (str) {
        // 正确处理代理对（如 ），确保 charAt 正确拆分 Unicode 字符
    var codePoints = [];
    for (var ci = 0; ci < str.length; ci++) {
      var code = str.charCodeAt(ci);
      if (code >= 0xD800 && code <= 0xDBFF && ci + 1 < str.length) {
        codePoints.push(str.slice(ci, ci + 2));
        ci++;
      } else {
        codePoints.push(str.charAt(ci));
      }
    }
    var suitChar = codePoints[0];
    var suitMap = { '\u2660': 'spade', '\u2665': 'heart', '\u2663': 'club', '\u2666': 'diamond', '\uD83C\uDCCF': 'joker' };
    var suit = suitMap[suitChar];
    if (!suit) throw new Error('Unknown suit: ' + suitChar);

    if (suit === 'joker') {
      var jokerType = codePoints.slice(1).join('').trim();
      if (jokerType === 'SJ' || jokerType === '\u5C0F\u738B') return new Card('joker', 13);
      if (jokerType === 'BJ' || jokerType === '\u5927\u738B') return new Card('joker', 14);
      throw new Error('Invalid joker: ' + str);
    }

    var rankStr = codePoints.slice(1).join('').trim();
    var rankMap = {
      '3': 0, '4': 1, '5': 2, '6': 3, '7': 4, '8': 5, '9': 6, '10': 7,
      'J': 8, 'Q': 9, 'K': 10, 'A': 11, '2': 12
    };
    var rank = rankMap[rankStr];
    if (rank === undefined) throw new Error('Unknown rank: ' + rankStr);
    return new Card(suit, rank);
  };

  // ================================================================
  // Deck 类
  // ================================================================

  function Deck() {
    this.cards = [];
    this.reset();
  }

  Deck.prototype.reset = function () {
    this.cards = [];
    var suitOrder = ['spade', 'heart', 'club', 'diamond'];
    for (var r = 0; r < RANK_NAMES.length; r++) {
      for (var s = 0; s < suitOrder.length; s++) {
        this.cards.push(new Card(suitOrder[s], r));
      }
    }
    // 2张王
    this.cards.push(new Card('joker', 13));
    this.cards.push(new Card('joker', 14));
    return this;
  };

  // Fisher-Yates shuffle
  Deck.prototype.shuffle = function () {
    for (var i = this.cards.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = this.cards[i];
      this.cards[i] = this.cards[j];
      this.cards[j] = tmp;
    }
    return this;
  };

  // deal(nPlayers, cardsPerPlayer)
  // 标准斗地主：3人，每人17张，3张底牌
  Deck.prototype.deal = function (nPlayers, cardsPerPlayer) {
    nPlayers = nPlayers || 3;
    cardsPerPlayer = cardsPerPlayer || 17;
    if (this.cards.length !== 54) this.reset();

    var hands = [];
    for (var i = 0; i < nPlayers; i++) {
      hands.push([]);
    }

    var dealt = 0;
    for (var p = 0; p < nPlayers; p++) {
      for (var c = 0; c < cardsPerPlayer; c++) {
        hands[p].push(this.cards[dealt++]);
      }
    }

    // 底牌
    var remaining = this.cards.slice(dealt);

    return {
      hands: hands,
      remaining: remaining
    };
  };

  // ================================================================
  // 工具函数
  // ================================================================

  // 按rank分组
  function groupByRank(cards) {
    var groups = {};
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].rank;
      if (!groups[r]) groups[r] = [];
      groups[r].push(cards[i]);
    }
    return groups;
  }

  // 生成组合 C(n,k)
  function* combinations(arr, k) {
    if (k === 0) { yield []; return; }
    if (arr.length < k) return;
    for (var i = 0; i <= arr.length - k; i++) {
      var first = arr[i];
      for (var rest of combinations(arr.slice(i + 1), k - 1)) {
        yield [first].concat(rest);
      }
    }
  }

  // 获取同一rank的所有single kick候选
  function getAllSinglesPool(groups, excludeRanks) {
    var pool = [];
    var excludeSet = {};
    if (excludeRanks) {
      for (var i = 0; i < excludeRanks.length; i++) excludeSet[excludeRanks[i]] = true;
    }
    var sortedRanks = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    for (var j = 0; j < sortedRanks.length; j++) {
      var r = sortedRanks[j];
      if (excludeSet[r]) continue;
      for (var k = 0; k < groups[r].length; k++) {
        pool.push(groups[r][k]);
      }
    }
    return pool;
  }

  // 获取同一rank的所有pair候选
  function getAllPairsPool(groups, excludeRanks) {
    var pool = [];
    var excludeSet = {};
    if (excludeRanks) {
      for (var i = 0; i < excludeRanks.length; i++) excludeSet[excludeRanks[i]] = true;
    }
    var sortedRanks = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    for (var j = 0; j < sortedRanks.length; j++) {
      var r = sortedRanks[j];
      if (excludeSet[r]) continue;
      if (groups[r].length >= 2) {
        pool.push(groups[r].slice(0, 2));
      }
    }
    return pool;
  }

  // 去重key（基于ranks序列，不关心花色）
  function playKey(cards) {
    return cards.map(function (c) { return c.rank; }).sort(function (a, b) { return a - b; }).join(',');
  }

  function deduplicate(plays) {
    var seen = {};
    var result = [];
    for (var i = 0; i < plays.length; i++) {
      var key = playKey(plays[i]);
      if (!seen[key]) {
        seen[key] = true;
        result.push(plays[i]);
      }
    }
    return result;
  }

  function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  // ================================================================
  // identifyType - 牌型识别
  // ================================================================

  function identifyType(cards) {
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return { type: HAND_TYPES.INVALID, rank: -1, length: 0 };
    }

    var n = cards.length;
    var sorted = cards.slice().sort(function (a, b) { return a.rank - b.rank; });
    var groups = groupByRank(sorted);
    var ranks = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    var counts = ranks.map(function (r) { return groups[r].length; });

    // ---- 火箭 ----
    if (n === 2 && ranks.length === 2 && ranks[0] === 13 && ranks[1] === 14) {
      return { type: HAND_TYPES.ROCKET, rank: 14, length: 2 };
    }

    // ---- 炸弹 ----
    if (n === 4 && ranks.length === 1 && counts[0] === 4) {
      return { type: HAND_TYPES.BOMB, rank: ranks[0], length: 4 };
    }

    // ---- 单张 ----
    if (n === 1) {
      return { type: HAND_TYPES.SINGLE, rank: sorted[0].rank, length: 1 };
    }

    // ---- 对子 ----
    if (n === 2 && ranks.length === 1 && counts[0] === 2) {
      return { type: HAND_TYPES.PAIR, rank: ranks[0], length: 2 };
    }

    // ---- 三张 ----
    if (n === 3 && ranks.length === 1 && counts[0] === 3) {
      return { type: HAND_TYPES.TRIPLE, rank: ranks[0], length: 3 };
    }

    // ---- 三带一 ----
    if (n === 4 && ranks.length === 2) {
      var tripleRank = -1, singleRank = -1;
      for (var i = 0; i < ranks.length; i++) {
        if (counts[i] === 3) tripleRank = ranks[i];
        else if (counts[i] === 1) singleRank = ranks[i];
      }
      if (tripleRank >= 0 && singleRank >= 0) {
        return { type: HAND_TYPES.TRIPLE_PLUS_ONE, rank: tripleRank, length: 4, kickRank: singleRank };
      }
    }

    // ---- 三带二 ----
    if (n === 5 && ranks.length === 2) {
      var tripleRank2 = -1, pairRank = -1;
      for (var i2 = 0; i2 < ranks.length; i2++) {
        if (counts[i2] === 3) tripleRank2 = ranks[i2];
        else if (counts[i2] === 2) pairRank = ranks[i2];
      }
      if (tripleRank2 >= 0 && pairRank >= 0) {
        return { type: HAND_TYPES.TRIPLE_PLUS_TWO, rank: tripleRank2, length: 5, kickRank: pairRank };
      }
    }

    // ---- 顺子 (5+张连续，3~A，无2/王) ----
    if (n >= 5 && isConsecutiveSequence(ranks, STRAIGHT_MAX_RANK) && allCountsOne(counts)) {
      // 检查所有rank <= A
      if (ranks[ranks.length - 1] <= STRAIGHT_MAX_RANK) {
        return { type: HAND_TYPES.STRAIGHT, rank: ranks[ranks.length - 1], length: n };
      }
    }

    // ---- 连对 (3+对连续，3~A: 每张恰好2张，n === ranks.length * 2) ----
    if (n >= 6 && n % 2 === 0 && n === ranks.length * 2) {
      var pairCount = n / 2;
      if (pairCount >= 3 && isConsecutiveSequence(ranks, STRAIGHT_MAX_RANK) && allCountsAtLeast(counts, 2)) {
        if (ranks[ranks.length - 1] <= STRAIGHT_MAX_RANK) {
          return { type: HAND_TYPES.CONSECUTIVE_PAIRS, rank: ranks[ranks.length - 1], length: pairCount };
        }
      }
    }

    // ---- 飞机 (2+个三张连续, 3~A) ----
    if (n >= 6) {
      var tripleRanks = [];
      var leftoverCounts = [];
      for (var it = 0; it < ranks.length; it++) {
        if (counts[it] >= 3) {
          tripleRanks.push(ranks[it]);
        }
      }
      // 找连续的三张
      if (tripleRanks.length >= 2) {
        var tripleRun = findConsecutiveRuns(tripleRanks);
        for (var tr = 0; tr < tripleRun.length; tr++) {
          var run = tripleRun[tr];
          var runLen = run.length;
          var tripleCards = runLen * 3;

          // 纯飞机
          if (tripleCards === n) {
            if (run[runLen - 1] <= STRAIGHT_MAX_RANK) {
              return { type: HAND_TYPES.AIRPLANE, rank: run[runLen - 1], length: runLen };
            }
          }

          // 飞机带单: n = tripleCards + runLen
          if (n === tripleCards + runLen) {
            if (run[runLen - 1] <= STRAIGHT_MAX_RANK) {
              return { type: HAND_TYPES.AIRPLANE_PLUS_SINGLES, rank: run[runLen - 1], length: runLen };
            }
          }

          // 飞机带对: n = tripleCards + runLen * 2
          if (n === tripleCards + runLen * 2) {
            if (run[runLen - 1] <= STRAIGHT_MAX_RANK) {
              return { type: HAND_TYPES.AIRPLANE_PLUS_PAIRS, rank: run[runLen - 1], length: runLen };
            }
          }
        }
      }
    }

    // ---- 四带二 ----
    if (n === 6) {
      for (var i4 = 0; i4 < ranks.length; i4++) {
        if (counts[i4] === 4) {
          // 剩余2张是单张
          var others = [];
          for (var io = 0; io < ranks.length; io++) {
            if (io !== i4) {
              for (var c = 0; c < counts[io]; c++) others.push(ranks[io]);
            }
          }
          if (others.length === 2) {
            return { type: HAND_TYPES.FOUR_PLUS_TWO, rank: ranks[i4], length: 6 };
          }
        }
      }
    }

    // ---- 四带两对 ----
    if (n === 8) {
      for (var i8 = 0; i8 < ranks.length; i8++) {
        if (counts[i8] === 4) {
          var pairCount2 = 0;
          var valid2 = true;
          for (var io2 = 0; io2 < ranks.length; io2++) {
            if (io2 !== i8) {
              if (counts[io2] === 2) pairCount2++;
              else { valid2 = false; break; }
            }
          }
          if (valid2 && pairCount2 === 2) {
            return { type: HAND_TYPES.FOUR_PLUS_TWO_PAIRS, rank: ranks[i8], length: 8 };
          }
        }
      }
    }

    return { type: HAND_TYPES.INVALID, rank: -1, length: 0 };
  }

  function isConsecutiveSequence(ranks, maxRank) {
    if (ranks.length < 2) return false;
    for (var i = 1; i < ranks.length; i++) {
      if (ranks[i] !== ranks[i - 1] + 1) return false;
    }
    return ranks[ranks.length - 1] <= maxRank;
  }

  function allCountsOne(counts) {
    for (var i = 0; i < counts.length; i++) {
      if (counts[i] !== 1) return false;
    }
    return true;
  }

  function allCountsAtLeast(counts, min) {
    for (var i = 0; i < counts.length; i++) {
      if (counts[i] < min) return false;
    }
    return true;
  }

  function findConsecutiveRuns(ranks) {
    if (ranks.length === 0) return [];
    var runs = [];
    var currentRun = [ranks[0]];
    for (var i = 1; i < ranks.length; i++) {
      if (ranks[i] === ranks[i - 1] + 1) {
        currentRun.push(ranks[i]);
      } else {
        if (currentRun.length >= 2) runs.push(currentRun);
        currentRun = [ranks[i]];
      }
    }
    if (currentRun.length >= 2) runs.push(currentRun);
    return runs;
  }

  // ================================================================
  // canBeat - 出牌校验
  // ================================================================

  function canBeat(current, last) {
    if (!current || !last || current.length === 0 || last.length === 0) return false;

    var curInfo = identifyType(current);
    var lastInfo = identifyType(last);

    if (curInfo.type === HAND_TYPES.INVALID) return false;
    if (lastInfo.type === HAND_TYPES.INVALID) return false;

    // 火箭 > 一切
    if (curInfo.type === HAND_TYPES.ROCKET) return true;
    if (lastInfo.type === HAND_TYPES.ROCKET) return false;

    // 炸弹 > 非炸弹（且非火箭）
    if (curInfo.type === HAND_TYPES.BOMB && lastInfo.type !== HAND_TYPES.BOMB) return true;
    if (lastInfo.type === HAND_TYPES.BOMB && curInfo.type !== HAND_TYPES.BOMB) return false;

    // 同类比较
    if (curInfo.type === lastInfo.type) {
      // 对于有长度的牌型（顺子、连对、飞机等），长度必须相同
      if (curInfo.type === HAND_TYPES.STRAIGHT ||
          curInfo.type === HAND_TYPES.CONSECUTIVE_PAIRS ||
          curInfo.type === HAND_TYPES.AIRPLANE ||
          curInfo.type === HAND_TYPES.AIRPLANE_PLUS_SINGLES ||
          curInfo.type === HAND_TYPES.AIRPLANE_PLUS_PAIRS) {
        if (curInfo.length !== lastInfo.length) return false;
      }
      // 炸弹比rank
      if (curInfo.type === HAND_TYPES.BOMB) {
        return curInfo.rank > lastInfo.rank;
      }
      // 同型比较主rank
      return curInfo.rank > lastInfo.rank;
    }

    return false;
  }

  // ================================================================
  // 出牌枚举器（findValidPlays 的辅助函数）
  // ================================================================

  // ---------- 所有单张 ----------
  function findAllSingles(groups) {
    var result = [];
    var sortedRanks = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < sortedRanks.length; i++) {
      var r = sortedRanks[i];
      for (var j = 0; j < groups[r].length; j++) {
        result.push([groups[r][j]]);
      }
    }
    return result;
  }

  // ---------- 所有对子 ----------
  function findAllPairs(groups) {
    var result = [];
    var sortedRanks = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < sortedRanks.length; i++) {
      var r = sortedRanks[i];
      if (groups[r].length >= 2) {
        result.push([groups[r][0], groups[r][1]]);
      }
    }
    return result;
  }

  // ---------- 所有三张 ----------
  function findAllTriples(groups) {
    var result = [];
    var sortedRanks = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < sortedRanks.length; i++) {
      var r = sortedRanks[i];
      if (groups[r].length >= 3) {
        result.push(groups[r].slice(0, 3));
      }
    }
    return result;
  }

  // ---------- 所有炸弹 ----------
  function findAllBombs(groups) {
    var result = [];
    var sortedRanks = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < sortedRanks.length; i++) {
      var r = sortedRanks[i];
      if (groups[r].length === 4) {
        result.push(groups[r].slice(0, 4));
      }
    }
    return result;
  }

  // ---------- 火箭 ----------
  function findRocket(groups) {
    if (groups[13] && groups[14]) {
      return [[groups[13][0], groups[14][0]]];
    }
    return [];
  }

  // ---------- 三带一 ----------
  function findAllTriplePlusOne(groups) {
    var result = [];
    var sortedRanks = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < sortedRanks.length; i++) {
      var tripleRank = sortedRanks[i];
      if (groups[tripleRank].length >= 3) {
        var tripleCards = groups[tripleRank].slice(0, 3);
        var kickPool = getAllSinglesPool(groups, [tripleRank]);
        for (var k = 0; k < kickPool.length; k++) {
          result.push(tripleCards.concat([kickPool[k]]));
        }
      }
    }
    return result;
  }

  // ---------- 三带二 ----------
  function findAllTriplePlusTwo(groups) {
    var result = [];
    var sortedRanks = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < sortedRanks.length; i++) {
      var tripleRank = sortedRanks[i];
      if (groups[tripleRank].length >= 3) {
        var tripleCards = groups[tripleRank].slice(0, 3);
        var pairPool = getAllPairsPool(groups, [tripleRank]);
        for (var k = 0; k < pairPool.length; k++) {
          result.push(tripleCards.concat(pairPool[k]));
        }
      }
    }
    return result;
  }

  // ---------- 顺子 ----------
  function findAllStraights(groups) {
    var result = [];
    // 只考虑3~A (rank 0~11)
    var available = [];
    for (var r = 0; r <= STRAIGHT_MAX_RANK; r++) {
      available.push(groups[r] && groups[r].length >= 1);
    }

    var start = 0;
    while (start <= STRAIGHT_MAX_RANK - 4) {
      if (!available[start]) { start++; continue; }
      var end = start;
      while (end <= STRAIGHT_MAX_RANK && available[end]) end++;
      var runLen = end - start;
      if (runLen >= 5) {
        // 这个run里所有长度>=5的顺子
        var maxLen = Math.min(runLen, 8); // B4: 顺子最长8张，避免组合爆炸
        for (var len = 5; len <= maxLen; len++) {
          for (var s = start; s + len <= end; s++) {
            var cards = [];
            for (var rr = s; rr < s + len; rr++) {
              cards.push(groups[rr][0]); // 取第一个
            }
            result.push(cards);
          }
        }
      }
      start = end;
    }

    return result;
  }

  // ---------- 连对 ----------
  function findAllConsecutivePairs(groups) {
    var result = [];
    var available = [];
    for (var r = 0; r <= STRAIGHT_MAX_RANK; r++) {
      available.push(groups[r] && groups[r].length >= 2);
    }

    var start = 0;
    while (start <= STRAIGHT_MAX_RANK - 2) {
      if (!available[start]) { start++; continue; }
      var end = start;
      while (end <= STRAIGHT_MAX_RANK && available[end]) end++;
      var runLen = end - start;
      if (runLen >= 3) {
        var maxLen = Math.min(runLen, 6); // B4: 连对最长6对，避免组合爆炸
        for (var len = 3; len <= maxLen; len++) {
          for (var s = start; s + len <= end; s++) {
            var cards = [];
            for (var rr = s; rr < s + len; rr++) {
              cards.push(groups[rr][0], groups[rr][1]);
            }
            result.push(cards);
          }
        }
      }
      start = end;
    }

    return result;
  }

  // ---------- 飞机 (含带牌) ----------
  function findAllAirplanes(groups) {
    var result = [];

    // 找rank 0~11范围内至少有3张的rank
    var tripleAvailable = [];
    for (var r = 0; r <= STRAIGHT_MAX_RANK; r++) {
      tripleAvailable.push(groups[r] && groups[r].length >= 3);
    }

    var start = 0;
    while (start <= STRAIGHT_MAX_RANK - 1) {
      if (!tripleAvailable[start]) { start++; continue; }
      var end = start;
      while (end <= STRAIGHT_MAX_RANK && tripleAvailable[end]) end++;
      var runLen = end - start;
      if (runLen >= 2) {
        var maxLen = Math.min(runLen, 4); // B4: 飞机最长4连，避免组合爆炸
        // 所有长度的连续三张
        for (var len = 2; len <= maxLen; len++) {
          for (var s = start; s + len <= end; s++) {
            var airRanks = [];
            var airCards = [];
            for (var rr = s; rr < s + len; rr++) {
              airRanks.push(rr);
              airCards.push(groups[rr][0], groups[rr][1], groups[rr][2]);
            }

            // 纯飞机
            result.push({ type: HAND_TYPES.AIRPLANE, cards: airCards.slice() });

            // 计算剩余牌（模拟移除飞机主体）
            var remainingGroups = {};
            for (var rg in groups) {
              if (groups.hasOwnProperty(rg)) {
                var rgNum = Number(rg);
                if (airRanks.indexOf(rgNum) >= 0) {
                  if (groups[rg].length > 3) {
                    remainingGroups[rg] = groups[rg].slice(3);
                  }
                } else {
                  remainingGroups[rg] = groups[rg].slice();
                }
              }
            }

            // 飞机带单: 需要 len 张单张
            var singlePool = getAllSinglesPool(remainingGroups);
            if (singlePool.length >= len) {
              for (var kickCombo of combinations(singlePool, len)) {
                result.push({ type: HAND_TYPES.AIRPLANE_PLUS_SINGLES, cards: airCards.concat(kickCombo) });
              }
            }

            // 飞机带对: 需要 len 对
            var pairPool = getAllPairsPool(remainingGroups);
            if (pairPool.length >= len) {
              for (var pairCombo of combinations(pairPool, len)) {
                var pairCards = [];
                for (var pc = 0; pc < pairCombo.length; pc++) {
                  pairCards.push(pairCombo[pc][0], pairCombo[pc][1]);
                }
                result.push({ type: HAND_TYPES.AIRPLANE_PLUS_PAIRS, cards: airCards.concat(pairCards) });
              }
            }
          }
        }
      }
      start = end;
    }

    return result;
  }

  // ---------- 四带二 ----------
  function findAllFourPlusTwo(groups) {
    var result = [];
    var sortedRanks = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    for (var i = 0; i < sortedRanks.length; i++) {
      var bombRank = sortedRanks[i];
      if (groups[bombRank].length === 4) {
        var bombCards = groups[bombRank].slice(0, 4);

        // 四带二单
        var remaining = {};
        for (var rg in groups) {
          if (groups.hasOwnProperty(rg)) {
            var r = Number(rg);
            if (r !== bombRank) {
              remaining[r] = groups[r].slice();
            }
          }
        }
        var singlePool = getAllSinglesPool(remaining);
        if (singlePool.length >= 2) {
          for (var kickCombo of combinations(singlePool, 2)) {
            result.push({ type: HAND_TYPES.FOUR_PLUS_TWO, cards: bombCards.concat(kickCombo) });
          }
        }

        // 四带两对
        var pairPool = getAllPairsPool(remaining);
        if (pairPool.length >= 2) {
          for (var pairCombo of combinations(pairPool, 2)) {
            var pairCards = [];
            for (var pc = 0; pc < pairCombo.length; pc++) {
              pairCards.push(pairCombo[pc][0], pairCombo[pc][1]);
            }
            result.push({ type: HAND_TYPES.FOUR_PLUS_TWO_PAIRS, cards: bombCards.concat(pairCards) });
          }
        }
      }
    }
    return result;
  }

  // ================================================================
  // findValidPlays - 合法出牌枚举（含去重）
  // ================================================================

  function findValidPlays(hand, lastPlay) {
    if (!hand || hand.length === 0) return [];

    var groups = groupByRank(hand);

    // 收集所有可能的牌型
    var allPlays = [];

    // 基础类型
    var singles = findAllSingles(groups);
    for (var i = 0; i < singles.length; i++) allPlays.push(singles[i]);

    var pairs = findAllPairs(groups);
    for (var j = 0; j < pairs.length; j++) allPlays.push(pairs[j]);

    var triples = findAllTriples(groups);
    for (var k = 0; k < triples.length; k++) allPlays.push(triples[k]);

    // 复合类型
    var tp1 = findAllTriplePlusOne(groups);
    for (var m = 0; m < tp1.length; m++) allPlays.push(tp1[m]);

    var tp2 = findAllTriplePlusTwo(groups);
    for (var n = 0; n < tp2.length; n++) allPlays.push(tp2[n]);

    var straights = findAllStraights(groups);
    for (var p = 0; p < straights.length; p++) allPlays.push(straights[p]);

    var consecutivePairs = findAllConsecutivePairs(groups);
    for (var q = 0; q < consecutivePairs.length; q++) allPlays.push(consecutivePairs[q]);

    var airplanes = findAllAirplanes(groups);
    for (var r = 0; r < airplanes.length; r++) allPlays.push(airplanes[r].cards);

    var bombs = findAllBombs(groups);
    for (var s = 0; s < bombs.length; s++) allPlays.push(bombs[s]);

    var rocket = findRocket(groups);
    for (var t = 0; t < rocket.length; t++) allPlays.push(rocket[t]);

    var fourPlusTwo = findAllFourPlusTwo(groups);
    for (var u = 0; u < fourPlusTwo.length; u++) allPlays.push(fourPlusTwo[u].cards);

    // 去重
    allPlays = deduplicate(allPlays);

    // 按类型 & 强度排序（方便AI使用）
    allPlays.sort(function (a, b) {
      var ai = identifyType(a);
      var bi = identifyType(b);
      var orderA = typeSortOrder(ai.type);
      var orderB = typeSortOrder(bi.type);
      if (orderA !== orderB) return orderA - orderB;
      if (ai.rank !== bi.rank) return ai.rank - bi.rank;
      if (ai.length !== bi.length) return ai.length - bi.length;
      return a.length - b.length;
    });

    // 如果没有lastPlay，返回全部
    if (!lastPlay || lastPlay.length === 0) {
      return allPlays;
    }

    // 过滤出能压上的
    var lastInfo = identifyType(lastPlay);
    if (!lastInfo || lastInfo.type === HAND_TYPES.INVALID) return [];
    if (lastInfo.type === HAND_TYPES.ROCKET) return [];

    var result = [];
    for (var v = 0; v < allPlays.length; v++) {
      if (canBeat(allPlays[v], lastPlay)) {
        result.push(allPlays[v]);
      }
    }
    return result;
  }

  function typeSortOrder(type) {
    var order = {
      SINGLE: 0,
      PAIR: 1,
      TRIPLE: 2,
      TRIPLE_PLUS_ONE: 3,
      TRIPLE_PLUS_TWO: 4,
      STRAIGHT: 5,
      CONSECUTIVE_PAIRS: 6,
      AIRPLANE: 7,
      AIRPLANE_PLUS_SINGLES: 8,
      AIRPLANE_PLUS_PAIRS: 9,
      FOUR_PLUS_TWO: 10,
      FOUR_PLUS_TWO_PAIRS: 11,
      BOMB: 12,
      ROCKET: 13
    };
    return order[type] !== undefined ? order[type] : 99;
  }

  // ================================================================
  // sortCards - 排序器
  // ================================================================

  // 按 rank 升序（3最小，大王最大），同rank按 suit
  function sortCards(cards) {
    return cards.slice().sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      // suit: spade > heart > club > diamond > joker
      var suitOrder = { spade: 0, heart: 1, club: 2, diamond: 3, joker: 4 };
      return (suitOrder[a.suit] || 99) - (suitOrder[b.suit] || 99);
    });
  }

  // 降序排列（大王最大，3最小）
  function sortCardsDesc(cards) {
    return cards.slice().sort(function (a, b) {
      if (a.rank !== b.rank) return b.rank - a.rank;
      var suitOrder = { spade: 0, heart: 1, club: 2, diamond: 3, joker: 4 };
      return (suitOrder[a.suit] || 99) - (suitOrder[b.suit] || 99);
    });
  }

  // ================================================================
  // renderHTML - HTML渲染模板
  // ================================================================

  function renderHTML(cards, opts) {
    opts = opts || {};
    var title = opts.title || '\u624B\u724C';
    var showType = opts.showType !== false;
    var compact = opts.compact || false;

    var sorted = sortCards(cards);
    var info = showType ? identifyType(sorted) : null;

    var html = '<div class="ddz-hand">';
    if (title) {
      html += '<div class="ddz-hand-title">' + escapeHtml(title);
      if (info && info.type !== HAND_TYPES.INVALID) {
        html += ' <span class="ddz-hand-type">[' + (HAND_TYPE_NAMES[info.type] || info.type) + ']</span>';
      }
      html += '</div>';
    }
    html += '<div class="ddz-cards">';
    for (var i = 0; i < sorted.length; i++) {
      html += renderCardHTML(sorted[i], compact);
    }
    html += '</div></div>';
    return html;
  }

  function renderCardHTML(card, compact) {
    var colorClass = card.isRed() ? 'ddz-card-red' : 'ddz-card-black';
    var display = card.displayName();
    var symbol = card.suitSymbol();

    if (compact) {
      return '<span class="ddz-card ' + colorClass + '">' +
        symbol + display + '</span>';
    }

    return '<div class="ddz-card ' + colorClass + '">' +
      '<div class="ddz-card-corner-top">' + display + '</div>' +
      '<div class="ddz-card-center">' + symbol + '</div>' +
      '<div class="ddz-card-corner-bottom">' + display + '</div>' +
      '</div>';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 渲染完整HTML页面（含CSS）
  function renderFullPage(cardsArray, opts) {
    opts = opts || {};
    var title = opts.title || '\u6597\u5730\u4E3B - \u724C\u5F62\u5C55\u793A';

    var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>' + escapeHtml(title) + '</title>' +
      '<style>' + getCSS() + '</style></head><body>' +
      '<div class="ddz-container">';

    if (Array.isArray(cardsArray) && !Array.isArray(cardsArray[0])) {
      html += renderHTML(cardsArray, opts);
    } else if (Array.isArray(cardsArray)) {
      for (var i = 0; i < cardsArray.length; i++) {
        html += renderHTML(cardsArray[i], { title: '\u73A9\u5BB6' + (i + 1) });
      }
    }

    html += '</div></body></html>';
    return html;
  }

  function getCSS() {
    return [
      'body{background:#1a1a2e;font-family:"Microsoft YaHei","PingFang SC",sans-serif;margin:0;padding:20px}',
      '.ddz-container{max-width:900px;margin:0 auto}',
      '.ddz-hand{background:linear-gradient(135deg,#16213e,#0f3460);border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 4px 20px rgba(0,0,0,0.3)}',
      '.ddz-hand-title{color:#e0e0e0;font-size:16px;margin-bottom:10px;font-weight:bold}',
      '.ddz-hand-type{color:#f0c040;font-size:14px;font-weight:normal}',
      '.ddz-cards{display:flex;flex-wrap:wrap;gap:6px}',
      '.ddz-card-red{color:#e74c3c}',
      '.ddz-card-black{color:#ecf0f1}',
      '.ddz-card{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;min-width:36px;height:52px;padding:4px;background:linear-gradient(135deg,#2c3e50,#34495e);border:1px solid #4a6278;border-radius:6px;font-size:16px;font-weight:bold;cursor:default;transition:transform 0.2s,box-shadow 0.2s}',
      '.ddz-card:hover{transform:translateY(-4px);box-shadow:0 4px 12px rgba(240,192,64,0.3);border-color:#f0c040}',
      '.ddz-card-center{font-size:20px;line-height:1}',
      '.ddz-card-corner-top,.ddz-card-corner-bottom{font-size:11px;line-height:1}',
      '.ddz-card-corner-bottom{transform:rotate(180deg);margin-top:2px}',
    ].join('');
  }

  // ================================================================
  // 导出
  // ================================================================

  return {
    Card: Card,
    Deck: Deck,
    HAND_TYPES: HAND_TYPES,
    HAND_TYPE_NAMES: HAND_TYPE_NAMES,
    identifyType: identifyType,
    canBeat: canBeat,
    findValidPlays: findValidPlays,
    sortCards: sortCards,
    sortCardsDesc: sortCardsDesc,
    renderHTML: renderHTML,
    renderFullPage: renderFullPage,
    groupByRank: groupByRank,
    combinations: combinations,
    // 常量
    SUITS: SUITS,
    RANK_NAMES: RANK_NAMES,
    RANK_NAME_MAP: RANK_NAME_MAP
  };
}));
