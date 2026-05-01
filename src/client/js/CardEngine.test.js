/**
 * card-engine-test.js - 斗地主牌引擎测试套件
 * Node.js 直接运行: node card-engine-test.js
 */

var Doudizhu = require('./CardEngine.js');
var Card = Doudizhu.Card;
var Deck = Doudizhu.Deck;
var HAND_TYPES = Doudizhu.HAND_TYPES;
var identifyType = Doudizhu.identifyType;
var canBeat = Doudizhu.canBeat;
var findValidPlays = Doudizhu.findValidPlays;
var sortCards = Doudizhu.sortCards;
var sortCardsDesc = Doudizhu.sortCardsDesc;

// ================================================================
// 测试辅助
// ================================================================

var passed = 0;
var failed = 0;
var testIndex = 0;

function makeCards() {
  var result = [];
  for (var i = 0; i < arguments.length; i++) {
    if (typeof arguments[i] === 'string') {
      try {
        result.push(Card.fromString(arguments[i]));
      } catch (e) {
        result.push(arguments[i]); // 可能是数字rank，用makeCard
      }
    } else if (typeof arguments[i] === 'number') {
      // rank-only 快速构造（方便测试）
      var rank = arguments[i];
      if (rank === 13) result.push(new Card('joker', 13));
      else if (rank === 14) result.push(new Card('joker', 14));
      else {
        var suits = ['spade', 'heart', 'club', 'diamond'];
        result.push(new Card(suits[0], rank));
      }
    } else {
      result.push(arguments[i]);
    }
  }
  return result;
}

function makeCardsByRank() {
  var result = [];
  var args = Array.prototype.slice.call(arguments);
  for (var i = 0; i < args.length; i++) {
    var rank = args[i];
    if (rank === 13) result.push(new Card('joker', 13));
    else if (rank === 14) result.push(new Card('joker', 14));
    else {
      var suits = ['spade', 'heart', 'club', 'diamond'];
      result.push(new Card(suits[i % 4], rank));
    }
  }
  return result;
}

function assert(condition, message) {
  testIndex++;
  if (condition) {
    passed++;
    console.log('  \u2713 TEST ' + testIndex + ': ' + message);
  } else {
    failed++;
    console.log('  \u2717 TEST ' + testIndex + ': FAIL - ' + message);
  }
}

function assertEqual(actual, expected, message) {
  testIndex++;
  if (actual === expected) {
    passed++;
    console.log('  \u2713 TEST ' + testIndex + ': ' + message);
  } else {
    failed++;
    console.log('  \u2717 TEST ' + testIndex + ': FAIL - ' + message +
      ' (expected: ' + JSON.stringify(expected) + ', actual: ' + JSON.stringify(actual) + ')');
  }
}

function assertDeepEqual(actual, expected, message) {
  testIndex++;
  try {
    var a = JSON.stringify(actual);
    var e = JSON.stringify(expected);
    if (a === e) {
      passed++;
      console.log('  \u2713 TEST ' + testIndex + ': ' + message);
    } else {
      failed++;
      console.log('  \u2717 TEST ' + testIndex + ': FAIL - ' + message);
      console.log('    expected:', e);
      console.log('    actual:  ', a);
    }
  } catch (err) {
    failed++;
    console.log('  \u2717 TEST ' + testIndex + ': FAIL - ' + message + ' (exception: ' + err.message + ')');
  }
}

function assertType(cards, expectedType, expectedRank, message) {
  var info = identifyType(cards);
  testIndex++;
  var ok = info.type === expectedType;
  if (expectedRank !== undefined) ok = ok && info.rank === expectedRank;
  if (ok) {
    passed++;
    console.log('  \u2713 TEST ' + testIndex + ': ' + message);
  } else {
    failed++;
    console.log('  \u2717 TEST ' + testIndex + ': FAIL - ' + message +
      ' (expected ' + expectedType + ' rank=' + expectedRank +
      ', got ' + info.type + ' rank=' + info.rank + ')');
  }
}

console.log('');
console.log('========================================');
console.log('  斗地主牌引擎 - 测试套件');
console.log('========================================');
console.log('');

