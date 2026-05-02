# PRD：搞事情 (Chaos Mode) 系统设计文档

| 属性 | 值 |
|------|-----|
| 文档版本 | v1.0 |
| 游戏画布 | 960×600 (Phaser 3, 横屏) |
| 涉及场景 | `GameScene` |
| 状态常量 | `GAME_STATE.CHAOS_MODE` |
| 功能入口 | "搞事情"按钮 → `doAction()` |
| 依赖服务 | `ApiClient.generateChaosQuestion()`, `ApiClient.generateDialogue()` |
| 降级方案 | 内置题库（4道回退题目）+ 本地台词池 |

---

## 1. 触发入口

### 1.1 "搞事情"按钮

布局：底部功能按钮栏第4个按钮（紫色 #7C4DFF）

| 属性 | 值 |
|------|-----|
| 按钮标签 | `搞事情` |
| 按钮区域 | `[startX + 3*(bw+gap), btnY, bw, bh]` |
| **坐标值** | x=`530`, y=`442`, w=`72`, h=`48` |
| 颜色 | `0x7C4DFF` (紫色) |
| 圆角 | `8px` |
| 层级 | depth=`100` |
| 点击事件 | `scene.doAction()` |

按钮在 `createActionButtons(scene)` 中创建，共5个按钮（出牌/提示/不出/搞事情/底牌查看），从 `startX = (960 - totalW)/2` 开始横向排列，间距 `gap=14`。

### 1.2 doAction() 流程

```
"搞事情"按钮点击
  └─ doAction()
       ├─ 检查状态: gameState 必须为 PLAYER_TURN 或 CHAOS_MODE
       ├─ SoundManager.pauseAll()       ← 暂停出牌音效
       ├─ gameState = CHAOS_MODE
       ├─ chaosScore 初始化（0，持久化跨回合）
       ├─ setStatusText("选题型...")
       ├─ 随机选择被搞AI: aiId ∈ {duidui, tiantian}
       ├─ _createChaosOverlay(aiId, callback)
       └─ callback → _showTypeSelection(aiId, aiName)
```

**验收标准：**
- [ ] 非 PLAYER_TURN 或 CHAOS_MODE 状态下按钮无响应
- [ ] 点击后出牌音效暂停
- [ ] gameState 立即切换为 CHAOS_MODE
- [ ] 遮罩层动画出现

---

## 2. 遮罩层 (_createChaosOverlay)

```javascript
GameScene.prototype._createChaosOverlay(aiId, callback)
```

创建层级结构（depth 300起）：

| 元素 | 类型 | 坐标 (x, y, w, h) | depth | 说明 |
|------|------|---------------------|-------|------|
| 半透明遮罩 | Graphics rect | `(0, 0, 960, 600)` | 300 | `fillStyle(0x000000, 0.75)` |
| 白色卡片背景 | Graphics roundedRect | `(150, 55, 660, 320)` | 301 | `fillStyle(0xFFFFFF)`, 圆角12px |
| 内发光边框 | Graphics roundedRect | `(154, 58, 660, 320)` | 301 | `fillStyle(0x000000, 0.08)`, 圆角12px |
| **标题 "🔥 搞事情！答题挑战"** | Text | `(480, 77)` origin `(0.5, 0)` | 302 | fontSize `19px`, color `#FF6B35`, bold |
| **得分显示** | Text | `(660, 77)` | 302 | fontSize `12px`, color `#333333` |
| **AI 台词气泡** | Graphics + Text | 见第7节 | 302-303 | 链接到 `_showAiBubble` |
| **关闭按钮"✖"** | Graphics + Text | `(720, 72)` w=`20` h=`28` | 302-303 | 颜色 `0xE53935` (红色)，圆角10px |

### 关闭按钮行为

点击关闭按钮 → `_destroyChaos()`:
```javascript
GameScene.prototype._destroyChaos()
├─ 销毁 chaosElements 中所有对象
├─ 销毁 chaosBubbleElements
├─ 置空引用: overlay, cardBg, title, scoreText 等
├─ SoundManager.resumeAll()
├─ gameState = PLAYER_TURN
└─ setStatusText("搞事情结束，继续出牌")
```

