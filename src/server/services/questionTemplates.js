/**
 * src/server/services/questionTemplates.js
 *
 * 出题 Prompt 引擎 — 实现产品设计文档 Section 3 的四种题型模板。
 *
 * 对接 DeepSeek API 生成题目，客户端只需返回 JSON。
 *
 * 题型:
 *   vocabulary  - 四六级单词 (Section 3.2)
 *   expression  - 口语表达 (Section 3.3)
 *   trivia      - 冷知识 (Section 3.4)
 *   life_hack   - 生活常识 (Section 3.5)
 *   bomb_mixed  - 混合炸弹 (Section 3.6)
 */

const { callLLM } = require('./llmService');

// ============================================================
// Prompt 模板 — 严格按产品设计文档实现
// ============================================================

const PROMPTS = {

  // ---- 3.2 四六级单词 ----
  vocabulary: {
    system: `## Role
你是一个英文四六级词汇出题官。你的任务是为"AI斗地主"游戏出一道英文词汇选择题。

## Requirements
1. 以中文题干 + 英文句子选词填空的形式出题
2. 给出一个包含空缺的英文句子，用 ______ 表示空缺
3. 提供 4 个选项 (A/B/C/D)，其中 1 个正确，3 个干扰项
4. 干扰项必须与正确选项属于同类词性，但意义不同
5. 正确选项是四六级考纲词汇
6. 给出正确选项的中文释义和句子释义

## Output Format (纯 JSON，不要多余文字)
{
  "type": "vocabulary",
  "question": "The professor's lecture was so ______ that half the class fell asleep.",
  "options": { "A": "monotonous", "B": "spontaneous", "C": "simultaneous", "D": "instantaneous" },
  "answer": "A",
  "translation": "教授的讲座如此单调，一半学生都睡着了。",
  "definition": "monotonous: 单调的，毫无变化的",
  "difficulty": "{difficulty}"
}`,
    getUserPrompt: (difficulty) => {
      const labels = { easy: '四级基础 (2000词)，句子8-12词，干扰项明显不同',
        normal: '四级核心 (4000词)，句子12-18词，干扰项有一定混淆',
        hard: '六级核心 (6000词)，句子15-25词，干扰项容易混淆',
        extreme: '六级+考研 (8000+词)，句子20-30词，干扰项极易混淆' };
      return `请生成一道${difficulty}难度的四六级词汇选择题。\n${labels[difficulty] || labels.normal}\n按指定的JSON格式输出，不要多余文字。`;
    }
  },

  // ---- 3.3 口语表达 ----
  expression: {
    system: `## Role
你是一个英文日常口语表达专家。你的任务是为"AI斗地主"游戏出一道地道口语表达选择题。

## Requirements
1. 出一个英文口语/俚语/习语的选择题
2. 题干给出一个日常对话场景 + 包含空缺的英文句子（用 ______ 表示空缺）
3. 4 个选项 (A/B/C/D)，1 个正确地道表达，3 个干扰项
4. 干扰项必须是"看起来像但实际不地道"的错误表达（中国学生常犯错误）

## Output Format (纯 JSON)
{
  "type": "expression",
  "scene": "你和朋友在餐厅吃完饭，朋友问谁买单，你想说'这顿我请'",
  "dialogue": "— 'The bill is on me tonight.' — 'Are you sure?' — 'Yeah, it's my ______.'",
  "options": { "A": "treat", "B": "pay", "C": "turn", "D": "time" },
  "answer": "A",
  "translation": "今晚我请客。— 你确定吗？— 嗯，我请。",
  "explanation": "\"It's my treat\" 是地道表达'我请客'。B \"It's my pay\" 是中式英语；C \"my turn\" 强调'轮到我'而不是请客；D \"my time\" 意思完全不对。",
  "difficulty": "{difficulty}"
}`,
    getUserPrompt: (difficulty) => {
      const desc = { easy: '常见表达，如 "break a leg", "piece of cake"',
        normal: '日常习语，如 "hit the sack", "under the weather"',
        hard: '隐喻表达，如 "ballpark figure", "the elephant in the room"',
        extreme: '冷门地道，如 "throw someone under the bus"' };
      return `请生成一道${difficulty}难度的口语表达选择题。\n${desc[difficulty] || desc.normal}\n按指定的JSON格式输出。`;
    }
  },

  // ---- 3.4 冷知识 ----
  trivia: {
    system: `## Role
你是一个冷知识科普达人。你的任务是为"AI斗地主"游戏出一道意想不到的冷知识选择题。

## Requirements
1. 出题内容必须是"大部分人不知道但并非虚假"的真实冷知识
2. 每个选项要有"看似合理"的迷惑性
3. 避免宗教、政治、敏感历史等内容
4. 冷知识领域建议：动物、人体、科学、历史趣闻、科技冷知识
5. 解析部分要简短有趣（带 emoji 表情优先）

## Output Format (纯 JSON)
{
  "type": "trivia",
  "question": "以下哪个动物永远不会生病（不会得癌症）？",
  "options": { "A": "鲨鱼", "B": "大象", "C": "裸鼹鼠", "D": "乌龟" },
  "answer": "C",
  "explanation": "🧬 裸鼹鼠几乎从不患癌症！它们体内有一种特殊的透明质酸，能阻止癌细胞分裂。",
  "fun_fact": "裸鼹鼠最多能活 30+ 年，比普通老鼠长 10 倍！",
  "difficulty": "{difficulty}"
}`,
    getUserPrompt: (difficulty) => {
      const desc = { easy: '50%+ 人知道，有一个明显错误选项',
        normal: '20-50% 人知道，所有选项都看着像真的',
        hard: '5-20% 人知道，正确答案是最不像真的那个',
        extreme: '<5% 人知道，全是没听过的冷事实' };
      return `请生成一道${difficulty}难度的冷知识选择题。\n${desc[difficulty] || desc.normal}\n按指定的JSON格式输出。`;
    }
  },

  // ---- 3.5 生活常识 ----
  life_hack: {
    system: `## Role
你是一个生活达人/生活百科。你的任务是为"AI斗地主"游戏出一道有趣且实用的生活常识选择题。

## Requirements
1. 出题围绕"日常生活中的实用技巧和常识"
2. 所有选项必须是"有人真的会这样误会"的伪常识
3. 领域范围：厨房技巧、家居妙用、健康误区、服饰打理、数码小技巧
4. 解析必须给出"为什么"，让玩家学到真知识
5. 避免医学诊断类内容

## Output Format (纯 JSON)
{
  "type": "life_hack",
  "question": "以下哪种方法能让切洋葱不流泪？",
  "options": { "A": "把洋葱放冰箱冻30分钟再切", "B": "切的时候嘴里含一口水", "C": "戴泳镜切", "D": "用微波炉加热10秒再切" },
  "answer": "C",
  "explanation": "🕶️ 选C！戴泳镜是最直接的物理方法——阻止催泪气体接触眼睛。A冷冻确实有效但效果有限。B是心理安慰。D反而让气体释放更多。",
  "pro_tip": "如果没泳镜，在抽油烟机旁边切或者把刀放冷水里浸一下也有帮助 👨‍🍳",
  "difficulty": "{difficulty}"
}`,
    getUserPrompt: (difficulty) => {
      const desc = { easy: '人人必备常识，有一个明显错的选项',
        normal: '多数人半懂，有一个好像听过的伪选项',
        hard: '生活达人级别，每个选项都有人试过',
        extreme: '颠覆常识，正确答案和大多数人认为的相反' };
      return `请生成一道${difficulty}难度的生活常识选择题。\n${desc[difficulty] || desc.normal}\n按指定的JSON格式输出。`;
    }
  },

  // ---- 3.6 混合题型炸弹 ----
  bomb_mixed: {
    system: `## Role
你是一个终极出题官。当前是"AI斗地主"游戏的炸弹题模式。
请出一道混合型题目，包含 四六级词汇 + 口语表达 + 冷知识 + 生活常识 中的至少两种元素。

## Requirements
1. 题目要有"跨领域"的意外感
2. 选项必须涵盖两个以上不同领域的知识
3. 解析需要完整拆解每个领域
4. 题目要求比平时更有趣、更出乎意料

## Output Format (纯 JSON)
{
  "type": "bomb_mixed",
  "question": "一个人说 \"I'm feeling under the weather\"，下列哪项是TA最可能正在做的事？",
  "options": { "A": "在沙滩晒太阳", "B": "喝热水吃感冒药", "C": "研究天气预报", "D": "站在树底下躲雨" },
  "answer": "B",
  "explanation": "🌡️ 'Under the weather' 是口语中身体不舒服的意思。\\nA☀️ 生病的人不会去晒太阳。\\nC🌤 'Weather' 容易误导，但这是固定习语。\\nD🌧 站在树下和表达完全无关。\\n\\n🔍 来源推测：过去船员晕船时会到甲板下躲避天气，后来演变为不舒服的意思。",
  "difficulty": "extreme"
}`,
    getUserPrompt: (difficulty) => {
      return `请生成一道炸弹级混合题，难度${difficulty}，至少混合两种题型元素。\n要求更有趣、更出乎意料。按指定的JSON格式输出。`;
    }
  }
};