// ================================================================
// 1. Card 对象创建
// ================================================================
console.log('--- 1. Card 对象创建 ---');

(function testCardCreation() {
  var c1 = new Card('spade', 0);
  assertEqual(c1.rank, 0, 'Card(spade, 0).rank === 0');
  assertEqual(c1.suit, 'spade', 'Card(spade, 0).suit === "spade"');
  assertEqual(c1.displayName(), '3', 'Card(spade, 0).displayName() === "3"');
  assertEqual(c1.shortName(), '3', 'Card(spade, 0).shortName() === "3"');
  assertEqual(c1.toString(), '\u26603', 'Card(spade, 0) toString');
  assertEqual(c1.isJoker(), false, 'Card(spade, 0) is not joker');
  assertEqual(c1.isRed(), false, 'Card(spade, 0) is not red');

  var c2 = new Card('heart', 11);
  assertEqual(c2.rank, 11, 'Card(heart, 11).rank === 11 (A)');
  assertEqual(c2.displayName(), 'A', 'Card(heart, 11).displayName() === "A"');

  var c3 = new Card('diamond', 12);
  assertEqual(c3.displayName(), '2', 'Card(diamond, 12).displayName() === "2"');

  // 小王 && 大王
  var sj = new Card('joker', 13);
  assertEqual(sj.displayName(), '\u5C0F\u738B', '小王 displayName');
  assertEqual(sj.isJoker(), true, '小王 isJoker');
  assertEqual(sj.isRed(), false, '小王 isRed() === false');

  var bj = new Card('joker', 14);
  assertEqual(bj.displayName(), '\u5927\u738B', '大王 displayName');
  assertEqual(bj.isJoker(), true, '大王 isJoker');
  assertEqual(bj.isRed(), true, '大王 isRed() === true');

  // fromString
  var fromS = Card.fromString('\u26603');
  assertEqual(fromS.rank, 0, 'Card.fromString("♠3").rank === 0');

  var fromA = Card.fromString('\u2665A');
  assertEqual(fromA.rank, 11, 'Card.fromString("♥A").rank === 11');

  var fromSJ = Card.fromString('\uD83C\uDCCFSJ');
  assertEqual(fromSJ.rank, 13, 'Card.fromString("🃏SJ").rank === 13');

  var fromBJ = Card.fromString('\uD83C\uDCCFBJ');
  assertEqual(fromBJ.rank, 14, 'Card.fromString("🃏BJ").rank === 14');
})();

// ================================================================
// 2. Deck 洗牌发牌
// ================================================================
console.log('\n--- 2. Deck 洗牌发牌 ---');

(function testDeck() {
  var deck = new Deck();
  assertEqual(deck.cards.length, 54, '新Deck有54张牌');

  deck.shuffle();
  assertEqual(deck.cards.length, 54, '洗牌后仍有54张牌');

  var result = deck.deal(3, 17);
  assertEqual(result.hands.length, 3, '发3手牌');
  assertEqual(result.hands[0].length, 17, '每手17张');
  assertEqual(result.hands[1].length, 17, '每手17张');
  assertEqual(result.hands[2].length, 17, '每手17张');
  assertEqual(result.remaining.length, 3, '3张底牌');

  // 验证所有牌都是不同的（没有重复）
  var allCards = result.hands[0].concat(result.hands[1]).concat(result.hands[2]).concat(result.remaining);
  assertEqual(allCards.length, 54, '所有54张牌');

  var uniqueKeys = {};
  for (var i = 0; i < allCards.length; i++) {
    var key = allCards[i].suit + ':' + allCards[i].rank;
    uniqueKeys[key] = (uniqueKeys[key] || 0) + 1;
  }
  var allUnique = true;
  for (var k in uniqueKeys) {
    if (uniqueKeys[k] !== 1) { allUnique = false; break; }
  }
  assert(allUnique, '发牌无重复');

  // 验证各花色数量
  var suitCount = { spade: 0, heart: 0, club: 0, diamond: 0, joker: 0 };
  for (var j = 0; j < allCards.length; j++) {
    suitCount[allCards[j].suit]++;
  }
  assertEqual(suitCount.spade, 13, '黑桃13张');
  assertEqual(suitCount.heart, 13, '红心13张');
  assertEqual(suitCount.club, 13, '梅花13张');
  assertEqual(suitCount.diamond, 13, '方块13张');
  assertEqual(suitCount.joker, 2, '王2张');
})();