**验收标准：**
- [ ] 遮罩覆盖全屏，禁止点击下层UI
- [ ] 白色卡片背景居中（150~810, 55~375）
- [ ] 标题显示 "🔥 搞事情！答题挑战"
- [ ] 得分初始显示 "得分: 0"
- [ ] 关闭按钮可点击，完全销毁所有 chaos 元素，恢复 gameState

---

## 3. 题型选择 (_showTypeSelection)

### 3.1 布局

题型选择面板在白色卡片内以 **2×2 网格** 展示，覆盖 y=77 至 y=375 区域。

| 元素 | 坐标 (x, y) | depth | 说明 |
|------|------------|-------|------|
| 副标题 "📋 选个题型，开始搞事情" | `(480, 77)` origin `(0.5)` | 302 | 覆盖主标题（hide） |
| 题型卡片0 (vocabulary) | 左上: `(220, 107)` w=`260` h=`88` | 302 | |
| 题型卡片1 (expression) | 右上: `(500, 107)` w=`260` h=`88` | 302 | |
| 题型卡片2 (trivia) | 左下: `(220, 181)` w=`260` h=`88` | 302 | |
| 题型卡片3 (life_hack) | 右下: `(500, 181)` w=`260` h=`88` | 302 | |

### 3.2 四种题型

| id | 标签 | 图标 | 描述 | 卡片左上坐标 |
|----|------|------|------|------------|
| `vocabulary` | 四六级单词 | 📚 | 看释义选单词，AI给你出牌 | `(220, 107)` |
| `expression` | 口语表达 | 💬 | 地道俚语挑战，口语达人 | `(500, 107)` |
| `trivia` | 冷知识 | 🧠 | 奇怪的知识增加了 | `(220, 181)` |
| `life_hack` | 生活常识 | 🏠 | 生活小窍门，你真的会吗 | `(500, 181)` |

### 3.3 题型卡片样式

| 属性 | 默认态 | Hover态 | 点击后 |
|------|--------|---------|--------|
| 填充色 | `#F0F4FF` | `#E0EAFF` | 销毁 |
| 边框色 | `#CCD8FF` (1.5px) | `#7C4DFF` (2px) | 销毁 |
| 圆角 | 10px | 10px | 销毁 |

### 3.4 卡片内部布局（以 vocabulary 为例）

```
(220, 107) ┌─────────────────────────┐
            │ 📚  四六级单词           │
            │      看释义选单词...      │
            └─────────────────────────┘
                  260px
```

- 图标: `(cx + 12, cy + 12)` fontSize 26px
- 标签: `(cx + 58, cy + 14)` fontSize 14px, color `#222222`, bold
- 描述: `(cx + 58, cy + 40)` fontSize 10px, color `#888888`

### 3.5 选择后行为

```javascript
_showTypeSelection → pointerdown → 
├─ chaosTypeSelection = false
├─ 恢复主标题 chaosTitle visibility
├─ 销毁索引 ≥5 的 chaosElements（保留基础5个: 遮罩/背景/标题/分数/关闭）
├─ _showChaosQuestion(aiId, aiName, typeId)
```

**验收标准：**
- [ ] 4张题型卡片按2×2网格排列，位置精确
- [ ] hover态切换颜色（浅蓝→深蓝边框）
- [ ] 点击后销毁题型选择UI，保留基础元素
- [ ] 正确传递 selected type 到出题函数

---

## 4. 题目渲染 (_renderQuestion)

### 4.1 触发

```javascript
_showChaosQuestion(aiId, aiName, type) →
├─ 尝试 API: ApiClient.generateChaosQuestion(type, 'normal', 1)
├─ 成功 → _renderQuestion(res.questions[0], aiId)
└─ 失败 → _renderFallbackQuestion(aiId)
```

### 4.2 题目区域布局（在白色卡片内）