// ============================================================
// 题型元数据
// ============================================================

const TYPE_META = {
  vocabulary: { label: '📚 四六级单词', desc: '看释义选单词，AI给你出牌',
    difficulties: ['easy', 'normal', 'hard', 'extreme'] },
  expression: { label: '💬 口语表达', desc: '地道俚语习语挑战',
    difficulties: ['easy', 'normal', 'hard', 'extreme'] },
  trivia: { label: '🧠 冷知识', desc: '意想不到的冷知识，和AI斗智斗勇',
    difficulties: ['easy', 'normal', 'hard', 'extreme'] },
  life_hack: { label: '🔧 生活常识', desc: '日常实用技巧，你知道几个？',
    difficulties: ['easy', 'normal', 'hard', 'extreme'] },
  bomb_mixed: { label: '💣 炸弹混合题', desc: '跨领域终极挑战！',
    difficulties: ['hard', 'extreme'] }
};

// ============================================================
// 本地题库（fallback 缓存，API 异常时备用）
// ============================================================

const FALLBACK_QUESTIONS = {
  vocabulary: [
    { type: 'vocabulary', question: 'The ______ of the research was to find a cure for the disease.',
      options: { A: 'purpose', B: 'propose', C: 'purse', D: 'pursuit' }, answer: 'A',
      translation: '这项研究的目的是找到治愈这种疾病的方法。', definition: 'purpose: 目的，意图', difficulty: 'easy' },
    { type: 'vocabulary', question: 'She is ______ to succeed because she works very hard.',
      options: { A: 'likely', B: 'likeable', C: 'likewise', D: 'liking' }, answer: 'A',
      translation: '她很可能会成功，因为她工作非常努力。', definition: 'likely: 可能的', difficulty: 'easy' }
  ],
  expression: [
    { type: 'expression', scene: '朋友考试前很紧张，你想祝他好运',
      dialogue: '— "I\'m so nervous about the exam." — "Don\'t worry, go and ______!"',
      options: { A: 'break a leg', B: 'break a foot', C: 'break an arm', D: 'break your head' },
      answer: 'A', translation: '去吧，祝你好运！',
      explanation: '"Break a leg" 是祝好运的地道表达，源自戏剧界。其他选项都是字面翻译的错误表达。',
      difficulty: 'easy' }
  ],
  trivia: [
    { type: 'trivia', question: '章鱼有几个心脏？',
      options: { A: '1个', B: '2个', C: '3个', D: '4个' }, answer: 'C',
      explanation: '🐙 章鱼有3个心脏！两个负责将血液输送到鳃，一个负责输送到全身。更神奇的是，当章鱼游泳时，负责全身供血的那个心脏会停止跳动。',
      fun_fact: '章鱼的血液是蓝色的，因为含有血蓝蛋白！', difficulty: 'easy' }
  ],
  life_hack: [
    { type: 'life_hack', question: '香蕉皮应该怎么放才能让香蕉保鲜更久？',
      options: { A: '放冰箱冷藏', B: '用保鲜膜包住根部', C: '悬挂放置', D: '和苹果放一起' }, answer: 'B',
      explanation: '🍌 香蕉的根部分泌乙烯气体加速成熟。用保鲜膜包住根部能减少乙烯扩散，延长保鲜期。放冰箱会让皮变黑（但果肉还好）。挂起来只是好看。苹果会释放乙烯加速香蕉成熟。',
      pro_tip: '香蕉买回来先冲洗一下，去除表面催熟剂残留！', difficulty: 'easy' }
  ],
  bomb_mixed: [
    { type: 'bomb_mixed', question: '一个人说 "I\'m feeling under the weather"，下列哪项是TA最可能正在做的事？',
      options: { A: '在沙滩晒太阳', B: '喝热水吃感冒药', C: '研究天气预报', D: '站在树底下躲雨' }, answer: 'B',
      explanation: "🌡️ 'Under the weather' 是口语中身体不舒服的意思。",
      difficulty: 'extreme' }
  ]
};

