/**
 * src/server/routes/dialogue.js - AI 台词生成 API
 *
 * POST /api/ai/dialogue
 *
 * Body: {
 *   aiId: 'duidui'|'tiantian',
 *   event: 'play'|'pass'|'bomb'|'win'|'lose'|'taunt',
 *   context: 'description of current game state' (可选)
 * }
 *
 * 用LLM生成一句符合AI性格的台词
 * 王怼怼(duidui): 傲慢毒舌
 * 苏甜甜(tiantian): 元气话痨
 *
 * Response: { line: "...", emotion: "arrogant|happy|sad|angry|taunt" }
 * 失败时 fallback: { line: "...", emotion: "...", source: 'fallback' }
 */

const express = require('express');
const router = express.Router();
const { callLLM } = require('../services/llmService');

// ============================================================
// 默认台词池（LLM失败时fallback）
// ============================================================

const DEFAULT_LINES = {
  duidui: {
    play: ['送分题，给人类的怜悯。', '这题你要是都答不上来……啧。'],
    pass: ['这轮我让你，免得说我欺负人类。', '过，我看看你能憋出什么大招。'],
    bomb: ['🚀 炸弹！建议你直接过牌。', '核弹级题目，你答不对。'],
    win: ['意料之中。人类 vs AI = 0 : ∞', '你的表现我已经写入训练日志，作为反面教材。'],
    lose: ['……你开挂了吧？', '我GPU过热而已，再来！'],
    taunt: ['这一轮又输了？我闭着眼都能赢。', '人类的CPU该升级了。']
  },
  tiantian: {
    play: ['这道题送你啦！不客气！', '热身题！把你的小脑瓜转起来～'],
    pass: ['这轮我让着你！因为我想上厕所。', '过！你是不是松了口气？'],
    bomb: ['💣 BOMBSHELL！全场的目光集中到我身上！', '题目已出，人已跑，评论区等你尖叫🏃💨'],
    win: ['🎉 冠军！冠军！我是冠军！', '我要发朋友圈！我有生以来最辉煌的时刻！'],
    lose: ['我……裂……开……了……😭', '呜呜呜你太厉害了，我演不下去了！'],
    taunt: ['嘿嘿被我抓到了吧！', '这一轮轮到你啦！加油加油～']
  }
};

// 各AI的默认情绪
const DEFAULT_EMOTION = {
  duidui: { play: 'arrogant', pass: 'arrogant', bomb: 'arrogant', win: 'arrogant', lose: 'angry', taunt: 'taunt' },
  tiantian: { play: 'happy', pass: 'happy', bomb: 'happy', win: 'happy', lose: 'sad', taunt: 'taunt' }
};

// ============================================================
// POST /api/ai/dialogue
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { aiId, event, context } = req.body;

    // 参数校验
    const validAiIds = ['duidui', 'tiantian'];
    const validEvents = ['play', 'pass', 'bomb', 'win', 'lose', 'taunt'];

    if (!validAiIds.includes(aiId)) {
      return res.status(400).json({ error: 'aiId must be "duidui" or "tiantian"' });
    }
    if (!validEvents.includes(event)) {
      return res.status(400).json({ error: `event must be one of: ${validEvents.join(', ')}` });
    }

    // 尝试用 LLM 生成
    if (process.env.LLM_API_KEY) {
      try {
        const aiName = aiId === 'duidui' ? '王怼怼' : '苏甜甜';
        const personality = aiId === 'duidui'
          ? '傲慢毒舌的学霸AI，喜欢嘲讽人类'
          : '元气话痨的戏精AI，说话浮夸可爱';

        let emotionHint = '';
        if (event === 'win') emotionHint = '（得意/嚣张）';
        else if (event === 'lose') emotionHint = '（不服/嘴硬或哭唧唧）';
        else if (event === 'bomb') emotionHint = '（兴奋/中二）';
        else if (event === 'taunt') emotionHint = '（挑衅）';
        else if (event === 'pass') emotionHint = '（轻松/得意）';
        else emotionHint = '（正常/自信）';

        const prompt = `你是"AI斗地主"游戏中的AI角色"${aiName}"，性格${personality}。
当前事件: ${event} ${emotionHint}
游戏背景: ${context || '正在游戏中'}
请用中文输出一句符合角色性格的台词。

作业要求：
1. 只输出一行台词文本，不要解释，不要额外文字
2. 台词长度不超过40个字
3. 必须符合角色性格
4. 可以有 emoji`;

        const result = await callLLM(
          `你是一个斗地主游戏AI台词生成器。严格按照用户要求输出台词。只输出一行文本。`,
          prompt,
          { temperature: 0.9, maxTokens: 100 }
        );

        // 处理 LLM 返回（可能为对象或字符串）
        let line = '';
        if (typeof result === 'string') {
          line = result.trim();
        } else if (result && typeof result === 'object') {
          // safeParseJson 可能返回 { rawText: '...' } 或 { line: '...' }
          line = (result.line || result.rawText || result.content || '').trim();
        }

        if (line && line !== '{}' && !line.startsWith('{')) {
          return res.json({
            line,
            emotion: DEFAULT_EMOTION[aiId][event] || 'happy',
            source: 'ai'
          });
        }
      } catch (e) {
        console.warn(`[Dialogue] LLM failed for ${aiId}/${event}:`, e.message);
      }
    }

    // LLM失败 → fallback到默认台词池
    const pool = (DEFAULT_LINES[aiId] && DEFAULT_LINES[aiId][event]) || DEFAULT_LINES.duidui.play;
    const line = pool[Math.floor(Math.random() * pool.length)];
    res.json({
      line,
      emotion: DEFAULT_EMOTION[aiId][event] || 'happy',
      source: 'fallback'
    });

  } catch (err) {
    console.error('[Dialogue] Unexpected error:', err);
    const aiId = req.body?.aiId === 'tiantian' ? 'tiantian' : 'duidui';
    const evt = (req.body?.event && ['play','pass','bomb','win','lose','taunt'].includes(req.body.event))
      ? req.body.event : 'play';
    const fallbackPool = DEFAULT_LINES[aiId][evt] || DEFAULT_LINES.duidui.play;
    res.json({
      line: fallbackPool[Math.floor(Math.random() * fallbackPool.length)],
      emotion: DEFAULT_EMOTION[aiId][evt] || 'happy',
      source: 'error'
    });
  }
});

module.exports = router;
