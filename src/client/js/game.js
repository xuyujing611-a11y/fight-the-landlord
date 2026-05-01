/**
 * game.js - 斗地主 Phaser 3 主游戏
 * 375x812 手机竖屏布局
 * 依赖: Phaser 3 CDN + CardEngine.js + apiClient.js
 */

// ================================================================
// Phaser 配置
// ================================================================
var GAME_STATE = {
  INIT: 'INIT',
  PLAYER_TURN: 'PLAYER_TURN',
  VALIDATING: 'VALIDATING',
  WAITING_AI: 'WAITING_AI',
  ROUND_END: 'ROUND_END'
};

var GameConfig = {
  type: Phaser.AUTO,
  width: 375,
  height: 812,
  parent: 'game-container',
  backgroundColor: '#1B5E20',
  dom: { createContainer: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GameScene]
};

var game = new Phaser.Game(GameConfig);

// ================================================================
// 工具函数
// ================================================================
function createCircleTexture(scene, key, radius, color, strokeColor, strokeWidth) {
  strokeWidth = strokeWidth || 0;
  var g = scene.make.graphics({ add: false });
  if (strokeWidth > 0) {
    g.fillStyle(strokeColor || 0xFFFFFF, 1);
    g.fillCircle(radius + strokeWidth, radius + strokeWidth, radius + strokeWidth);
  }
  g.fillStyle(color, 1);
  g.fillCircle(radius, radius, radius);
  g.generateTexture(key, radius * 2, radius * 2);
  g.destroy();
}

// ================================================================
// GameScene
// ================================================================
function GameScene() {
  Phaser.Scene.call(this, { key: 'GameScene' });
  this.selectedCards = [];
  this.handCards = [];
  this.playerHand = [];
  this.cardDomElements = [];
  this.domContainer = null;
  this.gameState = GAME_STATE.INIT;
  this.lastPlay = null;
  this.lastPlayInfo = null;
  this.lastPlayPlayer = null;
  this.passCount = 0;
  this.isAPIMode = true;
  this.round = 1;
  this.maxRounds = 10;
}

GameScene.prototype = Object.create(Phaser.Scene.prototype);
GameScene.prototype.constructor = GameScene;

GameScene.prototype.init = function () {
  var deck = new Doudizhu.Deck();
  deck.shuffle();
  var dealResult = deck.deal(3, 17);
  this.playerHand = Doudizhu.sortCards(dealResult.hands[0]);
  this.ai1Hand = dealResult.hands[1];
  this.ai2Hand = dealResult.hands[2];
  this.remainingCards = dealResult.remaining;
  this.selectedCards = [];
  this.gameState = GAME_STATE.PLAYER_TURN;
  this.lastPlay = null;
  this.lastPlayInfo = null;
  this.lastPlayPlayer = null;
  this.passCount = 0;
};

GameScene.prototype.preload = function () {};

GameScene.prototype.create = function () {
  var self = this;
  drawTableBackground(this);
  createTopBar(this);
  createAIArea(this);
  createPlayArea(this);
  createHandArea(this);
  createActionButtons(this);

  this.domContainer = this.add.dom(0, 0).setOrigin(0, 0).setDepth(100);
  this.renderPlayerHand();
  this.setStatusText('\u8F6E\u5230\u4F60\u51FA\u724C\uFF08\u81EA\u7531\u51FA\u724C\uFF09');

  this.time.delayedCall(500, function () {
    self.checkAPIConnection();
  });
};

// ================================================================
// 背景
// ================================================================
function drawTableBackground(scene) {
  var W = 375, H = 812;
  var bg = scene.add.graphics();
  bg.fillGradientStyle(0x1B5E20, 0x1B5E20, 0x0D3B0F, 0x0D3B0F, 1);
  bg.fillRect(0, 0, W, H);
  var glow = scene.add.graphics();
  glow.fillStyle(0x2E7D32, 0.15);
  glow.fillEllipse(W / 2, H / 2 - 40, 320, 480);
  glow.fillStyle(0x388E3C, 0.1);
  glow.fillEllipse(W / 2, H / 2 - 40, 240, 360);
  var border = scene.add.graphics();
  border.lineStyle(2, 0x4CAF50, 0.3);
  border.strokeRoundedRect(8, 60, W - 16, H - 110, 12);
  var diamond = scene.add.graphics();
  diamond.lineStyle(1, 0x66BB6A, 0.15);
  var cx = W / 2, cy = H / 2 - 40;
  diamond.strokeRect(cx - 50, cy - 70, 100, 140);
  diamond.strokeRect(cx - 30, cy - 50, 60, 100);
}

