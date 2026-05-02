# 斗地主放大优化任务

- **项目**: fight-the-landlord
- **路径**: ~/openclaw/workspaces/fight-the-landlord
- **要修改的文件**:
  - src/client/js/game.js
  - src/server/services/questionTemplates.js
- **6项放大优化**:
  1. 手牌放大 + 交叠 (renderPlayerHand)
  2. 底部按钮放大 (createActionButtons)
  3. 首页元素放大 (createTopBar)
  4. 搞事情框放大到800x380 (_createChaosOverlay)
  5. 调整 _renderQuestion 内选项布局
  6. AI题型匹配 + 去重增强 (llmService.js + questionTemplates.js)
- **状态**: 已写入，等待执行
