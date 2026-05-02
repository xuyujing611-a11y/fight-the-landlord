# AI 气泡系统 (AIBubble) — 功能完整设计文档

**版本:** v3.0 (升级版)  
**作者:** 产品经理  
**日期:** 2026-05-02  
**基准画布:** 960×600 横屏 (Phaser 3 Scale.FIT)  
**对应源码:** `src/client/js/game.js` (2897行)  

---

> **本文档升级说明**  
> 相比之前的代码说明书，本文档采用 v2 标准：  
> ✅ 保留精确坐标/颜色/深度等代码参数  
> ✅ 覆盖所有交互流程（用户视角）  
> ✅ 标注代码已实现 vs 未实现的功能  
> ✅ 未实现项提供详细"应该怎么做"的实现方案  
> ✅ 边界情况穷举  
> ✅ 开发可按文档直接写代码

---

## 1. 用户视角功能描述

### 1.1 气泡系统整体行为

AI 气泡是斗地主游戏中的**角色对话系统**，在游戏过程中自动弹出 AI 角色的台词泡泡，模拟真人玩家之间的即时互动。

**用户预期：**

| 场景 | 用户会看到什么 | 为什么重要 |
|:-----|:---------------|:-----------|
| AI 出牌时 | AI 头像旁边弹出一句台词（如"顺子！让你一手"） | 让游戏有人情味，不机械 |
| AI 过牌时 | 气泡弹出"这轮我让让你" | 解释 AI 策略 |
| AI 出炸弹时 | 红色气泡放大弹入，闪烁边框，"核弹级题目！" | 强调关键时刻 |
| 搞事情答对 | 白色卡片内气泡弹出"蒙对的吧？" | 强化角色性格 |
| 搞事情答错 | 白色卡片内气泡弹出"哈哈果然不出所料" | 角色互动感 |
| 两个AI连续出牌 | 气泡快速切换，不重叠不卡顿 | 不影响游戏节奏 |

### 1.2 核心交互流程

```
游戏进行中
  │
  ├─ AI1 王怼怼出牌
  │   └─ 头像旁弹出气泡 → 显示4秒 → 自动消失
  │       (如果1秒内AI2也出牌 → 气泡立即切换)
  │
  ├─ AI2 苏甜甜出牌
  │   └─ 头像旁弹出气泡 → 显示4秒 → 自动消失
  │
  ├─ AI 出炸弹/火箭
  │   └─ 紧急气泡 → 红色背景 → 边框闪烁 → 5秒停留
  │
  ├─ 玩家点击"搞事情"
  │   └─ 白色卡片内弹出气泡 → 3.5秒消失
  │
  └─ 搞事情答题后
      └─ 白色卡片内弹出气泡 → 显示3.5秒 → 自动消失
```

---

## 2. 气泡类型与触发规则

### 2.1 两套气泡系统