// ================================================================
// 顶部状态栏
// ================================================================
function createTopBar(scene) {
  scene.roundText = scene.add.text(16, 12, '\u7B2C 1/10 \u56DE\u5408', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '14px', color: '#E8F5E9', fontStyle: 'bold'
  }).setDepth(10);

  // status text (center)
  scene.statusText = scene.add.text(187, 26, '', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '11px', color: '#A5D6A7'
  }).setOrigin(0.5).setDepth(10);

  var line = scene.add.graphics();
  line.lineStyle(1, 0x66BB6A, 0.2);
  line.lineBetween(0, 44, 375, 44);
  line.setDepth(10);
}

// ================================================================
// AI 区域
// ================================================================
function createAIArea(scene) {
  createCircleTexture(scene, 'ai1_avatar', 24, 0xFF6B35, 0xFFFFFF, 2);
  var ai1Shadow = scene.add.graphics();
  ai1Shadow.fillStyle(0x000000, 0.2);
  ai1Shadow.fillCircle(50, 77, 26).setDepth(10);
  scene.add.image(48, 74, 'ai1_avatar').setDepth(11);
  scene.add.text(78, 62, '\u738B\u603C\u603C', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '13px', color: '#FFFFFF', fontStyle: 'bold'
  }).setDepth(11);
  scene.ai1Count = scene.add.text(78, 80, '\u5269\u4F59 17 \u5F20', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '11px', color: '#A5D6A7'
  }).setDepth(11);

  createCircleTexture(scene, 'ai2_avatar', 24, 0x7C4DFF, 0xFFFFFF, 2);
  var ai2Shadow = scene.add.graphics();
  ai2Shadow.fillStyle(0x000000, 0.2);
  ai2Shadow.fillCircle(327, 77, 26).setDepth(10);
  scene.add.image(325, 74, 'ai2_avatar').setDepth(11);
  scene.add.text(248, 62, '\u82CF\u751C\u751C', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '13px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(1, 0).setDepth(11);
  scene.ai2Count = scene.add.text(248, 80, '\u5269\u4F59 17 \u5F20', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '11px', color: '#A5D6A7'
  }).setOrigin(1, 0).setDepth(11);

  scene.add.text(187, 72, 'VS', {
    fontFamily: '"Arial",sans-serif', fontSize: '11px', color: '#66BB6A', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(11);

  var divider = scene.add.graphics();
  divider.lineStyle(1, 0x66BB6A, 0.1);
  divider.lineBetween(0, 110, 375, 110).setDepth(10);
}

// ================================================================
// 中央出牌区
// ================================================================
function createPlayArea(scene) {
  var cx = 187;
  var playBg = scene.add.graphics();
  playBg.fillStyle(0x000000, 0.1);
  playBg.fillRoundedRect(20, 120, 335, 260, 12).setDepth(10);

  scene.add.text(cx, 250, '\u51FA\u724C\u533A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '12px', color: '#66BB6A', alpha: 0.4
  }).setOrigin(0.5).setDepth(11);

  scene.ai1PlayLabel = scene.add.text(50, 130, 'AI1:', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#A5D6A7'
  }).setDepth(11);
  scene.ai1PlayCards = scene.add.dom(50, 150).setOrigin(0, 0).setDepth(11);

  scene.ai2PlayLabel = scene.add.text(280, 130, 'AI2:', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#A5D6A7'
  }).setDepth(11);
  scene.ai2PlayCards = scene.add.dom(280, 150).setOrigin(0, 0).setDepth(11);

  scene.myPlayLabel = scene.add.text(cx, 310, '\u4F60\u7684\u51FA\u724C', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#A5D6A7'
  }).setOrigin(0.5).setDepth(11);
  scene.myPlayCards = scene.add.dom(cx, 335).setOrigin(0.5, 0).setDepth(11);

  scene.add.text(10, 355, '\u5E95\u724C: ? ? ?', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '9px', color: '#66BB6A', alpha: 0.4
  }).setDepth(11);
}

