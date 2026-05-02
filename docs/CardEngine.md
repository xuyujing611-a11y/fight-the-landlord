# Card Engine API Reference

**Version:** v1.0  
**Author:** 产品老大  
**Date:** 2026-05-02  
**Doc ID:** CARD-ENGINE-001  
**Corresponding File:** `src/client/js/CardEngine.js` (1090 lines)  

---

## 1. Overview

CardEngine is a pure JavaScript library implementing the full rules of Chinese Doudizhu (斗地主). It has zero external dependencies and works in both browser and Node.js environments.

**Namespace:** `window.Doudizhu`

**Bootstrap:**
```html
<script src="js/CardEngine.js"></script>
<script>
  var deck = new Doudizhu.Deck();
  deck.shuffle();
  var dealResult = deck.deal(3, 17);
  var playerHand = dealResult.hands[0];
  var playType = Doudizhu.identifyType(selectedCards);
</script>
```

---

## 2. Constants

### 2.1 Suits

```javascript
var SUITS = ['spade', 'heart', 'club', 'diamond', 'joker'];
```

### 2.2 Rank Names

```javascript
RANK_NAMES =         ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
RANK_NAME_MAP = {
  0: '3', 1: '4', 2: '5', 3: '6', 4: '7', 5: '8', 6: '9', 7: '10',
  8: 'J', 9: 'Q', 10: 'K', 11: 'A', 12: '2',
  13: '小王', 14: '大王'
};
```

### 2.3 Hand Types

| Constant | Chinese Name | Cards | Example |
|----------|:------------:|:-----:|---------|
| `INVALID` | 无效牌型 | — | Not a valid combination |
| `SINGLE` | 单张 | 1 | ♠3 |
| `PAIR` | 对子 | 2 | ♠3 ♥3 |
| `TRIPLE` | 三张 | 3 | ♠3 ♥3 ♣3 |
| `TRIPLE_PLUS_ONE` | 三带一 | 4 | ♠3♥3♣3 + ♠4 |
| `TRIPLE_PLUS_TWO` | 三带二 | 5 | ♠3♥3♣3 + ♠4♥4 |
| `STRAIGHT` | 顺子 | 5+ | ♠3♥4♣5♦6♠7 |
| `CONSECUTIVE_PAIRS` | 连对 | 6+ (3+ pairs) | ♠3♥3♠4♥4♠5♥5 |
| `AIRPLANE` | 飞机 | 6+ (2+ triples) | ♠3♥3♣3♠4♥4♣4 |
| `AIRPLANE_PLUS_SINGLES` | 飞机带单 | singleCount per triple | matched singles |
| `AIRPLANE_PLUS_PAIRS` | 飞机带对 | pairCount per triple | matched pairs |
| `BOMB` | 炸弹 | 4 | ♠3♥3♣3♦3 |
| `ROCKET` | 火箭 | 2 | 小王+大王 |
| `FOUR_PLUS_TWO` | 四带二 | 6 | 4 same + 2 singles |
| `FOUR_PLUS_TWO_PAIRS` | 四带两对 | 8 | 4 same + 2 pairs |

**Constants location:** CardEngine.js lines 48-65

---

## 3. Card Class

### 3.1 Constructor

```javascript
new Card(suit, rank)
```

| Parameter | Type | Range | Description |
|-----------|:----:|:-----:|-------------|
| suit | string | 'spade', 'heart', 'club', 'diamond', 'joker' | Card suit |
| rank | number | 0-14 | Card rank (0='3', 12='2', 13='小', 14='大') |

**Throws:** Error for invalid suit/rank combinations.

**Example:**
```javascript
var c1 = new Card('spade', 0);    // ♠3
var c2 = new Card('heart', 12);   // ♥2
var c3 = new Card('joker', 14);   // 大王
```

### 3.2 Instance Methods

#### `displayName()`
Returns Chinese rank name:
```javascript
new Card('spade', 8).displayName()  // 'J'
new Card('joker', 13).displayName() // '小王'
```

#### `shortName()`
Returns short string for display:
```javascript
new Card('joker', 13).shortName() // 'SJ'
new Card('joker', 14).shortName() // 'BJ'
new Card('diamond', 7).shortName() // '10'
```

#### `suitSymbol()`
Returns Unicode suit character:
```javascript
new Card('spade', 3).suitSymbol()   // '♠'
new Card('heart', 3).suitSymbol()   // '♥'
new Card('joker', 3).suitSymbol()   // '🃏'
```

#### `isJoker()`
Returns `true` if rank is 13 or 14.

#### `isRed()`
Returns `true` for heart, diamond, or 大王 (big joker).

#### `toString()`
Full representation: `"♠10"`, `"🃏BJ"`, `"🃏SJ"`

