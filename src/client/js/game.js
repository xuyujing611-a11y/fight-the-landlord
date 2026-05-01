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
  BIDDING: 'BIDDING',
  PLAYER_TURN: 'PLAYER_TURN',
  VALIDATING: 'VALIDATING',
  WAITING_AI: 'WAITING_AI',
  ROUND_END: 'ROUND_END'
};

var GameConfig = {
  type: Phaser.AUTO,
  width: 600,
  height: 960,
  parent: 'game-container',
  backgroundColor: '#1B5E20',
  dom: { createContainer: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [GameScene]
};

var game = new Phaser.Game(GameConfig);

// ================================================================
// SoundManager - Web Audio API 音效
// ================================================================
var SoundManager = {
  ctx: null,
  init: function () {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not available');
    }
  },
  _play: function (freq, duration, type, volume, delay) {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      var t = this.ctx.currentTime + (delay || 0);
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(volume || 0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + duration);
    } catch (e) { /* ignore audio errors */ }
  },
  // 出牌 - 短促的"哒"点击声
  playCard: function () { this._play(880, 0.06, 'square', 0.12); },
  // 选牌 - 高音滴
  selectCard: function () { this._play(660, 0.08, 'sine', 0.15); },
  // 取消选牌 - 低音滴
  deselectCard: function () { this._play(480, 0.08, 'sine', 0.12); },
  // 轮到玩家 - 上升提示音
  playerTurn: function () {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(880, this.ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch (e) {}
  },
  // 叫分 - 三连升调
  bid: function () {
    this._play(440, 0.1, 'triangle', 0.18, 0);
    this._play(660, 0.1, 'triangle', 0.18, 0.12);
    this._play(880, 0.18, 'triangle', 0.22, 0.24);
  },
  // 不叫 - 简短下降
  passBid: function () {
    this._play(440, 0.08, 'sine', 0.12, 0);
    this._play(300, 0.12, 'sine', 0.10, 0.08);
  },
  // 胜利 - 凯旋号角
  win: function () {
    this._play(523, 0.15, 'sine', 0.22, 0);
    this._play(659, 0.15, 'sine', 0.22, 0.18);
    this._play(784, 0.15, 'sine', 0.22, 0.36);
    this._play(1047, 0.35, 'sine', 0.28, 0.54);
  },
  // 失败 - 低沉衰退
  lose: function () {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(350, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, this.ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.6);
    } catch (e) {}
  },
  // 轮到AI思考 - 轻微提示
  aiThink: function () { this._play(350, 0.06, 'sine', 0.08); }
};

// ================================================================
// 工具函数
// ================================================================
function makeAvatarImage(scene, key, x, y, bgColor, name) {
  var g = scene.add.graphics();
  g.fillStyle(bgColor, 1);
  g.fillRoundedRect(x - 28, y - 28, 56, 56, 14);
  g.lineStyle(2, 0xFFFFFF, 0.8);
  g.strokeRoundedRect(x - 28, y - 28, 56, 56, 14);
  var img = scene.add.image(x, y, key).setDisplaySize(50, 50).setDepth(12);
  return img;
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
  this.gameState = GAME_STATE.BIDDING;
  this.lastPlay = null;
  this.lastPlayInfo = null;
  this.lastPlayPlayer = null;
  this.passCount = 0;
  this.biddingState = null;
  this.biddingUI = [];
  this.landlordIndex = -1;
  this.isLandlord = false;
  this.playHistory = [];
};

GameScene.prototype.preload = function () {
  this.load.image('avatar_wang', 'assets/avatars/wang_duidui.png');
  this.load.image('avatar_su', 'assets/avatars/su_tiantian.png');
};

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

  // 初始化音效
  SoundManager.init();

  // 创建出牌记录区域
  createPlayHistoryArea(this);

  this.time.delayedCall(500, function () {
    self.checkAPIConnection();
  });

  // 叫分阶段
  this.time.delayedCall(800, function () {
    self.startBiddingPhase();
  });
};