// ================================================================
// 手牌区
// ================================================================
function createHandArea(scene) {
  var handBg = scene.add.graphics();
  handBg.fillStyle(0x000000, 0.15);
  handBg.fillRoundedRect(4, 510, 367, 160, 12).setDepth(10);
  scene.add.text(16, 514, '\u4F60\u7684\u624B\u724C', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '11px', color: '#A5D6A7'
  }).setDepth(11);
}

GameScene.prototype.renderPlayerHand = function () {
  var self = this;
  var hand = this.playerHand;
  if (!hand || hand.length === 0) return;
  for (var i = 0; i < this.cardDomElements.length; i++) {
    if (this.cardDomElements[i]) this.cardDomElements[i].destroy();
  }
  this.cardDomElements = [];
  this.handCards = [];

  var n = hand.length, cw = 40, ch = 58;
  var overlap = n > 6 ? Math.min(14, (320 - cw) / (n - 1)) : 28;
  var totalWidth = cw + (n - 1) * overlap;
  var startX = (375 - totalWidth) / 2;
  var baseY = 592;

  for (var i = 0; i < n; i++) {
    var card = hand[i];
    var cx = startX + i * overlap + cw / 2;
    var arcOffset = Math.pow((i / (n - 1)) - 0.5, 2) * 28;
    var cy = baseY - arcOffset;
    var isRed = card.isRed ? card.isRed() : (card.suit === 'heart' || card.suit === 'diamond' || card.rank === 14);
    var clr = isRed ? '#E53935' : '#212121';
    var display = card.displayName ? card.displayName() : Doudizhu.RANK_NAME_MAP[card.rank];
    var symbol = card.suitSymbol ? card.suitSymbol() : Doudizhu.SUIT_SYMBOLS[card.suit];

    var g = self.add.graphics().setDepth(110);
    g.fillStyle(0xFFFFFF, 1);
    g.fillRoundedRect(cx - cw/2, cy - ch/2, cw, ch, 4);
    g.lineStyle(1, 0x90A4AE, 1);
    g.strokeRoundedRect(cx - cw/2, cy - ch/2, cw, ch, 4);

    var txtRank = self.add.text(cx - cw/2 + 3, cy - ch/2 + 2, display, {
      fontFamily: 'Arial', fontSize: '11px', color: clr, fontStyle: 'bold'
    }).setOrigin(0, 0).setDepth(111);

    var txtSuit = self.add.text(cx, cy - 2, symbol, {
      fontFamily: 'Arial', fontSize: '20px', color: clr
    }).setOrigin(0.5, 0.5).setDepth(111);

    var txtRank2 = self.add.text(cx + cw/2 - 3, cy + ch/2 - 2, display, {
      fontFamily: 'Arial', fontSize: '11px', color: clr, fontStyle: 'bold'
    }).setOrigin(1, 1).setDepth(111);
    txtRank2.setAngle(180);

    var hitZone = self.add.zone(cx, cy, cw, ch).setInteractive().setDepth(112);
    hitZone.setData('cardIdx', i);
    hitZone.setData('card', card);
    hitZone.setData('selected', false);
    hitZone.setData('bg', g);
    hitZone.setData('txtRank', txtRank);
    hitZone.setData('txtSuit', txtSuit);
    hitZone.setData('txtRank2', txtRank2);
    hitZone.setData('origY', cy);

    hitZone.on('pointerdown', function () {
      if (self.gameState !== GAME_STATE.PLAYER_TURN) {
        showToast(self, '\u73B0\u5728\u4E0D\u662F\u4F60\u7684\u51FA\u724C\u9636\u6BB5');
        return;
      }
      var idx2 = this.getData('cardIdx');
      var s = this.getData('selected');
      var bg = this.getData('bg');
      if (s) {
        bg.clear();
        bg.fillStyle(0xFFFFFF, 1);
        bg.fillRoundedRect(cx - cw/2, cy - ch/2, cw, ch, 4);
        bg.lineStyle(1, 0x90A4AE, 1);
        bg.strokeRoundedRect(cx - cw/2, cy - ch/2, cw, ch, 4);
        this.y += 20;
        this.setData('selected', false);
        var pos = self.selectedCards.indexOf(idx2);
        if (pos >= 0) self.selectedCards.splice(pos, 1);
      } else {
        bg.clear();
        bg.fillStyle(0xFFFFFF, 1);
        bg.fillRoundedRect(cx - cw/2, cy - ch/2, cw, ch, 4);
        bg.lineStyle(2, 0x4ECDC4, 1);
        bg.strokeRoundedRect(cx - cw/2, cy - ch/2, cw, ch, 4);
        this.y -= 20;
        this.setData('selected', true);
        self.selectedCards.push(idx2);
      }
    });

    this.cardDomElements.push(hitZone);
    this.handCards.push(hitZone);
  }
};

