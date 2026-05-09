/**
 * src/server/services/llmService.js
 *
 * 大模型调用服务（对接 DeepSeek / MiniMax）
 *
 * 配置方式（环境变量）:
 *   LLM_PROVIDER="minimax" | "deepseek"   (默认 deepseek)
 *   LLM_API_KEY="sk-xxx"
 *   LLM_MODEL="..."  (默认 auto)
 *
 * 导出:
 *   callLLM(systemPrompt, userPrompt, opts) - 通用调用
 *   callLLMForPlay(hand, lastPlay, difficulty) - 出牌决策（向后兼容）
 */

const https = require('https');

const PROVIDERS = {
  minimax: {
    baseUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    defaultModel: 'MiniMax-Text-01',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    parseBody: (model, messages, opts) => ({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 500
    }),
    parseResponse: (data) => {
      const json = JSON.parse(data);
      const text = json.choices?.[0]?.message?.content || '';
      return safeParseJson(cleanJsonString(text));
    }
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    parseBody: (model, messages, opts) => ({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 1000,
      stream: false
    }),
    parseResponse: (data) => {
      const json = JSON.parse(data);
      const text = json.choices?.[0]?.message?.content || '';
      return safeParseJson(cleanJsonString(text));
    }
  }
};

/** 清理 JSON 字符串（去除 markdown 代码块标记） */
function cleanJsonString(str) {
  return str
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/** 安全 JSON 解析，解析失败时返回包含 rawText 的 fallback 对象 */
function safeParseJson(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn('[LLM] JSON parse failed, raw text:', str.slice(0, 200));
    return { error: 'JSON_PARSE_ERROR', rawText: str.slice(0, 500), _parseError: e.message };
  }
}

/** 通用 HTTP POST 请求 */
// 熔断器
let llmFailCount = 0;
let llmLastFailTime = 0;
const LLM_CIRCUIT_THRESHOLD = 3;
const LLM_CIRCUIT_COOLDOWN = 30000; // 30秒

function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) },
      timeout: 8000
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString();
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(bodyStr);
    req.end();
  });
}

/**
 * 通用大模型调用
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userPrompt   - 用户消息
 * @param {Object} [opts]
 * @param {number}  [opts.temperature=0.7]
 * @param {number}  [opts.maxTokens=1000]
 * @param {string}  [opts.model]
 * @returns {Object} 解析后的 JSON 对象
 */
async function callLLM(systemPrompt, userPrompt, opts) {
  const providerName = process.env.LLM_PROVIDER || 'deepseek';

  // 熔断检查
  if (llmFailCount >= LLM_CIRCUIT_THRESHOLD) {
    if (Date.now() - llmLastFailTime < LLM_CIRCUIT_COOLDOWN) {
      throw new Error('LLM circuit breaker open, cooling down');
    }
    llmFailCount = 0;
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY not set');

  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`Unknown provider: ${providerName}`);

  const model = opts?.model || process.env.LLM_MODEL || provider.defaultModel;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
  const safeOpts = {
    temperature: opts?.temperature ?? 0.7,
    maxTokens: opts?.maxTokens ?? 1000
  };
  const body = provider.parseBody(model, messages, safeOpts);
  try {
    const raw = await httpPost(provider.baseUrl, provider.headers(apiKey), body);
    llmFailCount = 0; // 成功时重置
    return provider.parseResponse(raw);
  } catch (e) {
    llmFailCount++;
    llmLastFailTime = Date.now();
    throw e;
  }
}

/**
 * 调用大模型出牌决策（向后兼容）
 * @param {Array} hand - 手牌
 * @param {Array|null} lastPlay - 上家出的牌
 * @param {string} difficulty
 * @returns {Object|null}
 */
async function callLLMForPlay(hand, lastPlay, difficulty) {
  const handStr = JSON.stringify(hand.map(c => `${c.suit}:${c.rank}`));
  const lastStr = lastPlay ? JSON.stringify(lastPlay.map(c => `${c.suit}:${c.rank}`)) : 'null';
  const prompt = [
    '【斗地主 AI 出牌决策】',
    `当前手牌: ${handStr}`,
    `上家出的牌: ${lastStr}`,
    `难度: ${difficulty || 'normal'}`,
    '',
    '=== 大师级策略指引 ===',
    '1. 手牌审视：先分析手牌结构（单张、对子、三张、顺子、炸弹），评估整体牌力',
    '2. 先手原则：如果你是先手（lastPlay=null），优先出中等牌力的牌，保留炸弹/大牌控场',
    '3. 压制策略：上家出牌时，能用刚好大的牌压就不浪费更大牌；判断能否控场再决定是否压制',
    '4. 底牌控制：如果你是地主，考虑3张底牌的优势；如果你是农民，配合队友压制地主',
    '5. CoT推理：先分析局面在脑中推理，再给出最终出牌',
    '',
    '请返回以下 JSON 格式（不要多余文字）：',
    '{',
    '  "cards": [{ "suit": "spade", "rank": 0 }],',
    '  "explanation": "出牌理由"',
    '}'
  ].join('\n');
  try {
    return await callLLM(
      '你是斗地主AI出牌专家。请根据手牌和局面给出最优出牌建议。仅返回JSON。',
      prompt,
      { temperature: 0.6, maxTokens: 600 }
    );
  } catch (e) {
    console.warn('LLM call failed:', e.message);
    return null;
  }
}

module.exports = { callLLM, callLLMForPlay };