// ================================================================
// 3. 牌型识别 - 单张
// ================================================================
console.log('\n--- 3. 牌型识别 ---');

(function testIdentifySingle() {
  assertType(makeCards(5), HAND_TYPES.SINGLE, 5, '单张（6点）');
  assertType(makeCards(0), HAND_TYPES.SINGLE, 0, '单张（3点最小）');
  assertType(makeCards(12), HAND_TYPES.SINGLE, 12, '单张（2点）');
  assertType(makeCards(13), HAND_TYPES.SINGLE, 13, '单张（小王）');
  assertType(makeCards(14), HAND_TYPES.SINGLE, 14, '单张（大王）');
})();

(function testIdentifyPair() {
  assertType(makeCards(3, 3), HAND_TYPES.PAIR, 3, '对子（7点×2）');
  assertType(makeCards(0, 0), HAND_TYPES.PAIR, 0, '对子（3点×2）');
  assertType(makeCards(12, 12), HAND_TYPES.PAIR, 12, '对子（2点×2）');
})();

(function testIdentifyTriple() {
  assertType(makeCards(1, 1, 1), HAND_TYPES.TRIPLE, 1, '三张（4点×3）');
  assertType(makeCards(11, 11, 11), HAND_TYPES.TRIPLE, 11, '三张（A×3）');
})();

(function testIdentifyTriplePlusOne() {
  assertType(makeCards(3, 3, 3, 0), HAND_TYPES.TRIPLE_PLUS_ONE, 3, '三带一（7点×3 + 3）');
  assertType(makeCards(8, 8, 8, 5), HAND_TYPES.TRIPLE_PLUS_ONE, 8, '三带一（J×3 + 6）');
})();

(function testIdentifyTriplePlusTwo() {
  assertType(makeCards(3, 3, 3, 1, 1), HAND_TYPES.TRIPLE_PLUS_TWO, 3, '三带二（7点×3 + 4点×2）');
  assertType(makeCards(11, 11, 11, 12, 12), HAND_TYPES.TRIPLE_PLUS_TWO, 11, '三带二（A×3 + 2×2）');
})();

(function testIdentifyStraight() {
  // 3-4-5-6-7
  assertType(makeCards(0, 1, 2, 3, 4), HAND_TYPES.STRAIGHT, 4, '顺子 3-4-5-6-7（5张）');
  // 3-4-5-6-7-8-9
  assertType(makeCards(0, 1, 2, 3, 4, 5, 6), HAND_TYPES.STRAIGHT, 6, '顺子 3-4-5-6-7-8-9（7张）');
  // 10-J-Q-K-A
  assertType(makeCards(7, 8, 9, 10, 11), HAND_TYPES.STRAIGHT, 11, '顺子 10-J-Q-K-A（5张最大）');
})();

(function testIdentifyConsecutivePairs() {
  // 33-44-55
  assertType(makeCards(0, 0, 1, 1, 2, 2), HAND_TYPES.CONSECUTIVE_PAIRS, 2, '连对 33-44-55');
  // QQ-KK-AA
  assertType(makeCards(9, 9, 10, 10, 11, 11), HAND_TYPES.CONSECUTIVE_PAIRS, 11, '连对 QQ-KK-AA');
})();

(function testIdentifyAirplane() {
  // 333-444
  assertType(makeCards(0, 0, 0, 1, 1, 1), HAND_TYPES.AIRPLANE, 1, '飞机 333-444');
  // QQQ-KKK-AAA
  assertType(makeCards(9, 9, 9, 10, 10, 10, 11, 11, 11), HAND_TYPES.AIRPLANE, 11, '飞机 QQQ-KKK-AAA');
})();