// ================================================================
// 卡牌选中/取消辅助方法
// ================================================================

GameScene.prototype._clearCardSelection = function () {
  var n = this.playerHand.length;
  var cardWidth = 44;
  var baseY = 590;
  for (var i = 0; i < this.cardDomElements.length; i++) {
    var el = this.cardDomElements[i];
    var cardNode = el.node && el.node.firstElementChild;
    if (cardNode) cardNode.classList.remove('ddz-card-selected');
    el.setData('selected', false);
    if (n > 0) {
      var overlap = n > 6 ? Math.min(16, (315 - cardWidth) / (n - 1)) : 30;
      var arcOffset = Math.pow((i / Math.max(1, n - 1)) - 0.5, 2) * 32;
      el.setY(baseY - arcOffset);
    }
  }
};

GameScene.prototype._highlightCard = function (el) {
  el.setData('selected', true);
  el.setY(el.y - 20);
  var cardNode = el.node && el.node.firstElementChild;
  if (cardNode) cardNode.classList.add('ddz-card-selected');
};

// ================================================================
// API 连接 & 游戏逻辑
// ================================================================

GameScene.prototype.setStatusText = function (text) {
  if (this.statusText) this.statusText.setText(text);
};

GameScene.prototype.checkAPIConnection = function () {
  var self = this;
  if (typeof ApiClient === 'undefined') {
    console.warn('ApiClient not loaded, using local mode');
    self.isAPIMode = false;
    return;
  }
  ApiClient.identify([new Doudizhu.Card('spade', 0)])
    .then(function () {
      console.log('API OK, using API mode');
      self.isAPIMode = true;
      self.setStatusText('\u8FDE\u63A5\u670D\u52A1\u5668\u6210\u529F');
    })
    .catch(function (err) {
      console.warn('API unavailable, using local mode:', err.message);
      self.isAPIMode = false;
      self.setStatusText('\u672C\u5730\u6A21\u5F0F\uFF08\u672A\u68C0\u6D4B\u5230\u540E\u7AEF\uFF09');
    });
};

GameScene.prototype.doPlayerPlay = function () {
  var self = this;
  if (self.gameState !== GAME_STATE.PLAYER_TURN) {
    showToast(self, '\u73B0\u5728\u4E0D\u662F\u4F60\u7684\u51FA\u724C\u9636\u6BB5');
    return;
  }
  if (this.selectedCards.length === 0) {
    showToast(this, '\u8BF7\u5148\u9009\u62E9\u624B\u724C');
    return;
  }
  var playCards = this.selectedCards.map(function (idx) { return self.playerHand[idx]; });
  var info = Doudizhu.identifyType(playCards);
  if (info.type === Doudizhu.HAND_TYPES.INVALID) {
    showToast(this, '\u975E\u6CD5\u724C\u578B\u7EC4\u5408');
    return;
  }
  if (this.lastPlay && this.lastPlay.length > 0) {
    if (!Doudizhu.canBeat(playCards, this.lastPlay)) {
      showToast(this, '\u4E0D\u80FD\u538B\u8FC7\u4E0A\u5BB6\u7684\u724C');
      return;
    }
  }

  this.gameState = GAME_STATE.VALIDATING;
  this.setStatusText('\u9A8C\u8BC1\u4E2D...');

  if (this.isAPIMode && typeof ApiClient !== 'undefined') {
    ApiClient.verifyPlay(playCards, this.lastPlay, this.playerHand)
      .then(function (res) {
        if (res.valid) {
          self.confirmPlay(playCards, info);
        } else {
          showToast(self, res.error || '\u975E\u6CD5\u51FA\u724C');
          self.gameState = GAME_STATE.PLAYER_TURN;
        }
      })
      .catch(function () {
        self.confirmPlay(playCards, info);
      });
  } else {
    this.confirmPlay(playCards, info);
  }
};