// ============================================================
// 题目缓存（预生成+复用）
// ============================================================

const questionCache = {};

/**
 * 通过 DeepSeek API 生成题目
 *
 * @param {string} type - 题型: vocabulary|expression|trivia|life_hack|bomb_mixed
 * @param {string} difficulty - easy|normal|hard|extreme
 * @returns {Object} 题目对象
 */
async function generateQuestion(type, difficulty) {
  const template = PROMPTS[type];
  if (!template) throw new Error(`Unknown question type: ${type}`);

  const diff = difficulty || 'normal';
  const systemPrompt = template.system.replace('{difficulty}', diff);
  const userPrompt = template.getUserPrompt(diff);

  try {
    const result = await callLLM(systemPrompt, userPrompt, {
      temperature: 0.85,  // 高一点温度保证创意多样
      maxTokens: 800
    });

    // 补全字段
    result._type = type;
    result._difficulty = diff;
    result._generated = true;
    result._ts = Date.now();

    // 补充缓存：生成的题目放入缓存供后续复用
    const cacheKey = `${type}:${diff}`;
    if (!questionCache[cacheKey]) questionCache[cacheKey] = [];
    if (questionCache[cacheKey].length < 20) {
      questionCache[cacheKey].push(result);
    }

    return result;

  } catch (err) {
    console.warn(`[QuestionTemplates] LLM failed for ${type}/${diff}, using fallback:`, err.message);
    // API 失败时用本地缓存
    const fallback = FALLBACK_QUESTIONS[type];
    if (fallback && fallback.length > 0) {
      const q = fallback[Math.floor(Math.random() * fallback.length)];
      return { ...q, _type: type, _difficulty: diff, _generated: false, _ts: Date.now() };
    }
    throw err;
  }
}