(function testIdentifyAirplanePlusSingles() {
  // 333-444 + 5 + 6
  assertType(makeCards(0, 0, 0, 1, 1, 1, 2, 3), HAND_TYPES.AIRPLANE_PLUS_SINGLES, 1, '飞机带单 333-444+5+6');
})();

(function testIdentifyAirplanePlusPairs() {
  // 333-444 + 55 + 66
  assertType(makeCards(0, 0, 0, 1, 1, 1, 2, 2, 3, 3), HAND_TYPES.AIRPLANE_PLUS_PAIRS, 1, '飞机带对 333-444+55+66');
})();

(function testIdentifyBomb() {
  assertType(makeCards(5, 5, 5, 5), HAND_TYPES.BOMB, 5, '炸弹 6点×4');
  assertType(makeCards(12, 12, 12, 12), HAND_TYPES.BOMB, 12, '炸弹 2点×4（最大炸弹）');
})();

(function testIdentifyRocket() {
  assertType(makeCards(13, 14), HAND_TYPES.ROCKET, 14, '火箭 小王+大王');
})();

(function testIdentifyFourPlusTwo() {
  // 4个3 + 5 + 6
  assertType(makeCards(0, 0, 0, 0, 1, 2), HAND_TYPES.FOUR_PLUS_TWO, 0, '四带二 3333+4+5');
  assertType(makeCards(12, 12, 12, 12, 10, 11), HAND_TYPES.FOUR_PLUS_TWO, 12, '四带二 2222+K+A');
})();

(function testIdentifyFourPlusTwoPairs() {
  // 4个3 + 44 + 55
  assertType(makeCards(0, 0, 0, 0, 1, 1, 2, 2), HAND_TYPES.FOUR_PLUS_TWO_PAIRS, 0, '四带两对 3333+44+55');
})();

(function testInvalidTypes() {
  assertEqual(identifyType([]).type, HAND_TYPES.INVALID, '空数组无效');
  assertEqual(identifyType(makeCards(0, 1)).type, HAND_TYPES.INVALID, '两张不同无效');
  assertEqual(identifyType(makeCards(0, 1, 5)).type, HAND_TYPES.INVALID, '三张不同无效');
  assertEqual(identifyType(makeCards(0, 0, 1, 2)).type, HAND_TYPES.INVALID, '2+1+1无效');
  assertEqual(identifyType(makeCards(0, 0, 0, 1, 2)).type, HAND_TYPES.INVALID, '3+1+1无效（非三带二）');
  // 顺子5张，但包含2
  assertEqual(identifyType(makeCards(8, 9, 10, 11, 12)).type, HAND_TYPES.INVALID, '包含2的顺子无效');
})();

// ================================================================
// 4. canBeat 出牌校验
// ================================================================
console.log('\n--- 4. canBeat 出牌校验 ---');

(function testCanBeatSingle() {
  var single3 = makeCards(0);
  var single4 = makeCards(1);
  var singleK = makeCards(10);
  var singleA = makeCards(11);
  var single2 = makeCards(12);

  assert(canBeat(single4, single3), '4能压3');
  assert(!canBeat(single3, single4), '3不能压4');
  assert(canBeat(singleA, singleK), 'A能压K');
  assert(canBeat(single2, singleA), '2能压A');

  // 小王/大王
  var sj = makeCards(13);
  var bj = makeCards(14);
  assert(canBeat(sj, single2), '小王能压2');
  assert(canBeat(bj, sj), '大王能压小王');
  assert(!canBeat(single2, bj), '2不能压大王');
})();

(function testCanBeatPair() {
  var p33 = makeCards(0, 0);
  var p44 = makeCards(1, 1);
  var pAA = makeCards(11, 11);
  var p22 = makeCards(12, 12);

  assert(canBeat(p44, p33), '44能压33');
  assert(!canBeat(p33, p44), '33不能压44');
  assert(canBeat(p22, pAA), '22能压AA');
})();

(function testCanBeatTriplePlusOne() {
  var tp1_333_4 = makeCards(0, 0, 0, 1);
  var tp1_444_5 = makeCards(1, 1, 1, 2);
  assert(canBeat(tp1_444_5, tp1_333_4), '444+5能压333+4');
  assert(!canBeat(tp1_333_4, tp1_444_5), '333+4不能压444+5');

  // 不同带牌不影响
  var tp1_444_3 = makeCards(1, 1, 1, 0);
  assert(canBeat(tp1_444_3, tp1_333_4), '444+3能压333+4（kick无关）');
})();

