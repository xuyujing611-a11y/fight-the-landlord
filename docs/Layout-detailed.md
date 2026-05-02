# 布局与视觉系统 — 超详细设计文档

**版本:** v2.0  
**作者:** 产品经理  
**日期:** 2026-05-02  
**基准画布:** 960×600 横屏 (Phaser 3 Scale.FIT)  
**对应源码:** `src/client/js/game.js` (2897行)  
**依赖文件:** `src/client/js/CardEngine.js`  

> ⚠️ **代码对齐说明**: 本文档所有坐标、颜色、depth 值直接从 `game.js` 中提取，与代码有一致性。如有与旧版 `Layout.md` 不一致之处，以此版为准。

---

## 目录

1. [画布与缩放配置](#1-画布与缩放配置)
2. [背景系统](#2-背景系统)
3. [顶部状态栏](#3-顶部状态栏)
4. [AI 头像与信息](#4-ai-头像与信息)
5. [中央出牌区](#5-中央出牌区)
6. [手牌区](#6-手牌区)
7. [底牌系统](#7-底牌系统)
8. [底部功能按钮](#8-底部功能按钮)
9. [叫分UI](#9-叫分ui)
10. [出牌记录面板](#10-出牌记录面板)
11. [结算面板](#11-结算面板)
12. [Toast 通知](#12-toast-通知)
13. [搞事情模式 UI](#13-搞事情模式-ui)
14. [全屏与自适应](#14-全屏与自适应)
15. [色彩系统](#15-色彩系统)
16. [字体规范](#16-字体规范)
17. [Z轴深度层级](#17-z轴深度层级)
18. [动画与过渡参数](#18-动画与过渡参数)
19. [交互区域全表](#19-交互区域全表)
20. [与旧文档的差异说明](#20-与旧文档的差异说明)
21. [验收标准](#21-验收标准)

---

## 1. 画布与缩放配置

| 属性 | 代码值 | 来源行 |
|------|--------|:------:|
| width | 960 | GameConfig |
| height | 600 | GameConfig |
| backgroundColor | `#1B5E20` | GameConfig |
| 缩放模式 | `Phaser.Scale.FIT` | GameConfig.scale.mode |
| 居中 | `Phaser.Scale.CENTER_BOTH` | GameConfig.scale.autoCenter |
| 渲染器 | `Phaser.AUTO` | GameConfig.type |
| DOM 容器 | `'game-container'` | GameConfig.parent |
| DOM 创建 | `{ createContainer: true }` | GameConfig.dom |

### 1.1 全屏缩放切换

| 模式 | 缩放模式 | 效果 |
|:----:|:---------:|------|
| 非全屏 | `Phaser.Scale.FIT` | 等比缩放，保留完整画面，可能留绿边 |
| 全屏中 | `Phaser.Scale.FILL` | 填满屏幕，允许左右裁剪（不裁顶部/底部按钮区域） |

### 1.2 全屏切换逻辑

```javascript
// 全屏按钮 (x=940, y=24)
fsBtn.on('pointerdown', function() {
  var el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } else {
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }
});
```

**缩放自适应函数** `zoomCanvasToFill()`:

```javascript
function zoomCanvasToFill() {
  var container = document.getElementById('game-container');
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    container.style.width = window.innerWidth + 'px';
    container.style.height = window.innerHeight + 'px';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    game.scale.mode = Phaser.Scale.FILL;
    game.scale.refresh();
  } else {
    container.style.width = '';
    container.style.height = '';
    container.style.position = '';
    container.style.top = '';
    container.style.left = '';
    game.scale.mode = Phaser.Scale.FIT;
    game.scale.refresh();
  }
}
```

事件绑定: `fullscreenchange`, `webkitfullscreenchange`, `resize` → `zoomCanvasToFill()`

### 1.3 首次点击自动全屏

```javascript
var autoFSdone = false;
self.input.once('pointerdown', function() {
  if (autoFSdone) return;
  autoFSdone = true;
  var el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(function(){});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
});
```

**行为:** 首次点击画布任何位置，自动触发一次全屏请求。用户拒绝后 `.catch` 静默处理，不再重复请求。

---

## 2. 背景系统

### 2.1 渐变底色 (drawTableBackground)

```javascript
function drawTableBackground(scene) {
  var W = 960, H = 600;
  var bg = scene.add.graphics();
  bg.fillGradientStyle(0x1B5E20, 0x1B5E20, 0x0D3B0F, 0x0D3B0F, 1);
  bg.fillRect(0, 0, W, H);
  // ...
}
```

| 角 | 颜色 | Alpha |
|:---:|:----:|:-----:|
| 左上 | `#1B5E20` | 1.0 |
| 右上 | `#1B5E20` | 1.0 |
| 左下 | `#0D3B0F` | 1.0 |
| 右下 | `#0D3B0F` | 1.0 |

渐变从顶部向下由亮绿(`#1B5E20`)渐变到深绿(`#0D3B0F`)。

### 2.2 中心光晕

| 图层 | 形状 | 圆心X | 圆心Y | 宽 | 高 | 颜色 | Alpha | depth |
|:----:|:----:|:-----:|:-----:|:--:|:--:|:----:|:-----:|:-----:|
| 1 | Ellipse | 480 | 260 | 320 | 354 | `#2E7D32` | 0.15 | — |
| 2 | Ellipse | 480 | 260 | 240 | 360 | `#388E3C` | 0.1 | — |

**注意：** `W/2 = 480`，`H/2 - 40 = 260`（中心偏上40px）

### 2.3 外圈圆角边框

```
lineStyle(2, 0x4CAF50, 0.3)
strokeRoundedRect(13, 52, 934, 470, 9)
// 934 = 960 - 26, 470 = 600 - 130
```

| 属性 | 值 |
|:----:|:---:|
| X | 13 |
| Y | 52 |
| W | 934 (960-26) |
| H | 470 (600-130) |
| 圆角 | 9 |
| 颜色 | `#4CAF50` |
| Alpha | 0.3 |
| 线宽 | 2px |

### 2.4 装饰矩形

```
// 大内框
strokeRect(400, 177, 118, 166)  // cx-80, cy-83, 118×166
// 小内框
strokeRect(432, 201, 96, 118)   // cx-48, cy-59, 96×118
```

其中 `cx = 480, cy = 260`。

| 元素 | X | Y | W | H | 颜色 | Alpha | 线宽 |
|:----:|:-:|:-:|:-:|:-:|:----:|:-----:|:----:|
| 装饰矩形1 | 400 | 177 | 118 | 166 | `#66BB6A` | 0.15 | 1px |
| 装饰矩形2 | 432 | 201 | 96 | 118 | `#66BB6A` | 0.15 | 1px |

### 2.5 四角装饰圆

四个角坐标: `(35,63)`, `(925,63)`, `(35,543)`, `(925,543)`

每个角画3层同心圆:
- r=9, color `#4CAF50`, alpha 0.18
- r=10, color `#4CAF50`, alpha 0.18
- r=5, color `#4CAF50`, alpha 0.18

### 2.6 中心装饰圆

```
// cy = 250 (cx-10 = 470 不对? 代码: diamond.strokeCircle(cx, cy - 10, 67))
// cy = cx - 10 = 480 - 10? 不，是 cx, cy-10，等于是 (480, 250)
```

| 元素 | 圆心X | 圆心Y | 半径 | 颜色 | Alpha | 线宽 |
|:----:|:-----:|:-----:|:----:|:----:|:-----:|:----:|
| 中心装饰圆1 | 480 | 250 | 67 | `#66BB6A` | 0.08 | 1px |
| 中心装饰圆2 | 480 | 250 | 93 | `#66BB6A` | 0.08 | 1px |

---

## 3. 顶部状态栏

### 3.1 整体区域

```
Y: 0 ~ 56
X: 0 ~ 960
```

### 3.2 背景

```javascript
var tb = scene.add.graphics();
tb.fillStyle(0x000000, 0.3);
tb.fillRect(0, 0, 960, 56).setDepth(10);
```

底部分隔线:
```javascript
var sep = scene.add.graphics();
sep.lineStyle(1, 0x66BB6A, 0.2);
sep.lineBetween(0, 56, 960, 56).setDepth(11);
```

### 3.3 状态栏元素坐标 (深度=11)

| 元素 | 内容 | X | Y | fontSize | color | fontStyle | origin |
|:----:|:----:|:-:|:-:|:--------:|:-----:|:---------:|:------:|
| 回合 | `第 1/10 回合` | 12 | 9 | 12px | `#E8F5E9` | bold | (0) |
| 状态 | 动态文字 | 480 | 8 | 10px | `#A5D6A7` | bold | (0.5, 0) |
| AI1名称 | `王怼怼` | 200 | 9 | 10px | `#E8F5E9` | bold | (0) |
| AI1牌数 | `剩余 17 张` | 200 | 22 | 10px | `#A5D6A7` | normal | (0) |
| AI2名称 | `苏甜甜` | 720 | 9 | 10px | `#E8F5E9` | bold | (0) |
| AI2牌数 | `剩余 17 张` | 720 | 22 | 10px | `#A5D6A7` | normal | (0) |
| 全屏按钮 | `⛶` | 940 | 24 | 22px | `#FFFFFF` | normal | (1, 0.5) |

**字体族统一:** `'"PingFang SC","Microsoft YaHei",sans-serif'`

**全屏按钮样式:**
```
backgroundColor: '#00000066',
padding: { x: 8, y: 6 },
depth: 200
```

---

## 4. AI 头像与信息

### 4.1 makeAvatarImage 函数

```javascript
function makeAvatarImage(scene, key, x, y, bgColor, name) {
  var g = scene.add.graphics();
  g.fillStyle(bgColor, 1);
  g.fillRoundedRect(x - 20, y - 20, 40, 40, 10);          // 底色 40×40 圆角10
  g.lineStyle(2, 0xFFFFFF, 0.8);
  g.strokeRoundedRect(x - 28, y - 28, 56, 56, 10);         // 外框 56×56 圆角10, alpha 0.8
  var img = scene.add.image(x, y, key).setDisplaySize(34, 34).setDepth(12);
  return img;
}
```

**⚠️ 与旧Layout.md差异:**
- 头像图片实际显示尺寸为 **34×34**（不是36×36）
- 外框白色描边为 **56×56**（不是视觉上的头像框）
- 头像底色填满 40×40 圆角矩形

### 4.2 精确坐标

| AI | 类型 | 头像中心 | 底色 | 外框尺寸 | 名称X,Y | 牌数X,Y |
|:--:|:----:|:--------:|:----:|:--------:|:-------:|:--------:|
| 王怼怼 (AI1) | 左侧 | (176, 20) | `#4FC3F7` | 56×56 | (200, 9) | (200, 22) |
| 苏甜甜 (AI2) | 右侧 | (788, 20) | `#FFB74D` | 56×56 | (720, 9) | (720, 22) |

---

## 5. 中央出牌区

### 5.1 背景

```javascript
var cx = 480;
var playBg = scene.add.graphics();
playBg.fillStyle(0x000000, 0.1);
playBg.fillRoundedRect(160, 59, 640, 206, 10).setDepth(10);
```

| 属性 | 值 |
|:----:|:---:|
| X | 160 |
| Y | 59 |
| W | 640 |
| H | 206 |
| 圆角 | 10px |
| 填充 | `#000000` alpha 0.1 |
| depth | 10 |

### 5.2 区域标签

| 标签 | 内容 | X | Y | fontSize | color | alpha | depth | origin |
|:----:|:----:|:-:|:-:|:--------:|:-----:|:-----:|:-----:|:------:|
| 出牌区标签 | `出牌区` | 480 | 218 | 10px | `#66BB6A` | 0.4 | 11 | 0.5 |
| AI1出牌标签 | `王怼怼：` | 182 | 65 | 10px | `#A5D6A7` | 1 | 11 | — |
| AI2出牌标签 | `苏甜甜：` | 690 | 65 | 10px | `#A5D6A7` | 1 | 11 | — |
| 玩家出牌标签 | `你出：` | 480 | 270 | 10px | `#A5D6A7` | 1 | 11 | 0.5 |

### 5.3 出牌位置 (displayPlay)

```javascript
var positions = {
  player: { x: 360, y: 195, w: 50, h: 72, origin: 0.5 },
  ai1:    { x: 280, y: 133, w: 42, h: 60, origin: 0.5 },
  ai2:    { x: 680, y: 133, w: 42, h: 60, origin: 0.5 }
};
```

| 角色 | 出牌中心X | 出牌Y | 牌宽 | 牌高 | depth | 重叠量 |
|:----:|:---------:|:-----:|:----:|:----:|:-----:|:------:|
| 王怼怼 | 280 | 133 | 42 | 60 | 21 | min(w×0.6, (480-w)/(n-1)) |
| 苏甜甜 | 680 | 133 | 42 | 60 | 21 | 同上 |
| 玩家 | 360 | 195 | 50 | 72 | 21 | 同上 |

**重叠量公式:**
```javascript
var overlap = Math.min(pos.w * 0.6, (480 - pos.w) / Math.max(n - 1, 1));
// 王怼怼: overlap = min(25.2, (480-42)/(n-1))
// 玩家: overlap = min(30, (480-50)/(n-1))
```

**起始X计算:**
```javascript
var totalW = pos.w + (n - 1) * overlap;
var startX = pos.x - totalW / 2;
```

### 5.4 出牌标签管理

`displayPlay` 函数使用 `ai1PlayCardsGraphics`, `ai2PlayCardsGraphics`, `myPlayCardsGraphics` 三个数组存储图片引用，每次调用时先销毁旧数组中的元素。

---

## 6. 手牌区

### 6.1 背景

```javascript
var handBg = scene.add.graphics();
handBg.fillStyle(0x000000, 0.15);
handBg.fillRoundedRect(20, 300, 920, 115, 10).setDepth(10);
```

| 属性 | 值 |
|:----:|:---:|
| X | 20 |
| Y | 300 |
| W | 920 |
| H | 115 |
| 圆角 | 10px |
| 填充 | `#000000` alpha 0.15 |
| depth | 10 |

### 6.2 手牌标签

```javascript
scene.add.text(68, 305, '你的手牌', {
  fontSize: '11px', color: '#A5D6A7'
}).setDepth(11);
```

### 6.3 手牌规格

| 属性 | 值 |
|:----:|:---:|
| 牌宽 (cw) | **56 px** |
| 牌高 (ch) | **80 px** |
| 牌间距 (gap) | **4 px** — 均匀展开，无重叠 |
| 底边基础Y (baseY) | **345** |
| 选中缩放 | **scale(1.15)** |
| depth | **110** |

### 6.4 排列公式 (均匀展开)

```javascript
var n = hand.length, cw = 56, ch = 80, gap = 4;
var totalWidth = cw * n + gap * (n - 1);
var startX = 180 + (700 - totalWidth) / 2;
var baseY = 345;

for (var ii = 0; ii < n; ii++) {
  var cx = startX + ii * (cw + gap) + cw / 2;
  var cy = baseY;  // 直线排列，无弧线
  var img = self.add.image(cx, cy, key).setDisplaySize(cw, ch).setDepth(110);
}
```

### 6.5 选中/取消状态

```javascript
img.on('pointerdown', function() {
  if (self.gameState !== GAME_STATE.PLAYER_TURN) {
    showToast(self, '现在不是你的出牌阶段');
    return;
  }
  var s = this.getData('selected');
  if (s) {
    // 取消选中
    this.setScale(1.0);
    this.setData('selected', false);
    // 从 selectedCards 中移除
  } else {
    // 选中
    this.setScale(1.15);
    this.setData('selected', true);
    // 加入 selectedCards
  }
});
```

| 操作 | 变化 | 音效 |
|:----:|:----:|:----:|
| 选中 | `scale(1.15)` 放大突出 | `SoundManager.selectCard()` (cardSlide1-3, vol 0.6) |
| 取消选中 | `scale(1.0)` 恢复原尺寸 | `SoundManager.deselectCard()` (cardSlide1-3, vol 0.5) |

---

## 7. 底牌系统

### 7.1 初始占位

在 `createPlayArea` 中创建:

```javascript
scene.add.text(460, 60, '底牌: ? ? ?', {
  fontSize: '8px', color: '#66BB6A', alpha: 0.4
}).setDepth(11);
```

| 属性 | 值 |
|:----:|:---:|
| X | 460 |
| Y | 60 |
| fontSize | **8px** |
| color | `#66BB6A` |
| alpha | 0.4 |
| depth | 11 |

### 7.2 showBottomCards 函数

```javascript
GameScene.prototype.showBottomCards = function (cards) {
  // 清除旧图片
  if (this.bottomCardImgs) {
    for (var bi = 0; bi < this.bottomCardImgs.length; bi++) this.bottomCardImgs[bi].destroy();
  }
  this.bottomCardImgs = [];
  if (this.bottomCardText) this.bottomCardText.destroy();

  if (!cards || cards.length === 0) {
    this.bottomCardText = this.add.text(480, 72, '底牌: ? ? ?', {
      fontSize: '8px', color: '#66BB6A', alpha: 0.4
    }).setOrigin(0.5).setDepth(20);
    return;
  }
  // B38: 取消显示底牌牌背图片，底牌直接融入地主手牌
};
```

**行为:**
- 无底牌(cards=null/空)时: 显示 "底牌: ? ? ?" 文字在 (480,72)，depth 20，带 origin(0.5)
- 有底牌时: **不做任何展示**（设计决策B38），底牌直接融入地主手牌，通过 `renderPlayerHand()` 更新

---

## 8. 底部功能按钮

### 8.1 按钮区域

```javascript
var bw = 72, bh = 48, gap = 14;
var totalW = bw * 5 + gap * 4;           // = 416
var startX = (960 - totalW) / 2;         // = 272
var btnY = 442;
```

| 序号 | 标签 | 颜色 (hex) | X | Y | W | H | 圆角 | depth | 触发函数 |
|:----:|:----:|:----------:|:-:|:-:|:-:|:-:|:----:|:-----:|:--------:|
| 0 | `出牌` | `#4ECDC4` | 272 | 442 | 72 | 48 | 8 | 100 | `doPlayerPlay()` |
| 1 | `提示` | `#FFD93D` | 358 | 442 | 72 | 48 | 8 | 100 | `doHint()` |
| 2 | `不出` | `#FF6B6B` | 444 | 442 | 72 | 48 | 8 | 100 | `doPlayerPass()` |
| 3 | `搞事情` | `#7C4DFF` | 530 | 442 | 72 | 48 | 8 | 100 | `doAction()` |
| 4 | `底牌查看` | `#78909C` | 616 | 442 | 72 | 48 | 8 | 100 | `showBottomCards()` |

### 8.2 按钮内部结构

每个按钮由两部分组成:
- **背景:** Graphics + fillRoundedRect + setInteractive + `setDepth(100)`
- **文字:** Text, fontSize 13px, color `#FFFFFF`, fontStyle bold, origin(0.5), `setDepth(101)`

文字微调: `y = btnY + bh/2 - 1` (向上偏移1px平衡视觉)

### 8.3 点击交互

点击区域使用 `new Phaser.Geom.Rectangle(bx, btnY, bw, bh)` 精确匹配按钮尺寸。

点击状态:
- **"底牌查看"** → `showBottomCards(scene.remainingCards)` — 展示底牌文字（如无底牌则显示 "底牌: ? ? ?"）

### 8.4 隐藏/显示

```javascript
hideActionButtons()  // 叫分开始时调用，销毁所有actionButtons元素

showActionButtons()  // 叫分结束后调用，重新调用createActionButtons
```

---

## 9. 叫分UI

### 9.1 整体布局

```javascript
var cx = 480;
var uiY = 280;
var bw = 96, bh = 52, gap = 12;
var totalW = bw * 4 + gap * 3;     // = 420
var startX = (960 - totalW) / 2;   // = 270
```

| 按钮 | 标签 | 颜色 (hex) | X | Y | W | H | 圆角 | depth |
|:----:|:----:|:----------:|:-:|:-:|:-:|:-:|:----:|:-----:|
| 不叫 | `不叫` | `#FF6B6B` | 270 | 280 | 96 | 52 | 10 | 200 |
| 1分 | `1分` | `#4ECDC4` | 378 | 280 | 96 | 52 | 10 | 200 |
| 2分 | `2分` | `#FFD93D` | 486 | 280 | 96 | 52 | 10 | 200 |
| 3分 | `3分` | `#FF6B35` | 594 | 280 | 96 | 52 | 10 | 200 |

### 9.2 辅助元素

| 元素 | 内容 | X | Y | fontSize | color | depth |
|:----:|:----:|:-:|:-:|:--------:|:-----:|:-----:|
| 提示文字 | `请叫分` | 480 | 170 | 15px | `#FFFFFF` bold | 200 |
| 强度提示 | `★ 手牌很强 (强度分: N)` | 480 | 260 | 10px | `#A5D6A7` | 200 |

### 9.3 叫分按钮文字

每个按钮的标签文字在按钮内居中，fontSize 14px, color `#FFFFFF`, fontStyle bold, depth 201。

### 9.4 叫分交互

```javascript
bg.on('pointerup', function() {
  self.handlePlayerBid(val);
});
```

点击后自动 `hideBiddingUI()` 销毁所有叫分UI元素。

---

## 10. 出牌记录面板

### 10.1 创建 (createPlayHistoryArea)

```javascript
function createPlayHistoryArea(scene) {
  var bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.2);
  bg.fillRoundedRect(12, 58, 140, 240, 6).setDepth(200);

  scene.add.text(20, 63, '出牌', {
    fontSize: '9px', color: '#81C784'
  }).setDepth(201);

  scene.playHistoryText = scene.add.text(20, 74, '', {
    fontSize: '9px', color: '#C8E6C9',
    lineSpacing: 3, wordWrap: { width: 124 }
  }).setDepth(201);
}
```

| 元素 | X | Y | W | H | 圆角 | fontSize | color | depth |
|:----:|:-:|:-:|:-:|:-:|:----:|:--------:|:-----:|:-----:|
| 面板背景 | 12 | 58 | 140 | 240 | 6 | — | 黑0.2 | 200 |
| 标题 | 20 | 63 | — | — | — | 9px | `#81C784` | 201 |
| 内容 | 20 | 74 | 124(wordWrap) | — | — | 9px | `#C8E6C9` | 201 |

### 10.2 记录格式

```
entry = { text: "你: 3 4 5 6 7", cards: [...] }   // 出牌
entry = { text: "王怼怼: 不出", pass: true }      // 跳过
```

- 最大保留 **8条** (`playHistory.length > 8` 时 slice(-8))
- 最多显示 **6条** (从 `Math.max(0, length-6)` 处开始显示)
- 玩家颜色: `你`, AI1: `王怼怼`, AI2: `苏甜甜`

---

## 11. 结算面板

### 11.1 函数签名

```javascript
GameScene.prototype.renderRoundEndPanel = function (winner)
// winner: 'player' | 'ai1' | 'ai2'
```

### 11.2 层级结构

```
Depth 400:      整个半透明遮罩 (overlay) — 初始 alpha=0, 淡入至 0.65
Depth 401:      结算卡片背景 (200,60 → 560×480)
Depth 402:      标题、得分面板、分隔线
Depth 403:      细项文字、总得分数字、按钮背景、用时文字
Depth 404:      按钮文字
```

### 11.3 精确坐标

| 元素 | 类型 | X | Y | W | H | 圆角 | 备注 |
|:----:|:----:|:-:|:-:|:-:|:-:|:----:|------|
| 半透明遮罩 | fillRect | 0 | 0 | 960 | 600 | — | 初始alpha 0 → 0.65 |
| 结算卡片 | fillRoundedRect | 200 | 60 | 560 | 480 | 12 | fill `#1A1A2E` 0.92 |
| 卡片边框 | strokeRoundedRect | 200 | 60 | 560 | 480 | 12 | 金色(赢) `#FFD700` / 红色(输) `#FF5252`, 0.8 |
| 主标题 | text | 480 | 90 | — | — | — | 28px bold, origin(0.5) |
| AI获胜副标题 | text | 480 | 120 | — | — | — | 16px `#FF5252`, origin(0.5) |
| 得分面板 | fillRoundedRect | 240 | 142 | 480 | 260 | 8 | fill 黑 0.25 |
| 总得分标题 | text | 480 | 155 | — | — | — | "💰 总得分", 14px, `#A5D6A7` |
| 总得分数字 | text | 480 | 190 | — | — | — | `+N`, 36px bold, `#FFD700` |
| 分隔线1 | lineBetween | (260,215) → (700,215) | — | — | — | line 1px, 白 0.1 |
| 细项行1 | text | 270 | 235 | — | — | — | 13px |
| 细项行2 | text | 270 | 260 | — | — | — | 13px |
| 细项行3 | text | 270 | 285 | — | — | — | 13px |
| 细项行4 | text | 270 | 310 | — | — | — | 13px |
| 分隔线2 | lineBetween | (260,335) → (700,335) | — | — | — | line 1px, 白 0.1 |
| 再来一局按钮 | fillRoundedRect | 290 | 370 | 170 | 44 | 8 | fill `#4ECDC4` |
| 返回首页按钮 | fillRoundedRect | 500 | 370 | 170 | 44 | 8 | fill `#78909C` |
| 按钮文字(左) | text | 375 | 392 | — | — | — | "🔄 再来一局", 15px bold |
| 按钮文字(右) | text | 585 | 392 | — | — | — | "🏠 返回首页", 15px bold |
| 本局用时 | text | 710 | 510 | — | — | — | 10px, `#888888` |

### 11.4 得分计算公式 (代码级别)

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

**得分细项:**
1. 基础底分 (★) : `+baseScore` (地主30/农民20), color `#C8E6C9`
2. 炸弹翻倍 (🧨): `×multiplier (bombMult个)`, color `#FFD54F`
3. 搞事情得分 (🔥): `+chaosBonus`, color `#FFAB91`
4. 手牌奖励 (🃏): `+handBonus`, color `#A5D6A7`

### 11.5 动画时间线

| Time (ms) | 动作 | 属性变化 | 缓动 |
|:---------:|------|:--------:|:----:|
| 0 | 遮罩淡入 | alpha 0→0.65 | Linear, 300ms |
| 300 | 结算卡片淡入 | alpha 0→1 | Linear, 300ms |
| 300 | 得分面板淡入 | alpha 0→1 | Linear, 300ms |
| 400 | 标题弹入 | scale 0.3→1.0, alpha 0→1 | Back.easeOut, 400ms |
| 400 | AI副标题淡入 | alpha 0→1 | Linear, 300ms |
| 700 | 总得分标题淡入 | alpha 0→1 | Linear, 200ms |
| 700 | 总得分数字淡入 | alpha 0→1 | Linear, 300ms |
| 700 | 分隔线1淡入 | alpha 0→1 | Linear, 200ms |
| 900+n×150 | 各细项逐行淡入 (4行) | alpha 0→1 | Linear, 200ms/行 |
| 1500 | 分隔线2淡入 | alpha 0→1 | Linear, 200ms |
| 1600 | 用时文字淡入 | alpha 0→1 | Linear, 200ms |
| 1800 | 两个按钮同时淡入 | alpha 0→1 | Linear, 200ms |

**总动画时长:** 约 2.0 秒

---

## 12. Toast 通知

### 12.1 实现

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

| 属性 | 值 |
|:----:|:---:|
| 背景位置 | (200, 206) |
| 背景尺寸 | 200 × 38 |
| 背景圆角 | 10px |
| 背景填色 | `#000000`, alpha 0.7 |
| 文字位置 | (300, 225), origin(0.5) |
| 文字大小 | 13px |
| 文字颜色 | `#FFFFFF` |
| depth (背景) | 200 |
| depth (文字) | 201 |
| 自动消失 | **1200ms** 后 destroy |

### 12.2 Toast 触发场景

| 场景 | 消息 |
|:----:|------|
| 手牌不足选中 | "请先选择手牌" |
| 非法牌型 | "非法牌型组合" |
| 不能压过 | "不能压过上家的牌" |
| 不是出牌阶段 | "现在不是你的出牌阶段" |
| 自由出牌跳过 | "自由出牌阶段不能跳过" |
| 不出 (确认) | "不出" |
| 提示无可用牌 | "没有能出的牌" |
| 重新发牌 | "重新发牌..." |

---

## 13. 搞事情模式 UI

详细的搞事情UI坐标在 `ChaoShiQing-detailed.md` 中，本章仅摘要布局相关参数。

### 13.1 遮罩与卡片 (createChaosOverlay)

| 元素 | X | Y | W | H | 颜色 | 圆角 | depth |
|:----:|:-:|:-:|:-:|:-:|:----:|:----:|:-----:|
| 遮罩 | 0 | 0 | 960 | 600 | 黑 0.75 | — | 300 |
| 白色卡片 | 150 | 55 | 660 | 320 | 白 | 12 | 301 |
| 阴影层 | 154 | 58 | 660 | 320 | 黑 0.08 | 12 | 301 |
| 标题 | 480 | 77 | — | — | `#FF6B35`, 19px bold | — | 302 |
| 分数 | 660 | 77 | — | — | `#333333`, 12px | — | 302 |
| 关闭按钮 | 720 | 72 | 20 | 28 | `#E53935`, 圆角10 | 10 | 302 |
| 关闭文字 | 734 | 83 | — | — | `#FFFFFF`, 15px | — | 303 |

### 13.2 题型选择卡片

| 卡片 | X | Y | W | H | 圆角 | depth |
|:----:|:-:|:-:|:-:|:-:|:----:|:-----:|
| 所有卡片 | 220/500 | 107/181 | 260 | 88 | 10 | 302 |
| 图标 | cx+12 | cy+12 | — | — | — | 303 |
| 标签 | cx+58 | cy+14 | — | — | — | 303 |
| 描述 | cx+58 | cy+40 | — | — | — | 303 |

**默认态:** fill `#F0F4FF`, border 1.5px `#CCD8FF`  
**Hover态:** fill `#E0EAFF`, border 2px `#7C4DFF`

### 13.3 答题选项

| 选项 | X | Y | W | H | 圆角 | depth |
|:----:|:-:|:-:|:-:|:-:|:----:|:-----:|
| A | 175 | 155 | 290 | 64 | 8 | 302 |
| B | 480 | 155 | 290 | 64 | 8 | 302 |
| C | 175 | 230 | 290 | 64 | 8 | 302 |
| D | 480 | 230 | 290 | 64 | 8 | 302 |

选项内容使用 wordWrap width=235, lineSpacing=1

### 13.4 换牌界面

| 遮罩 | depth 350, 黑0.6 |
|:-----|:-----------------|
| 标题 | (480, 90), 18px `#FFD700` |
| 确认按钮 | (290, 310, 200×44) `#4ECDC4` |
| 取消按钮 | (290, 360, 200×44) `#78909C` |
| 飞牌动画 | duration 600ms, ease `Cubic.easeOut`, 旋转720° |

---

## 14. 全屏与自适应

### 14.1 全屏切换

| 操作 | 函数 |
|:----:|:----:|
| 进入全屏 | `el.requestFullscreen()` 或 `el.webkitRequestFullscreen()` |
| 退出全屏 | `document.exitFullscreen()` 或 `document.webkitExitFullscreen()` |
| 缩放自适应 | `zoomCanvasToFill()` |

### 14.2 缩放模式对照

| 状态 | scale.mode | 容器尺寸 | 效果 |
|:----:|:----------:|:---------|------|
| 非全屏 | FIT | 自适应 | 等比缩放，保留完整画面。高度撑满时两侧可能有绿边 |
| 全屏 | FILL | 固定撑满 (`fixed` + `top:0 left:0`) | 填满全屏，允许左右裁剪，不裁顶部/底部按钮区域 |

### 14.3 首次点击全屏

- 触发条件：`self.input.once('pointerdown', ...)`
- 仅触发一次（`autoFSdone` 守卫）
- 用户拒绝时 `.catch(function(){})` 静默处理
- 不阻塞游戏流程

### 14.4 画布约束

因为是 Phaser Scale.FIT + CENTER_BOTH，设计分辨率 960×600 在所有宽高比下都能完整显示，但在超宽屏（>16:9）时两侧会有深绿色背景填充区。

---

## 15. 色彩系统

### 15.1 主题色

| 名称 | HEX | 用途 | 代码参考 |
|:----:|:----:|------|:--------:|
| 深绿背景 | `#1B5E20` | 画布底色 (主色调) | `backgroundColor`, `fillGradientStyle` |
| 深绿暗端 | `#0D3B0F` | 渐变底部 | `fillGradientStyle` |
| 中绿 | `#2E7D32` | 外层光晕 | `fillStyle(0x2E7D32, 0.15)` |
| 浅绿 | `#388E3C` | 内层光晕 | `fillStyle(0x388E3C, 0.1)` |
| 绿色描边 | `#4CAF50` | 外边框、装饰圆 | `strokeRoundedRect`, `strokeCircle` |
| 亮绿描边 | `#66BB6A` | 装饰矩形、中心圆、分隔线 | 多处使用 |

### 15.2 文字色

| 名称 | HEX | 用途 | Alpha/备注 |
|:----:|:----:|------|:----------:|
| 亮绿文字 | `#E8F5E9` | 回合指示、AI名称 | — |
| 浅灰绿文字 | `#A5D6A7` | AI牌数、状态文字、强度提示、手牌标签、出牌标签 | — |
| 淡绿文字 | `#66BB6A` | 底牌提示 "底牌: ? ? ?" | 0.4 |
| 中绿文字 | `#81C784` | 出牌记录标题 | — |
| 浅绿记录 | `#C8E6C9` | 出牌记录内容 | — |
| 白色 | `#FFFFFF` | 按钮文字、Toast、叫分按钮文字 | — |
| 深色 | `#333333` | 搞事情分数、题目选项文字 | — |

### 15.3 AI 角色色

| 角色 | aiId | HEX | 用途 |
|:----:|:----:|:----:|------|
| 王怼怼 | `duidui` | `#4FC3F7` (浅蓝) | 头像底色 40×40 |
| 苏甜甜 | `tiantian` | `#FFB74D` (橙色) | 头像底色 40×40 |

### 15.4 按钮色 (完整列表)

| 按钮 | HEX | 场景 |
|:----:|:----:|:----:|
| 出牌 | `#4ECDC4` (青绿) | 功能按钮、叫分"1分"、结算"再来一局"、换牌确认 |
| 提示 | `#FFD93D` (黄) | 功能按钮、叫分"2分" |
| 不出 | `#FF6B6B` (红) | 功能按钮、叫分"不叫" |
| 搞事情 | `#7C4DFF` (紫) | 功能按钮、题型Hover边框 |
| 底牌查看 | `#78909C` (灰蓝) | 功能按钮、换牌取消、结算"返回" |
| 叫分"3分" | `#FF6B35` (橙) | 叫分阶段 |

### 15.5 结算面板色

| 元素 | HEX |
|:----:|:----:|
| 卡片底色 | `#1A1A2E` (深蓝黑) |
| 赢家边框+标题 | `#FFD700` (金) |
| 输家边框+标题 | `#FF5252` (红) |
| 总得分 | `#FFD700` (金) + shadow blur 15 |
| 卡片填色 | `0x1A1A2E`, alpha 0.92 |

### 15.6 搞事情色

| 元素 | HEX |
|:----:|:----:|
| 遮罩 | `#000000`, alpha 0.75 |
| 白色卡片 | `#FFFFFF` |
| 标题 | `#FF6B35` (橙) |
| 题型卡片默认 | `#F0F4FF` + border `#CCD8FF` |
| 题型卡片hover | `#E0EAFF` + border `#7C4DFF` |
| 选项默认 | `#F5F5F5` + border `#CCCCCC` |
| 选项标记 | `#4ECDC4` (青绿圆圈) |
| 答对反馈 | `#4CAF50` (绿) |
| 答错反馈 | `#E53935` (红) |
| 超时反馈 | `#FF5252` (红) |
| 换牌确认 | `#4ECDC4` |
| 换牌取消 | `#78909C` |

### 15.7 AI 气泡色

| 元素 | 王怼怼 | 苏甜甜 |
|:----:|:------:|:------:|
| 头像底色 | `#4FC3F7` | `#FFB74D` |
| 气泡背景 (出牌) | `#1B5E20` 0.85 | `#311B92` 0.85 |
| 气泡边框 (出牌) | `#66BB6A` 0.5 | `#CE93D8` 0.5 |
| 气泡圆角 | 12px | 4px |
| 气泡背景 (搞事情) | `#1B5E20` 0.85 | `#1B5E20` 0.85 |
| 气泡边框 (搞事情) | `#66BB6A` 0.5 | `#66BB6A` 0.5 |

---

## 16. 字体规范

### 16.1 字体族

```javascript
fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif'
```

所有文本统一使用以上字体族。仅表情符号使用 `fontFamily: 'sans-serif'`。

### 16.2 字号全表

| 字号 (px) | lineSpacing | 使用场景 |
|:---------:|:-----------:|----------|
| **8** | — | 底牌提示文字 (初始及 showBottomCards) |
| **9** | 3 | 出牌记录标题 + 内容 |
| **10** | — | AI名称、AI牌数、状态文本、强度提示、出牌标签 (4处) |
| **11** | — | "你的手牌" 标签 |
| **12** | — | 回合指示器、AI气泡名称、搞事情分数、选项标记字母 |
| **13** | — | 功能按钮文字、Toast文字、结算细项行、题型标签、选项文字 |
| **14** | 4(题目) | 叫分按钮文字、搞事情气泡台词、题目文字、选项文字(wordWrap) |
| **15** | — | 叫分提示、结算按钮文字、换牌按钮文字 |
| **18** | — | 头像表情 (😎/😊) |
| **19** | — | 搞事情标题 |
| **20** | — | 反馈结果 (答对/答错) |
| **22** | — | 全屏按钮 (⛶) |
| **26** | — | 题型卡片图标 |
| **28** | — | 结算主标题 |
| **36** | — | 结算总得分数字 |

### 16.3 字重规范

| 字重 | 使用场景 |
|:----:|----------|
| **bold** | 按钮、标题、回合指示、AI名称、状态文字、提示文字、搞事情标题、反馈结果、结算得分、确认/取消按钮 |
| normal | AI牌数、出牌标签、底牌提示、出牌记录、强度提示、选项文字、Toast |

### 16.4 文字阴影

仅结算主标题和总得分数字使用 shadow:
```javascript
// 结算标题
shadow: { blur: 20, color: titleColor, fill: true }
// 总得分数字
shadow: { blur: 15, color: '#FFD700', fill: true }
```

---

## 17. Z轴深度层级

### 17.1 完整深度表

| Depth Range | 内容 | 分组名 |
|:-----------:|------|:------:|
| **10** | 状态栏背景、出牌区背景、手牌区背景 | 主背景 |
| **11** | 状态栏文字、出牌标签、手牌标签、底牌初始文字、分隔线 | 主文字 |
| **12-13** | AI头像图片 | AI元素 |
| **20** | AI气泡头像、气泡背景、气泡三角、底牌文字(showBottomCards) | 气泡/底牌 |
| **21** | AI气泡文字、出牌图片 (AI+玩家) | 气泡文字/出牌 |
| **100** | 功能按钮背景 (5个) | 按钮 |
| **101** | 功能按钮文字 | 按钮文字 |
| **110** | 手牌图片 (所有玩家手牌) | 手牌 |
| **111** | 手牌选中标记 (通过调整image本身Y实现，无额外元素) | — |
| **200** | 叫分按钮背景、叫分提示文字、强度提示、出牌记录面板、全屏按钮、Toast背景 | 弹层/上层UI |
| **201** | 叫分按钮文字、出牌记录内容、Toast文字 | 上层文字 |
| **300** | 搞事情遮罩 | 搞事情弹层 |
| **301** | 搞事情白色卡片+阴影 | 搞事情卡片 |
| **302** | 搞事情标题、标签、类型卡片、选项背景、气泡背景、关闭按钮 | 搞事情内容 |
| **303** | 搞事情图标文字、气泡文字、选项文字 | 搞事情文字 |
| **304** | 搞事情选项标记文字 | 搞事情选项 |
| **305** | 搞事情反馈图标、换牌按钮 ("再来一题"/"关掉回牌") | 搞事情按钮 |
| **306** | 搞事情按钮文字 | 搞事情按钮文字 |
| **310** | 搞事情换牌结果文字 (🔄 / 😅 / 😈) | 换牌反馈文字 |
| **350** | 搞事情换牌遮罩 | 换牌遮罩 |
| **351** | 换牌标题、标签文字 | 换牌UI |
| **352** | 换牌卡片 (玩家+AI) | 换牌卡片 |
| **353** | 换牌按钮背景 | 换牌按钮 |
| **354** | 换牌按钮文字 | 换牌按钮文字 |
| **355** | 换牌选中卡片 | 换牌选中态 |
| **400** | 结算遮罩 | 结算弹层 |
| **401** | 结算卡片背景 | 结算卡片 |
| **402** | 结算标题、得分面板背景、分隔线 | 结算内容 |
| **403** | 结算得分细项、总分数字、按钮背景、用时文字 | 结算文字+按钮 |
| **404** | 结算按钮文字 | 结算按钮文字 |

### 17.2 深度分配原则

| 原则 | 说明 |
|:----|------|
| 1. 后创建在高处 | 非特殊情况，后创建的元素z值更高 |
| 2. 弹层额外加100 | 遮罩+数层(300,350,400) |
| 3. 同一层bg+10=文字 | 背景和文字保持+1的差值 |
| 4. 手牌高于按钮 | 手牌110 > 按钮100/101 |
| 5. 搞事情高于出牌 | 搞事情300+ > 出牌区10-20 |

---

## 18. 动画与过渡参数

### 18.1 动画参数全表

| 场景 | 属性 | duration | ease | 延迟 | 备注 |
|:----:|:----:|:--------:|:----:|:----:|------|
| 结算遮罩 | alpha 0→0.65 | 300ms | Linear | 0ms | tween |
| 结算卡片 | alpha 0→1 | 300ms | Linear | 300ms | tween |
| 得分面板 | alpha 0→1 | 300ms | Linear | 300ms | tween |
| 结算标题 | scale 0.3→1.0, alpha 0→1 | 400ms | Back.easeOut | 400ms | tween |
| AI副标题 | alpha 0→1 | 300ms | Linear | 400ms | tween |
| 总得分标题 | alpha 0→1 | 200ms | Linear | 700ms | tween |
| 总得分数字 | alpha 0→1 | 300ms | Linear | 700ms | tween |
| 分隔线1 | alpha 0→1 | 200ms | Linear | 700ms | tween |
| 各细项逐行 | alpha 0→1 | 200ms | Linear | 900+n×150ms | tween |
| 分隔线2 | alpha 0→1 | 200ms | Linear | 1500ms | tween |
| 用时文字 | alpha 0→1 | 200ms | Linear | 1600ms | tween |
| 按钮淡入 | alpha 0→1 | 200ms | Linear | 1800ms | tween |
| 手牌选中 | y -= 16 | 即时 | — | — | 无动画 |
| Toast | — | — | — | 1200ms后destroy | 无动画 |
| AI思考延迟 | — | — | — | 1200ms | setTimeout |
| AI出牌间隔 | — | — | — | 600~1200ms | setTimeout |
| 发牌延迟 | — | — | — | 1500ms | setTimeout |
| 搞事情换牌动画 | x/scale/angle 变化 | 600ms | Cubic.easeOut | — | 旋转720° |
| 答错换牌 | x/scale/angle 变化 | 700ms | Back.easeIn | 600ms前提 | 缩小至0.4, 旋转10° |
| AI气泡 (出牌) | — | — | — | 4000/5000ms后destroy | 无动画 |
| AI气泡 (搞事情) | — | — | — | 3500ms后destroy | 无动画 |

### 18.2 时序图 (结算面板)

```
 0ms   300ms   400ms         700ms   900ms     1500ms 1600ms 1800ms
  │      │       │             │       │          │     │     │
  ├──────┤       │             │       │          │     │     │  遮罩淡入
         ├───────┤             │       │          │     │     │  卡片+面板淡入
                 ├─────────────┤       │          │     │     │  标题弹入 (Back)
                               ├───────┤          │     │     │  得分+分隔线1
                                       ├────┬────┤     │     │  细项逐行(间隔150ms)
                                              ├─────┤     │     │  分隔线2
                                                     ├────┤     │  用时文字
                                                          ├────┤  按钮淡入
```

---

## 19. 交互区域全表

### 19.1 可交互元素 (mouse/pointer)

| 区域 | 点击范围 (X,Y,W,H) | 交互类型 | 绑定函数 | depth |
|:----|:-------------------|:--------:|:---------|:-----:|
| 全屏按钮 | (center 940,24) | pointerdown | 全屏切换 | 200 |
| 手牌 (单张) | (动态, 56×80) | pointerdown | 选中/取消 | 110 |
| 出牌按钮 | (272,442,72,48) | pointerup | `doPlayerPlay()` | 100 |
| 提示按钮 | (358,442,72,48) | pointerup | `doHint()` | 100 |
| 不出按钮 | (444,442,72,48) | pointerup | `doPlayerPass()` | 100 |
| 搞事情按钮 | (530,442,72,48) | pointerup | `doAction()` | 100 |
| 底牌查看按钮 | (616,442,72,48) | pointerup | `showBottomCards()` | 100 |
| 叫分"不叫" | (270,280,96,52) | pointerup | `handlePlayerBid(0)` | 200 |
| 叫分"1分" | (378,280,96,52) | pointerup | `handlePlayerBid(1)` | 200 |
| 叫分"2分" | (486,280,96,52) | pointerup | `handlePlayerBid(2)` | 200 |
| 叫分"3分" | (594,280,96,52) | pointerup | `handlePlayerBid(3)` | 200 |
| 结算"再来一局" | (290,370,170,44) | pointerup | `scene.restart()` | 403 |
| 结算"返回首页" | (500,370,170,44) | pointerup | `window.location.reload()` | 403 |
| 搞事情关闭 | (720,72,20,20) | pointerup | `_destroyChaos()` | 302 |
| 题型卡片(4张) | (220/500, 107/181, 260, 88) | pointerover/out/down | 题型选择+出题 | 302 |
| 答题选项(4个) | (175/480, 155/230, 290, 64) | pointerdown | 答题 | 302 |
| 换牌确认 | (290,310,200,44) | pointerup | 确认交换 | 353 |
| 换牌取消 | (290,360,200,44) | pointerup | 跳过交换 | 353 |
| 再来一题 | (220, btnY, 220, 40) | pointerup | 重新出题 | 305 |
| 关掉回牌 | (510, btnY, 220, 40) | pointerup | 关闭chaos | 305 |

### 19.2 手牌交互命中框

每张牌的交互区域为整张牌面 (56×80)，使用 Phaser.Geom.Rectangle.Contains 检测。手牌重叠量为33px，后方的牌被前方的牌遮挡部分不可直接点击。

### 19.3 叫分按钮精确坐标

```javascript
var bw = 96, bh = 52, gap = 12;
var totalW = 96 * 4 + 12 * 3 = 420;
var startX = (960 - 420) / 2 = 270;
```

| 按钮 | X | Y |
|:----:|:-:|:-:|
| 不叫 | 270 | 280 |
| 1分 | 378 | 280 |
| 2分 | 486 | 280 |
| 3分 | 594 | 280 |

---

## 20. 与旧文档的差异说明

### 20.1 代码与旧 Layout.md 的不一致

| # | 旧 Layout.md | 代码实际值 | 影响 |
|:-:|:-------------|:-----------|:-----|
| 1 | 头像图片 36×36 | `setDisplaySize(34, 34)` | 头像显示比预期小2px |
| 2 | 状态文字 Y=9 | `add.text(480, 8, ...)` Y=8 | 状态文字上移1px |
| 3 | 初始底牌 X=480 | `add.text(460, 60, ...)` X=460, Y=60 | 底牌初始位置偏左20px |
| 4 | showBottomCards Y=72 | `add.text(480, 72, ...)` 带 origin(0.5) | 底牌文字居中而非左对齐 |
| 5 | AI1 名称 X=176 | `add.text(200, 9, ...)` X=200 | 名称在头像右侧24px |
| 6 | AI2 名称 X=788 | `add.text(720, 9, ...)` X=720 | 名称在头像左侧68px |
| 7 | overlay depth 400 | 代码中 depth 400 是结算遮罩 | 搞事情遮罩 depth=300 |
| 8 | 结算面板动画(旧版描述) | 详见本版11.5节 | 逐行动画有明确 delay 公式 |
| 9 | Toast 说明 X=200 | `cx - 100 = 200`, `cx = 300` | Toast 背景200, 文字在300居中 |
| 10 | 全屏按钮描述 | 代码中在 create() 内创建 | 不是独立函数 |
| 11 | B38: 底牌显示 | 底牌直接融入地主手牌, 不再展示牌面 | 设计变更 |
| 12 | 搞事情选项高度 | 代码使用 64px | 旧文档未指定 |

### 20.2 版本间设计变更

| 版本 | 变更内容 |
|:----:|----------|
| B34 | 题型选择时隐藏主标题，选完后恢复 |
| B38 | 底牌不再单独显示，直接融入地主手牌 |
| B40 | 全屏按钮样式: backgroundColor `#00000066`, padding 8×6 |

---

## 21. 验收标准

### 21.1 基础布局

| # | 验收条件 | 来源 |
|:-:|----------|:----:|
| L1 | 画布 960×600, 背景 `#1B5E20` 渐变为 `#0D3B0F` | game.js |
| L2 | 顶部状态栏高56px, 半透明黑底(0.3) | createTopBar |
| L3 | 状态栏底部有1px `#66BB6A` (0.2) 分隔线 | createTopBar |
| L4 | 状态文字居中 (480,8), 10px, `#A5D6A7` | createTopBar |
| L5 | 回合指示在左上 (12,9), 12px, `#E8F5E9` | createTopBar |

### 21.2 头像

| # | 验收条件 | 来源 |
|:-:|----------|:----:|
| A1 | 王怼怼头像在 (176,20), 底色 `#4FC3F7`, 外框 56×56 | makeAvatarImage |
| A2 | 苏甜甜头像在 (788,20), 底色 `#FFB74D`, 外框 56×56 | makeAvatarImage |
| A3 | 头像图片尺寸 34×34 | setDisplaySize |
| A4 | 名称: 王怼怼 (200,9), 苏甜甜 (720,9), 10px bold | createTopBar |
| A5 | 牌数: (200,22)/(720,22), 10px, `#A5D6A7` | createTopBar |

### 21.3 出牌区

| # | 验收条件 | 来源 |
|:-:|----------|:----:|
| P1 | 出牌区背景 (160,59) w=640 h=206, 黑0.1, 圆角10px | createPlayArea |
| P2 | 出牌区标签 "出牌区" 在 (480,218), 10px, `#66BB6A` 0.4 | createPlayArea |
| P3 | AI1 出牌中心 (280,133), 牌42×60 | displayPlay |
| P4 | AI2 出牌中心 (680,133), 牌42×60 | displayPlay |
| P5 | 玩家出牌中心 (360,195), 牌50×72 | displayPlay |

### 21.4 手牌区

| # | 验收条件 | 来源 |
|:-:|----------|:----:|
| H1 | 手牌区背景 (20,300) w=920 h=115, 黑0.15, 圆角10px | createHandArea |
| H2 | 标签 "你的手牌" 在 (68,305), 11px, `#A5D6A7` | createHandArea |
| H3 | 牌宽56px, 高80px, depth 110 | renderPlayerHand |
| H4 | 选中牌上移16px, 取消选中下移16px | renderPlayerHand |
| H5 | 弧线两端比中间高9px (Y: 336 vs 345) | renderPlayerHand |

### 21.5 功能按钮

| # | 验收条件 | 来源 |
|:-:|----------|:----:|
| B1 | 5个按钮水平居中, 总宽416, 起始X=272 | createActionButtons |
| B2 | 按钮72×48, 间距14px, 圆角8px, depth 100 | createActionButtons |
| B3 | 各按钮颜色正确 (出牌#4ECDC4, 提示#FFD93D, 不出#FF6B6B, 搞事情#7C4DFF, 底牌#78909C) | createActionButtons |
| B4 | 按钮文字13px bold, Y比中心高1px | createActionButtons |

### 21.6 叫分UI

| # | 验收条件 | 来源 |
|:-:|----------|:----:|
| R1 | 提示 "请叫分" 在 (480,170), 15px, 白色 | showBiddingUI |
| R2 | 4个叫分按钮在 Y=280, 96×52, 间距12px | showBiddingUI |
| R3 | 按钮颜色正确 (不叫=红,1分=青,2分=黄,3分=橙) | showBiddingUI |
| R4 | 强度提示在 (480,260), 10px, `#A5D6A7` | showBiddingUI |

### 21.7 结算面板

| # | 验收条件 | 来源 |
|:-:|----------|:----:|
| E1 | 遮罩淡入0.65, 300ms | renderRoundEndPanel |
| E2 | 结算卡片 (200,60) w=560 h=480, 圆角12px | renderRoundEndPanel |
| E3 | 标题弹入: scale 0.3→1.0, 400ms, Back.easeOut | renderRoundEndPanel |
| E4 | 得分面板 (240,142) w=480 h=260, 黑0.25, 圆角8px | renderRoundEndPanel |
| E5 | 总分数字36px bold, `#FFD700`, shadow blur 15 | renderRoundEndPanel |
| E6 | 4个细项行 Y=235~310, 间隔25px, 颜色依次`#C8E6C9`/`#FFD54F`/`#FFAB91`/`#A5D6A7` | renderRoundEndPanel |
| E7 | 按钮 (290/500,370) w=170 h=44, 圆角8px | renderRoundEndPanel |
| E8 | 动画序列正确: 遮罩→卡片→标题→得分→细项→分隔线→用时→按钮 | renderRoundEndPanel |

### 21.8 Toast/底牌/出牌记录

| # | 验收条件 | 来源 |
|:-:|----------|:----:|
| T1 | Toast 背景 (200,206) w=200 h=38, 黑0.7, 圆角10px, 1200ms 自动消失 | showToast |
| T2 | Toast 文字 (300,225), 13px, 白色 | showToast |
| Z1 | 初始底牌提示 "底牌: ? ? ?" 在 (460,60), 8px | createPlayArea |
| Z2 | showBottomCards 无牌时显示 "底牌: ? ? ?" 在 (480,72) | showBottomCards |
| Z3 | 有底牌时不做展示 (B38) | showBottomCards |
| - | 出牌记录面板 (800,60) w=150 h=140, 圆角6px | createPlayHistoryArea |

### 21.9 搞事情UI

| # | 验收条件 | 来源 |
|:-:|----------|:----:|
| C1 | 遮罩 (0,0,960,600) 黑0.75, depth 300 | _createChaosOverlay |
| C2 | 白色卡片 (150,55) w=660 h=320, 圆角12px, depth 301 | _createChaosOverlay |
| C3 | 标题 (480,77) 19px `#FF6B35` | _createChaosOverlay |
| C4 | 题型2×2网格: X=220/500, Y=107/181, 260×88 | _showTypeSelection |
| C5 | 选项2×2网格: X=175/480, Y=155/230, 290×64 | _renderQuestion |

### 21.10 全屏/自适应

| # | 验收条件 | 来源 |
|:-:|----------|:----:|
| F1 | 全屏按钮 (940,24), 22px, `#FFFFFF` | create() |
| F2 | 全屏时切换到 FILL 模式 | zoomCanvasToFill |
| F3 | 首次点击自动触发全屏请求 | create() input.once |
| F4 | 拒绝全屏后不重复请求 | .catch(function(){}) |

### 21.11 深度/Z轴

| # | 验收条件 | 来源 |
|:-:|----------|:----:|
| D1 | 背景元素 depth 10-11, 手牌110 在按钮100之上 | 对照深度表 |
| D2 | 搞事情遮罩 depth 300 > 按钮100 | 代码确认 |
| D3 | 结算遮罩 depth 400 > 搞事情 300 | 代码确认 |
| D4 | AI气泡 depth 20-21 < 手牌110 | 代码确认 |

---

## 附录: 关键函数索引

| 函数 | 行号 | 功能 | 布局相关 |
|------|:----:|------|:--------:|
| `drawTableBackground()` | ~321 | 绘制背景渐变+装饰 | 渐变、光晕、装饰圆 |
| `createTopBar()` | ~350 | 创建顶部状态栏 | 状态栏56px、AI信息 |
| `makeAvatarImage()` | ~262 | 创建AI头像 | 头像56×56外框 |
| `createPlayArea()` | ~375 | 创建出牌区 | 出牌区640×206 |
| `createHandArea()` | ~400 | 创建手牌区 | 手牌区920×115 |
| `renderPlayerHand()` | ~408 | 渲染手牌 | 56×80, 弧线, 选中偏移 |
| `createActionButtons()` | 2396 | 创建底部5按钮 | 72×48, 间距14, 居中 |
| `createPlayHistoryArea()` | 2697 | 创建出牌记录 | 150×140右上角 |
| `displayPlay()` | ~1000 | 出牌位置 | AI1(280,133), AI2(680,133), 玩家(360,195) |
| `showToast()` | 2444 | 通知提示 | 黑底200×38, 1200ms |
| `renderRoundEndPanel()` | 2463 | 结算面板 | 560×480, 动画序列 |
| `_createChaosOverlay()` | ~1500 | 搞事情遮罩 | 660×320白色卡片 |
| `zoomCanvasToFill()` | ~300 | 全屏缩放切换 | FIT→FILL切换 |
| `showBottomCards()` | ~985 | 底牌显示 | 直接融合(B38) |
