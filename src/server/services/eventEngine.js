/**
 * src/server/services/eventEngine.js
 *
 * 特殊事件系统 — "搞事情"事件引擎
 *
 * 功能:
 *   1. 基于游戏状态触发随机事件
 *   2. 多个事件类型 (cardSwap, scoreChange, popQuiz, taunt, chaos)
 *   3. 事件条件评估 + 加权随机选择
 *   4. 可配置的触发频率和冷却
 */

const fs = require('fs');
const path = require('path');
const { callLLM } = require('./llmService');

const EVENT_LOG_PATH = path.resolve(__dirname, '../data/eventLog.json');

// ============================================================
// 事件类型定义
// ============================================================

const EVENT_TYPES = {

  // ---- AI 换牌 ----
  cardSwap: {
    id: 'cardSwap',
    label: '🔄 AI换牌',
    desc: 'AI 突然从你手牌中换走一张牌',
    weight: 20,
    minRound: 3,
    cooldown: 3,       // 冷却回合数
    cooldownPerPlayer: {}  // per playerId cooldown
  },

  // ---- 分数奖惩 ----
  scoreDouble: {
    id: 'scoreDouble',
    label: '🔥 得分加倍',
    desc: '下一题得分翻倍！拼了！',
    weight: 15,
    minRound: 1,
    cooldown: 2
  },

  scoreHalve: {
    id: 'scoreHalve',
    label: '❄️ 得分减半',
    desc: '这题得分减半……AI的陷阱！',
    weight: 10,
    minRound: 2,
    cooldown: 3
  },

  // ---- 弹出趣味题目 ----
  popQuiz: {
    id: 'popQuiz',
    label: '💡 附加题！',
    desc: '突然出现的附加题！答对额外加分！',
    weight: 25,
    minRound: 2,
    cooldown: 4
  },

  // ---- AI 嘲讽攻击 ----
  taunt: {
    id: 'taunt',
    label: '😏 AI嘲讽',
    desc: 'AI 开始嘴炮攻击！答对下一题可以反击！',
    weight: 15,
    minRound: 1,
    cooldown: 2
  },

  // ---- 大混乱（全效果） ----
  chaos: {
    id: 'chaos',
    label: '🎲 大混乱',
    desc: '所有规则都变了！随机多重效果！',
    weight: 5,
    minRound: 5,
    cooldown: 6
  },

  // ---- 幸运抽牌 ----
  luckyDraw: {
    id: 'luckyDraw',
    label: '🍀 幸运抽牌',
    desc: '随机抽一张奖励牌！',
    weight: 10,
    minRound: 1,
    cooldown: 3
  }
};

// ============================================================
// 事件条件评估
// ============================================================

/**
 * 检查事件是否满足触发条件
 */
function checkCondition(eventId, gameState, playerHistory) {
  const event = EVENT_TYPES[eventId];
  if (!event) return false;

  const { round, consecutiveCorrect, consecutiveWrong } = gameState;

  // 回合数要求
  if (round < event.minRound) return false;

  // 冷却检查
  const playerId = gameState.playerId || 'default';
  if (!event.cooldownPerPlayer) event.cooldownPerPlayer = {};
  const lastTriggered = event.cooldownPerPlayer[playerId] || 0;
  if (lastTriggered > 0 && round - lastTriggered < event.cooldown) return false;

  // 特殊条件
  switch (eventId) {
    case 'cardSwap':
      return round >= 3 && Math.random() < 0.6;
    case 'scoreDouble':
      return consecutiveCorrect >= 2;  // 连对2次后触发
    case 'scoreHalve':
      return consecutiveWrong >= 2;     // 连错2次后触发
    case 'popQuiz':
      return true;                     // 无条件
    case 'taunt':
      return consecutiveWrong >= 1;    // 答错过就能嘲讽
    case 'chaos':
      return round >= 5 && consecutiveCorrect >= 3;
    case 'luckyDraw':
      return round >= 1;
    default:
      return true;
  }
}

/**
 * 计算事件权重（动态调整）
 */
function getDynamicWeight(eventId, gameState) {
  const base = EVENT_TYPES[eventId]?.weight || 10;
  const { round, consecutiveCorrect, consecutiveWrong } = gameState;

  let modifier = 1.0;

  // 越到后期，越容易触发大事件
  if (round >= 7) modifier *= 1.5;
  if (round >= 9) modifier *= 2.0;

  // 连对时增加正面事件权重
  if (eventId === 'scoreDouble' && consecutiveCorrect >= 2) modifier *= 2.0;
  if (eventId === 'luckyDraw' && consecutiveCorrect >= 3) modifier *= 1.5;

  // 连错时增加负面事件权重
  if (eventId === 'scoreHalve' && consecutiveWrong >= 2) modifier *= 2.0;
  if (eventId === 'taunt' && consecutiveWrong >= 1) modifier *= 1.5;

  return Math.round(base * modifier);
}

// ============================================================
// 事件执行器
// ============================================================

/**
 * 执行一个事件，返回事件结果
 */
