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
  ROUND_END: 'ROUND_END',
  CHAOS_MODE: 'CHAOS_MODE'
};

var GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 600,
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
  scene: null,
  init: function (scene) {
    this.scene = scene;
    // \u6D17\u724C\u97F3\u6548 - \u5F00\u5C40\u65F6\u64AD\u653E
  },
  _random: function (base, count) {
    return base + (Math.floor(Math.random() * count) + 1);
  },
  playCard: function () {
    if (!this.scene) return;
    this.scene.sound.play(this._random('cardPlace', 3), { volume: 0.6 });
  },
  selectCard: function () {
    if (!this.scene) return;
    this.scene.sound.play(this._random('cardSlide', 3), { volume: 0.4 });
  },
  deselectCard: function () {
    if (!this.scene) return;
    this.scene.sound.play(this._random('cardSlide', 3), { volume: 0.3 });
  },
  playerTurn: function () {
    if (!this.scene) return;
    this.scene.sound.play(this._random('chipsCollide', 3), { volume: 0.5 });
  },
  bid: function () {
    if (!this.scene) return;
    this.scene.sound.play(this._random('chipsCollide', 3), { volume: 0.5 });
  },
  passBid: function () {
    if (!this.scene) return;
    this.scene.sound.play(this._random('cardSlide', 3), { volume: 0.3 });
  },
  win: function () {
    if (!this.scene) return;
    this.scene.sound.play('cardPlace3', { volume: 0.7 });
  },
  lose: function () {
    if (!this.scene) return;
    this.scene.sound.play('cardSlide1', { volume: 0.4 });
  },
  aiThink: function () {
    // no specific sound for AI thinking
  },
  pauseAll: function () {
    if (!this.scene) return;
    this.scene.sound.pauseAll();
  },
  resumeAll: function () {
    if (!this.scene) return;
    this.scene.sound.resumeAll();
  }
};

// ================================================================
// \u724C\u9762\u56FE\u7247\u5E2E\u52A9\u51FD\u6570
// ================================================================
function getCardImageKey(card) {
  if (card.suit === 'joker') return 'cardJoker';
  var suitMap = { spade:'Spades', heart:'Hearts', club:'Clubs', diamond:'Diamonds' };
  var rankNames = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
  return 'card' + suitMap[card.suit] + rankNames[card.rank];
}

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
  // \u5934\u50CF
  this.load.image('avatar_wang', 'assets/avatars/wang_duidui.png');
  this.load.image('avatar_su', 'assets/avatars/su_tiantian.png');

  // \u724C\u9762\u56FE\u7247 (54\u5F20)
  var suitNames = ['Clubs','Diamonds','Hearts','Spades'];
  var rankNames = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
  for (var si = 0; si < suitNames.length; si++) {
    for (var ri = 0; ri < rankNames.length; ri++) {
      var key = 'card' + suitNames[si] + rankNames[ri];
      this.load.image(key, 'assets/cards/' + key + '.png');
    }
  }
  this.load.image('cardJoker', 'assets/cards/cardJoker.png');
  this.load.image('cardBack', 'assets/cards/cardBack_blue1.png');

  // \u97F3\u6548
  for (var ai = 1; ai <= 3; ai++) {
    this.load.audio('cardPlace' + ai, 'assets/sounds/cardPlace' + ai + '.ogg');
    this.load.audio('cardSlide' + ai, 'assets/sounds/cardSlide' + ai + '.ogg');
    this.load.audio('chipsCollide' + ai, 'assets/sounds/chipsCollide' + ai + '.ogg');
  }
  this.load.audio('dieShuffle1', 'assets/sounds/dieShuffle1.ogg');
};