| 元素 | 坐标 | depth | 说明 |
|------|------|-------|------|
| 题型标签 | `(220, 97)` | 302 | 图标+类型名，color `#FF6B35`, bold, 13px |
| 题目文本 | `(220, 114)` | 302 | fontSize `14px`, color `#222222`, wordWrap `600px` |
| 选项A | 左上: `(175, 155)` w=`290` h=`64` | 302 | |
| 选项B | 右上: `(480, 155)` w=`290` h=`64` | 302 | |
| 选项C | 左下: `(175, 230)` w=`290` h=`64` | 302 | |
| 选项D | 右下: `(480, 230)` w=`290` h=`64` | 302 | |

### 4.3 选项样式

| 属性 | 默认态 |
|------|--------|
| 背景填充 | `#F5F5F5` |
| 边框 | `#CCCCCC` (1.5px) |
| 圆角 | 8px |
| 文本 | fontSize `13px`, color `#333333`, wordWrap `opW - 55` |
| 标记圆 | 左侧圆圈 `#4ECDC4`, radius `11px`, 中心 `(gx + 20, gy + 32)` |
| 标记文字 | A/B/C/D, fontSize `12px`, color `#FFFFFF`, bold |

### 4.4 数据结构

```javascript
// API 返回格式
{
  question: "The word \"abandon\" means:",
  options: { A: "放弃", B: "接受", C: "建立", D: "发现" },
  answer: "A",
  explanation: "abandon 意为\"放弃\"，是四级心词汇。",
  questionType: "vocabulary"
}

// 内置回退格式（_renderFallbackQuestion）
{
  question: "...",
  options: { A: "...", B: "...", C: "...", D: "..." },
  answer: "A",
  explanation: "...",
  questionType: "本地题库"
}
```

### 4.5 答题锁定

```javascript
chaosQuestionAnswered = false;  // 渲染时复位
// 点击选项时:
if (self.chaosQuestionAnswered) return;  // 防止连点
self.chaosQuestionAnswered = true;
```

**验收标准：**
- [ ] 题目文本自适应换行（wordWrap 600px）
- [ ] 4个选项按2×2网格排列，精确位置
- [ ] 每个选项左侧有圆形标记（A/B/C/D）
- [ ] 点击后立即锁定（chaosQuestionAnswered = true），不再响应后续点击

---

## 5. 答案处理 (_handleOptionClick)

### 5.1 判断逻辑

```javascript
var answer = optBg.getData('answer');
var isCorrect = (optKey === answer);
```

### 5.2 正确回答流程

```
答对了 →
├─ chaosScore +1, 更新得分显示 "得分: N"
├─ SoundManager.win() 播放胜利音效
├─ _clearQuestionArea() 清空题目区域（保留前5个基础元素）
├─ 显示反馈 ✓ 绿色 "+1"
│   ├─ 反馈图标: (480, 103)  resultIcon + "答对了！+1"
│   └─ fontSize 20px, color #4CAF50, bold
├─ 如果有 explanation → 显示解析（y=180起，wordWrap 500px）
├─ _showAiBubble(aiId, 'correct', fbY+10)
├─ _showSwapUI(aiId, fbY)  ← 弹出换牌界面（玩家选AI的牌）
```

### 5.3 错误回答流程

```
答错了 →
├─ 得分不变
├─ SoundManager.lose() 播放失败音效
├─ _clearQuestionArea()
├─ 显示反馈 ✗ 红色 "答错了！"
│   ├─ 反馈图标: (480, 103)  resultIcon + "答错了！"
│   └─ fontSize 20px, color #E53935, bold
├─ 显示正确答案 (y=180):
│   "正确答案: A. 放弃"
│   fontSize 12px, color #4CAF50, bold, wordWrap 500px
├─ 如果有 explanation → 显示解析
├─ _showAiBubble(aiId, 'wrong', fbY+10)
└─ _showSwapResult(aiId, false, fbY)  ← AI从玩家拿一张牌
```

### 5.4 反馈显示坐标

| 元素 | 坐标 | 说明 |
|------|------|------|
| 结果图标 | `(480, 103)` origin `(0.5)` | "✅ 答对了！" 或 "❌ 答错了！" |
| 正确答案文本 | `(220, 180)` | 仅答错时显示 |
| 解析说明 | `(220, 208)` 或 `(220, 258)` | 根据长度自适应y偏移 |