// ================================================================
// 背景
// ================================================================
function drawTableBackground(scene) {
  var W = 600, H = 960;
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
  border.strokeRoundedRect(13, 71, W - 26, H - 130, 12);
  var diamond = scene.add.graphics();
  diamond.lineStyle(1, 0x66BB6A, 0.15);
  var cx = W / 2, cy = H / 2 - 40;
  diamond.strokeRect(cx - 80, cy - 83, 160, 166);
  diamond.strokeRect(cx - 48, cy - 59, 96, 118);

  // Decorative table corners
  var cPos = [[35, 85], [W-35, 85], [35, H-57], [W-35, H-57]];
  for (var ci = 0; ci < cPos.length; ci++) {
    var dx = cPos[ci][0], dy = cPos[ci][1];
    diamond.lineStyle(1, 0x4CAF50, 0.18);
    diamond.strokeCircle(dx, dy, 16);
    diamond.strokeCircle(dx, dy, 10);
    diamond.strokeCircle(dx, dy, 5);
  }

  // Center decorative circles
  diamond.lineStyle(1, 0x66BB6A, 0.08);
  diamond.strokeCircle(cx, cy - 10, 67);
  diamond.strokeCircle(cx, cy - 10, 93);
}

// ================================================================
// 顶部状态栏
// ================================================================
function createTopBar(scene) {
  scene.roundText = scene.add.text(26, 14, '\u7B2C 1/10 \u56DE\u5408', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '14px', color: '#E8F5E9', fontStyle: 'bold'
  }).setDepth(10);

  // status text (center)
  scene.statusText = scene.add.text(299, 31, '', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '11px', color: '#A5D6A7'
  }).setOrigin(0.5).setDepth(10);

  var line = scene.add.graphics();
  line.lineStyle(1, 0x66BB6A, 0.2);
  line.lineBetween(0, 52, 600, 52);
  line.setDepth(10);
}