GameScene.prototype.create = function () {
  var self = this;
  drawTableBackground(this);
  createTopBar(this);
  createAIArea(this);
  createPlayArea(this);
  createHandArea(this);
  createActionButtons(this);

  this.renderPlayerHand();
  this.setStatusText('\u8F6E\u5230\u4F60\u51FA\u724C\uFF08\u81EA\u7531\u51FA\u724C\uFF09');

  // 初始化音效
  SoundManager.init(this);

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

  // \u9500\u6BC1\u65E7\u7684\u624B\u724C\u5BF9\u8C61
  for (var di = 0; di < this.cardDomElements.length; di++) {
    var old = this.cardDomElements[di];
    if (old) {
      if (old.img) old.img.destroy();
      old.destroy();
    }
  }
  this.cardDomElements = [];
  this.handCards = [];

  var n = hand.length, cw = 56, ch = 84;
  var overlap = n > 6 ? Math.min(28, (520 - cw) / (n - 1)) : 28;
  var totalWidth = cw + (n - 1) * overlap;
  var startX = (600 - totalWidth) / 2;
  var baseY = 700;

  for (var ii = 0; ii < n; ii++) {
    var card = hand[ii];
    var cx = startX + ii * overlap + cw / 2;
    var arcOffset = Math.pow((ii / (n - 1)) - 0.5, 2) * 36;
    var cy = baseY - arcOffset;
    var key = getCardImageKey(card);

    var img = self.add.image(cx, cy, key).setDisplaySize(cw, ch).setDepth(110);

    // \u70B9\u51FB\u4E0E\u9009\u62E9
    img.setInteractive();
    img.setData('cardIdx', ii);
    img.setData('card', card);
    img.setData('selected', false);
    img.setData('origY', cy);

    img.on('pointerdown', function () {
      if (self.gameState !== GAME_STATE.PLAYER_TURN) {
        showToast(self, '\u73B0\u5728\u4E0D\u662F\u4F60\u7684\u51FA\u724C\u9636\u6BB5');
        return;
      }
      var idx2 = this.getData('cardIdx');
      var s = this.getData('selected');
      if (s) {
        this.y += 28;
        this.setData('selected', false);
        var pos = self.selectedCards.indexOf(idx2);
        if (pos >= 0) self.selectedCards.splice(pos, 1);
        SoundManager.deselectCard();
      } else {
        this.y -= 28;
        this.setData('selected', true);
        self.selectedCards.push(idx2);
        SoundManager.selectCard();
      }
    });

    self.cardDomElements.push(img);
    self.handCards.push(img);
  }
};
// ================================================================

GameScene.prototype._clearCardSelection = function () {
  for (var ci = 0; ci < this.cardDomElements.length; ci++) {
    var el = this.cardDomElements[ci];
    if (!el) continue;
    var s = el.getData('selected');
    if (s) {
      var origY = el.getData('origY');
      if (origY !== undefined) el.y = origY;
      el.setData('selected', false);
    }
  }
};
GameScene.prototype._highlightCard = function (el) {
  if (!el) return;
  el.setData('selected', true);
  var origY = el.getData('origY');
  if (origY !== undefined) el.y = origY - 28;
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
  // \u6E05\u9664\u65E7\u7684\u5E95\u724C\u56FE\u7247
  if (this.bottomCardImgs) {
    for (var bi = 0; bi < this.bottomCardImgs.length; bi++) this.bottomCardImgs[bi].destroy();
  }
  this.bottomCardImgs = [];

  if (!cards || cards.length === 0) {
    // \u6CA1\u6709\u5E95\u724C\u65F6\u663E\u793A\u95EE\u53F7
    if (this.bottomCardText) this.bottomCardText.destroy();
    this.bottomCardText = this.add.text(300, 451, '\u5E95\u724C: ? ? ?', {
      fontFamily: '\u201CPingFang SC\u201D,\u201CMicrosoft YaHei\u201D,sans-serif',
      fontSize: '9px', color: '#66BB6A', alpha: 0.4
    }).setOrigin(0.5).setDepth(20);
    return;
  }

  if (this.bottomCardText) this.bottomCardText.destroy();

  // \u663E\u793A3\u5F20\u724C\u80CC\u56FE\u7247
  var startX = 300 - 80;
  var arr = [];
  for (var bj = 0; bj < Math.min(cards.length, 3); bj++) {
    var bImg = this.add.image(startX + bj * 60, 451, 'cardBack').setDisplaySize(50, 70).setDepth(20);
    arr.push(bImg);
  }
  this.bottomCardImgs = arr;
};

// ================================================================
// 叫地主 - 本地逻辑
// ================================================================
GameScene.prototype.localAssignLandlord = function () {
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
  this.setStatusText('开始出牌');
  var self = this;
  this.time.delayedCall(1200, function () {
    self.gameState = GAME_STATE.PLAYER_TURN;
    self.setStatusText('轮到你出牌（自由出牌）');
    self.showActionButtons();
  });
};