**验收标准：**
- [ ] 答对得分+1，得分文字实时刷新
- [ ] 答错显示正确答案
- [ ] 正误反馈有不同音效
- [ ] 反馈区域正确显示，不与后续UI重叠

---

## 6. UI 元素汇总

### 6.1 所有 Chaos 元素层级总表

| depth | 元素 | 作用域 |
|-------|------|--------|
| 300 | 半透明遮罩 (overlay) | 全程 |
| 301 | 白色卡片背景 (cardBg) | 全程 |
| 302 | 标题、分数、题型卡片、题目、选项背景、气泡背景等 | 变化 |
| 303 | 题型图标、标签、选项标记圈、选项文字、气泡头像 | 变化 |
| 304 | 选项标记字母 | 仅题目阶段 |
| 305 | 反馈图标、解析文字、底部按钮 | 仅反馈阶段 |
| 306 | 底部按钮文字 | 仅反馈阶段 |
| 310 | 换牌消息 | 仅换牌阶段 |
| 350-355 | 换牌UI遮罩+卡片+按钮 | 仅换牌阶段 |

### 6.2 chaosElements 数组管理

```javascript
// 索引约定（持久保留前5个）
[0] overlay          → 半透明遮罩
[1] cardBg           → 白色卡片背景（含内外两个 Graphics）
[2] chaosTitle       → "🔥 搞事情！答题挑战"
[3] chaosScoreText   → "得分: N"
[4] closeBtnBg       → 关闭按钮背景
[5] closeBtnText     → "✖"
// [5+) 临时元素，_clearQuestionArea 会销毁索引≥5的全部
```

### 6.3 清除函数

```javascript
_clearQuestionArea() → 保留 chaosElements[0..4]，销毁 [5..end]
_destroyChaos()     → 销毁所有 chaosElements + chaosBubbleElements
```

---

## 7. AI 气泡 (_showAiBubble)

### 7.1 气泡布局

出现在题目卡片左侧，位于白色卡片区域 y=180 以下：

| 元素 | 坐标 | depth |
|------|------|-------|
| AI 头像圆圈 | `(80, y+16)` radius=`22px` | 302 |
| 头像文字（😎/😊） | `(80, y+16)` | 303 |
| AI 名字 | `(105, y-4)` | 302 |
| 台词气泡背景 | `(230, y+10)` 自适应宽度 | 302 |
| 三角形箭头 | 气泡左侧指向头像 | 302 |
| 台词文本 | `(244, y+28)` | 303 |

王怼怼：头像颜色 `0x4FC3F7`（蓝）
苏甜甜：头像颜色 `0xFFB74D`（橙）

### 7.2 气泡样式

| 属性 | 值 |
|------|-----|
| 背景颜色 | `0x1B5E20` (深绿) alpha `0.85` |
| 边框颜色 | `0x66BB6A` (亮绿) alpha `0.5` |
| 圆角 | 12px |
| 宽度 | `Math.min(540, 200 + line.length * 10)` |
| 高度 | 36px |
| 箭头 | 左侧三角形指向头像 |

### 7.3 气泡内容（按场景 key）

| sceneKey | 触发时机 | 示例 |
|----------|---------|------|
| `easy` | 初始显示 | "送分题，给人类的怜悯。" |
| `correct` | 答对 | "哼，蒙对的吧？" |
| `wrong` | 答错 | "哈哈哈哈哈！果然不出所料！" |
| `close` | 关闭 | "行吧，回来打牌。" |

### 7.4 气泡队列系统

```javascript
var bubbleQueue = [];       // 全局队列
var BUBBLE_QUEUE_MAX = 3;   // 最大队列长度
var bubbleShowing = false;   // 队列处理中标记

_showAiBubble(aiId, sceneKey, y) →
├─ 构造 queuedTask ← pickAiLine(aiId, sceneKey)
├─ bubbleQueue.push({ render: queuedTask })
├─ if (queue > BUBBLE_QUEUE_MAX) queue.shift()
└─ if (!bubbleShowing) processBubbleQueue()

processBubbleQueue() →
├─ bubbleShowing = true
├─ bubbleQueue.shift().render()
└─ render → 3.5秒后自动销毁 → processBubbleQueue()
```