(function testCanBeatTriplePlusTwo() {
  var tp2_333_44 = makeCards(0, 0, 0, 1, 1);
  var tp2_444_55 = makeCards(1, 1, 1, 2, 2);
  assert(canBeat(tp2_444_55, tp2_333_44), '444+55能压333+44');

  // 不同带牌不影响
  var tp2_444_33 = makeCards(1, 1, 1, 0, 0);
  assert(canBeat(tp2_444_33, tp2_333_44), '444+33能压333+44（kick无关）');
})();

(function testCanBeatStraight() {
  var s1 = makeCards(0, 1, 2, 3, 4);   // 3-4-5-6-7
  var s2 = makeCards(1, 2, 3, 4, 5);   // 4-5-6-7-8
  var s1_long = makeCards(0, 1, 2, 3, 4, 5); // 3-4-5-6-7-8

  assert(canBeat(s2, s1), '4-5-6-7-8能压3-4-5-6-7');
  assert(!canBeat(s1, s2), '3-4-5-6-7不能压4-5-6-7-8');
  // 长度不同不能比
  assert(!canBeat(s1_long, s1), '不同长度的顺子不能比较');
  assert(!canBeat(s1, s1_long), '不同长度的顺子不能比较');
})();

(function testCanBeatBomb() {
  var bomb6 = makeCards(1, 1, 1, 1);    // 4444
  var bombA = makeCards(11, 11, 11, 11); // AAAA
  var singleK = makeCards(10);
  var pairQ = makeCards(9, 9);
  var straight = makeCards(0, 1, 2, 3, 4);

  // 炸弹压非炸弹
  assert(canBeat(bomb6, singleK), '4444能压单张K');
  assert(canBeat(bombA, pairQ), 'AAAA能压对子Q');
  assert(canBeat(bomb6, straight), '4444能压顺子');

  // 炸弹比rank
  assert(canBeat(bombA, bomb6), 'AAAA能压4444');
  assert(!canBeat(bomb6, bombA), '4444不能压AAAA');
})();

(function testCanBeatRocket() {
  var rocket = makeCards(13, 14);
  var bomb = makeCards(12, 12, 12, 12);
  var single2 = makeCards(12);

  assert(canBeat(rocket, single2), '火箭能压单张2');
  assert(canBeat(rocket, bomb), '火箭能压2222炸弹');
  assert(!canBeat(bomb, rocket), '炸弹不能压火箭');
  assert(!canBeat(single2, rocket), '单张2不能压火箭');
})();

(function testCanBeatFourPlusTwo() {
  var f42_1 = makeCards(0, 0, 0, 0, 1, 2);   // 3333+4+5
  var f42_2 = makeCards(1, 1, 1, 1, 2, 3);   // 4444+5+6
  assert(canBeat(f42_2, f42_1), '4444+5+6能压3333+4+5');
  assert(!canBeat(f42_1, f42_2), '3333+4+5不能压4444+5+6');

  // 炸弹/火箭能压四带二
  var bomb = makeCards(11, 11, 11, 11);
  var rocket = makeCards(13, 14);
  assert(canBeat(bomb, f42_1), 'AAAA能压四带二');
  assert(canBeat(rocket, f42_1), '火箭能压四带二');
})();

(function testCanBeatDifferentTypes() {
  // 不同类型不能互压（除非一方是炸弹/火箭）
  var pair = makeCards(0, 0);
  var triple = makeCards(1, 1, 1);
  var straight = makeCards(0, 1, 2, 3, 4);
  var consecutivePairs = makeCards(0, 0, 1, 1, 2, 2);

  assert(!canBeat(triple, pair), '三张不能压对子');
  assert(!canBeat(pair, triple), '对子不能压三张');
  assert(!canBeat(straight, consecutivePairs), '顺子不能压连对');
  assert(!canBeat(consecutivePairs, straight), '连对不能压顺子');
})();