// ================================================================
// 重开游戏 & 隐藏功能按钮
// ================================================================
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
  // \u53EA\u68C0\u67E5\u670D\u52A1\u5668\u662F\u5426\u5728\u7EBF\uFF0C\u4E0D\u53D1\u771F\u5B9E\u724C\u68C0\u6D4B
  apiGetSimple('/api/health')
    .then(function (res) {
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

function apiGetSimple(path) {
  var url = 'http://localhost:3100' + path;
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
        else reject(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = function () { reject(new Error('Network error')); };
    xhr.send();
  });
}

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
    // \u81EA\u7531\u51FA\u724C\u6743\u7ED9\u4E0A\u4E00\u8F6E\u6700\u540E\u51FA\u724C\u8005
    if (this.lastPlayPlayer !== 'player') {
      var aiIdx = this.lastPlayPlayer === 'ai1' ? 0 : 1;
      var aiName = this.lastPlayPlayer === 'ai1' ? '\u738B\u603C\u603C' : '\u82CF\u751C\u751C';
      var selfB1 = this;
      this.setStatusText('\u4E24\u5BB6\u90FD\u8FC7\uFF0C\u8F6E\u5230' + aiName);
      this.time.delayedCall(500, function () { selfB1.doAITurn(aiIdx); });
    } else {
      this.gameState = GAME_STATE.PLAYER_TURN;
      this.setStatusText('\u4E24\u5BB6\u90FD\u8FC7\uFF0C\u8F6E\u5230\u4F60\u81EA\u7531\u51FA\u724C');
    }
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
    // \u5339\u914D\u5931\u8D25\u65F6\u4F7F\u7528\u5DF2\u6210\u529F\u5339\u914D\u7684\u724C\uFF0C\u800C\u4E0D\u662F\u5E9F\u5F03\u5168\u90E8
    if (playCards.length > 0) {
      var partialInfo = Doudizhu.identifyType(playCards);
      if (partialInfo.type !== 'INVALID') {
        // \u5339\u914D\u90E8\u5206\u6709\u6548\u724C\u578B\uFF0C\u7528\u5B83
        console.warn('Partial match:', playCards.length, '/', apiCards.length);
      } else {
        this.localAIPlay(aiIndex, aiName);
        return;
      }
    } else {
      this.localAIPlay(aiIndex, aiName);
      return;
    }
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
    // \u81EA\u7531\u51FA\u724C\u6743\u7ED9\u4E0A\u4E00\u8F6E\u6700\u540E\u51FA\u724C\u8005\uFF08\u4E0D\u662F\u5F53\u524Dpass\u7684\u4EBA\uFF09
    if (this.lastPlayPlayer === 'player') {
      this.gameState = GAME_STATE.PLAYER_TURN;
      this.setStatusText('\u4E24\u5BB6\u90FD\u8FC7\uFF0C\u8F6E\u5230\u4F60\u81EA\u7531\u51FA\u724C');
    } else {
      var lastAiIdx = this.lastPlayPlayer === 'ai1' ? 0 : 1;
      var lastAiName = this.lastPlayPlayer === 'ai1' ? '\u738B\u603C\u603C' : '\u82CF\u751C\u751C';
      this.setStatusText('\u4E24\u5BB6\u90FD\u8FC7\uFF0C\u8F6E\u5230' + lastAiName);
      var selfB1b = this;
      this.time.delayedCall(500, function () { selfB1b.doAITurn(lastAiIdx); });
    }
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
  // \u7B80\u5355\u7B56\u7565: \u4F18\u5148\u51FA\u6700\u5C0F\u7684\u724C\u578B\uFF08\u5355\u5F20>\u5BF9\u5B50>\u4E09\u5F20>\u987A\u5B50>\u70B8\u5F39\uFF09
  var chosen = plays[0];
  // \u5982\u679C\u662F\u81EA\u7531\u51FA\u724C\u4E14\u6709\u5355\u5F20\u53EF\u51FA\uff0c\u9009\u6700\u5C0F\u7684\u5355\u5F20
  if (!this.lastPlay || this.lastPlay.length === 0) {
    var singlePlay = null;
    for (var pi = 0; pi < plays.length; pi++) {
      if (plays[pi].length === 1) { singlePlay = plays[pi]; break; }
    }
    if (singlePlay) chosen = singlePlay;
  }
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
    this.setStatusText(aiName + ' \u51FA\u5B8C\u4E86\uFF01\u83B7\u80DC\uFF01');
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
  // \u6E05\u7406\u65E7\u7684\u51FA\u724C\u56FE\u7247
  var gfxKey = player === 'player' ? 'myPlayCardsGfx' : (player === 'ai1' ? 'ai1PlayCardsGfx' : 'ai2PlayCardsGfx');
  var oldGfx = this[gfxKey];
  if (oldGfx) {
    for (var gi = 0; gi < oldGfx.length; gi++) oldGfx[gi].destroy();
  }
  this[gfxKey] = [];

  if (!cards || cards.length === 0) return;

  // \u786E\u5B9A\u4F4D\u7F6E
  var positions = {
    player: { x: 300, y: 396, w: 45, h: 68, origin: 0.5 },
    ai1:    { x: 160, y: 175, w: 35, h: 53, origin: 0.5 },
    ai2:    { x: 420, y: 175, w: 35, h: 53, origin: 0.5 }
  };
  var pos = positions[player] || positions.player;
  var n = cards.length;
  var overlap = Math.min(pos.w * 0.6, (480 - pos.w) / Math.max(n - 1, 1));
  var totalW = pos.w + (n - 1) * overlap;
  var startX = pos.x - totalW / 2;
  var arr = this[gfxKey];

  for (var pi = 0; pi < n; pi++) {
    var pcx = startX + pi * overlap + pos.w / 2;
    var pkey = getCardImageKey(cards[pi]);
    var pimg = this.add.image(pcx, pos.y, pkey).setDisplaySize(pos.w, pos.h).setDepth(12);
    arr.push(pimg);
  }
};
GameScene.prototype.doAction = function () {
  var self = this;
  if (this.gameState !== GAME_STATE.PLAYER_TURN && this.gameState !== GAME_STATE.CHAOS_MODE) return;

  // \u6682\u505C\u51FA\u724C\u97F3\u6548
  SoundManager.pauseAll();

  // \u8BBE\u7F6E\u87BA\u65CB\u6A21\u5F0F
  this.gameState = GAME_STATE.CHAOS_MODE;
  this.chaosScore = this.chaosScore || 0;
  this.setStatusText('\u641E\u4E8B\u60C5\u4E2D...');

  // \u9009\u62E9\u88AB\u641E\u7684AI\u89D2\u8272
  var aiId = Math.random() < 0.5 ? 'duidui' : 'tiantian';
  var aiName = aiId === 'duidui' ? '\u738B\u603C\u603C' : '\u82CF\u751C\u751C';

  // \u521B\u5EFA\u906E\u7F69
  self._createChaosOverlay(function () {
    // \u7F29\u7565\u56DE\u8C03 - \u89E6\u53D1\u51FA\u9898
    self._showChaosQuestion(aiId, aiName);
  });
};

