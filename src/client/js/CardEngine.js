/**
 * 斗地主卡牌引擎
 * CardEngine.js - 纯JS，无依赖
 * 
 * 牌值大小顺序: 3 4 5 6 7 8 9 10 J Q K A 2 小王 大王
 * 花色: ♠(黑桃) ♥(红桃) ♣(梅花) ♦(方块)
 */

const SUITS = ['♠', '♥', '♣', '♦'];
const SUIT_NAMES = { '♠': 'spade', '♥': 'heart', '♣': 'club', '♦': 'diamond' };
const RANK_MAP = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14, '2': 15, '小王': 16, '大王': 17
};
const RANK_NAMES = ['','','','3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];

/** 牌对象 */
class Card {
  constructor(suit, rank) {
    this.suit = suit;          // '♠'|'♥'|'♣'|'♦' 或 ''(王)
    this.rank = rank;          // '3'~'2'|'小王'|'大王'
    this.value = RANK_MAP[rank]; // 数值 3~17
    this.id = suit + rank;     // 唯一ID
  }
  get isJoker() { return this.rank === '小王' || this.rank === '大王'; }
  get isRed() { return this.suit === '♥' || this.suit === '♦'; }
  get displayName() { return this.suit + this.rank; }
}

/** 54张牌 */
class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }
  reset() {
    this.cards = [];
    const ranks = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
    for (const suit of SUITS) {
      for (const rank of ranks) {
        this.cards.push(new Card(suit, rank));
      }
    }
    this.cards.push(new Card('', '小王'));
    this.cards.push(new Card('', '大王'));
  }
  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }
  deal() {
    this.shuffle();
    return {
      player1: this.cards.slice(0, 17),
      player2: this.cards.slice(17, 34),
      player3: this.cards.slice(34, 51),
      bottom: this.cards.slice(51, 54)
    };
  }
}

/** 牌型识别 */
function identifyType(cards) {
  if (!cards || cards.length === 0) return { type: 'pass', name: '不出' };
  
  const n = cards.length;
  // 按value排序
  const sorted = [...cards].sort((a, b) => a.value - b.value);
  const values = sorted.map(c => c.value);
  const vCount = {};
  for (const v of values) vCount[v] = (vCount[v] || 0) + 1;
  const counts = Object.values(vCount).sort((a, b) => b - a);
  const uniqueV = Object.keys(vCount).map(Number).sort((a, b) => a - b);

  // 王炸
  if (n === 2 && values[0] === 16 && values[1] === 17) {
    return { type: 'rocket', name: '王炸', rank: 17, length: 2 };
  }
  // 炸弹
  if (n === 4 && counts.length === 1 && counts[0] === 4) {
    return { type: 'bomb', name: '炸弹', rank: values[0], length: 4 };
  }
  // 单张
  if (n === 1) return { type: 'single', name: '单张', rank: values[0], length: 1 };
  // 对子
  if (n === 2 && counts[0] === 2) return { type: 'pair', name: '对子', rank: values[0], length: 2 };
  // 三张
  if (n === 3 && counts[0] === 3) return { type: 'triple', name: '三条', rank: values[0], length: 3 };
  
  // 三带一
  if (n === 4 && counts[0] === 3 && counts[1] === 1) {
    const mainVal = Number(Object.keys(vCount).find(k => vCount[k] === 3));
    return { type: 'triple_one', name: '三带一', rank: mainVal, length: 4 };
  }
  // 三带二
  if (n === 5 && counts[0] === 3 && counts[1] === 2) {
    const mainVal = Number(Object.keys(vCount).find(k => vCount[k] === 3));
    return { type: 'triple_two', name: '三带二', rank: mainVal, length: 5 };
  }
  // 顺子(5+张)
  if (n >= 5 && uniqueV.length === n && uniqueV[n-1] - uniqueV[0] === n - 1 && uniqueV[n-1] < 15) {
    return { type: 'straight', name: `顺子[${n}张]`, rank: uniqueV[n-1], length: n };
  }
  // 连对(3对+)
  if (n >= 6 && n % 2 === 0) {
    const pairs = [];
    for (const [val, cnt] of Object.entries(vCount)) {
      if (cnt === 2) pairs.push(Number(val));
    }
    if (pairs.length === n / 2 && pairs.length >= 3) {
      pairs.sort((a, b) => a - b);
      if (pairs[pairs.length-1] - pairs[0] === pairs.length - 1 && pairs[pairs.length-1] < 15) {
        return { type: 'consecutive_pairs', name: `连对[${pairs.length}对]`, rank: pairs[pairs.length-1], length: n };
      }
    }
  }
  // 飞机不带
  if (n >= 6 && n % 3 === 0) {
    const triples = Object.entries(vCount).filter(([_,c]) => c >= 3).map(([v]) => Number(v)).sort((a,b)=>a-b);
    if (triples.length === n / 3 && triples.length >= 2) {
      if (triples[triples.length-1] - triples[0] === triples.length - 1 && triples[triples.length-1] < 15) {
        return { type: 'plane', name: `飞机[${triples.length}连]`, rank: triples[triples.length-1], length: n };
      }
    }
  }
  // 飞机带单
  if (n >= 8) {
    const triples = Object.entries(vCount).filter(([_,c]) => c >= 3).map(([v]) => Number(v)).sort((a,b)=>a-b);
    const tripleCnt = n / 4;
    if (triples.length === tripleCnt && tripleCnt >= 2) {
      if (triples[tripleCnt-1] - triples[0] === tripleCnt - 1 && triples[tripleCnt-1] < 15) {
        return { type: 'plane_single', name: `飞机带单[${tripleCnt}连]`, rank: triples[tripleCnt-1], length: n };
      }
    }
  }
  // 四带二
  if ((n === 6) && counts[0] === 4) {
    const mainVal = Number(Object.keys(vCount).find(k => vCount[k] === 4));
    return { type: 'four_two', name: '四带二', rank: mainVal, length: 6 };
  }

  return null; // 不合法牌型
}

