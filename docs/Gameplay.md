# PRD：出牌系统（Gameplay）

> **版本**: v1.0  
> **设计者**: 产品经理  
> **更新日期**: 2026-05-02  
> **画布尺寸**: 960 × 600 横屏

---

## 1. 系统概述

出牌系统是斗地主游戏的核心玩法模块，覆盖从手牌渲染、选牌、出牌验证、AI 出牌、提示、赢牌结算到出牌记录的完整闭环。系统基于 Phaser 3 实现，牌型识别与校验依赖 `CardEngine.js`。

### 1.1 状态机

```
PLAYER_TURN ──doPlayerPlay()──→ VALIDATING ──confirmPlay()──→ WAITING_AI
     ↑                                                     │
     │                  passCount ≥ 2  或  AI出完          │
     └──────────────────────────────────────────────────────┘
```

- **PLAYER_TURN**: 玩家可出牌、提示、不出、搞事情
- **VALIDATING**: 玩家点击"出牌"后校验合法性
- **WAITING_AI**: 等待 AI 出牌（1.2s 延迟），AI 可调用 API 或本地算法
- **ROUND_END**: 任意玩家手牌数为 0 时触发

---

## 2. 手牌渲染与卡牌选择

### 2.1 手牌布局

**文件**: `game.js:createHandArea()` → `game.js:renderPlayerHand()`

| 属性 | 值 |
|------|-----|
| 手牌区域背景 | `fillRoundedRect(20, 300, 920, 115, 10)` |
| 手牌区域底色 | `#000000` (alpha 0.15) |
| 手牌区域深度 | `10` |
| 区域标题 | `yourHandText @ (68, 305)`，字号 11px，颜色 `#A5D6A7` |
| 单张卡牌尺寸 | 56 × 80 (width × height) |
| 卡牌重叠 (overlap) | `n > 6 ? Math.min(33, (700 - cw) / (n - 1)) : 33` |
| 起始 X | `startX = 180 + (700 - totalWidth) / 2` |
| 基础 Y | `345` |
| 弧形偏移 | `arcOffset = Math.pow((i / (n - 1)) - 0.5, 2) * 36`，使手牌呈微弧排列 |
| 卡牌深度 | `110` |
| 卡牌图片 key | `getCardImageKey(card)` 返回 `card{Suits}{RankNames}` |

### 2.2 选中/取消选中逻辑

**文件**: `game.js:renderPlayerHand()` — `pointerdown` 事件

**数据结构**:
```javascript
this.selectedCards = []  // 存储被选中牌的 cardDomElements 索引
```

**交互流程**:
1. 玩家点击卡牌（`pointerdown`）
2. 检查 `gameState === GAME_STATE.PLAYER_TURN`，否则显示 toast"现在不是你的出牌阶段"
3. 获取 `cardIdx`、`selected` 状态
4. **取消选中（已选中 → 点击）**:
   - `card.y += 16`（恢复原位）
   - `card.setData('selected', false)`
   - 从 `selectedCards` 数组中移除该索引
   - 播放 `SoundManager.deselectCard()`
5. **选中（未选中 → 点击）**:
   - `card.y -= 16`（Y 方向上移 16px）
   - `card.setData('selected', true)`
   - 向 `selectedCards.push(idx)`
   - 播放 `SoundManager.selectCard()`

**辅助方法**:
```javascript
_clearCardSelection()   // 遍历 cardDomElements，清除所有选中状态，y 复位
_highlightCard(el)      // 将单张牌置为选中：y = origY - 16，selected = true
```

---

## 3. 出牌逻辑

### 3.1 动作按钮

**文件**: `game.js:createActionButtons()`

按钮位于 `Y = 442`，横向等距排列：

