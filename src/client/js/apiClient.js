/**
 * apiClient.js - 斗地主前端 API 客户端
 * 对接后端端口 3100，封装所有接口调用
 */

var API_BASE = 'http://localhost:3100';

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