**验收标准：**
- [ ] 气泡显示3.5秒后自动消失
- [ ] 队列机制确保气泡不重叠
- [ ] 最多3个任务排队，超出丢弃旧任务
- [ ] 头像+气泡箭头指向正确

---

## 8. 换牌回牌 (_showSwapUI / _showSwapResult)

### 8.1 答对换牌 (_showSwapUI)

弹出半透明遮罩（depth 350），显示交互式换牌界面：

| 元素 | 坐标 (x, y, w, h) | 说明 |
|------|---------------------|------|
| 换牌遮罩 | `(0, 0, 960, 600)` | 半透明黑 `0x000000, 0.6` |
| 标题 | `(480, 120)` origin `(0.5)` | "🔄 换牌挑战 — 交出你的一张牌，猜猜AI藏了哪张" |
| 提示文字 | `(480, 142)` | "选你的牌交出 → 猜AI的一张牌背(盲猜模式) → 点确认交换" |
| AI牌标签 | `(480, 175)` | "{AI名} 的手牌（点击选一张）" |
| AI牌区域 | y=`200` 横向排列 | 38×54px, 间距26px |
| 玩家牌标签 | `(480, 300)` | "你的手牌（点击选一张）" |
| 玩家牌区域 | y=`330` 横向排列 | 44×64px, 间距30px |
| 确认按钮 | `(240, 390)` w=`200` h=`44` | "✅ 确认交换" |
| 取消按钮 | `(520, 390)` w=`200` h=`44` | "✖ 跳过交换" |

**交互逻辑：**
1. 点击玩家牌 → 高亮变大（+6px）
2. 点击AI牌 → 高亮变大（+6px）
3. 两张都选中 → 确认按钮变实色
4. 点击确认 → 交换手牌 → 销毁换牌UI → 显示交换成功消息（3.5秒自动消失）→ 显示底部按钮
5. 点击跳过 → 销毁换牌UI → 显示底部按钮

**边界情况：** 如果玩家或 AI 手牌为空 → 直接跳转 `_showSwapResult(aiId, false, fbY)`

### 8.2 答错换牌 (_showSwapResult)

```javascript
_showSwapResult(aiId, false, fbY) →
├─ AI从玩家手牌随机取一张
├─ 显示 "😈 {AI名} 从你手中拿走了一张牌！" (480, 184)
├─ 显示 "[花色牌面]" (480, 206)  ← 3秒后自动消失
├─ 玩家手牌重渲染
└─ _showSwapButtons(aiId, max(fbY + 60, 251))
```

**边界情况：**
- [ ] 玩家手牌为空 → 函数直接 return，不执行换牌
- [ ] AI手牌为空 → `_showSwapUI` 跳过换牌界面

### 8.3 底部按钮 (_showSwapButtons)

| 按钮 | 坐标 | 尺寸 | 颜色 | 文字 |
|------|------|------|------|------|
| "🔄 再来一题" | `(220, btnY)` | 220×40 | `0x4ECDC4` (青色) | 13px, 白色, bold |
| "✖ 关掉回牌" | `(510, btnY)` | 220×40 | `0xFF6B6B` (红色) | 13px, 白色, bold |

**btnY 计算：**
- 答对时: `Math.max(fbY + 60, 280)`
- 答错时: `Math.max(fbY + 60, 251)`

**"再来一题" 行为：**
```javascript
├─ chaosQuestionAnswered = false
├─ _clearQuestionArea()
├─ 随机选择新 AI（Math.random() < 0.5 ? duidui : tiantian）
└─ _showChaosQuestion(aiId, aiName)
```

**"关掉回牌" 行为：**
```javascript
├─ _destroyChaos()
├─ gameState = PLAYER_TURN
└─ statusText = "搞事情结束，继续出牌"
```