| 按钮 | 标签 | 颜色值 | 尺寸 | 回调 |
|------|------|--------|------|------|
| 出牌 | 出牌 | `0x4ECDC4` | 72×48 | `scene.doPlayerPlay()` |
| 提示 | 提示 | `0xFFD93D` | 72×48 | `scene.doHint()` |
| 不出 | 不出 | `0xFF6B6B` | 72×48 | `scene.doPlayerPass()` |
| 搞事情 | 搞事情 | `0x7C4DFF` | 72×48 | `scene.doAction()` |
| 底牌查看 | 底牌查看 | `0x78909C` | 72×48 | `scene.showBottomCards()` |

按钮间距 `gap = 14`，起始 X `startX = (960 - totalW) / 2`，其中 `totalW = 72 * 5 + 14 * 4 = 416`。

按钮深度 `100`，文字深度 `101`，字号 `13px`，白色粗体。

### 3.2 `doPlayerPlay()` — 玩家出牌入口

1. **状态检查**: `gameState !== PLAYER_TURN` → toast 提示
2. **选牌检查**: `selectedCards.length === 0` → toast"请先选择手牌"
3. **牌型识别**: `Doudizhu.identifyType(playCards)`
   - **非法组合**: `info.type === INVALID` → toast"非法牌型组合"
4. **压牌校验**: 如果 `lastPlay` 存在且非空 → `Doudizhu.canBeat(playCards, lastPlay)`
   - **不能压过**: toast"不能压过上家的牌"
5. **状态切换**: `gameState = VALIDATING`
6. **API 验证** (若为 API 模式): `ApiClient.verifyPlay(playCards, lastPlay, playerHand)`
   - `res.valid` === true → 调用 `confirmPlay(playCards, info)`
   - `res.valid` === false → toast 错误信息，`gameState` 恢复 `PLAYER_TURN`
   - API 失败 → 回退本地验证，直接调用 `confirmPlay(playCards, info)`

### 3.3 `confirmPlay()` — 确认出牌

1. **构建已出牌集合**: `playSet` (key = `suit:rank`)，记录每张牌的出现次数
2. **从手牌移除**: 逆序遍历 `playerHand`，匹配则 `splice(j, 1)`
3. **更新出牌状态**:
   - `lastPlay = playCards`
   - `lastPlayInfo = info`
   - `lastPlayPlayer = 'player'`
   - `passCount = 0`
4. **显示出的牌**: `displayPlay(playCards, 'player')`
5. **状态文本**: `setStatusText('已出 ' + HAND_TYPE_NAMES[info.type])`
6. **清空选牌**: `selectedCards = []`，`renderPlayerHand()`
7. **出牌记录**: `addPlayHistory('player', playCards)`
8. **音效**: `SoundManager.playCard()`
9. **炸弹检测**: `info.type === 'BOMB' || info.type === 'ROCKET'` → `totalBombs++`
10. **赢牌检测**: `playerHand.length === 0` → `renderRoundEndPanel('player')`
11. **状态切换**: `gameState = WAITING_AI`，延时 600ms 后调用 `doAITurn(0)` (AI1)

### 3.4 `doPlayerPass()` — 玩家不出

1. **状态检查**: `gameState !== PLAYER_TURN` → return
2. **自由出牌检查**: `!lastPlay || lastPlay.length === 0` → toast"自由出牌阶段不能跳过"
3. **记录**: `passCount++`，toast"不出"
4. **清空选牌**: `selectedCards = []`
5. **出牌记录**: `addPlayHistory('player', true)`（true = pass）
6. **两轮都过逻辑** (`passCount >= 2`):
   - 重置 `passCount = 0`，`lastPlay = null`
   - 出牌权交给上一轮最后出牌者（非当前 pass 者）
   - 若最后出牌者是玩家 → 状态回到 `PLAYER_TURN`
   - 若最后出牌者是 AI → 调用 `doAITurn(lastAiIdx)`
7. **仅一轮过**: `gameState = WAITING_AI`，延时 800ms 调用 `doAITurn(1)` (AI2)

---

## 4. 出牌显示 `displayPlay()`

**文件**: `game.js:displayPlay(cards, player)`

### 4.1 布局坐标