// ================================================================
// 搞事情 - 创建遮罩
// ================================================================
GameScene.prototype._createChaosOverlay = function (callback) {
  if (this.chaosOverlay) return;
  var self = this;

  // \u534A\u900F\u660E\u906E\u7F69
  var overlay = self.add.graphics();
  overlay.fillStyle(0x000000, 0.75);
  overlay.fillRect(0, 0, 600, 960).setDepth(300);
  overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 600, 960), Phaser.Geom.Rectangle.Contains);
  self.chaosElements = [overlay];
  self.chaosOverlay = overlay;

  // \u767D\u8272\u9898\u76EE\u5361\u7247\u80CC\u666F
  var cardBg = self.add.graphics();
  cardBg.fillStyle(0xFFFFFF, 1);
  cardBg.fillRoundedRect(36, 80, 528, 440, 16);
  // \u9634\u5F71\u6A21\u62DF
  cardBg.fillStyle(0x000000, 0.08);
  cardBg.fillRoundedRect(40, 84, 528, 440, 16);
  cardBg.setDepth(301);
  self.chaosElements.push(cardBg);
  self.chaosCardBg = cardBg;

  // \u201C\u641E\u4E8B\u60C5\u201D \u6807\u9898
  var title = self.add.text(300, 96, '🔥 搞\u4E8B\u60C5\uFF01 答\u9898\u6311\u6218', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '22px', color: '#FF6B35', fontStyle: 'bold'
  }).setOrigin(0.5, 0).setDepth(302);
  self.chaosElements.push(title);
  self.chaosTitle = title;

  // \u5206\u6570\u663E\u793A
  var scoreText = self.add.text(420, 100, '得分: ' + (self.chaosScore || 0), {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '14px', color: '#333333'
  }).setDepth(302);
  self.chaosElements.push(scoreText);
  self.chaosScoreText = scoreText;

  // AI \u53F0\u8BCD\u6C14\u6CE1
  self._showAiBubble(aiId, 'easy', 120);

  // \u5173\u6389\u6309\u94AE
  var closeBtnBg = self.add.graphics();
  closeBtnBg.fillStyle(0xE53935, 1);
  closeBtnBg.fillRoundedRect(520, 84, 36, 36, 18).setDepth(302);
  var closeBtnText = self.add.text(538, 102, '✖', {
    fontFamily: '"PingFang SC",sans-serif',
    fontSize: '18px', color: '#FFFFFF'
  }).setOrigin(0.5).setDepth(303);
  closeBtnBg.setInteractive(new Phaser.Geom.Rectangle(520, 84, 36, 36), Phaser.Geom.Rectangle.Contains);
  closeBtnBg.on('pointerup', function () { self._destroyChaos(); });
  self.chaosElements.push(closeBtnBg, closeBtnText);

  if (callback) callback();
};

// ================================================================
// 搞事情 - 显示题目（含4个选项）
// ================================================================
GameScene.prototype._showChaosQuestion = function (aiId, aiName) {
  var self = this;
  self.setStatusText(aiName + ' \u51FA\u9898\u4E2D...');

  if (this.isAPIMode && typeof ApiClient !== 'undefined') {
    ApiClient.generateChaosQuestion('random', 'normal', 1)
      .then(function (res) {
        if (res.success && res.questions && res.questions.length > 0) {
          self._renderQuestion(res.questions[0], aiId);
        } else {
          self._renderFallbackQuestion(aiId);
        }
      })
      .catch(function () {
        self._renderFallbackQuestion(aiId);
      });
  } else {
    self._renderFallbackQuestion(aiId);
  }
};