/** 判断能否压过上家 */
function canBeat(currentPlay, lastPlay) {
  if (!lastPlay || lastPlay.type === 'pass') return true;
  if (!currentPlay || currentPlay.type === 'pass') return false;
  // 王炸最大
  if (currentPlay.type === 'rocket') return true;
  if (lastPlay.type === 'rocket') return false;
  // 炸弹可以压非炸弹
  if (currentPlay.type === 'bomb' && lastPlay.type !== 'bomb') return true;
  if (lastPlay.type === 'bomb' && currentPlay.type !== 'bomb') return false;
  // 同类型比rank，且长度相同
  if (currentPlay.type === lastPlay.type && currentPlay.length === lastPlay.length) {
    return currentPlay.rank > lastPlay.rank;
  }
  // 炸弹比炸弹
  if (currentPlay.type === 'bomb' && lastPlay.type === 'bomb') {
    return currentPlay.rank > lastPlay.rank;
  }
  return false;
}

/** 查找所有合法出牌 */
function findValidPlays(hand, lastPlay) {
  const results = [];
  
  // 枚举所有子集
  function enumerate(index, current) {
    if (index === hand.length) {
      if (current.length === 0) return;
      const play = identifyType(current);
      if (play && play.type !== 'pass' && play.type !== null) {
        if (!lastPlay || lastPlay.type === 'pass' || canBeat(play, lastPlay)) {
          results.push({ cards: [...current], play });
        }
      }
      return;
    }
    // 不选这张
    enumerate(index + 1, current);
    // 选这张
    current.push(hand[index]);
    enumerate(index + 1, current);
    current.pop();
  }

  if (hand.length <= 10) {
    // 手牌少时全枚举
    enumerate(0, []);
  } else {
    // 手牌多时用优化策略枚举常见牌型
    findValidPlaysOptimized(hand, lastPlay, results);
  }

  // 加入"不出"选项
  if (lastPlay && lastPlay.type !== 'pass') {
    results.push({ cards: [], play: { type: 'pass', name: '不出', rank: 0, length: 0 } });
  }

  return results;
}

