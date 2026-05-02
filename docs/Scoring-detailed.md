# 计分与回合系统 (Scoring) — 超详细设计文档

**版本:** v2.0  
**作者:** 产品经理  
**日期:** 2026-05-02  
**基准画布:** 960×600 横屏 (Phaser 3 Scale.FIT)  
**对应源码:** `src/client/js/game.js` (2897行)  

---

## 目录

1. [记分变量总表](#1-记分变量总表)
2. [计分公式](#2-计分公式)
3. [炸弹/火箭统计](#3-炸弹火箭统计)
4. [搞事情得分](#4-搞事情得分)
5. [手牌奖励](#5-手牌奖励)
6. [结算面板布局](#6-结算面板布局)
7. [动画序列](#7-动画序列)
8. [回合计数器](#8-回合计数器)
9. [胜负判定与 winner 参数](#9-胜负判定与-winner-参数)
10. [UI变化全记录](#10-ui变化全记录)
11. [与旧文档差异说明](#11-与旧文档差异说明)
12. [验收标准](#12-验收标准)

---

## 1. 记分变量总表

### 1.1 游戏场景属性

| 属性名 | 类型 | 初始值 | 初始化位置 | 用途 |
|:------|:----:|:------:|:-----------|:-----|
| `isLandlord` | boolean | `false` | finishBidding / localAssignLandlord | 玩家是否为地主 |
| `totalBombs` | number | 0 | init() | 全局限弹+火箭计数 |
| `chaosScore` | number | 0 | init() | 搞事情答对次数 |
| `gameStartTime` | number | `Date.now()` | init() | 本局开始时间戳 |
| `round` | number | 1 | init() | 当前回合数 |
| `maxRounds` | number | 10 | 构造函数 | 最大回合数 |
| `gameState` | string | `INIT` | init() | 游戏阶段控制 |
| `lastPlayPlayer` | string | null | init() | 最后出牌者 |

### 1.2 计分中间变量 (renderRoundEndPanel 内局部)

| 变量 | 计算方式 | 说明 |
|:----|:---------|:-----|
| `baseScore` | `isLandlord ? 30 : 20` | 基础底分 |
| `bombMult` | `totalBombs \|\| 0` | 炸弹数量 |
| `chaosBonus` | `chaosScore * 10` | 搞事情得分 |
| `remainingCards` | 对手剩余手牌之和 | 手牌奖励基数 |
| `handBonus` | `remainingCards * 2` | 手牌奖励 |
| `subTotal` | `baseScore + chaosBonus + handBonus` | 小计 |
| `multiplier` | `Math.pow(2, bombMult)` | 炸弹翻倍系数 |
| `totalScore` | `subTotal * multiplier` | 最终总分 |

---

## 2. 计分公式

### 2.1 完整公式 (代码)

```javascript
// renderRoundEndPanel 内 (line ~2525-2535)
var baseScore = self.isLandlord ? 30 : 20;
var bombMult = self.totalBombs || 0;
var chaosScore = self.chaosScore || 0;
var chaosBonus = chaosScore * 10;

// 手牌奖励
var remainingCards = 0;
if (isPlayerWin) {
  remainingCards = (self.ai1Hand ? self.ai1Hand.length : 0) +
                   (self.ai2Hand ? self.ai2Hand.length : 0);
} else if (isAI1Win) {
  remainingCards = (self.playerHand ? self.playerHand.length : 0) +
                   (self.ai2Hand ? self.ai2Hand.length : 0);
} else {
  remainingCards = (self.playerHand ? self.playerHand.length : 0) +
                   (self.ai1Hand ? self.ai1Hand.length : 0);
}
var handBonus = remainingCards * 2;

var subTotal = baseScore + chaosBonus + handBonus;
var multiplier = Math.pow(2, bombMult);
var totalScore = subTotal * multiplier;
```

**数学表达:**
```
subTotal = 基础底分 + (chaosScore × 10) + (对手剩余手牌 × 2)
totalScore = subTotal × 2^totalBombs
```

### 2.2 分项明细

#### 基础底分 (baseScore)

| 玩家身份 | `isLandlord` | 分数 |
|:--------:|:------------:|:----:|
| 地主 | `true` | **+30** |
| 农民 | `false` | **+20** |

#### 炸弹翻倍 (multiplier)

```javascript
var multiplier = Math.pow(2, bombMult);
// 当前代码: 火箭也按 ×2 计算，不单独区分
// ⚠️ 火箭和炸弹统一按 bombMult 计数
```

| 炸弹数 | multiplier | 文字显示 |
|:------:|:----------:|:---------|
| 0 | ×1 | `×1 (0个)` |
| 1 | ×2 | `×2 (1个)` |
| 2 | ×4 | `×4 (2个)` |
| 3 | ×8 | `×8 (3个)` |
| 4 | ×16 | `×16 (4个)` |

#### 搞事情得分 (chaosBonus)

```javascript
var chaosScore = self.chaosScore || 0;
var chaosBonus = chaosScore * 10;
```

| 答对题数 | chaosBonus |
|:--------:|:----------:|
| 0 | 0 |
| 1 | +10 |
| 3 | +30 |
| 5 | +50 |

#### 手牌奖励 (handBonus)

| 对手剩余手牌数 | handBonus |
|:--------------:|:----------:|
| 0 **⚠️ 不可能** | 0 |
| 1~4 | +2 ~ +8 |
| 17 (农民全没出) | +34 |
| 34 (两家全没出) | **+68** (最大) |

### 2.3 计算示例

**场景1: 地主玩家赢了，答对3题，2个炸弹，AI1剩5张，AI2剩3张**
```
基础底分:     +30  (地主)
搞事情:       +30  (3×10)
手牌奖励:     +16  ((5+3)×2)
────────────────────────
subTotal:     +76
炸弹翻倍:     ×4   (2²)
────────────────────────
totalScore:   +304
```

**场景2: 农民玩家赢了，答对0题，0炸弹，AI剩8+12=20张**
```
基础底分:     +20  (农民)
搞事情:       +0   (0题)
手牌奖励:     +40  (20×2)
────────────────────────
subTotal:     +60
炸弹翻倍:     ×1   (0个)
────────────────────────
totalScore:   +60
```

**场景3: 玩家输了 (AI2赢得)，1个炸弹**
```
玩家输时:
  baseScore = self.isLandlord ? 30 : 20
  // 仍然计算但显示为 AI 得分
```

---

## 3. 炸弹/火箭统计

### 3.1 totalBombs 递增位置 (3处)

```javascript
// 1. confirmPlay (玩家出牌) — line 1011
if (info.type === 'BOMB' || info.type === 'ROCKET') this.totalBombs++;

// 2. handleAIPlay (API AI出牌) — line 1210
if (info.type === 'BOMB' || info.type === 'ROCKET') this.totalBombs++;

// 3. localAIPlay (本地AI出牌) — line 1285
if (info.type === 'BOMB' || info.type === 'ROCKET') this.totalBombs++;
```

**统计范围:** 本局中**所有玩家**(玩家+AI1+AI2)打出的炸弹和火箭总和。

### 3.2 火箭 vs 炸弹

| 牌型 | 识别 | 代码处理 |
|:----|:-----|:---------|
| 炸弹 | 4张同 rank | `info.type === 'BOMB'` → `totalBombs++` |
| 火箭 | 小王+大王 | `info.type === 'ROCKET'` → `totalBombs++` |

**⚠️ 代码 bug:** 当前代码将火箭和炸弹统一 `totalBombs++`，最终乘以 `Math.pow(2, bombMult)`。火箭也应该按 ×4 计算。需要引入 `rocketCount` 单独统计火箭。

### 3.3 炸弹翻倍文字显示

```javascript
'×' + multiplier + ' (' + bombMult + '个)'
// 示例: "×8 (3个)"
// 即使 bombMult=0 也显示 "×1 (0个)"
```

---

## 4. 搞事情得分

### 4.1 得分生命周期

```javascript
// init() — 重置
this.chaosScore = 0;

// doAction() — 搞事情入口，确保非null
this.chaosScore = this.chaosScore || 0;

// _handleOptionClick 答对时递增 — line ~1640
self.chaosScore = (self.chaosScore || 0) + 1;

// renderRoundEndPanel 读取
var chaosScore = self.chaosScore || 0;
var chaosBonus = chaosScore * 10;
```

### 4.2 零值处理

```javascript
// 搞事情得分为0时显示为 "0" 而非隐藏整行
if (chaosBonus === 0) {
  detailRows[2].value = '0';
}
// 手牌奖励为0时同样
if (handBonus === 0) {
  detailRows[3].value = '0';
}
```

**显示效果:**
| chaosBonus | 显示 |
|:----------:|:-----|
| +50 | `搞事情得分 +50  🔥` |
| 0 | `搞事情得分 0  🔥` |

---

## 5. 手牌奖励

### 5.1 对手手牌计算

**玩家赢时:**
```javascript
remainingCards = ai1Hand.length + ai2Hand.length;
```

**AI1赢时:**
```javascript
remainingCards = playerHand.length + ai2Hand.length;
```

**AI2赢时:**
```javascript
remainingCards = playerHand.length + ai1Hand.length;
```

**始终取 ?.length 且 ? 为 null 时视为 0**

### 5.2 公式

```javascript
var handBonus = remainingCards * 2;
```

**最大值:** 34张 (两家全没出) × 2 = **+68**

### 5.3 零值处理

```javascript
if (handBonus === 0) {
  detailRows[3].value = '0';
}
```

---

## 6. 结算面板布局

### 6.1 整体区域

```
结算卡片: X=200, Y=60, W=560, H=480  (200+560=760, 60+480=540)
depths: 遮罩400, 卡片401, 内容402, 文字按钮403, 按钮文字404
```

### 6.2 精确坐标全表

```
┌────────────────────────────────────────────────────────────────┐
│ (0,0)                                                   960×600│
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← 遮罩 depth=400
│ ▓                                                            ▓ │     fill 0x000000 alpha 0.65
│ ▓   ╔══════════════════════════════════════════════════════╗  ▓ │  ← 结算卡片 depth=401
│ ▓   ║    (200,60) w=560 h=480  圆角12px                    ║  ▓ │     fill 0x1A1A2E 0.92
│ ▓   ║    边框: 赢 #FFD700 / 输 #FF5252  lineWidth=2 0.8    ║  ▓ │
│ ▓   ║                                                    ║  ▓ │
│ ▓   ║  ┌──────────────────────────────────────────────┐  ║  ▓ │
│ ▓   ║  │  🎉 你赢了！        (480,90) 28px bold       │  ║  ▓ │  ← 标题 depth=402
│ ▓   ║  │  shadow blur=20 color=#FFD700 fill=true      │  ║  ▓ │
│ ▓   ║  └──────────────────────────────────────────────┘  ║  ▓ │
│ ▓   ║                                                    ║  ▓ │
│ ▓   ║  ┌────────────────────────────────────────────┐   ║  ▓ │  ← 得分面板 depth=402
│ ▓   ║  │  (240,142) w=480 h=260 圆角8px             │   ║  ▓ │     fill 0x000000 0.25
│ ▓   ║  │  黑0.25                                     │   ║  ▓ │
│ ▓   ║  │                                            │   ║  ▓ │
│ ▓   ║  │    💰 总得分              (480,155) 14px    │   ║  ▓ │  ← depth=403
│ ▓   ║  │    +800                   (480,190) 36px    │   ║  ▓ │     bold, #FFD700
│ ▓   ║  │    ────────────────────── (260,215~700)     │   ║  ▓ │     line 1px white 0.1
│ ▓   ║  │                                             │   ║  ▓ │
│ ▓   ║  │  基础底分   +30  ★     (270,235) 13px      │   ║  ▓ │  ← 4行
│ ▓   ║  │  炸弹翻倍   ×8         (270,260) 13px      │   ║  ▓ │     间隔25px
│ ▓   ║  │  搞事情得分 +50  🔥    (270,285) 13px      │   ║  ▓ │
│ ▓   ║  │  手牌奖励   +20  🃏    (270,310) 13px      │   ║  ▓ │
│ ▓   ║  │    ────────────────────── (260,335~700)     │   ║  ▓ │     分隔线2
│ ▓   ║  └────────────────────────────────────────────┘   ║  ▓ │
│ ▓   ║                                                    ║  ▓ │
│ ▓   ║   ┌──────────────┐   ┌──────────────┐             ║  ▓ │  ← 按钮 depth=403/404
│ ▓   ║   │ 🔄 再来一局  │   │ 🏠 返回首页  │             ║  ▓ │
│ ▓   ║   │  (290,370)   │   │ (500,370)    │             ║  ▓ │
│ ▓   ║   │  170×44      │   │ 170×44       │             ║  ▓ │
│ ▓   ║   └──────────────┘   └──────────────┘             ║  ▓ │
│ ▓   ║                                                    ║  ▓ │
│ ▓   ║        本局用时: 3分28秒  (710,510) 10px          ║  ▓ │  ← depth=403
│ ▓   ╚══════════════════════════════════════════════════════╝  ▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└────────────────────────────────────────────────────────────────┘
```

### 6.3 元素精确坐标

| 元素 | 变量 | X | Y | W | H | 圆角 | depth | 填色/样式 |
|:----|:----:|:-:|:-:|:-:|:-:|:----:|:-----:|:----------|
| 半透明遮罩 | overlay | 0 | 0 | 960 | 600 | — | 400 | fill 0x000000, alpha 0→0.65 |
| 结算卡片 | cardBg | 200 | 60 | 560 | 480 | 12 | 401 | fill 0x1A1A2E 0.92 |
| 卡片边框 | (同一graphics) | 200 | 60 | 560 | 480 | 12 | 401 | stroke, 赢0xFFD700/输0xFF5252, lineWidth 2, alpha 0.8 |
| 主标题 | title | 480 | 90 | — | — | — | 402 | text, 28px bold, 赢#FFD700/输#FF5252, shadow blur=20 |
| AI副标题 | aiWinSub | 480 | 120 | — | — | — | 402 | text, 16px, #FF5252, 仅AI赢时 |
| 得分面板 | scorePanel | 240 | 142 | 480 | 260 | 8 | 402 | fill 0x000000 0.25 |
| 总得分标签 | totalLabel | 480 | 155 | — | — | — | 403 | text, "💰 总得分", 14px, #A5D6A7 |
| 总得分数字 | totalNum | 480 | 190 | — | — | — | 403 | text, "+N", 36px bold, #FFD700, shadow blur=15 |
| 分隔线1 | div1 | 260→700 | 215 | — | — | — | 403 | line, 1px, 0xFFFFFF 0.1 |
| 得分行1 | rowText[0] | 270 | 235 | — | — | — | 403 | "基础底分 +30  ★", 13px, #C8E6C9 |
| 得分行2 | rowText[1] | 270 | 260 | — | — | — | 403 | "炸弹翻倍 ×4  🧨", 13px, #FFD54F |
| 得分行3 | rowText[2] | 270 | 285 | — | — | — | 403 | "搞事情得分 +50  🔥", 13px, #FFAB91 |
| 得分行4 | rowText[3] | 270 | 310 | — | — | — | 403 | "手牌奖励 +20  🃏", 13px, #A5D6A7 |
| 分隔线2 | div2 | 260→700 | 335 | — | — | — | 403 | line, 1px, 0xFFFFFF 0.1 |
| 再来一局按钮 | btn1Bg | 290 | 370 | 170 | 44 | 8 | 403 | fill 0x4ECDC4 |
| 再来一局文字 | btn1Txt | 375 | 392 | — | — | — | 404 | "🔄 再来一局", 15px bold, #FFFFFF |
| 返回首页按钮 | btn2Bg | 500 | 370 | 170 | 44 | 8 | 403 | fill 0x78909C |
| 返回首页文字 | btn2Txt | 585 | 392 | — | — | — | 404 | "🏠 返回首页", 15px bold, #FFFFFF |
| 本局用时 | timeTxt | 710 | 510 | — | — | — | 403 | "本局用时: X分Y秒", 10px, #888888 |

### 6.4 得分行颜色规范

| 行 | 标签 | 值颜色 | icon |
|:--|:----:|:------:|:----:|
| 基础底分 | `#C8E6C9` | `#C8E6C9` | ★ |
| 炸弹翻倍 | `#FFD54F` | `#FFD54F` | 🧨 |
| 搞事情得分 | `#FFAB91` | `#FFAB91` | 🔥 |
| 手牌奖励 | `#A5D6A7` | `#A5D6A7` | 🃏 |

### 6.5 按钮坐标计算

```javascript
// 再来一局: (290, 370) w=170 h=44
// 返回首页: (500, 370) w=170 h=44
// 间距: 500 - (290+170) = 40px
```

### 6.6 用时计算

```javascript
var elapsed = Math.floor((Date.now() - (self.gameStartTime || Date.now())) / 1000);
var min = Math.floor(elapsed / 60);
var sec = elapsed % 60;
var timeStr = '本局用时: ' + min + '分' + sec + '秒';
```

**用时格式:** `本局用时: 3分28秒`  
**位置:** (710, 510), 10px, `#888888`, depth 403

---

## 7. 动画序列

### 7.1 精确时间线

```javascript
// T=0: 遮罩淡入 0→0.65 (300ms)
self.tweens.add({ targets: overlay, alpha: 0.65, duration: 300, ease: 'Linear' });

// T=300: 卡片+得分面板淡入 (300ms)
self.time.delayedCall(300, function() {
  self.tweens.add({ targets: cardBg, alpha: 1, duration: 300 });
  self.tweens.add({ targets: scorePanel, alpha: 1, duration: 300 });
});

// T=400: 标题弹入 + AI副标题
self.time.delayedCall(400, function() {
  self.tweens.add({ targets: title, scale: 1.0, alpha: 1, duration: 400, ease: 'Back.easeOut' });
  if (aiWinSub) {
    self.tweens.add({ targets: aiWinSub, alpha: 1, duration: 300, ease: 'Linear' });
  }
});

// T=700: 总得分+分隔线1
self.time.delayedCall(700, function() {
  self.tweens.add({ targets: totalLabel, alpha: 1, duration: 200 });
  self.tweens.add({ targets: totalNum, alpha: 1, duration: 300 });
  self.tweens.add({ targets: div1, alpha: 1, duration: 200 });
});

// T=900+n×150: 得分细项逐行 (4行)
for (var rj = 0; rj < rowTexts.length; rj++) {
  (function(idx, txt) {
    self.time.delayedCall(900 + idx * 150, function() {
      self.tweens.add({ targets: txt, alpha: 1, duration: 200 });
    });
  })(rj, rowTexts[rj]);
}

// T=1500: 分隔线2
self.time.delayedCall(1500, function() {
  self.tweens.add({ targets: div2, alpha: 1, duration: 200 });
});

// T=1600: 用时文字
self.time.delayedCall(1600, function() {
  self.tweens.add({ targets: timeTxt, alpha: 1, duration: 200 });
});

// T=1800: 两个按钮同时淡入
self.time.delayedCall(1800, function() {
  self.tweens.add({ targets: btn1Bg, alpha: 1, duration: 200 });
  self.tweens.add({ targets: btn1Txt, alpha: 1, duration: 200 });
  self.tweens.add({ targets: btn2Bg, alpha: 1, duration: 200 });
  self.tweens.add({ targets: btn2Txt, alpha: 1, duration: 200 });
});
```

### 7.2 动画序列表

```
时间(ms)   要素               动画开始          动画结束        缓动
 ─────────────────────────────────────────────────────────────────
  0        遮罩               alpha 0→0.65     300ms         Linear
300        结算卡片           alpha 0→1        300ms (600)   Linear
300        得分面板           alpha 0→1        300ms (600)   Linear
400        标题               scale 0.3→1.0    400ms (800)   Back.easeOut
                                     alpha 0→1
400        AI副标题(如有)     alpha 0→1        300ms (700)   Linear
700        总得分标签         alpha 0→1        200ms (900)   Linear
700        总得分数字         alpha 0→1        300ms (1000)  Linear
700        分隔线1            alpha 0→1        200ms (900)   Linear
900        细项行1            alpha 0→1        200ms (1100)  Linear
1050       细项行2            alpha 0→1        200ms (1250)  Linear
1200       细项行3            alpha 0→1        200ms (1400)  Linear
1350       细项行4            alpha 0→1        200ms (1550)  Linear
1500       分隔线2            alpha 0→1        200ms (1700)  Linear
1600       用时文字           alpha 0→1        200ms (1800)  Linear
1800       按钮(2个同时)      alpha 0→1        200ms (2000)  Linear
 ─────────────────────────────────────────────────────────────────
2000       全部完成，玩家可交互
```

**总时长: 2.0 秒**

### 7.3 ⚠️ 与旧 Scoring.md 差异

| 旧文档 | 实际代码 | 差异说明 |
|:------|:---------|:---------|
| 总得分有数字跳动 (0→最终) | 直接显示最终值，仅alpha淡入 | 没有数字跳动动画 |
| 按钮有悬停效果 | 无悬停效果 | 纯静态 |
| 火箭 ×4 | 火箭也按×2计算 | 代码bug |

---

## 8. 回合计数器

### 8.1 实现现状

```javascript
// init() — line ~200
this.round = 1;          // 初始值
this.maxRounds = 10;     // 构造函数中设置

// createTopBar() — line ~360
scene.roundText = scene.add.text(12, 9, '第 1/10 回合', {
  fontSize: '12px', color: '#E8F5E9', fontStyle: 'bold'
}).setDepth(11);
```

**⚠️ 代码 bug:** 
- `roundText` 字符串是硬编码的 `'第 1/10 回合'`
- `this.round` 在 `init()` 中初始化为1后**从未递增**
- 始终显示 "第 1/10 回合"

### 8.2 回合不递增的原因

| 位置 | 代码 | 问题 |
|:-----|:-----|:-----|
| `renderRoundEndPanel` 末尾 | 无 round++ 代码 | 从未递增 |
| `restartGame()` | `scene.restart()` → init() | round 重置为1 |
| `createTopBar` | 硬编码字符串 | 即使 round++ 也不会更新 |

---

## 9. 胜负判定与 winner 参数

### 9.1 判定点 (6处)

| 函数 | 条件 | winner | 行号 |
|:-----|:-----|:------:|:----:|
| `confirmPlay()` | `playerHand.length === 0` | `'player'` | ~1015 |
| `doAITurn()` | `hand.length === 0` (入口) | `'ai1'`/`'ai2'` | ~1140 |
| `handleAIPlay()` | `hand.length === 0` (出牌后) | `'ai1'`/`'ai2'` | ~1215 |
| `localAIPlay()` | `hand.length === 0` (出牌后) | `'ai1'`/`'ai2'` | ~1290 |

### 9.2 winner → 显示

```javascript
var isPlayerWin = winner === 'player';
var isAI1Win = winner === 'ai1';
var winName = '';
if (isAI1Win) winName = '王怼怼';
else if (winner === 'ai2') winName = '苏甜甜';

var titleEmoji = isPlayerWin ? '🎉' : '😅';
var titleText = isPlayerWin ? '你赢了！' : '你输了';
var titleColor = isPlayerWin ? '#FFD700' : '#FF5252';
```

| winner | isPlayerWin | 标题 | 副标题 | 边框色 |
|:------:|:-----------:|:----:|:------:|:------:|
| `'player'` | true | `🎉 你赢了！` | 无 | `#FFD700` |
| `'ai1'` | false | `😅 你输了` | `王怼怼获胜！` | `#FF5252` |
| `'ai2'` | false | `😅 你输了` | `苏甜甜获胜！` | `#FF5252` |

### 9.3 结算时 gameState

```javascript
this.gameState = GAME_STATE.ROUND_END;
```

---

## 10. UI变化全记录

### 10.1 结算前 (玩家出完最后牌)

```
┌──────────────────────────────────────────────────────────────┐
│ 第 1/10 回合   [王怼怼]剩余5张   已出 顺子    [苏甜甜]剩余3张    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│    你: ┌8┐┌9┐┌10┐┌J┐┌Q┐  (最后出牌)                        │
│                                                              │
│      [手牌 — 空]                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 10.2 C+0ms (遮罩淡入开始)

```
┌──────────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│ ▓ (遮罩alpha 0 → 0.65, 300ms)                              ▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
└──────────────────────────────────────────────────────────────┘
```

### 10.3 C+300ms (卡片/面板淡入)

```
┌──────────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓  ┌────────────────────────────────────────────────────┐  ▓ │
│ ▓  │         (结算卡片淡入, alpha 0→1)                   │  ▓ │
│ ▓  └────────────────────────────────────────────────────┘  ▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└──────────────────────────────────────────────────────────────┘
```

### 10.4 C+400ms (标题弹入)

```
┌──────────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ ▓  ┌────────────────────────────────────────────────────┐  ▓ │
│ ▓  │          🎉 你赢了！  (scale 0.3→1.0弹入)           │  ▓ │
│ ▓  └────────────────────────────────────────────────────┘  ▓ │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└──────────────────────────────────────────────────────────────┘
```

### 10.5 C+700ms (得分区淡入)

```
         💰 总得分          (alpha 0→1)
         +304               (alpha 0→1)
         ────────────       (alpha 0→1)
```

### 10.6 C+900~1350ms (逐行淡入)

```
         基础底分   +30  ★   (alpha 0→1, T+900)
         炸弹翻倍   ×4       (alpha 0→1, T+1050)
         搞事情得分 +30  🔥   (alpha 0→1, T+1200)
         手牌奖励   +16  🃏   (alpha 0→1, T+1350)
```

### 10.7 C+1800ms (按钮淡入)

```
         [ 🔄 再来一局 ]    [ 🏠 返回首页 ]   (同时淡入)
```

### 10.8 C+2000ms (全部完成)

完整结算面板可交互，玩家可点击"再来一局"或"返回首页"。

---

## 11. 与旧文档差异说明

### 11.1 代码 vs 旧 Scoring.md

| # | 旧文档 | 代码实际值 | 说明 |
|:-:|:-------|:-----------|:-----|
| 1 | 火箭 ×4 | `Math.pow(2, bombMult)` 统一×2 | 需引入 rocketCount 修复 |
| 2 | 数字跳动动画 (30ms步进) | 直接显示最终值+alpha淡入 | 无数字跳动 |
| 3 | 结算按钮悬停效果 | 无悬停效果 | 纯静态按钮 |
| 4 | `round` 自动递增 | 硬编码 "第 1/10 回合" | round 从未递增 |
| 5 | 0分项隐藏 | 仅 value 显示 "0" | 行不隐藏 |
| 6 | 搞事情显示 "+0 🔥" | 显示 "0" (去掉+号) | 显示方式不同 |
| 7 | 手牌奖励显示 "+0" | 显示 "0" | 同上 |

### 11.2 代码bug汇总

| Bug | 影响 | 修复建议 |
|:----|:-----|:---------|
| `round` 从不递增 | 始终显示"第1回合" | `renderRoundEndPanel` 末尾加 `round++` 并更新 roundText |
| 火箭也×2 | 火箭威力减弱 | 引入 `rocketCount`，`Math.pow(2, bombs) * Math.pow(4, rockets)` |
| 无数字跳动 | 结算缺乏动感 | 添加 `time.addEvent` 每30ms递增显示 |

---

## 12. 验收标准

### 12.1 计分公式

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| F1 | 地主底分+30，农民底分+20 | baseScore 正确 | ~2525 |
| F2 | 每个炸弹总分×2 | multiplier = Math.pow(2, bombMult) | ~2533 |
| F3 | 搞事情每题+10分 | chaosBonus = chaosScore * 10 | ~2528 |
| F4 | 对手剩余每张手牌+2分 | handBonus = remainingCards * 2 | ~2531 |
| F5 | 0个炸弹显示×1 | "×1 (0个)" | ~2540 |
| F6 | 搞事情0分显示"0" | 不隐藏行，值显示"0" | ~2548 |

### 12.2 结算面板UI

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| U1 | 结算卡片中心弹出 (200,60) w=560 h=480 | 圆角12px, #1A1A2E 0.92 | ~2470 |
| U2 | 赢家边框#FFD700金色/输家#FF5252红色 | glowColor正确 | ~2471 |
| U3 | 标题28px bold, 赢#FFD700/输#FF5252 | shadow blur=20 | ~2477 |
| U4 | AI获胜时显示副标题"王怼怼/苏甜甜获胜！" | 16px #FF5252 | ~2483 |
| U5 | 得分面板 (240,142) w=480 h=260 圆角8px | 黑0.25 | ~2553 |
| U6 | 总得分36px bold #FFD700, shadow blur=15 | 正确显示 | ~2561 |
| U7 | 4个得分行 Y=235/260/285/310 | 间隔25px | ~2572 |
| U8 | 按钮 (290,370) + (500,370) 170×44 | 再来一局#4ECDC4, 返回#78909C | ~2605~2625 |
| U9 | 用时文字 (710,510) 10px #888888 | 格式正确 | ~2593 |

### 12.3 动画序列

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| A1 | 遮罩0.3s淡入至0.65 | alpha 0→0.65 | ~2465 |
| A2 | 卡片+面板在0.3s延迟后0.3s淡入 | delayedCall(300) | ~2598 |
| A3 | 标题0.4s弹入 scale 0.3→1.0 Back.easeOut | delayedCall(400) | ~2605 |
| A4 | 得分+分隔线在0.7s延迟后淡入 | delayedCall(700) | ~2612 |
| A5 | 得分行逐行淡入，间隔150ms | 900/1050/1200/1350ms | ~2619 |
| A6 | 分隔线2在1.5s淡入 | delayedCall(1500) | ~2624 |
| A7 | 用时文字在1.6s淡入 | delayedCall(1600) | ~2627 |
| A8 | 按钮在1.8s同时淡入 | delayedCall(1800) | ~2630 |
| A9 | 总时长2.0s，之后可交互 | 最后一个动画在2000ms完 | 计算 |

### 12.4 胜负判定

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| W1 | 玩家出完最后牌 → 结算 | confirmPlay `playerHand.length === 0` → 'player' | ~1015 |
| W2 | AI1出完牌 → 结算 "王怼怼获胜！" | handleAIPlay/localAIPlay | ~1215 |
| W3 | AI2出完牌 → 结算 "苏甜甜获胜！" | handleAIPlay/localAIPlay | ~1215 |
| W4 | gameState = ROUND_END | 结算期间不可操作 | ~2463 |

### 12.5 回合计数器

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| R1 | 初始 "第 1/10 回合" | (12,9) 12px #E8F5E9 | createTopBar |
| R2 | round 当前不递增 (代码bug) | 硬编码字符串 | 待修复 |

### 12.6 边界情况

| # | 验收条件 | 预期结果 | 来源行 |
|:-:|----------|---------|:------:|
| B1 | chaosScore=0时仍显示行 | value='0' | ~2548 |
| B2 | handBonus=0时显示行 | value='0' | ~2550 |
| B3 | 玩家输时显示"😅 你输了"+AI副标题 | 红色主题 | ~2477 |
| B4 | elapsed 安全兜底 | `self.gameStartTime \|\| Date.now()` | ~2589 |

---

## 附录: 函数索引

| 函数 | 行号 | 功能 | 计分类键行 |
|:-----|:----:|:-----|:----------|
| `init()` | ~200 | 初始变量 | totalBombs=0, chaosScore=0, gameStartTime=Date.now() |
| `renderRoundEndPanel(winner)` | 2463 | 结算面板+计分 | 2525-2536 计分公式 |
| `confirmPlay()` | ~990 | 出牌确认 | ~1011 totalBombs++ |
| `handleAIPlay()` | ~1170 | AI出牌 | ~1210 totalBombs++ |
| `localAIPlay()` | ~1260 | 本地AI出牌 | ~1285 totalBombs++ |
| `_handleOptionClick()` | ~1619 | 搞事情答题 | ~1640 chaosScore++ |
| `doAction()` | ~1360 | 搞事情入口 | chaosScore \|\| 0 |
| `createTopBar()` | ~350 | 顶部状态栏 | ~360 roundText |