// ================================================================
// 5. findValidPlays 合法出牌枚举
// ================================================================
console.log('\n--- 5. findValidPlays 合法出牌枚举 ---');

(function testFindValidPlaysNoLastPlay() {
  // 手牌: 3, 4, 5, 6（各一张）
  var hand = makeCards(0, 1, 2, 3);
  var plays = findValidPlays(hand, null);

  // 应有4个单张 + 所有的顺子（3-4-5-6是4张，不能成顺子）
  // 只有4个单张
  assertEqual(plays.length, 4, '3344手牌无lastPlay时只有4个单张');

  // 检查是否包含正确的单张
  var rankCounts = {};
  for (var i = 0; i < plays.length; i++) {
    assertEqual(plays[i].length, 1, '每个play应该只有1张');
    rankCounts[plays[i][0].rank] = (rankCounts[plays[i][0].rank] || 0) + 1;
  }
  assertEqual(Object.keys(rankCounts).length, 4, '包含4个不同rank的单张');
})();

(function testFindValidPlaysWithPairs() {
  // 手牌: 3,3,4,4,5
  var hand = makeCards(0, 0, 1, 1, 2);

  // 无lastPlay - 应包含单张、对子、顺子(3-4-5 不够5张)
  // 单张: 3,3,4,4,5 (重复rank的只算一个play)
  // 对子: 33, 44
  // 顺子: 3-4-5 只有3张不够
  // 所以应该有: 3(×1), 4(×1), 5(×1), 33, 44 = 5个plays
  var plays = findValidPlays(hand, null);
  assert(plays.length > 0, '有手牌时findValidPlays返回非空结果');

  // 验证包含对子
  var hasPair33 = false;
  var hasPair44 = false;
  for (var i = 0; i < plays.length; i++) {
    var pi = identifyType(plays[i]);
    if (pi.type === HAND_TYPES.PAIR && pi.rank === 0) hasPair33 = true;
    if (pi.type === HAND_TYPES.PAIR && pi.rank === 1) hasPair44 = true;
  }
  assert(hasPair33, '包含对子33');
  assert(hasPair44, '包含对子44');
})();

(function testFindValidPlaysWithLastPlay() {
  // 手牌: 3,4,5,6,7,8,9,10,J,Q,K,A,小王
  var hand = makeCards(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13);
  var lastPlay = makeCards(0, 1, 2, 3, 4); // 3-4-5-6-7

  var plays = findValidPlays(hand, lastPlay);
  // 应该能找到更多顺子（4-5-6-7-8 等）
  var hasBetterStraight = false;
  for (var i = 0; i < plays.length; i++) {
    var pi = identifyType(plays[i]);
    if (pi.type === HAND_TYPES.STRAIGHT && pi.rank >= 5) {
      hasBetterStraight = true;
      break;
    }
  }
  assert(hasBetterStraight, '能找到比3-4-5-6-7更大的顺子');
})();

(function testFindValidPlaysBombOption() {
  // 手牌包含炸弹，对手出顺子
  var bombCards = makeCards(12, 12, 12, 12); // 2222
  var otherCards = makeCards(0, 1, 2, 3, 4, 5); // 3-4-5-6-7-8
  var hand = bombCards.concat(otherCards);
  var lastPlay = makeCards(0, 1, 2, 3, 4); // 3-4-5-6-7

  var plays = findValidPlays(hand, lastPlay);
  var hasBomb = false;
  for (var i = 0; i < plays.length; i++) {
    var pi = identifyType(plays[i]);
    if (pi.type === HAND_TYPES.BOMB) {
      hasBomb = true;
      break;
    }
  }
  assert(hasBomb, '面对顺子时，包含炸弹的选项');
})();

(function testFindValidPlaysRocket() {
  // 手牌包含火箭
  var hand = makeCards(13, 14, 0, 1, 2, 3);
  var lastPlay = makeCards(4, 4, 4, 4); // 炸弹

  var plays = findValidPlays(hand, lastPlay);
  var hasRocket = false;
  for (var i = 0; i < plays.length; i++) {
    var pi = identifyType(plays[i]);
    if (pi.type === HAND_TYPES.ROCKET) {
      hasRocket = true;
      break;
    }
  }
  assert(hasRocket, '面对炸弹时，包含火箭选项');
})();