/** 优化版枚举（手牌多时用） */
function findValidPlaysOptimized(hand, lastPlay, results) {
  const sorted = [...hand].sort((a, b) => a.value - b.value);
  const values = sorted.map(c => c.value);
  const vCount = {};
  for (const c of sorted) vCount[c.value] = (vCount[c.value] || 0) + 1;
  const uniqueV = Object.keys(vCount).map(Number).sort((a, b) => a - b);

  // 单张
  for (const v of uniqueV) {
    const card = sorted.find(c => c.value === v);
    const play = identifyType([card]);
    if (!lastPlay || canBeat(play, lastPlay)) {
      results.push({ cards: [card], play });
    }
  }
  // 对子
  for (const v of uniqueV) {
    if (vCount[v] >= 2) {
      const pair = sorted.filter(c => c.value === v).slice(0, 2);
      const play = identifyType(pair);
      if (!lastPlay || canBeat(play, lastPlay)) results.push({ cards: pair, play });
    }
  }
  // 三条
  for (const v of uniqueV) {
    if (vCount[v] >= 3) {
      const triple = sorted.filter(c => c.value === v).slice(0, 3);
      const play = identifyType(triple);
      if (!lastPlay || canBeat(play, lastPlay)) results.push({ cards: triple, play });
    }
  }
  // 炸弹
  for (const v of uniqueV) {
    if (vCount[v] === 4) {
      const bomb = sorted.filter(c => c.value === v);
      const play = identifyType(bomb);
      if (!lastPlay || canBeat(play, lastPlay)) results.push({ cards: bomb, play });
    }
  }
  // 王炸
  const smallJoker = sorted.find(c => c.value === 16);
  const bigJoker = sorted.find(c => c.value === 17);
  if (smallJoker && bigJoker) {
    const play = identifyType([smallJoker, bigJoker]);
    if (!lastPlay || canBeat(play, lastPlay)) results.push({ cards: [smallJoker, bigJoker], play });
  }
  // 顺子
  for (let i = 0; i < uniqueV.length; i++) {
    const start = uniqueV[i];
    if (start > 14) break;
    for (let len = 5; len <= 12; len++) {
      const end = start + len - 1;
      if (end > 14) break;
      const straightVals = [];
      for (let v = start; v <= end; v++) {
        if (vCount[v] >= 1) straightVals.push(v);
        else break;
      }
      if (straightVals.length === len) {
        const straightCards = straightVals.map(v => sorted.find(c => c.value === v));
        const play = identifyType(straightCards);
        if (!lastPlay || canBeat(play, lastPlay)) results.push({ cards: straightCards, play });
      }
    }
  }
  // 连对
  for (let i = 0; i < uniqueV.length; i++) {
    const start = uniqueV[i];
    if (start > 14) break;
    for (let len = 3; len <= 10; len++) {
      const end = start + len - 1;
      if (end > 14) break;
      let ok = true;
      for (let v = start; v <= end; v++) {
        if (!vCount[v] || vCount[v] < 2) { ok = false; break; }
      }
      if (ok) {
        const pairCards = [];
        for (let v = start; v <= end; v++) {
          pairCards.push(...sorted.filter(c => c.value === v).slice(0, 2));
        }
        const play = identifyType(pairCards);
        if (!lastPlay || canBeat(play, lastPlay)) results.push({ cards: pairCards, play });
      }
    }
  }
  // 飞机
  for (let i = 0; i < uniqueV.length; i++) {
    const start = uniqueV[i];
    if (start > 14) break;
    for (let len = 2; len <= 6; len++) {
      const end = start + len - 1;
      if (end > 14) break;
      let ok = true;
      for (let v = start; v <= end; v++) {
        if (!vCount[v] || vCount[v] < 3) { ok = false; break; }
      }
      if (ok) {
        const planeCards = [];
        for (let v = start; v <= end; v++) {
          planeCards.push(...sorted.filter(c => c.value === v).slice(0, 3));
        }
        const play = identifyType(planeCards);
        if (!lastPlay || canBeat(play, lastPlay)) results.push({ cards: planeCards, play });
      }
    }
  }
}

/** 排序手牌 */
function sortHand(hand) {
  return [...hand].sort((a, b) => {
    if (a.value !== b.value) return a.value - b.value;
    return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
  });
}

/** 手牌转字符串（调试用） */
function handToString(hand) {
  return sortHand(hand).map(c => c.displayName).join(' ').replace(/♠/g, '♠').replace(/♥/g, '♥').replace(/♣/g, '♣').replace(/♦/g, '♦');
}

/** 渲染牌面HTML */
function renderCardHTML(card, index, selected = false) {
  const suit = card.suit || '';
  const rank = card.rank;
  const color = card.isJoker ? (card.rank === '大王' ? '#D32F2F' : '#1976D2') : (card.isRed ? '#D32F2F' : '#212121');
  const bg = selected ? '#FFF9C4' : '#FFFFFF';
  const border = selected ? '3px solid #FFD600' : '1px solid #BDBDBD';
  const bottomOffset = selected ? '-20px' : '0px';
  
  return `<div class="card" data-index="${index}" style="
    display:inline-block; width:48px; height:72px; background:${bg}; border:${border};
    border-radius:6px; text-align:center; padding:4px 2px; cursor:pointer;
    position:relative; margin:2px -10px; transition:all 0.2s; bottom:${bottomOffset};
    box-shadow: 0 2px 4px rgba(0,0,0,0.15); user-select:none;
  ">
    <div style="color:${color}; font-size:12px; font-weight:bold; line-height:1">${suit}</div>
    <div style="color:${color}; font-size:16px; font-weight:bold; line-height:1.4; margin-top:4px">${rank}</div>
    <div style="color:${color}; font-size:10px; line-height:1; margin-top:2px">${suit === '♥' ? '♥' : suit === '♦' ? '♦' : suit === '♠' ? '♠' : suit === '♣' ? '♣' : ''}</div>
  </div>`;
}

