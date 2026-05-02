# PRD: 叫分系统（Bidding Phase）

---

## 1. 概述

叫分阶段是斗地主游戏在发牌后、出牌前的关键环节，决定哪一方成为地主并获得3张底牌。本PRD覆盖完整的叫分流程、UI设计、AI逻辑、API数据流及边界情况。

**画布基准**：960×600 横屏，Phaser 3

---

## 2. 完整流程

```
发牌完成（deal）
   ↓  delay 800ms
叫分阶段开始（startBiddingPhase）
   ↓
API模式：POST /api/bidding/start
本地模式：localAssignLandlord（随机定地主）
   │
   ├─ turn === 0 ──→ 显示玩家叫分UI（showBiddingUI）
   │                   玩家点击 不叫/1分/2分/3分
   │                       ↓
   │                   POST /api/bidding/place
   │                       ↓
   │                   onBiddingResult(res)
   │
   ├─ turn === 1 ──→ AI1（王怼怼）思考1秒 → doAIBidding(1)
   │                       ↓
   │                   POST /api/bidding/place
   │                       ↓
   │                   onBiddingResult(res)
   │
   └─ turn === 2 ──→ AI2（苏甜甜）思考1秒 → doAIBidding(2)
                           ↓
                       POST /api/bidding/place
                           ↓
                       onBiddingResult(res)

onBiddingResult 派发：
   ┌─ phase === "done"   ──→ finishBidding(res) → 显示底牌 → 进入出牌
   ├─ phase === "redeal"  ──→ restartGame() → 重新发牌
   └─ phase === "bidding" ──→ 轮到下一个玩家（AI思考或玩家UI）
```

---

## 3. 叫分UI — 详细设计

### 3.1 按钮布局

按钮在 y=280 一行排列，共4个按钮。

| 按钮 | 值 | 颜色 | 坐标（矩形左上角） | 尺寸 |
|------|----|-------|-------------------|------|
| 不叫 | 0 | `#FF6B6B` (0xFF6B6B) | (270, 280) | 96×52 |
| 1分 | 1 | `#4ECDC4` (0x4ECDC4) | (378, 280) | 96×52 |
| 2分 | 2 | `#FFD93D` (0xFFD93D) | (486, 280) | 96×52 |
| 3分 | 3 | `#FF6B35` (0xFF6B35) | (594, 280) | 96×52 |

- **按钮间距**：12px（gap）
- **总宽度计算**：96×4 + 12×3 = 420px
- **起始X**：(960 − 420) / 2 = **270**
- **圆角**：10px（fillRoundedRect）
- **文字**：白色 `#FFFFFF`，14px，加粗，居中对齐

### 3.2 提示文字

| 元素 | 坐标 | 样式 |
|------|------|------|
| 标题 "请叫分" | (480, 170) | 白 #FFFFFF, 15px, 加粗, origin(0.5) |
| 手牌强度提示 | (480, 260) | 绿 #A5D6A7, 10px, origin(0.5) |

手牌强度分级（API返回 `handStrength`）：

| 分数区间 | 标签 | 表情 |
|----------|------|------|
| ≥20 | 手牌很强 | ★ |
| ≥14 | 手牌不错 | ★ |
| ≥9 | 手牌一般 | ★ |
| <9 | 手牌较弱 | ★ |

### 3.3 音效

| 动作 | 音效 |
|------|------|
| 叫分（1/2/3分） | `chipsCollide` (随机1~3) |
| 不叫 | `cardSlide` (随机1~3) |

---

## 4. AI叫分逻辑

### 4.1 本地模式（doAIBidding）

**手牌强度计算（executeAIBidding/local模式）**：

```
score = 0
if hand 中有大王(rank=14): score += 6
if hand 中有小王(rank=13): score += 4
if hand 中有2   (rank=12): score += 2
for 每组 rank:
  if count == 4: score += 12  (炸弹)
  if count == 3: score += 4   (三张)
```

**叫分决策**：

| 分数 | 叫分 | 备注 |
|------|------|------|
| ≥20 | 3分 | 手牌很强 |
| ≥14 | 2分 | 手牌不错 |
| ≥9 | 1分 | 手牌一般 |
| <9 | 0 (不叫) | 手牌较弱 |

