# 音效与动效系统 (Sound & Animation) — 超详细设计文档

**版本:** v2.0  
**作者:** 产品经理  
**日期:** 2026-05-02  
**对应源码:** `src/client/js/game.js` (2897行)  

---

## 目录

1. [音效系统](#1-音效系统)
2. [音频文件清单](#2-音频文件清单)
3. [手牌选中/取消动画](#3-手牌选中取消动画)
4. [出牌动画](#4-出牌动画)
5. [AI气泡动画](#5-ai气泡动画)
6. [结算面板动画](#6-结算面板动画)
7. [搞事情换牌动画](#7-搞事情换牌动画)
8. [Toast通知动画](#8-toast通知动画)
9. [搞事情弹窗动画](#9-搞事情弹窗动画)
10. [AI回合延迟](#10-ai回合延迟)
11. [动画参数速查表](#11-动画参数速查表)
12. [与旧文档差异说明](#12-与旧文档差异说明)
13. [验收标准](#13-验收标准)

---

## 1. 音效系统

### 1.1 SoundManager 实现 (代码行 31-117)

```javascript
var SoundManager = {
  scene: null,
  audioReady: false,
  // ...
};
```

**关键属性:**
| 属性 | 类型 | 初始值 | 说明 |
|:-----|:----:|:------:|------|
| `scene` | object | null | 当前游戏场景引用 |
| `audioReady` | boolean | false | AudioContext 是否就绪 |

### 1.2 音频上下文初始化

```javascript
SoundManager.init = function (scene) {
  this.scene = scene;
  var self = this;
  function tryResume() {
    if (self.audioReady) return;
    var ctx = scene.sound && scene.sound.context;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(function () {
        self.audioReady = true;
      }).catch(function () {});
    } else if (ctx && ctx.state === 'running') {
      self.audioReady = true;
    }
    if (!ctx) self.audioReady = true;
  }
  scene.input.on('pointerdown', tryResume);   // 首次点击恢复
  scene.time.delayedCall(500, tryResume);      // 500ms后重试
};
```

**自动播放策略:**
1. 首次 `pointerdown` → 调用 `AudioContext.resume()`
2. 500ms 延迟后再次尝试恢复
3. 无 AudioContext 时默认 ready
4. `_ensureReady()` 每次播放前检查状态

### 1.3 音效播放函数

```javascript
// 随机播放 base+1 ~ base+count
SoundManager._random = function (base, count) {
  return base + (Math.floor(Math.random() * count) + 1);
};
// 例如 _random('cardPlace', 3) → 'cardPlace1'~'cardPlace3'
```

**完整音效函数表:**

| 函数 | 代码 | 调用 | 音效文件 | 音量 | 触发场景 |
|:-----|:-----|:-----|:---------|:----:|:---------|
| `playCard()` | `_random('cardPlace', 3)` | `scene.sound.play(key, {volume:0.8})` | cardPlace1-3 | 0.8 | 玩家出牌确认 |
| `selectCard()` | `_random('cardSlide', 3)` | `{volume:0.6}` | cardSlide1-3 | 0.6 | 选中手牌 |
| `deselectCard()` | `_random('cardSlide', 3)` | `{volume:0.5}` | cardSlide1-3 | 0.5 | 取消选中手牌 |
| `playerTurn()` | `_random('chipsCollide', 3)` | `{volume:0.7}` | chipsCollide1-3 | 0.7 | 轮到玩家出牌 |
| `bid()` | `_random('chipsCollide', 3)` | `{volume:0.7}` | chipsCollide1-3 | 0.7 | 玩家叫1/2/3分 |
| `passBid()` | `_random('cardSlide', 3)` | `{volume:0.5}` | cardSlide1-3 | 0.5 | 玩家不叫 |
| `win()` | `'cardPlace3'` | `{volume:0.9}` | cardPlace3 | 0.9 | 玩家赢牌/答对 |
| `lose()` | `'cardSlide1'` | `{volume:0.6}` | cardSlide1 | 0.6 | 玩家输牌/答错 |
| `aiThink()` | — | 无音效 | — | — | AI思考 (静默) |
| `pauseAll()` | `scene.sound.pauseAll()` | — | — | — | 搞事情模式暂停 |
| `resumeAll()` | `scene.sound.resumeAll()` | — | — | — | 搞事情恢复 |

### 1.4 音效在 game.js 中的调用点

| 调用位置 | 函数 | 行号 |
|:---------|:-----|:----:|
| 选中手牌 | `SoundManager.selectCard()` | ~453 |
| 取消选中手牌 | `SoundManager.deselectCard()` | ~449 |
| 玩家出牌确认 | `SoundManager.playCard()` | ~1009 |
| 轮到玩家 | `SoundManager.playerTurn()` | 多处 |
| 叫分 | `SoundManager.bid()` | ~590 |
| 不叫 | `SoundManager.passBid()` | ~591 |
| 玩家赢牌 | `SoundManager.win()` | ~1015 |
| AI2出完→玩家 | `SoundManager.playerTurn()` | 多处 |
| 答对搞事情 | `SoundManager.win()` | ~1640 |
| 答错搞事情 | `SoundManager.lose()` | ~1660 |
| 暂停所有 | `SoundManager.pauseAll()` | ~1380 |
| 恢复所有 | `SoundManager.resumeAll()` | ~2300 |

---

## 2. 音频文件清单

### 2.1 预加载配置 (preload)

```javascript
// preload() 中 — 行 ~210
// 3个系列 × 3个变体 + 1个备用 = 10个音效文件

for (var ai = 1; ai <= 3; ai++) {
  this.load.audio('cardPlace' + ai, [
    'assets/sounds/cardPlace' + ai + '.mp3',
    'assets/sounds/cardPlace' + ai + '.ogg'
  ]);
  this.load.audio('cardSlide' + ai, [
    'assets/sounds/cardSlide' + ai + '.mp3',
    'assets/sounds/cardSlide' + ai + '.ogg'
  ]);
  this.load.audio('chipsCollide' + ai, [
    'assets/sounds/chipsCollide' + ai + '.mp3',
    'assets/sounds/chipsCollide' + ai + '.ogg'
  ]);
}
this.load.audio('dieShuffle1', [
  'assets/sounds/dieShuffle1.mp3',
  'assets/sounds/dieShuffle1.ogg'
]);
```

### 2.2 文件清单

| 系列 | 变体 | 格式 | 路径 | 使用状态 |
|:----|:----:|:----|:-----|:--------|
| cardPlace | 1-3 | .mp3 + .ogg | assets/sounds/cardPlace{1-3}.mp3/.ogg | ✅ 使用中 |
| cardSlide | 1-3 | .mp3 + .ogg | assets/sounds/cardSlide{1-3}.mp3/.ogg | ✅ 使用中 |
| chipsCollide | 1-3 | .mp3 + .ogg | assets/sounds/chipsCollide{1-3}.mp3/.ogg | ✅ 使用中 |
| dieShuffle | 1 | .mp3 + .ogg | assets/sounds/dieShuffle1.mp3/.ogg | ❌ 未使用(备用) |

**总计:** 10 个音效文件 (4系列 × 双格式 = 20个物理文件)

### 2.3 双格式说明

```javascript
// Phaser loader 自动选择浏览器支持的格式
this.load.audio('cardPlace1', [
  'assets/sounds/cardPlace1.mp3',
  'assets/sounds/cardPlace1.ogg'
]);
```

- 浏览器优先选 .mp3，不支持时降级 .ogg
- Phaser 自动检测

---

## 3. 手牌选中/取消动画

### 3.1 实现

```javascript
// renderPlayerHand 内 pointerdown — 行 ~445
if (s) {
  // 取消选中
  this.y += 16;               // 直接y赋值，无动画
  this.setData('selected', false);
  var pos = self.selectedCards.indexOf(idx2);
  if (pos >= 0) self.selectedCards.splice(pos, 1);
  SoundManager.deselectCard();
} else {
  // 选中
  this.y -= 16;               // 直接y赋值，无动画
  this.setData('selected', true);
  self.selectedCards.push(idx2);
  SoundManager.selectCard();
}
```

### 3.2 参数

| 参数 | 值 |
|:-----|:----:|
| Y偏移 | **16px** (上移/下移) |
| 动画类型 | **无动画** (直接 y = origY ± 16) |
| 选中音效 | `SoundManager.selectCard()` — cardSlide1-3, vol 0.6 |
| 取消音效 | `SoundManager.deselectCard()` — cardSlide1-3, vol 0.5 |
| 视觉反馈 | 选中牌在 depth 110，上方无遮盖(手牌重叠量33px) |
| 手柄区域 | (20,300) w=920 h=115 |

### 3.3 手牌无动画的原因

无 tween 动画，直接修改 y 属性。后续优化建议: 添加 50ms 缓动。

---

## 4. 出牌动画

### 4.1 玩家/AI 出牌 (displayPlay)

```javascript
// displayPlay(cards, player) — 行 ~1325
// 直接在目标位置创建图片，无飞行动画
var positions = {
  player: { x: 360, y: 195, w: 50, h: 72 },
  ai1:    { x: 280, y: 133, w: 42, h: 60 },
  ai2:    { x: 680, y: 133, w: 42, h: 60 }
};

var pimg = this.add.image(pcx, pos.y, pkey)
  .setDisplaySize(pos.w, pos.h).setDepth(21);
```

| 参数 | 值 |
|:-----|:----:|
| 动画类型 | **无动画** (直接在目标位置创建) |
| depth | 21 |
| 音效 | `SoundManager.playCard()` — cardPlace1-3, vol 0.8 |
| 清理 | 每次调用先销毁旧出牌图片数组 |

### 4.2 出牌时间线

```
玩家点击"出牌" → (即时) → 手牌移除 → displayPlay → 音效
  ↓ 600ms delay → AI1 思考中...
  ↓ 1200ms delay → AI1 出牌 → displayPlay (即时渲染)
  ↓ 1200ms delay → AI2 出牌/不出
```

### 4.3 出牌区清空

两轮都过 (`passCount >= 2`) 时 `lastPlay = null`，但出牌图片不自动清除。旧图片在下一次 `displayPlay` 调用时被清除。

---

## 5. AI气泡动画

### 5.1 搞事情气泡 (_showAiBubble) 

```javascript
// _showAiBubble — 行 ~2185
// 即时创建，无过渡动画
// 3.5s 后 destroy
self.time.delayedCall(3500, function() {
  if (self.chaosBubbleElements) {
    for (var i = 0; i < self.chaosBubbleElements.length; i++) {
      if (self.chaosBubbleElements[i]) self.chaosBubbleElements[i].destroy();
    }
    self.chaosBubbleElements = [];
  }
  processBubbleQueue();
});
```

| 参数 | 值 |
|:-----|:----:|
| 进入动画 | **无** (即时显示) |
| 停留时长 | **3500ms** |
| 退出动画 | **无** (即时 destroy) |
| 队列 | 最大 3 个任务，~3.5s 后自动处理下一个 |

### 5.2 出牌气泡 (_showPlayBubble)

```javascript
// _showPlayBubble — 行 ~2160
var displayMs = event === 'bomb' ? 5000 : 4000;
self.time.delayedCall(displayMs, function() {
  if (self.playBubbleElements) {
    for (var i = 0; i < self.playBubbleElements.length; i++) {
      if (self.playBubbleElements[i]) self.playBubbleElements[i].destroy();
    }
    self.playBubbleElements = [];
  }
  processBubbleQueue();
});
```

| 参数 | 值 |
|:-----|:----:|
| 进入动画 | **无** (即时显示) |
| 普通气泡停留 | **4000ms** (4秒) |
| 炸弹气泡停留 | **5000ms** (5秒) |
| 退出动画 | **无** (即时 destroy) |
| 队列 | 与 _showAiBubble 共享 `bubbleQueue`，同一 `processBubbleQueue` |

### 5.3 气泡队列系统

```javascript
var bubbleQueue = [];          // 全局队列
var BUBBLE_QUEUE_MAX = 3;      // 最大队列长度
var bubbleShowing = false;     // 队列处理中标记

function processBubbleQueue() {
  if (bubbleQueue.length === 0) {
    bubbleShowing = false;
    return;
  }
  bubbleShowing = true;
  var item = bubbleQueue.shift();
  item.render();  // 渲染气泡
  // 内部含有 delayedCall 在超时后再次 processBubbleQueue
}
```

---

## 6. 结算面板动画

### 6.1 完整时间线 (代码精确)

```javascript
// renderRoundEndPanel — 行 2463-2696

// T=0ms: 遮罩淡入 (300ms)
self.tweens.add({ targets: overlay, alpha: 0.65, duration: 300, ease: 'Linear' });

// T=300ms: 卡片+得分面板淡入 (300ms)
self.time.delayedCall(300, function() {
  self.tweens.add({ targets: cardBg, alpha: 1, duration: 300, ease: 'Linear' });
  self.tweens.add({ targets: scorePanel, alpha: 1, duration: 300, ease: 'Linear' });
});

// T=400ms: 标题弹入 (400ms, Back.easeOut)
self.time.delayedCall(400, function() {
  self.tweens.add({
    targets: title, scale: 1.0, alpha: 1, duration: 400,
    ease: 'Back.easeOut'
  });
  if (aiWinSub) {
    self.tweens.add({ targets: aiWinSub, alpha: 1, duration: 300, ease: 'Linear' });
  }
});

// T=700ms: 总得分+分隔线1淡入
self.time.delayedCall(700, function() {
  self.tweens.add({ targets: totalLabel, alpha: 1, duration: 200, ease: 'Linear' });
  self.tweens.add({ targets: totalNum, alpha: 1, duration: 300, ease: 'Linear' });
  self.tweens.add({ targets: div1, alpha: 1, duration: 200, ease: 'Linear' });
});

// T=900+n×150ms: 各细项逐行淡入 (每行200ms)
for (var rj = 0; rj < rowTexts.length; rj++) {
  (function(idx, txt) {
    self.time.delayedCall(900 + idx * 150, function() {
      self.tweens.add({ targets: txt, alpha: 1, duration: 200, ease: 'Linear' });
    });
  })(rj, rowTexts[rj]);
}

// T=1500ms: 分隔线2淡入
self.time.delayedCall(1500, function() {
  self.tweens.add({ targets: div2, alpha: 1, duration: 200, ease: 'Linear' });
});

// T=1600ms: 用时文字淡入
self.time.delayedCall(1600, function() {
  self.tweens.add({ targets: timeTxt, alpha: 1, duration: 200, ease: 'Linear' });
});

// T=1800ms: 两个按钮同时淡入
self.time.delayedCall(1800, function() {
  self.tweens.add({ targets: btn1Bg, alpha: 1, duration: 200, ease: 'Linear' });
  self.tweens.add({ targets: btn1Txt, alpha: 1, duration: 200, ease: 'Linear' });
  self.tweens.add({ targets: btn2Bg, alpha: 1, duration: 200, ease: 'Linear' });
  self.tweens.add({ targets: btn2Txt, alpha: 1, duration: 200, ease: 'Linear' });
});
```

### 6.2 动画序列表

| 时间 | 动作 | 属性变化 | duration | ease | 完成时间 |
|:----:|:-----|:---------|:--------:|:----:|:--------:|
| 0ms | 遮罩 | alpha 0→0.65 | 300ms | Linear | 300ms |
| 300ms | 结算卡片 | alpha 0→1 | 300ms | Linear | 600ms |
| 300ms | 得分面板 | alpha 0→1 | 300ms | Linear | 600ms |
| 400ms | 主标题 | scale 0.3→1.0 | 400ms | **Back.easeOut** | 800ms |
| 400ms | AI副标题 | alpha 0→1 | 300ms | Linear | 700ms |
| 700ms | 总得分标签 | alpha 0→1 | 200ms | Linear | 900ms |
| 700ms | 总得分数字 | alpha 0→1 | 300ms | Linear | 1000ms |
| 700ms | 分隔线1 | alpha 0→1 | 200ms | Linear | 900ms |
| 900ms | 得分行1 | alpha 0→1 | 200ms | Linear | 1100ms |
| 1050ms | 得分行2 | alpha 0→1 | 200ms | Linear | 1250ms |
| 1200ms | 得分行3 | alpha 0→1 | 200ms | Linear | 1400ms |
| 1350ms | 得分行4 | alpha 0→1 | 200ms | Linear | 1550ms |
| 1500ms | 分隔线2 | alpha 0→1 | 200ms | Linear | 1700ms |
| 1600ms | 用时文字 | alpha 0→1 | 200ms | Linear | 1800ms |
| 1800ms | 按钮(2个) | alpha 0→1 | 200ms | Linear | 2000ms |

**总时长: 2000ms (2.0秒)**

### 6.3 动画类型摘要

| 类型 | 使用位置 | 参数 |
|:-----|:---------|:-----|
| alpha 淡入 | 遮罩/卡片/面板/得分/细项/按钮/用时 | 0→1, Linear |
| scale + alpha | 主标题弹入 | 0.3→1.0, Back.easeOut, 400ms |

**注意:** 
- 当前代码中总得分数字**没有**跳动动画，只有 alpha 淡入
- 按钮**没有**缩放弹入效果，只有 alpha 淡入
- 唯一使用 Back.easeOut 的是主标题

---

## 7. 搞事情换牌动画

### 7.1 答对盲选 — 翻牌揭示 (_showSwapUI)

```javascript
// 行 ~1724-1895 (抽中真牌时)
// 翻牌揭示 + 飞入动画
self.tweens.add({
  targets: revealCard,
  x: 480, y: 345,
  scaleX: 0.8, scaleY: 0.8,
  angle: 720,
  duration: 600,
  ease: 'Cubic.easeOut',
  onComplete: function() {
    // 实际牌交换 + renderPlayerHand
    // 显示底部按钮
  }
});
```

| 参数 | 值 |
|:-----|:----:|
| 动画类型 | 飞入+旋转 |
| 起始位置 | 选中的牌背位置 (动态) |
| 目标位置 | (480, 345) — 手牌区上方 |
| 缩放 | 1.0 → 0.8 |
| 旋转角度 | 0° → 720° (2圈) |
| duration | **600ms** |
| ease | **Cubic.easeOut** |
| depth | 400 (临时) |
| **后续** | 销毁揭示牌 → 实际数据交换 → renderPlayerHand → 显示底部按钮 |

### 7.2 答错/超时 — AI抢牌动画 (_showSwapResult)

```javascript
// 行 ~1685-1724
// 600ms 延迟后开始飞行动画
self.time.delayedCall(600, function() {
  var animCard = self.add.image(playerCardX, 345, 'cardBack')
    .setDisplaySize(50, 72).setDepth(400);

  self.tweens.add({
    targets: animCard,
    x: targetX,        // 王怼怼=80, 苏甜甜=880
    y: targetY,        // 王怼怼=160, 苏甜甜=200
    scaleX: 0.4,
    scaleY: 0.4,
    angle: 10,         // 轻微旋转
    duration: 700,
    ease: 'Back.easeIn',
    onComplete: function() {
      // 翻牌: 背面→正面
      animCard.setTexture(getCardImageKey(lostCard));
      animCard.setDisplaySize(38, 54).setAngle(0).setDepth(310);
      // 数据修改 + renderPlayerHand
      // 显示结果文字 + 底部按钮
    }
  });
});
```

| 阶段 | 时机 | 动画 | duration | ease |
|:----|:----:|:-----|:--------:|:----:|
| 1. 等待 | T+0ms | 显示反馈文字+解析 | 600ms (setTimeout) | — |
| 2. 起飞 | T+600ms | 卡牌从手牌区飞出 | **700ms** | **Back.easeIn** |
| 3. 到达翻牌 | T+1300ms | 背面→正面 + 缩放 + 复位 | 即时 | — |
| 4. 结果文字 | T+1300ms | 显示 + 3.5s autodestroy | 3.5s | — |

**飞行参数详解:**
| 参数 | 值 |
|:-----|:----:|
| 起始位置 | 玩家手牌中随机一张的实际X, Y=345 |
| 目标X | 王怼怼: **80**, 苏甜甜: **880** |
| 目标Y | 王怼怼: **160**, 苏甜甜: **200** |
| 起始尺寸 | 50×72 (牌背) |
| 结束尺寸 | 38×54 (翻牌后) |
| 旋转 | 0° → 10° |
| 翻牌后尺寸 | 38×54 |
| 翻牌后depth | 310 |

### 7.3 没抽中的揭示动画 (_showSwapUI)

```javascript
// 没抽中时 (selectedBackIdx !== realAICardSlot)
// 在AI真牌位置创建正面图片
if (realAICardSlot >= 0 && realAICardSlot < backCardPositions.length) {
  var realPos = backCardPositions[realAICardSlot];
  var aiRevealCard = self.add.image(realPos.x, realPos.y, getCardImageKey(realAICard))
    .setDisplaySize(backW, backH).setDepth(400);
}
```

| 参数 | 值 |
|:-----|:----:|
| 动画类型 | 即时揭示 (无飞行动画) |
| 位置 | 牌背位置的 X,Y |
| 牌背尺寸 | backW=40, backH=56 (按 `_showSwapUI` 中设置) |
| depth | 400 |

---

## 8. Toast通知动画

### 8.1 实现

```javascript
function showToast(scene, message) {
  var cx = 300;
  var toastBg = scene.add.graphics();
  toastBg.fillStyle(0x000000, 0.7);
  toastBg.fillRoundedRect(cx - 100, 206, 200, 38, 10).setDepth(200);
  var toastText = scene.add.text(cx, 225, message, {
    fontSize: '13px', color: '#FFFFFF'
  }).setOrigin(0.5).setDepth(201);
  scene.time.delayedCall(1200, function() {
    toastBg.destroy();
    toastText.destroy();
  });
}
```

| 参数 | 值 |
|:-----|:----:|
| 出现 | 即时显示 (无过渡) |
| 停留 | **1200ms** |
| 消失 | 即时 destroy (无过渡) |
| 位置 | (200, 206) w=200 h=38, 文字在(300,225) |

---

## 9. 搞事情弹窗动画

### 9.1 遮罩与卡片

**搞事情模式全程使用无过渡动画:**
- 遮罩: `fillRect(0,0,960,600)` 黑0.75 — 即时显示
- 白色卡片: `fillRoundedRect(150,55,660,320)` — 即时显示
- 副标题: 即时显示
- 选项: 即时显示

**唯一动画:**
- 结算面板逐行动画 (详见第6章)
- 换牌飞牌动画 (详见第7章)

### 9.2 搞事情倒计时

**代码中没有可视化倒计时条:**
```javascript
// _renderQuestion 末尾
self.chaosTimeoutTimer = self.time.delayedCall(30000, function() {
  self._handleChaosTimeout(aiId);
});
```

30秒后自动触发超时，无UI进度条。

### 9.3 题型选择Hover

```javascript
card.on('pointerover', function() {
  this.clear();
  this.fillStyle(0xE0EAFF, 1);
  this.fillRoundedRect(cx, cy, cardW, cardH, 10);
  this.lineStyle(2, 0x7C4DFF, 1);
  this.strokeRoundedRect(cx, cy, cardW, cardH, 10);
});
card.on('pointerout', function() {
  this.clear();
  this.fillStyle(0xF0F4FF, 1);
  this.fillRoundedRect(cx, cy, cardW, cardH, 10);
  this.lineStyle(1.5, 0xCCD8FF, 1);
  this.strokeRoundedRect(cx, cy, cardW, cardH, 10);
});
```

| 参数 | 值 |
|:-----|:----:|
| 默认 | fill #F0F4FF, stroke 1.5px #CCD8FF |
| hover | fill #E0EAFF, stroke 2px #7C4DFF |
| 过渡 | 即时 (无动画) |

---

## 10. AI回合延迟

### 10.1 所有延迟时间

| 起点 | 终点 | 延迟 (ms) | 代码位置 |
|:-----|:-----|:---------:|:---------|
| 玩家出牌 | AI1 思考 | **600** | confirmPlay |
| AI1/AI2 思考 | 实际出牌 | **1200** | doAITurn |
| 玩家不出(1次) | AI2 思考 | **800** | doPlayerPass |
| 玩家不出(2次) | lastPlayPlayer | **800** | doPlayerPass |
| AI1 出牌 | AI2 思考 | **1200** | handleAIPlay/localAIPlay |
| AI1 不出 | AI2 思考 | **1200** | handleAIPass |
| AI2 出牌/不出 | 玩家回合 | 0 (即时) | handleAIPlay/handleAIPass |
| AI 过(2次) | lastPlayPlayer | **1200** | handleAIPass |
| 叫分结束 | 出牌阶段 | **1200** | finishBidding |
| 三家都不叫 | 重新发牌 | **1500** | onBiddingResult |
| 发牌完成 | 叫分阶段 | **800** | create() 末尾 |

### 10.2 思考期间 UI

| 状态 | 状态文字 |
|:-----|:---------|
| AI1 思考 | `王怼怼思考中...` |
| AI2 思考 | `苏甜甜思考中...` |
| AI1 出牌 | `王怼怼出了 顺子，轮到苏甜甜` |
| AI2 出牌后 | `轮到你出牌` |

---

## 11. 动画参数速查表

### 11.1 Phaser Tween 动画

| 场景 | 属性 | duration | ease | delay | 类型 |
|:-----|:-----|:--------:|:----:|:-----:|:----:|
| 结算遮罩 | alpha 0→0.65 | 300ms | Linear | 0 | tween |
| 结算卡片 | alpha 0→1 | 300ms | Linear | 300ms | tween |
| 得分面板 | alpha 0→1 | 300ms | Linear | 300ms | tween |
| 主标题 | scale 0.3→1.0, alpha 0→1 | 400ms | **Back.easeOut** | 400ms | tween |
| AI副标题 | alpha 0→1 | 300ms | Linear | 400ms | tween |
| 总得分标签 | alpha 0→1 | 200ms | Linear | 700ms | tween |
| 总得分数字 | alpha 0→1 | 300ms | Linear | 700ms | tween |
| 分隔线1 | alpha 0→1 | 200ms | Linear | 700ms | tween |
| 各细项 | alpha 0→1 | 200ms | Linear | 900+150n | tween |
| 分隔线2 | alpha 0→1 | 200ms | Linear | 1500ms | tween |
| 用时文字 | alpha 0→1 | 200ms | Linear | 1600ms | tween |
| 按钮(2个) | alpha 0→1 | 200ms | Linear | 1800ms | tween |
| 答对翻牌 | x/y/scale/angle | 600ms | **Cubic.easeOut** | 0 | tween |
| 答错抢牌 | x/y/scale/angle | 700ms | **Back.easeIn** | 600ms | tween |

### 11.2 setTimeout 延迟

| 场景 | duration | 用途 |
|:-----|:--------:|:-----|
| AI 思考 | 1200ms | 模拟AI思考 |
| 玩家→AI | 600ms | 玩家出牌后过渡 |
| 玩家pass→AI | 800ms | 不出后过渡 |
| Toast 停留 | 1200ms | 提示自动消失 |
| 气泡停留(普通) | 4000ms | 出牌气泡 |
| 气泡停留(炸弹) | 5000ms | 炸弹气泡 |
| 气泡停留(搞事情) | 3500ms | 搞事情气泡 |
| 重新发牌 | 1500ms | redeal 延迟 |
| 叫分出牌 | 1200ms | 叫分→出牌过渡 |

### 11.3 无动画操作

| 操作 | 说明 |
|:-----|:------|
| 手牌选中/取消 | 直接 y += 16 |
| 出牌 displayPlay | 在目标位置直接 add.image |
| 搞事情弹窗 | 直接 create/fill |
| 题型选择 Hover | 即时颜色变化 |
| Toast 出现/消失 | 即时 add/destroy |
| 气泡出现/消失 | 即时 add/destroy |

---

## 12. 与旧文档差异说明

### 12.1 代码 vs 旧 SoundAnimation.md

| # | 旧文档 | 代码实际 | 说明 |
|:-:|:-------|:---------|:------|
| 1 | 总得分有数字跳动(1200ms, 30ms递增) | **直接显示最终值 + alpha淡入** | 无跳动动画 |
| 2 | 按钮有弹入(scale 0→1, Back.easeOut) | **alpha 0→1, Linear** | 无限入效果 |
| 3 | 气泡有进入动画(scale 0.8→1.0, 150ms) | **即时显示** | 无进入动画 |
| 4 | 气泡有退出动画(alpha 1→0, 200ms) | **即时 destroy** | 无退出动画 |
| 5 | 炸弹气泡闪烁(border flash) | 仅停留时间不同(5s vs 4s) | 无闪烁效果 |
| 6 | 答对闪光(绿3次) | 文字 + 音效 | 无闪光动画 |
| 7 | 答错抖动(左右3px×3) | 文字 + 音效 | 无抖动动画 |
| 8 | `canBeat` 返回 `{canBeat, reason}` | 返回 **boolean** | 旧文档不准确 |
| 9 | dieShuffle1 用于洗牌动画 | **已加载但未使用** | 备用文件 |

### 12.2 已知缺失

| 特性 | 状态 |
|:-----|:------|
| 发牌动画 | 未实现 (P2) |
| 胜利粒子效果 | 未实现 (P1) |
| BGM 背景音乐 | 未实现 (P3) |
| 音量控制UI | 未实现 (P2) |
| 可视化倒计时条 | 未实现 (P1) |

---

## 13. 验收标准

### 13.1 音效

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| S1 | 选中手牌播放 cardSlide | 随机1-3, vol 0.6 | SoundManager.selectCard |
| S2 | 取消选中播放 cardSlide | vol 0.5 (比选中小) | SoundManager.deselectCard |
| S3 | 出牌播放 cardPlace | vol 0.8 | SoundManager.playCard |
| S4 | 轮到玩家播放 chipsCollide | vol 0.7 | SoundManager.playerTurn |
| S5 | 赢牌播放 cardPlace3 | vol 0.9 | SoundManager.win |
| S6 | 输牌播放 cardSlide1 | vol 0.6 | SoundManager.lose |
| S7 | 叫分播放 chipsCollide | vol 0.7 | SoundManager.bid |
| S8 | 不叫播放 cardSlide | vol 0.5 | SoundManager.passBid |
| S9 | AudioContext 自动恢复 | 首次pointerdown触发 | init |
| S10 | 搞事情暂停/恢复音效 | pauseAll/resumeAll | doAction/_destroyChaos |

### 13.2 卡牌动画

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| C1 | 选中手牌上移16px | y = origY - 16, 即时 | renderPlayerHand |
| C2 | 取消选中下移16px | y = origY + 16, 即时 | renderPlayerHand |
| C3 | 出牌在目标位置显示 | 玩家(360,195), AI1(280,133), AI2(680,133) | displayPlay |
| C4 | 答对翻牌旋转720°飞入 | 600ms, Cubic.easeOut | _showSwapUI |
| C5 | 答错AI抢牌飞行动画 | 700ms, Back.easeIn | _showSwapResult |

### 13.3 气泡

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| B1 | 出牌气泡显示4秒 | delayedCall(4000) | _showPlayBubble |
| B2 | 炸弹气泡显示5秒 | delayedCall(5000) | _showPlayBubble |
| B3 | 搞事情气泡显示3.5秒 | delayedCall(3500) | _showAiBubble |
| B4 | 气泡队列最大3个 | BUBBLE_QUEUE_MAX=3 | processBubbleQueue |

### 13.4 结算面板

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| E1 | 遮罩300ms淡入至0.65 | alpha 0→0.65, Linear | ~2465 |
| E2 | 卡片300ms后淡入 | delayedCall(300) | ~2598 |
| E3 | 标题400ms弹入 | Back.easeOut, scale 0.3→1.0 | ~2605 |
| E4 | 得分+分隔线700ms后淡入 | delayedCall(700) | ~2612 |
| E5 | 细项逐行150ms间隔 | 900/1050/1200/1350ms | ~2619 |
| E6 | 按钮1800ms后淡入 | delayedCall(1800) | ~2630 |
| E7 | 总时长2.0s后可交互 | 最后一个动画2000ms完成 | 计算 |

### 13.5 搞事情/Toast

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| T1 | Toast 1200ms自动消失 | delayedCall(1200) | showToast |
| T2 | 搞事情遮罩即时显示 | 黑0.75 fillRect | _createChaosOverlay |
| T3 | 题型hover颜色变化 | #F0F4FF→#E0EAFF, 即时 | _showTypeSelection |
| T4 | 30秒超时 | delayedCall(30000) | _renderQuestion |

### 13.6 AI延迟

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| A1 | 玩家出牌→AI1: 600ms | delayedCall(600) | confirmPlay |
| A2 | AI思考→出牌: 1200ms | delayedCall(1200) | doAITurn |
| A3 | 玩家pass→AI2: 800ms | delayedCall(800) | doPlayerPass |
| A4 | AI1出→AI2: 1200ms | delayedCall(1200) | handleAIPlay |
| A5 | AI2出→玩家: 即时 | 无delayedCall | handleAIPlay |

---

## 附录: 函数索引

| 函数 | 行号 | 功能 | 动画相关 |
|:-----|:----:|:-----|:---------|
| `SoundManager` | ~31 | 音效管理 | 10个音效函数 |
| `preload()` | ~210 | 资源预加载 | 10个音效文件(mp3+ogg) |
| `renderPlayerHand()` | ~408 | 手牌渲染 | 选中 y-16 / 取消 y+16 |
| `displayPlay()` | ~1325 | 出牌显示 | 即时渲染在目标位置 |
| `showToast()` | 2444 | Toast提示 | 1200ms自动destroy |
| `renderRoundEndPanel()` | 2463 | 结算面板 | 9段动画序列 |
| `_showPlayBubble()` | ~2160 | 出牌气泡 | 4s/5s自动destroy |
| `_showAiBubble()` | ~2185 | 搞事情气泡 | 3.5s自动destroy |
| `_showSwapUI()` | ~1724 | 答对换牌 | 翻牌旋转720°, 600ms |
| `_showSwapResult()` | ~1685 | 答错抢牌 | 飞行700ms, Back.easeIn |
| `_createChaosOverlay()` | ~1500 | 搞事情遮罩 | 即时显示 |
| `processBubbleQueue()` | ~2140 | 气泡队列 | 串行渲染 |
| `doAITurn()` | ~1130 | AI回合 | 1200ms思考延迟 |
