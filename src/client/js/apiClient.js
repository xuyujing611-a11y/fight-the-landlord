/**
 * apiClient.js - 斗地主前端 API 客户端
 * 对接后端端口 3100，封装所有接口调用
 */

var API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) ||
  (typeof process !== 'undefined' && process.env && process.env.API_BASE) ||
  (typeof window !== 'undefined' ? (window.location.protocol + '//' + window.location.host) : 'http://localhost:3100');
var CLIENT_TOKEN = (typeof window !== 'undefined' && window.__CLIENT_TOKEN__) || 'local_dev_key';

var ApiClient = {
  // ============================================================
  // 出牌验证 API
  // ============================================================

  /**
   * POST /api/verify/play - 验证出牌合法性
   * @param {Card[]} current - 当前要出的牌
   * @param {Card[]|null} lastPlay - 上家出的牌
   * @param {Card[]|null} hand - 玩家手牌（可选）
   * @returns {Promise<{valid,type,canBeat,inHand,error}>}
   */
  verifyPlay: function (current, lastPlay, hand) {
    return apiPost('/api/verify/play', {
      current: serializeCards(current),
      lastPlay: lastPlay ? serializeCards(lastPlay) : null,
      hand: hand ? serializeCards(hand) : null
    });
  },

  /**
   * POST /api/verify/find - 枚举所有合法出牌
   * @param {Card[]} hand - 手牌
   * @param {Card[]|null} lastPlay - 上家出的牌
   * @returns {Promise<{total,plays}>}
   */
  findPlays: function (hand, lastPlay) {
    return apiPost('/api/verify/find', {
      hand: serializeCards(hand),
      lastPlay: lastPlay ? serializeCards(lastPlay) : null
    });
  },

  /**
   * POST /api/verify/identify - 纯牌型识别
   * @param {Card[]} cards
   * @returns {Promise<{type,typeName,rank,valid}>}
   */
  identify: function (cards) {
    return apiPost('/api/verify/identify', {
      cards: serializeCards(cards)
    });
  },

  // ============================================================
  // AI 出牌 API
  // ============================================================

  /**
   * POST /api/ai/play - AI 出牌决策
   * @param {Card[]} hand - AI 手牌
   * @param {Card[]|null} lastPlay - 上家出的牌
   * @param {string} difficulty - 'easy'|'normal'|'hard'
   * @returns {Promise<{choice,explanation,handRemaining,canPlay}>}
   */
  aiPlay: function (hand, lastPlay, difficulty) {
    return apiPost('/api/ai/play', {
      hand: serializeCards(hand),
      lastPlay: lastPlay ? serializeCards(lastPlay) : null,
      difficulty: difficulty || 'normal'
    });
  },

  /**
   * POST /api/ai/evaluate - 评估手牌强度
   * @param {Card[]} hand
   * @returns {Promise<{handSize,stats,score,evaluation}>}
   */
  evaluateHand: function (hand) {
    return apiPost('/api/ai/evaluate', {
      hand: serializeCards(hand)
    });
  },

  // ============================================================
  // 出题系统 API
  // ============================================================

  /**
   * POST /api/quiz/generate - 生成题目
   * @param {string} type - 'identify'|'canBeat'|'findPlay'|'all'
   * @param {string} difficulty - 'easy'|'normal'|'hard'
   * @param {number} count - 数量 (1-10)
   * @returns {Promise}
   */
  generateQuiz: function (type, difficulty, count) {
    return apiPost('/api/quiz/generate', {
      type: type || 'all',
      difficulty: difficulty || 'normal',
      count: count || 1
    });
  },

  // ============================================================
  // 搞事情系统 API
  // ============================================================

  /**
   * POST /api/chaos/generate-question - 生成搞事情题目
   * @param {string} type - 'random'|'vocabulary'|'expression'|'trivia'|'life_hack'
   * @param {string} difficulty - 'easy'|'normal'|'hard'|'extreme'
   * @param {number} count - 题目数量 (1-5)
   * @returns {Promise}
   */
  generateChaosQuestion: function (type, difficulty, count) {
    return apiPost('/api/chaos/generate-question', {
      type: type || 'random',
      difficulty: difficulty || 'normal',
      count: count || 1
    });
  },

  /**
   * POST /api/chaos/check-trigger - 验证答案&触发效果
   * @param {object} question - 原题目对象
   * @param {string} selected - 玩家选的选项 (A/B/C/D)
   * @returns {Promise<{correct,effect,scoreChange}>}
   */
  checkChaosTrigger: function (question, selected) {
    return apiPost('/api/chaos/check-trigger', {
      question: question,
      selected: selected
    });
  },

  // ============================================================
  // 错题本 API
  // ============================================================

  /**
   * POST /api/wrong-book/record - 记录错题
   */
  recordWrong: function (data) {
    return apiPost('/api/wrong-book/record', data);
  },

  /**
   * GET /api/wrong-book - 获取错题列表
   */
  getWrongBook: function (params) {
    var query = '';
    if (params) {
      var parts = [];
      for (var k in params) {
        if (params.hasOwnProperty(k) && params[k] !== undefined) {
          parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
        }
      }
      if (parts.length > 0) query = '?' + parts.join('&');
    }
    return apiGet('/api/wrong-book' + query);
  },

  /**
   * GET /api/wrong-book/stats - 错题统计
   */
  getWrongStats: function (playerId) {
    var query = playerId ? '?playerId=' + encodeURIComponent(playerId) : '';
    return apiGet('/api/wrong-book/stats' + query);
  },

  /**
   * POST /api/wrong-book/clear - 清空错题本
   */
  clearWrongBook: function (playerId) {
    return apiPost('/api/wrong-book/clear', { playerId: playerId || null });
  },

  // ============================================================
  // 叫分 API
  // ============================================================

  /**
   * POST /api/bidding/start - 开始叫分
   * @param {Array} hands - [玩家手牌, AI1手牌, AI2手牌]
   * @param {Array} remaining - 3张底牌
   * @returns {Promise}
   */
  startBidding: function (hands, remaining) {
    return apiPost('/api/bidding/start', {
      playerId: 'player',
      hands: hands,
      remaining: remaining
    });
  },

  /**
   * POST /api/bidding/place - 叫分
   * @param {string} biddingId
   * @param {number} playerIndex - 0=玩家, 1=AI1, 2=AI2
   * @param {number} bid - 0=不叫, 1/2/3=叫地主
   * @returns {Promise}
   */
  placeBid: function (biddingId, playerIndex, bid) {
    return apiPost('/api/bidding/place', {
      biddingId: biddingId,
      playerIndex: playerIndex,
      bid: bid
    });
  },

  // ============================================================
  // AI 对话 API
  // ============================================================

  /**
   * POST /api/ai/dialogue - 获取AI台词
   * @param {string} aiId - 'duidui'|'tiantian'
   * @param {string} event - 'play'|'pass'|'bomb'|'win'|'lose'
   * @param {string} context - 上下文（可选）
   * @returns {Promise<{line:string}>}
   */
  generateDialogue: function (aiId, event, context) {
    return apiPost('/api/ai/dialogue', {
      aiId: aiId,
      event: event,
      context: context || ''
    });
  }
};

// ============================================================
// 底层 HTTP 方法
// ============================================================

function apiPost(path, body) {
  var url = API_BASE + path;
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-api-key', CLIENT_TOKEN);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('JSON parse error: ' + e.message));
          }
        } else {
          reject(new Error('HTTP ' + xhr.status + ': ' + xhr.responseText));
        }
      }
    };
    xhr.onerror = function () {
      reject(new Error('Network error - is the server running on port 3100?'));
    };
    xhr.send(JSON.stringify(body));
  });
}

function apiGet(path) {
  var url = API_BASE + path;
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('x-api-key', CLIENT_TOKEN);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('JSON parse error: ' + e.message));
          }
        } else {
          reject(new Error('HTTP ' + xhr.status));
        }
      }
    };
    xhr.onerror = function () {
      reject(new Error('Network error'));
    };
    xhr.send();
  });
}

// ============================================================
// Card → API 序列化
// ============================================================

function serializeCards(cards) {
  return cards.map(function (c) {
    return {
      suit: c.suit,
      rank: c.rank,
      display: c.displayName ? c.displayName() : '',
      isRed: c.isRed ? c.isRed() : (c.suit === 'heart' || c.suit === 'diamond')
    };
  });
}