// ================================================================
// 搞事情 - 渲染题目
// ================================================================
GameScene.prototype._renderQuestion = function (q, aiId) {
  var self = this;
  self._clearQuestionArea();

  // \u9898\u76EE\u7C7B\u578B\u6807\u7B7E
  var typeLabel = q.questionType || q.type || '\u77E5\u8BC6\u9898';
  var typeIcon = '\U0001F9E0';
  if (typeLabel.indexOf('voc') >= 0 || typeLabel.indexOf('word') >= 0) typeIcon = '\U0001F4DA';
  if (typeLabel.indexOf('expr') >= 0) typeIcon = '\U0001F4AC';
  if (typeLabel.indexOf('trivia') >= 0) typeIcon = '\U0001F4A1';
  if (typeLabel.indexOf('life') >= 0) typeIcon = '\U0001F3E0';

  var tag = self.add.text(52, 150, typeIcon + ' ' + typeLabel, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '13px', color: '#FF6B35', fontStyle: 'bold'
  }).setDepth(302);
  self.chaosElements.push(tag);

  // \u9898\u76EE\u6B63\u6587
  var questionText = q.question || q.text || '\u6682\u65E0\u9898\u76EE';
  var qText = self.add.text(52, 176, questionText, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', color: '#222222',
    wordWrap: { width: 490 }, lineSpacing: 4
  }).setDepth(302);
  self.chaosElements.push(qText);

  // 4 \u4E2A\u9009\u9879\u6309\u94AE
  var options = q.options || {};
  var optionKeys = ['A', 'B', 'C', 'D'];
  var spacing = 54;
  var optStartY = 290;
  var optionLabels = { A: 'A', B: 'B', C: 'C', D: 'D' };

  self.chaosQuestionAnswered = false;

  for (var oi = 0; oi < optionKeys.length; oi++) {
    var ok = optionKeys[oi];
    var optText = options[ok];
    if (!optText) continue;

    var optY = optStartY + oi * spacing;
    var optBg = self.add.graphics();
    optBg.fillStyle(0xF5F5F5, 1);
    optBg.fillRoundedRect(48, optY, 504, 46, 10).setDepth(302);
    optBg.lineStyle(1.5, 0xCCCCCC, 1);
    optBg.strokeRoundedRect(48, optY, 504, 46, 10);
    optBg.setInteractive(new Phaser.Geom.Rectangle(48, optY, 504, 46), Phaser.Geom.Rectangle.Contains);

    // \u9009\u9879\u6807\u8BB0
    var optMarkBg = self.add.graphics();
    optMarkBg.fillStyle(0x4ECDC4, 1);
    optMarkBg.fillCircle(74, optY + 23, 14).setDepth(303);
    var optMarkTxt = self.add.text(74, optY + 23, ok, {
      fontFamily: '"PingFang SC",sans-serif',
      fontSize: '14px', color: '#FFFFFF', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(304);

    // \u9009\u9879\u6587\u672C
    // \u622A\u65AD\u592A\u957F\u7684\u6587\u672C
    var displayOpt = optText.length > 28 ? optText.substring(0, 28) + '...' : optText;
    var optTxt = self.add.text(96, optY + 23, displayOpt, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '14px', color: '#333333'
    }).setOrigin(0, 0.5).setDepth(303);

    // \u4FDD\u5B58\u9009\u9879\u6570\u636E
    optBg.setData('optKey', ok);
    optBg.setData('optBg', optBg);
    optBg.setData('optTxt', optTxt);
    optBg.setData('optMarkBg', optMarkBg);
    optBg.setData('optMarkTxt', optMarkTxt);
    optBg.setData('answer', q.answer);

    // \u7ED1\u5B9A\u70B9\u51FB\u4E8B\u4EF6
    (function (optBg, ok, optY) {
      optBg.on('pointerdown', function () {
        if (self.chaosQuestionAnswered) return;
        self.chaosQuestionAnswered = true;
        self._handleOptionClick(self, optBg, ok, aiId, q);
      });
    })(optBg, ok, optY);

    self.chaosElements.push(optBg, optMarkBg, optMarkTxt, optTxt);
  }
};

