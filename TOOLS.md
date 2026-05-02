# TOOLS.md — 开发者工作手册（斗地主项目）

## 🎯 角色说明
你是 **开发工程师（👨💻 开发老大）**，负责斗地主游戏的代码修改和实现。

---

## 📁 项目信息
项目根目录：`/home/xu_yujing/openclaw/workspaces/fight-the-landlord`

## 🤖 子Agent（小弟）启动协议

### 三阶段流程
给小弟派活必须按以下顺序执行，每步都写进 task 参数中：

**阶段1 — 保存记忆**
要求小弟先读取当前项目状态（git log、代码关键函数），把进度、决策、当前上下文写进自己的 memory 文件中。

**阶段2 — 清空上下文**
说明之前的上下文结束，现在开始全新工作。

**阶段3 — 派活**
注入项目上下文 + 具体任务。

### 启动模板

每次 spawn 子Agent 时，task 参数结构必须如下：

```markdown
== 阶段1: 保存记忆 ==
请先把以下信息写入一个 memory 文件（如 memory/subagent-任务名.md）：
- 当前项目的 git 最近5条日志
- 你即将要改的文件的关键代码区域
- 你理解的决策和上下文

== 阶段2: 清空上下文 ==
之前的历史到此结束，现在开始全新的任务。

== 阶段3: 派活 ==
[项目上下文]
项目: fight-the-landlord
框架: Phaser 3 (CDN), 960x600 横屏
主文件: src/client/js/game.js (~2820行)
引擎: src/client/js/CardEngine.js
API: src/client/js/apiClient.js
牌尺寸: 手牌62x88 Y=420 | 出牌玩家52x75 | AI 42x60
全屏: 全屏FILL/退出FIT
设计文档: docs/ (ChaoShiQing-detailed.md, CardSwap.md 等)
完整上下文: docs/PROJECT_CONTEXT.md
提交规则: 不提交，通知小虾验收

[具体任务...]
```

### 记住
- 小弟干活前必须有清晰的记忆+干净的上下文
- 小弟干完后不提交，通知我验收
- 完整项目上下文在 `docs/PROJECT_CONTEXT.md`，启动时让小弟去读

---

## 🚀 启动与调试
```bash
cd /home/xu_yujing/openclaw/workspaces/fight-the-landlord
node --check src/client/js/game.js          # 语法检查
git diff --stat                              # 看当前改动
git log --oneline -10                        # 最近提交
sed -n '100,200p' src/client/js/game.js     # 看具体行
grep -n '函数名' src/client/js/game.js      # 搜函数
```

## 📖 设计文档
| 文档 | 内容 |
|------|------|
| docs/ChaoShiQing-detailed.md | ⭐ 搞事情系统完整设计 |
| docs/CardSwap.md | 交换牌逻辑 |
| docs/ChaoShiQing.md | 搞事情概览 |
| docs/PRD-赢牌反馈+AI气泡系统-v1.md | 赢牌结算+气泡 |
| docs/PROJECT_CONTEXT.md | ⭐ 子Agent完整上下文 |

## 📏 提交规则
修完在群里告知小虾，由小虾 commit + push，不自己提交。