/** 测试 */
function runTests() {
  const tests = [];
  let passed = 0, failed = 0;

  function assert(condition, name) {
    if (condition) { passed++; } 
    else { failed++; console.error(`❌ FAIL: ${name}`); }
  }

  // Test 1: 创建54张牌
  const deck = new Deck();
  assert(deck.cards.length === 54, '54张牌');

  // Test 2: 发牌
  const dealt = deck.deal();
  assert(dealt.player1.length === 17, '玩家1得17张');
  assert(dealt.player2.length === 17, '玩家2得17张');
  assert(dealt.player3.length === 17, '玩家3得17张');
  assert(dealt.bottom.length === 3, '底牌3张');

  // Test 3: 牌型识别 - 单张
  const c3 = new Card('♠', '3');
  const c5 = new Card('♥', '5');
  const cA = new Card('♣', 'A');
  assert(identifyType([c3]).type === 'single', '识别单张');
  assert(identifyType([c3, c3, c3]).type === 'triple', '识别三条');

  // Test 4: 顺子  
  const straight = [3,4,5,6,7].map(v => new Card(SUITS[v % 4], RANK_NAMES[v]));
  assert(identifyType(straight).type === 'straight', '识别顺子5张');
  const straight6 = [3,4,5,6,7,8].map(v => new Card(SUITS[v % 4], RANK_NAMES[v]));
  assert(identifyType(straight6).type === 'straight', '识别顺子6张');

  // Test 5: 连对
  const pairCards = [3,3,4,4,5,5].map(v => new Card(SUITS[v % 4], RANK_NAMES[v]));
  assert(identifyType(pairCards).type === 'consecutive_pairs', '识别连对');

  // Test 6: 炸弹
  const bomb = [new Card('♠','5'), new Card('♥','5'), new Card('♣','5'), new Card('♦','5')];
  assert(identifyType(bomb).type === 'bomb', '识别炸弹');

  // Test 7: 王炸
  const rocket = [new Card('','小王'), new Card('','大王')];
  assert(identifyType(rocket).type === 'rocket', '识别王炸');

  // Test 8: canBeat
  const play3 = identifyType([c3]);
  const play5 = identifyType([c5]);
  assert(canBeat(play5, play3), '5能压3');
  assert(!canBeat(play3, play5), '3不能压5');
  const playBomb = identifyType(bomb);
  assert(canBeat(playBomb, play5), '炸弹能压单张');
  assert(!canBeat(play5, playBomb), '单张不能压炸弹');

  // Test 9: 飞机
  const plane = [];
  for (let v = 3; v <= 5; v++) {
    for (let s = 0; s < 3; s++) {
      plane.push(new Card(SUITS[s], RANK_NAMES[v]));
    }
  }
  assert(identifyType(plane).type === 'plane', '识别飞机');

  // Test 10: 三带一
  const tripleOne = [new Card('♠','K'), new Card('♥','K'), new Card('♣','K'), new Card('♦','3')];
  assert(identifyType(tripleOne).type === 'triple_one', '识别三带一');

  // Test 11: 三带二
  const tripleTwo = [new Card('♠','A'), new Card('♥','A'), new Card('♣','A'), new Card('♦','3'), new Card('♠','3')];
  assert(identifyType(tripleTwo).type === 'triple_two', '识别三带二');

  // Test 12: 牌排序
  const unsorted = [new Card('♠','A'), new Card('♣','3'), new Card('♥','K')];
  const sorted = sortHand(unsorted);
  assert(sorted[0].rank === '3', '排序后第一张是3');
  assert(sorted[2].rank === 'A', '排序后最后是A');

  // Test 13: 合法出牌枚举
  const validPlays = findValidPlays([c3, c5, cA]);
  assert(validPlays.length >= 1, '至少有一个合法出牌');

  console.log(`\n✅ 测试完成: ${passed} passed, ${failed} failed (共${passed+failed}项)`);
  return { passed, failed, total: passed + failed };
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Card, Deck, identifyType, canBeat, findValidPlays, sortHand, handToString, renderCardHTML, runTests, RANK_MAP, RANK_NAMES, SUITS };
}