// ================================================================
// 搞事情 - 处理选项点击
// ================================================================
GameScene.prototype._handleOptionClick = function (self, optBg, optKey, aiId, q) {
  // \u9AD8\u4EAE\u9009\u4E2D\u9009\u9879
  var bg = optBg.getData('optBg');
  var txt = optBg.getData('optTxt');
  var markBg = optBg.getData('optMarkBg');
  var markTxt = optBg.getData('optMarkTxt');
  var answer = optBg.getData('answer');

  // \u9AD8\u4EAE\u6548\u679C
  if (markBg) {
    markBg.clear();
    markBg.fillStyle(0xFF6B35, 1);
    markBg.fillCircle(markBg.x + 74 - 48 - 26, optBg.y + 23, 14).setDepth(303);
  }

  // \u5C01\u952E\u5176\u4ED6\u9009\u9879
  for (var ci = 0; ci < self.chaosElements.length; ci++) {
    var el = self.chaosElements[ci];
    if (el && el.getData && el.getData('optKey') && el.getData('optKey') !== optKey) {
      el.alpha = 0.3;
    }
  }

  // \u5224\u65AD\u5BF9\u9519
  var isCorrect = (optKey === answer);
  if (isCorrect) {
    self.chaosScore = (self.chaosScore || 0) + 1;
    if (self.chaosScoreText) self.chaosScoreText.setText('得分: ' + self.chaosScore);
  }

  // \u663E\u793A\u53CD\u9988
  var feedbackScene = isCorrect ? 'correct' : 'wrong';
  var resultIcon = isCorrect ? '\u2705' : '\u274C';
  var resultText = isCorrect ? '\u7B54\u5BF9\u4E86\uFF01' : '\u7B54\u9519\u4E86\uFF01';
  var resultColor = isCorrect ? '#4CAF50' : '#E53935';

  // \u53CD\u9988\u6807\u5FD7
  var fbIcon = self.add.text(300, 420, resultIcon + ' ' + resultText, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '20px', color: resultColor, fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(305);
  self.chaosElements.push(fbIcon);

  // \u663E\u793A\u6B63\u786E\u7B54\u6848\u548C\u89E3\u6790
  if (!isCorrect && q.answer) {
    var correctAns = self.add.text(52, 450, '正确答案: ' + q.answer + '. ' + (q.options[q.answer] || ''), {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '12px', color: '#4CAF50',
      wordWrap: { width: 490 }
    }).setDepth(305);
    self.chaosElements.push(correctAns);
  }

  if (q.explanation) {
    var expl = self.add.text(52, 474, q.explanation, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '12px', color: '#666666',
      wordWrap: { width: 490 }
    }).setDepth(305);
    self.chaosElements.push(expl);
  }

  // AI \u53F0\u8BCD
  self._showAiBubble(aiId, feedbackScene, 460);

  // \u663E\u793A\u6309\u94AE - \u7EE7\u7EED\u641E\u4E8B\u60C5 / \u5173\u6389
  var btnY = 500;
  // \u201C\u7EE7\u7EED\u201D \u6309\u94AE
  var againBg = self.add.graphics();
  againBg.fillStyle(0x4ECDC4, 1);
  againBg.fillRoundedRect(60, btnY, 200, 40, 10).setDepth(305);
  var againTxt = self.add.text(160, btnY + 20, '🔄 \u518D\u6765\u4E00\u9898', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(306);
  againBg.setInteractive(new Phaser.Geom.Rectangle(60, btnY, 200, 40), Phaser.Geom.Rectangle.Contains);
  againBg.on('pointerup', function () {
    // \u518D\u6765\u4E00\u9898
    self.chaosQuestionAnswered = false;
    self._clearQuestionArea();
    var aiId2 = Math.random() < 0.5 ? 'duidui' : 'tiantian';
    self._showChaosQuestion(aiId2, aiId2 === 'duidui' ? '\u738B\u603C\u603C' : '\u82CF\u751C\u751C');
  });
  self.chaosElements.push(againBg, againTxt);

  // \u201C\u5173\u6389\u201D \u6309\u94AE
  var closeBg = self.add.graphics();
  closeBg.fillStyle(0xFF6B6B, 1);
  closeBg.fillRoundedRect(340, btnY, 200, 40, 10).setDepth(305);
  var closeTxt = self.add.text(440, btnY + 20, '✖ \u5173掉\u56DE\u724C', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(306);
  closeBg.setInteractive(new Phaser.Geom.Rectangle(340, btnY, 200, 40), Phaser.Geom.Rectangle.Contains);
  closeBg.on('pointerup', function () { self._destroyChaos(); });
  self.chaosElements.push(closeBg, closeTxt);

  // \u64AD\u653E\u97F3\u6548
  if (isCorrect) {
    SoundManager.win();
  } else {
    SoundManager.lose();
  }
};

// ================================================================
// 搞事情 - 回退题目（后端不可用时）
// ================================================================
GameScene.prototype._renderFallbackQuestion = function (aiId) {
  var self = this;
  var fallbackQuestions = [
    {
      question: 'The word "abandon" means:',
      options: { A: '\u653E\u5F03', B: '\u63A5\u53D7', C: '\u5EFA\u7ACB', D: '\u53D1\u73B0' },
      answer: 'A', explanation: 'abandon \u610F\u4E3A"\u653E\u5F03"\uFF0C\u662F\u56DB\u7EA7\u5FC3\u8BCD\u6C47\u3002'
    },
    {
      question: '\u201CI\'m feeling under the weather\u201D \u610F\u601D\u662F:',
      options: { A: '\u5728\u5929\u6C14\u4E0B\u9762', B: '\u751F\u75C5\u4E86', C: '\u559C\u6B22\u4E0D\u540C\u5929\u6C14', D: '\u50BB\u50BB\u7B28\u7B28' },
      answer: 'B', explanation: '"Under the weather"\u662F\u5730\u9053\u53E3\u8BEd\uFF0C\u610F\u4E3A"\u751F\u75C5\u4E0D\u8212\u670D"\u3002'
    },
    {
      question: '\u54EA\u4E2A\u52A8\u7269\u51E0\u4E4E\u4E0D\u751F\u764C\u75C7\uFF1F',
      options: { A: '\u9CA8\u9C7C', B: '\u5927\u8C61', C: '\u88F8\u9F20\u9F20', D: '\u4E4C\u9F9F' },
      answer: 'C', explanation: '\U0001F9EC \u88F8\u9F20\u9F20\u51E0\u4E4E\u4ECE\u4E0D\u60A3\u764C\u75C7\uFF01\u5B83\u4EEC\u4F53\u5185\u6709\u7279\u6B8A\u7684\u900F\u660E\u8D28\u9178\u80FD\u963B\u6B62\u764C\u7EC6\u80DE\u5206\u88C2\u3002'
    },
    {
      question: '\u54EA\u79CD\u65B9\u6CD5\u80FD\u8BA9\u5207\u6D0B\u8471\u4E0D\u6D41\u6CEA\uFF1F',
      options: { A: '\u51B7\u51BB30\u5206\u949F', B: '\u542B\u4E00\u53E3\u6C34', C: '\u6234\u6CF3\u955C', D: '\u5FAE\u6CE2\u52A010\u79D2' },
      answer: 'C', explanation: '\U0001F576\uFE0F \u6234\u6CF3\u955C\u662F\u6700\u76F4\u63A5\u7684\u7269\u7406\u65B9\u6CD5——\u963B\u6B62\u50AC\u6CEA\u6C14\u4F53\u63A5\u89E6\u773C\u775B\u3002\u51B7\u51BB\u4E5F\u6709\u6548\u4F46\u6548\u679C\u6709\u9650\u3002'
    }
  ];
  var q = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
  q.questionType = '\u672C\u5730\u9898\u5E93';
  self._renderQuestion(q, aiId);
};

// ================================================================
// 搞事情 - AI \u6C14\u6CE1
// ================================================================
GameScene.prototype._showAiBubble = function (aiId, sceneKey, y) {
  var self = this;
  // \u6E05\u9664\u65E7\u6C14\u6CE1
  if (self.chaosBubbleElements) {
    for (var bi = 0; bi < self.chaosBubbleElements.length; bi++) {
      self.chaosBubbleElements[bi].destroy();
    }
  }
  self.chaosBubbleElements = [];

  var line = pickAiLine(aiId, sceneKey);
  var aiDisplayName = aiId === 'duidui' ? '\u738B\u603C\u603C' : '\u82CF\u751C\u751C';
  var aiEmoji = aiId === 'duidui' ? '\U0001F60E' : '\U0001F60A';

  // AI \u5934\u50CF\u5706\u5708
  var avatar = self.add.graphics();
  avatar.fillStyle(aiId === 'duidui' ? 0x4FC3F7 : 0xFFB74D, 1);
  avatar.fillCircle(80, y + 14, 18).setDepth(302);
  var avatarTxt = self.add.text(80, y + 14, aiId === 'duidui' ? '\U0001F60E' : '\U0001F60A', {
    fontFamily: 'sans-serif',
    fontSize: '18px'
  }).setOrigin(0.5).setDepth(303);
  self.chaosBubbleElements.push(avatar, avatarTxt);

  // AI \u540D\u5B57
  var nameTxt = self.add.text(105, y - 2, aiDisplayName, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '12px', color: '#999999'
  }).setDepth(302);
  self.chaosBubbleElements.push(nameTxt);

  // \u53F0\u8BCD\u6C14\u6CE1
  var bubble = self.add.graphics();
  bubble.fillStyle(0x000000, 0.08);
  bubble.fillRoundedRect(100, y + 10, 440, 32, 8).setDepth(302);
  self.chaosBubbleElements.push(bubble);

  var bubbleTxt = self.add.text(112, y + 26, line, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '13px', color: '#444444'
  }).setDepth(303);
  self.chaosBubbleElements.push(bubbleTxt);
};

