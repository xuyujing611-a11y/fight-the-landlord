# PRD: 换牌机制（答对/答错/超时三路流程细化）

**版本:** v1.0  
**作者:** 产品老大  
**日期:** 2026-05-02  
**文档编号:** PRD-FTL-SWAP-001  
**对应文件:** `src/client/js/game.js` (Phaser 3, 960×600 横屏)

---

## 目录

1. [需求概述](#1-需求概述)
2. [流程总图](#2-流程总图)
3. [答对流程 — 盲选交换（_showSwapUI 重写）](#3-答对流程--盲选交换)
4. [答错流程 — AI抢牌（_showSwapResult 重写）](#4-答错流程--ai抢牌)
5. [超时流程 — 等同于答错](#5-超时流程--等同于答错)
6. [动画规格](#6-动画规格)
7. [边缘情况处理](#7-边缘情况处理)
8. [数据同步](#8-数据同步)
9. [验收标准](#9-验收标准)

---

## 1. 需求概述

### 1.1 用户故事

> 我答完题后，如果答对，可以从AI的手牌里盲选一张换走。如果答错或超时，AI会抢走我一张牌。这能增加答题的紧张感和决策趣味。

### 1.2 触发时机

答题完毕后立即触发（`_onChaosAnswer` callback 末尾），根据 `isCorrect` 进入不同分支：

| 答题结果 | 触发函数 | 交互方式 |
|----------|----------|----------|
| ✅ 答对 | `_showSwapUI(aiId, fbY)` | 玩家盲选交换 |
| ❌ 答错 | `_showSwapResult(aiId, false, fbY)` | AI随机抢牌 + 动画 |
| ⏱ 超时 | `_showSwapResult(aiId, false, fbY)` | 等同于答错 |

### 1.3 当前代码对应行

| 函数 | 起始行 | 状态 |
|------|--------|------|
| `_showSwapUI` | L1724 | 现有，需改造 |
| `_showSwapResult` | L1685 | 现有，需改造 |
| `_showSwapButtons` | L1895 | 现有，保留 |

---

## 2. 流程总图

```
答题完成
    │
    ├─ ✅ 答对 ──→ _showSwapUI()
    │                  │
    │                  ├─ AI手牌显示为背面（3-5槽位，其中1张有牌）
    │                  ├─ 玩家手牌正面显示，选1张
    │                  ├─ 玩家盲选AI的一张槽位
    │                  ├─ [确认交换] → 双方交换 | [跳过交换] → 等同于答错
    │                  └─ _showSwapButtons() 按钮组
    │
    ├─ ❌ 答错 ──→ _showSwapResult()
    │                  │
    │                  ├─ AI随机从玩家手牌拿1张
    │                  ├─ 卡牌飞行动画 Y:345→160
    │                  ├─ 卡牌翻转揭示
    │                  ├─ 自动执行，无需确认
    │                  └─ _showSwapButtons() 按钮组
    │
    └─ ⏱ 超时 ──→ _showSwapResult(false)
                       │
                       ├─ 30秒倒计时条耗尽
                       ├─ 显示"⏱ 超时了！"
                       ├─ AI随机从玩家手牌拿1张
                       └─ 卡牌飞行动画（同答错）
```

---

## 3. 答对流程 — 盲选交换

### 3.1 界面布局 (960×600)

```
┌──────────────────────────────────────────────────────────────┐
│                🔄 交换牌 — 选一张你的牌 + AI的一张牌          │  ← Y=120 标题
│                点你的牌 → 点AI的牌 → 点确认交换               │  ← Y=142 提示
│                                                              │
│   ┌──────────────────────── AI 手牌 (背面朝上) ──────────┐   │
│   │  [🂠] [🂠] [🂠] [🂠] [🂠]    ← 3-5个背面槽位          │   │
│   │         ↑ 其中1张有真实牌，其余空                      │   │  ↑
│   └──────────────────────────────────────────────────────┘   │  Y175-250
│                                                              │
│   ┌──────────────────────── 你的手牌 (正面) ────────────┐   │
│   │  [♠A] [♥K] [♦Q] [♣J] [♠10]    ← 选1张              │   │  ↑
│   └──────────────────────────────────────────────────────┘   │  Y300-370
│                                                              │
│       ┌───────────┐              ┌───────────┐               │
│       │ ✅ 确认交换 │              │ ✖ 跳过交换 │               │  Y=390-434
│       └───────────┘              └───────────┘               │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 精确坐标表

#### 3.2.1 标题区

| 元素 | 内容 | X | Y | 字号 | 颜色 | Depth |
|------|------|---|---|------|------|-------|
| 遮罩 | 半透明黑 | 0 | 0 | 960×600 | `0x000000` opacity 0.6 | 350 |
| 标题 | 🔄 交换牌 — 选一张你的牌 + {AI名}的一张牌 | 480 | 120 | 15px | `#FFD700` bold | 351 |
| 提示 | 点你的牌 → 点{AI名}的牌 → 点确认交换 | 480 | 142 | 11px | `#AAAAAA` | 351 |

#### 3.2.2 AI 手牌区（盲选槽位）

| 元素 | 描述 | 值 |
|------|------|-----|
| AI区域标签 | "{AI名} 的手牌（盲选一张）" | X=480, Y=172, 12px, `#FFB74D` bold, Depth 351 |
| 槽位数 | 固定5个 | 3-5个背面卡牌图像 |
| 卡牌尺寸 | 背面：w=38, h=54 | 选中高亮：+6px |
| 卡牌重叠 | overlap=26 | — |
| 总宽度计算 | 38 + (n-1)×26 | 起始 X = (960 - totalW) / 2 |
| 基准 Y | 200 | Depth 352 |
| 真实牌 | 5个槽位中随机选1个放真实AI牌 | 其余4个槽位为空（仅显示背面） |
| 选中高亮 | 选中槽位 w+6, h+6, Depth 355 | 取消选中恢复 w, h, Depth 352 |

**关键改动（对比现有代码）：**
- AI手牌不再正面显示，改为背面（`'cardBack'` 纹理）
- 5个槽位，只有随机1个含有真实AI卡牌数据
- 玩家点击背面槽位时，如果该槽位有真实牌则选中它；如果为空则提示"这格没有牌"
- 选中后，该槽位的背面牌依然显示背面（不揭示），保持盲选

#### 3.2.3 玩家手牌区

| 元素 | 描述 | 值 |
|------|------|-----|
| 标签 | "你的手牌（点击选一张）" | X=480, Y=300, 12px, `#4FC3F7` bold, Depth 351 |
| 卡牌尺寸 | 正面：w=44, h=64 | 选中高亮：+6px |
| 重叠 | overlap=30 | — |
| 基准 Y | 330 | Depth 352 |
| 排序 | 按 `Doudizhu.sortCards()` | 正面显示，牌面可见 |
| 选中高亮 | 选中牌 w+6, h+6, Depth 355, Y微调-8 | 取消恢复 |

#### 3.2.4 按钮区

| 按钮 | 内容 | X | Y | W×H | 颜色 | 圆角 | Depth | 交互状态 |
|------|------|---|---|-----|------|------|-------|---------|
| 确认 | ✅ 确认交换 | 背景:240 | 390 | 200×44 | `#4ECDC4` (full=1, disabled=0.5) | 10px | 353 | 两牌都选才激活 |
| 确认文案 | — | 340 | 412 | — | `#FFFFFF` 15px bold | — | 354 | 同背景 |
| 跳过 | ✖ 跳过交换 | 背景:520 | 390 | 200×44 | `#78909C` | 10px | 353 | 始终可点 |
| 跳过文案 | — | 620 | 412 | — | `#FFFFFF` 15px bold | — | 354 | 始终可点 |

**"确认交换" 激活规则：**
- 玩家选好1张手牌 + AI盲选到含真实牌的槽位 → 按钮全亮 (`fillStyle(0x4ECDC4, 1)`)
- 任意一项未选 → 按钮半透明 (`fillStyle(0x4ECDC4, 0.5)`)，点击无反应
- 选中后无法取消？允许重新点击取消：再次点击已选中项取消选择

### 3.3 交互流程

```
1.  _showSwapUI() 调用
    │
2.  绘制遮罩 + 标题 + 提示文案
    │
3.  绘制AI手牌区：
    ├─ 获取AI手牌，随机选1张作为"真实牌"
    ├─ 计算需要显示5个槽位（不管AI手牌数量）
    ├─ 随机决定真实牌放在哪个槽位 index [0..4]
    ├─ 所有5个槽位都显示 cardBack 纹理
    └─ 只有真实牌槽位存储真正的卡牌数据
    │
4.  绘制玩家手牌区：
    ├─ 排序玩家手牌
    └─ 全部正面显示
    │
5.  玩家点击AI槽位：
    ├─ 如果该槽位有真实牌 → 选中（高亮）
    ├─ 如果已选中其它槽位 → 取消旧选中，高亮新槽位
    └─ 如果该槽位为空 → 弹出 toast "这格没有牌"，无反应
    │
6.  玩家点击自己的手牌：
    ├─ 选中（高亮+Y微调）
    └─ 如果已选中其它牌 → 取消旧选中，高亮新牌
    │
7.  点击 [确认交换]：
    ├─ 检查两牌是否都选中 → 否：无反应
    ├─ 从双方 hand array 中 swap 卡牌
    ├─ 播放交换成功动画
    ├─ 销毁 swapElements
    ├─ 显示弹窗 "🔄 交换成功！用[x]换了[y]"（3500ms自动消失）
    ├─ renderPlayerHand()
    ├─ updateAICount()
    └─ _showSwapButtons()
    │
8.  点击 [跳过交换]：
    ├─ 销毁 swapElements
    └─ 进入答错流程 _showSwapResult(aiId, false, fbY)
```

### 3.4 卡牌数据随机化逻辑（伪代码）

```js
function setupBlindSlots(aiHand):
  // aiHand: 排序后的 AI 手牌数组
  // 固定 5 个槽位
  totalSlots = 5
  realCardCount = Math.min(1, aiHand.length)  // 最多1张真实牌
  // 从 AI 手牌中随机选 1 张作为真实牌
  realCard = aiHand[randomIndex(0, aiHand.length-1)]
  realSlotIndex = randomIndex(0, 4)  // 放在5个槽位中的随机位置

  slots = []
  for i = 0 to 4:
    if i === realSlotIndex && realCardCount > 0:
      slots[i] = { card: realCard, hasCard: true }
    else:
      slots[i] = { card: null, hasCard: false }
  return slots
```

---

## 4. 答错流程 — AI抢牌

### 4.1 _showSwapResult() 重写

**触发条件：** 答错题目后自动执行，无需玩家确认。

### 4.2 界面布局

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│          😈 {AI名} 从你手中拿走了一张牌！                     │  ← Y=184
│                    [♦K]                                       │  ← Y=206
│                                                              │
│                   ┄┄┄ 卡牌飞行轨迹 ┄┄┄                        │
│       起点: Y=345（玩家手牌区）                                │
│       终点: Y=160（AI手牌区）                                  │
│       旋转: +10°, 缩放: →60%                                  │
│                                                              │
│                                                              │
│      ┌───────────┐              ┌───────────┐                │
│      │ 🔄 再来一题 │              │ ✖ 关掉回牌 │                │  btnY
│      └───────────┘              └───────────┘                │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 执行步骤

```
1.  随机从 playerHand 中选一张卡牌（index = Math.floor(Math.random() * playerHand.length)）
    │
2.  从 playerHand.splice(index, 1) 移除该牌
    │
3.  将该牌 push 到 aiHand 中
    │
4.  显示文案：
    ├─ "😈 {AI名} 从你手中拿走了一张牌！"    X=480, Y=184, 15px, #FF6B35
    └─ "[suit rank]"                         X=480, Y=206, 13px, #FFFFFF
    （3500ms后自动销毁）
    │
5.  执行卡牌飞行动画（见 §6.2）
    ├─ 起始位置: 玩家手牌区中的对应卡牌 X坐标、Y=345
    ├─ 一个背面卡牌图像从起始位置飞入 AI 区域
    └─ 落地后从背面翻转为正面，显示卡牌内容
    │
6.  动画完成后：
    ├─ renderPlayerHand()
    ├─ updateAICount()
    └─ _showSwapButtons()
```

**注意：** 答错流程没有"确认"步骤，动画结束后直接显示按钮。

---

## 5. 超时流程 — 等同于答错

### 5.1 新增：倒计时组件

在 `_showSwapUI` 中新增 30s 倒计时条，在答对界面上方运行。

### 5.2 计时条规格

```
X=220  Y=144  W=520  H=6
┌──────────────────────────────────────────────────────────────┐
│ ████████████████████████████████████████████████████████████ │  ← 绿色 (#4CAF50)
│ ████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← 黄色 (#FFC107) <15s
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← 红色 (#FF5252) <5s
└──────────────────────────────────────────────────────────────┘
Depth: 353
```

| 属性 | 值 |
|------|-----|
| 矩形 | X=220, Y=144, W=520, H=6 |
| 背景 | `fillStyle(0x333333, 0.6)` 先画满底 |
| 填充色变化 | ≥15s: `#4CAF50` (绿); 5~15s: `#FFC107` (黄); <5s: `#FF5252` (红) |
| 更新频率 | 每帧 (Phaser `update()` 或 `self.time.addEvent`) |
| 时长 | 30 秒 |
| Depth | 353 |

### 5.3 计时器逻辑

```js
// 在 _showSwapUI 内部新增
var swapTimerDuration = 30000;  // 30s
var swapTimerElapsed = 0;
var timerBar = self.add.graphics().setDepth(353);
var timerBg = self.add.graphics().setDepth(352);
timerBg.fillStyle(0x333333, 0.6);
timerBg.fillRect(220, 144, 520, 6);

// 每帧更新
var timerEvent = self.time.addEvent({
  delay: 1000 / 60,  // 60fps
  loop: true,
  callback: function() {
    swapTimerElapsed += self.game.loop.delta;
    var progress = Math.min(swapTimerElapsed / swapTimerDuration, 1);
    var remaining = swapTimerDuration - swapTimerElapsed;

    // 颜色：剩余时间决定
    var color = remaining > 15000 ? 0x4CAF50 : (remaining > 5000 ? 0xFFC107 : 0xFF5252);
    var barWidth = 520 * (1 - progress);

    timerBar.clear();
    timerBar.fillStyle(color, 1);
    timerBar.fillRect(220, 144, barWidth, 6);

    // 超时
    if (swapTimerElapsed >= swapTimerDuration) {
      timerEvent.remove();
      // 销毁 swapElements 并触发答错流程
      for (var ei = 0; ei < swapElements.length; ei++) swapElements[ei].destroy();
      // 显示超时消息
      var timeoutMsg = self.add.text(480, 184, '⏱ 超时了！', {
        fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
        fontSize: '15px', color: '#FF5252', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(310);
      self.chaosElements.push(timeoutMsg);
      self.time.delayedCall(1000, function() {
        if (timeoutMsg) timeoutMsg.destroy();
        self._showSwapResult(aiId, false, fbY);
      });
    }
  }
});
```

### 5.4 超时后的行为

- 等同于答错流程（`_showSwapResult(aiId, false, fbY)`）
- 显示 "⏱ 超时了！" 消息（1s后消失）
- AI 随机从玩家手牌拿 1 张（卡牌飞行动画同答错）

---

## 6. 动画规格

### 6.1 答对 — 交换成功动画

**触发时机：** 玩家点击 [确认交换] 且两牌都选中

| 参数 | 值 |
|------|-----|
| 动画总时长 | 1200ms |
| 类型 | Phaser 3 Tween chain |

```js
// 自玩家手牌飞向 AI 槽位
self.tweens.add({
  targets: playerCardImg,   // 玩家选中的卡牌图像
  x: aiSlotX,               // AI对应槽位的 X 坐标
  y: 200,                   // AI区域 Y
  angle: 15,                // 轻微旋转 15°
  scaleX: 38/44,            // 从 w=44 缩到 w=38 → ~0.86
  scaleY: 54/64,            // 从 h=64 缩到 h=54 → ~0.84
  duration: 600,
  ease: 'Power2',
  onComplete: function() {
    // AI牌飞向玩家
    self.tweens.add({
      targets: aiCardImg,   // AI被换走的卡牌图像
      x: playerCardX,       // 玩家原来卡牌的 X 坐标
      y: 330,               // 玩家区域 Y
      angle: -10,           // 反向旋转 -10°
      scaleX: 44/38,        // 从 w=38 扩到 w=44 → ~1.16
      scaleY: 64/54,        // 从 h=54 扩到 h=64 → ~1.19
      duration: 600,
      ease: 'Power2'
    });
  }
});
```

### 6.2 答错/超时 — AI抢牌飞行

**触发时机：** AI 从玩家手牌拿走一张时

**飞行路径：** 玩家手牌区 (Y=345) → AI 手牌区 (Y=160)

#### 坐标表

| 阶段 | 属性 | 起始值 | 结束值 | 时长 | 缓动 |
|------|------|--------|--------|------|------|
| 🚀 起飞 | X | 玩家选中牌的当前X | 玩家选中牌的当前X + 居中偏移 | 1200ms | Power2 |
| | Y | 345 | 160 | 同上 | Power2 |
| | 角度 | 0° | 10° | 同上 | — |
| | 缩放 | 1.0 (56×80) | 0.6 (33×48) | 同上 | — |
| 🔄 翻转 | 纹理 | cardBack | 真实卡牌正面 | 在终点触发 | 瞬时 |

```js
// 获取玩家手牌中对应卡牌在渲染后的 X 坐标
// 复用 renderPlayerHand 中的渲染坐标计算
var n = self.playerHand.length;
var overlap = n > 6 ? Math.min(33, (700 - 56) / (n - 1)) : 33;
var totalWidth = 56 + (n - 1) * overlap;
var startX = 180 + (700 - totalWidth) / 2;
var cardX = startX + lostIdx * overlap + 28;  // 56/2

// 创建背面卡牌
var flyCard = self.add.image(cardX, 345, 'cardBack')
  .setDisplaySize(56, 80).setDepth(400);

// AI 最终位置居中
var aiCount = aiHand.length;
var aiTotalW = 38 + (aiCount - 1) * 26;
var aiStartX = (960 - aiTotalW) / 2;
var aiTargetX = aiStartX + Math.floor(aiCount / 2) * 26 + 19;  // 插入中间

self.tweens.add({
  targets: flyCard,
  x: aiTargetX,
  y: 160,
  angle: 10,
  scaleX: 0.6,
  scaleY: 0.6,
  duration: 1200,
  ease: 'Power2',
  onComplete: function() {
    // 翻牌：背面→正面
    flyCard.setTexture(getCardImageKey(lostCard));
    flyCard.setDisplaySize(38, 54);  // AI 手牌标准尺寸
    flyCard.setAngle(0);
    flyCard.setDepth(352);
    // 1s 后消失
    self.time.delayedCall(1000, function() {
      if (flyCard) flyCard.destroy();
    });
  }
});
```

### 6.3 动画时间线汇总

| 事件 | 时间 | 说明 |
|------|------|------|
| 答对确认 | T=0 | 触发 swap，开始飞行 |
| | T=600ms | 玩家牌飞到AI位 |
| | T=1200ms | AI牌飞到玩家位，完成 |
| | T=1200ms | 显示交换成功文案 |
| | T=4700ms | 文案消失 |
| —— | —— | —— |
| 答错/超时 | T=0 | 触发 swap，背面卡起飞 |
| | T=1200ms | 卡牌到达AI位，翻牌揭示 |
| | T=1400ms | 显示拿走文案 |
| | T=4900ms | 文案消失 |
| | T=4900ms | 按钮显示 |

---

## 7. 边缘情况处理

### 7.1 玩家手牌为空（playerHand.length === 0）

| 场景 | 处理 |
|------|------|
| 答对触发 `_showSwapUI` | 不显示UI，直接 `return`（同样不会进入交换界面，数据不变） |
| 答错/超时触发 `_showSwapResult` | `if (!self.playerHand || self.playerHand.length === 0) return;` 直接跳过 |
| 日志 | 若有日志系统，打印 "playerHand empty, skip swap" |

**当前代码已覆盖：** `_showSwapUI` L1730 检查了空，`_showSwapResult` L1690 也检查了空。

### 7.2 AI 手牌为空（aiHand.length === 0）

| 场景 | 处理 |
|------|------|
| 答对触发 `_showSwapUI` | 所有 5 个盲选槽位均为空。玩家选到任何槽位都提示"这格没有牌"。确认按钮永不可达。玩家只能点 [跳过交换] |
| `_showSwapUI` 入口检查 | 建议加预检：if (aiHand.length === 0) { self._showSwapResult(aiId, false, fbY); return; } |
| 答错 | 不受影响（AI 永远可以从 player 拿牌） |

### 7.3 双方手牌都为空

- `_showSwapUI` 预检查：`if (!aiHand || aiHand.length === 0 || !self.playerHand || self.playerHand.length === 0)` → 自动回退到 `_showSwapResult` → 但 `_showSwapResult` 也检查 playerHand 为空 → 直接 `return`
- 输出展示：直接跳到 `_showSwapButtons`

### 7.4 AI 手牌中已经有玩家即将换入的牌

- 换牌是 `splice` + `push`，不做去重检查
- **设计决策：** 允许手牌中存在相同牌（点数花色相同）。斗地主标准规则同一副牌不可能有重复牌，但在答题换牌场景中，作为特殊玩法机制，允许同名牌存在。
- 如果必须避免：在 swap 前检查 `aiHand` 中是否已存在相同 `suit+rank`，若存在则随机重新选择 AI 的牌（最多重试 3 次，仍然重复则跳过此张）

### 7.5 答对时 AI 手牌只有 1 张

- 盲选槽位仍然显示 5 个（只有 1 个是真牌），保持盲选体验
- 玩家选中空槽位的概率 4/5，未选中真实牌时不可确认

### 7.6 玩家点击 [确认交换] 时卡牌数据校验失败

```js
var pReal = -1;
for (var p = 0; p < self.playerHand.length; p++) {
  if (self.playerHand[p].suit === myCard.suit && self.playerHand[p].rank === myCard.rank)
    { pReal = p; break; }
}
if (pReal < 0) return;  // 数据不一致，不执行交换
```

---

## 8. 数据同步

### 8.1 必须调用的方法

每次 swap 操作完成后（无论答对、答错、超时），都必须调用：

```js
// 刷新玩家手牌渲染
self.renderPlayerHand();

// 刷新 AI 手牌计数
// aiIndex: 0 = ai1 (王怼怼), 1 = ai2 (苏甜甜)
self.updateAICount(aiIndex);
```

### 8.2 同步时机对照表

| 流程 | 同步点 | 调用时机 |
|------|--------|----------|
| 答对 — 确认交换 | 确认按钮 `pointerup` 回调末尾 | swap 操作后立即 |
| 答对 — 跳过交换 | 跳过按钮 `pointerup` 回调 → `_showSwapResult` → 动画完成回调末尾 | 动画完成后 |
| 答错 | `_showSwapResult` 内数据操作后 | 文案显示后、按钮显示前 |
| 超时 | `_showSwapResult` 内（同答错） | 同上 |

### 8.3 AI 手牌排序

交换后 AI 手牌需要维护排序：

```js
aiHand.sort(function (a, b) {
  return a.rank !== b.rank ? b.rank - a.rank : a.suit - b.suit;
});
```

### 8.4 渲染安全

- 调用 `renderPlayerHand()` 前无需手动 `destroy` DOM 元素——`renderPlayerHand` 内部已清空 `cardDomElements`
- `updateAICount()` 仅更新文本，无销毁风险

---

## 9. 验收标准

### 9.1 答对流程验收

| # | 验收项 | 预期行为 | 通过条件 |
|---|--------|----------|----------|
| A1 | 进入交换界面 | 遮罩 + 标题 + AI背牌槽位 + 玩家正面手牌 + 两个按钮 | UI 元素坐标、颜色、字号与设计稿一致 |
| A2 | 玩家选自己的牌 | 选中一张手牌，高亮 (+6px, Y-8) | 再次点击取消选中 |
| A3 | 玩家盲选 AI 槽位 | 点击有空牌的槽位→选中；点击空槽位→toast "这格没有牌" | 选中后高亮显示 |
| A4 | 确认按钮激活状态 | 两牌都选中→全亮；缺任意→半透明且不可点击 | 点击半透明按钮无反应 |
| A5 | 执行交换 | 双方手牌正确 swap，数据一致 | `console.log` 验证双方 hand array |
| A6 | 交换成功动画 | 两卡牌交叉飞行 1200ms，旋转缩放正确 | 肉眼检查动画流畅 |
| A7 | 成功文案 | 🔄 交换成功！用[x]换了[y] 显示 3500ms | 自动消失 |
| A8 | 跳过交换 | 点击后等同于答错流程 | AI 随机拿牌 + 飞行动画 |

### 9.2 答错流程验收

| # | 验收项 | 预期行为 | 通过条件 |
|---|--------|----------|----------|
| B1 | AI 随机从玩家手牌拿牌 | playerHand.length -1, aiHand.length +1 | 拿走的牌在 aiHand 中，不在 playerHand 中 |
| B2 | 飞行动画 | 背面牌从玩家区 Y:345→AI区 Y:160，旋转10°，缩放60% | 1200ms 内完成 |
| B3 | 翻牌揭示 | 终点处背面→正面，显示真实卡牌内容 | 1s 后消失 |
| B4 | 文案显示 | "😈 {AI名} 从你手中拿走了一张牌！[suit rank]" | 3500ms 后消失 |
| B5 | 自动触发 | 无需确认，动画 + 文案自动播放 | 无交互式等待 |

### 9.3 超时流程验收

| # | 验收项 | 预期行为 | 通过条件 |
|---|--------|----------|----------|
| C1 | 计时条显示 | X=220 Y=144 W=520 H=6，Depth=353 | 与背景区分 |
| C2 | 计时条颜色变化 | ≥15s 绿, 5~15s 黄, <5s 红 | 肉眼验证过渡平滑 |
| C3 | 30s 超时触发 | 30s 后自动销毁 swapUI，显示 "⏱ 超时了！" | 1s 后进入答错流程 |
| C4 | 超时后行为 | 等同于答错（AI 拿牌 + 飞行动画） | 卡牌数据同步正确 |

### 9.4 边缘情况验收

| # | 验收项 | 预期行为 | 通过条件 |
|---|--------|----------|----------|
| D1 | playerHand 为空 | `_showSwapUI` 回退到 `_showSwapResult`；`_showSwapResult` 直接 `return` | 不崩溃，不报错 |
| D2 | aiHand 为空 | `_showSwapUI` 所有槽位空，只能点跳过 | 无错误 |
| D3 | 双方都空 | 全部跳过，直接显示按钮 | 无错误 |
| D4 | 换入同名牌 | 允许（手牌中出现重复的点数花色） | 或者按去重规则处理 |

### 9.5 数据同步验收

| # | 验收项 | 预期行为 | 通过条件 |
|---|--------|----------|----------|
| E1 | 每次 swap 后调用 `renderPlayerHand()` | 手牌重新渲染，显示正确张数和牌面 | 手牌区域无残留旧牌 |
| E2 | 每次 swap 后调用 `updateAICount()` | AI 剩余张数计数器更新 | 文本与实际 hand.length 一致 |
| E3 | AI 手牌排序 | swap 后按 rank 倒序 + suit 排序 | `console.log(aiHand)` 验证 |

---

## 附录 A：改动清单

| 文件 | 函数 | 改动类型 | 说明 |
|------|------|----------|------|
| `game.js` | `_showSwapUI` | **重写** | AI 手牌改为背面盲选 5 槽位 + 定时器条 |
| `game.js` | `_showSwapResult` | **改造** | 添加卡牌飞行 + 翻牌动画 |
| `game.js` | — | **新增** | 倒计时组件（30s timer bar） |
| `game.js` | `renderPlayerHand` | 代码复用 | 无需改动 |
| `game.js` | `updateAICount` | 代码复用 | 无需改动 |
| `game.js` | `_showSwapButtons` | 代码复用 | 无需改动 |

## 附录 B：常量汇总

```js
// 布局常量
SWAP_UI = {
  OVERLAY_DEPTH: 350,
  TITLE_DEPTH: 351,
  HINT_DEPTH: 351,
  CARD_DEPTH: 352,
  CARD_SELECTED_DEPTH: 355,
  BUTTON_DEPTH: 353,
  BUTTON_TEXT_DEPTH: 354,
  TIMER_DEPTH: 353,
  TIMER_BG_DEPTH: 352,
  FLY_CARD_DEPTH: 400,

  TITLE_Y: 120,
  HINT_Y: 142,
  TIMER_X: 220,
  TIMER_Y: 144,
  TIMER_W: 520,
  TIMER_H: 6,
  TIMER_DURATION: 30000,  // ms

  AI_LABEL_Y: 172,
  AI_CARD_Y: 200,
  AI_CARD_W: 38,
  AI_CARD_H: 54,
  AI_OVERLAP: 26,
  AI_SLOT_COUNT: 5,

  PLAYER_LABEL_Y: 300,
  PLAYER_CARD_Y: 330,
  PLAYER_CARD_W: 44,
  PLAYER_CARD_H: 64,
  PLAYER_OVERLAP: 30,

  CONFIRM_X: 240,
  CONFIRM_Y: 390,
  CONFIRM_W: 200,
  CONFIRM_H: 44,
  CANCEL_X: 520,
  CANCEL_Y: 390,
  CANCEL_W: 200,
  CANCEL_H: 44,
};

// 动画常量
SWAP_ANIM = {
  FLY_DURATION: 1200,  // ms
  FLY_END_Y: 160,      // AI 区域 Y
  FLY_START_Y: 345,    // 玩家区域 Y
  FLY_ROTATION: 10,    // 度
  FLY_SCALE: 0.6,      // 缩放比
  REVEAL_DELAY: 1000,  // 翻牌后保留多久
  MSG_DURATION: 3500,  // 文案显示时长
};

// 计时条颜色
SWAP_TIMER_COLORS = {
  GREEN: 0x4CAF50,
  YELLOW: 0xFFC107,
  RED: 0xFF5252,
};
```