**验收标准：**
- [ ] 答对：出现换牌界面，选两张牌后确认可交换
- [ ] 答错：AI 自动从玩家手牌取一张
- [ ] 换牌后玩家手牌重新渲染
- [ ] AI 手牌计数更新
- [ ] 底部两个按钮功能正常
- [ ] 玩家手牌为空时跳过换牌

---

## 9. 回退题目 (_renderFallbackQuestion)

### 9.1 触发条件

- `ApiClient.generateChaosQuestion()` 返回失败
- `ApiClient` 未定义（本地模式）
- API 返回成功但 `questions` 数组为空

### 9.2 内置题库

| # | 题目 | 正确答案 | 类型 |
|---|------|----------|------|
| 1 | The word "abandon" means: (A=放弃 B=接受 C=建立 D=发现) | A | vocabulary |
| 2 | "I'm feeling under the weather" 意思: (A=在天气下面 B=生病了 C=喜欢不同天气 D=傻傻笨笨) | B | expression |
| 3 | 哪个动物几乎不患癌症？(A=鲨鱼 B=大象 C=裸鼹鼠 D=乌龟) | C | trivia |
| 4 | 哪种方法能让切洋葱不流泪？(A=冷冻30分钟 B=含一口水 C=戴泳镜 D=微波10秒) | C | life_hack |

### 9.3 数据格式

```javascript
{
  question: "...",
  options: { A: "...", B: "...", C: "...", D: "..." },
  answer: "A" | "B" | "C" | "D",
  explanation: "...",
  questionType: "本地题库"
}
```

随机选择1道，调用 `_renderQuestion(q, aiId)` 渲染。

**验收标准：**
- [ ] API 不可用时自动降级为本地题库
- [ ] 4道题目覆盖4种题型
- [ ] 随机选取，不与API题冲突

---

## 10. 边界情况与容错

### 10.1 API 失败

| 场景 | 行为 |
|------|------|
| API 返回 HTTP 错误 | 降级 → `_renderFallbackQuestion` |
| API 返回成功但 questions 为空 | 降级 → `_renderFallbackQuestion` |
| API 超时 | 降级 → `_renderFallbackQuestion` |
| ApiClient.generateDialogue 不可用 | 本地台词池 `pickAiLine(aiId, event)` |
| ApiClient 全局未定义 | `isAPIMode = false`，全程本地模式 |

### 10.2 答题状态保护

```javascript
// 防连点标志（_renderQuestion 中初始化）
this.chaosQuestionAnswered = false;

// 选项点击检查（_handleOptionClick 入口）
if (self.chaosQuestionAnswered) return;
self.chaosQuestionAnswered = true;
```

### 10.3 手牌为空的情况

```javascript
// _showSwapResult 中
if (self.playerHand.length === 0) return;

// _showSwapUI 中
if (!aiHand || aiHand.length === 0 || !self.playerHand || self.playerHand.length === 0) {
  self._showSwapResult(aiId, false, fbY);
  return;
}
```

### 10.4 状态恢复

```javascript
// 关闭搞事情 → _destroyChaos()
├─ 销毁所有 chaos 元素
├─ SoundManager.resumeAll()    // 恢复出牌音效
├─ gameState = PLAYER_TURN     // 恢复出牌状态
└─ setStatusText("搞事情结束，继续出牌")
```

### 10.5 气泡队列溢出

```javascript
if (bubbleQueue.length > BUBBLE_QUEUE_MAX) bubbleQueue.shift();
```
队列最多3个任务，超出时丢弃最旧的任务。

### 10.6 其他边界

| 场景 | 处理 |
|------|------|
| 多次快速点击"搞事情"按钮 | `gameState !== PLAYER_TURN` 时 return |
| 答题中玩家手牌变空 | 换牌阶段检查长度，空则跳过 |
| AI 手牌在答题过程中变空 | `_showSwapUI` 时检查，跳转至 `_showSwapResult` |
| 题型选择后快速点击关闭 | `_destroyChaos` 安全销毁所有元素 |
| 换牌过程中关闭 | 跳过换牌直接显示底部按钮 |

---

## 11. 动画参数汇总