// ================================================================
// 搞事情 - 清除题目区域
// ================================================================
GameScene.prototype._clearQuestionArea = function () {
  var self = this;
  if (!self.chaosElements) return;
  // \u4FDD\u7559\u524D3\u4E2A\u5143\u7D20\uFF08\u906E\u7F69\u3001\u5361\u724C\u80CC\u666F\u3001\u6807\u9898\u3001\u5206\u6570\u3001\u5173\u6389\u6309\u94AE\uFF09
  var toKeep = self.chaosElements.slice(0, 5); // overlay, cardBg, title, scoreText, AI bubble area elements
  for (var di = 5; di < self.chaosElements.length; di++) {
    if (self.chaosElements[di]) self.chaosElements[di].destroy();
  }
  self.chaosElements = toKeep;
  // \u4E5F\u6E05\u9664\u6C14\u6CE1
  if (self.chaosBubbleElements) {
    for (var ei = 0; ei < self.chaosBubbleElements.length; ei++) {
      if (self.chaosBubbleElements[ei]) self.chaosBubbleElements[ei].destroy();
    }
    self.chaosBubbleElements = [];
  }
};

// ================================================================
// 搞事情 - 销毁搞事情UI，恢复出牌
// ================================================================
GameScene.prototype._destroyChaos = function () {
  if (this.chaosElements) {
    for (var i = 0; i < this.chaosElements.length; i++) {
      if (this.chaosElements[i]) this.chaosElements[i].destroy();
    }
  }
  if (this.chaosBubbleElements) {
    for (var j = 0; j < this.chaosBubbleElements.length; j++) {
      if (this.chaosBubbleElements[j]) this.chaosBubbleElements[j].destroy();
    }
  }
  this.chaosElements = null;
  this.chaosBubbleElements = null;
  this.chaosOverlay = null;
  this.chaosQText = null;
  this.chaosScoreText = null;
  this.chaosTitle = null;
  this.chaosCardBg = null;

  // \u6062\u590D\u51FA\u724C\u97F3\u6548
  SoundManager.resumeAll();

  // \u6062\u590D\u6E38\u620F\u72B6\u6001
  this.gameState = GAME_STATE.PLAYER_TURN;
  this.setStatusText('\u641E\u4E8B\u60C5\u7ED3\u675F\uFF0C\u7EE7\u7EED\u51FA\u724C');
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
// AI 台词池 - 搞事情模式
// ================================================================
var AI_LINES = {
  duidui: {
    easy: [
      '送分题，给人类的惬悭。',
      '这题你要是都答不上来……喎。',
      '热身而已，别紧张到冒汗。',
      '我幼儿园数据集里就有这道题。',
    ],
    hard: [
      '这道题，我调参调了 0.0001 秒出的。',
      '人类的 CPU 该升级了。',
      '瞪大眼睛，别眨眼，反正你也答不对。',
      '终于到了有趣的部分——看你吃凿。',
    ],
    bomb: [
      'U0001F680 炸弹！不是，这题你能答对我倒立洗头。',
      '核弹级题目，建议你直接过牌。',
      '这道题的正确答案，在我的隐藏层里。',
      '人类训练集里没有这道题，放弃吧。',
    ],
    correct: [
      '哼，蒙对的吧？',
      '这次算你走运。',
      '不错嘛，人类有时候也能猜对。',
      '意外意外，我以为你会选错的。',
    ],
    wrong: [
      '哈哈哈哈哈！果然不出所料！',
      '这种题都会选错？你是来斗地主还是来斗笨的？',
      '我的数据库显示，你答错率 100%。',
      '答错的方式处处相同，答对的人各有各的契机。开玩笑的，没人答对。',
    ],
    close: [
      '行吧，回来打牌。',
      '搞事情结束，继续被我输组。',
      '好了好了，不耍你了，继续出牌吧。',
    ]
  },
  tiantian: {
    easy: [
      '这道题送你啦！不客气！',
      '简单得我都不好意思出！但我还是出了嘿嘿',
      '热身题！把你的小脑瓜转起来～',
      '这题是幼儿园水平，你肯定……应该……大概会吧？',
    ],
    hard: [
      '这一题！我熬了三个通宵准备的！',
      '✨ 超超超难题闪亮登场！希望人没事 U0001F64F',
      '这题你答对了我就……请你吃虚拟冰淇淋！',
      '难度拉满！我的CPU在燃烧！💥',
    ],
    bomb: [
      'U0001F4A3 BOMBSHELL！全场的目光集中到我身上！',
      '这道题核能级！建议你场外求助——但你没有场外求助哈哈',
      '我要放！大！招！了！观众朋友们小板凳端好！',
      '这一题，我赌你哭 U0001F602',
    ],
    correct: [
      '咧哇₼！你真的会！！！',
      '太棒啦！你是我见过最聪明的人类！',
      '正确！我准备好了下一题继续难你！',
      '花式鼓掌👏👏👏',
    ],
    wrong: [
      '啊啊啊错了！我……裂……开……了……U0001F62D',
      '不是吧！这简直……好玩！哈哈哈哈哈！',
      '我没想到你会选这个！好呆蒙啊😆',
      '错了错了！来来来看看答案是什么……我也看看！',
    ],
    close: [
      '回来打牌啦！哈哈哈！',
      '搞完了搞完了，继续斗地主～',
      '开心吗？我很开心！继续玩！',
    ]
  }
};

function getRandomLine(pool) {
  if (!pool || pool.length === 0) return '...';
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickAiLine(aiId, sceneKey) {
  var ai = AI_LINES[aiId];
  if (!ai) return '...';
  var pool = ai[sceneKey];
  return getRandomLine(pool);
}
