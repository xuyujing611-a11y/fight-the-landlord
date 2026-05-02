# 叫分系统 (Bidding Phase) — 超详细设计文档

**版本:** v2.0  
**作者:** 产品经理  
**日期:** 2026-05-02  
**基准画布:** 960×600 横屏 (Phaser 3 Scale.FIT)  
**对应源码:** `src/client/js/game.js` (2897行)  
**API客户端:** `src/client/js/apiClient.js`  

> ⚠️ **代码对齐说明**: 本文档所有坐标、颜色、depth、逻辑树直接从 game.js 代码提取，与代码实现一致。**已有1处代码bug**: `totalW` 计算使用 `bw * 5` 而非 `bw * 4`，导致按钮整体左移，详见 [2.1 按钮公式](#21-按钮公式)。

---

## 目录

1. [完整流程](#1-完整流程)
2. [叫分UI](#2-叫分ui)
3. [AI叫分策略](#3-ai叫分策略)
4. [叫分状态机](#4-叫分状态机)
5. [地主分配与底牌](#5-地主分配与底牌)
6. [API数据流](#6-api数据流)
7. [状态管理与变量](#7-状态管理与变量)
8. [UI变化全记录](#8-ui变化全记录)
9. [边界情况](#9-边界情况)
10. [与旧文档差异说明](#10-与旧文档差异说明)
11. [验收标准](#11-验收标准)

---

## 1. 完整流程

### 1.1 时序图

```
init()
  ├─ gameState = GAME_STATE.BIDDING
  ├─ delay 800ms (create() 末尾)
  │
  └─ startBiddingPhase()
      ├─ gameState = BIDDING
      ├─ setStatusText("叫分阶段...")
      ├─ hideActionButtons()
      │
      ├─ [API模式 + ApiClient存在]
      │   ├─ POST /api/bidding/start
      │   ├─ success → onBiddingStarted(res)
      │   └─ catch → localAssignLandlord()
      │
      ├─ [本地模式]
      │   └─ localAssignLandlord()
      │
      ├─ onBiddingStarted(res)
      │   ├─ res.turn === 0 → showBiddingUI()
      │   ├─ res.turn === 1 → setStatusText("王怼怼思考中...") → delay 1s → doAIBidding(1)
      │   └─ res.turn === 2 → setStatusText("苏甜甜思考中...") → delay 1s → doAIBidding(2)
      │
      ├─ handlePlayerBid(bid)
      │   ├─ hideBiddingUI()
      │   ├─ setStatusText("你叫了 N分/不叫")
      │   ├─ 音效: 叫分 chippsCollide / 不叫 cardSlide
      │   ├─ POST /api/bidding/place (biddingId, 0, bid)
      │   │   ├─ success → onBiddingResult(res)
      │   │   └─ catch → localAssignLandlord()
      │   └─ local模式 → localAssignLandlord()
      │
      ├─ onBiddingResult(res)
      │   ├─ phase === "done"   → finishBidding(res)
      │   ├─ phase === "redeal" → setStatusText("三家都不叫，重新发牌") → showToast → delay 1.5s → restartGame()
      │   └─ phase === "bidding"
      │       ├─ currentBidder === "ai1" → delay 1s → doAIBidding(1)
      │       ├─ currentBidder === "ai2" → delay 1s → doAIBidding(2)
      │       └─ currentBidder === "player" → showBiddingUI()
      │
      ├─ doAIBidding(aiIndex)
      │   ├─ 本地计算强度分 → 确定叫分值
      │   ├─ setStatusText("王怼怼/苏甜甜 叫了 N分/不叫")
      │   ├─ POST /api/bidding/place (biddingId, aiIndex, bid)
      │   │   ├─ success → onBiddingResult(res)
      │   │   └─ catch → localAssignLandlord()
      │   └─ local模式 → localAssignLandlord()
      │
      └─ finishBidding(res)
          ├─ landlordIndex = res.highestBidder
          ├─ isLandlord = (highestBidder === 0)
          ├─ showBottomCards(res.landlordCards)  // B38: 仅文字显示，底牌融入手牌
          ├─ 底牌加入地主手牌
          ├─ setStatusText(winnerText + " 开始出牌")
          ├─ showToast(winnerText)
          └─ delay 1.2s → gameState = PLAYER_TURN → showActionButtons() → SoundManager.playerTurn()
```

### 1.2 关键时间点

| 时间 | 动作 | 代码位置 |
|:----:|:-----|:--------:|
| T+0ms | 发牌完成，gameState = BIDDING | init() |
| T+800ms | 调用 startBiddingPhase | create() delayedCall |
| T+800+API | onBiddingStarted → 展示UI或AI思考 | startBiddingPhase .then |
| T+800+API+1000 | AI思考1秒后自动叫分 | onBiddingStarted delayedCall |
| T+1000(玩家操作后) | 玩家点击 → API → 下一个玩家或结束 | handlePlayerBid |
| T+1500(redeal) | 三家都不叫 → 重新发牌 | onBiddingResult delayedCall |
| T+1200(叫分结束) | 进入出牌阶段 | finishBidding delayedCall |

---

## 2. 叫分UI

### 2.1 按钮公式

```javascript
var bw = 96, bh = 52, gap = 12;
// ⚠️ 代码中：totalW = bw * 5 + gap * 4 = 528
var totalW = bw * 5 + gap * 4;   // = 528 (代码bug: 应该 bw*4 + gap*3 = 420)
var startX = (960 - totalW) / 2;  // = 216 (正确值应为 270)
```

**⚠️ 代码bug记录:**
- 现有代码错误地使用了 `bw * 5`（copy-paste from createActionButtons 5个按钮）
- 实际有效按钮4个，bids.length = 4
- 导致起始X从270偏移到216，整体左偏54px

**实际按钮位置 (按代码执行):**

| 按钮 | 标签 | 颜色 (hex) | X | Y | W | H | 圆角 | depth |
|:----:|:----:|:----------:|:---:|:-:|:-:|:-:|:----:|:-----:|
| 不叫 | `不叫` | `#FF6B6B` | 216 | 280 | 96 | 52 | 10 | 200 |
| 1分 | `1分` | `#4ECDC4` | 324 | 280 | 96 | 52 | 10 | 200 |
| 2分 | `2分` | `#FFD93D` | 432 | 280 | 96 | 52 | 10 | 200 |
| 3分 | `3分` | `#FF6B35` | 540 | 280 | 96 | 52 | 10 | 200 |

**按钮内文字:** fontSize 14px, color `#FFFFFF`, fontStyle bold, origin(0.5), depth 201，居中在 `(bx + bw/2, uiY + bh/2)`

### 2.2 辅助文字

| 元素 | 内容 | X | Y | fontSize | color | fontStyle | origin | depth |
|:----:|:----:|:-:|:-:|:--------:|:-----:|:---------:|:------:|:-----:|
| 提示文字 | `请叫分` | 480 | 170 | 15px | `#FFFFFF` | bold | (0.5) | 200 |
| 强度标签 | `★ 手牌很强 (强度分: N)` | 480 | 260 | 10px | `#A5D6A7` | normal | (0.5) | 200 |

**强度标签条件:** `state.handStrength !== undefined` 时才显示

**强度标签分级 (代码):**
```javascript
var label = strength >= 20 ? '手牌很强'
          : strength >= 14 ? '手牌不错'
          : strength >= 9  ? '手牌一般'
          :                  '手牌较弱';
```

### 2.3 字体规范

| 位置 | fontFamily | fontSize | color | fontStyle |
|:----|:-----------|:--------:|:-----:|:---------:|
| 提示文字 | `"PingFang SC","Microsoft YaHei",sans-serif` | 15px | `#FFFFFF` | bold |
| 按钮文字 | 同上 | 14px | `#FFFFFF` | bold |
| 强度提示 | 同上 | 10px | `#A5D6A7` | normal |

### 2.4 阴影与特效

叫分UI不使用阴影特效，纯扁平风格。

### 2.5 状态文字 (顶部)

叫分阶段顶部状态文字变化:

| 阶段 | 状态文字内容 | 触发位置 |
|:----|:-------------|:---------|
| 初始 | `` (空) → `叫分阶段...` | startBiddingPhase → self.setStatusText |
| 等API | `叫分阶段...` | startBiddingPhase |
| 玩家回合 | `叫分阶段` | onBiddingStarted |
| AI思考 | `王怼怼思考中...` / `苏甜甜思考中...` | onBiddingStarted/onBiddingResult |
| 玩家已叫 | `你叫了 不叫` / `你叫了 N分` | handlePlayerBid |
| AI已叫 | `王怼怼 叫了 N分` / `苏甜甜 叫了 N分` | doAIBidding |
| 服务异常 | `叫分服务异常，本地模式` | handlePlayerBid catch |

### 2.6 音效

| 动作 | 调用 | 音效文件 | 音量 |
|:----|:-----|:---------|:----:|
| 叫分 (1/2/3分) | `SoundManager.bid()` | chipsCollide{1-3} (随机) | 0.7 |
| 不叫 (0分) | `SoundManager.passBid()` | cardSlide{1-3} (随机) | 0.5 |

### 2.7 仅玩家可见

`showBiddingUI()` 仅在被 `onBiddingStarted/res.turn === 0` 或 `onBiddingResult/res.currentBidder === 'player'` 时调用。AI 回合时不显示按钮。

---

## 3. AI叫分策略

### 3.1 本地强度计算 (doAIBidding 内联)

```javascript
// 基于手牌统计 rank 分组
var groups = {};
for (var i = 0; i < hand.length; i++) {
  groups[hand[i].rank] = (groups[hand[i].rank] || 0) + 1;
}

// 计算强度分
var score = 0;
if (groups[14]) score += 6;   // 大王 (rank=14)
if (groups[13]) score += 4;   // 小王 (rank=13)
if (groups[12]) score += 2;   // 2   (rank=12)

for (var r in groups) {
  if (groups[r] === 4) score += 12;  // 炸弹
  else if (groups[r] === 3) score += 4;  // 三张
}
```

### 3.2 初始叫分决策

| 强度分区间 | 叫分值 | 含义 |
|:----------:|:------:|:-----|
| score ≥ 20 | 3 | 叫地主(最高分) |
| 14 ≤ score < 20 | 2 | 叫地主(中分) |
| 9 ≤ score < 14 | 1 | 叫地主(低分) |
| score < 9 | 0 | 不叫 |

### 3.3 加叫策略

```javascript
if (bid <= currentBid) {
  // 想叫的分 ≤ 当前最高 → 判断是否抢
  if (score >= 20 && currentBid < 3) {
    bid = 3;  // 手牌极强且还有余地 → 抢到3分
  } else {
    bid = 0;  // 不够格 → 不叫
  }
}
```

### 3.4 决策树

```
             ┌─────────────────┐
             │   计算强度分     │
             │  score = cal()   │
             └────────┬────────┘
                      │
              ┌───────┴───────┐
              │               │
         score≥20        score<20
              │               │
        ┌─────┴─────┐   ┌────┴────┐
        │           │   │         │
      score≥14   score<14       ┌─┴─┐
        │           │      score≥9  score<9
    bid=2      ┌────┴───┐     │       │
               │        │   bid=1   bid=0
            score≥20  score<20
            && cb<3    OR !(≥20&&cb<3)
               │           │
             bid=3       bid=0
```

其中 `cb` = `currentBid` (当前最高叫分)

### 3.5 决策示例

| 场景 | AI手牌 | 强度分 | currentBid | 初始叫分 | 是否加叫 | 最终叫分 |
|:----|:-------|:------:|:----------:|:--------:|:--------:|:--------:|
| 有大王+炸弹 | 大王+3333 | 6+12=18 | 0 | 2 | — | 2 |
| 双王+炸弹 | 大小王+4444 | 6+4+12=22 | 0 | 3 | — | 3 |
| 一般牌 | 无大牌 | 2 | 0 | 0 | — | 0 |
| 被抢地主 | 有2+333 | 2+4=6 | 2 | 0 | — | 0 |
| 好牌被抢 | 大王+AAAA | 6+12=18 | 2 | 2 | score≥20? NO | 0 |
| 极强被抢 | 双王+KKKK | 6+4+12=22 | 1 | 3 | — | 3 |
| +1分抢 | 大王+AAA | 6+4=10 | 2 | 1 | 否 | 0 |

### 3.6 本地模式 AI 响应

`doAIBidding` 中 `localAssignLandlord()` 被同时用于:
1. `startBiddingPhase` API 不可用 → 随机定地主
2. `handlePlayerBid` API 失败 → 随机定地主
3. `doAIBidding` API 失败 → 随机定地主

**注意:** 在 API 模式中，AI 的决策由服务端计算，客户端仅负责发送叫分请求和解析结果。本地强度计算仅供本地模式备用。

---

## 4. 叫分状态机

### 4.1 状态定义

```
[INIT] ──→ [BIDDING] ──→ [PLAYER_TURN]
                │
                ├─→ (cycle)  多个AI/玩家轮替
                ├─→ (redeal) 返回 INIT
                └─→ (done)   进入 PLAYER_TURN
```

**游戏状态常量:**
```javascript
var GAME_STATE = {
  INIT: 'INIT',
  BIDDING: 'BIDDING',       // 叫分阶段
  PLAYER_TURN: 'PLAYER_TURN', // 出牌阶段
  // ...
};
```

### 4.2 状态机详细流转

```
┌──────────┐
│   INIT   │  (gameState = INIT)
│  发牌完成  │
└────┬─────┘
     │ delay 800ms
     ▼
┌──────────┐     ┌─────────────────────┐
│ BIDDING  │────→│ startBiddingPhase()  │
│  叫分阶段  │     │ hideActionButtons()  │
│          │     │ POST /api/bidding     │
└──────────┘     └──────────┬────────────┘
                            │
               ┌────────────┼────────────┐
               │ API成功     │ API失败     │ 本地模式
               ▼             │             ▼
         ┌──────────┐        │    ┌───────────────┐
         │onBidding │        │    │localAssign    │
         │Started() │        │    │Landlord()     │
         └────┬─────┘        │    └───────┬───────┘
              │              │            │
      ┌───────┼───────┐      │            │
      │       │       │      │            │
      ▼       ▼       ▼      │            ▼
  turn=0   turn=1  turn=2    │   BIDDING
      │       │       │      │       │
      ▼       ▼       ▼      │       │
  showBid   AI1     AI2      │       │
  dingUI 思考1s   思考1s      │       │
      │       │       │      │       │
      ▼       ▼       ▼      │       ▼
  点击按钮  doAI    doAI      │   delay 1.2s
      │    Bid(1)  Bid(2)    │       │
      ▼       │       │      │       ▼
  handleP    │       │      │  PLAYER_TURN
  layerBid   │       │      │  showActionBtns
      │       │       │      │
      └───┬───┘       │      │
          │           │      │
          ▼           │      │
    onBiddingResult   │      │
          │           │      │
    ┌─────┼─────┐     │      │
    │     │     │     │      │
    ▼     ▼     ▼     │      │
  done  redeal bidding│      │
    │     │     │     │      │
    │     │  ┌──┘     │      │
    │     │  │        │      │
    ▼     ▼  ▼        ▼      ▼
finish  restart  循环到    PLAYER
Bidding Game     下一个    _TURN
                  玩家
```

### 4.3 轮替顺序

服务端 `onBiddingStarted(res)` 的 `res.turn` 决定第一个叫分的人:
- `turn === 0` → 玩家
- `turn === 1` → AI1 王怼怼
- `turn === 2` → AI2 苏甜甜

后续轮替由 `onBiddingResult(res.currentBidder)` 决定:
- `currentBidder === 'player'` → 轮到玩家
- `currentBidder === 'ai1'` → 轮到王怼怼 (1s延迟后)
- `currentBidder === 'ai2'` → 轮到苏甜甜 (1s延迟后)

### 4.4 叫分结束条件

| 条件 | 结果 | API字段 |
|:----|:-----|:--------|
| 有人叫3分 | 立即结束 → finishBidding | `phase === "done"` |
| 3人都叫完且无有效叫分 | 重新发牌 | `phase === "redeal"` |
| 有有效叫分且无人继续加注 | 确定地主 → finishBidding | `phase === "done"` |

---

## 5. 地主分配与底牌

### 5.1 API模式 (finishBidding)

```javascript
// 接收 res:
// { highestBidder: 0|1|2, landlordCards: [...], landlordHand: [...] }

this.landlordIndex = res.highestBidder;
this.isLandlord = (res.highestBidder === 0);
this.showBottomCards(res.landlordCards);

// 玩家是地主
if (res.highestBidder === 0 && res.landlordHand) {
  this.playerHand = res.landlordHand.map(function(c) { return new Doudizhu.Card(c.suit, c.rank); });
  this.playerHand = Doudizhu.sortCards(this.playerHand);
  this.renderPlayerHand();
}

// AI1 是地主
if (res.highestBidder === 1) {
  var bottomCards = (res.landlordCards || []).map(function(c) { return new Doudizhu.Card(c.suit, c.rank); });
  for (var i = 0; i < bottomCards.length; i++) this.ai1Hand.push(bottomCards[i]);
  this.updateAICount(1);  // ai1Count 文字更新为"剩余 20 张"
}

// AI2 是地主
if (res.highestBidder === 2) {
  var bottomCards2 = (res.landlordCards || []).map(function(c) { return new Doudizhu.Card(c.suit, c.rank); });
  for (var i = 0; i < bottomCards2.length; i++) this.ai2Hand.push(bottomCards2[i]);
  this.updateAICount(2);  // ai2Count 文字更新为"剩余 20 张"
}
```

### 5.2 本地模式 (localAssignLandlord)

```javascript
this.landlordIndex = Math.floor(Math.random() * 3);   // 0/1/2 随机
this.isLandlord = (this.landlordIndex === 0);          // 仅玩家可能是地主

// 底牌加入对应地主手牌
if (this.landlordIndex === 0) {   // 玩家是地主
  for (var i = 0; i < this.remainingCards.length; i++)
    this.playerHand.push(this.remainingCards[i]);
  this.playerHand = Doudizhu.sortCards(this.playerHand);
  this.renderPlayerHand();
} else if (this.landlordIndex === 1) {  // AI1 是地主
  for (var i = 0; i < this.remainingCards.length; i++)
    this.ai1Hand.push(this.remainingCards[i]);
  this.updateAICount(1);
} else {  // AI2 是地主
  for (var i = 0; i < this.remainingCards.length; i++)
    this.ai2Hand.push(this.remainingCards[i]);
  this.updateAICount(2);
}

this.showBottomCards(this.remainingCards);  // B38: 仅显示文字
```

**本地模式转 PLAYER_TURN:**
```javascript
this.setStatusText('开始出牌');
var self = this;
this.time.delayedCall(1200, function() {
  self.gameState = GAME_STATE.PLAYER_TURN;
  self.setStatusText('轮到你出牌（自由出牌）');
  self.showActionButtons();
});
```

### 5.3 底牌处理 (showBottomCards)

```javascript
GameScene.prototype.showBottomCards = function (cards) {
  // 清除旧图片和文字
  if (this.bottomCardImgs) { ... destroy ... }
  if (this.bottomCardText) this.bottomCardText.destroy();

  if (!cards || cards.length === 0) {
    // 无牌时显示问号
    this.bottomCardText = this.add.text(480, 72, '底牌: ? ? ?', {
      fontSize: '8px', color: '#66BB6A', alpha: 0.4
    }).setOrigin(0.5).setDepth(20);
    return;
  }
  // B38: 底牌直接融入地主手牌，不再单独展示
};
```

| 参数 | 行为 |
|:----|:-----|
| `cards = null/undefined/[]` | 显示 "底牌: ? ? ?" 在 (480,72)，8px `#66BB6A` alpha 0.4 |
| `cards = [card1, card2, card3]` | **不显示任何底牌图片** (B38设计变更) |

---

## 6. API数据流

### 6.1 POST /api/bidding/start

**函数:** `ApiClient.startBidding(hands, remaining)`

```javascript
return apiPost('/api/bidding/start', {
  playerId: 'player',
  hands: hands,       // [玩家手牌, AI1手牌, AI2手牌] 各17张
  remaining: remaining // 3张底牌
});
```

**请求体:**
```json
{
  "playerId": "player",
  "hands": [
    [{ "suit": "spade", "rank": 6 }, { "suit": "heart", "rank": 3 }, ...],
    [{ "suit": "club", "rank": 10 }, ...],
    [{ "suit": "diamond", "rank": 8 }, ...]
  ],
  "remaining": [
    { "suit": "diamond", "rank": 1 },
    { "suit": "heart", "rank": 13 },
    { "suit": "spade", "rank": 3 }
  ]
}
```

**响应 (成功):**
```json
{
  "biddingId": "bid_xxx",
  "turn": 0,
  "firstBidder": 0,
  "order": [0, 1, 2],
  "bids": [null, null, null],
  "currentBid": "waiting",
  "currentBidder": "player",
  "message": "请叫分（叫地主1/2/3分，或不叫）",
  "handStrength": 14
}
```

**响应 (失败):**
- HTTP error (4xx/5xx)
- 或 JSON 无 `turn` 字段

### 6.2 POST /api/bidding/place

**函数:** `ApiClient.placeBid(biddingId, playerIndex, bid)`

```javascript
return apiPost('/api/bidding/place', {
  biddingId: biddingId,
  playerIndex: playerIndex,
  bid: bid
});
```

**玩家叫分请求:**
```json
{
  "biddingId": "bid_xxx",
  "playerIndex": 0,
  "bid": 2
}
```

**AI叫分请求:**
```json
{
  "biddingId": "bid_xxx",
  "playerIndex": 1,
  "bid": 1
}
```

**响应 (叫分进行中 — phase=bidding):**
```json
{
  "phase": "bidding",
  "turn": 1,
  "currentBidder": "ai1",
  "bids": [2, null, null],
  "highestBid": 2,
  "highestBidder": 0,
  "landlordCards": null,
  "landlordHand": null,
  "winnerText": null,
  "message": "王怼怼思考中..."
}
```

**响应 (叫分结束 — phase=done):**
```json
{
  "phase": "done",
  "turn": null,
  "currentBidder": null,
  "bids": [2, 1, 0],
  "highestBid": 2,
  "highestBidder": 0,
  "landlordIndex": 0,
  "landlordName": "你",
  "landlordCards": [{ ... }, { ... }, { ... }],
  "landlordHand": [{ ... } x20],
  "winnerText": "你 以 2 分成为地主！",
  "message": "你 以 2 分成为地主！获得 3 张底牌"
}
```

**响应 (重新发牌 — phase=redeal):**
```json
{
  "phase": "redeal",
  "turn": null,
  "currentBidder": null,
  "bids": [0, 0, 0],
  "highestBid": 0,
  "highestBidder": -1,
  "landlordCards": null,
  "landlordHand": null,
  "winnerText": null,
  "message": "三家都不叫，重新发牌"
}
```

### 6.3 API字段映射表

| API返回字段 | 客户端用途 | 类型 |
|:------------|:----------|:----:|
| `biddingId` | 存储为 `this.biddingId`，后续placeBid使用 | string |
| `turn` | 决定谁先叫 (0=玩家, 1=AI1, 2=AI2) | number |
| `phase` | 状态流转: bidding/done/redeal | string |
| `currentBidder` | 谁该叫分: player/ai1/ai2 | string |
| `bids` | 当前叫分数组 [玩家,AI1,AI2] | array |
| `highestBid` | 当前最高叫分值 | number |
| `highestBidder` | 当前最高者索引 (0/1/2) | number |
| `handStrength` | 玩家手牌强度分 (玩家可见) | number |
| `landlordCards` | 3张底牌 | array |
| `landlordHand` | 地主完整20张手牌 | array |
| `winnerText` | 显示文字: "你 以 N 分成为地主！" | string |

### 6.4 API异常回退链

```
startBidding API
  ├─ success → onBiddingStarted
  └─ catch → localAssignLandlord()   ← 异常回退

handlePlayerBid API
  ├─ success → onBiddingResult
  └─ catch → localAssignLandlord()   ← 异常回退

doAIBidding API
  ├─ success → onBiddingResult
  └─ catch → localAssignLandlord()   ← 异常回退
```

**任何API调用失败**（无论HTTP错误、网络超时、JSON解析失败）都回退到 `localAssignLandlord()`。

---

## 7. 状态管理与变量

### 7.1 GameScene 属性

| 属性 | 类型 | 初始值 | 设置位置 | 用途 |
|:----|:----:|:------:|:---------|:-----|
| `gameState` | string | `INIT` | init → BIDDING | 游戏阶段控制 |
| `biddingState` | object | null | onBiddingStarted | API返回的完整叫分状态 |
| `biddingId` | string | null | onBiddingStarted | 当前叫分会话ID |
| `biddingUI` | array | [] | 多处 | 叫分UI元素集合 |
| `landlordIndex` | number | -1 | finishBidding/local | 地主玩家索引 (0/1/2) |
| `isLandlord` | boolean | false | finishBidding/local | 玩家是否为地主 |
| `round` | number | 1 | init | 当前回合数 |
| `maxRounds` | number | 10 | GameScene构造函数 | 最大回合数 |
| `isAPIMode` | boolean | true | checkAPIConnection | 是否走API |
| `playerHand` | array | [] | init | 玩家17→20张手牌 |
| `ai1Hand` | array | [] | init | AI1 17→20张手牌 |
| `ai2Hand` | array | [] | init | AI2 17→20张手牌 |
| `remainingCards` | array | [] | init | 3张底牌 (叫分前) |
| `bottomCardImgs` | array | [] | — | 底牌图片引用 (旧版兼容) |
| `bottomCardText` | Text | null | showBottomCards | 底牌文字 "底牌: ? ? ?" |
| `statusText` | Text | — | createTopBar | 顶部状态文字 |
| `actionButtons` | array | [] | createActionButtons | 底部5功能按钮 |

### 7.2 全局常量

```javascript
var GAME_STATE = {
  INIT: 'INIT',
  BIDDING: 'BIDDING',
  PLAYER_TURN: 'PLAYER_TURN',
  VALIDATING: 'VALIDATING',
  WAITING_AI: 'WAITING_AI',
  ROUND_END: 'ROUND_END',
  CHAOS_MODE: 'CHAOS_MODE'
};
```

---

## 8. UI变化全记录

### 8.1 叫分开始前 (发牌完成)

```
┌────────────────────────────────────────────────────────────┐
│ 第 1/10 回合   [王怼怼]剩余17张   叫分阶段...  [苏甜甜]剩余17张 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                        底牌: ? ? ?                          │
│                      (460,60) 8px #66BB6A                  │
│                                                            │
│    [ 出牌区 — 半透明背景，无出牌内容 ]                         │
│                                                            │
│    [ 手牌区 — 17张牌已渲染 ]                                  │
│                                                            │
│    [功能按钮 — 被隐藏 (hideActionButtons) ]                   │
└────────────────────────────────────────────────────────────┘
```

### 8.2 轮到玩家叫分 (showBiddingUI)

```
┌────────────────────────────────────────────────────────────┐
│ 第 1/10 回合   [王怼怼]剩余17张   叫分阶段    [苏甜甜]剩余17张   │
├────────────────────────────────────────────────────────────┤
│                     请叫分 (480,170)                       │
│                       15px #FFFFFF bold                    │
│                                                            │
│                        ★ 手牌很强 (强度分: 14)              │
│                          (480,260) 10px #A5D6A7            │
│                                                            │
│    ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                    │
│    │ 不叫  │ │ 1分  │ │ 2分  │ │ 3分  │  ← Y=280         │
│    │FF6B6B│ │4ECDC4│ │FFD93D│ │FF6B35│                    │
│    └──────┘ └──────┘ └──────┘ └──────┘                    │
│     216      324      432      540                         │
│                                                            │
│    [手牌区 — 手牌可见但不可点击，手指点击显示Toast]              │
└────────────────────────────────────────────────────────────┘
```

### 8.3 AI思考中

```
┌────────────────────────────────────────────────────────────┐
│ 第 1/10 回合   [王怼怼]剩余17张  王怼怼思考中...  [苏甜甜]剩余17张 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                        [叫分UI已隐藏]                       │
│                                                            │
│    [出牌区 — 空白]                                         │
│                                                            │
│    [手牌区 — 可见]                                         │
└────────────────────────────────────────────────────────────┘
```

### 8.4 叫分结束 → 出牌

```
┌────────────────────────────────────────────────────────────┐
│ 第 1/10 回合   [王怼怼]剩余20张  你以2分成为地主！ [苏甜甜]剩余17张│
├────────────────────────────────────────────────────────────┤
│                                                       底牌 │
│          [AI1出牌位置]     [AI2出牌位置]                     │
│                                                            │
│          [玩家出牌位置 — 空]                                 │
│                                                            │
│    [手牌区 — 20张 (地主底牌已融入)]                          │
│                                                            │
│  [出牌] [提示] [不出] [搞事情] [底牌查看]  ← showActionButtons │
└────────────────────────────────────────────────────────────┘
```

### 8.5 三家都不叫 (redeal)

```
┌────────────────────────────────────────────────────────────┐
│ 第 1/10 回合   [王怼怼]剩余17张  三家都不叫，重新发牌  [苏甜甜]剩余17张 │
├────────────────────────────────────────────────────────────┤
│                      Toast: "重新发牌..."                   │
│                      (200,206) 200×38                     │
│                                                            │
│  delay 1500ms → scene.restart() → 回到 INIT 重新发牌        │
└────────────────────────────────────────────────────────────┘
```

### 8.6 UI状态清单

| 阶段 | 功能按钮 | 叫分按钮 | 状态文字 | 手牌 | 底牌文字 |
|:----|:--------:|:--------:|:---------|:---:|:--------:|
| init完成 | 隐藏 | 隐藏 | `叫分阶段...` | 渲染17张 | (460,60) 底牌: ? ? ? |
| API等待中 | 隐藏 | 隐藏 | `叫分阶段...` | 显示 | (460,60) |
| 玩家回合 | 隐藏 | 显示4个 | `叫分阶段` | 显示 [强度提示] | (460,60) |
| 玩家已叫 | 隐藏 | 已销毁 | `你叫了 N分/不叫` | 显示 | (460,60) |
| AI思考中 | 隐藏 | 隐藏 | `王怼怼/苏甜甜思考中...` | 显示 | (460,60) |
| AI已叫 | 隐藏 | 隐藏 | `王怼怼/苏甜甜 叫了 N分/不叫` | 显示 | (460,60) |
| 叫分结束(done) | 延迟1.2s显示 | 已销毁 | `winnerText 开始出牌` | 地主20张 | B38: 不展示 |
| redeal | 隐藏 | 已销毁 | 三家都不叫 | 暂不操作 | 无 |
| 本地模式 | 延迟1.2s显示 | 已销毁 | `开始出牌` | 地主20张 | B38: 不展示 |

---

## 9. 边界情况

### 9.1 redeal — 三家都不叫

| 属性 | 值 |
|:----|:-----|
| 触发 | `res.phase === 'redeal'` |
| 状态文字 | `三家都不叫，重新发牌` |
| Toast | `重新发牌...`, 1.2s后自动销毁 |
| 延迟 | 1500ms → `restartGame()` |
| 效果 | `hideBiddingUI()` → `scene.restart()` → init()重新发牌 |

### 9.2 API异常全场景

| 场景 | catch 行为 | 后续 |
|:----|:-----------|:------|
| `startBidding` 网络错误 | `localAssignLandlord()` | 随机定地主 |
| `startBidding` HTTP 500 | `localAssignLandlord()` | 随机定地主 |
| `startBidding` 超时 | `localAssignLandlord()` | 随机定地主 |
| `placeBid` (玩家) 失败 | `localAssignLandlord()` | 随机定地主 |
| `placeBid` (AI) 失败 | `localAssignLandlord()` | 随机定地主 |
| ApiClient 未定义 | `isAPIMode` 检查 → 本地模式 | `startBiddingPhase` 直接走else |
| 服务端phase未知 | 无处理 (不会被调用) | — |

### 9.3 手牌与底牌

| 场景 | 处理 |
|:----|:------|
| 玩家是地主 + API | `res.landlordHand` 直接替换 playerHand (20张完整排序) |
| 玩家是地主 + 本地 | playerHand.push(remainingCards) + sortCards |
| AI是地主 + API | ai1Hand.push(bottomCards) 或 ai2Hand.push(bottomCards) |
| AI是地主 + 本地 | ai1Hand.push(remainingCards) 或 ai2Hand.push(remainingCards) |
| 底牌传入null | showBottomCards → 显示 "底牌: ? ? ?" |
| 底牌是空数组 [] | showBottomCards → 显示 "底牌: ? ? ?" (length===0判定) |
| 地主底牌已融入 | B38: 不产生新的牌面图片 |

### 9.4 回合

| 特性 | 值 |
|:----|:-----|
| 初始回合 | `this.round = 1` |
| 最大回合 | `this.maxRounds = 10` (构造函数中设置) |
| 显示 | 状态栏 `第 X/10 回合`, (12, 9), 12px, `#E8F5E9` bold |

### 9.5 叫分中手牌点击

叫分阶段 `gameState === GAME_STATE.BIDDING`，手牌的 pointerdown 回调检查:

```javascript
if (self.gameState !== GAME_STATE.PLAYER_TURN) {
  showToast(self, '现在不是你的出牌阶段');
  return;
}
```

由于 `BIDDING !== PLAYER_TURN`，点击手牌会显示 Toast "现在不是你的出牌阶段"，**手牌不可选中**。

---

## 10. 与旧文档差异说明

### 10.1 代码与旧 Bidding.md 的不一致

| # | 旧 Bidding.md | 代码实际值 | 说明 |
|:-:|:--------------|:-----------|:-----|
| 1 | 按钮起始X=270 | **216** | 代码用 `totalW = bw*5 + gap*4 = 528` 而非 `bw*4 + gap*3 = 420`。bug导致偏左54px |
| 2 | 不叫按钮X=270 | **216** | 同上 |
| 3 | 1分按钮X=378 | **324** | 同上 |
| 4 | 2分按钮X=486 | **432** | 同上 |
| 5 | 3分按钮X=594 | **540** | 同上 |
| 6 | 本地叫分API | 代码中 `doAIBidding` 有本地强度计算，但最终仍走 `localAssignLandlord` | API模式下AI策略由服务端决定 |
| 7 | B38底牌处理 | 底牌文字(480,72) 带 origin(0.5)，不再显示牌背图 | 代码中 `showBottomCards` 直接return |
| 8 | 强度标签分级 | 代码中 `strength >= 20` → 很强, `>= 14` → 不错, `>= 9` → 一般, `< 9` → 较弱 | 阈值与旧文档一致 |

### 10.2 已知bug汇总

| Bug | 位置 | 影响 | 修复建议 |
|:----|:-----|:-----|:---------|
| `totalW = bw * 5 + gap * 4` | showBiddingUI 第12行 | 按钮整体左偏54px | 改为 `bw * 4 + gap * 3` |
| `showBottomCards` 在 `localAssignLandlord` | localAssignLandlord 末尾 | 底牌不显示牌面 (B38)，但传入 `remainingCards` 数组 | 确认当前行为是否需要展示牌面 |

---

## 11. 验收标准

### 11.1 UI验收

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| B1 | 发牌后800ms进入叫分阶段 | 功能按钮隐藏，状态栏显示"叫分阶段..." | create() |
| B2 | 轮到玩家叫分时 | 显示4个叫分按钮 + "请叫分"文字 + 强度提示 | showBiddingUI |
| B3 | 按钮位置精确 | 不叫(216,280), 1分(324,280), 2分(432,280), 3分(540,280), 96×52 | showBiddingUI |
| B4 | 按钮颜色正确 | 不叫 #FF6B6B, 1分 #4ECDC4, 2分 #FFD93D, 3分 #FF6B35 | showBiddingUI |
| B5 | 按钮文字14px白色bold | 按钮内居中 | showBiddingUI |
| B6 | "请叫分" 在 (480,170), 15px | 白色bold, origin(0.5) | showBiddingUI |
| B7 | 强度提示 (480,260), 10px | "★ 手牌很强 (强度分: N)", #A5D6A7 | showBiddingUI |
| B8 | 点击"不叫" → UI销毁 + 状态文字更新 | "你叫了 不叫", 播放passBid音效 | handlePlayerBid |
| B9 | 点击"1/2/3分" → UI销毁 + 状态文字更新 | "你叫了 N分", 播放bid音效 | handlePlayerBid |
| B10 | AI思考时 | 状态栏 "王怼怼/苏甜甜思考中..." | onBiddingStarted/Result |

### 11.2 状态流转验收

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| S1 | API模式: 服务端返回turn=0 | 显示玩家叫分UI | onBiddingStarted |
| S2 | API模式: 服务端返回turn=1 | 自动触发AI1思考(delay 1s) | onBiddingStarted |
| S3 | API模式: 服务端返回turn=2 | 自动触发AI2思考(delay 1s) | onBiddingStarted |
| S4 | 玩家叫分后API返回phase=bidding | 下一个AI自动思考 | onBiddingResult |
| S5 | 最终phase=done | 显示底牌→底牌加入地主→1.2s后进入出牌 | finishBidding |
| S6 | 三家都不叫phase=redeal | Toast "重新发牌..." → 1.5s后restart | onBiddingResult |
| S7 | 叫分结束进入PLAYER_TURN | 功能按钮恢复显示 | finishBidding |
| S8 | API异常 (端口不通) | 自动回退本地模式，随机定地主 | 3处catch |
| S9 | 本地模式随机定地主 | 底牌直接融入 hand, 1.2s后出牌 | localAssignLandlord |

### 11.3 AI策略验收

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| A1 | AI1叫分 | 1s延迟后自动触发 doAIBidding(1) | onBiddingStarted |
| A2 | AI2叫分 | 1s延迟后自动触发 doAIBidding(2) | onBiddingStarted |
| A3 | AI强度分≥20 | 叫3分 | doAIBidding |
| A4 | AI强度分14~19 | 叫2分 | doAIBidding |
| A5 | AI强度分9~13 | 叫1分 | doAIBidding |
| A6 | AI强度分<9 | 不叫 | doAIBidding |
| A7 | AI想叫的分≤当前最高且强度<20 | 放弃(不叫) | doAIBidding |
| A8 | AI强度≥20且当前最高<3 | 抢到3分 | doAIBidding |

### 11.4 地主分配验收

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| L1 | 玩家是地主 | 手牌20张，renderPlayerHand更新 | finishBidding |
| L2 | AI1是地主 | ai1Count 更新为 "剩余 20 张" | finishBidding |
| L3 | AI2是地主 | ai2Count 更新为 "剩余 20 张" | finishBidding |
| L4 | 底牌属地主 | 地主手牌包含3张新牌 | finishBidding/local |
| L5 | 底牌不显示牌面(B38) | 功能按钮"底牌查看"仅显示文字 | showBottomCards |

### 11.5 边界验收

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| E1 | 叫分阶段点手牌 | Toast "现在不是你的出牌阶段" | renderPlayerHand |
| E2 | API失败 | 回退本地模式，随机定地主 | 3处catch |
| E3 | redeal后重新发牌 | scene.restart() → 全新一局 | restartGame |
| E4 | 底牌为null/空 | 显示 "底牌: ? ? ?" (480,72) | showBottomCards |

---

## 附录: 函数索引

| 函数 | 行号 | 功能 | 关键参数 |
|:----|:----:|:-----|:---------|
| `startBiddingPhase()` | ~482 | 开始叫分阶段 | gameState=BIDDING, hideActionButtons |
| `onBiddingStarted(res)` | ~508 | API返回后调度 | res.turn决定谁先叫 |
| `showBiddingUI()` | ~530 | 显示4个叫分按钮 | Y=280, bw=96, bh=52 |
| `hideBiddingUI()` | ~578 | 销毁叫分UI | 遍历 biddingUI destroy |
| `handlePlayerBid(bid)` | ~582 | 玩家点击处理 | API placeBid → 音效 |
| `onBiddingResult(res)` | ~610 | 服务端返回处理 | phase 派发 |
| `doAIBidding(aiIndex)` | ~650 | AI叫分逻辑 | 本地强度计算+API |
| `finishBidding(res)` | ~700 | 叫分结束 | 分配地主+底牌+1.2s→出牌 |
| `localAssignLandlord()` | ~860 | 本地随机定地主 | Math.random()*3 |
| `showBottomCards(cards)` | ~820 | 底牌显示 | B38: 仅文字 |
| `restartGame()` | ~890 | 重新开始 | scene.restart() |