| 玩家 | X | Y | 卡牌尺寸 w×h | origin |
|------|---|---|---------------|--------|
| player (你) | 360 | **195** | 50×72 | 0.5 |
| ai1 (王怼怼) | 280 | **133** | 42×60 | 0.5 |
| ai2 (苏甜甜) | 682 | **133** | 42×60 | 0.5 |

### 4.2 渲染逻辑

1. **清除旧牌**: 遍历并销毁 `myPlayCardsGfx` / `ai1PlayCardsGfx` / `ai2PlayCardsGfx`
2. **计算重叠**: `overlap = Math.min(50 * 0.6, (480 - 50) / Math.max(n - 1, 1))`
3. **居中呈现**: `startX = pos.x - totalW / 2`
4. **每张牌**: `add.image(pcx, pos.y, cardImageKey).setDisplaySize(pos.w, pos.h).setDepth(21)`
5. **卡片深度**: `21`

---

## 5. AI 出牌系统

### 5.1 AI 回合调度 `doAITurn(aiIndex)`

**参数**: `aiIndex` — 0 代表王怼怼 (ai1)，1 代表苏甜甜 (ai2)

**流程**:
1. **获取手牌**: `hand = this.ai1Hand` 或 `this.ai2Hand`
2. **设置状态**: `gameState = WAITING_AI`，状态文本 `"{AI名称} 思考中..."`
3. **手牌为空检测**: 若 `hand.length === 0` → 调用 `renderRoundEndPanel('ai1'/'ai2')`
4. **API 模式**: 延时 **1200ms**（`this.time.delayedCall(1200, ...)`）
   - 调用 `ApiClient.aiPlay(hand, lastPlay)`
   - `res.canPlay === false` → `handleAIPass(aiIndex, aiName)`
   - 有出牌 → `handleAIPlay(aiIndex, aiName, res)`
   - API 失败 → 降级调用 `localAIPlay(aiIndex, aiName)`
5. **本地模式**: 直接调用 `localAIPlay(aiIndex, aiName)`

### 5.2 AI 出牌 `handleAIPlay()`

1. **匹配出牌**: 根据 API 返回的 `cards` 从 AI 手牌中 `splice` 移除
2. **匹配失败处理**: 若实际匹配张数 !== 返回张数：
   - 尝试部分匹配（已成功匹配且牌型有效则使用）
   - 否则降级到 `localAIPlay()`
3. **更新出牌状态**: `lastPlay`, `lastPlayInfo`, `lastPlayPlayer`, `passCount = 0`
4. **显示**: `displayPlay(playCards, 'ai1'/'ai2')`
5. **更新手牌数量**: `updateAICount(aiIndex)`
6. **出牌记录**: `addPlayHistory('ai1'/'ai2', playCards)`
7. **气泡**: `_showPlayBubble('duidui'/'tiantian', 'play'/'bomb', info.type)`
8. **炸弹检测**: `totalBombs++`
9. **赢牌检测**: 若 `hand.length === 0` → `renderRoundEndPanel('ai1'/'ai2')`
10. **下一个 AI 或玩家**:
    - AI1 出完 → 延时 **1200ms** → `doAITurn(1)` (AI2)
    - AI2 出完 → `gameState = PLAYER_TURN`，等待玩家出牌

### 5.3 AI 不出 `handleAIPass()`

1. `passCount++`
2. 状态文本 `"{AI名称} 不出"`
3. 出牌记录: `addPlayHistory('ai1'/'ai2', true)`
4. 气泡: `_showPlayBubble('duidui'/'tiantian', 'pass', '')`
5. **两轮都过** (`passCount >= 2`): 与玩家 pass 逻辑对称，出牌权归上一轮最后出牌者
6. AI1 过 → 延时 **1200ms** → `doAITurn(1)` (AI2)
7. AI2 过 → `gameState = PLAYER_TURN`

### 5.4 本地 AI 策略 `localAIPlay()`

**文件**: `game.js:localAIPlay(aiIndex, aiName)`