(function testFindValidPlaysNoOption() {
  // 手牌没有能压过的
  var hand = makeCards(0, 1, 2);       // 3,4,5
  var lastPlay = makeCards(13, 14);     // 火箭!
  var plays = findValidPlays(hand, lastPlay);
  assertEqual(plays.length, 0, '面对火箭时，无牌可出返回空数组');
})();

(function testFindValidPlaysFreePlay() {
  // 全部牌型枚举检查
  var hand = makeCards(0, 0, 0, 0, 1, 1, 1, 1, 2, 2); // 3333, 4444, 55
  var plays = findValidPlays(hand, null);

  // 应该包含: 炸弹(3333, 4444), 对子(55), 单张...等
  // 至少大于2个
  assert(plays.length >= 3, '复杂手牌能枚举出多种牌型');

  // 验证有炸弹
  var bombCount = 0;
  for (var i = 0; i < plays.length; i++) {
    if (identifyType(plays[i]).type === HAND_TYPES.BOMB) bombCount++;
  }
  assertEqual(bombCount, 2, '含有3333和4444两个炸弹');
})();

// ================================================================
// 6. 排序器
// ================================================================
console.log('\n--- 6. 排序器 ---');

(function testSortCards() {
  // 打乱顺序: K(10), A(11), 3(0), 5(2), 4(1)
  var unsorted = makeCards(10, 11, 0, 2, 1);
  var sorted = sortCards(unsorted);

  assertEqual(sorted[0].rank, 0, '升序排序第一个是3');
  assertEqual(sorted[1].rank, 1, '升序排序第二个是4');
  assertEqual(sorted[2].rank, 2, '升序排序第三个是5');
  assertEqual(sorted[3].rank, 10, '升序排序第四个是K');
  assertEqual(sorted[4].rank, 11, '升序排序第五个是A');
})();

(function testSortCardsDesc() {
  var unsorted = makeCards(0, 14, 1, 13, 2); // 3, BJ, 4, SJ, 5
  var sorted = sortCardsDesc(unsorted);

  assertEqual(sorted[0].rank, 14, '降序排序第一个是大王');
  assertEqual(sorted[1].rank, 13, '降序排序第二个是小王');
  assertEqual(sorted[2].rank, 2, '降序排序第三个是5');
})();

// ================================================================
// 7. 边界与边缘用例
// ================================================================
console.log('\n--- 7. 边界用例 ---');

(function testEdgeHands() {
  // 空手
  assertEqual(findValidPlays([], null).length, 0, '空手牌返回[]');

  // 单张手的自由出牌
  var singleHand = makeCards(14); // 大王
  var plays = findValidPlays(singleHand, null);
  assertEqual(plays.length, 1, '单张大王只有1种出法');
  assertEqual(plays[0][0].rank, 14, '出大王');

  // 只有小王+大王
  var rocketHand = makeCards(13, 14);
  var plays2 = findValidPlays(rocketHand, null);
  var hasRocket = false;
  for (var i = 0; i < plays2.length; i++) {
    if (identifyType(plays2[i]).type === HAND_TYPES.ROCKET) hasRocket = true;
  }
  assert(hasRocket, '手牌只有大小王时包含火箭');
})();

(function testStraightBoundaries() {
  // 最小的顺子 3-4-5-6-7
  var minStraight = makeCards(0, 1, 2, 3, 4);
  assertEqual(identifyType(minStraight).type, HAND_TYPES.STRAIGHT, '最小顺子有效');
  assertEqual(identifyType(minStraight).rank, 4, '最小顺子topRank为7');

  // 最大的顺子 10-J-Q-K-A
  var maxStraight = makeCards(7, 8, 9, 10, 11);
  assertEqual(identifyType(maxStraight).type, HAND_TYPES.STRAIGHT, '最大顺子有效');
  assertEqual(identifyType(maxStraight).rank, 11, '最大顺子topRank为A');

  // 4张连续不是顺子
  var notEnough = makeCards(0, 1, 2, 3);
  assertEqual(identifyType(notEnough).type, HAND_TYPES.INVALID, '4张连续不是顺子');
})();