GameScene.prototype.confirmPlay = function (playCards, info) {
  var self = this;
  var playSet = {};
  for (var i = 0; i < playCards.length; i++) {
    playSet[playCards[i].suit + ':' + playCards[i].rank] = true;
  }
  for (var j = this.playerHand.length - 1; j >= 0; j--) {
    var key = this.playerHand[j].suit + ':' + this.playerHand[j].rank;
    if (playSet[key]) this.playerHand.splice(j, 1);
  }

  this.lastPlay = playCards;
  this.lastPlayInfo = info;
  this.lastPlayPlayer = 'player';
  this.passCount = 0;
  this.displayPlay(playCards, 'player');
  this.setStatusText('\u5DF2\u51FA ' + (Doudizhu.HAND_TYPE_NAMES[info.type] || info.type));
  this.selectedCards = [];
  this.renderPlayerHand();

  if (this.playerHand.length === 0) {
    this.setStatusText('\u606D\u559C\u4F60\u8D62\u4E86\uFF01');
    showToast(this, '\u606D\u559C\u4F60\u8D62\u4E86\uFF01');
    this.gameState = GAME_STATE.ROUND_END;
    return;
  }
  this.time.delayedCall(600, function () { self.doAITurn(0); });
};

GameScene.prototype.doPlayerPass = function () {
  if (this.gameState !== GAME_STATE.PLAYER_TURN) return;
  if (!this.lastPlay || this.lastPlay.length === 0) {
    showToast(this, '\u81EA\u7531\u51FA\u724C\u9636\u6BB5\u4E0D\u80FD\u8DF3\u8FC7');
    return;
  }
  this.passCount++;
  showToast(this, '\u4E0D\u51FA');
  this.setStatusText('\u4F60\u9009\u62E9\u4E0D\u51FA');
  this.selectedCards = [];
  if (this.passCount >= 2) {
    this.passCount = 0;
    this.lastPlay = null;
    this.lastPlayInfo = null;
    this.setStatusText('\u4E24\u5BB6\u90FD\u8FC7\uFF0C\u8F6E\u5230\u4F60\u81EA\u7531\u51FA\u724C');
    return;
  }
  var self = this;
  this.time.delayedCall(500, function () { self.doAITurn(1); });
};

GameScene.prototype.doHint = function () {
  var self = this;
  if (this.gameState !== GAME_STATE.PLAYER_TURN) return;
  this.setStatusText('\u8BA1\u7B97\u53EF\u51FA\u724C\u578B...');

  if (this.isAPIMode && typeof ApiClient !== 'undefined') {
    ApiClient.findPlays(this.playerHand, this.lastPlay)
      .then(function (res) {
        if (res.total === 0) {
          showToast(self, '\u6CA1\u6709\u80FD\u51FA\u7684\u724C');
          self.setStatusText('\u6CA1\u6709\u80FD\u51FA\u7684\u724C');
          return;
        }
        var hint = res.plays[0];
        self.highlightHint(hint);
        self.setStatusText('\u63D0\u793A: ' + hint.typeName + ' (\u5171' + res.total + '\u79CD)');
      })
      .catch(function () { self.localHint(); });
  } else {
    this.localHint();
  }
};

GameScene.prototype.localHint = function () {
  var plays = Doudizhu.findValidPlays(this.playerHand, this.lastPlay);
  if (plays.length === 0) {
    showToast(this, '\u6CA1\u6709\u80FD\u51FA\u7684\u724C');
    this.setStatusText('\u6CA1\u6709\u80FD\u51FA\u7684\u724C');
    return;
  }
  var hintPlay = plays[0];
  this._clearCardSelection();
  this.selectedCards = [];
  var hintRanks = {};
  for (var j = 0; j < hintPlay.length; j++) {
    hintRanks[hintPlay[j].suit + ':' + hintPlay[j].rank] = true;
  }
  for (var k = 0; k < this.cardDomElements.length; k++) {
    var card = this.cardDomElements[k].getData('card');
    var key = card.suit + ':' + card.rank;
    if (hintRanks[key]) {
      this._highlightCard(this.cardDomElements[k]);
      this.selectedCards.push(k);
    }
  }
  var info = Doudizhu.identifyType(hintPlay);
  this.setStatusText('\u63D0\u793A: ' + (Doudizhu.HAND_TYPE_NAMES[info.type] || info.type));
};

GameScene.prototype.highlightHint = function (hint) {
  this._clearCardSelection();
  this.selectedCards = [];
  if (!hint.cards) return;
  for (var j = 0; j < this.cardDomElements.length; j++) {
    var card = this.cardDomElements[j].getData('card');
    for (var k = 0; k < hint.cards.length; k++) {
      if (card.suit === hint.cards[k].suit && card.rank === hint.cards[k].rank) {
        this._highlightCard(this.cardDomElements[j]);
        this.selectedCards.push(j);
        break;
      }
    }
  }
};

