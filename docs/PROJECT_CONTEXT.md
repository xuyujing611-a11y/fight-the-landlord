# 斗地主 — 子Agent项目上下文

> 本文件为子Agent（小弟）提供完整项目上下文，避免"修了这里坏了那里"。

---

## 📦 项目信息

| 项目 | 值 |
|------|-----|
| 根目录 | `/home/xu_yujing/openclaw/workspaces/fight-the-landlord` |
| 框架 | Phaser 3 (CDN) |
| 画布 | 960×600 横屏 |
| 缩放宽高比 | Phaser.Scale.FIT (全屏时 FILL) |
| 调整模式 | Phaser.Scale.CENTER_BOTH |
| 背景色 | #1B5E20 |
| 后端 | Node.js Express (端口 3000), 文件 `server/index.js` |
| 入口 | `client/index.html` |
| 主游戏文件 | `src/client/js/game.js` (~2820行) |
| 牌引擎 | `src/client/js/CardEngine.js` |
| API客户端 | `src/client/js/apiClient.js` |

---

## 🏗 代码架构

```
fight-the-landlord/
├── client/index.html          # 入口页面
├── src/client/js/             # 核心源码
│   ├── game.js                # ⭐ 游戏主逻辑 (~2820行, 频繁修改)
│   ├── CardEngine.js          # 牌型引擎 (Doudizhu 类)
│   ├── CardEngine.test.js     # 牌引擎测试
│   └── apiClient.js           # 后端API调用
├── server/index.js            # Express 后端 (端口3000)
├── docs/                      # 设计文档
│   ├── ChaoShiQing-detailed.md    # ⭐ 搞事情系统超详细设计
│   ├── CardSwap.md                # 交换牌逻辑
│   ├── PRD-赢牌反馈+AI气泡系统-v1.md
│   ├── Layout.md / Gameplay.md / Bidding.md / Scoring.md
│   ├── AIBubble.md / SoundAnimation.md
│   └── CardEngine.md
├── memory/                     # 开发记忆
│   └── YYYY-MM-DD.md           # 每日变更日志
└── PROJECT_CONTEXT.md          # ← 本文件
```

### game.js 核心模块一览

| 函数/区域 | 行号(大约) | 功能 |
|----------|-----------|------|
| `GAME_STATE` | ~18 | 状态机定义 |
| `SoundManager` | ~40 | Web Audio 音效管理 |
| `getCardImageKey()` | ~120 | 牌面→图片key映射 |
| `renderPlayerHand()` | ~410 | 渲染玩家手牌 |
| `displayPlay()` | ~470 | 显示玩家出牌 |
| `updateAICount()` | ~440 | 更新AI牌数 |
| `createActionButtons()` | ~3090 | 底部5个功能按钮 |
| `doAction()` | ~1920 | 按钮点击分发 |
| `handleAIPlay()` | ~1400 | AI出牌处理 |
| `handleAIPass()` | ~1520 | AI不出处理 |
| `_showPlayBubble()` | ~1540 | AI气泡台词显示 |
| `_createChaosOverlay()` | 搞事情区域 | 遮罩+白色面板 |
| `_showTypeSelection()` | 搞事情区域 | 4种题型选择 |
| `_renderQuestion()` | 搞事情区域 | 题目渲染(4选项) |
| `_handleOptionClick()` | 搞事情区域 | 选项点击处理 |
| `_handleChaosTimeout()` | 搞事情区域 | 30秒超时处理 |
| `_showSwapUI()` | 搞事情区域 | 答对盲选交换UI |
| `_showSwapResult()` | 搞事情区域 | 答错AI飞牌抢牌 |
| `_showSwapButtons()` | 搞事情区域 | 底部"再来一题/关掉"按钮 |
| `_clearQuestionArea()` | 搞事情区域 | 清除题目区(保留[0..4]) |
| `_destroyChaos()` | 搞事情区域 | 完全销毁搞事情系统 |

---

## 🎮 游戏状态机

```
INIT → BIDDING → PLAYER_TURN ⇄ WAITING_AI → ROUND_END
                          ↑ ↓
                     CHAOS_MODE (搞事情)
```

关键守卫：
- 搞事情按钮只在 `PLAYER_TURN` 或 `CHAOS_MODE` 可用
- 选中CHAOS_MODE后，遮罩阻隔下层交互
- CHAOS_MODE 结束时恢复 PLAYER_TURN

---

## 🔄 搞事情系统（ChaoShiQing）核心数据流