| 特性 | 出牌气泡 (_showPlayBubble) | 搞事情气泡 (_showAiBubble) |
|:-----|:-------------------------:|:-------------------------:|
| 触发场景 | AI出牌/过牌/炸弹 | 搞事情模式(进入/答对/答错/关闭) |
| 显示位置 | 出牌区上方 (Y=55) | 白色卡片内部 (y动态) |
| 气泡颜色 | 王怼怼:深绿/苏甜甜:深紫 | 统一深绿(#1B5E20) |
| 最大宽度 | 280px | 540px |
| 停留时间 | 4s (普通) / 5s (炸弹) | 3.5s |
| 队列系统 | 共享 `bubbleQueue` | 共享 `bubbleQueue` |
| 头像位置 | 王怼怼:左(80) / 苏甜甜:右(880) | 统一左侧(80) |
| 箭头方向 | 王怼怼:左 / 苏甜甜:右 | 统一左 |

### 2.2 触发规则全表

| 事件 | 调用函数 | event参数 | bubble类型 | 当前状态 |
|:-----|:---------|:---------:|:----------:|:--------:|
| AI1 普通出牌 | `_showPlayBubble('duidui', 'play', type)` | `play` | 出牌气泡 | ✅ 已实现 |
| AI1 出炸弹/火箭 | `_showPlayBubble('duidui', 'bomb', type)` | `bomb` | 出牌气泡(需紧急样式) | ⚠️ 已实现但缺样式 |
| AI1 过牌 | `_showPlayBubble('duidui', 'pass', '')` | `pass` | 出牌气泡 | ✅ 已实现 |
| AI2 普通出牌 | `_showPlayBubble('tiantian', 'play', type)` | `play` | 出牌气泡 | ✅ 已实现 |
| AI2 过牌 | `_showPlayBubble('tiantian', 'pass', '')` | `pass` | 出牌气泡 | ✅ 已实现 |
| 进入搞事情 | `_showAiBubble(aiId, 'easy', 180)` | `easy` | 搞事情气泡 | ✅ 已实现 |
| 答对题目 | `_showAiBubble(aiId, 'correct', fbY+10)` | `correct` | 搞事情气泡 | ✅ 已实现 |
| 答错题目 | `_showAiBubble(aiId, 'wrong', fbY+10)` | `wrong` | 搞事情气泡 | ✅ 已实现 |
| 关闭搞事情 | `_showAiBubble(aiId, 'close', fbY)` | `close` | 搞事情气泡 | ❌ 未实现(代码不触发) |

### 2.3 需补充的触发事件

**当前代码未实现的触发:**

1. **关闭搞事情时的气泡** — `_destroyChaos()` 中未调用 `_showAiBubble`，玩家关掉搞事情时没有告别台词。  
   **修复方案:** 在 `_destroyChaos()` 末尾 `setStatusText` 前插入：
   ```javascript
   self._showAiBubble(aiId, 'close', 180);
   // 注意: 需要_showAiBubble能独立于chaosElements渲染，或把气泡放在临时层
   ```

2. **玩家出牌后的气泡** — 玩家出牌时 AI 没有反应气泡。  
   **建议方案:** 玩家出牌后，随机一个 AI 弹出评价气泡（如"出得不错嘛"）。在 `confirmPlay()` 末尾加：
   ```javascript
   // 50%概率弹气泡评价玩家出牌
   if (Math.random() < 0.5) {
     var reactAiId = Math.random() < 0.5 ? 'duidui' : 'tiantian';
     self._showPlayBubble(reactAiId, 'react', info.type);
   }
   ```
   需要在 `AI_LINES` 中新增 `react` 台词池。

3. **玩家赢牌时的AI认输气泡** — 结算面板弹出前，AI 弹一句认输/祝贺台词。  
   **建议方案:** 在 `renderRoundEndPanel` 之前加：
   ```javascript
   // 先弹气泡再弹结算面板
   var loserAi = isPlayerWin ? (Math.random()<0.5?'duidui':'tiantian') : 'player';
   self._showPlayBubble(loserAi, isPlayerWin ? 'lose' : 'win', '');
   self.time.delayedCall(2500, function() {
     self.renderRoundEndPanel(winner);
   });
   ```

---

## 3. 布局与精确坐标

### 3.1 出牌气泡 — 当前代码实际值

| 元素 | 王怼怼 (duidui) | 苏甜甜 (tiantian) |
|:-----|:---------------:|:-----------------:|
| Y基准 | 55 | 55 |
| 头像圆心 | (80, 71) | (880, 71) |
| 头像半径 | 22 | 22 |
| 头像底色 | `#4FC3F7` (0x4FC3F7) | `#FFB74D` (0xFFB74D) |
| 外框 | 2px 白 0.6 | 2px 白 0.6 |
| 名字X | 105 | 685 (bubbleX - 5, origin=1,0) |
| 名字Y | 51 | 51 |
| 气泡X | **90** | **690** |
| 气泡Y | 65 | 65 |
| 气泡W | min(280, 140+lineLen×10) | 同左 |
| 气泡H | **36px 固定** | 同左 |
| 气泡圆角 | **12** | **4** |
| 气泡背景 | `#1B5E20` 0.85 | `#311B92` 0.85 |
| 气泡边框 | `#66BB6A` 1.5px 0.5 | `#CE93D8` 1.5px 0.5 |
| 箭头方向 | 向左 (指向头像) | 向右 (指向头像) |
| 文字X | bubbleX + 14 | bubbleX + 10 |
| 文字Y | bubbleY + 18 (居中) | 同左 |
| 文字大小 | 14px | 14px |
| depth(头像) | 20 | 20 |
| depth(文字) | 21 | 21 |

### 3.2 出牌气泡 — 期望行为

**⚠️ 当前代码问题：**
1. Y=55 太靠上，会与顶部状态栏重叠。期望 Y=96（状态栏下方）
2. 气泡高度固定 36px，长文本会溢出。期望自适应高度
3. 王怼怼气泡X=90，紧贴头像右侧。期望 X=100 留一点间距
4. 苏甜甜气泡X=690 是写死的，但气泡宽度会变化，导致离头像太远或太近。期望动态计算

**修复方案（修改 _showPlayBubble）：**

```javascript
var isDuidui = (aiId === 'duidui');
var y = 96;  // 原55改为96，出牌区上方空隙

// 苏甜甜气泡X动态计算
var bubbleX = isDuidui ? 110 : (avatarX - bubbleW - 30);
// 王怼怼气泡从头像右侧开始，苏甜甜气泡左侧对齐头像
```

### 3.3 搞事情气泡 — 当前代码实际值

| 元素 | 值 |
|:-----|:----|
| 头像X | **80** 固定 (始终左侧) |
| 头像Y | `y + 16` (y由调用者传入) |
| 头像半径 | 22 |
| 名字X | **105** |
| 名字Y | `y - 4` |
| 气泡X | **230** 固定 |
| 气泡Y | `y + 10` |
| 气泡W | min(540, 200 + lineLen×10) |
| 气泡H | **36px 固定** |
| 气泡圆角 | **12** |
| 气泡背景 | `#1B5E20` 0.85 |
| 气泡边框 | `#66BB6A` 1.5px 0.5 |
| 箭头 | 统一左 (指向左侧头像) |
| 文字X | bubbleX + 14 |
| 文字大小 | 14px |
| depth | 302-303 |

### 3.4 搞事情气泡 — 期望行为

**⚠️ 当前代码问题：**
1. 气泡高度固定 36px，文字长时会溢出
2. 宽度计算 `200 + lineLen×10` 可能超出白色卡片 (最大540但卡片宽660)

**修复方案：**
```javascript
// _showAiBubble 中的宽度动态计算
var maxBubbleW = 540;
var bubbleW = Math.min(maxBubbleW, 200 + line.length * 10);

// 气泡高度自适应
var textObj = self.add.text(x, y, line, {
  fontSize: '14px', wordWrap: { width: bubbleW - 28 }
}).setOrigin(0, 0.5);
var textBounds = textObj.getBounds();
var bubbleH = Math.max(36, textBounds.height + 20);  // +20 padding
```

---

## 4. 视觉规范 — 当前代码 vs 期望

### 4.1 出牌气泡颜色对比

| 属性 | 王怼怼(当前) | 王怼怼(期望) | 苏甜甜(当前) | 苏甜甜(期望) |
|:-----|:-----------:|:-----------:|:-----------:|:-----------:|
| 头像底色 | `#4FC3F7` | 不变 | `#FFB74D` | 不变 |
| 气泡背景 | `#1B5E20` 0.85 | 不变 | `#311B92` 0.85 | 不变 |
| 气泡边框 | `#66BB6A` 0.5 | 不变 | `#CE93D8` 0.5 | 不变 |
| 圆角 | 12 | 12 | 4 | 4 |
| 箭头方向 | 左 | 左 | 右 | 右 |
| 文字颜色 | `#FFFFFF` | `#E8F0FF` | `#FFFFFF` | `#E8F0FF` |

### 4.2 炸弹紧急样式 — 需新增

**当前代码在炸弹时仅停留时间不同(5s)，没有视觉区分。需要增加：**

```javascript
// _showPlayBubble 中 event === 'bomb' 时:
var isEmergency = (event === 'bomb');

// 1. 使用紧急背景色
var bubbleBgColor = isEmergency ? 0x500A00 : (isDuidui ? 0x1B5E20 : 0x311B92);

// 2. 使用紧急边框(更粗更亮)
var bubbleBorderColor = isEmergency ? 0xFF5252 : (isDuidui ? 0x66BB6A : 0xCE93D8);
var borderWidth = isEmergency ? 2 : 1.5;

// 3. 文字加粗+加阴影
var textStyle = isEmergency ? {
  fontSize: '16px', color: '#FFCDD2', fontStyle: 'bold',
  shadow: { blur: 10, color: '#FF5252', fill: true }
} : {
  fontSize: '14px', color: '#FFFFFF'
};

// 4. 边框闪烁
if (isEmergency) {
  self.tweens.add({
    targets: bubble,
    alpha: { from: 0.3, to: 0.9 },
    duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
  });
}

// 5. 弹入动画更夸张
if (isEmergency) {
  container.setScale(0.7).setAlpha(0);
  scene.tweens.add({
    targets: container,
    scale: 1.1, alpha: 1, duration: 100, ease: 'Back.easeOut',
    onComplete: function() {
      scene.tweens.add({ targets: container, scale: 1.0, duration: 80, ease: 'Sine.easeOut' });
    }
  });
}
```

### 4.3 搞事情气泡风格

搞事情气泡统一使用绿色调，不区分角色颜色（与出牌气泡区分开），视觉上更统一。

---

## 5. 动画系统 — 当前 vs 期望

### 5.1 当前状态

| 动画 | 当前代码 | 问题 |
|:-----|:---------|:-----|
| 气泡出现 | **无动画** — 即时 create/add | 看起来生硬 |
| 气泡消失 | **无动画** — 即时 destroy | 缺少过渡 |
| 炸弹特效 | **无** — 仅停留时间不同 | 炸弹没有视觉强调 |
| 气泡切换 | FIFO队列 | 快速出牌时气泡堆积 |

### 5.2 期望行为

```
气泡出现:
  container.setScale(0.8).setAlpha(0)
  → tween: scale 1.0, alpha 1.0, 150ms, Back.easeOut

气泡消失 (正常计时到):
  → tween: alpha 0, 200ms, Linear
  → onComplete: destroy + processBubbleQueue

炸弹出现:
  container.setScale(0.7).setAlpha(0)
  → tween: scale 1.1, alpha 1.0, 100ms, Back.easeOut
  → tween: scale 1.0, 80ms, Sine.easeOut
  → 边框闪烁: alpha 0.3↔0.9, 400ms, yoyo, repeat:-1

气泡切换 (快速连续):
  旧气泡 → 立即 destroy (无退出动画)
  新气泡 → 正常弹入动画
```

### 5.3 实现方案

**替换队列系统为直接替换模式：**

```javascript
// 去掉全局 bubbleQueue 和 processBubbleQueue
// 改为单槽位模式

var currentBubble = null;        // 当前显示的气泡容器(Container)
var currentBubbleTimer = null;   // 当前气泡的定时器

function showBubble(bubbleContainer, displayMs, isEmergency) {
  // 1. 如果有气泡在显示 → 立即销毁（不给退出动画）
  if (currentBubble) {
    if (currentBubbleTimer) {
      currentBubbleTimer.remove();
      currentBubbleTimer = null;
    }
    destroyBubbleContainer(currentBubble);  // 即时 destroy
    currentBubble = null;
  }

  // 2. 显示新气泡
  currentBubble = bubbleContainer;

  // 3. 弹入动画
  bubbleContainer.setScale(isEmergency ? 0.7 : 0.8).setAlpha(0);
  if (isEmergency) {
    // 炸弹: 0.7→1.1→1.0
    scene.tweens.add({
      targets: bubbleContainer,
      scale: 1.1, alpha: 1, duration: 100, ease: 'Back.easeOut',
      onComplete: function() {
        scene.tweens.add({ targets: bubbleContainer, scale: 1.0, duration: 80, ease: 'Sine.easeOut' });
      }
    });
  } else {
    // 普通: 0.8→1.0
    scene.tweens.add({
      targets: bubbleContainer,
      scale: 1.0, alpha: 1, duration: 150, ease: 'Back.easeOut'
    });
  }

  // 4. 计时后退出动画
  currentBubbleTimer = scene.time.delayedCall(displayMs, function() {
    scene.tweens.add({
      targets: bubbleContainer,
      alpha: 0, duration: 200, ease: 'Linear',
      onComplete: function() {
        destroyBubbleContainer(bubbleContainer);
        currentBubble = null;
        currentBubbleTimer = null;
      }
    });
  });
}
```

---

## 6. 台词系统

### 6.1 当前结构

```javascript
var AI_LINES = {
  duidui: {
    play: [...], pass: [...], bomb: [...],
    easy: [...], hard: [...], win: [...], lose: [...],
    correct: [...], wrong: [...], close: [...]
  },
  tiantian: {
    play: [...], pass: [...], bomb: [...],
    easy: [...], hard: [...], win: [...], lose: [...],
    correct: [...], wrong: [...], close: [...]
  }
};
```

### 6.2 台词选取函数

```javascript
function getRandomLine(pool) {
  if (!pool || pool.length === 0) return '...';
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickAiLine(aiId, sceneKey) {
  var ai = AI_LINES[aiId];
  if (!ai) return '...';
  var pool = ai[sceneKey];
  return getRandomLine(pool);
}
```

### 6.3 行为判定

| sceneKey | 针对角色 | 示例台词(王怼怼) | 示例台词(苏甜甜) |
|:---------|:--------:|:-----------------|:-----------------|
| `play` | AI出牌 | "送分题，给人类的怜悯" | "这道题送你啦！不客气" |
| `pass` | AI过牌 | "这轮我让你" | "这轮我让着你" |
| `bomb` | AI炸弹 | "核弹级题目！" | "BOMBSHELL！" |
| `easy` | 搞事情-简单 | "我幼儿园数据就有" | "简单得不好意思出" |
| `hard` | 搞事情-难题 | "你CPU该升级了" | "超超超难题！" |
| `correct` | 答对 | "哼，蒙对的吧？" | "哇塞！你真的会！" |
| `wrong` | 答错 | "哈哈哈哈哈！" | "啊啊啊错了！" |
| `close` | 关闭搞事情 | "行吧，回来打牌" | "回来打牌啦！哈哈" |

### 6.4 需要扩充的场景

| 新场景 | 触发时机 | 优先级 |
|:-------|:---------|:------|
| `react` | 玩家出牌后AI随机评价 | P1 |
| `win` | AI胜出时 | P2 |
| `lose` | AI输掉时 | P2 |
| `start` | 游戏开始 | P3 |

### 6.5 API 动态台词

当前代码在第一轮调用 API 获取台词，失败时回退本地池。需要保持此能力：

```javascript
if (self.isAPIMode && typeof ApiClient !== 'undefined' && ApiClient.generateDialogue) {
  ApiClient.generateDialogue(aiId, event, context)
    .then(function (res) {
      renderBubble(res.line || pickAiLine(aiId, event));
    })
    .catch(function () {
      renderBubble(pickAiLine(aiId, event));
    });
} else {
  renderBubble(pickAiLine(aiId, event));
}
```

---

## 7. 队列系统 — 当前 vs 期望

### 7.1 当前实现 (FIFO队列)

```javascript
var bubbleQueue = [];
var BUBBLE_QUEUE_MAX = 3;
var bubbleShowing = false;

function processBubbleQueue() {
  if (bubbleQueue.length === 0) { bubbleShowing = false; return; }
  bubbleShowing = true;
  var item = bubbleQueue.shift();
  item.render();
  // render 内部计时结束后调用 processBubbleQueue
}
```

**问题:** FIFO 队列不适合快速出牌场景。AI1 出牌 → 气泡显示4秒 → 1秒后 AI2 出牌 → 新气泡入队等待 → AI1 气泡消失后才显示 AI2 气泡。

### 7.2 期望行为 (直接替换)

```
T=0ms:    AI1出牌 → 显示气泡A(4s)
T=500ms:  AI2过牌 → 气泡A立即销毁 → 显示气泡B(4s)
T=4500ms: 气泡B结束 → 无新气泡 → 清除
```

### 7.3 实现方案

```javascript
var currentPlayBubble = null;      // 当前出牌气泡元素数组
var currentPlayBubbleTimer = null; // 当前气泡定时器

function killPlayBubble() {
  if (currentPlayBubbleTimer) {
    currentPlayBubbleTimer.remove();
    currentPlayBubbleTimer = null;
  }
  if (currentPlayBubble) {
    for (var i = 0; i < currentPlayBubble.length; i++) {
      if (currentPlayBubble[i]) currentPlayBubble[i].destroy();
    }
    currentPlayBubble = null;
  }
}

// 在 _showPlayBubble 开头调用 killPlayBubble()
// 代替原有的 push + processBubbleQueue
```

**影响:** 此改动会去掉 bubbleQueue / processBubbleQueue 在出牌气泡中的使用，搞事情气泡需独立管理。

---

## 8. 搞事情气泡独立管理

### 8.1 管理方式

搞事情气泡使用独立的 `chaosBubbleElements` 数组，不与出牌气泡共享队列。

**优势：**
- 搞事情模式下出牌气泡不会触发（`gameState = CHAOS_MODE`）
- 两套系统互不干扰
- 搞事情气泡在白色卡片内（depth 302+），出牌气泡在出牌区（depth 20-21）

### 8.2 清理时机

| 操作 | 清理函数 | 清理内容 |
|:-----|:---------|:---------|
| 出题前 | `_clearQuestionArea()` | 销毁索引≥5的 chaosElements + 气泡 |
| 关闭搞事情 | `_destroyChaos()` | 销毁所有 chaosElements + 气泡 |
| 新气泡进入 | `_showAiBubble()` 开头 | 销毁旧 chaoseBubbleElements |

### 8.3 不需要改

搞事情气泡已经使用独立的元素数组，**不需要**接入气泡队列系统。

---

## 9. 边界情况全表

### 9.1 快速连续

| 场景 | 处理方式 | 实现状态 |
|:-----|:---------|:--------:|
| AI1 出牌 → 0.5s后 AI2 过牌 | 旧气泡立即销毁+新气泡弹入 | ❌ 需改为直接替换 |
| AI1 出炸弹 → 0.3s后 AI2 出牌 | 炸弹气泡被替换（不展示紧急样式） | ❌ 需改为直接替换 |
| 两个AI同时出牌 | 不会同时，时间线串行 | ✅ 已由setTimeout串行 |
| 玩家搞事情中AI出牌 | 搞事情模式下AI不出牌 | ✅ gameState锁 |

### 9.2 长文字

| 场景 | 当前行为 | 期望行为 |
|:-----|:---------|:---------|
| 台词超过280px | 文字宽度被截断(无wordWrap) | wordWrap + 气泡高度自适应 |
| 台词超过540px | 同上 | wordWrap + 最大气泡宽+自适应高 |
| 多行文字 | 36px固定高度=文字溢出 | 气泡高度=行数×行高+padding |

### 9.3 多局游戏

| 场景 | 处理 | 状态 |
|:-----|:------|:-----|
| scene.restart() | 气泡队列重置(bubbleQueue=[]) | ✅ 代码有 `init()` 中重置 |
| 搞事情气泡残留 | _destroyChaos销毁所有 | ✅ 已实现 |
| 出牌气泡残留 | _showPlayBubble开头清理 | ✅ 已实现 |

### 9.4 API异常

| 场景 | 处理 | 状态 |
|:-----|:------|:-----|
| generateDialogue API失败 | catch → pickAiLine(本地池) | ✅ 已实现 |
| generateDialogue API超时 | catch → 同上 | ✅ 已实现 |
| ApiClient未定义 | isAPIMode检查→跳过API | ✅ 已实现 |
| API返回空行 | `res.line \|\| pickAiLine(...)` 兜底 | ✅ 已实现 |

---

## 10. 代码实现清单

### 10.1 需要修改的文件

**文件: `src/client/js/game.js`**

| 修改项 | 改动位置 | 优先级 | 工作量 |
|:-------|:---------|:------:|:------:|
| 1. Y坐标从55改为96 | `_showPlayBubble` | P0 | 1行 |
| 2. 苏甜甜气泡X动态计算 | `_showPlayBubble` | P0 | 3行 |
| 3. 直接替换模式替代FIFO队列 | `_showPlayBubble` 开头 + 删除queue相关 | P0 | ~20行 |
| 4. 气泡弹入动画 (scale+alpha) | `_showPlayBubble` + `_showAiBubble` | P0 | ~15行/函数 |
| 5. 气泡退出动画 (alpha fade) | 两个函数 | P0 | ~10行/函数 |
| 6. 炸弹紧急样式 | `_showPlayBubble` event判断 | P0 | ~30行 |
| 7. 关闭搞事情时弹出告别气泡 | `_destroyChaos()` | P1 | 3行 |
| 8. 气泡高度自适应 | 两个函数 | P1 | ~20行/函数 |
| 9. 王怼怼气泡X留间距90→110 | `_showPlayBubble` | P1 | 1行 |
| 10. 玩家出牌后AI反应气泡 | `confirmPlay()` | P2 | ~10行 |
| 11. 补充新台词池(react/win/lose) | `AI_LINES` | P2 | ~30行 |

### 10.2 不需要改的地方

| 项目 | 原因 |
|:-----|:------|
| 搞事情气泡的清理逻辑 | 已使用独立chaosElements，正确 |
| _createChaosOverlay 中的气泡 | 正确触发 easy 气泡 |
| _handleOptionClick 中的气泡 | 正确触发 correct/wrong |
| 台词选取函数 pickAiLine | 随机选取逻辑正确 |

---

## 11. 验收标准

### 11.1 基础功能

| # | 验收条件 | 预期表现 | 优先级 |
|:-:|----------|---------|:------:|
| B1 | AI出牌时弹出气泡 | 头像旁显示台词，4秒后消失 | P0 |
| B2 | AI过牌时弹出气泡 | 显示 pass 池台词，4秒后消失 | P0 |
| B3 | AI出炸弹时弹出紧急气泡 | 红色背景+边框闪烁+文字加粗+5秒 | P0 |
| B4 | 搞事情进入时弹出气泡 | 白色卡片内显示 easy 台词，3.5秒 | P0 |
| B5 | 搞事情答对答错弹出气泡 | correct/wrong 台词，3.5秒 | P0 |
| B6 | 王怼怼气泡在左侧，箭头向左 | 头像在(80,71)，气泡在114 | P0 |
| B7 | 苏甜甜气泡在右侧，箭头向右 | 头像在(880,71)，气泡动态 | P0 |
| B8 | 气泡有弹入动画 (150ms, Back.easeOut) | scale 0.8→1.0 | P0 |
| B9 | 气泡有退出动画 (200ms, alpha fade) | alpha 1→0 | P0 |

### 11.2 替换与队列

| # | 验收条件 | 预期表现 | 优先级 |
|:-:|----------|---------|:------:|
| Q1 | 快速触发两个气泡 | 旧气泡立即销毁，新气泡弹入 | P0 |
| Q2 | 替换时旧气泡无退出动画 | 即时 destroy | P0 |
| Q3 | 替换时新气泡有弹入动画 | scale 0.8→1.0 | P0 |
| Q4 | 无新气泡时正常退出动画 | alpha fade 200ms | P0 |

### 11.3 视觉

| # | 验收条件 | 预期表现 | 优先级 |
|:-:|----------|---------|:------:|
| V1 | 气泡背景色正确 | 王怼怼#1B5E20, 苏甜甜#311B92 | P0 |
| V2 | 气泡圆角正确 | 王怼怼12, 苏甜甜4 | P0 |
| V3 | 炸弹气泡红色调 | bg #500A00, border #FF5252 | P0 |
| V4 | 炸弹边框闪烁 | alpha 0.3↔0.9, 400ms, yoyo | P0 |
| V5 | 长文字不溢出 | wordWrap + 气泡高度自适应 | P0 |

### 11.4 边界

| # | 验收条件 | 预期表现 | 优先级 |
|:-:|----------|---------|:------:|
| E1 | API失败回退本地台词 | 显示本地池台词 | P0 |
| E2 | close场景触发告别气泡 | 关闭搞事情时弹close台词 | P1 |
| E3 | 多局游戏气泡重置 | scene.restart()后气泡queue清空 | P0 |
| E4 | 搞事情中不出出牌气泡 | gameState检查 | P0 |

---

## 12. 完整代码建议 (_showPlayBubble 重写)

以下是 `_showPlayBubble` 期望实现的完整代码框架（可直接替换原函数）：

```javascript
GameScene.prototype._showPlayBubble = function (aiId, event, context) {
  var self = this;

  // 直接替换: 杀掉旧气泡
  if (self.playBubbleElements) {
    for (var bi = 0; bi < self.playBubbleElements.length; bi++) {
      if (self.playBubbleElements[bi]) self.playBubbleElements[bi].destroy();
    }
  }
  self.playBubbleElements = [];
  if (self.playBubbleTimer) {
    self.playBubbleTimer.remove();
    self.playBubbleTimer = null;
  }

  // 获取台词
  var line;
  if (self.isAPIMode && typeof ApiClient !== 'undefined' && ApiClient.generateDialogue) {
    try {
      var res = await ApiClient.generateDialogue(aiId, event, context);
      line = res.line || pickAiLine(aiId, event);
    } catch (e) {
      line = pickAiLine(aiId, event);
    }
  } else {
    line = pickAiLine(aiId, event);
  }

  // 布局参数
  var isDuidui = (aiId === 'duidui');
  var isEmergency = (event === 'bomb');
  var y = 96;  // 升级: 从55改为96
  var aiDisplayName = isDuidui ? '王怼怼' : '苏甜甜';
  var avatarX = isDuidui ? 80 : 880;
  var avatarColor = isDuidui ? 0x4FC3F7 : 0xFFB74D;

  // 气泡尺寸计算 (升级: 自适应宽度+预留wordWrap空间)
  var bubbleW = Math.min(280, 140 + line.length * 10);
  var bubbleX = isDuidui ? 110 : (avatarX - bubbleW - 30);  // 升级: 动态计算
  var bubbleY = y + 10;
  var cornerRadius = isDuidui ? 12 : 4;
  var bubbleBgColor = isEmergency ? 0x500A00 : (isDuidui ? 0x1B5E20 : 0x311B92);
  var bubbleBorderColor = isEmergency ? 0xFF5252 : (isDuidui ? 0x66BB6A : 0xCE93D8);

  // 构建气泡元素 (略, 保持原逻辑)
  // ... avatar, name, bubble bg, arrow, text ...

  // 弹入动画 (升级: 新增)
  var container = self.add.container(0, 0, self.playBubbleElements);
  container.setScale(isEmergency ? 0.7 : 0.8).setAlpha(0);
  if (isEmergency) {
    self.tweens.add({
      targets: container, scale: 1.1, alpha: 1, duration: 100, ease: 'Back.easeOut',
      onComplete: function() {
        self.tweens.add({ targets: container, scale: 1.0, duration: 80, ease: 'Sine.easeOut' });
      }
    });
  } else {
    self.tweens.add({
      targets: container, scale: 1.0, alpha: 1, duration: 150, ease: 'Back.easeOut'
    });
  }

  // 边框闪烁 (炸弹)
  if (isEmergency) {
    // 获取边框Graphics对象
    self.tweens.add({
      targets: bubble, alpha: { from: 0.3, to: 0.9 },
      duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });
  }

  // 定时销毁 (升级: 退出动画)
  var displayMs = isEmergency ? 5000 : 4000;
  self.playBubbleTimer = self.time.delayedCall(displayMs, function() {
    self.tweens.add({
      targets: container, alpha: 0, duration: 200, ease: 'Linear',
      onComplete: function() {
        for (var i = 0; i < self.playBubbleElements.length; i++) {
          if (self.playBubbleElements[i]) self.playBubbleElements[i].destroy();
        }
        self.playBubbleElements = [];
        self.playBubbleTimer = null;
      }
    });
  });
};
```