GameScene.prototype.doAITurn = function (aiIndex) {
  var self = this;
  var hand = aiIndex === 0 ? this.ai1Hand : this.ai2Hand;
  var aiName = aiIndex === 0 ? '\u738B\u603C\u603C' : '\u82CF\u751C\u751C';

  this.gameState = GAME_STATE.WAITING_AI;
  this.setStatusText(aiName + ' \u601D\u8003\u4E2D...');

  if (hand.length === 0) {
    this.setStatusText(aiName + ' \u5DF2\u51FA\u5B8C\uFF0C' + aiName + '\u83B7\u80DC\uFF01');
    showToast(this, aiName + '\u83B7\u80DC');
    this.gameState = GAME_STATE.ROUND_END;
    return;
  }

  if (this.isAPIMode && typeof ApiClient !== 'undefined') {
    ApiClient.aiPlay(hand, this.lastPlay)
      .then(function (res) {
        if (res.canPlay === false || !res.choice) {
          self.handleAIPass(aiIndex, aiName);
        } else {
          self.handleAIPlay(aiIndex, aiName, res);
        }
      })
      .catch(function () { self.localAIPlay(aiIndex, aiName); });
  } else {
    this.localAIPlay(aiIndex, aiName);
  }
};

GameScene.prototype.handleAIPlay = function (aiIndex, aiName, res) {
  var hand = aiIndex === 0 ? this.ai1Hand : this.ai2Hand;
  var apiCards = res.choice.cards || [];
  var playCards = [];
  for (var i = 0; i < apiCards.length; i++) {
    var c = apiCards[i];
    for (var j = 0; j < hand.length; j++) {
      if (hand[j].suit === c.suit && hand[j].rank === c.rank) {
        playCards.push(hand[j]);
        hand.splice(j, 1);
        break;
      }
    }
  }
  if (playCards.length !== apiCards.length) {
    this.localAIPlay(aiIndex, aiName);
    return;
  }
  var info = Doudizhu.identifyType(playCards);
  this.lastPlay = playCards;
  this.lastPlayInfo = info;
  this.lastPlayPlayer = aiIndex === 0 ? 'ai1' : 'ai2';
  this.passCount = 0;
  this.displayPlay(playCards, aiIndex === 0 ? 'ai1' : 'ai2');
  this.setStatusText(aiName + ' \u51FA\u4E86 ' + (Doudizhu.HAND_TYPE_NAMES[info.type] || info.type));
  this.updateAICount(aiIndex);
  if (hand.length === 0) {
    this.setStatusText(aiName + ' \u51FA\u5B8C\u4E86\uFF01\u83B7\u80DC\uFF01');
    showToast(this, aiName + '\u83B7\u80DC\uFF01');
    this.gameState = GAME_STATE.ROUND_END;
    return;
  }
  if (aiIndex === 0) {
    // AI1 played, now AI2's turn
    var self = this;
    this.setStatusText(aiName + ' \u51FA\u4E86 ' + (Doudizhu.HAND_TYPE_NAMES[info.type] || info.type) + '\uFF0C\u8F6E\u5230\u82CF\u751C\u751C');
    this.time.delayedCall(600, function () { self.doAITurn(1); });
  } else {
    this.gameState = GAME_STATE.PLAYER_TURN;
    this.setStatusText('\u8F6E\u5230\u4F60\u51FA\u724C');
  }
};

GameScene.prototype.handleAIPass = function (aiIndex, aiName) {
  this.passCount++;
  this.setStatusText(aiName + ' \u4E0D\u51FA');
  this.updateAICount(aiIndex);
  if (this.passCount >= 2) {
    this.passCount = 0;
    this.lastPlay = null;
    this.lastPlayInfo = null;
    this.gameState = GAME_STATE.PLAYER_TURN;
    this.setStatusText('\u4E24\u5BB6\u90FD\u8FC7\uFF0C\u8F6E\u5230\u4F60\u81EA\u7531\u51FA\u724C');
    return;
  }
  if (aiIndex === 0) {
    // AI1 passed, now AI2's turn
    var self = this;
    this.setStatusText(aiName + ' \u4E0D\u51FA\uFF0C\u8F6E\u5230\u82CF\u751C\u751C');
    this.time.delayedCall(600, function () { self.doAITurn(1); });
  } else {
    this.gameState = GAME_STATE.PLAYER_TURN;
    this.setStatusText('\u8F6E\u5230\u4F60\u51FA\u724C');
  }
};