```
action='chaos'
  → doAction()
    → SoundManager.pauseAll()
    → gameState = CHAOS_MODE
    → 选AI (duidui/tiantian 各50%)
    → _createChaosOverlay(aiId, callback)
      → 创建遮罩(0x000000, 0.75) depth 300
      → 白色卡片(150,55, 660×320) depth 301
      → 标题 "🔥 搞事情！答题挑战" depth 302
      → 关闭按钮 + 得分显示
    → _showTypeSelection(aiId, aiName)
      → 4种题型: vocab(📚)/expression(💬)/trivia(🧠)/life_hack(🏠)
      → 2×2网格 260×88 卡片
      → 选完→_showChaosQuestion()
    → _showChaosQuestion(aiId, aiName, type)
      → API请求可回落_fallbackQuestions(4道内置题)
    → _renderQuestion(q, aiId)
      → 4选项 290×64, 2×2网格
      → 30s超时计时器
    → _handleOptionClick(self, optBg, optKey, aiId, q)
      → 答对: chaosScore+1, SoundManager.win(), _showSwapUI()
      → 答错: SoundManager.lose(), 显示正确答案+解析, _showSwapResult()
    → _handleChaosTimeout(aiId)
      → 超时→_showSwapResult()
    → _showSwapUI()   → 盲选 3~5牌背 → 确认翻牌+飞入动画
    → _showSwapResult() → 600ms后背面飞牌→翻牌揭示(700ms, Back.easeIn)
    → _showSwapButtons → "再来一题"/"关掉回牌"
    → _destroyChaos() → 恢复音效+状态+文字
```

---

## 🎨 搞事情UI精确坐标

| 元素 | X | Y | W | H | Depth |
|------|---|---|---|---|:-----:|
| 半透明遮罩 | 0 | 0 | 960 | 600 | 300 |
| 白色卡片 | 150 | 55 | 660 | 320 | 301 |
| 内发光边框 | 154 | 58 | 660 | 320 | 301 |
| 标题 | 480(居中) | 77 | — | — | 302 |
| 关闭按钮 | 720 | 72 | 20 | 28 | 302 |
| 选项卡片(vocab) | 220 | 107 | 260 | 88 | 302 |
| 选项卡片(expr) | 500 | 107 | 260 | 88 | 302 |
| 选项卡片(trivia) | 220 | 181 | 260 | 88 | 302 |
| 选项卡片(life) | 500 | 181 | 260 | 88 | 302 |
| 选项A | 175 | 155 | 290 | 64 | 302 |
| 选项B | 480 | 155 | 290 | 64 | 302 |
| 选项C | 175 | 230 | 290 | 64 | 302 |
| 选项D | 480 | 230 | 290 | 64 | 302 |
| 确认按钮 | 290 | 310 | 200 | 44 | 353 |
| 取消/跳过按钮 | 290 | 360 | 200 | 44 | 353 |

---

## 🃏 换牌UI精确坐标

| 元素 | X | Y | W | H | Depth |
|------|---|---|---|---|:-----:|
| 交换遮罩 | 0 | 0 | 960 | 600 | 350 |
| 标题 "🎉 答对了！赢一张牌！" | 480 | 90 | — | — | 351 |
| 提示文字 | 480 | 112 | — | — | 351 |
| 玩家手牌标签 | 480 | 140 | — | — | 351 |
| 玩家手牌 | 动态 | 175 | 44×64 | — | 352 |
| AI牌背标签 | 480 | 230 | — | — | 351 |
| AI牌背(3~5张) | 动态 | 260 | 40×56 | — | 352 |
| 确认按钮 | 290 | 310 | 200 | 44 | 353 |
| 跳过/取消按钮 | 290 | 360 | 200 | 44 | 353 |

---

## 📐 关键编码规范

1. **Phaser坐标系**: 960×600，左上角为(0,0)，文字 `setOrigin(0.5)` 居中
2. **Depth层级策略**: 搞事情depth 300-359, 换牌depth 350-400
3. **音效**: `SoundManager.win()` / `lose()` / `playCard()` / `selectCard()`
4. **游戏状态**: `this.gameState = GAME_STATE.X`
5. **搞事情变量命名**:
   - `chaosElements` — 所有chaos UI元素数组
   - `chaosScore` — 搞事情得分（跨回合持久）
   - `chaosQuestionAnswered` — 答题锁定标志
   - `chaosTypeSelection` — 题型选择锁定
   - `chaosTimeoutTimer` — 30秒超时计时器
   - `swapElements` — 换牌UI元素数组