#### `clone()`
Returns a new Card with same suit and rank.

### 3.3 Static Methods

#### `Card.fromString(str)`
Creates a Card from string representation (for testing).  
**Format:** `"♠3"`, `"♥K"`, `"🃏SJ"`, `"🃏BJ"`

**Example:**
```javascript
Card.fromString('♠A');   // new Card('spade', 11)
Card.fromString('🃏BJ'); // new Card('joker', 14)
Card.fromString('♥10');  // new Card('heart', 7)
```

**Supports:** Chinese names (`小王`, `大王`)

---

## 4. Deck Class

### 4.1 Constructor

```javascript
new Deck()
```

Creates a standard 54-card deck: 13 ranks × 4 suits (52 cards) + 2 jokers.

### 4.2 Methods

#### `reset()`
Resets the deck to initial 54 cards in order (spade → heart → club → diamond, 3 → 2). Returns `this` for chaining.

#### `shuffle()`
Fisher-Yates shuffle. Returns `this`.

#### `deal(nPlayers, cardsPerPlayer)`

| Parameter | Type | Description |
|-----------|:----:|-------------|
| nPlayers | number | Number of players (typically 3) |
| cardsPerPlayer | number | Cards per player (typically 17) |

**Returns:**
```javascript
{
  hands: [ // 3 arrays of 17 cards each
    [Card, Card, ...],  // Player 1
    [Card, Card, ...],  // Player 2
    [Card, Card, ...]   // Player 3
  ],
  remaining: [Card, Card, Card]  // 3 bottom cards
}
```

**Total cards used:** `nPlayers × cardsPerPlayer + remaining` = 3×17+3 = 54

---

## 5. Core Functions

### 5.1 `identifyType(cards)`

```javascript
Doudizhu.identifyType(cards)
```

**Parameters:** Array of Card objects  
**Returns:** Object with type info:
```javascript
{
  type: 'SINGLE',          // string, HAND_TYPES constant value
  rank: 5,                 // number, the primary rank for comparison
  length: 1,               // number, count of primary cards
  totalCards: 1,           // number, total cards in this combination
  name: '单张',            // string, Chinese name
  isBomb: false,           // boolean
  isRocket: false,         // boolean
  valid: true              // boolean
}
```

**Type identification rules:**

| Type | Condition | priorityRank | length |
|------|-----------|:------------:|:------:|
| SINGLE | 1 card | card.rank | 1 |
| PAIR | 2 cards, same rank | shared rank | 2 |
| TRIPLE | 3 cards, same rank | shared rank | 3 |
| TRIPLE_PLUS_ONE | 3 same + 1 other | triple rank | 4 |
| TRIPLE_PLUS_TWO | 3 same + 2 same | triple rank | 5 |
| STRAIGHT | 5+ cards, consecutive ranks (≤A), no 2/joker | highest rank | 5+ |
| CONSECUTIVE_PAIRS | 3+ consecutive pairs, no 2/joker | highest pair rank | 6+ |
| AIRPLANE | 2+ consecutive triples, no 2/joker | highest triple rank | 6+ |
| AIRPLANE_PLUS_SINGLES | airplane + matching singles | same | auto |
| AIRPLANE_PLUS_PAIRS | airplane + matching pairs | same | auto |
| BOMB | 4 cards, same rank | card rank | 4 |
| ROCKET | 2 cards, joker + joker | special (always beats) | 2 |
| FOUR_PLUS_TWO | 4 same + 2 singles | 4 same rank | 6 |
| FOUR_PLUS_TWO_PAIRS | 4 same + 2 pairs | 4 same rank | 8 |
| INVALID | Doesn't match any pattern | — | — |

**Note:** Straight/Airplane/连对 max rank is `STRAIGHT_MAX_RANK = 11` (A). 2 and jokers cannot participate in consecutive sequences.

### 5.2 `canBeat(current, last)`

```javascript
Doudizhu.canBeat(currentPlay, lastPlay)
```

| Parameter | Type | Description |
|-----------|:----:|-------------|
| currentPlay | Card[] | The new play being attempted |
| lastPlay | Card[] | The previous play to beat (null = free play) |

**Returns:** `{ canBeat: true/false, reason: '...' }`

**Rules:**
- If `lastPlay` is null/empty → strictly the first "free" play (always valid assuming `identifyType` passes)
- Same type comparison: primary rank must be higher
- Different type comparison: bombs beat all non-bomb types; rocket beats all including bombs
- Bombs ranked by their card rank (4×3 beats 4×2)
- Rocket always beats everything

**Bomb priority:** Bomb rank 12 (2) > ... > Bomb rank 0 (3). But Rocket > any Bomb.