GameScene.prototype.localAIPlay = function (aiIndex, aiName) {
  var hand = aiIndex === 0 ? this.ai1Hand : this.ai2Hand;
  var plays = Doudizhu.findValidPlays(hand, this.lastPlay);
  if (plays.length === 0) { this.handleAIPass(aiIndex, aiName); return; }
  var chosen = plays[Math.floor(Math.random() * plays.length)];
  var info = Doudizhu.identifyType(chosen);
  for (var i = 0; i < chosen.length; i++) {
    for (var j = 0; j < hand.length; j++) {
      if (hand[j].suit === chosen[i].suit && hand[j].rank === chosen[i].rank) {
        hand.splice(j, 1); break;
      }
    }
  }
  this.lastPlay = chosen;
  this.lastPlayInfo = info;
  this.lastPlayPlayer = aiIndex === 0 ? 'ai1' : 'ai2';
  this.passCount = 0;
  this.displayPlay(chosen, aiIndex === 0 ? 'ai1' : 'ai2');
  this.setStatusText(aiName + ' \u51FA\u4E86 ' + (Doudizhu.HAND_TYPE_NAMES[info.type] || info.type));
  this.updateAICount(aiIndex);
  if (hand.length === 0) {
    this.setStatusText(aiName + ' \u51FA\u5B8C\u4E86\uFF01\u83B7\u80FD\uFF01');
    showToast(this, aiName + '\u83B7\u80DC\uFF01');
    this.gameState = GAME_STATE.ROUND_END;
    return;
  }
  if (aiIndex === 0) {
    // AI1 played (local), now AI2's turn
    var self = this;
    this.time.delayedCall(600, function () { self.doAITurn(1); });
  } else {
    this.gameState = GAME_STATE.PLAYER_TURN;
    this.setStatusText('\u8F6E\u5230\u4F60\u51FA\u724C');
  }
};

GameScene.prototype.updateAICount = function (aiIndex) {
  var count = aiIndex === 0 ? this.ai1Hand.length : this.ai2Hand.length;
  var text = '\u5269\u4F59 ' + count + ' \u5F20';
  if (aiIndex === 0 && this.ai1Count) this.ai1Count.setText(text);
  if (aiIndex === 1 && this.ai2Count) this.ai2Count.setText(text);
};

GameScene.prototype.displayPlay = function (cards, player) {
  var labelEl;
  if (player === 'player') labelEl = this.myPlayCards;
  else if (player === 'ai1') labelEl = this.ai1PlayCards;
  else labelEl = this.ai2PlayCards;
  if (!labelEl || !labelEl.node) return;
  var html = '<div style="display:flex;gap:3px;align-items:center">';
  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    var isRed = c.isRed ? c.isRed() : (c.suit === 'heart' || c.suit === 'diamond');
    var colorClass = isRed ? 'ddz-card-red' : 'ddz-card-black';
    var display = c.displayName ? c.displayName() : Doudizhu.RANK_NAME_MAP[c.rank];
    var symbol = c.suitSymbol ? c.suitSymbol() : Doudizhu.SUIT_SYMBOLS[c.suit];
    html += '<span class="ddz-card-compact ' + colorClass + '">' + symbol + display + '</span>';
  }
  html += '</div>';
  labelEl.node.innerHTML = html;
  ensureCardCSS();
};

GameScene.prototype.doAction = function () {
  var self = this;
  if (this.gameState !== GAME_STATE.PLAYER_TURN) return;
  this.setStatusText('\u641E\u4E8B\u60C5\uFF01\u751F\u6210\u9898\u76EE\u4E2D...');

  if (this.isAPIMode && typeof ApiClient !== 'undefined') {
    ApiClient.generateQuiz('all', 'normal', 1)
      .then(function (res) {
        if (res.success && res.questions.length > 0) {
          var q = res.questions[0];
          showToast(self, '\u51FA\u9898: ' + (q.question || '').slice(0, 20) + '...');
          self.setStatusText(q.questionType + ' \u9898');
        } else {
          showToast(self, '\u6682\u65E0\u9898\u76EE');
        }
      })
      .catch(function () {
        showToast(self, '\u641E\u4E8B\u60C5\u5931\u8D25\uFF08\u540E\u7AEF\u672A\u542F\u52A8\uFF09');
        self.setStatusText('\u641E\u4E8B\u60C5\u9700\u8981\u540E\u7AEFAPI');
      });
  } else {
    showToast(this, '\u641E\u4E8B\u60C5\u6A21\u5F0F\u9700\u540E\u7AEFAPI');
    this.setStatusText('\u641E\u4E8B\u60C5\u9700\u8981\u542F\u52A8\u540E\u7AEF');
  }
};