6. **Doudizhu工具**: `Doudizhu.sortCards()` 排序, `Doudizhu.RANK_NAMES` / `SUIT_NAMES` 牌名映射
7. **牌面图key**: `getCardImageKey(card)` → `'cardS<套>R<点数>'` 格式
8. **cardBack**: 通用牌背图key `'cardBack'`

---

## 📜 设计文档索引

| 文档 | 内容 |
|------|------|
| `docs/ChaoShiQing-detailed.md` | ⭐ 搞事情系统完整设计 |
| `docs/CardSwap.md` | 交换牌逻辑设计 |
| `docs/PRD-赢牌反馈+AI气泡系统-v1.md` | 赢牌结算+AI气泡 |
| `docs/Layout.md` | 布局设计 |
| `docs/Gameplay.md` | 游戏玩法 |
| `docs/Bidding.md` | 叫地主逻辑 |
| `docs/Scoring.md` | 计分规则 |
| `docs/AIBubble.md` | AI气泡台词 |
| `docs/SoundAnimation.md` | 音效动画 |
| `docs/CardEngine.md` | 牌型引擎说明 |

---

## 🆕 最近变更 v2.0 (2026-05-02)

### 最新3次提交
```
04a873c [FIX] 搞事情文档一致性审查 (答错手牌空卡UI+超时分场景)
9575c33 [DOC] ChaoShiQing超详细设计文档 v2.0
5479a36 [FIX] B44: 修复_showSwapUI被覆盖
```

### B44-B46 换牌机制
- 答对→`_showSwapUI()`: 3~5牌背盲选，1张真AI牌+2~4空牌背，翻牌飞牌动画
- 答错→`_showSwapResult()`: 600ms后背面飞向AI(y345→y160)，翻牌揭示
- 超时→`_handleChaosTimeout()`: 30s÷倒计时，显示超时消息，走答错路径
- 确认按钮(290,310) 跳过按钮(290,360)

### B42-B43 界面修复
- B42: AI出牌文字层(depth=22)移除
- B43: 全屏FILL/CSS :fullscreen

### B40 赢牌结算+AI气泡队列
- `renderRoundEndPanel()` 全屏结算
- 气泡队列 max 3条，依次出队
- 出牌4秒/炸弹5秒/搞事情3.5秒销毁

### B38-B39 牌尺寸
- 手牌 62×88, Y=420
- 出牌玩家 52×75, AI 42×60
- 底牌直接融入地主手牌

---

## ⚠️ 修改安全规则

### ✅ 可以自由做
- 读文件、搜索代码、查git历史
- 修改 `src/client/js/game.js` 中的搞事情/换牌逻辑
- 修改 `apiClient.js`
- 修改 `client/index.html` (CSS/布局)
- 添加新函数、新动画、新UI元素

### ⚠️ 注意不要破坏
- `Doudizhu` 牌型判断逻辑（`CardEngine.js`）
- `SoundManager` 全局单例
- `renderPlayerHand()` 手牌渲染
- `displayPlay()` 出牌区渲染
- `createActionButtons()` 底部按钮（索引位置不能乱改）
- `getCardImageKey()` 牌图映射

### 🛑 工作流程（子Agent必读）

### 收到任务后的顺序
1. **保存记忆** — 先写 memory 文件记录：当前进度、决策、上下文、相关代码位置
2. **清空上下文** — 标记旧历史结束，进入全新任务
3. **读 PROJECT_CONTEXT.md** — 了解项目整体
4. **执行任务** — 改代码
5. **验语法** — `node --check src/client/js/game.js`
6. **报告结果** — 不提交，只说

---

## 📏 代码提交规则

1. **不提交** — 修完代码在群里 @小虾 通知验收，由小虾 commit + push
2. **只修代码** — 不改记忆文件、不改文档（除非PRD明确要求）
3. **语法检查** — 每次修改后必须 `node --check`
4. **增量修改** — 用 `edit` 工具做精确替换，不要 `write` 全部覆盖

---

## 📁 关键文件路径速查

```
src/client/js/game.js          # 主游戏逻辑
src/client/js/CardEngine.js    # 牌型引擎
src/client/js/apiClient.js     # API客户端
server/index.js                # 后端服务
docs/ChaoShiQing-detailed.md   # 搞事情系统设计 (最详细)
docs/CardSwap.md               # 换牌逻辑设计
memory/2026-05-02.md           # 今日开发记忆
```

---

## 🔍 常见调试命令

```bash
# 语法检查
node --check src/client/js/game.js

# 搜索函数
grep -n '函数名' src/client/js/game.js

# 看某段代码
sed -n '100,150p' src/client/js/game.js

# 看最近提交
git log --oneline -10

# 看改动量
git diff HEAD~1 --stat
```