**出牌枚举**: `Doudizhu.findValidPlays(hand, lastPlay)`

**策略排序**（按类型升序，越小越优先）:
```
single(0) < pair(1) < triple(2) < triple_plus_one(3) < triple_plus_two(4) < 
straight(5) < consecutive_pairs(6) < airplane(7) < airplane_plus_singles(8) < 
airplane_plus_pairs(9) < four_plus_two(10) < four_plus_two_pairs(11) < 
bomb(12) < rocket(13)
```

**自由出牌策略**: 若 `!lastPlay || lastPlay.length === 0`，且枚举结果中有单张，选最小的单张（`plays[pi].length === 1`）

**AI 回合间隔**: AI1 出完 → 1200ms → AI2 → 1200ms → 玩家

---

## 6. 提示系统

### 6.1 `doHint()` — 提示入口

1. **状态检查**: `gameState !== PLAYER_TURN` → return
2. **API 模式**: 调用 `ApiClient.findPlays(playerHand, lastPlay)`
   - `res.total === 0` → toast"没有能出的牌"
   - 有结果 → `highlightHint(res.plays[0])`，状态文本 `"提示: {typeName} (共{total}种)"`
   - API 失败 → 降级 `localHint()`
3. **本地模式**: `localHint()`

### 6.2 `localHint()` — 本地提示

```javascript
var plays = Doudizhu.findValidPlays(playerHand, lastPlay)
if (plays.length === 0) → toast"没有能出的牌"
var hintPlay = plays[0]  // 取最弱的推荐
```

1. `_clearCardSelection()` 清空当前选牌
2. 构建 `hintRanks` 字典 (`suit:rank" → true`)
3. 遍历 `cardDomElements`，匹配则 `_highlightCard()` + 索引加入 `selectedCards`
4. 状态文本显示 `"提示: {HAND_TYPE_NAMES[info.type]}"`

### 6.3 `highlightHint(hint)` — 高亮 API 返回的提示

根据 `hint.cards` 数组，匹配手牌位置，选中并高亮，与 `localHint()` 结构一致。

---

## 7. 赢牌检测与结算面板

### 7.1 检测时机

- `confirmPlay()` 中 `playerHand.length === 0`
- `handleAIPlay()` 中 AI 手牌 `hand.length === 0`
- `handleAIPass()` 中 AI 手牌空
- `localAIPlay()` 中 AI 手牌空
- `doAITurn()` 中 AI 手牌空

### 7.2 `renderRoundEndPanel(winner)`

**参数**: `winner` — `'player'` | `'ai1'` | `'ai2'`

**状态**: `gameState = ROUND_END`

**结算面板结构** (全部深度 ≥ 400):

| 元素 | 位置 | 描述 |
|------|------|------|
| 半透明遮罩 | 0, 0 ~ 960, 600 | `fillStyle(0x000000, 0)` → 渐变 alpha 0.65 |
| 结算卡片背景 | 200, 60, 560×480 | `fillStyle(0x1A1A2E, 0.92)`，金色/红色描边 |
| 标题 | 480, 90 | 🎉 你赢了！/ 😅 你输了，金色/红色 |
| AI 获胜副标题 | 480, 120 | 红色 16px |
| 得分面板 | 240, 142, 480×260 | 半透明深色 |
| 得分细项 | Y=235, 步进 25 | 基础底分、炸弹翻倍、搞事情得分、手牌奖励 |

**计分公式**:
```
baseScore = isLandlord ? 30 : 20
chaosBonus = chaosScore * 10
handBonus = (对手剩余手牌总数) * 2
subTotal = baseScore + chaosBonus + handBonus
multiplier = Math.pow(2, totalBombs)
totalScore = subTotal * multiplier
```

**动画序列**:

| 时间点 | 动画 |
|--------|------|
| 0.3s | 背景卡片、得分面板淡入 (0.3s) |
| 0.4s | 标题弹入 (scale 0.3→1.0, Back.easeOut) |
| 0.7s | 总得分标签、数字、分隔线淡入 |
| 0.9s + idx×0.15s | 各得分细项逐行淡入 |
| 1.5s | 第二条分隔线淡入 |
| 1.6s | 底部小字淡入 |
| 1.8s | "再来一局" "返回首页" 按钮弹入 |

**按钮**:
- "再来一局" @ (290, 370, 170×44) → `scene.restart()`
- "返回首页" @ (500, 370, 170×44) → `window.location.reload()`

---

## 8. 出牌记录系统

### 8.1 创建记录区域

**文件**: `game.js:createPlayHistoryArea(scene)`

| 属性 | 值 |
|------|-----|
| 面板位置 | `fillRoundedRect(800, 60, 150, 140, 6)` |
| 面板底色 | `0x000000` (alpha 0.2) |
| 面板深度 | 200 |
| 标题 | "出牌" @ (808, 65), 9px, `#81C784` |
| 记录文本 | `playHistoryText` @ (808, 76), 9px, `#C8E6C9`, wordWrap 135px |
| 深度 | 201 |

### 8.2 `addPlayHistory(player, cardsOrPass)`

- `player`: `'player'` → "你", `'ai1'` → "王怼怼", `'ai2'` → "苏甜甜"
- `cardsOrPass === true`: 标记为"不出"
- `cardsOrPass` 是数组: 用 `RANK_NAME_MAP[c.rank]` 映射映射每个牌的显示名
- 保留最近 **8 条**记录

### 8.3 `renderPlayHistory()`

取最近 6 条合并显示，格式:
```
你: 3 4 5 6 7
王怼怼: 不出
苏甜甜: J Q K A 2
```

---

## 9. CardEngine 牌型系统

**文件**: `src/client/js/CardEngine.js`

### 9.1 牌型枚举 `HAND_TYPES`

| 常量 | 中文名 | 说明 |
|------|--------|------|
| `SINGLE` | 单张 | 1 张牌 |
| `PAIR` | 对子 | 2 张同 rank |
| `TRIPLE` | 三张 | 3 张同 rank |
| `TRIPLE_PLUS_ONE` | 三带一 | 3 张同 rank + 1 张单牌 |
| `TRIPLE_PLUS_TWO` | 三带二 | 3 张同 rank + 2 张同 rank |
| `STRAIGHT` | 顺子 | ≥5 张连续，3~A，每张 1 张 |
| `CONSECUTIVE_PAIRS` | 连对 | ≥3 对连续，3~A |
| `AIRPLANE` | 飞机 | ≥2 个三张连续，3~A |
| `AIRPLANE_PLUS_SINGLES` | 飞机带单 | 飞机 + 单张 × 翅膀数 |
| `AIRPLANE_PLUS_PAIRS` | 飞机带对 | 飞机 + 对 × 翅膀数 |
| `BOMB` | 炸弹 | 4 张同 rank |
| `ROCKET` | 火箭 | 小王 + 大王 |
| `FOUR_PLUS_TWO` | 四带二 | 4 张同 rank + 2 张单牌 |
| `FOUR_PLUS_TWO_PAIRS` | 四带两对 | 4 张同 rank + 2 个对子 |
| `INVALID` | 非法 | 无法识别的组合 |

### 9.2 出牌校验 `canBeat(current, last)`

1. 火箭 > 一切
2. 炸弹 > 非炸弹、非火箭
3. 同类型比较 rank（顺子/连对/飞机还需长度相同）
4. 不同型不可比较（除非被炸弹/火箭覆盖）

### 9.3 `findValidPlays(hand, lastPlay)`

- 全部枚举后按类型排序（单张→火箭）
- `lastPlay` 为空 → 返回所有合法牌型
- `lastPlay` 存在 → 仅返回能压过的

### 9.4 `typeSortOrder()` — AI 出牌优先级

```
SINGLE(0) → PAIR(1) → TRIPLE(2) → ... → BOMB(12) → ROCKET(13)
```

---