// ================================================================
// 功能按钮
// ================================================================
function createActionButtons(scene) {
  var bw = 72, bh = 38, gap = 8;
  var totalW = bw * 4 + gap * 3;
  var startX = (375 - totalW) / 2;
  var btnY = 700;

  var buttons = [
    { label: '\u51FA\u724C', color: 0x4ECDC4, key: 'play' },
    { label: '\u63D0\u793A', color: 0xFFD93D, key: 'hint' },
    { label: '\u4E0D\u51FA', color: 0xFF6B6B, key: 'pass' },
    { label: '\u641E\u4E8B\u60C5', color: 0x7C4DFF, key: 'action' }
  ];

  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    var bx = startX + i * (bw + gap);
    var bg = scene.add.graphics();
    bg.fillStyle(b.color, 1);
    bg.fillRoundedRect(bx, btnY, bw, bh, 8).setDepth(100);
    bg.setInteractive(new Phaser.Geom.Rectangle(bx, btnY, bw, bh), Phaser.Geom.Rectangle.Contains);

    scene.add.text(bx + bw / 2, btnY + bh / 2, b.label, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '14px', color: '#FFFFFF', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(101);

    (function (key) {
      bg.on('pointerup', function () {
        switch (key) {
          case 'play': scene.doPlayerPlay(); break;
          case 'hint': scene.doHint(); break;
          case 'pass': scene.doPlayerPass(); break;
          case 'action': scene.doAction(); break;
        }
      });
    })(b.key);
  }
}

// ================================================================
// Toast
// ================================================================
function showToast(scene, message) {
  var cx = 187;
  var toastBg = scene.add.graphics();
  toastBg.fillStyle(0x000000, 0.7);
  toastBg.fillRoundedRect(cx - 80, 390, 160, 32, 8).setDepth(200);
  var toastText = scene.add.text(cx, 406, message, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '13px', color: '#FFFFFF'
  }).setOrigin(0.5).setDepth(201);
  scene.time.delayedCall(1200, function () {
    toastBg.destroy();
    toastText.destroy();
  });
}

// ================================================================
// CSS
// ================================================================
var _cardCSSInjected = false;
function ensureCardCSS() {
  if (_cardCSSInjected) return;
  _cardCSSInjected = true;
  var style = document.createElement('style');
  style.textContent = [
    '.ddz-card-dom{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:40px;height:60px;background:linear-gradient(145deg,#FFF,#F5F5F5);border:1.5px solid #90A4AE;border-radius:6px;font-size:14px;font-weight:bold;cursor:pointer;user-select:none;box-shadow:0 2px 6px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.8);transition:transform 0.15s ease,box-shadow 0.15s ease}',
    '.ddz-card-selected{border-color:#4ECDC4!important;box-shadow:0 0 0 2px #4ECDC4,0 4px 12px rgba(78,205,196,0.4)!important;transform:translateY(-4px)}',
    '.ddz-card-red{color:#E53935}',
    '.ddz-card-black{color:#212121}',
    '.ddz-dom-top{font-size:10px;line-height:1.2;align-self:flex-start;margin-left:3px}',
    '.ddz-dom-center{font-size:18px;line-height:1.4}',
    '.ddz-dom-bottom{font-size:10px;line-height:1.2;align-self:flex-end;margin-right:3px;transform:rotate(180deg)}',
    '.ddz-card-compact{display:inline-flex;align-items:center;justify-content:center;width:30px;height:42px;margin:1px;background:linear-gradient(145deg,#FFF,#F5F5F5);border:1px solid #90A4AE;border-radius:4px;font-size:11px;font-weight:bold;box-shadow:0 1px 3px rgba(0,0,0,0.2)}',
    '#game-container canvas{display:block}',
    '#game-container div{pointer-events:auto}'
  ].join('');
  document.head.appendChild(style);
}