/**
 * 批量生成并缓存题目
 *
 * @param {string} type
 * @param {string} difficulty
 * @param {number} count - 1~10
 * @returns {Array<Object>}
 */
async function generateBatch(type, difficulty, count) {
  const cacheKey = `${type}:${difficulty}`;
  if (!questionCache[cacheKey]) questionCache[cacheKey] = [];

  const results = [];
  const maxGen = Math.max(1, Math.min(count || 1, 10));

  // 先从缓存取
  while (results.length < maxGen && questionCache[cacheKey].length > 0) {
    results.push(questionCache[cacheKey].shift());
  }

  // 不足则生成
  const remaining = maxGen - results.length;
  if (remaining > 0) {
    // 并行生成，但限制并发避免429
    const promises = [];
    for (let i = 0; i < remaining; i++) {
      promises.push(
        generateQuestion(type, difficulty).catch(e => {
          console.error(`Batch gen failed for ${type}#${i}:`, e.message);
          return null;
        })
      );
      // 串行化避免 rate limit
      if (promises.length >= 2) {
        const batch = await Promise.all(promises);
        batch.forEach(q => { if (q) results.push(q); });
        promises.length = 0;
      }
    }
    if (promises.length > 0) {
      const batch = await Promise.all(promises);
      batch.forEach(q => { if (q) results.push(q); });
    }
  }

  return results;
}

/**
 * 预生成题目到缓存（预热）
 */
async function warmupCache() {
  const types = ['vocabulary', 'expression', 'trivia', 'life_hack'];
  const diffs = ['easy', 'normal', 'hard'];
  for (const type of types) {
    for (const diff of diffs) {
      try {
        const q = await generateQuestion(type, diff);
        const key = `${type}:${diff}`;
        if (!questionCache[key]) questionCache[key] = [];
        questionCache[key].push(q);
        console.log(`[Cache] Warmed up ${type}/${diff}`);
      } catch (e) {
        console.warn(`[Cache] Warmup failed ${type}/${diff}:`, e.message);
      }
    }
  }
}

module.exports = {
  generateQuestion,
  generateBatch,
  warmupCache,
  PROMPTS,
  TYPE_META,
  FALLBACK_QUESTIONS
};