### 5.3 `findValidPlays(hand, lastPlay)`

```javascript
Doudizhu.findValidPlays(hand, lastPlay)
```

| Parameter | Type | Description |
|-----------|:----:|-------------|
| hand | Card[] | Player's current hand |
| lastPlay | Card[] | Previous play to beat (null = free play) |

**Returns:** Array of valid play arrays: `[ [Card, Card, ...], [Card, Card, ...], ... ]`  
**Empty if:** `hand.length === 0`  

**Algorithm:**
1. Group hand cards by rank using `groupByRank()`
2. Generate all singles → pairs → triples using `findAllSingles()`, `findAllPairs()`, `findAllTriples()`
3. Build higher-order types from triples (triple+1, triple+2, airplane variants)
4. Find all straight runs using `findConsecutiveRuns()` → build straights, consecutive pairs
5. Find all bombs (4 of a kind) and rocket (joker pair)
6. Filter out plays that can't beat `lastPlay`
7. Deduplicate by `playKey()` (string of comma-joined ranks)

**Performance:** Uses generator function `combinations()` for combo generation.

### 5.4 `sortCards(cards)`

```javascript
Doudizhu.sortCards(cards)
```

**Parameters:** Array of Card objects  
**Returns:** New sorted array (does NOT mutate input)

**Sort order:**
1. Primary: rank ascending (3→2→joker)
2. Secondary: suit order (spade > heart > club > diamond)

**Usage in game.js:** Every hand deal and hand update calls this.

```javascript
this.playerHand = Doudizhu.sortCards(dealResult.hands[0]);
```

---

## 6. Internal Helper Functions

These are not exported but used internally by the engine.

| Function | Purpose |
|----------|---------|
| `groupByRank(cards)` | Returns `{rank: [card, card, ...], ...}` object |
| `combinations(arr, k)` | Generator yielding all k-combinations from arr |
| `getAllSinglesPool(groups)` | Sorted array of ranks with at least 1 card |
| `getAllPairsPool(groups)` | Sorted array of ranks with at least 2 cards |
| `playKey(cards)` | Creates dedup key: sorted rank list as comma-separated string |
| `deduplicate(plays)` | Removes duplicate play combinations |
| `arraysEqual(a, b)` | Deep comparison sorted card rank arrays |
| `isConsecutiveSequence(ranks, maxRank)` | Checks if ranks are consecutive and ≤ maxRank |
| `allCountsOne(counts)` | All counts === 1 |
| `allCountsAtLeast(counts, min)` | All counts ≥ min |
| `findConsecutiveRuns(ranks)` | Finds consecutive run segments from sorted rank list |

---

## 7. Integration with game.js

### 7.1 Usage Map

| game.js Function | CardEngine API Used | Purpose |
|-----------------|--------------------|---------|
| `init()` | Deck.shuffle(), Deck.deal(3, 17), sortCards() | Deal 54 cards across 3 players |
| `confirmPlay()` | identifyType(), canBeat() | Validate and play selected cards |
| `localHint()` | findValidPlays() | Generate hint plays |
| `localAIPlay()` | identifyType(), findValidPlays() | AI card selection strategy |
| `renderPlayerHand()` | sortCards() (called in init) | Display sorted hand |
| `renderRoundEndPanel()` | (hand.length === 0) check | Win detection |

### 7.2 Card Representation

game.js represents cards as objects with `{suit, rank}` structure — compatible with CardEngine's `Card` instances (which have the same properties).

```javascript
// game.js uses plain objects matching Card interface
{ suit: 'spade', rank: 0 }  // ♠3

// CardEngine's Card class has the same structure
new Card('spade', 0)          // ♠3
```

**Identity check:** The code uses `indexOf` and `splice` on hand arrays, which relies on exact object reference matching. When creating new cards for swaps, new Card objects are created and must be properly inserted/removed.

---

## 8. Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid constructor params | Throws Error with descriptive message |
| `canBeat` on invalid current play | Returns `{ canBeat: false }` |
| `identifyType` on empty array | Returns `{ type: 'INVALID', valid: false }` |
| `identifyType` on non-matching cards | Returns `{ type: 'INVALID', valid: false }` |
| `Card.fromString` with bad format | Throws Error |
| `findValidPlays` with empty hand | Returns `[]` |

**Dependencies:** None (pure JavaScript, no imports)

---

## 9. Version History

| Version | Date | Changes |
|:-------:|:----:|---------|
| 1.0 | 2026-04 | Initial implementation, all standard hand types |

**TODO:**
- Add game state validation (hands match 54 cards)
- Add performance optimization for `findValidPlays` on large hands
- Add suit-aware comparison for same-rank singles