(function testAirplaneBoundaries() {
  // 最小飞机 333-444
  var minAir = makeCards(0, 0, 0, 1, 1, 1);
  assertEqual(identifyType(minAir).type, HAND_TYPES.AIRPLANE, '最小飞机有效');

  // 最大飞机 QQQ-KKK-AAA
  var maxAir = makeCards(9, 9, 9, 10, 10, 10, 11, 11, 11);
  assertEqual(identifyType(maxAir).type, HAND_TYPES.AIRPLANE, '最大飞机有效');
})();

(function testBombHierarchy() {
  // 炸弹大小验证
  var bomb3 = makeCards(0, 0, 0, 0);
  var bomb7 = makeCards(3, 3, 3, 3);
  var bomb2 = makeCards(12, 12, 12, 12);

  assert(canBeat(bomb7, bomb3), '7777能压3333');
  assert(canBeat(bomb2, bomb7), '2222能压7777');
  assert(!canBeat(bomb3, bomb7), '3333不能压7777');
})();

(function testSameRankCannotBeat() {
  // 同rank不能压
  var p33a = makeCards(0, 0);
  var p33b = makeCards(0, 0);
  // 用不同花色建对子
  var t1 = new Card('spade', 0);
  var t2 = new Card('heart', 0);
  var t3 = new Card('club', 0);
  var t4 = new Card('diamond', 0);
  var p33c = [t1, t2];
  var p33d = [t3, t4];

  assert(!canBeat(p33c, p33d), '同rank对子不能互压');
  assert(!canBeat(p33d, p33c), '同rank对子不能互压');
})();

// ================================================================
// 8. HTML渲染测试
// ================================================================
console.log('\n--- 8. HTML渲染测试 ---');

(function testRender() {
  var cards = makeCards(0, 1, 2, 10, 11, 13, 14);
  var html = Doudizhu.renderHTML(cards, { title: '测试手牌' });
  assert(typeof html === 'string', 'renderHTML返回字符串');
  assert(html.length > 0, 'HTML内容非空');
  assert(html.indexOf('ddz-hand') >= 0, '包含ddz-hand样式类');
  assert(html.indexOf('测试手牌') >= 0, '包含标题');

  var fullPage = Doudizhu.renderFullPage(cards);
  assert(fullPage.indexOf('<!DOCTYPE html>') >= 0, 'renderFullPage包含DOCTYPE');
  assert(fullPage.indexOf('</html>') >= 0, 'renderFullPage包含</html>');
})();

// ================================================================
// 9. 组合生成器
// ================================================================
console.log('\n--- 9. 组合生成器 ---');

(function testCombinations() {
  var arr = [1, 2, 3, 4];
  var gen = Doudizhu.combinations(arr, 2);
  var count = 0;
  var results = [];
  for (var combo of gen) {
    results.push(combo);
    count++;
  }
  assertEqual(count, 6, 'C(4,2) = 6种组合');
  assertDeepEqual(results[0], [1, 2], '第一种组合是[1,2]');
  assertDeepEqual(results[5], [3, 4], '最后一种组合是[3,4]');

  // C(4,4) = 1
  var gen2 = Doudizhu.combinations(arr, 4);
  var count2 = 0;
  for (var combo2 of gen2) { count2++; }
  assertEqual(count2, 1, 'C(4,4) = 1种组合');

  // C(4,5) = 0
  var gen3 = Doudizhu.combinations(arr, 5);
  var count3 = 0;
  for (var combo3 of gen3) { count3++; }
  assertEqual(count3, 0, 'C(4,5) = 0种组合');
})();

// ================================================================
// 汇总
// ================================================================
console.log('\n========================================');
console.log('  测试完成');
console.log('========================================');
console.log('  ' + '\u2713 通过: ' + passed);
console.log('  ' + '\u2717 失败: ' + failed);
console.log('  总计: ' + (passed + failed));
console.log('========================================');

if (failed > 0) {
  process.exit(1);
}