function executeEvent(eventId, gameState) {
  const event = EVENT_TYPES[eventId];
  if (!event) return null;

  const playerId = gameState.playerId || 'default';

  // 更新冷却
  event.cooldownPerPlayer[playerId] = gameState.round || 0;

  const result = {
    eventId: event.id,
    eventLabel: event.label,
    eventDesc: event.desc,
    timestamp: new Date().toISOString(),
    round: gameState.round || 0,
    effects: []
  };

  switch (eventId) {
    case 'cardSwap': {
      const swapCount = Math.floor(Math.random() * 2) + 1; // 1-2张
      result.effects.push({
        type: 'swapCards',
        detail: `AI从你的手牌中换走了${swapCount}张牌`,
        count: swapCount,
        aiTaunt: pickTaunt('cardSwap')
      });
      break;
    }
    case 'scoreDouble': {
      result.effects.push({
        type: 'scoreMultiplier',
        detail: '下一题得分 ×2！',
        multiplier: 2,
        duration: 'next_round'
      });
      break;
    }
    case 'scoreHalve': {
      result.effects.push({
        type: 'scoreMultiplier',
        detail: '这题得分 ×0.5...',
        multiplier: 0.5,
        duration: 'this_round'
      });
      break;
    }
    case 'popQuiz': {
      result.effects.push({
        type: 'popQuiz',
        detail: '附加题出现！答对额外 +15 分',
        bonusScore: 15,
        aiTaunt: pickTaunt('popQuiz')
      });
      break;
    }
    case 'taunt': {
      const taunts = ['这题你总该会吧？不会吧不会吧？',
        '我闭着眼都能答对的题，你仔细看看？',
        '建议你直接过牌，真的',
        '人类的CPU又过载了？',
        '这题送分，再错就真的要换个游戏了'];
      result.effects.push({
        type: 'taunt',
        detail: taunts[Math.floor(Math.random() * taunts.length)],
        counterCondition: '答对此题可嘲讽回击'
      });
      break;
    }
    case 'chaos': {
      // 多重效果
      const subEvents = ['cardSwap', 'popQuiz', 'scoreDouble'];
      const selected = subEvents.sort(() => Math.random() - 0.5).slice(0, 2);
      result.effects.push({
        type: 'chaosMulti',
        detail: `🎉 大混乱！触发: ${selected.map(s => EVENT_TYPES[s].label).join(' + ')}`,
        subEvents: selected
      });
      break;
    }
    case 'luckyDraw': {
      const bonus = Math.floor(Math.random() * 20) + 5; // 5-25分
      result.effects.push({
        type: 'bonusScore',
        detail: `🎁 幸运抽牌！获得 ${bonus} 分奖励！`,
        score: bonus
      });
      break;
    }
  }

  return result;
}

// ============================================================
// 事件选择器 - 加权随机选事件
// ============================================================

/**
 * 从可用事件中按权重随机选一个
 * @param {Object} gameState - { round, consecutiveCorrect, consecutiveWrong, playerId }
 * @returns {Object|null} 事件结果
 */
function pickEvent(gameState) {
  const candidates = [];

  for (const [id, event] of Object.entries(EVENT_TYPES)) {
    if (checkCondition(id, gameState)) {
      const weight = getDynamicWeight(id, gameState);
      for (let i = 0; i < weight; i++) {
        candidates.push(id);
      }
    }
  }

  if (candidates.length === 0) return null;

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const result = executeEvent(pick, gameState);

  // 记录到日志
  logEvent(result, gameState);

  return result;
}

// ============================================================
// 台词池
// ============================================================

function pickTaunt(scene) {
  const taunts = {
    cardSwap: [
      '这张牌你留着浪费了，我帮你保管 😏',
      '拿来吧你！这题你配不上',
      '我换走一张，免得你太难选',
      '好牌当然要给懂的人——比如我'
    ],
    popQuiz: [
      '加试时间到！别怪我没提醒你',
      '附加题！答对加鸡腿 🍗',
      'Surprise！你最喜欢的不定时测验'
    ]
  };
  const pool = taunts[scene] || ['嘿嘿，没想到吧'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================
// 事件日志（文件持久化）
// ============================================================

function ensureLogFile() {
  const dir = path.dirname(EVENT_LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(EVENT_LOG_PATH)) fs.writeFileSync(EVENT_LOG_PATH, '[]');
}

function readEventLog() {
  ensureLogFile();
  try {
    const raw = fs.readFileSync(EVENT_LOG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeEventLog(logs) {
  ensureLogFile();
  fs.writeFileSync(EVENT_LOG_PATH, JSON.stringify(logs, null, 2));
}

function logEvent(eventResult, gameState) {
  if (!eventResult) return;
  const logs = readEventLog();
  logs.push({
    ...eventResult,
    playerId: gameState.playerId || 'anonymous',
    gameId: gameState.gameId || 'unknown'
  });
  // 只保留最近500条
  if (logs.length > 500) logs.splice(0, logs.length - 500);
  writeEventLog(logs);
}

function getEventLogs(filter) {
  let logs = readEventLog();
  if (filter?.eventId) logs = logs.filter(l => l.eventId === filter.eventId);
  if (filter?.playerId) logs = logs.filter(l => l.playerId === filter.playerId);
  if (filter?.gameId) logs = logs.filter(l => l.gameId === filter.gameId);
  if (filter?.limit) logs = logs.slice(0, filter.limit);
  return logs;
}

function getEventStats() {
  const logs = readEventLog();
  const byType = {};
  const byRound = {};
  for (const l of logs) {
    byType[l.eventId] = (byType[l.eventId] || 0) + 1;
    const r = l.round || 0;
    byRound[r] = (byRound[r] || 0) + 1;
  }
  return {
    total: logs.length,
    byType,
    byRound
  };
}

// ============================================================
// 事件列表查询
// ============================================================

function getEventCatalog() {
  return Object.entries(EVENT_TYPES).map(([id, e]) => ({
    id,
    label: e.label,
    desc: e.desc,
    weight: e.weight,
    minRound: e.minRound,
    cooldown: e.cooldown
  }));
}

module.exports = {
  EVENT_TYPES,
  pickEvent,
  executeEvent,
  checkCondition,
  getEventLogs,
  getEventStats,
  getEventCatalog,
  logEvent
};