**加叫规则**：如果 AI 想叫的分数 ≤ 当前最高叫分，则：
- 如果手牌 ≥20 且当前最高 <3 → 叫3分（抢地主）
- 否则 → 不叫

### 4.2 服务端模式（GET /api/bidding/ai）

与本地模式算法一致（`evaluateHandStrength` 函数）：

```
groups: rank → count
score:
  count===4 → +=12, hasBomb = true
  count===3 → +=4
  count===2 → +=1
  rank===14 → +=6  (大王)
  rank===13 → +=4  (小王)
  rank===12 → +=2  (2)
  rank===11 → +=1  (A)
  hasBomb → +=5
  同时有小王+大王 → +=3
```

**API返回**：`{ bid, reason, strength, handStrengthLabel }`

---

## 5. 地主分配与底牌

### 5.1 API模式（finishBidding）

1. 服务端确定 `highestBidder`（索引 0/1/2）
2. 客户端设置 `landlordIndex = res.highestBidder`
3. 客户端设置 `isLandlord = (res.highestBidder === 0)`
4. 显示底牌（showBottomCards）
5. 底牌加入地主手牌：
   - 玩家是地主 → `playerHand` 拼接底牌，重新排序并渲染
   - AI1是地主 → `ai1Hand` 拼接底牌，更新 AI1 剩余张数
   - AI2是地主 → `ai2Hand` 拼接底牌，更新 AI2 剩余张数
6. delay 1200ms → 进入出牌阶段（PLAYER_TURN）

### 5.2 本地模式（localAssignLandlord）

```
landlordIndex = Math.floor(Math.random() * 3);
isLandlord = (landlordIndex === 0);
// 底牌(remainingCards)加入对应地主手牌
showBottomCards(remainingCards);
delay 1200ms → 进入出牌阶段
```

### 5.3 底牌显示

`showBottomCards(cards)` 在本地模式下直接显示3张底牌图片。在API模式下，地主底牌直接融入手牌不再单独显示（B38特性）。

---

## 6. 回合计数器

- `this.round = 1`（初始值）
- `this.maxRounds = 10`
- 顶部状态栏显示：`第 1/10 回合`
- 达到 `maxRounds` 后游戏结束

---

## 7. 边界情况

### 7.1 三家都不叫（redeal）

触发条件：3人全部选择"不叫"（bid === 0）

流程：
```
onBiddingResult(res.phase === "redeal")
  → setStatusText("三家都不叫，重新发牌")
  → showToast("重新发牌...")
  → delay 1500ms
  → restartGame()
    → hideBiddingUI()
    → scene.restart()  → 重新走 init → create 流程
```

### 7.2 API 异常回退

任何 API 调用失败（网络错误、HTTP 错误码等）均回退到 `localAssignLandlord()`：

| 场景 | 触发条件 | 行为 |
|------|----------|------|
| `startBidding` 失败 | catch | `localAssignLandlord()` |
| `placeBid` 失败（玩家） | catch | `localAssignLandlord()` |
| `placeBid` 失败（AI） | catch | `localAssignLandlord()` |

### 7.3 叫分规则（服务端验证）

- 叫分值必须是 0/1/2/3
- 后叫者必须比当前最高分高，或选择不叫
- 叫3分直接成为地主（立即触发 `finishBidding`）
- 3人全部叫完且无有效叫分 → redeal

### 7.4 叫分顺序

随机决定先叫者，顺时针轮流：

```
firstBidder = random(0, 1, 2)
order = [firstBidder, (firstBidder+1)%3, (firstBidder+2)%3]
```

---

## 8. 数据流 —— API 契约

### 8.1 POST /api/bidding/start

**请求**：
```json
{
  "playerId": "player",
  "hands": [
    [{ "suit": "spade", "rank": 6 }, ...],  // 玩家17张手牌
    [{ "suit": "heart", "rank": 8 }, ...],  // AI1 17张手牌
    [{ "suit": "club", "rank": 10 }, ...]   // AI2 17张手牌
  ],
  "remaining": [
    { "suit": "diamond", "rank": 1 },
    { "suit": "heart", "rank": 13 },
    { "suit": "spade", "rank": 3 }
  ]
}
```