## 10. 状态管理与边界情况

### 10.1 全局状态枚举 `GAME_STATE`

```javascript
INIT → BIDDING → PLAYER_TURN → VALIDATING → WAITING_AI → ROUND_END
                                       ↕
                                  CHAOS_MODE
```

### 10.2 边界情况

| 场景 | 处理 |
|------|------|
| 非法牌型组合 | `identifyType` 返回 `INVALID` → toast"非法牌型组合" |
| 不能压过上家 | `canBeat` → false → toast"不能压过上家的牌" |
| 自由出牌阶段无法 pass | `!lastPlay` → toast"自由出牌阶段不能跳过" |
| 不是玩家回合尝试出牌 | `gameState` 检查 → toast"现在不是你的出牌阶段" |
| 未选牌点击"出牌" | `selectedCards.length === 0` → toast"请先选择手牌" |
| AI 手牌为空 | 在 `doAITurn()` 开头检测 → `renderRoundEndPanel()` |
| API 调用失败 | catch 中降级到本地模式 (`localHint()`/`localAIPlay()`) |
| API 返回的牌与手牌不匹配 | `handleAIPlay()` 中 partial match 或降级 |
| 无合法出牌 | `findValidPlays` 返回空数组 → pass |
| 炸弹数量累计 | `totalBombs++`，影响结算倍率 |
| 出牌记录超限 | 保留最近 8 条 |
| 搞事情中断出牌 | `_destroyChaos()` 恢复 `PLAYER_TURN` |

---

## 11. 音效系统

依赖 `SoundManager`，使用 Web Audio API 控制播放：

| 事件 | 方法 | 音效文件 |
|------|------|----------|
| 出牌 | `SoundManager.playCard()` | `cardPlace1~3` (随机) |
| 选中卡牌 | `SoundManager.selectCard()` | `cardSlide1~3` (随机) |
| 取消选中 | `SoundManager.deselectCard()` | `cardSlide1~3` (随机，音量略低) |
| 轮到玩家 | `SoundManager.playerTurn()` | `chipsCollide1~3` (随机) |
| 胜利 | `SoundManager.win()` | `cardPlace3` |
| 失败 | `SoundManager.lose()` | `cardSlide1` |
| 搞事情答对 | `SoundManager.win()` | `cardPlace3` |
| 搞事情答错 | `SoundManager.lose()` | `cardSlide1` |

---

## 12. 验收标准

| # | 验收条件 | 测试方法 |
|---|----------|----------|
| 1 | 手牌正确渲染，3~A ~ 2 排序，弧形排列 | 刷新页面查看手牌 |
| 2 | 点击卡牌 Y 方向 +16px，再点击恢复 | 点击任意卡牌两次 |
| 3 | 选牌后点击"出牌"，合法则移除手牌并在出牌区显示 | 选牌→出牌 |
| 4 | 非法牌型 toast"非法牌型组合" | 选 3 张不同 rank → 出牌 |
| 5 | 不能压过 toast"不能压过上家的牌" | 上家出 K，出小牌 |
| 6 | 自由出牌阶段"不出"按钮被禁用 | 开局点击"不出" |
| 7 | 两轮都过，出牌权归上一轮最后出牌者 | 玩家过 → AI1 过 → 观察 |
| 8 | AI 思考 1.2s 后出牌或 pass | 观察状态文本变化 |
| 9 | 提示系统展示最小合法出牌 | 点击"提示" |
| 10 | 手牌出完 → 结算面板弹出 | 出完最后一张牌 |
| 11 | 结算面板含正确计分、炸弹倍率、手牌奖励 | 观察面板数值 |
| 12 | 出牌记录正确显示在右侧 | 观察右侧面板 |
| 13 | 状态机不允许玩家在 AI 回合出牌 | AI 回合时点击卡牌 |
| 14 | API 失败时自动降级本地模式 | 断开后端后操作 |
| 15 | "搞事情"关闭后恢复出牌 | 搞事情→关闭→出牌 |
