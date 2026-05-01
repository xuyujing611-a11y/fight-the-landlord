/**
 * src/server/services/llmService.js
 *
 * 大模型调用服务（对接 MiniMax / DeepSeek）
 *
 * 配置方式（环境变量）:
 *   LLM_PROVIDER="minimax" | "deepseek"
 *   LLM_API_KEY="sk-xxx"
 *   LLM_MODEL="..."  (默认 auto)
 *
 * 当前支持的 provider:
 *   - minimax  : MiniMax 大模型
 *   - deepseek : DeepSeek API
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
    parseBody: (model, content) => ({
      model,
      messages: [
        { role: 'system', content: '你是斗地主AI出牌专家。请根据手牌和局面给出最优出牌建议。仅返回JSON。' },
        { role: 'user', content }
      ],
      temperature: 0.7,
      max_tokens: 500
    }),
    parseResponse: (data) => {
      try {
        const json = JSON.parse(data);
        const text = json.choices?.[0]?.message?.content || '';
        return JSON.parse(cleanJsonString(text));
      } catch (e) {
        throw new Error(`MiniMax parse error: ${e.message}`);
      }
    }
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    parseBody: (model, content) => ({
      model,
      messages: [
        { role: 'system', content: '你是斗地主AI出牌专家。根据手牌和局面选择最优出牌。仅返回JSON。' },
        { role: 'user', content }
      ],
      temperature: 0.7,
      max_tokens: 500,
      stream: false
    }),
    parseResponse: (data) => {
      try {
        const json = JSON.parse(data);
        const text = json.choices?.[0]?.message?.content || '';
        return JSON.parse(cleanJsonString(text));
      } catch (e) {
        throw new Error(`DeepSeek parse error: ${e.message}`);
      }
    }
  }
};

/**
 * 清理 JSON 字符串（去除 markdown 代码块标记）
 */
function cleanJsonString(str) {
  return str
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * 通用 HTTP POST 请求
 */
function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(bodyStr)
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.write(bodyStr);
    req.end();
  });
}

/**
 * 调用大模型出牌决策
 *
 * @param {Array} hand - 手牌 [{suit, rank}]
 * @param {Array|null} lastPlay - 上家出的牌
 * @param {string} difficulty - 'easy'|'normal'|'hard'
 * @returns {Object|null} { cards: [{suit, rank}], explanation: string }
 */
async function callLLMForPlay(hand, lastPlay, difficulty) {
  const providerName = process.env.LLM_PROVIDER || 'minimax';
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    console.warn('LLM_API_KEY not set, skipping LLM call');
    return null;
  }

  const provider = PROVIDERS[providerName];
  if (!provider) {
    throw new Error(`Unknown LLM provider: ${providerName}`);
  }

  const model = process.env.LLM_MODEL || provider.defaultModel;

  // 构建 Prompt
  const handStr = JSON.stringify(hand.map(c => `${c.suit}:${c.rank}`));
  const lastStr = lastPlay ? JSON.stringify(lastPlay.map(c => `${c.suit}:${c.rank}`)) : 'null';

  const prompt = [
    `【斗地主 AI 出牌决策】`,
    `当前手牌: ${handStr}`,
    `上家出的牌: ${lastStr}`,
    `难度: ${difficulty || 'normal'}`,
    ``,
    `请返回以下 JSON 格式（不要多余文字）：`,
    `{`,
    `  "cards": [{ "suit": "spade", "rank": 0 }],  // 要出的牌`,
    `  "explanation": "出牌理由"`,
    `}`
  ].join('\n');

  const body = provider.parseBody(model, prompt);
  const url = provider.baseUrl;
  const headers = provider.headers(apiKey);

  const rawResponse = await httpPost(url, headers, body);
  return provider.parseResponse(rawResponse);
}

module.exports = { callLLMForPlay };
