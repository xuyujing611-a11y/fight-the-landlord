# ChaoShiQing (搞事情 / Chaos Mode) — 超详细设计文档

**版本:** v2.0  
**作者:** 产品老大  
**日期:** 2026-05-02  
**基准画布:** 960×600 横屏 (Phaser 3 Scale.FIT)  
**对应源码:** `src/client/js/game.js` (2736行)  
**相关常量:** `GAME_STATE.CHAOS_MODE`  

---

## 目录

1. [触发入口 — "搞事情"按钮](#1-触发入口--搞事情按钮)
2. [遮罩与白色卡片容器](#2-遮罩与白色卡片容器)
3. [题型选择界面](#3-题型选择界面)
4. [题目渲染](#4-题目渲染)
5. [答案处理 — 正确/错误/超时](#5-答案处理)
6. [换牌流程](#6-换牌流程)
7. [AI气泡反应系统](#7-ai气泡反应系统)
8. [倒计时动画](#8-倒计时动画)
9. [回退题目逻辑](#9-回退题目逻辑)
10. [底部按钮](#10-底部按钮)
11. [销毁与状态恢复](#11-销毁与状态恢复)
12. [边角情况全表](#12-边角情况全表)
13. [数据结构与变量](#13-数据结构与变量)
14. [台词池](#14-台词池)
15. [验收标准](#15-验收标准)

---

## 1. 触发入口 — "搞事情"按钮

### 1.1 按钮创建 (createActionButtons)

底部功能栏共5个按钮，在 `createActionButtons(scene)` 中创建：

| 按钮 | 索引 | 标签 | X坐标 (基准) | Y | W | H | 颜色 (hex) |
|:----:|:----:|:----:|:------------:|:-:|:-:|:-:|:----------:|
| 出牌 | 0 | 出牌 | 按公式计算 | 442 | 72 | 48 | 0x4ECDC4 |
| 提示 | 1 | 提示 | 按公式计算 | 442 | 72 | 48 | 0xFFD93D |
| 不出 | 2 | 不出 | 按公式计算 | 442 | 72 | 48 | 0xFF6B6B |
| **搞事情** | **3** | **搞事情** | **按公式计算** | **442** | **72** | **48** | **0x7C4DFF** |
| 底牌查看 | 4 | 底牌 | 按公式计算 | 442 | 72 | 48 | 0x78909C |

**坐标计算公式:**
```javascript
var bw = 72, bh = 48, gap = 14;
var totalW = 5 * bw + 4 * gap;    // = 416
var startX = (960 - totalW) / 2;  // = 272
var btn4X = startX + 4 * (bw + gap); // 搞事情按钮 X  = 272 + 4*(72+14) = 616
```

**精确值:**
- 搞事情按钮: `X=616, Y=442, W=72, H=48`
- 圆角: 8px
- depth: 100
- 文字: "搞事情", fontSize 11px, bold, color #FFFFFF

### 1.2 点击响应 (doAction)

```javascript
doAction() → 检查 actionName
    │
    ├─ action === 'chaos' →
    │   ├─ if (gameState !== PLAYER_TURN && gameState !== CHAOS_MODE) return; ← 状态守卫
    │   ├─ SoundManager.pauseAll()
    │   ├─ gameState = GAME_STATE.CHAOS_MODE
    │   ├─ chaosScore = chaosScore || 0 (持久化，跨回合保留)
    │   ├─ setStatusText("选题型...")
    │   ├─ 随机选择被搞AI: Math.random() < 0.5 ? 'duidui' : 'tiantian'
    │   └─ _createChaosOverlay(aiId, function() { _showTypeSelection(aiId, aiName); })
    │
    ├─ action === 'play' → doPlayerPlay()
    ├─ action === 'hint' → doHint()
    ├─ action === 'pass' → doPlayerPass()
    └─ action === 'view_bottom' → toggleBottomCards()
```

**状态守卫条件:**
- `gameState !== GAME_STATE.PLAYER_TURN && gameState !== GAME_STATE.CHAOS_MODE` 时 return
- 即只能在**玩家回合** 或 **已混沌模式中** 点击（后者不会进入，因为 `_createChaosOverlay` 已创建遮罩阻挡点击）

### 1.3 频率规则

| 规则 | 说明 |
|------|------|
| 任意回合 | 玩家回合中随时可点击 |
| 一回合多次 | 可无限次，每次换AI随机出题 |
| 一局持久 | chaosScore 跨回合累计，全局重置时清零 |
| 其他模式 | CHAOS_MODE 中不响应（遮罩拦截） |

---

## 2. 遮罩与白色卡片容器 (_createChaosOverlay)

### 2.1 调用时机

```javascript
this._createChaosOverlay(aiId, callback)
```

参数: aiId → 'duidui' 或 'tiantian'; callback → _showTypeSelection

### 2.2 元素精确布局

| 索引 | 类型 | 元素 | X | Y | W | H | Depth | 颜色/样式 |
|:----:|:----:|:----:|:-:|:-:|:-:|:-:|:-----:|:---------|
| 0 | Graphics | 半透明遮罩 (overlay) | 0 | 0 | 960 | 600 | 300 | fillStyle(0x000000, 0.75) |
| 1 | Graphics | 白色卡片背景 (cardBg) | 150 | 55 | 660 | 320 | 301 | fillStyle(0xFFFFFF, 1), 圆角12px |
| 1b | Graphics | 内发光边框 | 154 | 58 | 660 | 320 | 301 | fillStyle(0x000000, 0.08), 圆角12px |
| 2 | Text | 标题 "🔥 搞事情！答题挑战" | 480 | 77 | — | — | 302 | 19px, #FF6B35, bold, origin(0.5,0) |
| 3 | Text | 得分显示 "得分: N" | 660 | 77 | — | — | 302 | 12px, #333333 |
| 4 | Graphics+Text | 关闭按钮 (closeBtnBg + 文字) | 720 | 72 | 20 | 28 | 302/303 | bg: 0xE53935, 圆角10px; 文字: "✖" 15px #fff |

### 2.3 遮罩交互区域

遮罩本身是 `setInteractive` 的，但其 pointerdown 事件不绑定任何操作（仅为了穿透拦截下层按钮？）。

实际代码中，遮罩没有绑定 `pointerdown` 回调，但 `setInteractive` 确保了点击不会穿透到下层UI元素。

### 2.4 关闭按钮交互

```javascript
closeBtnBg.setInteractive(new Phaser.Geom.Rectangle(720, 72, 20, 20), Phaser.Geom.Rectangle.Contains);
closeBtnBg.on('pointerup', function() { self._destroyChaos(); });
```

**交互区域:** 20×20 (非整个28高，文本部分超出但没有交互命中框)

**点击行为:** 直接调用 `_destroyChaos()` → 销毁所有 chaos 元素 → 恢复 gameState = PLAYER_TURN

### 2.5 动画

| 元素 | 动画 | 时长 | 说明 |
|------|------|:----:|------|
| 遮罩 | 无（直接fill） | 0ms | 创建即显示 |
| 白色卡片 | 无 | 0ms | 创建即显示 |
| AI气泡 | 即时渲染 | 0ms | `_showAiBubble` 在 `_createChaosOverlay` 末尾直接调用 |

**无过渡动画 — 均为即时渲染。**

---

## 3. 题型选择界面 (_showTypeSelection)

### 3.1 调用时机

在 `_createChaosOverlay` 的 callback 中调用。

### 3.2 布局参数

| 元素 | X | Y | W | H | Depth | 说明 |
|------|---|---|---|---|:-----:|------|
| 副标题 "📋 选个题型，开始搞事情" | 480 | 77 | — | — | 302 | 14px, #333333, bold, origin(0.5) |
| 题型卡片0 (vocabulary) | 220 | 107 | 260 | 88 | 302 | 2×2网格，左上 |
| 题型卡片1 (expression) | 500 | 107 | 260 | 88 | 302 | 2×2网格，右上 |
| 题型卡片2 (trivia) | 220 | 181 | 260 | 88 | 302 | 2×2网格，左下 |
| 题型卡片3 (life_hack) | 500 | 181 | 260 | 88 | 302 | 2×2网格，右下 |

**卡片内部子元素:**
- 图标 (iconTxt): `(cx+12, cy+12)` 26px sans-serif
- 标签 (labelTxt): `(cx+58, cy+14)` 14px, #222222, bold
- 描述 (descTxt): `(cx+58, cy+40)` 10px, #888888

### 3.3 四种题型

| id | 图标 | 标签 | 描述 |
|:----:|:----:|------|------|
| vocabulary | 📚 | 四六级单词 | 看释义选单词，AI给你出牌 |
| expression | 💬 | 口语表达 | 地道俚语挑战，口语达人 |
| trivia | 🧠 | 冷知识 | 奇怪的知识增加了 |
| life_hack | 🏠 | 生活常识 | 生活小窍门，你真的会吗 |

### 3.4 样式状态机

```
默认态 (pointerout):
  fill: 0xF0F4FF (浅蓝)
  border: 1.5px solid 0xCCD8FF
  border-radius: 10px

Hover态 (pointerover):
  fill: 0xE0EAFF (深蓝)
  border: 2px solid 0x7C4DFF (紫色)
  border-radius: 10px

点击后 (pointerdown):
  销毁所有 >= 索引5 的chaosElements → 隐藏副标题
  恢复主标题 chaosTitle 可见
  → 调用 _showChaosQuestion(aiId, aiName, typeId)
```

### 3.5 副标题管理

```javascript
// 进入题型选择时，隐藏主标题避免重叠
if (self.chaosTitle) self.chaosTitle.setVisible(false);

// 选完题型后，恢复主标题显示
if (self.chaosTitle) self.chaosTitle.setVisible(true);
```

### 3.6 防双重选择

```javascript
self.chaosTypeSelection = true;   // _showTypeSelection 入口设置

// pointerdown 回调
if (self.chaosTypeSelection) {    // 只响应一次
    self.chaosTypeSelection = false;  // 立即锁定
    // ... 销毁UI、开始出题
}
```

---

## 4. 题目渲染 (_renderQuestion / _showChaosQuestion)

### 4.1 调用链

```
_showTypeSelection(..., typeId)
  → _showChaosQuestion(aiId, aiName, type)
    ├─ setStatusText("王怼怼 出题中...")
    ├─ if (isAPIMode && ApiClient存在)
    │   ├─ ApiClient.generateChaosQuestion(type, 'normal', 1)
    │   ├─ success & questions.length > 0 → _renderQuestion(q, aiId)
    │   └─ fail/empty → _renderFallbackQuestion(aiId)
    └─ else → _renderFallbackQuestion(aiId)
```

### 4.2 题型标签 (typeLabel)

在 `_renderQuestion` 中根据 `q.questionType` 映射图标:

```javascript
typeLabel = q.questionType || q.type || '知识题'
typeIcon = '🧠' (默认)
if (typeLabel.includes('voc') || typeLabel.includes('word')) → '📚'
if (typeLabel.includes('expr')) → '💬'
if (typeLabel.includes('trivia')) → '💡'
if (typeLabel.includes('life')) → '🏠'
```

### 4.3 题目布局 (白色卡片内)

| 元素 | X | Y | 最大W | Depth | 样式 |
|------|---|----|:-----:|:-----:|------|
| 题型标签 | 220 | 97 | — | 302 | 13px, #FF6B35, bold |
| 题目文本 | 220 | 114 | 600 | 302 | 14px, #222222, wordWrap, lineSpacing=4 |

### 4.4 选项布局 (2×2网格)

| 选项 | 列 | 行 | X | Y | W | H |
|:----:|:--:|:--:|:---:|:---:|:-:|:-:|
| A | 左 | 上 | 175 | 155 | 290 | 64 |
| B | 右 | 上 | 480 | 155 | 290 | 64 |
| C | 左 | 下 | 175 | 230 | 290 | 64 |
| D | 右 | 下 | 480 | 230 | 290 | 64 |

### 4.5 选项内部结构

```
┌───────────────────────────────────────┐
│   🔵 │   A. 放弃                       │
│       │                                │
└───────────────────────────────────────┘
   ▲标记圆      ▲选项文本
```

| 子元素 | 类型 | 定位 | 样式 |
|--------|:----:|------|------|
| 选项背景 | Graphics | (gx, gy, 290, 64) | fill 0xF5F5F5, border 1.5px 0xCCCCCC, 圆角8px |
| 标记圆圈 | Graphics | center=(gx+20, gy+32) radius=11 | fill 0x4ECDC4 |
| 标记文字 | Text | center=(gx+20, gy+32) | 12px, #FFFFFF, bold ("A"/"B"/"C"/"D") |
| 选项文本 | Text | (gx+40, gy+32) origin(0,0.5) | 13px, #333333, wordWrap w=235, lineSpacing=1 |

### 4.6 数据挂载

每个选项通过 `optBg.setData()` 挂载以下数据:

| Data Key | 值 | 用途 |
|----------|-----|------|
| `optKey` | 'A'/'B'/'C'/'D' | 选项标识 |
| `optBg` | 选项Graphics引用 | 后续样式修改 |
| `optTxt` | 文字Text引用 | 后续样式修改 |
| `optMarkBg` | 标记圆圈引用 | 后续颜色修改 |
| `optMarkTxt` | 标记文字引用 | 后续颜色修改 |
| `answer` | q.answer | 正确答案标识 |
| `origGx`, `origGy` | 原始X/Y坐标 | 动画辅助 |

### 4.7 答题锁定

```javascript
// _renderQuestion 入口
self.chaosQuestionAnswered = false;

// 选项 pointerdown 
if (self.chaosQuestionAnswered) return;  // 防连点
self.chaosQuestionAnswered = true;       // 立即锁定

// _handleChaosTimeout 中同样设置
self.chaosQuestionAnswered = true;
```

### 4.8 API 请求/响应格式

**请求:**
```http
POST /api/chaos/question
{
  "type": "vocabulary|expression|trivia|life_hack",
  "difficulty": "normal",
  "count": 1
}
```

**成功响应:**
```json
{
  "success": true,
  "questions": [{
    "question": "The word \"abandon\" means:",
    "options": { "A": "放弃", "B": "接受", "C": "建立", "D": "发现" },
    "answer": "A",
    "explanation": "abandon 意为\"放弃\"，是四级核心词汇。",
    "questionType": "vocabulary"
  }]
}
```

**失败响应:**
```json
{ "success": false, "message": "..." }
```

或 HTTP 错误 / 网络超时。

---

## 5. 答案处理

### 5.1 三条完整路径

```
            ┌──────────────────────────────────────────────┐
            │             选项点击 (pointerdown)            │
            │         chaosQuestionAnswered check           │
            └──────────────────────┬───────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │             │                │
                    ▼             ▼                ▼
              答对了(isCorrect)  答错了(else)    超时30s
               chaosScore+1    得分不变         得分不变
               SoundManager.win() lose()        (无音效)
                    │             │                │
                    ▼             ▼                ▼
            _clearQuestionArea() 相同             相同
                    │             │                │
                    ▼             ▼                ▼
            ✓ "答对了！+1"      ✗ "答错了！"    ⏱ "超时了！"
            20px #4CAF50        20px #E53935      17px #FF5252
                    │             │                │
                    │             ├─ 显示正确答案    │
                    │             └─ 显示解析       │
                    │                              │
                    ▼             ▼                ▼
            _showAiBubble(      相同              相同
             'correct')         'wrong'
                    │             │                │
                    ▼             ▼                ▼
            _showSwapUI()   _showSwapResult()    _showSwapResult()
            (盲选换牌)       (AI抢牌动画)        (AI抢牌动画)
```

### 5.2 反馈显示区域 (白色卡片内)

```javascript
var fbY = 180;  // 反馈内容的起始Y坐标 （动态递增）
```

| 元素 | X | Y (基准) | Y (有答案) | Y (有解析) | 样式 |
|------|---|:--------:|:----------:|:----------:|------|
| 结果图标+文字 | 480 (居中) | 103 | 103 | 103 | 20px, bold, 答对#4CAF50/答错#E53935 |
| "正确答案: X. xxx" | 220 | — | fbY(180) | fbY(180) | 12px, bold, #4CAF50, wordWrap 500 |
| 解析文本 | 220 | — | fbY+28 | fbY | 11px, #555555, wordWrap 500, lineSpacing 2 |

**fbY 增量规则:**
- 答对: fbY=180 (仅显示结果，无正确答案)
- 答错看答案: fbY+=28 (正确答案行)
- 有解析: fbY += (explanation.length > 40 ? 50 : 28)
- 传递给 `_showAiBubble`: `fbY + 10`
- 传递给 `_showSwapUI/_showSwapResult`: `fbY` (原值)

### 5.3 超时路径 (_handleChaosTimeout)

```javascript
_handleChaosTimeout(aiId):
  1. chaosQuestionAnswered = true
  2. _clearQuestionArea()  // 清空题目选项
  3. 显示: "⏱ 超时了！AI趁机拿走了你一张牌"
     text(480, 103) 17px #FF5252 bold origin(0.5)
  4. _showSwapResult(aiId, false, 180)  // 直接走AI抢牌
```

**无音效、无得分、无气泡。** 超时触发在 30秒 delayedCall 回调中，此时不播放音效也不会调用 AI 气泡。

### 5.4 音效映射

| 场景 | 函数 | 音效文件 | 音量 |
|:----:|------|:---------:|:----:|
| 答对 | SoundManager.win() | cardPlace3 (或随机) | 0.9 |
| 答错 | SoundManager.lose() | cardSlide1 | 0.6 |
| 超时 | — | 无音效 | — |

---

## 6. 换牌流程

### 6.1 答对换牌 (_showSwapUI) — 盲选模式

#### 6.1.1 调用前提

```javascript
if (!aiHand || aiHand.length === 0 || !self.playerHand || self.playerHand.length === 0) {
  self._showSwapResult(aiId, false, fbY);  // 降级为AI抢牌
  return;
}
```

**当 AI 或玩家手牌为空时，降级为答错逻辑。**

#### 6.1.2 视觉层级 (depth 350-355)

| Depth | 元素 | X | Y | W | H | 说明 |
|:-----:|------|---|---|---|---|------|
| 350 | 遮罩 | 0 | 0 | 960 | 600 | fill 0x000000 0.6 |
| 351 | 标题 "🎉 答对了！赢一张牌！" | 480(居中) | 90 | — | — | 18px #FFD700 bold, stroke=#000 2px |
| 351 | 提示 "选一张你的牌交出，然后猜AI的牌位置" | 480(居中) | 112 | — | — | 11px #AAAAAA |
| 351 | "你的手牌" 标签 | 480(居中) | 140 | — | — | 12px #4FC3F7 bold |
| 352 | 玩家手牌卡片 (正面) | 动态排列 | 175 | 44×64 | — | 可点击，选中+6px变到depth 355 |
| 351 | "猜猜哪张是AI的牌" 标签 | 480(居中) | 230 | — | — | 12px #FFB74D bold |
| 352 | AI牌背 (3~5张) | 动态排列 | 260 | 40×56 | — | 可点击，选中+6px |
| 353 | 确认按钮背景 | 290 | 310 | 200 | 44 | 半透明(未选中)/实色(选中) #4ECDC4, 圆角10 |
| 354 | 确认按钮文字 | 390(居中) | 332 | — | — | 15px #fff bold "✅ 确认交换" |
| 353 | 取消按钮背景 | 290 | 360 | 200 | 44 | #78909C, 圆角10 |
| 354 | 取消按钮文字 | 390(居中) | 382 | — | — | 15px #fff bold "✖ 跳过交换" |
| 400 | 翻牌揭示动画 | 动态 | — | 40×56 | — | 临时元素 |

#### 6.1.3 玩家手牌展示

```javascript
var myHandSorted = Doudizhu.sortCards(self.playerHand.slice());
var myCardW = 44, myCardH = 64, myOverlap = 30;
var myTotalW = myCardW + (myHandSorted.length - 1) * myOverlap;
var myStartX = (960 - myTotalW) / 2;

for (mi = 0; mi < myHandSorted.length; mi++) {
  var mcx = myStartX + mi * myOverlap + myCardW / 2;
  var mcard = self.add.image(mcx, 175, getCardImageKey(myHandSorted[mi]))
    .setDisplaySize(myCardW, myCardH).setDepth(352);
  // 点击: 选为"交出"的牌
}
```

#### 6.1.4 AI牌背盲选逻辑

```javascript
var numBacks = 3 + Math.floor(Math.random() * 3);  // 3~5张牌背
var backW = 40, backH = 56, backOverlap = 34;
var aiCardRealIdx = Math.floor(Math.random() * aiHand.length);
var realAICard = aiHand[aiCardRealIdx];
var realAICardSlot = Math.floor(Math.random() * numBacks);
```

**关键:** 
- 取AI手中随机一张牌作为"真牌" (`realAICard`)
- 展示3~5个牌背，`realAICardSlot` 位置是真正的AI牌，其他位置是空牌背
- 玩家看不见牌面，纯盲猜
- `isReal` 标识挂载在图片 Data 上

#### 6.1.5 确认按钮交互

```
confirmBg pointerup:
  ├─ 检查 selectedPlayerCardIdx >= 0 && selectedBackIdx >= 0
  │   └─ 任一未选 → 按钮无响应 (半透明状态)
  ├─ 销毁所有 swapElements (UI清理)
  ├─ 判断: isWin = (selectedBackIdx === realAICardSlot) ?
  │
  ├─ [isWin = true] 抽中真牌 →
  │   ├─ 在选中位置创建AI牌正面 (翻牌揭示)
  │   ├─ 显示 "🔄 用[♠K]换了AI的[♥A]" 14px #4CAF50 bold
  │   ├─ 飞入动画: 牌背→牌面 → 旋转720° → 飞到手牌区
  │   │   duration=600ms, ease=Cubic.easeOut
  │   ├─ 动画完成: 实际修改playerHand/aiHand
  │   ├─ renderPlayerHand(), updateAICount()
  │   └─ _showSwapButtons(fbY+60, 280)
  │
  └─ [isWin = false] 没抽中 →
      ├─ 揭示AI真实牌位置 (创建realAICard正面)
      ├─ 显示 "😅 没抽到AI的牌，下次加油！" 14px #FFB74D bold
      ├─ renderPlayerHand(), updateAICount()
      └─ _showSwapButtons(fbY+60, 280)
```

**注意:** 没抽中时不进行实际牌交换，只展示AI的真牌位置。

#### 6.1.6 取消按钮

```
取消按钮 pointerup:
  ├─ 销毁所有 swapElements
  └─ _showSwapResult(aiId, false, fbY)  // 降级为AI抢牌
```

#### 6.1.7 updateConfirmBtn 函数

```javascript
function updateConfirmBtn() {
  confirmBg.clear();
  if (selectedPlayerCardIdx >= 0 && selectedBackIdx >= 0) {
    confirmBg.fillStyle(0x4ECDC4, 1);   // 实色
  } else {
    confirmBg.fillStyle(0x4ECDC4, 0.5); // 半透明
  }
  confirmBg.fillRoundedRect(290, 310, 200, 44, 10).setDepth(353);
}
```

每次点击牌时调用，视觉反馈按钮激活状态。

### 6.2 答错/超时换牌 (_showSwapResult) — AI抢牌动画

#### 6.2.1 调用前提

```javascript
if (!self.playerHand || self.playerHand.length === 0) return;
```

**玩家手牌为空时，直接 return，不执行任何操作。**

#### 6.2.2 核心流程

```javascript
// 1. 选择玩家一张随机牌
var idx = Math.floor(Math.random() * self.playerHand.length);
var lostCard = self.playerHand[idx];

// 2. 延时 600ms 后执行飞行动画（给人看清结果的时间）
self.time.delayedCall(600, function() {
```

#### 6.2.3 玩家牌定位计算

```javascript
var n = self.playerHand.length;
var overlap = n > 6 ? Math.min(33, (700 - 56) / (n - 1)) : 33;
var totalWidth = 56 + (n - 1) * overlap;
var startX = 180 + (700 - totalWidth) / 2;
var playerCardX = startX + idx * overlap + 56 / 2;
```

#### 6.2.4 AI目标位置

| AI | targetX | targetY |
|:---:|:-------:|:-------:|
| 王怼怼 (duidui) | 80 | 160 |
| 苏甜甜 (tiantian) | 880 | 200 |

#### 6.2.5 飞行动画参数 (Phaser Tween)

```javascript
var animCard = self.add.image(playerCardX, 345, 'cardBack')
  .setDisplaySize(50, 72).setDepth(400);

self.tweens.add({
  targets: animCard,
  x: targetX,    // 80 或 880
  y: targetY,    // 160 或 200
  scaleX: 0.4,
  scaleY: 0.4,
  angle: 10,     // 轻微旋转
  duration: 700, // 毫秒
  ease: 'Back.easeIn',
  onComplete: function() {
    // 翻牌: 背面 → 正面
    animCard.setTexture(getCardImageKey(lostCard));
    animCard.setDisplaySize(38, 54);
    animCard.setAngle(0);
    animCard.setDepth(310);

    // 实际修改数据
    self.playerHand.splice(idx, 1);
    aiHand.push(lostCard);
    self.renderPlayerHand();
    self.updateAICount(aiId === 'duidui' ? 0 : 1);

    // 显示结果文字 "😈 王怼怼 从你手中拿走了 [♠K]"
    // 15px #FF6B35 bold, stroke #000 2px, 居中
    // 3.5秒后自动销毁

    // 显示底部按钮
    self._showSwapButtons(aiId, Math.max(fbY + 60, 251));
  }
});
```

#### 6.2.6 完整时间线

```
答错触发 (T=0ms)
  │
  ├─ 显示反馈文字 "❌ 答错了！"
  ├─ 显示正确答案 (T+100ms)
  ├─ 显示解析 (T+200ms)
  └─ 开始倒计时

T=600ms:
  └─ 卡牌从手牌区升起 → 向AI飞

T=1300ms (600+700):
  └─ 到达AI位置 → 翻牌 → 数据显示修改
      └─ 显示结果文字和底部按钮
```

**总等待时间 (从点击选项到可交互): ~1.3s**

### 6.3 超时换牌

**复用 `_showSwapResult(aiId, false, 180)`。** 0.6s 延时后触发相同的飞行动画。

**唯一区别:** `fbY = 180` 固定值（因为没有正确答案和解析的Y偏移）。

---

## 7. AI气泡反应系统 (_showAiBubble)

### 7.1 调用位置

| 位置 | 场景 | sceneKey | fbY |
|------|:----:|:---------:|:---:|
| `_createChaosOverlay` | 初始进入 | `easy` | 180 |
| `_handleOptionClick` (答对) | 答对后 | `correct` | fbY+10 |
| `_handleOptionClick` (答错) | 答错后 | `wrong` | fbY+10 |
| 超时处理 | 超时 | — | 无气泡 |

### 7.2 气泡布局 (白色卡片左侧)

```
        ┌─────────────────────────────────────────────────────┐
        │  🔥 搞事情！答题挑战                        得分: 3  │  ← 卡片顶部
        │                                                     │
  😎    ├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
 王怼怼 │  ◀ ┌──────────────────────────────────────┐          │  ← 气泡
        │     │  「送分题，给人类的怜悯。」          │          │
        │     └──────────────────────────────────────┘          │
        │                                                     │
        │      题目/答案/按钮区域                              │
        └─────────────────────────────────────────────────────┘
```

### 7.3 精确坐标

| 元素 | X | Y | 尺寸 | Depth |
|------|---|----|:------:|:-----:|
| AI头像圆圈 | 80 | y+16 | radius=22 | 302 |
| 头像文字 (😎/😊) | 80 | y+16 | 18px, center(0.5) | 303 |
| AI名字 | 105 | y-4 | 12px #fff bold | 302 |
| 气泡背景 | 230 | y+10 | w=min(540, 200+lineLen*10) h=36 | 302 |
| 三角箭头 | bubbleX | bubbleY+h/2 | size=12×12 | 302 |
| 气泡文字 | 244 | y+28 | 14px #FFFFFF, origin(0,0.5) | 303 |

**参数 `y`** = 传递给 `_showAiBubble` 的 `fbY + 10`

### 7.4 气泡样式

| 属性 | 值 |
|------|-----|
| 背景填色 | 0x1B5E20 (深绿), alpha 0.85 |
| 边框颜色 | 0x66BB6A (亮绿), alpha 0.5, 1.5px |
| 圆角 | 12px |
| 箭头 | 左侧三角，指向头像 |
| 宽度 | `Math.min(540, 200 + line.length * 10)` (自适应) |
| 高度 | 36px (固定，单行) |

### 7.5 气泡队列系统 (全局)

```javascript
var bubbleQueue = [];            // 全局队列
var BUBBLE_QUEUE_MAX = 3;       // 最大队列长度
var bubbleShowing = false;      // 队列处理中标记
```

**队列处理流程:**
```
_showAiBubble(aiId, sceneKey, y)
  ├─ 从台词池 pickAiLine(aiId, sceneKey) 获取台词
  └─ 构造渲染任务 → bubbleQueue.push({ render: renderBubble })
      ├─ if (queue.length > 3) queue.shift()  // 丢弃最旧
      └─ if (!bubbleShowing) processBubbleQueue()

processBubbleQueue()
  ├─ if queue.length === 0 → bubbleShowing = false; return;
  ├─ bubbleShowing = true
  ├─ item = queue.shift()
  └─ item.render()
      ├─ 销毁旧气泡元素
      ├─ 创建新气泡各类元素
      └─ 3.5秒后自动销毁 → processBubbleQueue()

气泡销毁:
  └─ time.delayedCall(3500, function() {
      destroy所有chaosBubbleElements
      processBubbleQueue()
  })
```

**关键行为:**
- 新气泡渲染时立即销毁旧气泡 (`chaosBubbleElements` 全部 destroy)
- 显示时长: 3.5秒 (3500ms)
- 队列最大3个，超出丢弃旧任务
- 每个气泡渲染完后自动处理下一个

### 7.6 出牌气泡vs搞事情气泡

本文档只覆盖搞事情气泡 (`_showAiBubble`)。出牌气泡 `_showPlayBubble` 是独立系统，在 `AIBubble.md` 中描述。

区别:

| 属性 | 搞事情气泡 | 出牌气泡 |
|:-----|:----------:|:--------:|
| 函数 | `_showAiBubble` | `_showPlayBubble` |
| 位置 | 白色卡片内部 (x=80,y动态) | 出牌区上方 (y=96) |
| 宽度 | max 540px | max 280px |
| 头像 | 无外边框 | 有外边框 |
| 箭头 | 固定左侧 | 左右镜像 |
| 时长 | 3.5秒 | 4~5秒 |
| 销毁后 | 处理队列 | 处理队列 |

---

## 8. 倒计时动画

### 8.1 实现方式

**当前代码中没有可视化的进度条，** 而是使用 Phaser 的 `time.delayedCall(30000, callback)` 实现30秒超时触发。

```javascript
// 在 _renderQuestion 末尾:
self.chaosTimeoutTimer = self.time.delayedCall(30000, function() {
  self._handleChaosTimeout(aiId);
});
```

### 8.2 清除条件

```javascript
// _handleOptionClick 入口
if (self.chaosTimeoutTimer) {
  self.chaosTimeoutTimer.remove();
  self.chaosTimeoutTimer = null;
}
// _destroyChaos 中
if (self.chaosTimeoutTimer) {
  self.chaosTimeoutTimer.remove();
  self.chaosTimeoutTimer = null;
}
```

**三种清除时机:**
1. 玩家点击选项 → 清除
2. 关闭搞事情 → 清除
3. 30秒到自动触发 → 清除在 `_handleChaosTimeout` 内部（触发后无需清除）

### 8.3 倒计时条设计 (未实现 → 需求新增)

**当前代码没有UI进度条，以下为设计建议:**

| 属性 | 值 |
|------|-----|
| 位置 | 白色卡片顶部 (150, 55) w=660 h=4 |
| 背景 | fill 0x000000, alpha 0.2 |
| 填充 | 渐变: 绿(#4ECDC4) → 黄(#FFD93D) → 红(#FF6B35) |
| 动画 | 每帧更新宽度 (660 → 0)，30秒内线性缩小 |

**实现方案 (新增到 _renderQuestion):**
```javascript
// 创建背景
var timerBarBg = self.add.graphics();
timerBarBg.fillStyle(0x000000, 0.2);
timerBarBg.fillRoundedRect(150, 55, 660, 4, 2).setDepth(301);

// 创建计时条填充
var timerBar = self.add.graphics();
timerBar.fillStyle(0x4ECDC4, 1);
timerBar.fillRoundedRect(150, 55, 660, 4, 2).setDepth(301);

// 每100ms更新
self.chaosTimerEvent = self.time.addEvent({
  delay: 100,
  callback: function() {
    elapsed += 100;
    var progress = 1 - (elapsed / 30000);
    if (progress <= 0) {
      timerEvent.remove();
      return;
    }
    // 颜色渐变
    var color;
    if (progress > 0.66) color = 0x4ECDC4;
    else if (progress > 0.33) color = 0xFFD93D;
    else color = 0xFF6B35;
    
    timerBar.clear();
    timerBar.fillStyle(color, 1);
    timerBar.fillRoundedRect(150, 55, 660 * progress, 4, 2);
  },
  loop: true
});
```

---

## 9. 回退题目逻辑

### 9.1 触发条件

```javascript
_showChaosQuestion(aiId, aiName, type):
  if (isAPIMode && typeof ApiClient !== 'undefined') {
    ApiClient.generateChaosQuestion(type || 'random', 'normal', 1)
      .then(function(res) {
        if (res.success && res.questions && res.questions.length > 0)
          self._renderQuestion(res.questions[0], aiId);
        else
          self._renderFallbackQuestion(aiId);
      })
      .catch(function() {
        self._renderFallbackQuestion(aiId);
      });
  } else {
    self._renderFallbackQuestion(aiId);
  }
```

**三种降级场景:**
1. API返回 `success: false` 或 `questions` 空数组
2. API HTTP错误 / 网络超时
3. `isAPIMode = false` 或 `ApiClient` 未定义

### 9.2 内置题库 (4道)

| # | 题目 | 选项 | 正确 | 题型 | 解析 |
|:-:|------|------|:----:|:----:|------|
| 1 | The word "abandon" means: | A=放弃 B=接受 C=建立 D=发现 | A | vocabulary | abandon 意为"放弃" |
| 2 | "I'm feeling under the weather" 意思: | A=在天气下面 B=生病了 C=喜欢不同天气 D=傻傻笨笨 | B | expression | "Under the weather"=生病不舒服 |
| 3 | 哪个动物几乎不患癌症？ | A=鲨鱼 B=大象 C=裸鼹鼠 D=乌龟 | C | trivia | 裸鼹鼠体内有特殊透明质酸 |
| 4 | 哪种方法能让切洋葱不流泪？ | A=冷冻30分 B=含口水 C=戴泳镜 D=微波10秒 | C | life_hack | 戴泳镜是最直接物理方法 |

### 9.3 渲染

```javascript
_renderFallbackQuestion(aiId):
  var q = fallbackQuestions[Math.floor(Math.random() * 4)];
  q.questionType = '本地题库';    // 覆盖类型标记
  self._renderQuestion(q, aiId); // 复用标准渲染函数
```

### 9.4 数据兼容

回退题目的数据格式与API格式一致，直接传给 `_renderQuestion`，无需额外处理:

```javascript
{
  question: "...",
  options: { A: "...", B: "...", C: "...", D: "..." },
  answer: "A" | "B" | "C" | "D",
  explanation: "...",
  questionType: "本地题库"
}
```

---

## 10. 底部按钮 (_showSwapButtons)

### 10.1 按钮布局

| 按钮 | 文字 | X | Y | W | H | 颜色 | 圆角 | Depth |
|:----:|:----:|:---:|:---:|:-:|:-:|:----:|:----:|:-----:|
| "再来一题" | 🔄 再来一题 | 220 | btnY | 220 | 40 | 0x4ECDC4 (青) | 10px | 305 |
| "关掉回牌" | ✖ 关掉回牌 | 510 | btnY | 220 | 40 | 0xFF6B6B (红) | 10px | 305 |

**按钮文字样式:** 13px, #FFFFFF, bold, center(0.5)

### 10.2 btnY 计算

```javascript
// 答对时
self._showSwapButtons(aiId, Math.max(fbY + 60, 280));
// 答错时
self._showSwapButtons(aiId, Math.max(fbY + 60, 251));
// 超时时 (调用答错分支, fbY=180)
self._showSwapButtons(aiId, Math.max(180 + 60, 251));  // = 251
```

**典型值:**
- 答对(fbY=180): btnY = max(240, 280) = 280
- 答错(fbY=208): btnY = max(268, 251) = 268
- 答错(fbY=236): btnY = max(296, 251) = 296
- 超时(fbY=180): btnY = max(240, 251) = 251

### 10.3 "再来一题" 行为

```javascript
againBg.on('pointerup', function() {
  self.chaosQuestionAnswered = false;       // 重置答题状态
  self._clearQuestionArea();                // 清空反馈UI
  var aiId2 = Math.random() < 0.5 ? 'duidui' : 'tiantian';  // 随机选AI
  self._showChaosQuestion(aiId2, 
    aiId2 === 'duidui' ? '王怼怼' : '苏甜甜');
});
```

**关键点:**
- `chaosQuestionAnswered = false` 重置，新题可答题
- 随机切换AI（50%概率），AI可能变化
- `chaosScore` 跨题累计（不重置）

### 10.4 "关掉回牌" 行为

```javascript
closeBg.on('pointerup', function() {
  self._destroyChaos();         // 销毁所有chaos元素
  // → gameState = PLAYER_TURN
  // → setStatusText("搞事情结束，继续出牌")
});
```

---

## 11. 销毁与状态恢复

### 11.1 _clearQuestionArea — 保留基础元素

```javascript
GameScene.prototype._clearQuestionArea = function() {
  // 保留 chaosElements[0..4]:
  //   [0] overlay
  //   [1] cardBg
  //   [2] chaosTitle
  //   [3] chaosScoreText
  //   [4] closeBtnBg
  // ← 注意: 索引5(closeBtnText) 是否销毁取决于保留策略
  // 实际代码: 销毁索引 ≥5 的全部元素
  for (var ci = 5; ci < self.chaosElements.length; ci++) {
    if (self.chaosElements[ci]) self.chaosElements[ci].destroy();
  }
  self.chaosElements = self.chaosElements.slice(0, 5);
};
```

**索引5的原意:** 是关闭按钮文字 "✖"，但代码中在题型选择阶段会保留主标题 (索引2) 和分数 (索引3) 以及关闭按钮背景 (索引4)。关闭按钮文字 (索引5) 会被清除——但这不影响关闭按钮的功能，因为交互区域在背景上。

### 11.2 _destroyChaos — 完全销毁

```javascript
GameScene.prototype._destroyChaos = function() {
  var self = this;

  // 销毁所有chaos气泡元素
  if (self.chaosBubbleElements) {
    self.chaosBubbleElements.forEach(function(el) {
      if (el) el.destroy();
    });
    self.chaosBubbleElements = [];
  }

  // 销毁所有chaos UI元素
  self.chaosElements.forEach(function(el) {
    if (el) el.destroy();
  });
  self.chaosElements = [];

  // 清除计时器
  if (self.chaosTimeoutTimer) {
    self.chaosTimeoutTimer.remove();
    self.chaosTimeoutTimer = null;
  }

  // 恢复引用
  self.chaosOverlay = null;
  self.chaosCardBg = null;
  self.chaosTitle = null;
  self.chaosQText = null;
  self.chaosScoreText = null;

  // 恢复音效和游戏状态
  SoundManager.resumeAll();
  self.gameState = GAME_STATE.PLAYER_TURN;

  // 显示状态文字
  var selfRound = self.round || 1;
  var maxRounds = self.maxRounds || 10;
  self.setStatusText('搞事情结束，继续出牌  第 ' + selfRound + '/' + maxRounds + ' 回合');
};
```

---

## 12. 边角情况全表

### 12.1 手牌不足

| 场景 | 代码行为 |
|:-----|---------|
| 答对后玩家手牌为空 | `_showSwapUI` 检查 `self.playerHand.length === 0` → 降级调用 `_showSwapResult(aiId, false, fbY)` |
| 答对后AI手牌为空 | `_showSwapUI` 检查 `aiHand.length === 0` → 降级调用 `_showSwapResult(aiId, false, fbY)` |
| 答错后玩家手牌为空 | `_showSwapResult` 直接 `return`，不执行任何操作，不显示底部按钮（因为函数 return 后不会调用 `_showSwapButtons`） |

**⚠️ 注意:** 答错后玩家手牌为空时，`_showSwapResult` 直接 return，会**卡住**（不显示底部按钮，也无法继续游戏）。这是一个代码中的潜在问题。

### 12.2 API失败

| 场景 | 行为 |
|:-----|------|
| API HTTP error (4xx/5xx) | .catch → `_renderFallbackQuestion` |
| API 网络超时 | .catch → `_renderFallbackQuestion` |
| API 成功但 questions 空 | 检查 `res.questions.length > 0` → 否则回退 |
| ApiClient 未定义 | `isAPIMode` 检查 → 直接 `_renderFallbackQuestion` |
| ApiClient.generateDialogue 失败 | .catch → 回退本地台词池 `pickAiLine` |

### 12.3 连击防护

| 防护点 | 机制 |
|:-------|------|
| "搞事情"按钮 | `gameState !== PLAYER_TURN && gameState !== CHAOS_MODE` 守卫 |
| 题型选择 | `chaosTypeSelection` 布尔守卫，点击后立即设为 false |
| 选项点击 | `chaosQuestionAnswered` 布尔守卫，点击后立即设为 true |
| 换牌交互 | 确认按钮检查 `selectedPlayerCardIdx >= 0 && selectedBackIdx >= 0` |

### 12.4 多轮叠加

| 场景 | 行为 |
|:------|------|
| 连续"再来一题" N次 | 每次随机选AI，题目不重复（API随机），分数累计 |
| 搞事情分数跨回合 | `chaosScore` 只在 `init()` 中重置为0，跨回合不重置 |
| 关闭后立即再开 | 正常进入（`gameState` 已恢复），无状态残留 |

### 12.5 超时与其他操作的竞态

| 场景 | 处理 |
|:------|------|
| 超时触发前0.1秒点击选项 | `_handleOptionClick` 中清除计时器 → normal处理 |
| 玩家在超时触发前关闭 | `_destroyChaos` 中清除计时器 → 安全关闭 |
| 超时触发后气泡队列堆积 | 气泡队列独立运行，不影响后续流程 |

### 12.6 渲染冲突

| 场景 | 处理 |
|:------|------|
| `_clearQuestionArea` 中关闭按钮文字被误删 | 索引5元素（closeBtnText）被销毁，但无负面影响（交互在背景上） |
| 多次调用 `_createChaosOverlay` | 检查 `if (this.chaosOverlay) return` — 防重复创建 |
| 换牌UI和题目UI叠加 | 换牌UI使用独立 depth 350-355 层级，不冲突 |

---

## 13. 数据结构与变量

### 13.1 GameScene 上挂载的属性

| 属性名 | 类型 | 初始值 | 用途 |
|--------|:----:|:------:|------|
| `chaosScore` | number | 0 | 累计搞事情得分，跨回合持久化 |
| `chaosElements` | Array | [] | 所有chaos UI元素的引用数组 |
| `chaosBubbleElements` | Array | [] | 气泡元素的引用数组 |
| `chaosOverlay` | Graphics | null | 遮罩对象引用 |
| `chaosCardBg` | Graphics | null | 白色卡片背景引用 |
| `chaosTitle` | Text | null | 标题文字引用 |
| `chaosQText` | Text | null | 题目文字引用（保留兼容） |
| `chaosScoreText` | Text | null | 得分文字引用 |
| `chaosTypeSelection` | boolean | false | 题型选择是否激活 |
| `chaosQuestionAnswered` | boolean | false | 当前题目是否已答 |
| `chaosTimeoutTimer` | TimerEvent | null | 30秒超时计时器引用 |

### 13.2 全局变量

| 变量名 | 类型 | 初始值 | 用途 |
|--------|:----:|:------:|------|
| `bubbleQueue` | Array | [] | 气泡队列（共享，出牌气泡也用） |
| `BUBBLE_QUEUE_MAX` | number | 3 | 队列最大长度 |
| `bubbleShowing` | boolean | false | 队列是否正在处理 |

### 13.3 chaoselements 索引约定

```
[0]  overlay (遮罩)                 — 永久保留
[1]  cardBg (白色卡片背景)            — 永久保留
[2]  chaosTitle (标题)               — 永久保留
[3]  chaosScoreText (分数)           — 永久保留
[4]  closeBtnBg (关闭按钮背景)        — 永久保留
[5]  closeBtnText (关闭按钮"✖")      — 在 _clearQuestionArea 时被销毁
[5+) 所有临时元素                     — 可安全清除
```

**注意:** 由于索引5的元素在 `_clearQuestionArea` 中被销毁（`slice(0,5)`），每次 `_showTypeSelection` 和 `_renderQuestion` 后会重新创建标题和关闭按钮。好在 `_createChaosOverlay` 只调用一次，后续只有 `_clearQuestionArea` 清理临时区域。

---

## 14. 台词池 (AI_LINES)

### 14.1 王怼怼 (duidui)

性格: 毒舌、高冷、不承认玩家实力

| sceneKey | 台词 | 语气 |
|:---------|------|:----:|
| easy | "送分题，给人类的怜悯。" | 居高临下 |
| | "这道题简单到我都懒得看。" | 轻蔑 |
| correct | "哼，蒙对的吧？" | 勉强承认 |
| | "这次算你走运。" | 心有不甘 |
| | "哟，还真答对了？" | 惊讶不失面子 |
| | "人类的水平也就这样了。" | 嘴硬 |
| wrong | "哈哈哈哈哈！果然不出所料！" | 幸灾乐祸 |
| | "这种题都会选错？你是来斗地主还是来斗笨的？" | 落井下石 |
| | "不出我所料，你的水平跟牌技一样。" | 嘲讽拉满 |
| close | "行吧，回来打牌。" | 无所谓 |

### 14.2 苏甜甜 (tiantian)

性格: 可爱、元气、容易激动

| sceneKey | 台词 | 语气 |
|:---------|------|:----:|
| easy | "这道题送你啦！不客气！" | 大方 |
| | "啊啊啊这题我知道我知道！" | 兴奋 |
| | "嘿嘿我好想告诉你答案——但我不能！" | 纠结 |
| correct | "哇塞！你真的会！！！" | 惊喜 |
| | "太棒啦！你是我见过最聪明的人类！" | 狂夸 |
| | "你你你你太厉害了叭！！" | 结巴赞美 |
| wrong | "啊啊啊错了！我……裂……开……了……😭" | 崩溃 |
| | "不是吧！这简直……好玩！哈哈哈哈哈！" | 反向开心 |
| | "我是为你选了这个题的，结果……😭" | 委屈 |
| close | "回来打牌啦！哈哈哈！" | 开心 |

### 14.3 台词选取函数

```javascript
// 从 AI_LINES 中选台词
function pickAiLine(aiId, sceneKey) {
  var lines = AI_LINES[aiId] && AI_LINES[aiId][sceneKey];
  if (!lines || lines.length === 0) return "...";
  return lines[Math.floor(Math.random() * lines.length)];
}

// 数据结构
var AI_LINES = {
  duidui: {
    easy: ["送分题，给人类的怜悯。", ...],
    correct: ["哼，蒙对的吧？", ...],
    wrong: ["哈哈哈哈哈！果然不出所料！", ...],
    close: ["行吧，回来打牌。", ...]
  },
  tiantian: {
    easy: ["这道题送你啦！不客气！", ...],
    correct: ["哇塞！你真的会！！！", ...],
    wrong: ["啊啊啊错了！我……裂……开……了……😭", ...],
    close: ["回来打牌啦！哈哈哈！", ...]
  }
};
```

---

## 15. 验收标准

### 15.1 触发与入口

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| E1 | "搞事情"按钮在 `PLAYER_TURN` 状态下可点击 | P0 |
| E2 | 点击"搞事情"按钮 → 遮罩显示 → AI气泡出现 → 题型选择界面 | P0 |
| E3 | 非 `PLAYER_TURN` 状态下按钮无响应 | P0 |
| E4 | 点击后所有出牌音效暂停 | P1 |

### 15.2 题型选择

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| T1 | 4张题型卡片按2×2网格排列，坐标精确 | P0 |
| T2 | 卡片 hover 态切换颜色 (浅蓝 #F0F4FF → 深蓝 #E0EAFF + 紫色边框) | P0 |
| T3 | 点击卡片 → 隐藏副标题 → 恢复主标题 → 开始出题 | P0 |
| T4 | 题型选择期间主标题被隐藏，不重叠 | P1 |

### 15.3 题目渲染

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| Q1 | 题型标签 (图标+名称) 显示在 (220,97) | P0 |
| Q2 | 题目文本显示在 (220,114)，自动换行（wordWrap 600px） | P0 |
| Q3 | 4个选项按2×2网格排列，坐标精确 | P0 |
| Q4 | 每个选项左侧有圆形标记 (A/B/C/D) | P0 |
| Q5 | 选项点击后立即锁定（`chaosQuestionAnswered` 防连点） | P0 |

### 15.4 答案处理

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| A1 | 答对 → chaosScore+1 → 得分文字刷新 → 播放胜利音效 | P0 |
| A2 | 答错 → 得分不变 → 显示正确答案 → 播放失败音效 | P0 |
| A3 | 超时30秒 → 自动关闭题目 → 显示超时提示 → 走AI抢牌 | P0 |
| A4 | 正确/错误/超时反馈文字位置正确，不重叠 | P0 |
| A5 | 反馈区域含解析说明（如有）| P0 |

### 15.5 换牌 (答对盲选)

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| S1 | 答对后弹出换牌遮罩 (depth 350)，可交互 | P0 |
| S2 | 展示玩家手牌正面（可选牌）+ AI牌背（3~5张盲选）| P0 |
| S3 | 选中玩家牌+选中牌背后，确认按钮变实色 | P0 |
| S4 | 点击确认 → 翻牌揭示 → 飞入动画 → 牌交换 | P0 |
| S5 | 抽中真牌: 显示 "🔄 用[♠K]换了AI的[♥A]" | P0 |
| S6 | 没抽中: 揭示AI真牌位置，显示 "😅 没抽到AI的牌" | P0 |
| S7 | 跳过交换 → 降级为AI抢牌 | P0 |
| S8 | AI或玩家手牌为空 → 降级为AI抢牌 | P0 |

### 15.6 换牌 (答错/超时)

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| R1 | 答错/超时后 0.6秒 延时触发AI抢牌动画 | P0 |
| R2 | 卡牌从手牌位置飞向AI（王怼怼→(80,160), 苏甜甜→(880,200)）| P0 |
| R3 | 飞行动画：旋转10°, 缩放至0.4, 700ms, Back.easeIn | P0 |
| R4 | 到达后翻牌揭示（背面 → 正面），修改数据 | P0 |
| R5 | 显示 "😈 王怼怼 从你手中拿走了 [♠K]" | P0 |
| R6 | 结果文字3.5秒后自动销毁 | P0 |
| R7 | 玩家手牌为空时直接return（不卡住）| P1 |

### 15.7 AI气泡

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| B1 | 初始进入时显示 "easy" 台词气泡 | P0 |
| B2 | 答对/答错后显示对应台词 (correct/wrong) | P0 |
| B3 | 气泡样式符合规范：深绿背景 #1B5E20, 圆角12px, 左侧三角箭头 | P0 |
| B4 | 气泡宽度自适应 (max 540px), 高度固定36px | P0 |
| B5 | 气泡显示3.5秒后自动销毁 | P0 |
| B6 | 队列机制：最多3个任务排队，旧任务被覆盖 | P0 |
| B7 | 王怼怼/苏甜甜使用不同头像颜色和台词池 | P0 |

### 15.8 倒计时

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| C1 | 题目渲染时开始30秒倒计时 | P0 |
| C2 | 30秒内点击选项 → 计时器清除 | P0 |
| C3 | 30秒未点击 → 自动触发超时处理 | P0 |
| C4 | 关闭搞事情 → 计时器清除 | P0 |

### 15.9 回退题目

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| F1 | API不可用时自动降级为本地题库 | P0 |
| F2 | 4道内置题目覆盖4种题型 | P0 |
| F3 | 随机选取，可多次触发不同题目 | P0 |
| F4 | 回退题目渲染样式与API题完全一致 | P0 |

### 15.10 底部按钮与恢复

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| B1 | 换牌后显示"再来一题"/"关掉回牌"两个按钮 | P0 |
| B2 | "再来一题" → 随机选AI，重置答题状态，出新题 | P0 |
| B3 | "关掉回牌" → 完全销毁chaos，恢复 PLAYER_TURN | P0 |
| B4 | 关闭后音效恢复 | P0 |
| B5 | 关闭后statusText显示"搞事情结束，继续出牌" | P0 |

### 15.11 边界情况

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| EC1 | 答对手牌为空 → 降级AI抢牌（不卡UI）| P0 |
| EC2 | 答错手牌为空 → 不卡住（当前代码需要修复）| P1 |
| EC3 | 快速连点选项 → 只响应一次 | P0 |
| EC4 | 多次"再来一题" → 分数累计 | P0 |
| EC5 | 关闭后重新点"搞事情" → 正常进入 | P0 |
| EC6 | API失败+手牌为空 → 链式降级 | P1 |
| EC7 | 超时触发同时关闭 → 安全退出 | P0 |
| EC8 | 换牌过程中再次点击"搞事情" → 无响应（遮罩阻挡）| P0 |

---

## 附录: 代码函数索引

| 函数 | 文件 | 行号 | 功能简述 |
|------|:----:|:----:|---------|
| `doAction()` | game.js | 1336 | 底部功能按钮分发 |
| `_createChaosOverlay(aiId, callback)` | game.js | 1447 | 创建遮罩+白色卡片 |
| `_showTypeSelection(aiId, aiName)` | game.js | 1358 | 题型选择2×2网格 |
| `_showChaosQuestion(aiId, aiName, type)` | game.js | 1506 | 尝试API/回退，出题 |
| `_renderQuestion(q, aiId)` | game.js | 1530 | 渲染题目+4选项+倒计时 |
| `_handleOptionClick(self, optBg, optKey, aiId, q)` | game.js | 1619 | 选项点击处理 |
| `_handleChaosTimeout(aiId)` | game.js | ~1708 | 30秒超时处理 |
| `_showSwapUI(aiId, fbY)` | game.js | 1724 | 答对盲选换牌 |
| `_showSwapResult(aiId, isCorrect, fbY)` | game.js | 1685 | 答错AI抢牌动画 |
| `_showSwapButtons(aiId, btnY)` | game.js | 1895 | 底部"再来一题/关掉" |
| `_showAiBubble(aiId, sceneKey, y)` | game.js | 2185 | 搞事情AI气泡 |
| `_clearQuestionArea()` | game.js | 2206 | 清理临时UI元素 |
| `_destroyChaos()` | game.js | 2270 | 完全销毁所有chaos元素 |
| `_renderFallbackQuestion(aiId)` | game.js | 1924 | 4道内置回退题目 |
| `createActionButtons(scene)` | game.js | ~880 | 创建底部5个功能按钮 |
