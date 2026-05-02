# 牌引擎 (CardEngine) — 超详细设计文档

**版本:** v2.0  
**作者:** 产品经理  
**日期:** 2026-05-02  
**对应源码:** `src/client/js/CardEngine.js` (1090行)  
**命名空间:** `window.Doudizhu`  

---

## 目录

1. [常量系统](#1-常量系统)
2. [Card 类](#2-card-类)
3. [Deck 类](#3-deck-类)
4. [牌型识别 (identifyType)](#4-牌型识别-identifytype)
5. [出牌比较 (canBeat)](#5-出牌比较-canbeat)
6. [合法出牌枚举 (findValidPlays)](#6-合法出牌枚举-findvalidplays)
7. [排序器 (sortCards)](#7-排序器-sortcards)
8. [辅助函数](#8-辅助函数)
9. [AI 策略支持](#9-ai-策略支持)
10. [与 game.js 集成](#10-与-gamejs-集成)
11. [验收标准](#11-验收标准)

---

## 1. 常量系统

### 1.1 花色 (SUITS)

```javascript
var SUITS = ['spade', 'heart', 'club', 'diamond', 'joker'];
```

| 索引 | 值 | 符号 | Unicode |
|:----:|:---|:----:|:-------:|
| 0 | spade | ♠ | `\u2660` |
| 1 | heart | ♥ | `\u2665` |
| 2 | club | ♣ | `\u2663` |
| 3 | diamond | ♦ | `\u2666` |
| 4 | joker | 🃏 | `\uD83C\uDCCF` |

### 1.2 牌面名 (RANK_NAMES / RANK_NAME_MAP)

```javascript
var RANK_NAMES = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
```

**完整映射 (13条 + 2王):**

| rank | RANK_NAMES | RANK_NAME_MAP | 中文名 |
|:----:|:----------:|:-------------:|:------:|
| 0 | `'3'` | `'3'` | 3 |
| 1 | `'4'` | `'4'` | 4 |
| 2 | `'5'` | `'5'` | 5 |
| 3 | `'6'` | `'6'` | 6 |
| 4 | `'7'` | `'7'` | 7 |
| 5 | `'8'` | `'8'` | 8 |
| 6 | `'9'` | `'9'` | 9 |
| 7 | `'10'` | `'10'` | 10 |
| 8 | `'J'` | `'J'` | J |
| 9 | `'Q'` | `'Q'` | Q |
| 10 | `'K'` | `'K'` | K |
| 11 | `'A'` | `'A'` | A |
| 12 | `'2'` | `'2'` | 2 |
| 13 | (not in RANK_NAMES) | `'小王'` | 小王 |
| 14 | (not in RANK_NAMES) | `'大王'` | 大王 |

### 1.3 顺子最大 rank

```javascript
var STRAIGHT_MAX_RANK = 11;  // A
```

**约束:** 顺子、连对、飞机只能到 A (rank 11)，不能包含 2 (rank 12) 和大小王 (rank 13/14)。

### 1.4 牌型枚举 (HAND_TYPES)

| 常量 | 值 | 中文名 | 牌数 |
|:----|:----|:------:|:----:|
| `SINGLE` | `'SINGLE'` | 单张 | 1 |
| `PAIR` | `'PAIR'` | 对子 | 2 |
| `TRIPLE` | `'TRIPLE'` | 三张 | 3 |
| `TRIPLE_PLUS_ONE` | `'TRIPLE_PLUS_ONE'` | 三带一 | 4 |
| `TRIPLE_PLUS_TWO` | `'TRIPLE_PLUS_TWO'` | 三带二 | 5 |
| `STRAIGHT` | `'STRAIGHT'` | 顺子 | ≥5 |
| `CONSECUTIVE_PAIRS` | `'CONSECUTIVE_PAIRS'` | 连对 | ≥6 (≥3对) |
| `AIRPLANE` | `'AIRPLANE'` | 飞机 | ≥6 (≥2个三张) |
| `AIRPLANE_PLUS_SINGLES` | `'AIRPLANE_PLUS_SINGLES'` | 飞机带单 | 飞机长度×4 |
| `AIRPLANE_PLUS_PAIRS` | `'AIRPLANE_PLUS_PAIRS'` | 飞机带对 | 飞机长度×5 |
| `BOMB` | `'BOMB'` | 炸弹 | 4 |
| `ROCKET` | `'ROCKET'` | 火箭 | 2 |
| `FOUR_PLUS_TWO` | `'FOUR_PLUS_TWO'` | 四带二 | 6 |
| `FOUR_PLUS_TWO_PAIRS` | `'FOUR_PLUS_TWO_PAIRS'` | 四带两对 | 8 |
| `INVALID` | `'INVALID'` | 无效 | — |

### 1.5 中文名映射 (HAND_TYPE_NAMES)

```javascript
HAND_TYPE_NAMES[HAND_TYPES.SINGLE] = '单张'
HAND_TYPE_NAMES[HAND_TYPES.PAIR] = '对子'
HAND_TYPE_NAMES[HAND_TYPES.TRIPLE] = '三张'
HAND_TYPE_NAMES[HAND_TYPES.TRIPLE_PLUS_ONE] = '三带一'
HAND_TYPE_NAMES[HAND_TYPES.TRIPLE_PLUS_TWO] = '三带二'
HAND_TYPE_NAMES[HAND_TYPES.STRAIGHT] = '顺子'
HAND_TYPE_NAMES[HAND_TYPES.CONSECUTIVE_PAIRS] = '连对'
HAND_TYPE_NAMES[HAND_TYPES.AIRPLANE] = '飞机'
HAND_TYPE_NAMES[HAND_TYPES.AIRPLANE_PLUS_SINGLES] = '飞机带单'
HAND_TYPE_NAMES[HAND_TYPES.AIRPLANE_PLUS_PAIRS] = '飞机带对'
HAND_TYPE_NAMES[HAND_TYPES.BOMB] = '炸弹'
HAND_TYPE_NAMES[HAND_TYPES.ROCKET] = '火箭'
HAND_TYPE_NAMES[HAND_TYPES.FOUR_PLUS_TWO] = '四带二'
HAND_TYPE_NAMES[HAND_TYPES.FOUR_PLUS_TWO_PAIRS] = '四带两对'
```

---

## 2. Card 类

### 2.1 构造函数

```javascript
function Card(suit, rank) {
  // suit: 'spade'|'heart'|'club'|'diamond'|'joker'
  // rank: 0-14
  this.suit = suit;
  this.rank = rank;
}
```

**校验规则:**
| 条件 | 结果 |
|:-----|:------|
| rank 不是 0-14 | throw Error |
| suit 不是 5个有效值之一 | throw Error |
| rank < 13 + suit === 'joker' | throw Error (非王牌不能有王花色) |
| rank ≥ 13 + suit !== 'joker' | throw Error (王必须有花色 joker) |

### 2.2 实例方法

| 方法 | 返回 | 说明 |
|:-----|:-----|:------|
| `displayName()` | string | 中文名: `'3'`...`'2'`/`'小王'`/`'大王'` |
| `shortName()` | string | 英文缩写: `'3'`...`'2'`/`'SJ'`/`'BJ'` |
| `suitSymbol()` | string | Unicode: `♠♥♣♦🃏` |
| `isJoker()` | boolean | `rank >= 13` |
| `isRed()` | boolean | `heart`/`diamond`/大王(rank=14) |
| `toString()` | string | `♠10` / `🃏SJ` / `🃏BJ` |
| `clone()` | Card | 深拷贝新 Card |

### 2.3 静态方法

**`Card.fromString(str)`:**
```
格式: "♠3", "♥K", "🃏SJ", "🃏BJ", "♥10"
       "♠3" -> new Card('spade', 0)
       "🃏SJ" / "🃏小王" -> new Card('joker', 13)
```

**Unicode 处理:** 使用 codepoint 拆分处理代理对（🃏 是 4字节字符）。

---

## 3. Deck 类

### 3.1 构造与复位

```javascript
function Deck() {
  this.cards = [];
  this.reset();
}
```

**reset()** 生成的初始牌序:
```
♠3 ♥3 ♣3 ♦3 ♠4 ♥4 ♣4 ♦4 ... ♠2 ♥2 ♣2 ♦2 小王 大王
```
即: 按 spade→heart→club→diamond 花色遍历，每花色 rank 0→12 (3→2)，然后两张王。

### 3.2 方法

| 方法 | 参数 | 返回 | 说明 |
|:-----|:-----|:-----|:------|
| `reset()` | — | this | 重置54张牌 |
| `shuffle()` | — | this | Fisher-Yates 洗牌 |
| `deal(n, cpp)` | nPlayers=3, cardsPerPlayer=17 | `{hands, remaining}` | 发牌 |

**deal 返回格式:**
```javascript
{
  hands: [
    [Card, Card, ...],  // 玩家0: 17张
    [Card, Card, ...],  // 玩家1: 17张
    [Card, Card, ...]   // 玩家2: 17张
  ],
  remaining: [Card, Card, Card]  // 3张底牌
}
```

**牌数验证:** 54 = 3×17 + 3

---

## 4. 牌型识别 (identifyType)

### 4.1 函数签名

```javascript
function identifyType(cards) → { type, rank, length, ... }
```

### 4.2 返回值格式

```javascript
{
  type: 'SINGLE',       // HAND_TYPES 常量
  rank: 5,              // 比较用主rank (用于canBeat)
  length: 1,            // 主体数量 (翅膀数/顺子长度/对子对数/飞机引擎数)
  totalCards: 1,        // 总牌数 (隐含)
  name: '单张',          // 中文名
  isBomb: false,        // 炸弹标记
  isRocket: false,      // 火箭标记
  valid: true           // 合法牌型
}
```

**⚠️ 注意:** 当前代码 `identifyType` 不返回 totalCards/name/isBomb/isRocket/valid 字段，仅返回 `{type, rank, length}` + 部分类型含 `kickRank`。

### 4.3 识别规则 (识别顺序, 严格按代码执行)

```
输入: cards (array of Card)
  ↓
n = cards.length
sorted = 按rank排序
groups = groupByRank(sorted)
ranks = 各组rank列表 (升序)
counts = 各组牌数列表
  ↓
1. 火箭: n===2 && ranks=[13,14]
   → {ROCKET, rank:14, length:2}

2. 炸弹: n===4 && ranks.length===1 && counts[0]===4
   → {BOMB, rank: ranks[0], length:4}

3. 单张: n===1
   → {SINGLE, rank: sorted[0].rank, length:1}

4. 对子: n===2 && ranks.length===1 && counts[0]===2
   → {PAIR, rank: ranks[0], length:2}

5. 三张: n===3 && ranks.length===1 && counts[0]===3
   → {TRIPLE, rank: ranks[0], length:3}

6. 三带一: n===4 && ranks.length===2
   → 找 3+1 组合: {TRIPLE_PLUS_ONE, rank: tripleRank, length:4, kickRank}

7. 三带二: n===5 && ranks.length===2
   → 找 3+2 组合: {TRIPLE_PLUS_TWO, rank: tripleRank, length:5, kickRank}

8. 顺子: n>=5 && 连续序列 && 每张1张 && 最大rank <= A(11)
   → {STRAIGHT, rank: maxRank, length: n}

9. 连对: n>=6 && n%2===0 && n===ranks*2 && 连续序列 && 每张≥2 && max<=A
   → {CONSECUTIVE_PAIRS, rank: maxRank, length: n/2}

10. 飞机系列: n>=6
    → 找连续 tripleranks
    ├── 纯飞机 (n=tripleCount×3) → {AIRPLANE, rank: maxRunRank, length: runLen}
    ├── 飞机带单 (n=tripleCount×3 + runLen) → {AIRPLANE_PLUS_SINGLES, rank: maxRunRank, length: runLen}
    └── 飞机带对 (n=tripleCount×3 + runLen×2) → {AIRPLANE_PLUS_PAIRS, rank: maxRunRank, length: runLen}

11. 四带二: n===6
    → 找 4+2: {FOUR_PLUS_TWO, rank: bombRank, length:6}

12. 四带两对: n===8
    → 找 4+2+2: {FOUR_PLUS_TWO_PAIRS, rank: bombRank, length:8}

13. 都不匹配 → {INVALID, rank:-1, length:0}
```

### 4.4 识别优先级

**识别有严格先后顺序**, 与斗地主规则一致:
1. 火箭 (最优先)
2. 炸弹
3. 单张
4. 对子
5. 三张
6. 三带一
7. 三带二
8. 顺子
9. 连对
10. 飞机及其变体
11. 四带二
12. 四带两对
13. INVALID

### 4.5 识别示例

| 牌组 | 结果 | rank | length |
|:----|:-----|:----:|:------:|
| [♠3] | SINGLE | 0 | 1 |
| [♠3, ♥3] | PAIR | 0 | 2 |
| [♠3, ♥3, ♣3] | TRIPLE | 0 | 3 |
| [♠3, ♥3, ♣3, ♠4] | TRIPLE_PLUS_ONE | 0 | 4 |
| [♠3, ♥3, ♣3, ♠4, ♥4] | TRIPLE_PLUS_TWO | 0 | 5 |
| [♠3, ♥4, ♣5, ♦6, ♠7] | STRAIGHT | 4 (7) | 5 |
| [♠3, ♥3, ♠4, ♥4, ♠5, ♥5] | CONSECUTIVE_PAIRS | 2 (5) | 3 |
| [♠3, ♥3, ♣3, ♠4, ♥4, ♣4] | AIRPLANE | 1 (4) | 2 |
| [♠3, ♥3, ♣3, ♠4, ♥4, ♣4, ♠5] | AIRPLANE_PLUS_SINGLES | 1 (4) | 2 |
| [♠3, ♥3, ♣3, ♦3] | BOMB | 0 (3) | 4 |
| [♠小王, ♠大王] | ROCKET | 14 (大王) | 2 |
| [♠3, ♥3, ♣3, ♦3, ♠4, ♥5] | FOUR_PLUS_TWO | 0 (3) | 6 |
| [♠3, ♥3, ♣3, ♦3, ♠4, ♥4, ♠5, ♥5] | FOUR_PLUS_TWO_PAIRS | 0 (3) | 8 |
| [♠3, ♥4, ♣4] | INVALID | -1 | 0 |

---

## 5. 出牌比较 (canBeat)

### 5.1 函数签名

```javascript
function canBeat(current, last) → boolean
```

**参数:**
| 参数 | 类型 | 说明 |
|:-----|:-----|:------|
| current | Card[] | 当前尝试出的牌 |
| last | Card[] | 上家出的牌 (null = 自由出牌, 但不进入此函数) |

### 5.2 判定规则树

```
canBeat(current, last)
  │
  ├─ [guard] !current || !last || current.length===0 || last.length===0 → false
  │
  ├─ curInfo = identifyType(current)
  ├─ lastInfo = identifyType(last)
  │
  ├─ [guard] curInfo.type === INVALID → false
  ├─ [guard] lastInfo.type === INVALID → false
  │
  ├─ 火箭规则:
  │   ├─ curInfo.type === ROCKET → return true   (火箭管一切)
  │   └─ lastInfo.type === ROCKET → return false  (无人能管火箭)
  │
  ├─ 炸弹规则:
  │   ├─ curInfo.type === BOMB && lastInfo.type !== BOMB → return true   (炸弹管非炸弹)
  │   └─ lastInfo.type === BOMB && curInfo.type !== BOMB → return false  (非炸弹管不了炸弹)
  │
  ├─ 同类比较:
  │   ├─ curInfo.type !== lastInfo.type → return false
  │   │
  │   ├─ 长度敏感型 (顺子/连对/飞机及其变体):
  │   │     curInfo.length !== lastInfo.length → return false
  │   │
  │   ├─ 炸弹比 rank:
  │   │     return curInfo.rank > lastInfo.rank
  │   │
  │   └─ 普通同型:
  │         return curInfo.rank > lastInfo.rank   (单张/对子/三张/三带一/三带二/四带二/四带两对)
  │
  └─ → return false
```

### 5.3 比较规则摘要

| 当前 → 上家 | SINGLE | PAIR | TRIPLE | TRPL+1 | TRPL+2 | STRAIGHT | CONSEC-P | AIRPLANE | ... | BOMB | ROCKET |
|:-----------:|:------:|:----:|:------:|:------:|:------:|:--------:|:--------:|:--------:|:---:|:----:|:------:|
| SINGLE | rank比 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| PAIR | ✗ | rank比 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| TRIPLE | ✗ | ✗ | rank比 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| TRPL+1 | ✗ | ✗ | ✗ | rank比 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| TRPL+2 | ✗ | ✗ | ✗ | ✗ | rank比 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| STRAIGHT | ✗ | ✗ | ✗ | ✗ | ✗ | rank+长度 | ✗ | ✗ | ✗ | ✗ | ✗ |
| CONSEC-P | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | rank+长度 | ✗ | ✗ | ✗ | ✗ |
| AIRPLANE | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | rank+长度 | ✗ | ✗ | ✗ |
| ... | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | 同类rank+长度 | ✗ | ✗ |
| BOMB | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | rank比 | ✗ |
| ROCKET | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |

其中:
- ✅ = 可以管 (BOMB管一切非炸弹/非火箭)
- ✗ = 不可以管
- `rank比` = 主rank大的胜
- `rank+长度` = rank相同且长度相同才可比 (同型且同长度)

### 5.4 比较示例

| current | last | 结果 | 原因 |
|:-------|:-----|:----:|:------|
| [♠A] | [♠K] | ✅ | 单张 rank 11 > 10 |
| [♠5] | [♠K] | ❌ | 单张 rank 5 < 10 |
| [♠4,♠4] | [♠5,♠5] | ❌ | 对子 rank 4 < 5 |
| [♠3,♠3,♠3] | [♠4,♠4,♠4] | ❌ | 三张 rank 3 < 4 |
| [♠3,♠4,♠5,♠6,♠7] | [♠4,♠5,♠6,♠7,♠8] | ❌ | 顺子 rank最高 7 < 8 |
| [♠3,♠4,♠5,♠6,♠7] | [♠4,♠5,♠6,♠7,♠8,♠9] | ❌ | 长度不同 5≠6 |
| [♠3,♠3,♠3,♠3] | [♠4,♠4,♠4,♠4] | ❌ | 炸弹 rank 3 < 4 |
| [♠K,♠K,♠K,♠K] | [♠5,♠6,♠7,♠8,♠9] | ✅ | 炸弹管顺子 |
| [♠小,♠大] | [♠K,♠K,♠K,♠K] | ✅ | 火箭管炸弹 |
| [♠3,♠3,♠3,♠3] | [♠小,♠大] | ❌ | 炸弹管不了火箭 |
| [♠3,♠3,♠3,♠4] | [♠K,♠K,♠K] | ❌ | 三带一不能管三张(不同型) |

---

## 6. 合法出牌枚举 (findValidPlays)

### 6.1 函数签名

```javascript
function findValidPlays(hand, lastPlay) → [[Card], [Card], ...]
```

| 参数 | 类型 | 说明 |
|:-----|:-----|:------|
| hand | Card[] | 当前手牌 |
| lastPlay | Card[] | 上家出的牌 (null/[] = 自由出牌) |

**返回:** 所有合法出牌组合的数组 (各组合为 Card 数组)  
**空数组:** `hand.length === 0` 或 `lastPlay` 为火箭时

### 6.2 枚举流程

```
findValidPlays(hand, lastPlay)
  │
  ├─ groups = groupByRank(hand)
  │
  ├─ 收集所有可能牌型:
  │   ├─ findAllSingles(groups)         → 所有单张
  │   ├─ findAllPairs(groups)           → 所有对子
  │   ├─ findAllTriples(groups)         → 所有三张
  │   ├─ findAllTriplePlusOne(groups)   → 所有三带一
  │   ├─ findAllTriplePlusTwo(groups)   → 所有三带二
  │   ├─ findAllStraights(groups)       → 所有顺子 (B4: 最长8张)
  │   ├─ findAllConsecutivePairs(groups) → 所有连对 (B4: 最长6对)
  │   ├─ findAllAirplanes(groups)       → 所有飞机 (B4: 最长4连)
  │   ├─ findAllBombs(groups)           → 所有炸弹
  │   ├─ findRocket(groups)             → 火箭
  │   └─ findAllFourPlusTwo(groups)     → 四带二 + 四带两对
  │
  ├─ deduplicate(allPlays)              → 按 rank 序列去重
  │
  ├─ sort by typeSortOrder              → 按类型排序 (单张→火箭)
  │
  ├─ [自由出牌 lastPlay null/空]:
  │     return allPlays
  │
  └─ [有上家牌]:
      ├─ lastInfo = identifyType(lastPlay)
      ├─ if (lastInfo.type === ROCKET) → return []
      ├─ 过滤 canBeat(play, lastPlay) === true 的
      └─ return filteredPlays
```

### 6.3 子枚举器详解

#### findAllSingles

遍历所有 rank 组，每张牌产生一个单张组合。

#### findAllPairs

遍历所有 rank 组，每组取前2张牌 (groups[r].length >= 2)。

#### findAllTriples

遍历所有 rank 组，每组取前3张牌 (groups[r].length >= 3)。

#### findAllTriplePlusOne

遍历所有 rank 组中 >=3 张的 rank，从其他 rank 中选1张 kick。使用 `getAllSinglesPool` 和 `combinations`。

#### findAllTriplePlusTwo

同上，从其他 rank 中选1对。使用 `getAllPairsPool`。

#### findAllStraights

```
available[r] = (groups[r] && groups[r].length >= 1)  // rank 0~11
→ 找连续可用段 run
→ 每个 run 中枚举所有长度 5 ~ maxLen(8) 的子段
→ 每段取第一张牌 (groups[rr][0])
```

**B4 约束:** 顺子最长 8 张 (避免组合爆炸)

#### findAllConsecutivePairs

```
available[r] = (groups[r] && groups[r].length >= 2)  // rank 0~11
→ 找连续可用段 run
→ 每个 run 中枚举所有长度 3 ~ maxLen(6) 对
→ 每段取前2张牌 (groups[rr][0], groups[rr][1])
```

**B4 约束:** 连对最长 6 对 (12张)

#### findAllAirplanes

```
tripleAvailable[r] = (groups[r] && groups[r].length >= 3)  // rank 0~11
→ 找连续 run (长度≥2)
→ 每个 run 枚举长度 2 ~ maxLen(4)
→ 生成:
  ├─ 纯飞机: 取前3张/rank
  ├─ 飞机带单: 从剩余牌中选 len 张单张 (combinations)
  └─ 飞机带对: 从剩余牌中选 len 对 (combinations)
```

**B4 约束:** 飞机最长 4 连 (12+4=16 或 12+8=20 张)

#### findAllBombs

遍历所有 rank 组中恰好 4 张的，取全部 4 张。

#### findRocket

检查 groups[13] 和 groups[14] 是否存在。

#### findAllFourPlusTwo

遍历 bombRanks (count===4)：
- 四带二单: 从其他 rank 选2张单
- 四带两对: 从其他 rank 选2对

### 6.4 去重 (deduplicate)

```javascript
function playKey(cards) {
  return cards.map(c => c.rank).sort().join(',');
}
```

基于 rank 序列去重，不关心花色。例如:
- `♠3 ♥4 ♣5` 和 `♦3 ♠4 ♠5` → 相同 key `0,1,2` → 去重

### 6.5 B4 性能约束

| 枚举器 | 最大长度 | 原因 |
|:-------|:--------:|:------|
| 顺子 (findAllStraights) | 8张 | 避免组合爆炸 |
| 连对 (findAllConsecutivePairs) | 6对 (12张) | 同上 |
| 飞机 (findAllAirplanes) | 4连 | 同上 |

---

## 7. 排序器 (sortCards)

### 7.1 升序排序 (sortCards)

```javascript
function sortCards(cards) → Card[]
// 不修改原数组, 返回新排序数组
```

**排序规则:**
1. 主排序: rank 升序 (0=3 最小, 14=大王 最大)
2. 次排序: 花色 (spade > heart > club > diamond > joker)

```
suitOrder = { spade: 0, heart: 1, club: 2, diamond: 3, joker: 4 }
```

**排序后显示顺序 (3最小 → 大王最大):**
```
♠3 ♥3 ♣3 ♦3 ♠4 ♥4 ... ♠2 ♥2 ♣2 ♦2 小王 大王
```

### 7.2 降序排序 (sortCardsDesc)

```javascript
function sortCardsDesc(cards) → Card[]
```

**规则:** rank 降序, 花色顺序同上。

```
大王 小王 ♦2 ♣2 ♥2 ♠2 ... ♦3 ♣3 ♥3 ♠3
```

### 7.3 game.js 中使用

```javascript
// init() 发牌后
this.playerHand = Doudizhu.sortCards(dealResult.hands[0]);

// finishBidding 玩家是地主时
this.playerHand = Doudizhu.sortCards(this.playerHand);

// confirmPlay 出牌后
this.renderPlayerHand();  // (内部已再次调用 sortCards? 不, renderPlayerHand 不从 sort 开始)
```

---

## 8. 辅助函数

### 8.1 groupByRank

```javascript
function groupByRank(cards) → { rank: Card[], ... }
```

按 rank 分组。输入 `[♠3, ♥3, ♦J]` → 输出 `{0: [♠3, ♥3], 8: [♦J]}`

### 8.2 combinations (Generator)

```javascript
function* combinations(arr, k) → yield [element, ...]
```

从 arr 中选 k 个元素的所有组合。使用 ES6 Generator。

### 8.3 get 辅助

| 函数 | 用途 | 返回 |
|:-----|:-----|:-----|
| `getAllSinglesPool(groups, excludeRanks)` | 获取所有可做"带"的单张候选 | Card[] |
| `getAllPairsPool(groups, excludeRanks)` | 获取所有可做"带"的对候选 | Card[][] |
| `playKey(cards)` | 生成去重key | string (逗号分隔rank) |
| `deduplicate(plays)` | 去重 | Card[][] |
| `arraysEqual(a, b)` | 深比较rank序列 | boolean |

### 8.4 序列检测

| 函数 | 用途 | 返回 |
|:-----|:-----|:------|
| `isConsecutiveSequence(ranks, maxRank)` | 是否连续递增且 ≤ maxRank | boolean |
| `allCountsOne(counts)` | 所有 count === 1 | boolean |
| `allCountsAtLeast(counts, min)` | 所有 count ≥ min | boolean |
| `findConsecutiveRuns(ranks)` | 找连续段 (长度≥2) | number[][] |

---

## 9. AI 策略支持

### 9.1 typeSortOrder — 出牌优先级

```javascript
function typeSortOrder(type) → number
```

| 牌型 | order | AI策略: 越小的越优先出 |
|:----|:-----:|:----------------------|
| SINGLE | 0 | 单张 (最优先) |
| PAIR | 1 | 对子 |
| TRIPLE | 2 | 三张 |
| TRIPLE_PLUS_ONE | 3 | 三带一 |
| TRIPLE_PLUS_TWO | 4 | 三带二 |
| STRAIGHT | 5 | 顺子 |
| CONSECUTIVE_PAIRS | 6 | 连对 |
| AIRPLANE | 7 | 飞机 |
| AIRPLANE_PLUS_SINGLES | 8 | 飞机带单 |
| AIRPLANE_PLUS_PAIRS | 9 | 飞机带对 |
| FOUR_PLUS_TWO | 10 | 四带二 |
| FOUR_PLUS_TWO_PAIRS | 11 | 四带两对 |
| BOMB | 12 | 炸弹 |
| ROCKET | 13 | 火箭 |

**game.js 中 localAIPlay 使用:**
```javascript
var plays = Doudizhu.findValidPlays(hand, this.lastPlay);
var chosen = plays[0];  // typeSortOrder 最小的
```

由于 `findValidPlays` 返回值已按 `typeSortOrder` + rank 排序，`plays[0]` 即最弱的推荐。

### 9.2 自由出牌优化

```javascript
// localAIPlay 中:
if (!this.lastPlay || this.lastPlay.length === 0) {
  var singlePlay = null;
  for (var pi = 0; pi < plays.length; pi++) {
    if (plays[pi].length === 1) { singlePlay = plays[pi]; break; }
  }
  if (singlePlay) chosen = singlePlay;  // 优先出最小单张
}
```

自由出牌时优先枚举最小的单张，而非 plays[0] (可能是最小对子)。

---

## 10. 与 game.js 集成

### 10.1 game.js 中的调用点

| game.js 函数 | CardEngine API | 用途 | 行号 |
|:-------------|:---------------|:-----|:-----|
| `init()` | `Deck.shuffle().deal(3, 17)` + `sortCards` | 发牌+排序 | ~200 |
| `confirmPlay()` | `identifyType` | 验证玩家出牌牌型 | ~995 |
| `confirmPlay()` | — (无 canBeat 调用) | 出牌校验在 doPlayerPlay 完成 | — |
| `doPlayerPlay()` | `identifyType` + `canBeat` | 双验证 | ~960-970 |
| `localHint()` | `findValidPlays` + `identifyType` | 本地提示 | ~1085 |
| `highlightHint()` | — | API 提示 (不依赖 CardEngine) | ~1115 |
| `localAIPlay()` | `findValidPlays` + `identifyType` | 本地AI出牌 | ~1260 |
| `handleAIPlay()` | `identifyType` (partial match) | API AI出牌降级 | ~1195 |
| `handCards[]` | — (使用 Card.suit/rank 结构) | 渲染手牌图片 | ~420 |

### 10.2 牌对象兼容

game.js 中手牌使用 `Doudizhu.Card` 实例 (suit, rank 属性):

```javascript
// 发牌
this.playerHand = dealResult.hands[0];  // Card[]

// 手牌操作
var playCards = this.selectedCards.map(function(idx) {
  return self.playerHand[idx];  // 直接取Card对象引用
});

// 移除出牌 (引用匹配)
var key = card.suit + ':' + card.rank;
playSet[key] = (playSet[key] || 0) + 1;
// splice 移除时使用 suit:rank 匹配, 不需要引用全等
```

### 10.3 出牌验证流程 (game.js + CardEngine)

```
玩家点击"出牌"
  │
  ├─ DoPlayerPlay():
  │   ├─ selectedCards.map → playCards
  │   ├─ Doudizhu.identifyType(playCards)
  │   │   └─ type === INVALID → toast + return
  │   │
  │   ├─ [有上家牌] Doudizhu.canBeat(playCards, lastPlay)
  │   │   └─ false → toast + return
  │   │
  │   ├─ [API模式] ApiClient.verifyPlay()
  │   │   ├─ valid=true → confirmPlay
  │   │   └─ valid=false → toast + return
  │   │
  │   └─ [本地模式 / API降级] → confirmPlay(playCards, info)
  │
  └─ confirmPlay():
      ├─ 手牌移除 (suit:rank匹配)
      ├─ displayPlay
      ├─ addPlayHistory
      └─ AI回合
```

**验证层级:**
1. 前端: `identifyType(INVALID)` 守卫
2. 前端: `canBeat()` 守卫
3. 后端(API): `verifyPlay()` 服务端验证
4. API 失败时降级到前端验证 (直接 confirmPlay)

---

## 11. 验收标准

### 11.1 牌型识别

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| I1 | 单张 [♠3] | SINGLE rank=0 | identifyType |
| I2 | 对子 [♠3, ♥3] | PAIR rank=0 | identifyType |
| I3 | 三张 [♠3, ♥3, ♣3] | TRIPLE rank=0 | identifyType |
| I4 | 三带一 [♠3, ♥3, ♣3, ♠4] | TRIPLE_PLUS_ONE rank=0 | identifyType |
| I5 | 三带二 [♠3, ♥3, ♣3, ♠4, ♥4] | TRIPLE_PLUS_TWO rank=0 | identifyType |
| I6 | 顺子 [3,4,5,6,7] | STRAIGHT rank=4 | identifyType |
| I7 | 连对 [33,44,55] | CONSECUTIVE_PAIRS rank=2 | identifyType |
| I8 | 纯飞机 [333,444] | AIRPLANE rank=1 | identifyType |
| I9 | 飞机带单 [333,444,5] | AIRPLANE_PLUS_SINGLES | identifyType |
| I10 | 炸弹 [3333] | BOMB rank=0 | identifyType |
| I11 | 火箭 [小王,大王] | ROCKET rank=14 | identifyType |
| I12 | 非法 [♠3, ♠4] | INVALID | identifyType |

### 11.2 出牌比较

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| C1 | 单张 A > K | canBeat=true | canBeat |
| C2 | 单张 3 < K | canBeat=false | canBeat |
| C3 | 顺子同等长度 7-8-9-10-J > 3-4-5-6-7 | canBeat=true | canBeat |
| C4 | 顺子长度不同 3-4-5-6-7 不能管 4-5-6-7-8-9 | canBeat=false | canBeat |
| C5 | 炸弹 3333 > 顺子 3-4-5-6-7 | canBeat=true | canBeat |
| C6 | 火箭 > 炸弹 3333 | canBeat=true | canBeat |
| C7 | 炸弹 3333 < 火箭 | canBeat=false | canBeat |
| C8 | 无牌能管火箭 | canBeat(任何, 火箭)=false | canBeat |

### 11.3 排序

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| S1 | sortCards 升序: 3→2→小王→大王 | rank升序 | sortCards |
| S2 | 同rank花色: ♠ > ♥ > ♣ > ♦ | suitOrder 0→3 | sortCards |
| S3 | sortCardsDesc 降序: 大王→小王→2→3 | rank降序 | sortCardsDesc |

### 11.4 findValidPlays

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| F1 | 空手牌 → [] | 空数组 | findValidPlays |
| F2 | 自由出牌 → 所有可能组合 | 含单张/对子/顺子等 | findValidPlays |
| F3 | 有上家牌 → 仅返回能压上的组合 | 过滤结果 | findValidPlays |
| F4 | 上家火箭 → 返回 [] | 不可压 | findValidPlays |
| F5 | 去重正确: 同rank不同花色组合只保留一个 | playKey去重 | deduplicate |

### 11.5 发牌

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| D1 | 54张牌总数不变 | reset() → 54 | Deck.reset |
| D2 | deal(3,17) → 3×17+3=54 | 正确分牌 | Deck.deal |
| D3 | 洗牌后顺序随机 | shuffle() Fisher-Yates | Deck.shuffle |
| D4 | 花色映射正确 | 5种+13rank+2王 | SUITS/RANK_NAMES |

### 11.6 Card 类

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| CA1 | new Card('spade', 0) → rank=0, suit='spade' | 正确创建 | Card |
| CA2 | 非法参数 throw Error | rank<0, suit无效等 | Card |
| CA3 | displayName 正确 | 0→'3', 13→'小王' | displayName |
| CA4 | fromString "♠3" 正确解析 | → Card('spade',0) | fromString |
| CA5 | 是否为红: heart/diamond/大王 | isRed() | isRed |

### 11.7 集成验证

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| J1 | game.js 调用 identifyType 验证出牌 | 非法牌型 toast | doPlayerPlay |
| J2 | game.js 调用 canBeat 验证压牌 | 不能压 toast | doPlayerPlay |
| J3 | game.js 调用 findValidPlays 做提示 | 最小推荐 | localHint |
| J4 | game.js 调用 findValidPlays 做AI出牌 | 最弱出牌 | localAIPlay |
| J5 | sortCards 用于发牌排序 | 3→2 单花色排序 | init() |

---

## 附录: 函数索引

| 函数/方法 | 行号 | 功能 | 备注 |
|:----------|:----:|:-----|:------|
| `Card(suit, rank)` | ~130 | 牌构造函数 | 含校验 |
| `Card.fromString(str)` | ~175 | 从字符串解析 | 支持Unicode |
| `Deck()` | ~215 | 牌堆构造 | 54张 |
| `Deck.reset()` | ~220 | 重置54张 | 初始排序 |
| `Deck.shuffle()` | ~235 | Fisher-Yates洗牌 | 原位 |
| `Deck.deal(n, cpp)` | ~243 | 发牌 | 3×17+3 |
| `groupByRank(cards)` | ~260 | rank分组 | 内部 |
| `combinations(arr, k)` | ~268 | 组合生成器 | Generator |
| `identifyType(cards)` | ~350 | 牌型识别 | 14种 |
| `canBeat(current, last)` | ~560 | 出牌比较 | 炸弹/火箭规则 |
| `findAllSingles(groups)` | ~610 | 枚举单张 | 内部 |
| `findAllPairs(groups)` | ~622 | 枚举对子 | 内部 |
| `findAllTriples(groups)` | ~634 | 枚举三张 | 内部 |
| `findAllTriplePlusOne(groups)` | ~668 | 枚举三带一 | 内部 |
| `findAllTriplePlusTwo(groups)` | ~684 | 枚举三带二 | 内部 |
| `findAllStraights(groups)` | ~700 | 枚举顺子 | B4: 最长8 |
| `findAllConsecutivePairs(groups)` | ~728 | 枚举连对 | B4: 最长6对 |
| `findAllAirplanes(groups)` | ~755 | 枚举飞机 | B4: 最长4连 |
| `findAllBombs(groups)` | ~809 | 枚举炸弹 | 内部 |
| `findRocket(groups)` | ~817 | 枚举火箭 | 内部 |
| `findAllFourPlusTwo(groups)` | ~823 | 枚举四带二 | 含两对变体 |
| `findValidPlays(hand, last)` | ~850 | 合法出牌枚举 | 去重+排序+过滤 |
| `typeSortOrder(type)` | ~900 | 牌型优先级 | AI策略 |
| `sortCards(cards)` | ~917 | 升序排序 | rank→suit |
| `sortCardsDesc(cards)` | ~928 | 降序排序 | 同上 |
| `isConsecutiveSequence()` | ~530 | 连续序列检测 | 内部 |
| `findConsecutiveRuns()` | ~545 | 找连续段 | 内部 |
