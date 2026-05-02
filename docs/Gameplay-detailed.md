# 出牌系统 (Gameplay) — 超详细设计文档

**版本:** v2.0  
**作者:** 产品经理  
**日期:** 2026-05-02  
**基准画布:** 960×600 横屏 (Phaser 3 Scale.FIT)  
**对应源码:** `src/client/js/game.js` (2897行)  
**依赖:** `src/client/js/CardEngine.js` (牌型识别/校验)  

---

## 目录

1. [状态机总览](#1-状态机总览)
2. [手牌选择交互](#2-手牌选择交互)
3. [动作按钮状态](#3-动作按钮状态)
4. [玩家出牌流程](#4-玩家出牌流程)
5. [玩家不出流程](#5-玩家不出流程)
6. [提示系统](#6-提示系统)
7. [AI回合流程](#7-ai回合流程)
8. [过牌与出牌权流转](#8-过牌与出牌权流转)
9. [出牌显示](#9-出牌显示)
10. [赢牌检测与结算](#10-赢牌检测与结算)
11. [出牌记录系统](#11-出牌记录系统)
12. [UI变化全记录](#12-ui变化全记录)
13. [边界情况](#13-边界情况)
14. [验收标准](#14-验收标准)

---

## 1. 状态机总览

### 1.1 完整状态流转

```
                    ┌──────────┐
                    │   INIT    │  scene.restart 或 浏览器刷新
                    └────┬─────┘
                         │ delay 800ms
                         ▼
                    ┌──────────┐
                    │ BIDDING  │  叫分阶段
                    └────┬─────┘
                         │ finishBidding / localAssignLandlord
                         │ delay 1200ms
                         ▼
        ┌───────────────────────────────────────┐
        │              PLAYER_TURN               │  ← 核心状态
        │  可: 出牌(doPlayerPlay)                  │
        │      提示(doHint)                        │
        │      不出(doPlayerPass)                  │
        │      搞事情(doAction)                    │
        └──────────┬───────────┬──────────────────┘
                   │           │
          doPlayerPlay │    doAction (搞事情)
                   ▼           ▼
        ┌──────────────┐  ┌─────────────┐
        │  VALIDATING   │  │ CHAOS_MODE  │  ← 搞事情遮罩层
        │  API验证牌型   │  └─────────────┘
        └──────┬───────┘       │ _destroyChaos
               │ valid         │
               ▼               ▼
        ┌──────────────┐  PLAYER_TURN
        │  WAITING_AI   │  (恢复)
        │  AI思考1.2s   │
        │  AI出牌/pass  │
        └──────┬───────┘
               │
         ┌─────┴─────┐
         │           │
    AI出牌+继续      AI手牌空
         │           │
         ▼           ▼
    WAITING_AI   ROUND_END
    或 PLAYER_    (结算面板)
    TURN
```

### 1.2 状态枚举 (代码)

```javascript
var GAME_STATE = {
  INIT: 'INIT',           // 初始/发牌
  BIDDING: 'BIDDING',     // 叫分阶段
  PLAYER_TURN: 'PLAYER_TURN', // 玩家可出牌
  VALIDATING: 'VALIDATING',   // 出牌验证
  WAITING_AI: 'WAITING_AI',   // 等待AI出牌
  ROUND_END: 'ROUND_END',     // 牌局结束
  CHAOS_MODE: 'CHAOS_MODE'    // 搞事情模式
};
```

### 1.3 关键状态变量

| 变量 | 类型 | 初始值 | 说明 |
|:----|:----:|:------:|------|
| `gameState` | string | `INIT` | 当前游戏阶段 |
| `lastPlay` | array | null | 上家出的牌组 |
| `lastPlayInfo` | object | null | 上家出牌的牌型信息 |
| `lastPlayPlayer` | string | null | `'player'`/`'ai1'`/`'ai2'` |
| `passCount` | number | 0 | 连续pass计数 (≥2时重置) |
| `selectedCards` | array | [] | 当前选中手牌索引 |
| `playerHand` | array | [] | 玩家手牌 (Card数组) |
| `ai1Hand` | array | [] | AI1王怼怼手牌 |
| `ai2Hand` | array | [] | AI2苏甜甜手牌 |
| `cardDomElements` | array | [] | 手牌图片DOM引用 |
| `totalBombs` | number | 0 | 炸弹累计 (影响结算) |
| `playHistory` | array | [] | 出牌记录 (max 8条) |

---

## 2. 手牌选择交互

### 2.1 手牌渲染 (renderPlayerHand)

**精确代码 (renderPlayerHand, ~408-460):**

```javascript
var n = hand.length, cw = 56, ch = 80;
var overlap = n > 6 ? Math.min(33, (700 - cw) / (n - 1)) : 33;
var totalWidth = cw + (n - 1) * overlap;
var startX = 180 + (700 - totalWidth) / 2;
var baseY = 345;
```

| 属性 | 值 |
|:----:|:---:|
| 牌宽 (cw) | **56 px** |
| 牌高 (ch) | **80 px** |
| 重叠量 (overlap) | **恒等于33** (n≤19时 700-56=644, 644/(n-1) > 33) |
| 底边Y (baseY) | **345** |
| 起始X | `180 + (700 - totalWidth) / 2` |
| 弧线偏移 | `(t-0.5)² × 36`, 两端比中间高**9px** |
| depth | **110** |

### 2.2 选中/取消逻辑

```
点击手牌 (pointerdown)
  │
  ├─ gameState !== PLAYER_TURN
  │   └─ showToast("现在不是你的出牌阶段") → return
  │
  ├─ 已选中 (getData('selected') === true)
  │   ├─ card.y += 16              // 复位
  │   ├─ setData('selected', false)
  │   ├─ selectedCards.splice(idx, 1)  // 从选中数组移除
  │   └─ SoundManager.deselectCard()   // cardSlide1-3, vol 0.5
  │
  └─ 未选中 (getData('selected') === false)
      ├─ card.y -= 16              // 上移16px
      ├─ setData('selected', true)
      ├─ selectedCards.push(idx)   // 加入选中数组
      └─ SoundManager.selectCard()    // cardSlide1-3, vol 0.6
```

**选中状态图示:**
```
  ╔═══════════════════╗     ║
  ║     选中牌        ║     ║  其他牌
  ║   (y-16=329)     ║     ║  (y=345)
  ╚═══════════════════╝     ║
                    ╔═══════╝
                    ║  16px差
```

### 2.3 辅助方法

```javascript
_clearCardSelection():
  // 遍历所有 cardDomElements
  // 若 selected 为 true:
  //   y = origY (复位)
  //   selected = false

_highlightCard(el):
  // el.selected = true
  // el.y = origY - 16
```

### 2.4 手牌图片管理

```javascript
// 渲染时创建
var img = self.add.image(cx, cy, key).setDisplaySize(cw, ch).setDepth(110);
img.setInteractive();
img.setData('cardIdx', ii);
img.setData('card', card);
img.setData('selected', false);
img.setData('origY', cy);
self.cardDomElements.push(img);
self.handCards.push(img);

// 重新渲染时
for (var di = 0; di < this.cardDomElements.length; di++) {
  var old = this.cardDomElements[di];
  if (old) { if (old.img) old.img.destroy(); old.destroy(); }
}
this.cardDomElements = [];
this.handCards = [];
```

---

## 3. 动作按钮状态

### 3.1 按钮创建 (createActionButtons)

```javascript
var bw = 72, bh = 48, gap = 14;
var totalW = bw * 5 + gap * 4;   // = 416
var startX = (960 - totalW) / 2; // = 272
var btnY = 442;
```

| 按钮 | 标签 | 颜色 (hex) | X | 回调函数 | 状态要求 |
|:----:|:----:|:----------:|:--:|:---------|:---------|
| 出牌 | `出牌` | `#4ECDC4` (青) | 272 | `doPlayerPlay()` | PLAYER_TURN |
| 提示 | `提示` | `#FFD93D` (黄) | 358 | `doHint()` | PLAYER_TURN |
| 不出 | `不出` | `#FF6B6B` (红) | 444 | `doPlayerPass()` | PLAYER_TURN + 有lastPlay |
| 搞事情 | `搞事情` | `#7C4DFF` (紫) | 530 | `doAction()` | PLAYER_TURN 或 CHAOS_MODE |
| 底牌查看 | `底牌查看` | `#78909C` (灰蓝) | 616 | `showBottomCards()` | 任意 |

**按钮样式:** 72×48，圆角8px，文字13px bold白色，depth 100(背景)/101(文字)

### 3.2 按钮显示/隐藏

```javascript
hideActionButtons():   // 叫分阶段、结算时调用
  for each in actionButtons: destroy()
  actionButtons = []

showActionButtons():
  hideActionButtons()
  createActionButtons(this)   // 重新创建5个按钮
```

### 3.3 不出按钮守卫

`doPlayerPass()` 入口检查:
```javascript
if (!this.lastPlay || this.lastPlay.length === 0) {
  showToast(this, '自由出牌阶段不能跳过');
  return;
}
```

**不出按钮在任何时候都可点击**, 但守卫在 `doPlayerPass` 内，自由出牌阶段会提示不能跳过。

### 3.4 出牌按钮守卫

`doPlayerPlay()` 入口检查链:
```
1. gameState !== PLAYER_TURN → Toast
2. selectedCards.length === 0 → Toast "请先选择手牌"
3. identifyType(playCards) === INVALID → Toast "非法牌型组合"
4. lastPlay存在且 canBeat === false → Toast "不能压过上家的牌"
```

---

## 4. 玩家出牌流程

### 4.1 doPlayerPlay() — 入口

```
doPlayerPlay()
  │
  ├─ [guard 1] gameState !== PLAYER_TURN → toast + return
  ├─ [guard 2] selectedCards.length === 0 → toast + return
  │
  ├─ playCards = selectedCards.map(idx => playerHand[idx])
  ├─ info = Doudizhu.identifyType(playCards)
  ├─ [guard 3] info.type === INVALID → toast + return
  │
  ├─ [guard 4] lastPlay 存在且长度>0
  │   └─ !Doudizhu.canBeat(playCards, lastPlay) → toast + return
  │
  ├─ gameState = VALIDATING
  ├─ setStatusText("验证中...")
  │
  ├─ [API模式]
  │   ├─ ApiClient.verifyPlay(playCards, lastPlay, playerHand)
  │   ├─ res.valid === true → confirmPlay(playCards, info)
  │   ├─ res.valid === false → toast(res.error) + gameState = PLAYER_TURN
  │   └─ catch → confirmPlay(playCards, info)  // 降级本地验证
  │
  └─ [本地模式] → confirmPlay(playCards, info)
```

### 4.2 confirmPlay() — 确认出牌

```
confirmPlay(playCards, info)
  │
  ├─ 构建 playSet (suit:rank → count) 用于快速匹配
  │
  ├─ 从 playerHand 移除已出牌:
  │   for j = playerHand.length-1 to 0:
  │     if match(playSet): splice(j, 1), playSet[key]--
  │
  ├─ 更新出牌状态:
  │   lastPlay = playCards
  │   lastPlayInfo = info
  │   lastPlayPlayer = 'player'
  │   passCount = 0
  │
  ├─ 视觉反馈:
  │   displayPlay(playCards, 'player')      // 出牌区显示
  │   setStatusText("已出 " + typeName)
  │   selectedCards = []
  │   renderPlayerHand()                    // 移除已出牌
  │
  ├─ 记录+音效:
  │   addPlayHistory('player', playCards)
  │   SoundManager.playCard()               // cardPlace1-3, vol 0.8
  │
  ├─ 炸弹检测:
  │   if (info.type === BOMB || ROCKET):
  │     totalBombs++
  │
  ├─ 赢牌检测:
  │   if (playerHand.length === 0):
  │     SoundManager.win()                  // cardPlace3, vol 0.9
  │     renderRoundEndPanel('player')
  │     return
  │
  └─ 切换AI回合:
      gameState = WAITING_AI
      delay 600ms → doAITurn(0)            // 轮到王怼怼
```

### 4.3 间隔时间

| 动作 | 延迟 | 说明 |
|:----|:----:|:-----|
| 玩家出牌 → AI1回合 | 600ms | confirmPlay末尾 |
| AI回合 → 下一个AI | 1200ms | handleAIPlay/localAIPlay |
| AI1过 → AI2回合 | 1200ms | handleAIPass |
| 玩家不出 → AI2回合 | 800ms | doPlayerPass |
| 两轮过 → 出牌权移交 | 800ms | doPlayerPass (玩家) |
| 两轮过 → AI出牌 | 1200ms | handleAIPass (AI) |

---

## 5. 玩家不出流程

### 5.1 doPlayerPass() — 入口

```
doPlayerPass()
  │
  ├─ [guard] gameState !== PLAYER_TURN → return (静默)
  ├─ [guard] !lastPlay || lastPlay.length === 0
  │   └─ toast("自由出牌阶段不能跳过") → return
  │
  ├─ passCount++
  ├─ showToast("不出")
  ├─ setStatusText("你选择不出")
  ├─ selectedCards = []                     // 清空选牌
  ├─ addPlayHistory('player', true)         // true=pass
  │
  ├─ [passCount >= 2] 两轮都过
  │   ├─ passCount = 0, lastPlay = null, lastPlayInfo = null
  │   ├─ 出牌权归 lastPlayPlayer
  │   │   ├─ lastPlayPlayer === 'player':
  │   │   │   gameState = PLAYER_TURN
  │   │   │   setStatusText("两家都过，轮到你自由出牌")
  │   │   │
  │   │   └─ lastPlayPlayer === 'ai1'/'ai2':
  │   │       aiIdx = (lastPlayPlayer==='ai1')?0:1
  │   │       gameState = WAITING_AI
  │   │       delay 800ms → doAITurn(aiIdx)
  │   └─ return
  │
  └─ [passCount === 1] 一轮过
      ├─ gameState = WAITING_AI
      └─ delay 800ms → doAITurn(1)   // 轮到苏甜甜
```

### 5.2 passCount 流转示意图

```
初始: passCount=0, lastPlayPlayer=null

场景A: 玩家出3 → AI1出4 → AI2不出 → 玩家不出
  passCount: 0 → (玩家出)0 → (AI1出)0 → (AI2过)1 → (玩家过)2→0
  → 两家都过 (player过+AI2过)，出牌权归 lastPlayPlayer='ai1' 王怼怼

场景B: 玩家出3 → AI1不出 → AI2不出
  passCount: 0 → (玩家出)0 → (AI1过)1 → (AI2过)2→0
  → 两家都过 (AI1过+AI2过)，出牌权归 lastPlayPlayer='player' 玩家

场景C: 玩家不出 → AI1出4 → AI2不出
  passCount: 0 → (玩家过)1 → (AI1出)0 → (AI2过)1
  → 仅AI2一轮过，轮到玩家：gameState = PLAYER_TURN
```

---

## 6. 提示系统

### 6.1 doHint() — 入口

```
doHint()
  │
  ├─ [guard] gameState !== PLAYER_TURN → return
  ├─ setStatusText("计算可出牌型...")
  │
  ├─ [API模式]
  │   ├─ ApiClient.findPlays(playerHand, lastPlay)
  │   ├─ res.total === 0 → toast("没有能出的牌") + return
  │   ├─ else:
  │   │   highlightHint(res.plays[0])
  │   │   setStatusText("提示: " + typeName + " (共N种)")
  │   └─ catch → localHint()  // 降级
  │
  └─ [本地模式] → localHint()
```

### 6.2 localHint() — 本地提示

```
localHint()
  │
  ├─ plays = Doudizhu.findValidPlays(playerHand, lastPlay)
  ├─ [plays.length === 0]:
  │   toast("没有能出的牌")
  │   setStatusText("没有能出的牌")
  │   return
  │
  ├─ hintPlay = plays[0]  // 取最弱推荐 (typeSortOrder最小)
  ├─ _clearCardSelection()
  ├─ selectedCards = []
  │
  ├─ 构建 hintRanks:
  │   for hintPlay中的每张牌: hintRanks[suit:rank] = true
  │
  ├─ 匹配并高亮:
  │   for cardDomElements:
  │     if match hintRanks: _highlightCard() + push selectedCards
  │
  └─ setStatusText("提示: " + HAND_TYPE_NAMES[info.type])
```

### 6.3 highlightHint() — API提示高亮

```javascript
highlightHint(hint):
  _clearCardSelection()
  selectedCards = []
  if (!hint.cards) return
  for cardDomElements中的每张牌:
    for hint.cards中的每张牌:
      if (suit匹配 && rank匹配):
        _highlightCard()
        selectedCards.push(idx)
        break
```

### 6.4 提示用例

| 场景 | lastPlay | 推荐策略 | 效果 |
|:----|:---------|:---------|:-----|
| 自由出牌 | null | 最小单张 (3) | 选中单张3 |
| 上家出K | [K] | 找能压过K的最小牌 (A/2/小王/大王/炸弹) | 选中A |
| 上家出顺子 | 34567 | 找能压过的最小顺子 | 选中45678 |
| 上家出炸弹 | 4个8 | 找更大炸弹或火箭 | 选中4个10或火箭 |
| 无牌可出 | — | Toast "没有能出的牌" | 状态文字更新 |

---

## 7. AI回合流程

### 7.1 doAITurn(aiIndex) — 入口

**aiIndex:** `0` = 王怼怼 (AI1), `1` = 苏甜甜 (AI2)

```
doAITurn(aiIndex)
  │
  ├─ hand = (aiIndex===0) ? ai1Hand : ai2Hand
  ├─ aiName = (aiIndex===0) ? "王怼怼" : "苏甜甜"
  │
  ├─ gameState = WAITING_AI
  ├─ setStatusText(aiName + " 思考中...")
  ├─ SoundManager.aiThink()
  │
  ├─ [手牌为空检查]
  │   if (hand.length === 0):
  │     renderRoundEndPanel('ai1'/'ai2')
  │     return
  │
  ├─ [API模式] delay 1200ms:
  │   ├─ ApiClient.aiPlay(hand, lastPlay)
  │   ├─ res.canPlay === false || !res.choice → handleAIPass(aiIndex, aiName)
  │   ├─ else → handleAIPlay(aiIndex, aiName, res)
  │   └─ catch → localAIPlay(aiIndex, aiName)
  │
  └─ [本地模式] → localAIPlay(aiIndex, aiName)
```

**API调用:** `ApiClient.aiPlay(hand, lastPlay)`  
**返回格式:**
```json
{
  "canPlay": true,
  "choice": { "cards": [{suit, rank}, ...], "typeName": "单张" }
}
// 或
{
  "canPlay": false,
  "choice": null
}
```

### 7.2 handleAIPlay() — AI出牌

```
handleAIPlay(aiIndex, aiName, res)
  │
  ├─ 匹配出牌:
  │   apiCards = res.choice.cards
  │   for apiCards中的每张牌:
  │     for hand中的每张牌:
  │       if (suit+rank匹配): push到playCards, splice移除
  │
  ├─ [匹配失败处理]:
  │   if (playCards.length !== apiCards.length):
  │     if (有部分匹配 && 部分牌型有效): 使用部分匹配
  │     else: localAIPlay(aiIndex, aiName) → return
  │
  ├─ 更新状态:
  │   lastPlay = playCards
  │   lastPlayInfo = info
  │   lastPlayPlayer = (aiIndex===0) ? 'ai1' : 'ai2'
  │   passCount = 0
  │
  ├─ 视觉反馈:
  │   displayPlay(playCards, 'ai1'/'ai2')
  │   setStatusText(aiName + " 出了 " + typeName)
  │   updateAICount(aiIndex)           // 更新顶部剩余张数
  │   addPlayHistory('ai1'/'ai2', playCards)
  │
  ├─ 气泡:
  │   bubbleKey = (炸弹/火箭) ? 'bomb' : 'play'
  │   _showPlayBubble('duidui'/'tiantian', bubbleKey, typeName)
  │
  ├─ 炸弹检测:
  │   if (BOMB/ROCKET): totalBombs++
  │
  ├─ [赢牌检测]:
  │   if (hand.length === 0):
  │     renderRoundEndPanel('ai1'/'ai2')
  │     return
  │
  └─ 下一个:
      ├─ AI1出 → delay 1200ms → doAITurn(1)  // 轮到苏甜甜
      └─ AI2出 → gameState = PLAYER_TURN
                 SoundManager.playerTurn()   // chipsCollide1-3
                 setStatusText("轮到你出牌")
```

### 7.3 handleAIPass() — AI不出

```
handleAIPass(aiIndex, aiName)
  │
  ├─ passCount++
  ├─ setStatusText(aiName + " 不出")
  ├─ updateAICount(aiIndex)
  ├─ addPlayHistory('ai1'/'ai2', true)
  ├─ _showPlayBubble('duidui'/'tiantian', 'pass', '')
  │
  ├─ [两轮都过 passCount >= 2]:
  │   ├─ passCount = 0, lastPlay = null
  │   ├─ 出牌权归 lastPlayPlayer:
  │   │   ├─ lastPlayPlayer === 'player':
  │   │   │   gameState = PLAYER_TURN
  │   │   │   setStatusText("两家都过，轮到你自由出牌")
  │   │   │
  │   │   └─ lastPlayPlayer === 'ai1'/'ai2':
  │   │       delay 1200ms → doAITurn(aiIdx)
  │   └─ return
  │
  ├─ [一轮过]:
  │   ├─ AI1过 → delay 1200ms → doAITurn(1)   // 轮到苏甜甜
  │   └─ AI2过 → gameState = PLAYER_TURN
  │              setStatusText("轮到你出牌")
  └─ return
```

### 7.4 localAIPlay() — 本地AI策略

```
localAIPlay(aiIndex, aiName)
  │
  ├─ plays = Doudizhu.findValidPlays(hand, lastPlay)
  │
  ├─ [无牌可出] → handleAIPass(aiIndex, aiName) → return
  │
  ├─ chosen = plays[0]   // typeSortOrder最小的
  │
  ├─ [自由出牌优化]:
  │   if (!lastPlay || lastPlay.length === 0):
  │     遍历 plays 找 singlePlay (length===1的第一个)
  │     if (找到): chosen = singlePlay
  │
  ├─ 从 hand 中移除 chosen 的牌 (splice)
  ├─ 更新 lastPlay/lastPlayPlayer/passCount/displayPlay
  ├─ setStatusText, updateAICount, addPlayHistory
  ├─ _showPlayBubble('duidui'/'tiantian', 'play'/'bomb', typeName)
  ├─ 炸弹检测: totalBombs++
  │
  ├─ [赢牌: hand.length === 0] → renderRoundEndPanel → return
  │
  └─ 下一个:
      ├─ AI1 → delay 1200ms → doAITurn(1)
      └─ AI2 → gameState = PLAYER_TURN, playerTurn音效
```

**AI策略优先级 (typeSortOrder):**

| 排序 | 牌型 | 说明 |
|:----:|:----:|------|
| 0 | SINGLE | 单张 (最优先出) |
| 1 | PAIR | 对子 |
| 2 | TRIPLE | 三张 |
| 3 | TRIPLE_PLUS_ONE | 三带一 |
| 4 | TRIPLE_PLUS_TWO | 三带二 |
| 5 | STRAIGHT | 顺子 |
| 6 | CONSECUTIVE_PAIRS | 连对 |
| 7 | AIRPLANE | 飞机 |
| 8 | AIRPLANE_PLUS_SINGLES | 飞机带单 |
| 9 | AIRPLANE_PLUS_PAIRS | 飞机带对 |
| 10 | FOUR_PLUS_TWO | 四带二 |
| 11 | FOUR_PLUS_TWO_PAIRS | 四带两对 |
| 12 | BOMB | 炸弹 |
| 13 | ROCKET | 火箭 |

**AI本地策略特点:**
- 自由出牌时优先出最小单张
- 接牌时选 plays[0] (type排序最小的牌型)
- 不区分手牌强弱，不主动放牌或压牌
- 简单贪心策略

---

## 8. 过牌与出牌权流转

### 8.1 完整流转图

```
假设叫分顺序: 玩家(地主) → AI1(王怼怼) → AI2(苏甜甜)

玩家出牌 → AI1 → AI2 → (循环)

玩家出牌 (lastPlayPlayer='player', passCount=0)
  │
  ├─ AI1出牌 (lastPlayPlayer='ai1', passCount=0)
  │   └─ AI2出牌 (lastPlayPlayer='ai2', passCount=0)
  │       └─ 玩家出牌 (循环)
  │
  ├─ AI1过 (passCount=1)
  │   └─ AI2出牌 (passCount=0)
  │       └─ 玩家出牌
  │
  ├─ AI1过 (passCount=1)
  │   └─ AI2过 (passCount=2→0, lastPlayPlayer='player')
  │       └─ 玩家自由出牌 (reset)
  │
  └─ AI1出牌 (passCount=0)
      └─ AI2过 (passCount=1)
          └─ 玩家过 (passCount=2→0, lastPlayPlayer='ai1')
              └─ AI1自由出牌 (reset)
```

### 8.2 passCount 计数谁

`passCount` 记录**连续pass**的次数：
- 每次有人**出牌** → passCount = 0
- 每次有人**不出** → passCount++
- passCount ≥ 2 → 重置 (两轮都过)

### 8.3 出牌权 (lastPlayPlayer)

**规则:** 两轮都过后，上一轮**最后出牌的人**获得自由出牌权。

```javascript
if (passCount >= 2) {
  passCount = 0;
  lastPlay = null;  // 清除上家牌
  // 出牌权归 lastPlayPlayer
}
```

### 8.4 7种流转路径

| # | 路径 | 时间 | 过程 |
|:-:|:-----|:----:|:-----|
| 1 | 玩家→AI1→AI2→玩家(循环) | 600+1200+0ms | 正常循环出牌 |
| 2 | 玩家→AI1过→AI2→玩家 | 600+1200+0ms | AI1pass |
| 3 | 玩家→AI1→AI2过→玩家 | 600+1200+0ms | AI2pass → 玩家回合 |
| 4 | 玩家→AI1过→AI2过→玩家自由出牌 | 600+1200+800ms | 两AI都过 |
| 5 | 玩家过→AI1→AI2→玩家 | 800+1200+0ms | 玩家pass |
| 6 | 玩家过→AI1过→AI2过→AI1自由出牌 | 800+1200+1200ms | 玩家+AI1过, 归AI1 |
| 7 | 玩家出牌→AI1→AI2过→玩家过→AI1自由出牌 | 600+1200+0+800ms | 2轮不同pass源 |

### 8.5 流转时间汇总

| 起点 | 终点 | 延迟 | 代码位置 |
|:----|:-----|:----:|:---------|
| 玩家出牌 | AI1 (doAITurn(0)) | 600ms | confirmPlay |
| 玩家不出(1次) | AI2 (doAITurn(1)) | 800ms | doPlayerPass |
| 玩家不出(2次) | lastPlayPlayer (出牌权者) | 800ms | doPlayerPass |
| AI出牌 | 下一个AI/玩家 | 1200ms | handleAIPlay/localAIPlay |
| AI不出(1次) | 下一个AI/玩家 | 1200ms | handleAIPass |
| AI不出(2次) | lastPlayPlayer (出牌权者) | 1200ms | handleAIPass |

---

## 9. 出牌显示

### 9.1 displayPlay(cards, player) — 精确坐标

```javascript
var positions = {
  player: { x: 360, y: 195, w: 50, h: 72, origin: 0.5 },
  ai1:    { x: 280, y: 133, w: 42, h: 60, origin: 0.5 },
  ai2:    { x: 680, y: 133, w: 42, h: 60, origin: 0.5 }
};
```

| 角色 | 中心X | Y | 牌宽 | 牌高 | depth |
|:----:|:-----:|:-:|:----:|:----:|:-----:|
| 玩家 | 360 | 195 | 50 | 72 | 21 |
| 王怼怼 (AI1) | 280 | 133 | 42 | 60 | 21 |
| 苏甜甜 (AI2) | 680 | 133 | 42 | 60 | 21 |

### 9.2 重叠量公式

```javascript
var overlap = Math.min(pos.w * 0.6, (480 - pos.w) / Math.max(n - 1, 1));
```

| 玩家 | w×0.6 | 上限值 (单张时) | 单张 / 4张 / 多张 |
|:----:|:-----:|:---------------:|:----------------:|
| 玩家 | 30 | ∞ (n=1) | 单张=any, 4张=min(30, 143..) |
| AI | 25.2 | ∞ (n=1) | 同左 |

### 9.3 起始X计算

```javascript
var totalW = pos.w + (n - 1) * overlap;
var startX = pos.x - totalW / 2;
```

### 9.4 清理逻辑

`displayPlay` 每次调用先销毁旧的出牌图片数组:
```javascript
var gfxKey = player === 'player' ? 'myPlayCardsGfx' :
             (player === 'ai1' ? 'ai1PlayCardsGfx' : 'ai2PlayCardsGfx');
var oldGfx = this[gfxKey];
if (oldGfx) {
  for (var gi = 0; gi < oldGfx.length; gi++) oldGfx[gi].destroy();
}
this[gfxKey] = [];
```

---

## 10. 赢牌检测与结算

### 10.1 检测时机 (6处)

| 触发函数 | 条件 | 调用 |
|:---------|:----|:-----|
| `confirmPlay()` | `playerHand.length === 0` | `renderRoundEndPanel('player')` |
| `doAITurn()` | `hand.length === 0` (入口检查) | `renderRoundEndPanel('ai1'/'ai2')` |
| `handleAIPlay()` | `hand.length === 0` (出牌后) | `renderRoundEndPanel('ai1'/'ai2')` |
| `localAIPlay()` | `hand.length === 0` (出牌后) | `renderRoundEndPanel('ai1'/'ai2')` |
| `handleAIPass()` | 无直接检查 (pass不会导致手牌空) | — |
| `doPlayerPass()` | 无直接检查 | — |

### 10.2 renderRoundEndPanel(winner)

**winner 参数:** `'player'` | `'ai1'` | `'ai2'`

**状态设置:**
```javascript
this.gameState = GAME_STATE.ROUND_END;
```

**结算面板结构详见 `Layout-detailed.md` 第11章**, 核心参数:

| 元素 | 位置 | 尺寸 |
|:----|:-----|:-----|
| 半透明遮罩 | (0,0) | 960×600 |
| 结算卡片 | (200,60) | 560×480 |
| 得分子面板 | (240,142) | 480×260 |

**计分公式 (代码):**
```javascript
var baseScore = self.isLandlord ? 30 : 20;
var bombMult = self.totalBombs || 0;
var chaosScore = self.chaosScore || 0;
var chaosBonus = chaosScore * 10;
var remainingCards = (对手剩余手牌之和);
var handBonus = remainingCards * 2;
var subTotal = baseScore + chaosBonus + handBonus;
var multiplier = Math.pow(2, bombMult);
var totalScore = subTotal * multiplier;
```

**动画序列:**
| 时间 | 动作 |
|:----:|:-----|
| 0ms | 遮罩淡入 (300ms) |
| 300ms | 卡片+得分面板淡入 |
| 400ms | 标题弹入 scale 0.3→1.0 (Back.easeOut) |
| 700ms | 总得分+分隔线淡入 |
| 900+n×150ms | 各细项逐行淡入 |
| 1500ms | 分隔线2淡入 |
| 1600ms | 用时文字淡入 |
| 1800ms | 两个按钮淡入 |

---

## 11. 出牌记录系统

### 11.1 创建 (createPlayHistoryArea)

```javascript
// 右上角面板
var bg = scene.add.graphics();
bg.fillStyle(0x000000, 0.2);
bg.fillRoundedRect(800, 60, 150, 140, 6).setDepth(200);

// 标题
scene.add.text(808, 65, '出牌', {
  fontSize: '9px', color: '#81C784'  // depth 201
});

// 内容区域
scene.playHistoryText = scene.add.text(808, 76, '', {
  fontSize: '9px', color: '#C8E6C9',
  lineSpacing: 3, wordWrap: { width: 135 }  // depth 201
});
```

| 属性 | 值 |
|:----:|:---:|
| 面板位置 | (800, 60) w=150 h=140 |
| 面板圆角 | 6px |
| 标题 | (808, 65) 9px `#81C784` |
| 内容 | (808, 76) 9px `#C8E6C9`, lineSpacing 3, wordWrap 135px |
| depth | 200(背景) / 201(文字) |

### 11.2 添加记录 (addPlayHistory)

```javascript
addPlayHistory(player, cardsOrPass):
  labels = { player: '你', ai1: '王怼怼', ai2: '苏甜甜' }
  
  if (cardsOrPass === true):
    // 不出
    entry = { text: '王怼怼: 不出', pass: true }
  else if (cardsOrPass.length > 0):
    // 出牌
    display = cardsOrPass.map(c => RANK_NAME_MAP[c.rank]).join(' ')
    entry = { text: '你: 3 4 5 6 7', cards: cardsOrPass }
  else: return  // 空记录忽略
  
  playHistory.push(entry)
  if (playHistory.length > 8):
    playHistory = playHistory.slice(-8)  // 保留最近8条
  
  renderPlayHistory()
```

**显示规则:** 从 `Math.max(0, length-6)` 开始显示最近6条。

**牌面名映射 (RANK_NAME_MAP):**
```
0:'3' 1:'4' 2:'5' 3:'6' 4:'7' 5:'8' 6:'9'
7:'10' 8:'J' 9:'Q' 10:'K' 11:'A' 12:'2' 13:'小王' 14:'大王'
```

**示例显示:**
```
你: 3 4 5 6 7
王怼怼: 不出
苏甜甜: K
你: A
王怼怼: 不出
苏甜甜: 2
```

---

## 12. UI变化全记录

### 12.1 叫分结束 → 出牌阶段

```
┌──────────────────────────────────────────────────────────────┐
│ 第1/10回 [王怼怼]剩余20张 轮到你出牌（自由出牌） [苏甜甜]剩余17张  │
├──────────────────────────────────────────────────────────────┤
│                       底牌: ? ? ?                             │
│                                                              │
│      [出牌区 — 空]             出牌记录面板 (800,60)           │
│                                                              │
│      [手牌区 — 20张/17张]                                     │
│                                                              │
│  [出牌] [提示] [不出] [搞事情] [底牌查看]                       │
└──────────────────────────────────────────────────────────────┘
```

### 12.2 玩家出牌后

```
┌──────────────────────────────────────────────────────────────┐
│ 第1/10回 [王怼怼]剩余20张 已出 顺子  [苏甜甜]剩余17张            │
├──────────────────────────────────────────────────────────────┤
│                      底牌: ? ? ?                              │
│                                                              │
│    你: ┌3┐┌4┐┌5┐┌6┐┌7┐   你: 3 4 5 6 7                      │
│         (360,195)                                            │
│                                                              │
│      [手牌 — 已移除出的牌]                                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 12.3 AI思考中

```
┌──────────────────────────────────────────────────────────────┐
│ 第1/10回 [王怼怼]剩余20张 王怼怼思考中... [苏甜甜]剩余17张       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│    你: ┌3┐┌4┐┌5┐┌6┐┌7┐                                     │
│                                                              │
│      [手牌 — 不可点击]                                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 12.4 AI出牌后

```
┌──────────────────────────────────────────────────────────────┐
│ 第1/10回 [王怼怼]剩余19张 王怼怼出了 对子 [苏甜甜]剩余17张       │
├──────────────────────────────────────────────────────────────┤
│      王怼怼: ┌K┐┌K┐                                         │
│           (280,133)                                          │
│    你: ┌3┐┌4┐┌5┐┌6┐┌7┐                                     │
│                                                              │
│      [手牌]                                                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 12.5 两轮都过 (玩家pass+AI1pass)

```
┌──────────────────────────────────────────────────────────────┐
│ 第1/10回 [王怼怼]剩余19张 两家都过，轮到苏甜甜 [苏甜甜]剩余17张  │
├──────────────────────────────────────────────────────────────┤
│                        [出牌区清空]                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 12.6 win检测 → 结算

```
┌──────────────────────────────────────────────────────────────┐
│              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                │
│              ▓    🎉 你赢了！         ▓                        │
│              ▓    [总分: +184]        ▓                        │
│              ▓                        ▓                        │
│              ▓  ★ 基础底分 +30        ▓                        │
│              ▓  🧨 炸弹翻倍 ×4 (2个)  ▓                        │
│              ▓  🔥 搞事情得分 +50     ▓                        │
│              ▓  🃏 手牌奖励 +12       ▓                        │
│              ▓                        ▓                        │
│              ▓  [🔄 再来一局] [🏠 返回]▓                        │
│              ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                │
└──────────────────────────────────────────────────────────────┘
```

---

## 13. 边界情况

### 13.1 非法操作全表

| 操作 | 检查位置 | 结果 |
|:----|:---------|:-----|
| 非PLAYER_TURN时点手牌 | renderPlayerHand pointerdown | Toast "现在不是你的出牌阶段" |
| 未选牌点"出牌" | doPlayerPlay | Toast "请先选择手牌" |
| 非法牌型点"出牌" | doPlayerPlay → identifyType(INVALID) | Toast "非法牌型组合" |
| 不能压过上家点"出牌" | doPlayerPlay → canBeat(false) | Toast "不能压过上家的牌" |
| 自由出牌阶段点"不出" | doPlayerPass → !lastPlay | Toast "自由出牌阶段不能跳过" |
| API验证不通过 | doPlayerPlay → res.valid=false | Toast res.error, 恢复PLAYER_TURN |
| BIDDING/WAITING_AI时点动作按钮 | doPlayerPlay 等守卫 | 静默return |

### 13.2 API异常降级

| API函数 | 降级行为 |
|:--------|:---------|
| `ApiClient.verifyPlay` | 直接调用 `confirmPlay` (本地验证) |
| `ApiClient.findPlays` | 调用 `localHint()` |
| `ApiClient.aiPlay` | 调用 `localAIPlay()` |

### 13.3 AI出牌匹配失败

`handleAIPlay` 中的匹配失败处理:

```javascript
if (playCards.length !== apiCards.length) {
  if (playCards.length > 0) {
    var partialInfo = Doudizhu.identifyType(playCards);
    if (partialInfo.type !== 'INVALID') {
      // 使用部分匹配 (控制台警告)
    } else {
      localAIPlay(aiIndex, aiName); // 降级
      return;
    }
  } else {
    localAIPlay(aiIndex, aiName); // 降级
    return;
  }
}
```

### 13.4 炸弹累计

```javascript
if (info.type === 'BOMB' || info.type === 'ROCKET') this.totalBombs++;
```

炸弹累计在3处: `confirmPlay`, `handleAIPlay`, `localAIPlay`

`totalBombs` 在 `init()` 中初始化为0:
```javascript
this.totalBombs = 0;
```

**炸弹统计范围:** 仅统计本局中所有玩家(玩家+AI1+AI2)打出的炸弹和火箭总数。

### 13.5 搞事情中断

搞事情激活时 `gameState = CHAOS_MODE`。关闭后:
```javascript
_destroyChaos():
  // ... 销毁UI元素
  SoundManager.resumeAll()
  gameState = PLAYER_TURN
  setStatusText("搞事情结束，继续出牌  第 X/10 回合")
```

恢复后 `gameState` 变为 `PLAYER_TURN`，功能按钮立即可用。

### 13.6 其他

| 场景 | 处理 |
|:----|:------|
| AI手牌为空入口检查 | `doAITurn` 首行 → 直接结算 |
| 玩家手牌为空出牌检查 | `confirmPlay` 末尾 → 玩家赢 |
| API未定义 | `isAPIMode` 检查 → 始终走本地 |
| 初始gameState = INIT | create()末尾 delay 800ms → BIDDING |
| scene.restart() | 重新执行 init() → 所有状态重置 |

---

## 14. 验收标准

### 14.1 选牌交互

| # | 验收条件 | 预期结果 | 来源 |
|:-:|----------|---------|:----:|
| H1 | 手牌以56×80渲染，弧形排列 | 弧线最高点(baseY=345)居中，两端高9px | renderPlayerHand |
| H2 | 点击牌 → 上移16px, 点击其他牌不触发 | y=329, 选中状态标记 | renderPlayerHand |
| H3 | 再次点击已选中的牌 → 复位 | y=345, 取消选中 | renderPlayerHand |
| H4 | 非PLAYER_TURN点手牌 | Toast "现在不是你的出牌阶段" | renderPlayerHand |
| H5 | 选牌后重渲染 (出牌/redeal) | 所有牌reset, selectedCards清空 | confirmPlay |

### 14.2 出牌按钮

| # | 验收条件 | 预期结果 | 来源 |
|:-:|----------|---------|:----:|
| P1 | 未选牌点"出牌" | Toast "请先选择手牌" | doPlayerPlay |
| P2 | 选非法牌型点"出牌" | Toast "非法牌型组合" | doPlayerPlay |
| P3 | 上家出K, 选3点"出牌" | Toast "不能压过上家的牌" | doPlayerPlay |
| P4 | 自由出牌阶段点"不出" | Toast "自由出牌阶段不能跳过" | doPlayerPass |
| P5 | 合法出牌 → 牌从手牌移除, 出牌区显示 | 手牌数-1, 出牌区正确渲染 | confirmPlay |

### 14.3 AI回合

| # | 验收条件 | 预期结果 | 来源 |
|:-:|----------|---------|:----:|
| A1 | 玩家出牌后AI1 600ms开始思考 | 状态文字 "王怼怼思考中..." | confirmPlay |
| A2 | AI思考1.2s后出牌或pass | 出牌区显示AI牌或状态"不出" | doAITurn |
| A3 | AI出牌后更新剩余张数 | 顶部 "剩余 N 张" 正确更新 | updateAICount |
| A4 | AI出炸弹时播放bomb气泡 | 气泡显示bomb台词 | handleAIPlay |
| A5 | AI无牌可出时自动pass | 状态"王怼怼 不出" | handleAIPass |

### 14.4 提示系统

| # | 验收条件 | 预期结果 | 来源 |
|:-:|----------|---------|:----:|
| T1 | 自由出牌点击"提示" | 选中最小单张(3) | localHint |
| T2 | 上家出牌后点击"提示" | 选中能压过的最小牌型 | localHint |
| T3 | 无牌可出点击"提示" | Toast "没有能出的牌" | localHint |
| T4 | 提示后选中牌高亮(y-16) | 选中状态可见 | _highlightCard |

### 14.5 过牌与流转

| # | 验收条件 | 预期结果 | 来源 |
|:-:|----------|---------|:----:|
| F1 | 玩家过→AI1过→AI2自由出牌 | 出牌权归AI2 | handleAIPass |
| F2 | AI1过→AI2过→玩家自由出牌 | 出牌权归玩家 | handleAIPass |
| F3 | 自由出牌后，lastPlay清空 | 玩家可出任何牌 | passCount≥2逻辑 |
| F4 | 出牌区在两轮都过后清空 | 无任何出牌显示 | passCount≥2逻辑 |

### 14.6 赢牌与结算

| # | 验收条件 | 预期结果 | 来源 |
|:-:|----------|---------|:----:|
| W1 | 玩家出完最后一张牌 | 结算面板弹出 "🎉 你赢了！" | confirmPlay |
| W2 | AI出完所有牌 | 结算面板弹出 "😅 AI名称获胜！" | handleAIPlay |
| W3 | 炸弹累计正确 | totalBombs计数影响结算乘数 | confirmPlay等 |

### 14.7 出牌记录

| # | 验收条件 | 预期结果 | 来源 |
|:-:|----------|---------|:----:|
| R1 | 玩家出牌后右上角更新 | "你: 3 4 5 6 7" | addPlayHistory |
| R2 | AI出牌后右上角更新 | "王怼怼: K" | addPlayHistory |
| R3 | 不出记录 | "王怼怼: 不出" | addPlayHistory |
| R4 | 最多保留8条, 显示6条 | 翻页测试 | renderPlayHistory |

### 14.8 状态机

| # | 验收条件 | 预期结果 | 来源 |
|:-:|----------|---------|:----:|
| S1 | PLAYER_TURN → ("出牌") → VALIDATING → WAITING_AI | 状态正确过渡 | doPlayerPlay |
| S2 | WAITING_AI → (AI2出牌) → PLAYER_TURN | 玩家可操作 | handleAIPlay |
| S3 | PLAYER_TURN → ("搞事情") → CHAOS_MODE → PLAYER_TURN | 恢复后状态正确 | doAction |
| S4 | 各状态下手牌不可选 | Toast提示 | renderPlayerHand |

---

## 附录: 函数索引

| 函数 | 行号 | 功能 | 关键参数 |
|:----|:----:|:-----|:---------|
| `renderPlayerHand()` | ~408 | 渲染手牌 | cw=56, ch=80, baseY=345 |
| `_clearCardSelection()` | ~465 | 清空选中 | y = origY |
| `_highlightCard(el)` | ~470 | 高亮单牌 | y = origY - 16 |
| `doPlayerPlay()` | ~950 | 玩家出牌入口 | validate + confirm |
| `confirmPlay()` | ~990 | 确认出牌 | lastPlay, passCount, AI turn |
| `doPlayerPass()` | ~1025 | 玩家不出 | passCount+1, flow routing |
| `doHint()` | ~1060 | 提示入口 | API/local |
| `localHint()` | ~1085 | 本地提示 | plays[0], highlight |
| `highlightHint(hint)` | ~1115 | API提示高亮 | hint.cards匹配 |
| `doAITurn(aiIndex)` | ~1130 | AI回合入口 | 0=AI1, 1=AI2 |
| `handleAIPlay()` | ~1170 | AI出牌处理 | API cards匹配 |
| `handleAIPass()` | ~1230 | AI不出处理 | passCount≥2 check |
| `localAIPlay()` | ~1260 | 本地AI策略 | plays[0], min single |
| `updateAICount(aiIndex)` | ~1315 | 更新顶部牌数 | "剩余 N 张" |
| `displayPlay()` | ~1325 | 出牌区显示 | 3个预设位置 |
| `renderRoundEndPanel(winner)` | 2463 | 结算面板 | player/ai1/ai2 |
| `addPlayHistory()` | ~2740 | 出牌记录 | max 8条 |
| `createPlayHistoryArea()` | 2697 | 出牌记录面板 | (800,60) 150×140 |