// ================================================================
// AI 区域
// ================================================================
function createAIArea(scene) {
  // AI1: Wang Duidui - 酷拽墨镜男
  makeAvatarImage(scene, 'avatar_wang', 77, 87, 0xFF6B35, '\u738B\u603C\u603C');
  scene.add.text(128, 71, '\u738B\u603C\u603C', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', color: '#FFFFFF', fontStyle: 'bold'
  }).setDepth(11);
  scene.ai1Count = scene.add.text(128, 92, '\u5269\u4F59 17 \u5F20', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '11px', color: '#A5D6A7'
  }).setDepth(11);

  // AI2: Su Tiantian - 甜美可爱少女
  makeAvatarImage(scene, 'avatar_su', 520, 87, 0x7C4DFF, '\u82CF\u751C\u751C');
  scene.add.text(390, 71, '\u82CF\u751C\u751C', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(1, 0).setDepth(11);
  scene.ai2Count = scene.add.text(390, 92, '\u5269\u4F59 17 \u5F20', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '11px', color: '#A5D6A7'
  }).setOrigin(1, 0).setDepth(11);

  scene.add.text(299, 85, 'VS', {
    fontFamily: '"Arial",sans-serif', fontSize: '11px', color: '#66BB6A', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(11);

  var divider = scene.add.graphics();
  divider.lineStyle(1, 0x66BB6A, 0.1);
  divider.lineBetween(0, 130, 600, 130).setDepth(10);
}

// ================================================================
// 中央出牌区
// ================================================================
function createPlayArea(scene) {
  var cx = 300;
  var playBg = scene.add.graphics();
  playBg.fillStyle(0x000000, 0.1);
  playBg.fillRoundedRect(32, 142, 536, 307, 14).setDepth(10);

  scene.add.text(cx, 296, '\u51FA\u724C\u533A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '12px', color: '#66BB6A', alpha: 0.4
  }).setOrigin(0.5).setDepth(11);

  scene.ai1PlayLabel = scene.add.text(80, 154, '\u738B\u603C\u603C\uFF1A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#A5D6A7'
  }).setDepth(11);
  scene.ai1PlayCardsGraphics = scene.add.graphics().setDepth(11);

  scene.ai2PlayLabel = scene.add.text(448, 154, '\u82CF\u751C\u751C\uFF1A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#A5D6A7'
  }).setDepth(11);
  scene.ai2PlayCardsGraphics = scene.add.graphics().setDepth(11);

  scene.myPlayLabel = scene.add.text(cx, 367, '\u4F60\u51FA\uFF1A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#A5D6A7'
  }).setOrigin(0.5).setDepth(11);
  scene.myPlayCardsGraphics = scene.add.graphics().setDepth(11);

  scene.add.text(16, 420, '\u5E95\u724C: ? ? ?', {
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
  handBg.fillRoundedRect(6, 603, 587, 189, 14).setDepth(10);
  scene.add.text(26, 608, '\u4F60\u7684\u624B\u724C', {
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

  var n = hand.length, cw = 56, ch = 84;
  var overlap = n > 6 ? Math.min(18, (520 - cw) / (n - 1)) : 28;
  var totalWidth = cw + (n - 1) * overlap;
  var startX = (600 - totalWidth) / 2;
  var baseY = 700;

  for (var i = 0; i < n; i++) {
    var card = hand[i];
    var cx = startX + i * overlap + cw / 2;
    var arcOffset = Math.pow((i / (n - 1)) - 0.5, 2) * 36;
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
      fontFamily: 'Arial', fontSize: '14px', color: clr, fontStyle: 'bold'
    }).setOrigin(0, 0).setDepth(111);

    var txtSuit = self.add.text(cx, cy - 2, symbol, {
      fontFamily: 'Arial', fontSize: '28px', color: clr
    }).setOrigin(0.5, 0.5).setDepth(111);

    var txtRank2 = self.add.text(cx + cw/2 - 3, cy + ch/2 - 2, display, {
      fontFamily: 'Arial', fontSize: '14px', color: clr, fontStyle: 'bold'
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
        this.y += 28;
        this.setData('selected', false);
        var pos = self.selectedCards.indexOf(idx2);
        if (pos >= 0) self.selectedCards.splice(pos, 1);
        SoundManager.deselectCard();
    } else {
        bg.clear();
        bg.fillStyle(0xFFFFFF, 1);
        bg.fillRoundedRect(cx - cw/2, cy - ch/2, cw, ch, 4);
        bg.lineStyle(2, 0x4ECDC4, 1);
        bg.strokeRoundedRect(cx - cw/2, cy - ch/2, cw, ch, 4);
        this.y -= 28;
        this.setData('selected', true);
        self.selectedCards.push(idx2);
        SoundManager.selectCard();
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
  var cw = 56, ch = 84;
  for (var i = 0; i < this.cardDomElements.length; i++) {
    var el = this.cardDomElements[i];
    var bg = el.getData('bg');
    if (bg) {
      bg.clear();
      bg.fillStyle(0xFFFFFF, 1);
      bg.fillRoundedRect(el.x - cw/2, el.y - ch/2, cw, ch, 4);
      bg.lineStyle(1, 0x90A4AE, 1);
      bg.strokeRoundedRect(el.x - cw/2, el.y - ch/2, cw, ch, 4);
    }
    el.setData('selected', false);
    if (n > 0) {
      var overlap = n > 6 ? Math.min(18, (520 - cw) / (n - 1)) : 32;
      var arcOffset = Math.pow((i / Math.max(1, n - 1)) - 0.5, 2) * 36;
      el.setY(698 - arcOffset);
    }
  }
};

GameScene.prototype._highlightCard = function (el) {
  el.setData('selected', true);
  el.setY(el.y - 28);
  var bg = el.getData('bg');
  if (bg) {
    var cw = 56, ch = 84;
    bg.clear();
    bg.fillStyle(0xFFFFFF, 1);
    bg.fillRoundedRect(el.x - cw/2, el.y - ch/2, cw, ch, 4);
    bg.lineStyle(2, 0x4ECDC4, 1);
    bg.strokeRoundedRect(el.x - cw/2, el.y - ch/2, cw, ch, 4);
  }
};

// ================================================================
// 叫分阶段
// ================================================================

GameScene.prototype.startBiddingPhase = function () {
  var self = this;
  this.gameState = GAME_STATE.BIDDING;
  this.setStatusText('\u53EB\u5206\u9636\u6BB5...');

  // 构建3人手牌的简短JSON用于API
  var handsForAPI = [
    this.playerHand.map(function (c) { return { suit: c.suit, rank: c.rank }; }),
    this.ai1Hand.map(function (c) { return { suit: c.suit, rank: c.rank }; }),
    this.ai2Hand.map(function (c) { return { suit: c.suit, rank: c.rank }; })
  ];
  var remainingForAPI = this.remainingCards.map(function (c) {
    return { suit: c.suit, rank: c.rank };
  });

  // 隐藏功能按钮
  this.hideActionButtons();

  if (this.isAPIMode && typeof ApiClient !== 'undefined') {
    ApiClient.startBidding(handsForAPI, remainingForAPI)
      .then(function (res) {
        self.onBiddingStarted(res);
      })
      .catch(function () {
        // API 不可用，本地模式：随机定地主
        self.localAssignLandlord();
      });
  } else {
    self.localAssignLandlord();
  }
};

GameScene.prototype.onBiddingStarted = function (res) {
  this.biddingState = res;
  this.biddingId = res.biddingId;

  this.setStatusText('\u53EB\u5206\u9636\u6BB5');

  if (res.turn === 0) {
    // 轮到玩家叫分
    this.showBiddingUI();
  } else if (res.turn === 1) {
    // 轮到王怼怼
    this.setStatusText('\u738B\u603C\u603C\u601D\u8003\u4E2D...');
    var self = this;
    this.time.delayedCall(1000, function () {
      self.doAIBidding(1);
    });
  } else {
    // 轮到苏甜甜
    this.setStatusText('\u82CF\u751C\u751C\u601D\u8003\u4E2D...');
    var self2 = this;
    this.time.delayedCall(1000, function () {
      self2.doAIBidding(2);
    });
  }
};

GameScene.prototype.showBiddingUI = function () {
  var self = this;
  this.hideBiddingUI();

  var cx = 300;
  var uiY = 662;
  var bids = [
    { label: '\u4E0D\u53EB', value: 0, color: 0xFF6B6B },
    { label: '1\u5206', value: 1, color: 0x4ECDC4 },
    { label: '2\u5206', value: 2, color: 0xFFD93D },
    { label: '3\u5206', value: 3, color: 0xFF6B35 }
  ];

  // 提示文字
  var promptText = this.add.text(cx, 603, '\u8BF7\u53EB\u5206', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '18px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(200);
  this.biddingUI.push(promptText);

  var bw = 96, bh = 52, gap = 12;
  var totalW = bw * 4 + gap * 3;
  var startX = (600 - totalW) / 2;

  for (var i = 0; i < bids.length; i++) {
    var b = bids[i];
    var bx = startX + i * (bw + gap);

    var bg = this.add.graphics().setDepth(200);
    bg.fillStyle(b.color, 1);
    bg.fillRoundedRect(bx, uiY, bw, bh, 10);
    bg.setInteractive(new Phaser.Geom.Rectangle(bx, uiY, bw, bh), Phaser.Geom.Rectangle.Contains);

    var txt = this.add.text(bx + bw / 2, uiY + bh / 2, b.label, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '16px', color: '#FFFFFF', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(201);

    (function (val, buttonEl) {
      bg.on('pointerup', function () {
        self.handlePlayerBid(val);
      });
    })(b.value, bg);

    this.biddingUI.push(bg);
    this.biddingUI.push(txt);
  }

  // 手牌强度提示
  var state = this.biddingState;
  if (state && state.handStrength !== undefined) {
    var strength = state.handStrength;
    var label = strength >= 20 ? '\u624B\u724C\u5F88\u5F3A' : (strength >= 14 ? '\u624B\u724C\u4E0D\u9519' : (strength >= 9 ? '\u624B\u724C\u4E00\u822C' : '\u624B\u724C\u8F83\u5F31'));
    var infoText = this.add.text(cx, 733, '\u2605 ' + label + ' (\u5F3A\u5EA6\u5206: ' + strength + ')', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '12px', color: '#A5D6A7'
    }).setOrigin(0.5).setDepth(200);
    this.biddingUI.push(infoText);
  }
};

GameScene.prototype.hideBiddingUI = function () {
  for (var i = 0; i < this.biddingUI.length; i++) {
    if (this.biddingUI[i]) this.biddingUI[i].destroy();
  }
  this.biddingUI = [];
};

GameScene.prototype.handlePlayerBid = function (bid) {
  var self = this;
  this.hideBiddingUI();

  var bidLabel = bid === 0 ? '\u4E0D\u53EB' : bid + '\u5206';
  this.setStatusText('\u4F60\u53EB\u4E86 ' + bidLabel);
  if (bid > 0) { SoundManager.bid(); } else { SoundManager.passBid(); }

  if (this.isAPIMode && this.biddingId) {
    ApiClient.placeBid(this.biddingId, 0, bid)
      .then(function (res) {
        self.onBiddingResult(res);
      })
      .catch(function () {
        self.setStatusText('\u53EB\u5206\u670D\u52A1\u5F02\u5E38\uFF0C\u672C\u5730\u6A21\u5F0F');
        self.localAssignLandlord();
      });
  } else {
    this.localAssignLandlord();
  }
};

GameScene.prototype.onBiddingResult = function (res) {
  if (res.phase === 'done') {
    // 叫分结束，确定地主
    this.finishBidding(res);
    return;
  }

  if (res.phase === 'redeal') {
    this.setStatusText('\u4E09\u5BB6\u90FD\u4E0D\u53EB\uFF0C\u91CD\u65B0\u53D1\u724C');
    showToast(this, '\u91CD\u65B0\u53D1\u724C...');
    var self = this;
    this.time.delayedCall(1500, function () {
      self.restartGame();
    });
    return;
  }

  // 轮到下一个玩家
  if (res.currentBidder === 'ai1') {
    this.setStatusText('\u738B\u603C\u603C\u601D\u8003\u4E2D...');
    var self = this;
    this.time.delayedCall(1000, function () {
      self.doAIBidding(1);
    });
  } else if (res.currentBidder === 'ai2') {
    this.setStatusText('\u82CF\u751C\u751C\u601D\u8003\u4E2D...');
    var self = this;
    this.time.delayedCall(1000, function () {
      self.doAIBidding(2);
    });
  } else if (res.currentBidder === 'player') {
    // 又轮到玩家
    this.showBiddingUI();
  }
};

GameScene.prototype.doAIBidding = function (aiIndex) {
  var self = this;
  var hand = aiIndex === 1 ? this.ai1Hand : this.ai2Hand;
  var aiName = aiIndex === 1 ? '\u738B\u603C\u603C' : '\u82CF\u751C\u751C';

  var currentBid = this.biddingState ? this.biddingState.highestBid : 0;

  // 本地 AI 叫分逻辑
  var groups = {};
  for (var i = 0; i < hand.length; i++) {
    groups[hand[i].rank] = (groups[hand[i].rank] || 0) + 1;
  }
  var score = 0;
  if (groups[14]) score += 6;
  if (groups[13]) score += 4;
  if (groups[12]) score += 2;
  for (var r in groups) {
    if (groups[r] === 4) score += 12;
    else if (groups[r] === 3) score += 4;
  }

  var bid = 0;
  if (score >= 20) bid = 3;
  else if (score >= 14) bid = 2;
  else if (score >= 9) bid = 1;
  else bid = 0;

  if (bid <= currentBid) {
    if (score >= 20 && currentBid < 3) bid = 3;
    else bid = 0;
  }

  var bidLabel = bid === 0 ? '\u4E0D\u53EB' : bid + '\u5206';
  this.setStatusText(aiName + ' \u53EB\u4E86 ' + bidLabel);
  if (bid > 0) { SoundManager.bid(); } else { SoundManager.passBid(); }

  if (this.isAPIMode && this.biddingId) {
    ApiClient.placeBid(this.biddingId, aiIndex, bid)
      .then(function (res) {
        self.onBiddingResult(res);
      })
      .catch(function () {
        self.setStatusText('\u53EB\u5206\u670D\u52A1\u5F02\u5E38');
        self.localAssignLandlord();
      });
  } else {
    this.localAssignLandlord();
  }
};

GameScene.prototype.finishBidding = function (res) {
  this.landlordIndex = res.highestBidder;
  this.isLandlord = (res.highestBidder === 0);

  // 显示底牌
  this.showBottomCards(res.landlordCards);

  // 如果玩家是地主，把底牌加入手牌
  if (res.highestBidder === 0 && res.landlordHand) {
    this.playerHand = res.landlordHand.map(function (c) {
      return new Doudizhu.Card(c.suit, c.rank);
    });
    this.playerHand = Doudizhu.sortCards(this.playerHand);
    this.renderPlayerHand();
  }

  // 如果 AI 是地主，把底牌加入 AI 手牌
  if (res.highestBidder === 1) {
    var bottomCards = (res.landlordCards || []).map(function (c) {
      return new Doudizhu.Card(c.suit, c.rank);
    });
    for (var i = 0; i < bottomCards.length; i++) {
      this.ai1Hand.push(bottomCards[i]);
    }
    this.updateAICount(1);
  }
  if (res.highestBidder === 2) {
    var bottomCards2 = (res.landlordCards || []).map(function (c) {
      return new Doudizhu.Card(c.suit, c.rank);
    });
    for (var i = 0; i < bottomCards2.length; i++) {
      this.ai2Hand.push(bottomCards2[i]);
    }
    this.updateAICount(2);
  }

  this.setStatusText(res.winnerText + ' \u5F00\u59CB\u51FA\u724C');
  showToast(this, res.winnerText);

  var self = this;
  this.time.delayedCall(1200, function () {
    self.gameState = GAME_STATE.PLAYER_TURN;
    self.setStatusText('\u8F6E\u5230\u4F60\u51FA\u724C\uFF08\u81EA\u7531\u51FA\u724C\uFF09');
    self.showActionButtons();
    SoundManager.playerTurn();
  });
};

GameScene.prototype.showBottomCards = function (cards) {
  if (!cards || cards.length === 0) return;
  var cx = 300;
  // 清除旧的底牌文字与图形
  if (this.bottomCardsText) this.bottomCardsText.destroy();
  if (this.bottomCardGfx) this.bottomCardGfx.destroy();

  var display = cards.map(function (c) {
    return Doudizhu.RANK_NAME_MAP[c.rank] || '?';
  }).join(' ');

  this.bottomCardsText = this.add.text(cx, 449, '底牌: ' + display, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '16px', color: '#FFD93D', fontStyle: 'bold',
    stroke: '#000000', strokeThickness: 3
  }).setOrigin(0.5).setDepth(20);

  // 绘制底牌牌面图案（蓝色牌背花纹）
  this.bottomCardGfx = this.add.graphics().setDepth(19);
  var bw = 24, bh = 34, gap = 5;
  var totalW = cards.length * (bw + gap) - gap;
  var bx = Math.round(cx - totalW / 2);
  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    var cx2 = bx + i * (bw + gap);
    // 蓝色牌背
    this.bottomCardGfx.fillStyle(0x1565C0, 1);
    this.bottomCardGfx.fillRoundedRect(cx2, 471, bw, bh, 2);
    this.bottomCardGfx.lineStyle(1, 0x0D47A1, 0.5);
    this.bottomCardGfx.strokeRoundedRect(cx2, 471, bw, bh, 2);
    this.bottomCardGfx.fillStyle(0x1976D2, 1);
    this.bottomCardGfx.fillRect(cx2 + 4, 476, bw - 8, bh - 10);
    this.bottomCardGfx.fillStyle(0x42A5F5, 0.4);
    this.bottomCardGfx.fillCircle(cx2 + bw/2, 488, 4);
    // 花色颜色标记
    var isRed = c.isRed ? c.isRed() : (c.suit === 'heart' || c.suit === 'diamond');
    this.bottomCardGfx.fillStyle(isRed ? 0xE53935 : 0x212121, 0.7);
    this.bottomCardGfx.fillRect(cx2 + 5, 477, 4, 4);
  }
};
GameScene.prototype.localAssignLandlord = function () {
  // 本地模式：随机定地主，直接开始游戏
  this.landlordIndex = Math.floor(Math.random() * 3);
  this.isLandlord = (this.landlordIndex === 0);

  if (this.landlordIndex === 0) {
    for (var i = 0; i < this.remainingCards.length; i++) {
      this.playerHand.push(this.remainingCards[i]);
    }
    this.playerHand = Doudizhu.sortCards(this.playerHand);
    this.renderPlayerHand();
  } else if (this.landlordIndex === 1) {
    for (var i = 0; i < this.remainingCards.length; i++) {
      this.ai1Hand.push(this.remainingCards[i]);
    }
    this.updateAICount(1);
  } else {
    for (var i = 0; i < this.remainingCards.length; i++) {
      this.ai2Hand.push(this.remainingCards[i]);
    }
    this.updateAICount(2);
  }

  this.showBottomCards(this.remainingCards);
  this.setStatusText('\u5F00\u59CB\u51FA\u724C');

  var self = this;
  this.time.delayedCall(1200, function () {
    self.gameState = GAME_STATE.PLAYER_TURN;
    self.setStatusText('\u8F6E\u5230\u4F60\u51FA\u724C\uFF08\u81EA\u7531\u51FA\u724C\uFF09');
    self.showActionButtons();
  });
};

GameScene.prototype.restartGame = function () {
  // 销毁所有 UI 元素
  this.hideBiddingUI();
  this.scene.restart();
};

// 隐藏功能按钮
GameScene.prototype.hideActionButtons = function () {
  if (!this.actionButtons) return;
  for (var i = 0; i < this.actionButtons.length; i++) {
    if (this.actionButtons[i]) this.actionButtons[i].destroy();
  }
  this.actionButtons = [];
};

GameScene.prototype.showActionButtons = function () {
  this.hideActionButtons();
  createActionButtons(this);
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

  // \u51FA\u724C\u8BB0\u5F55+\u97F3\u6548
  this.addPlayHistory('player', playCards);
  SoundManager.playCard();

  if (this.playerHand.length === 0) {
    this.setStatusText('\u606D\u559C\u4F60\u8D62\u4E86\uFF01');
    showToast(this, '\u606D\u559C\u4F60\u8D62\u4E86\uFF01');
    this.gameState = GAME_STATE.ROUND_END;
    SoundManager.win();
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
  this.addPlayHistory('player', true);
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
  SoundManager.aiThink();

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
  // \u51FA\u724C\u8BB0\u5F55+\u97F3\u6548
  this.addPlayHistory(aiIndex === 0 ? 'ai1' : 'ai2', playCards);
  SoundManager.playCard();
  if (hand.length === 0) {
    this.setStatusText(aiName + ' \u51FA\u5B8C\u4E86\uFF01\u83B7\u80DC\uFF01');
    showToast(this, aiName + '\u83B7\u80DC\uFF01');
    this.gameState = GAME_STATE.ROUND_END;
    SoundManager.lose();
    return;
  }
  if (aiIndex === 0) {
    // AI1 played, now AI2's turn
    var self = this;
    this.setStatusText(aiName + ' \u51FA\u4E86 ' + (Doudizhu.HAND_TYPE_NAMES[info.type] || info.type) + '\uFF0C\u8F6E\u5230\u82CF\u751C\u751C');
    this.time.delayedCall(600, function () { self.doAITurn(1); });
  } else {
    this.gameState = GAME_STATE.PLAYER_TURN;
    SoundManager.playerTurn();
    this.setStatusText('\u8F6E\u5230\u4F60\u51FA\u724C');
  }
};

GameScene.prototype.handleAIPass = function (aiIndex, aiName) {
  this.passCount++;
  this.setStatusText(aiName + ' \u4E0D\u51FA');
  this.updateAICount(aiIndex);
  this.addPlayHistory(aiIndex === 0 ? 'ai1' : 'ai2', true);
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
  // \u51FA\u724C\u8BB0\u5F55+\u97F3\u6548
  this.addPlayHistory(aiIndex === 0 ? 'ai1' : 'ai2', chosen);
  SoundManager.playCard();
  if (hand.length === 0) {
    this.setStatusText(aiName + ' \u51FA\u5B8C\u4E86\uFF01\u83B7\u80FD\uFF01');
    showToast(this, aiName + '\u83B7\u80DC\uFF01');
    this.gameState = GAME_STATE.ROUND_END;
    SoundManager.lose();
    return;
  }
  if (aiIndex === 0) {
    // AI1 played (local), now AI2's turn
    var self = this;
    this.time.delayedCall(600, function () { self.doAITurn(1); });
  } else {
    this.gameState = GAME_STATE.PLAYER_TURN;
    SoundManager.playerTurn();
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
  var gfx;
  var baseX, baseY;
  if (player === 'player') {
    gfx = this.myPlayCardsGraphics;
    baseX = 300; baseY = 396;
  } else if (player === 'ai1') {
    gfx = this.ai1PlayCardsGraphics;
    baseX = 80; baseY = 177;
  } else {
    gfx = this.ai2PlayCardsGraphics;
    baseX = 448; baseY = 177;
  }
  if (!gfx) return;
  gfx.clear();
  // Destroy old card text objects for this player
  var textKey = player + 'PlayTexts';
  if (this[textKey]) {
    this[textKey].forEach(function(t) { t.destroy(); });
  }
  this[textKey] = [];
  var cardW = 40, cardH = 54, gap = 4;
  var n = cards.length;
  var totalW = n * (cardW + gap) - gap;
  var startX = Math.round(baseX - totalW / 2);
  for (var i = 0; i < n; i++) {
    var c = cards[i];
    var cx = startX + i * (cardW + gap);
    var cy = Math.round(baseY - cardH / 2);
    // Card face
    gfx.fillStyle(0xFFFFFF, 1);
    gfx.fillRoundedRect(cx, cy, cardW, cardH, 3);
    gfx.lineStyle(1, 0x90A4AE, 0.8);
    gfx.strokeRoundedRect(cx, cy, cardW, cardH, 3);
    var isRed = c.isRed ? c.isRed() : (c.suit === 'heart' || c.suit === 'diamond');
    var display = c.displayName ? c.displayName() : Doudizhu.RANK_NAME_MAP[c.rank];
    var symbol = c.suitSymbol ? c.suitSymbol() : Doudizhu.SUIT_SYMBOLS[c.suit];
    // Build card text: rank + suit symbol
    var cardText = display + symbol;
    if (!symbol) cardText = display; // Joker: no suit symbol
    // Draw rank + suit as a Phaser Text object centered on the card
    var txt = this.add.text(cx + cardW / 2, cy + cardH / 2, cardText, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: isRed ? '#E53935' : '#212121',
      align: 'center'
    }).setOrigin(0.5).setDepth(12);
    this[textKey].push(txt);
  }
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
  var bw = 96, bh = 48, gap = 10;
  var totalW = bw * 4 + gap * 3;
  var startX = (600 - totalW) / 2;
  var btnY = 828;

  var buttons = [
    { label: '\u51FA\u724C', color: 0x4ECDC4, key: 'play' },
    { label: '\u63D0\u793A', color: 0xFFD93D, key: 'hint' },
    { label: '\u4E0D\u51FA', color: 0xFF6B6B, key: 'pass' },
    { label: '\u641E\u4E8B\u60C5', color: 0x7C4DFF, key: 'action' }
  ];

  if (!scene.actionButtons) scene.actionButtons = [];

  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    var bx = startX + i * (bw + gap);
    var bg = scene.add.graphics();
    bg.fillStyle(b.color, 1);
    bg.fillRoundedRect(bx, btnY, bw, bh, 8).setDepth(100);
    bg.setInteractive(new Phaser.Geom.Rectangle(bx, btnY, bw, bh), Phaser.Geom.Rectangle.Contains);
    scene.actionButtons.push(bg);

    var txt = scene.add.text(bx + bw / 2, btnY + bh / 2, b.label, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '16px', color: '#FFFFFF', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(101);
    scene.actionButtons.push(txt);

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
  var cx = 300;
  var toastBg = scene.add.graphics();
  toastBg.fillStyle(0x000000, 0.7);
  toastBg.fillRoundedRect(cx - 100, 461, 200, 38, 10).setDepth(200);
  var toastText = scene.add.text(cx, 480, message, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', color: '#FFFFFF'
  }).setOrigin(0.5).setDepth(201);
  scene.time.delayedCall(1200, function () {
    toastBg.destroy();
    toastText.destroy();
  });
}

// ================================================================
// 出牌记录区域
// ================================================================
function createPlayHistoryArea(scene) {
  var bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.25);
  bg.fillRoundedRect(12, 876, 576, 78, 8).setDepth(200);

  scene.add.text(24, 880, '最近出牌', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '9px', color: '#81C784'
  }).setDepth(201);

  scene.playHistoryText = scene.add.text(24, 892, '', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#C8E6C9',
    lineSpacing: 2,
    wordWrap: { width: 560 }
  }).setDepth(201);
}

GameScene.prototype.addPlayHistory = function (player, cardsOrPass) {
  var labels = { player: '你', ai1: '王怼怼', ai2: '苏甜甜' };
  var label = labels[player] || player;
  var entry;
  if (cardsOrPass === true) {
    // pass
    entry = { text: label + ': 不出', pass: true };
  } else if (cardsOrPass && cardsOrPass.length > 0) {
    var display = cardsOrPass.map(function (c) {
      return Doudizhu.RANK_NAME_MAP[c.rank] || '?';
    }).join(' ');
    entry = { text: label + ': ' + display, cards: cardsOrPass };
  } else {
    return; // ignore empty entries
  }
  this.playHistory.push(entry);
  // 只保留最近8条
  if (this.playHistory.length > 8) {
    this.playHistory = this.playHistory.slice(-8);
  }
  this.renderPlayHistory();
};

GameScene.prototype.renderPlayHistory = function () {
  if (!this.playHistoryText) return;
  var lines = [];
  for (var i = 0; i < this.playHistory.length; i++) {
    var entry = this.playHistory[i];
    lines.push(entry.text);
  }
  this.playHistoryText.setText(lines.join('\n'));
};

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
