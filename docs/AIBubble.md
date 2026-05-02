# AI 气泡系统设计文档

**版本:** v2.0  
**作者:** 产品老大  
**日期:** 2026-05-02  
**文档编号:** PRD-FTL-AIBUBBLE-002  
**对应文件:** `src/client/js/game.js` (Phaser 3, 960×600 横屏)

---

## 目录

1. [角色设定](#1-角色设定)
2. [气泡类型](#2-气泡类型)
3. [布局与坐标](#3-布局与坐标)
4. [视觉规范](#4-视觉规范)
5. [紧急气泡（炸弹/火箭）](#5-紧急气泡炸弹火箭)
6. [计时规则](#6-计时规则)
7. [动画规范](#7-动画规范)
8. [队列系统](#8-队列系统)
9. [台词池](#9-台词池)
10. [角色差异化台词选择](#10-角色差异化台词选择)
11. [显示逻辑](#11-显示逻辑)
12. [边界情况](#12-边界情况)
13. [验收标准](#13-验收标准)

---

## 1. 角色设定

| 属性 | 王怼怼 (duidui) | 苏甜甜 (tiantian) |
|:-----|:---------------:|:-----------------:|
| **头像底色** | `#4FC3F7` (0x4FC3F7) | `#FFB74D` (0xFFB74D) |
| **头像 ICON** | 😎 | 😊 |
| **性格** | 傲慢、毒舌、技术宅 | 元气、活泼、爱演戏 |
| **语气风格** | 讽刺、自信、"人类就是不行" | 可爱、夸张、"哇塞你太棒了" |
| **头像位置** | 左侧 (X=88, Y=83) | 右侧 (X=872, Y=83) |
| **水平位置** | `isLeft = true` | `isLeft = false` |

### 1.1 头像渲染

```
圆形头像（直径40px，圆角方形外框56×56，圆角10px）
  → 底色 fillStyle(0x4FC3F7 / 0xFFB74D, 1)
  → 边框 lineStyle(2, 0xFFFFFF, 0.8)
  → 内嵌头像图片 34×34 (深度12)
```

**精确坐标：**

| 元素 | 王怼怼(X,Y) | 苏甜甜(X,Y) | W×H |
|:-----|:----------:|:----------:|:---:|
| 头像外框（左边缘） | (68, 63) | (904, 63) | 56×56 |
| 头像圆心 | (96, 91) | (864, 91) | — |
| 头像图片 | (88, 83) | (872, 83) | 34×34 |
| 名字 X | 112 | 782 (右对齐) | — |
| 名字 Y | 79 | 79 | — |

---

## 2. 气泡类型

| 类型 | 触发场景 | 显示函数 | 显示时长 | 视觉风格 |
|:-----|---------|:---------|:-------:|:--------:|
| **play** | AI出牌（单张/对子/三张/顺子等） | `_showPlayBubble()` | 4.0s | 标准 |
| **bomb** | AI出炸弹/火箭 | `_showPlayBubble()` | 5.0s | 紧急（红色） |
| **chaos** | 搞事情模式（答对/答错/出题/关闭） | `_showAiBubble()` | 3.0s | 标准（白色卡片内） |

### 2.1 调用入口

| 调用点 | 函数 | 触发条件 |
|:-------|:----|:---------|
| `handleAIPlay()` → `_showPlayBubble('duidui'/'tiantian', 'play'/'bomb', type)` | AI出牌后立即触发 | 出牌区域 |
| `handleAIPass()` → `_showPlayBubble('duidui'/'tiantian', 'pass', '')` | AI不出后 | 出牌区域 |
| `localAIPlay()` → `_showPlayBubble('duidui'/'tiantian', 'play'/'bomb', type)` | 本地AI出牌 | 出牌区域 |
| `_createChaosOverlay()` → `_showAiBubble(aiId, 'easy', 180)` | 进入搞事情模式 | 白色卡片内 |
| `_handleOptionClick()` → `_showAiBubble(aiId, 'correct'/'wrong', fbY+10)` | 回答题目后 | 白色卡片内 |

---

## 3. 布局与坐标

(960×600 基准坐标系)

### 3.1 出牌模式气泡（`_showPlayBubble`）

```
顶部状态栏区域（Y: 0~56）
  ┌──────────────────────────────────────────────────────────────┐
  │  头像区                                                        │
  │  ┌────┐       ┌──────────────────────────┐        ┌────┐     │
  │  │ 😎 │ ←◀── │  出个顺子，让你一手。     │   ──▶ │ 😊 │     │
  │  │头  │       │  王怼怼                   │       │头  │     │
  │  │像  │       └──────────────────────────┘       │像  │     │
  │  └────┘                                          └────┘     │
  │ Y=56 分隔线                                                    │
  └──────────────────────────────────────────────────────────────┘
  出牌区 (Y: 59~265)
```

**王怼怼（左侧）：**

| 元素 | X | Y | W | H | 说明 |
|:-----|---|---|---|---|------|
| 头像圆心 | 96 | 83 | — | — | 圆形40px，底色#4FC3F7 |
| 名字文字 | 112 | 79 | — | — | 12px bold #fff |
| 气泡框 | 128 | 96 | ≤280自适 | 36~56自适 | 圆角10px，左端三角箭头 |
| 气泡文字 | 128+10=138 | 气泡Y+气泡H/2 | 气泡W-20 | — | 15px #E8F0FF，垂直居中 |
| 三角箭头 | 128 | 96+18 | 8×12 | — | 指向左侧头像 |

**苏甜甜（右侧）：**

| 元素 | X | Y | W | H | 说明 |
|:-----|---|---|---|---|------|
| 头像圆心 | 864 | 83 | — | — | 圆形40px，底色#FFB74D |
| 名字文字 | 782 (origin 1,0) | 79 | — | — | 12px bold #fff，右对齐 |
| 气泡框 | 832-气泡W | 96 | ≤280自适 | 36~56自适 | 圆角10px，右端三角箭头 |
| 气泡文字 | 832-气泡W+10 | 气泡Y+气泡H/2 | 气泡W-20 | — | 15px #E8F0FF，垂直居中 |
| 三角箭头 | 832-气泡W+气泡W=832 | 96+18 | 8×12 | — | 指向右侧头像 |

### 3.2 搞事情模式气泡（`_showAiBubble`）

```
白色卡片区域 (Y: 55~375)
  ┌──────────────────────────────────────────────────────────────┐
  │  ┌────┐  ┌──────────────────────────────────────────┐        │
  │  │ 😎 │  │  送分题，给人类的怜悯。                 │        │
  │  │头  │  │  王怼怼                                  │        │
  │  │像  │  └──────────────────────────────────────────┘        │
  │  └────┘                                                      │
  │        ↑ Y=180（传入的 y 参数）                                │
  └──────────────────────────────────────────────────────────────┘
```

**搞事情气泡（左侧AI，固定）：**

| 元素 | X | Y | W | H | 说明 |
|:-----|---|---|---|---|------|
| 头像圆心 | 80 | y+16 | — | — | 圆形，底色按角色 |
| 名字文字 | 105 | y-4 | — | — | 12px bold #fff |
| 气泡框 | 230 | y+10 | ≤540自适 | 36~56自适 | 圆角12px，绿色深色 |
| 三角箭头 | 230 | y+10+18 | 8×12 | — | 指向左侧头像 |
| 气泡文字 | 244 | y+10+气泡H/2 | 气泡W-14 | — | 14px #fff，垂直居中 |

> **注意：** 搞事情模式下气泡固定在左侧。y 参数由调用者传入（一般在180附近）。

---

## 4. 视觉规范

### 4.1 标准气泡（出牌/过牌/搞事情通用）

| 属性 | 值 | 说明 |
|:-----|:---|:-----|
| 背景色 | `rgba(0,18,6,0.88)` | 深绿色半透明 |
| 边框色 | `#4CAF50` | 绿色，透明度0.5 |
| 边框宽度 | 1.5px | 细边框 |
| 圆角半径 | 10px | 所有圆角统一 |
| 三角箭头 | 8×12px | 等边三角，颜色同背景 |
| 文字大小 | 15px | 正文 |
| 文字颜色 | `#E8F0FF` | 浅蓝色白 |
| 文字字体 | `"PingFang SC","Microsoft YaHei",sans-serif` | 中文字体 |
| 最大宽度 | 280px (出牌) / 540px (搞事情) | 超出自动换行 |
| 最小高度 | 36px | 单行台词 |
| 阴影 | 无 | 标准气泡无阴影 |

### 4.2 搞事情气泡（白色卡片内）

| 属性 | 值 | 说明 |
|:-----|:---|:-----|
| 背景色 | `rgba(0,18,6,0.88)` | 与标准气泡一致 |
| 圆角半径 | 12px | 略大于标准气泡 |
| 最大宽度 | 540px | 白色卡片内更宽 |
| 文字大小 | 14px | 稍小，适配卡片空间 |
| 文字颜色 | `#FFFFFF` | 纯白 |

---

## 5. 紧急气泡（炸弹/火箭）

当AI出炸弹或火箭时，使用紧急样式强调。

### 5.1 视觉样式

| 属性 | 普通 | 紧急（炸弹/火箭） |
|:-----|:----:|:----------------:|
| 背景色 | `rgba(0,18,6,0.88)` | `rgba(80,10,0,0.90)` |
| 边框色 | `#4CAF50` (alpha 0.5) | `#FF5252` (alpha 0.7) |
| 边框宽度 | 1.5px | 2px |
| 文字大小 | 15px | **16px bold** |
| 文字颜色 | `#E8F0FF` | `#FFCDD2` |
| 阴影 | 无 | `shadowBlur=10, color=#FF5252` |
| 气泡最小高 | 36px | 40px |
| 最大宽度 | 280px | 300px |

### 5.2 闪烁动画

紧急气泡的 **边框** 增加闪烁效果：

```javascript
// 边框闪烁：alpha 在 0.3 ↔ 0.9 之间来回切换
scene.tweens.add({
  targets: bubbleBorder,   // Graphics 对象（边框层）
  alpha: { from: 0.3, to: 0.9 },
  duration: 400,
  yoyo: true,
  repeat: -1,              // 持续闪烁直到气泡销毁
  ease: 'Sine.easeInOut'
});
```

> 闪烁仅作用于边框，背景和文字不闪烁。

### 5.3 技术实现

在 `_showPlayBubble()` 中新增分支逻辑：

```javascript
var isEmergency = (event === 'bomb');
if (isEmergency) {
  // → 使用紧急背景色
  // → 使用紧急边框色，添加闪烁tween
  // → 使用16px bold文字
  // → 显示5秒
}
```

---

## 6. 计时规则

| 消息类型 | 显示时长 | 适用场景 | 代码对应 |
|:--------:|:--------:|---------|:--------:|
| 普通出牌 | **4.0s** | AI出顺子/单张/对子/三张等 | `event === 'play'` |
| 过牌 | **4.0s** | AI不出 | `event === 'pass'` |
| 炸弹/火箭 | **5.0s** | AI出了炸弹、火箭 | `event === 'bomb'` |
| 搞事情 | **3.0s** | 答题反馈/开始/结束 | `_showAiBubble()` |

计时从 **弹入动画完成** 后开始计算（即：气泡已经完全显示后的延迟）。

---

## 7. 动画规范

### 7.1 弹入动画（Entrance）

| 属性 | 值 | 说明 |
|:-----|:---|:-----|
| 初始状态 | `container.setScale(0.8).setAlpha(0)` | 缩小+透明 |
| 目标状态 | `scale: 1.0, alpha: 1.0` | 全尺寸不透明 |
| 时长 | **150ms** | 0.15秒 |
| 缓动 | **Back.easeOut** | 弹性缓出，微小过冲 |
| 作用对象 | 整个气泡容器（背景+箭头+文字） | 统一缩放 |

### 7.2 退出动画（Exit）

| 属性 | 值 | 说明 |
|:-----|:---|:-----|
| 初始状态 | `alpha: 1.0` | 完全不透明 |
| 目标状态 | `alpha: 0` | 完全透明 |
| 时长 | **200ms** | 0.2秒 |
| 缓动 | **Linear** | 线性淡出 |
| 销毁 | `onComplete: container.destroy()` | 动画结束后销毁 |

### 7.3 动画代码模板

```javascript
// 弹入动画
container.setScale(0.8).setAlpha(0);
scene.tweens.add({
  targets: container,
  scale: 1.0,
  alpha: 1.0,
  duration: 150,
  ease: 'Back.easeOut',
  onComplete: function () {
    // 动画完成后开始计时
    scene.time.delayedCall(displayDuration, function () {
      // 退出动画
      scene.tweens.add({
        targets: container,
        alpha: 0,
        duration: 200,
        ease: 'Linear',
        onComplete: function () {
          container.destroy();
          processBubbleQueue(); // 处理队列下一个
        }
      });
    });
  }
});
```

### 7.4 紧急气泡弹入特殊

炸弹/火箭弹入使用更夸张的缩放：

| 属性 | 普通 | 紧急 |
|:-----|:----:|:----:|
| 初始缩放 | 0.8 | 0.7 |
| 目标缩放 | 1.0 | **1.1 → 1.0** (回弹) |
| 缓动 | Back.easeOut | Back.easeOut |

```javascript
// 紧急气泡先放大到1.1再回弹到1.0
scene.tweens.add({
  targets: container,
  scale: 1.1,
  alpha: 1.0,
  duration: 100,
  ease: 'Back.easeOut',
  onComplete: function () {
    scene.tweens.add({
      targets: container,
      scale: 1.0,
      duration: 80,
      ease: 'Sine.easeOut'
    });
    // 然后开始正常计时
  }
});
```

---

## 8. 队列系统

### 8.1 数据结构

```javascript
var bubbleQueue = [];          // 气泡队列数组
var BUBBLE_QUEUE_MAX = 3;      // 队列最大长度
var bubbleShowing = false;     // 当前是否有气泡在显示
```

### 8.2 入队机制（Direct Replacement）

**直接替换策略：**

```
旧气泡正在显示 → 新气泡入队 → 不是"排到队尾"而是"立即杀掉旧气泡，显示新气泡"
```

```
事件序列：
T0: AI1出牌 → 气泡1出现
T0+0.5s: AI2出牌 → 气泡1立即销毁 → 气泡2立即出现
T0+1.0s: AI1过牌 → 气泡2立即销毁 → 气泡3立即出现
```

**实现方式：** 新气泡入队时，若当前有气泡正在显示，立即调用下方逻辑：

```javascript
// 入队时检查当前气泡
function queueBubble(renderFn, displayMs) {
  // 1. 如果有旧气泡正在显示 → 立即销毁（不给退出动画时间）
  killCurrentBubble();
  
  // 2. 直接渲染新气泡（跳过队列等待）
  bubbleShowing = true;
  renderFn();
  
  // 3. 计时后销毁并解锁
  // ... (内部处理)
}
```

### 8.3 摘除旧队列逻辑

当前 `processBubbleQueue()` 的 FIFO 队列模式**不适合**快速出牌场景（AI2出牌时AI1的气泡还在显示）。

**重构方案：** 去掉 queue array，改为 **直接替换 + 单槽位** 模式：

```javascript
var currentBubble = null;         // 当前显示的气泡容器引用
var currentBubbleTimer = null;    // 当前气泡的定时器引用

function showBubbleDirect(bubbleContainer) {
  // 1. 杀掉旧气泡
  if (currentBubble) {
    if (currentBubbleTimer) {
      currentBubbleTimer.remove();  // 取消旧定时器
      currentBubbleTimer = null;
    }
    currentBubble.destroy();        // 立即销毁（无退出动画）
    currentBubble = null;
  }
  
  // 2. 显示新气泡（带弹入动画）
  currentBubble = bubbleContainer;
  // ... 动画和计时逻辑
}
```

> **注意：** 快速替换时，旧气泡 **不给退出动画**（直接destroy），新气泡仍带弹入动画。这样可以保证在任何时刻只有一个气泡存在。

### 8.4 搞事情模式气泡队列

搞事情气泡 (`_showAiBubble`) 在白色卡片内部渲染，不需要与出牌气泡共享队列。搞事情模式已包含自己的销毁逻辑（`_clearQuestionArea()` 时会清理搞事情气泡）。

---

## 9. 台词池

### 9.1 数据结构

```javascript
var AI_LINES = {
  duidui: {
    play: [ /* 出牌台词 */ ],
    pass: [ /* 过牌台词 */ ],
    bomb: [ /* 炸弹台词 */ ],
    easy: [ /* 搞事情-简单题 */ ],
    hard: [ /* 搞事情-难题 */ ],
    win:  [ /* 赢牌台词 */ ],
    lose: [ /* 输牌台词 */ ],
    correct: [ /* 答对台词 */ ],
    wrong: [ /* 答错台词 */ ],
    close: [ /* 关闭搞事情 */ ]
  },
  tiantian: {
    play: [ /* ... */ ],
    pass: [ /* ... */ ],
    // ... 同上，但风格更活泼
  }
};
```

### 9.2 key 对照表

| sceneKey | 触发场景 | 显示函数 |
|:---------|---------|:---------|
| `play` | AI出牌（非炸弹） | `_showPlayBubble('duidui'/'tiantian', 'play', type)` |
| `pass` | AI不出 | `_showPlayBubble('duidui'/'tiantian', 'pass', '')` |
| `bomb` | AI出炸弹/火箭 | `_showPlayBubble('duidui'/'tiantian', 'bomb', type)` |
| `easy` | 搞事情-简单/送分题 | `_showAiBubble(aiId, 'easy', y)` |
| `hard` | 搞事情-难题 | `_showAiBubble(aiId, 'hard', y)` |
| `win` | 赢牌（备用，显示结算面板前） | `_showAiBubble(aiId, 'win', y)` |
| `lose` | 输牌（备用） | `_showAiBubble(aiId, 'lose', y)` |
| `correct` | 答对题目 | `_showAiBubble(aiId, 'correct', y)` |
| `wrong` | 答错题目 | `_showAiBubble(aiId, 'wrong', y)` |
| `close` | 关闭搞事情模式 | `_showAiBubble(aiId, 'close', y)` |

### 9.3 当前台词池（完整保留，持续扩充）

详见 `game.js` 中 `AI_LINES` 对象。每个场景池至少 **3~5 条** 台词。

---

## 10. 角色差异化台词选择

### 10.1 选择函数

```javascript
function getRandomLine(pool) {
  if (!pool || pool.length === 0) return '...';
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickAiLine(aiId, sceneKey) {
  var ai = AI_LINES[aiId];        // duidui 或 tiantian
  if (!ai) return '...';
  var pool = ai[sceneKey];          // play / pass / bomb / ...
  return getRandomLine(pool);
}
```

### 10.2 调用流程

```
_showPlayBubble(aiId, event, context)
  → pickAiLine(aiId, event)          // event = 'play' | 'pass' | 'bomb'
  → 渲染气泡

_showAiBubble(aiId, sceneKey, y)
  → pickAiLine(aiId, sceneKey)       // sceneKey = 'easy' | 'hard' | 'correct' | ...
  → 渲染气泡
```

### 10.3 API 接口（可选）

当 `ApiClient.generateDialogue` 可用时，优先调用 API 获取动态台词，失败时回退到本地池：

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

## 11. 显示逻辑

### 11.1 `_showPlayBubble()` — 出牌气泡

**调用位置：** `handleAIPlay()` / `localAIPlay()` / `handleAIPass()`

**函数签名：**
```javascript
GameScene.prototype._showPlayBubble = function (aiId, event, context)
```

**参数说明：**

| 参数 | 类型 | 示例 | 说明 |
|:-----|:----|:-----|:-----|
| `aiId` | string | `'duidui'` / `'tiantian'` | 角色标识 |
| `event` | string | `'play'` / `'pass'` / `'bomb'` | 触发事件类型 |
| `context` | string | `'BOMB'` / `'SINGLE'` | 出牌类型名称（暂未使用） |

**渲染流程：**

```
1. 确定 isLeft = (aiId === 'duidui')
2. 确定显示时长：event === 'bomb' → 5000ms, 否则 4000ms
3. 确定视觉样式：event === 'bomb' → 紧急样式，否则标准样式
4. 通过 pickAiLine() 获取台词
5. 构建气泡容器（Graphics for 背景+边框+箭头 + Text for 文字 + Text for 名字 + Image for 头像）
6. 杀旧气泡（direct replacement）
7. 弹入动画 (150ms, Back.easeOut)
8. 计时后退出动画 (200ms, Linear alpha fade)
9. 销毁 + 解锁
```

### 11.2 `_showAiBubble()` — 搞事情气泡

**调用位置：** `_createChaosOverlay()` / `_handleOptionClick()` / `_showSwapResult()` 等

**函数签名：**
```javascript
GameScene.prototype._showAiBubble = function (aiId, sceneKey, y)
```

**参数说明：**

| 参数 | 类型 | 示例 | 说明 |
|:-----|:----|:-----|:-----|
| `aiId` | string | `'duidui'` / `'tiantian'` | 角色标识 |
| `sceneKey` | string | `'easy'` / `'correct'` / `'wrong'` | 场景key |
| `y` | number | `180` | 气泡的Y坐标（通常是传入的fbY+10） |

**渲染流程：**

```
1. 确定显示时长：3000ms（固定）
2. 通过 pickAiLine() 获取台词
3. 清理旧的搞事情气泡（如果有）
4. 构建气泡容器（白色卡片内，左侧定位）
5. 弹入动画 (150ms, Back.easeOut)
6. 计时后退出动画 (200ms, Linear alpha fade)
7. 销毁 + 解锁
```

### 11.3 渲染函数职责边界

| 方面 | `_showPlayBubble` | `_showAiBubble` |
|:-----|:-----------------:|:---------------:|
| 管理自身销毁 | ✅ | ✅ |
| 处理出牌气泡替换 | ✅ | — |
| 处理搞事情气泡清理 | — | ✅ |
| 调用 processBubbleQueue | ✅ | ✅ |
| 处理紧急样式 | ✅（event === 'bomb'） | 不使用 |
| 管理头像 | ✅（出牌区头像） | ✅（卡片内头像） |

---

## 12. 边界情况

### 12.1 快速出牌（替换机制）

**场景：** AI1出牌 → 气泡A显示 → 0.5秒后AI2出牌 → 气泡B需要立即显示

**处理：**

```
T=0ms: AI1出牌 → _showPlayBubble('duidui', 'play')
  → 气泡A渲染，弹入动画开始 (150ms)
T=500ms: AI2出牌 → _showPlayBubble('tiantian', 'play')
  → 气泡A 立即销毁（不给退出动画）
  → 气泡B 渲染，弹入动画开始 (150ms)
T=900ms: 气泡B 弹入完成，开始 4000ms 计时
T=4900ms: 气泡B 退出动画开始 (200ms)
T=5100ms: 气泡B 销毁
```

**注意：** 直接替换时，旧气泡不加退出动画。保证新气泡快速出现。

### 12.2 长文本自动换行

| 属性 | 出牌气泡 | 搞事情气泡 |
|:-----|:--------:|:---------:|
| 最大宽度 | 280px | 540px |
| wordWrap | `{ width: 280 - 20 = 260 }` | `{ width: 540 - 14 = 526 }` |
| 高度自适应 | 36px + 每多一行+18px | 36px + 每多一行+18px |
| 气泡框高度 | 自适应文本高度+上下padding各10px | 同左 |

```javascript
// 文字渲染（带自动换行）
var bubbleTxt = self.add.text(textX, bubbleY + 10, line, {
  fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
  fontSize: '15px',
  color: '#E8F0FF',
  wordWrap: { width: maxTextWidth },
  lineSpacing: 2
}).setDepth(depth);

// 气泡框高度自适应
var textBounds = bubbleTxt.getBounds();
var actualBubbleH = Math.max(minBubbleH, textBounds.height + 20);
```

**气泡高度计算公式：**

```
文字高度 = 行数 × 行高 (15px + lineSpacing 2px = 17px)
气泡总高度 = max(36, 文字高度 + paddingTop(10) + paddingBottom(10))
```

### 12.3 无台词时的回退

如果 `pickAiLine()` 返回空或 `AI_LINES` 中缺少 key，统一回退显示 `'...'`。

```javascript
function getRandomLine(pool) {
  if (!pool || pool.length === 0) return '...';
  return pool[Math.floor(Math.random() * pool.length)];
}
```

### 12.4 搞事情气泡与出牌气泡重叠

搞事情模式时，出牌气泡 **不应显示**。因为：
1. 搞事情模式下 `gameState === GAME_STATE.CHAOS_MODE`，AI不会触发 `handleAIPlay()` / `handleAIPass()`
2. 搞事情气泡在白色卡片内（depth 302+），出牌气泡在出牌区（depth 20~21），depth 层级不同不会重叠

### 12.5 气泡深度层级

| 层 | 内容 | Depth值 |
|:--|:-----|:-------:|
| 桌子背景 | 装饰线、椭圆 | 0 |
| 手牌区背景 | 深色半透明条 | 10 |
| 顶部状态栏 | 黑色半透明条 | 10 |
| AI头像 | 头像+名字+计数字 | 11~12 |
| **出牌气泡** | **气泡容器+文字+箭头** | **20~21** |
| 出牌区卡片 | AI/玩家的出牌 | 21 |
| 手牌卡片 | 玩家手牌 | 110 |
| 搞事情遮罩 | 黑色半透明 | 300 |
| 搞事情卡片 | 白色圆角卡片 | 301 |
| **搞事情气泡** | **气泡容器+文字+箭头** | **302~303** |
| 搞事情题目 | 选项、分数等 | 302~304 |
| 搞事情反馈 | 答案对错提示 | 305+ |
| 结算面板 | 遮罩、卡片、按钮 | 400+ |

### 12.6 头像图片加载失败

如果 `avatar_wang` / `avatar_su` 图片加载失败，头像位置显示 ICON 文字不显示图片：

```javascript
// 用fallback emoji替代头像图片
var img = scene.add.image(x, y, key).setDisplaySize(34, 34).setDepth(12);
img.on('error', function() {
  this.destroy();
  scene.add.text(x, y, isDuidui ? '😎' : '😊', {
    fontFamily: 'sans-serif', fontSize: '18px'
  }).setOrigin(0.5).setDepth(12);
});
```

---

## 13. 验收标准

### 13.1 气泡显示

| # | 验收条件 | 优先级 | 测试方法 |
|:-:|----------|:------:|---------|
| AB1 | AI出牌时，在Y=96位置出牌区上方显示完整气泡 | P0 | 点「搞事情」触发AI出牌，观察气泡Y坐标 |
| AB2 | 左侧AI（王怼怼）气泡箭头朝左，右侧AI（苏甜甜）气泡箭头朝右 | P0 | 视觉确认箭头方向 |
| AB3 | 气泡背景正确使用 `rgba(0,18,6,0.88)` + 边框 `#4CAF50` | P0 | DevTools截屏取色 |
| AB4 | 气泡文字15px `#E8F0FF`，不截断，最大宽度280px | P0 | 输入长台词验证 |
| AB5 | 炸弹/火箭类型使用紧急样式：红色背景+边框+闪烁+16px bold | P0 | 观察炸弹出牌时气泡效果 |
| AB6 | 普通气泡显示4秒，炸弹气泡5秒 | P0 | 计时器测量 |
| AB7 | 搞事情气泡显示3秒 | P0 | 计时器测量 |
| AB8 | 新气泡弹出时旧气泡立即销毁（替换机制） | P0 | 快速让两个AI连续出牌，观察不重叠 |

### 13.2 动画

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| AN1 | 气泡弹入有 scale 0.8→1.0, Back.easeOut, 150ms | P0 |
| AN2 | 气泡退出有 alpha 1→0, 200ms, Linear | P0 |
| AN3 | 炸弹气泡弹入先放大到1.1再回弹到1.0 | P0 |
| AN4 | 炸弹气泡边框有持续闪烁效果 (alpha 0.3↔0.9, 400ms周期) | P0 |
| AN5 | 直接替换时，旧气泡不加退出动画（立即销毁） | P0 |

### 13.3 台词

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| LN1 | 出牌时显示 `play` 池台词 | P0 |
| LN2 | 过牌时显示 `pass` 池台词 | P0 |
| LN3 | 炸弹时显示 `bomb` 池台词 | P0 |
| LN4 | 答对时显示 `correct` 池台词 | P0 |
| LN5 | 答错时显示 `wrong` 池台词 | P0 |
| LN6 | 进入搞事情时显示 `easy` 池台词 | P0 |
| LN7 | 关闭搞事情时显示 `close` 池台词 | P0 |
| LN8 | 王怼怼和苏甜甜台词风格明显不同 | P0 |
| LN9 | 台词池缺失时回退显示 `'...'` | P1 |

### 13.4 边界

| # | 验收条件 | 优先级 |
|:-:|----------|:------:|
| EC1 | 两个AI连续快速出牌，气泡不重叠不闪烁 | P0 |
| EC2 | 长文本（超过280px宽度）自动换行，气泡高度自适应 | P0 |
| EC3 | 搞事情模式结束后，出牌气泡正常显示 | P0 |
| EC4 | 游戏重新开始（scene.restart()）时，气泡队列和状态完全重置 | P0 |

---

## 附：修改文件清单

| 文件 | 修改内容 | 预计变更 |
|------|---------|:--------:|
| `src/client/js/game.js` | 重构 `_showPlayBubble()`：Y坐标从120/165→96，标准动画替换当前代码 | 重写~80行 |
| `src/client/js/game.js` | 重构 `_showAiBubble()`：增加弹入动画/退出动画/直接替换 | 重写~60行 |
| `src/client/js/game.js` | 替换 `bubbleQueue` + `processBubbleQueue()` 为直接替换模式 | 重写~30行 |
| `src/client/js/game.js` | 紧急气泡分支（红色背景、闪烁边框、特殊弹入） | 新增~40行 |
| `src/client/js/game.js` | 气泡高度自适应逻辑（根据文字行数计算） | 新增~15行 |
| `src/client/js/game.js` | 增加长文本 wordWrap + 自适应尺寸 | 修改~10行 |
| `src/client/js/game.js` | 台词池可继续扩充 | 持续 |

**依赖关系：** 无外部依赖。Phaser 3 已有 `tweens.add()` 和 `Graphics` API。

---

## 样式速查表（开发用）

```css
/* 标准气泡 */
.bubble-normal {
  background: rgba(0, 18, 6, 0.88);
  border: 1.5px solid rgba(76, 175, 80, 0.5);
  border-radius: 10px;
  font-size: 15px;
  color: #E8F0FF;
  max-width: 280px;
  min-height: 36px;
}

/* 紧急气泡 */
.bubble-emergency {
  background: rgba(80, 10, 0, 0.90);
  border: 2px solid rgba(255, 82, 82, 0.7);
  border-radius: 10px;
  font-size: 16px;
  font-weight: bold;
  color: #FFCDD2;
  max-width: 300px;
  min-height: 40px;
  box-shadow: 0 0 10px #FF5252;
  animation: border-flash 0.4s infinite alternate;
}

@keyframes border-flash {
  0%   { border-color: rgba(255, 82, 82, 0.3); }
  100% { border-color: rgba(255, 82, 82, 0.9); }
}
```