| 动画 | 位置/对象 | 参数 |
|------|----------|------|
| 气泡显示 | 台词气泡 | 3.5秒后自动 `destroy`（出牌气泡4~5秒） |
| 换牌消息 | "🔥 交换成功" | 3.5秒后自动 `destroy` |
| 答错消息 | "😈 AI从你手中..." | 3秒后自动 `destroy` |
| 遮罩出现 | overlay | 即时，无渐变动画 |
| 气泡队列调度 | 所有气泡 | 队列中串行处理，上一个销毁再处理下一个 |

---

## 12. 验收测试用例

| # | 测试场景 | 预期结果 | 优先级 |
|---|---------|---------|--------|
| T1 | 点击"搞事情"按钮 | 遮罩出现→题型选择界面 | P0 |
| T2 | 点击关闭按钮 | 完全退出chaos，恢复出牌 | P0 |
| T3 | 选择任意题型 | 销毁题型选择，加载题目 | P0 |
| T4 | 答对题目 | 得分+1，进入换牌界面 | P0 |
| T5 | 答错题目 | 得分不变，AI随机拿牌 | P0 |
| T6 | 换牌操作（答对） | 玩家选牌+AI选牌→确认→交换成功 | P0 |
| T7 | 点击"再来一题" | 换AI出题，可无限循环 | P0 |
| T8 | 点击"关掉回牌" | 完全退出chaos，恢复出牌 | P0 |
| T9 | API 不可用时进入chaos | 使用本地题库，正常完成流程 | P0 |
| T10 | 快速连点选项 | 只响应一次，chaosQuestionAnswered锁定 | P0 |
| T11 | 玩家手牌为0时换牌 | 跳过换牌/取牌，直接显示底部按钮 | P1 |
| T12 | AI 手牌为0时答对换牌 | 跳过`_showSwapUI` | P1 |
| T13 | 多轮"再来一题" | 每次随机换AI，分数累计 | P1 |
| T14 | 气泡队列超过3个 | 丢弃最旧任务，保持队列长度≤3 | P1 |
| T15 | 在CHAOS_MODE时再次点击按钮 | 无响应（状态保护） | P2 |

---

## 13. 相关数据结构

### 13.1 GameScene 新增属性

```javascript
// Chaos mode 属性
this.chaosScore = 0;              // 累计搞事情得分（跨回合持久化）
this.chaosElements = [];          // 所有chaos UI元素引用
this.chaosBubbleElements = [];    // 气泡元素引用
this.chaosOverlay = null;         // 遮罩 Graphics
this.chaosCardBg = null;          // 白色卡片背景
this.chaosTitle = null;           // 标题 Text
this.chaosQText = null;           // 题目 Text（保留兼容）
this.chaosScoreText = null;       // 得分 Text
this.chaosTypeSelection = false;  // 题型选择是否激活
this.chaosQuestionAnswered = false; // 当前题目是否已作答
```

### 13.2 全局变量

```javascript
var bubbleQueue = [];       // 气泡队列
var BUBBLE_QUEUE_MAX = 3;   // 队列最大长度
var bubbleShowing = false;   // 队列是否正在处理
```

---

## 14. 台词池（AI_LINES）

### 王怼怼（毒舌型）

| key | 示例台词 |
|-----|---------|
| correct | "哼，蒙对的吧？" / "这次算你走运。" |
| wrong | "哈哈哈哈哈！果然不出所料！" / "这种题都会选错？你是来斗地主还是来斗笨的？" |
| easy | "送分题，给人类的怜悯。" |
| close | "行吧，回来打牌。" |

### 苏甜甜（可爱型）

| key | 示例台词 |
|-----|---------|
| correct | "哇塞！你真的会！！！" / "太棒啦！你是我见过最聪明的人类！" |
| wrong | "啊啊啊错了！我……裂……开……了……😭" / "不是吧！这简直……好玩！哈哈哈哈哈！" |
| easy | "这道题送你啦！不客气！" |
| close | "回来打牌啦！哈哈哈！" |

完整台词池见 `AI_LINES` 全局对象（~50条台词）。