**响应**：
```json
{
  "biddingId": "bid_1680000000000_player",
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

`turn` 字段说明：

| turn | 含义 | 触发动作 |
|------|------|---------|
| 0 | 轮到玩家 | `showBiddingUI()` |
| 1 | 轮到AI1（王怼怼） | `doAIBidding(1)`，思考1秒 |
| 2 | 轮到AI2（苏甜甜） | `doAIBidding(2)`，思考1秒 |

### 8.2 POST /api/bidding/place

**请求**（玩家叫分）：
```json
{
  "biddingId": "bid_1680000000000_player",
  "playerIndex": 0,
  "bid": 2
}
```

**响应**（叫分进行中）：
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

**响应**（叫分结束）：
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
  "landlordCards": [
    { "suit": "diamond", "rank": 1 },
    { "suit": "heart", "rank": 13 },
    { "suit": "spade", "rank": 3 }
  ],
  "landlordHand": [
    { "suit": "spade", "rank": 0, "display": "3", "isRed": false },
    ...
  ],
  "winnerText": "你 以 2 分成为地主！",
  "message": "你 以 2 分成为地主！获得 3 张底牌"
}
```

**响应**（重发牌）：
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

---

## 9. 状态管理与关键字段

| 字段 | 类型 | 初始值 | 说明 |
|------|------|--------|------|
| `gameState` | string | `BIDDING` | 游戏阶段控制 |
| `biddingState` | object | `null` | API返回的完整叫分状态 |
| `biddingId` | string | `null` | 当前叫分会话ID |
| `biddingUI` | array | `[]` | 叫分UI元素集合 |
| `landlordIndex` | number | `-1` | 地主玩家索引 (0/1/2) |
| `isLandlord` | boolean | `false` | 玩家是否为地主 |
| `round` | number | `1` | 当前回合数 |
| `maxRounds` | number | `10` | 最大回合数 |
| `isAPIMode` | boolean | `true` | 是否走API |

---

## 10. 验收标准

| # | 条件 | 预期结果 | 验收方法 |
|---|------|---------|---------|
| 1 | 发牌完成 | 800ms后进入叫分阶段，状态栏显示"叫分阶段..." | 观察 |
| 2 | API在线, turn=0 | 显示4个叫分按钮 + 手牌强度提示 | 观察 |
| 3 | 点击"不叫" | 按钮消失，状态栏显示"你叫了 不叫"，播放pass音效 | 观察+听 |
| 4 | 点击"3分" | 按钮消失，直接确定地主，底牌融入地主手牌 | 观察 |
| 5 | AI叫分（turn=1或2） | AI思考1秒后自动叫分 | 观察 |
| 6 | AI叫分比当前最高分低 | AI选择不叫 | 观察 |
| 7 | 三家全不叫 | 显示"重新发牌"，1.5秒后重新开局 | 观察 |
| 8 | API异常（端口不通） | 自动回退到本地模式，随机定地主 | 断网测试 |
| 9 | 底牌加入地主手牌 | 地主手牌数变为20张，非地主保持17张 | 观察手牌数 |
| 10 | 叫分结束1200ms后 | 进入出牌阶段，显示功能按钮 | 观察 |
| 11 | 回合计数器 | 顶部显示"第 X/10 回合" | 观察 |

---

## 11. 视觉参考

```
┌──────────────────────────────────────────────────────────────┐
│  第 1/10 回合    [王怼怼头像] 剩余 17 张  状态文字    [苏甜甜头像] 剩余 17 张  │  ← 顶部状态栏 (y=0~56)
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                 底牌: ? ? ? (y=72)                            │
│                                                              │
│                    ★ 请叫分 ★ (y=170)                         │
│                                                              │
│      [出牌区]  (y=59~265)                                    │
│                                                              │
│         手牌强度提示 (y=260)                                  │
│                                                              │
│    ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                      │
│    │ 不叫  │ │ 1分  │ │ 2分  │ │ 3分  │   ← y=280          │
│    │FF6B6B│ │4ECDC4│ │FFD93D│ │FF6B35│                      │
│    └──────┘ └──────┘ └──────┘ └──────┘                      │
│     270      378      486      594                           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│   你的手牌 [  ... 17张牌 ...  ]   (手牌区 y=300~415)          │
└──────────────────────────────────────────────────────────────┘
```
