/**
 * src/server/routes/wrongbook.js - 错题本 API
 *
 * POST /api/wrong-book/record  - 记录错题
 * GET  /api/wrong-book         - 获取错题列表
 * GET  /api/wrong-book/stats   - 错题统计
 * POST /api/wrong-book/clear   - 清空错题本
 *
 * 使用文件持久化存储，重启不丢失。
 * 数据保存在 src/server/data/wrongbook.json
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_FILE = path.resolve(__dirname, '../data/wrongbook.json');
const MAX_RECORDS = 500;

/** 从磁盘加载错题本 */
function loadWrongBook() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (e) {
    console.warn('[WrongBook] Failed to load data file, starting fresh:', e.message);
  }
  return [];
}

/** 写入磁盘 */
function saveWrongBook(records) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(records), 'utf8');
  } catch (e) {
    console.error('[WrongBook] Failed to save data file:', e.message);
  }
}

// 启动时加载
const WRONG_BOOK = loadWrongBook();

// ============================================================
// POST /api/wrong-book/record - 记录错题
//
// Body: {
//   questionType: string,    // 题型: 'identify'|'canBeat'|'findPlay'
//   question: string,        // 题目描述
//   userAnswer: any,         // 用户回答
//   correctAnswer: any,      // 正确答案
//   difficulty: string,      // 'easy'|'normal'|'hard'
//   cards?: object,          // 相关牌面数据
//   playerId?: string        // 玩家标识（后续用于多用户）
// }
// ============================================================
router.post('/record', (req, res) => {
  try {
    const { questionType, question, userAnswer, correctAnswer, difficulty, cards, playerId } = req.body;

    // 参数校验
    if (!questionType || !question || userAnswer === undefined || correctAnswer === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: questionType, question, userAnswer, correctAnswer'
      });
    }

    const record = {
      id: `wrong_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      questionType,
      question,
      userAnswer,
      correctAnswer,
      difficulty: difficulty || 'normal',
      cards: cards || null,
      playerId: playerId || 'anonymous',
      isCorrect: JSON.stringify(userAnswer) === JSON.stringify(correctAnswer),
      timestamp: new Date().toISOString()
    };

    // 只在答错时记录
    if (!record.isCorrect) {
      WRONG_BOOK.unshift(record);

      // 限制最大记录数
      if (WRONG_BOOK.length > MAX_RECORDS) {
        WRONG_BOOK.length = MAX_RECORDS;
      }

      // 持久化到磁盘
      saveWrongBook(WRONG_BOOK);
    }

    res.json({
      success: true,
      isCorrect: record.isCorrect,
      recordId: record.id,
      wrongBookSize: WRONG_BOOK.length
    });

  } catch (err) {
    console.error('Wrong book record error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GET /api/wrong-book - 获取错题列表
//
// Query params:
//   type: 筛选题型
//   limit: 返回条数 (默认20, 最大100)
//   offset: 偏移 (默认0)
// ============================================================
router.get('/', (req, res) => {
  const { type, limit, offset, playerId } = req.query;

  let filtered = WRONG_BOOK;

  if (type) {
    filtered = filtered.filter(r => r.questionType === type);
  }

  if (playerId) {
    filtered = filtered.filter(r => r.playerId === playerId);
  }

  const off = Math.max(0, parseInt(offset) || 0);
  const lim = Math.min(Math.max(1, parseInt(limit) || 20), 100);

  res.json({
    total: filtered.length,
    offset: off,
    limit: lim,
    records: filtered.slice(off, off + lim)
  });
});

// ============================================================
// GET /api/wrong-book/stats - 错题统计
// ============================================================
router.get('/stats', (req, res) => {
  const { playerId } = req.query;

  let records = WRONG_BOOK;
  if (playerId) {
    records = records.filter(r => r.playerId === playerId);
  }

  // 按题型统计
  const byType = {};
  const byDifficulty = { easy: 0, normal: 0, hard: 0 };

  for (const r of records) {
    byType[r.questionType] = (byType[r.questionType] || 0) + 1;
    if (byDifficulty[r.difficulty] !== undefined) {
      byDifficulty[r.difficulty]++;
    }
  }

  // 获取最新的错题
  const recent = records.slice(0, 5);

  // 找出高频错误题型
  const topErrorTypes = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  res.json({
    total: records.length,
    byQuestionType: byType,
    byDifficulty,
    topErrorTypes: topErrorTypes.map(([type, count]) => ({ type, count })),
    recentErrors: recent.map(r => ({
      id: r.id,
      questionType: r.questionType,
      question: r.question,
      difficulty: r.difficulty,
      timestamp: r.timestamp
    }))
  });
});

// ============================================================
// POST /api/wrong-book/clear - 清空错题本
// ============================================================
router.post('/clear', (req, res) => {
  const { playerId } = req.body;

  if (playerId) {
    // 按玩家清空
    const before = WRONG_BOOK.length;
    let i = WRONG_BOOK.length;
    while (i--) {
      if (WRONG_BOOK[i].playerId === playerId) {
        WRONG_BOOK.splice(i, 1);
      }
    }
    saveWrongBook(WRONG_BOOK);
    res.json({ cleared: before - WRONG_BOOK.length, message: `Cleared records for ${playerId}` });
  } else {
    // 全量清空
    const before = WRONG_BOOK.length;
    WRONG_BOOK.length = 0;
    saveWrongBook(WRONG_BOOK);
    res.json({ cleared: before, message: 'All wrong book records cleared' });
  }
});

module.exports = router;
