/**
 * game.js - 斗地主 Phaser 3 主游戏
 * 960x600 横屏布局
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
  audio: {
    disableWebAudio: false,
    noAudio: false
  },
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
    var self = this;
    function tryResume() {
      if (self.audioReady) return;
      var ctx = scene.sound && scene.sound.context;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(function () {
          self.audioReady = true;
          console.log('AudioContext resumed');
        }).catch(function () {});
      } else if (ctx && ctx.state === 'running') {
        self.audioReady = true;
      }
      if (!ctx) self.audioReady = true;
    }
    scene.input.on('pointerdown', tryResume);
    scene.time.delayedCall(500, tryResume);
  },
  audioReady: false,
  _ensureReady: function () {
    if (this.audioReady) return true;
    var ctx = this.scene && this.scene.sound && this.scene.sound.context;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume();
      return false;
    }
    if (!ctx) this.audioReady = true;
    return this.audioReady;
  },
  _random: function (base, count) {
    return base + (Math.floor(Math.random() * count) + 1);
  },
  playCard: function () {
    if (!this.scene || !this._ensureReady()) return;
    this.scene.sound.play(this._random('cardPlace', 3), { volume: 0.8 });
  },
  selectCard: function () {
    if (!this.scene || !this._ensureReady()) return;
    this.scene.sound.play(this._random('cardSlide', 3), { volume: 0.6 });
  },
  deselectCard: function () {
    if (!this.scene || !this._ensureReady()) return;
    this.scene.sound.play(this._random('cardSlide', 3), { volume: 0.5 });
  },
  playerTurn: function () {
    if (!this.scene || !this._ensureReady()) return;
    this.scene.sound.play(this._random('chipsCollide', 3), { volume: 0.7 });
  },
  bid: function () {
    if (!this.scene || !this._ensureReady()) return;
    this.scene.sound.play(this._random('chipsCollide', 3), { volume: 0.7 });
  },
  passBid: function () {
    if (!this.scene || !this._ensureReady()) return;
    this.scene.sound.play(this._random('cardSlide', 3), { volume: 0.5 });
  },
  win: function () {
    if (!this.scene || !this._ensureReady()) return;
    this.scene.sound.play('cardPlace3', { volume: 0.9 });
  },
  lose: function () {
    if (!this.scene || !this._ensureReady()) return;
    this.scene.sound.play('cardSlide1', { volume: 0.6 });
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
  g.fillRoundedRect(x - 20, y - 20, 40, 40, 10);
  g.lineStyle(2, 0xFFFFFF, 0.8);
  g.strokeRoundedRect(x - 28, y - 28, 56, 56, 10);
  var img = scene.add.image(x, y, key).setDisplaySize(34, 34).setDepth(12);
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
  var self = this;

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
  this.gameStartTime = Date.now();
  this.totalBombs = 0;
  this.rocketCount = 0;
  this.chaosScore = 0;
  this.chaosTimeoutTimer = null;
  // 重置气泡队列全局变量
  bubbleQueue = [];
  bubbleShowing = false;
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
    this.load.audio('cardPlace' + ai, ['assets/sounds/cardPlace' + ai + '.mp3', 'assets/sounds/cardPlace' + ai + '.ogg']);
    this.load.audio('cardSlide' + ai, ['assets/sounds/cardSlide' + ai + '.mp3', 'assets/sounds/cardSlide' + ai + '.ogg']);
    this.load.audio('chipsCollide' + ai, ['assets/sounds/chipsCollide' + ai + '.mp3', 'assets/sounds/chipsCollide' + ai + '.ogg']);
  }
  this.load.audio('dieShuffle1', ['assets/sounds/dieShuffle1.mp3', 'assets/sounds/dieShuffle1.ogg']);
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

  // B40: 全屏/缩放填满按钮（右上角）
  var fsBtn = self.add.text(940, 24, '⛶', {
    fontSize: '22px', color: '#FFFFFF',
    backgroundColor: '#00000066',
    padding: { x: 8, y: 6 }
  }).setOrigin(1, 0.5).setInteractive().setDepth(200);

  function zoomCanvasToFill() {
    var container = document.getElementById('game-container');
    if (!container) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      // 全屏：容器撑满全屏，Phaser.FILL缩放填满（允许左右裁剪，不裁顶部/底部按钮区域）
      container.style.width = window.innerWidth + 'px';
      container.style.height = window.innerHeight + 'px';
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      // 全屏时改为FILL模式填满屏幕（避免两侧绿边）
      game.scale.mode = Phaser.Scale.FILL;
      if (game && game.scale) game.scale.refresh();
    } else {
      // 退出全屏：恢复原始样式和FIT模式
      container.style.width = '';
      container.style.height = '';
      container.style.position = '';
      container.style.top = '';
      container.style.left = '';
      game.scale.mode = Phaser.Scale.FIT;
      if (game && game.scale) game.scale.refresh();
    }
  }

  fsBtn.on('pointerdown', function () {
    var el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  });

  document.addEventListener('fullscreenchange', zoomCanvasToFill);
  document.addEventListener('webkitfullscreenchange', zoomCanvasToFill);
  window.addEventListener('resize', zoomCanvasToFill);

  // 首次点击自动全屏
  var autoFSdone = false;
  self.input.once('pointerdown', function () {
    if (autoFSdone) return;
    autoFSdone = true;
    var el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(function(){});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
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
  var W = 960, H = 600;
  var bg = scene.add.graphics();
  bg.fillGradientStyle(0x1B5E20, 0x1B5E20, 0x0D3B0F, 0x0D3B0F, 1);
  bg.fillRect(0, 0, W, H);
  var glow = scene.add.graphics();
  glow.fillStyle(0x2E7D32, 0.15);
  glow.fillEllipse(W / 2, H / 2 - 40, 320, 354);
  glow.fillStyle(0x388E3C, 0.1);
  glow.fillEllipse(W / 2, H / 2 - 40, 240, 360);
  var border = scene.add.graphics();
  border.lineStyle(2, 0x4CAF50, 0.3);
  border.strokeRoundedRect(13, 52, W - 26, H - 130, 9);
  var diamond = scene.add.graphics();
  diamond.lineStyle(1, 0x66BB6A, 0.15);
  var cx = W / 2, cy = H / 2 - 40;
  diamond.strokeRect(cx - 80, cy - 83, 118, 166);
  diamond.strokeRect(cx - 48, cy - 59, 96, 118);

  // Decorative table corners
  var cPos = [[35, 63], [W-35, 63], [35, H-57], [W-35, H-57]];
  for (var ci = 0; ci < cPos.length; ci++) {
    var dx = cPos[ci][0], dy = cPos[ci][1];
    diamond.lineStyle(1, 0x4CAF50, 0.18);
    diamond.strokeCircle(dx, dy, 9);
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
  var tb = scene.add.graphics();
  tb.fillStyle(0x000000, 0.3);
  tb.fillRect(0, 0, 960, 56).setDepth(10);

  scene.roundText = scene.add.text(12, 9, '\u7B2C 1/10 \u56DE\u5408', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '12px', color: '#E8F5E9', fontStyle: 'bold'
  }).setDepth(11);

  // AI1 (left)
  var wAvatar = makeAvatarImage(scene, 'avatar_wang', 176, 20, 0x4FC3F7, '\u738B\u603C\u603C');
  scene.add.text(176, 9, '\u738B\u603C\u603C', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#E8F5E9', fontStyle: 'bold'
  }).setDepth(11);
  scene.ai1Count = scene.add.text(176, 22, '\u5269\u4F59 17 \u5F20', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#A5D6A7'
  }).setDepth(11);

  // AI2 (right)
  var sAvatar = makeAvatarImage(scene, 'avatar_su', 788, 20, 0xFFB74D, '\u82CF\u751C\u751C');
  scene.add.text(788, 9, '\u82CF\u751C\u751C', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#E8F5E9', fontStyle: 'bold'
  }).setDepth(11);
  scene.ai2Count = scene.add.text(788, 22, '\u5269\u4F59 17 \u5F20', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#A5D6A7'
  }).setDepth(11);

  // center status text
  scene.statusText = scene.add.text(480, 9, '', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#A5D6A7', fontStyle: 'bold'
  }).setOrigin(0.5, 0).setDepth(11);

  var sep = scene.add.graphics();
  sep.lineStyle(1, 0x66BB6A, 0.2);
  sep.lineBetween(0, 56, 960, 56);
  sep.setDepth(11);
}

// ================================================================
// AI 区域
// ================================================================
function createAIArea(scene) {
  // AI moved to top bar
}

// ================================================================
// 中央出牌区
// ================================================================
function createPlayArea(scene) {
  var cx = 480;
  var playBg = scene.add.graphics();
  playBg.fillStyle(0x000000, 0.1);
  playBg.fillRoundedRect(160, 59, 640, 206, 10).setDepth(10);

  scene.add.text(cx, 218, '\u51FA\u724C\u533A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#66BB6A', alpha: 0.4
  }).setOrigin(0.5).setDepth(11);

  scene.ai1PlayLabel = scene.add.text(182, 65, '\u738B\u603C\u603C\uFF1A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#A5D6A7'
  }).setDepth(11);
  scene.ai1PlayCardsGraphics = scene.add.graphics().setDepth(11);

  scene.ai2PlayLabel = scene.add.text(690, 65, '\u82CF\u751C\u751C\uFF1A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#A5D6A7'
  }).setDepth(11);
  scene.ai2PlayCardsGraphics = scene.add.graphics().setDepth(11);

  scene.myPlayLabel = scene.add.text(cx, 270, '\u4F60\u51FA\uFF1A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#A5D6A7'
  }).setOrigin(0.5).setDepth(11);
  scene.myPlayCardsGraphics = scene.add.graphics().setDepth(11);

  scene.add.text(460, 60, '\u5E95\u724C: ? ? ?', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '8px', color: '#66BB6A', alpha: 0.4
  }).setDepth(11);
}

// ================================================================
// 手牌区
// ================================================================
function createHandArea(scene) {
  var handBg = scene.add.graphics();
  handBg.fillStyle(0x000000, 0.15);
  handBg.fillRoundedRect(20, 300, 920, 115, 10).setDepth(10);
  scene.add.text(68, 305, '\u4F60\u7684\u624B\u724C', {
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

  // B4: 增大手牌尺寸以适配600px画布
  var n = hand.length, cw = 56, ch = 80;
  var overlap = n > 6 ? Math.min(33, (700 - cw) / (n - 1)) : 33;
  var totalWidth = cw + (n - 1) * overlap;
  var startX = 180 + (700 - totalWidth) / 2;
  var baseY = 345;

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
        this.y += 16;
        this.setData('selected', false);
        var pos = self.selectedCards.indexOf(idx2);
        if (pos >= 0) self.selectedCards.splice(pos, 1);
        SoundManager.deselectCard();
      } else {
        this.y -= 16;
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
  if (origY !== undefined) el.y = origY - 16;
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

  var cx = 480;
  var uiY = 280;
  var bids = [
    { label: '\u4E0D\u53EB', value: 0, color: 0xFF6B6B },
    { label: '1\u5206', value: 1, color: 0x4ECDC4 },
    { label: '2\u5206', value: 2, color: 0xFFD93D },
    { label: '3\u5206', value: 3, color: 0xFF6B35 }
  ];

  // 提示文字
  var promptText = this.add.text(cx, 170, '\u8BF7\u53EB\u5206', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(200);
  this.biddingUI.push(promptText);

  var bw = 96, bh = 52, gap = 12;
  var totalW = bw * 4 + gap * 3;
  var startX = (960 - totalW) / 2;

  for (var i = 0; i < bids.length; i++) {
    var b = bids[i];
    var bx = startX + i * (bw + gap);

    var bg = this.add.graphics().setDepth(200);
    bg.fillStyle(b.color, 1);
    bg.fillRoundedRect(bx, uiY, bw, bh, 10);
    bg.setInteractive(new Phaser.Geom.Rectangle(bx, uiY, bw, bh), Phaser.Geom.Rectangle.Contains);

    var txt = this.add.text(bx + bw / 2, uiY + bh / 2, b.label, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '14px', color: '#FFFFFF', fontStyle: 'bold'
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
    var infoText = this.add.text(cx, 260, '\u2605 ' + label + ' (\u5F3A\u5EA6\u5206: ' + strength + ')', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '10px', color: '#A5D6A7'
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

  if (this.bottomCardText) this.bottomCardText.destroy();

  if (!cards || cards.length === 0) {
    // \u6CA1\u6709\u5E95\u724C\u65F6\u663E\u793A\u95EE\u53F7
    this.bottomCardText = this.add.text(480, 72, '\u5E95\u724C: ? ? ?', {
      fontFamily: '\u201CPingFang SC\u201D,\u201CMicrosoft YaHei\u201D,sans-serif',
      fontSize: '8px', color: '#66BB6A', alpha: 0.4
    }).setOrigin(0.5).setDepth(20);
    return;
  }
  // B38: \u53D6\u6D88\u663E\u793A\u5E95\u724C\u724C\u80CC\u56FE\u7247\uFF0C\u5E95\u724C\u76F4\u63A5\u878D\u5165\u5730\u4E3B\u624B\u724C
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
    var key = playCards[i].suit + ':' + playCards[i].rank;
    playSet[key] = (playSet[key] || 0) + 1;
  }
  for (var j = this.playerHand.length - 1; j >= 0; j--) {
    var key = this.playerHand[j].suit + ':' + this.playerHand[j].rank;
    if (playSet[key] > 0) { playSet[key]--; this.playerHand.splice(j, 1); }
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
  if (info.type === 'BOMB' || info.type === 'ROCKET') this.totalBombs++;
  if (info.type === 'ROCKET') this.rocketCount++;

  if (this.playerHand.length === 0) {
    SoundManager.win();
    this.renderRoundEndPanel('player');
    return;
  }
  this.gameState = GAME_STATE.WAITING_AI;
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
      this.gameState = GAME_STATE.WAITING_AI;
      this.time.delayedCall(800, function () { selfB1.doAITurn(aiIdx); });
    } else {
      this.gameState = GAME_STATE.PLAYER_TURN;
      this.setStatusText('\u4E24\u5BB6\u90FD\u8FC7\uFF0C\u8F6E\u5230\u4F60\u81EA\u7531\u51FA\u724C');
    }
    return;
  }
  var self = this;
  this.gameState = GAME_STATE.WAITING_AI;
  this.time.delayedCall(800, function () { self.doAITurn(0); });
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
    this.renderRoundEndPanel(aiIndex === 0 ? 'ai1' : 'ai2');
    return;
  }

  if (this.isAPIMode && typeof ApiClient !== 'undefined') {
    this.time.delayedCall(1200, function () {
      if (typeof ApiClient !== 'undefined') {
        ApiClient.aiPlay(hand, self.lastPlay)
          .then(function (res) {
            if (res.canPlay === false || !res.choice) {
              self.handleAIPass(aiIndex, aiName);
            } else {
              self.handleAIPlay(aiIndex, aiName, res);
            }
          })
          .catch(function () { self.localAIPlay(aiIndex, aiName); });
      } else {
        self.localAIPlay(aiIndex, aiName);
      }
    });
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
  var bubbleKey = info.type === 'BOMB' || info.type === 'ROCKET' ? 'bomb' : 'play';
  this._showPlayBubble(aiIndex === 0 ? 'duidui' : 'tiantian', bubbleKey, info.type);
  if (info.type === 'BOMB' || info.type === 'ROCKET') this.totalBombs++;
  if (info.type === 'ROCKET') this.rocketCount++;
  if (hand.length === 0) {
    this.renderRoundEndPanel(aiIndex === 0 ? 'ai1' : 'ai2');
    return;
  }
  if (aiIndex === 0) {
    // AI1 played, now AI2's turn
    var self = this;
    this.setStatusText(aiName + ' \u51FA\u4E86 ' + (Doudizhu.HAND_TYPE_NAMES[info.type] || info.type) + '\uFF0C\u8F6E\u5230\u82CF\u751C\u751C');
    this.time.delayedCall(1200, function () { self.doAITurn(1); });
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
  this._showPlayBubble(aiIndex === 0 ? 'duidui' : 'tiantian', 'pass', '');
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
      this.time.delayedCall(1200, function () { selfB1b.doAITurn(lastAiIdx); });
    }
    return;
  }
  if (aiIndex === 0) {
    // AI1 passed, now AI2's turn
    var self = this;
    this.setStatusText(aiName + ' \u4E0D\u51FA\uFF0C\u8F6E\u5230\u82CF\u751C\u751C');
    this.time.delayedCall(1200, function () { self.doAITurn(1); });
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
  var bubbleKey = info.type === 'BOMB' || info.type === 'ROCKET' ? 'bomb' : 'play';
  this._showPlayBubble(aiIndex === 0 ? 'duidui' : 'tiantian', bubbleKey, info.type);
  if (info.type === 'BOMB' || info.type === 'ROCKET') this.totalBombs++;
  if (info.type === 'ROCKET') this.rocketCount++;
  if (hand.length === 0) {
    this.renderRoundEndPanel(aiIndex === 0 ? 'ai1' : 'ai2');
    return;
  }
  if (aiIndex === 0) {
    // AI1 played (local), now AI2's turn
    var self = this;
    this.time.delayedCall(1200, function () { self.doAITurn(1); });
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
    player: { x: 360, y: 195, w: 50, h: 72, origin: 0.5 },
    ai1:    { x: 280, y: 133, w: 42, h: 60, origin: 0.5 },
    ai2:    { x: 680, y: 133, w: 42, h: 60, origin: 0.5 }
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
    var pimg = this.add.image(pcx, pos.y, pkey).setDisplaySize(pos.w, pos.h).setDepth(21);
    arr.push(pimg);
    // 移除旧的牌面叠加文字 — 卡片图片已显示完整牌面，多余文字覆盖导致看不清
  }
};
GameScene.prototype.doAction = function () {
  var self = this;
  if (this.gameState !== GAME_STATE.PLAYER_TURN && this.gameState !== GAME_STATE.CHAOS_MODE) return;

  // 暂停出牌音效
  SoundManager.pauseAll();

  // 设置螺旋模式
  this.gameState = GAME_STATE.CHAOS_MODE;
  this.chaosScore = this.chaosScore || 0;
  this.setStatusText('选题型...');

  // 选择被搞的AI角色
  var aiId = Math.random() < 0.5 ? 'duidui' : 'tiantian';
  var aiName = aiId === 'duidui' ? '王怼怼' : '苏甜甜';

  // 创建遮罩 -> 先显示题型选择
  self._createChaosOverlay(aiId, function () {
    self._showTypeSelection(aiId, aiName);
  });
};

GameScene.prototype._showTypeSelection = function (aiId, aiName) {
  var self = this;
  self.chaosTypeSelection = true;
  // B34: 显示题型选择时隐藏主标题，避免重叠
  if (self.chaosTitle) self.chaosTitle.setVisible(false);

  var types = [
    { id: 'vocabulary', label: '四六级单词', icon: '📚', desc: '看释义选单词，AI给你出牌' },
    { id: 'expression', label: '口语表达', icon: '💬', desc: '地道俚语挑战，口语达人' },
    { id: 'trivia', label: '冷知识', icon: '🧠', desc: '奇怪的知识增加了' },
    { id: 'life_hack', label: '生活常识', icon: '🏠', desc: '生活小窍门，你真的会吗' }
  ];

  var title2 = self.add.text(480, 77, '📋 选个题型，开始搞事情', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '14px', color: '#333333', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(302);
  self.chaosElements.push(title2);

  // 2x2 网格：题型卡片
  var cardX = [220, 500];
  var cardY = [107, 181];
  var cardW = 260, cardH = 88;

  for (var ti = 0; ti < types.length; ti++) {
    var t = types[ti];
    var cx = cardX[ti % 2];
    var cy = cardY[Math.floor(ti / 2)];

    var card = self.add.graphics();
    card.fillStyle(0xF0F4FF, 1);
    card.fillRoundedRect(cx, cy, cardW, cardH, 10).setDepth(302);
    card.lineStyle(1.5, 0xCCD8FF, 1);
    card.strokeRoundedRect(cx, cy, cardW, cardH, 10);
    card.setInteractive(new Phaser.Geom.Rectangle(cx, cy, cardW, cardH), Phaser.Geom.Rectangle.Contains);

    var iconTxt = self.add.text(cx + 12, cy + 12, t.icon, {
      fontFamily: 'sans-serif', fontSize: '26px'
    }).setDepth(303);

    var labelTxt = self.add.text(cx + 58, cy + 14, t.label, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '14px', color: '#222222', fontStyle: 'bold'
    }).setDepth(303);

    var descTxt = self.add.text(cx + 58, cy + 40, t.desc, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '10px', color: '#888888'
    }).setDepth(303);

    self.chaosElements.push(card, iconTxt, labelTxt, descTxt);

    card.setData('typeId', t.id);
    (function (typeId) {
      card.on('pointerover', function () {
        this.clear();
        this.fillStyle(0xE0EAFF, 1);
        this.fillRoundedRect(cx, cy, cardW, cardH, 10);
        this.lineStyle(2, 0x7C4DFF, 1);
        this.strokeRoundedRect(cx, cy, cardW, cardH, 10);
      });
      card.on('pointerout', function () {
        this.clear();
        this.fillStyle(0xF0F4FF, 1);
        this.fillRoundedRect(cx, cy, cardW, cardH, 10);
        this.lineStyle(1.5, 0xCCD8FF, 1);
        this.strokeRoundedRect(cx, cy, cardW, cardH, 10);
      });
      card.on('pointerdown', function () {
        if (self.chaosTypeSelection) {
          self.chaosTypeSelection = false;
          // B34: 选完题型恢复主标题显示
          if (self.chaosTitle) self.chaosTitle.setVisible(true);
          // 销毁类型选择UI（保留基础元素：遮罩、卡片背景、标题栏、分数、关闭按钮）
          for (var di = self.chaosElements.length - 1; di >= 5; di--) {
            if (self.chaosElements[di]) self.chaosElements[di].destroy();
          }
          self.chaosElements = self.chaosElements.slice(0, 5);
          // 开始出题
          self._showChaosQuestion(aiId, aiName, typeId);
        }
      });
    })(t.id);
  }
};

// ================================================================
// 搞事情 - 创建遮罩
// ================================================================
GameScene.prototype._createChaosOverlay = function (aiId, callback) {
  if (this.chaosOverlay) return;
  var self = this;

  // \u534A\u900F\u660E\u906E\u7F69
  var overlay = self.add.graphics();
  overlay.fillStyle(0x000000, 0.75);
  overlay.fillRect(0, 0, 960, 600).setDepth(300);
  overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 960, 600), Phaser.Geom.Rectangle.Contains);
  self.chaosElements = [overlay];
  self.chaosOverlay = overlay;

  // \u767D\u8272\u9898\u76EE\u5361\u7247\u80CC\u666F
  var cardBg = self.add.graphics();
  cardBg.fillStyle(0xFFFFFF, 1);
  cardBg.fillRoundedRect(150, 55, 660, 320, 12);
  cardBg.fillStyle(0x000000, 0.08);
  cardBg.fillRoundedRect(154, 58, 660, 320, 12);
  cardBg.setDepth(301);
  self.chaosElements.push(cardBg);
  self.chaosCardBg = cardBg;

  // \u201C\u641E\u4E8B\u60C5\u201D \u6807\u9898
  var title = self.add.text(480, 77, '🔥 搞\u4E8B\u60C5\uFF01 答\u9898\u6311\u6218', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '19px', color: '#FF6B35', fontStyle: 'bold'
  }).setOrigin(0.5, 0).setDepth(302);
  self.chaosElements.push(title);
  self.chaosTitle = title;

  // \u5206\u6570\u663E\u793A
  var scoreText = self.add.text(660, 77, '得分: ' + (self.chaosScore || 0), {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '12px', color: '#333333'
  }).setDepth(302);
  self.chaosElements.push(scoreText);
  self.chaosScoreText = scoreText;

  // AI \u53F0\u8BCD\u6C14\u6CE1
  self._showAiBubble(aiId, 'easy', 180);
  self._chaosAiId = aiId;

  // \u5173\u6389\u6309\u94AE
  var closeBtnBg = self.add.graphics();
  closeBtnBg.fillStyle(0xE53935, 1);
  closeBtnBg.fillRoundedRect(720, 72, 20, 28, 10).setDepth(302);
  var closeBtnText = self.add.text(734, 83, '✖', {
    fontFamily: '"PingFang SC",sans-serif',
    fontSize: '15px', color: '#FFFFFF'
  }).setOrigin(0.5).setDepth(303);
  closeBtnBg.setInteractive(new Phaser.Geom.Rectangle(720, 72, 20, 20), Phaser.Geom.Rectangle.Contains);
  closeBtnBg.on('pointerup', function () { self._destroyChaos(); });
  self.chaosElements.push(closeBtnBg, closeBtnText);

  if (callback) callback();
};

// ================================================================
// 搞事情 - 显示题目（含4个选项）
// ================================================================
GameScene.prototype._showChaosQuestion = function (aiId, aiName, type) {
  var self = this;
  self.setStatusText(aiName + ' \u51FA\u9898\u4E2D...');

  if (this.isAPIMode && typeof ApiClient !== 'undefined') {
    ApiClient.generateChaosQuestion(type || 'random', 'normal', 1)
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

  var typeLabel = q.questionType || q.type || '知识题';
  var typeIcon = '🧠';
  if (typeLabel.indexOf('voc') >= 0 || typeLabel.indexOf('word') >= 0) typeIcon = '📚';
  if (typeLabel.indexOf('expr') >= 0) typeIcon = '💬';
  if (typeLabel.indexOf('trivia') >= 0) typeIcon = '💡';
  if (typeLabel.indexOf('life') >= 0) typeIcon = '🏠';

  var tag = self.add.text(220, 97, typeIcon + ' ' + typeLabel, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '13px', color: '#FF6B35', fontStyle: 'bold'
  }).setDepth(302);
  self.chaosElements.push(tag);

  var questionText = q.question || q.text || '暂无题目';
  var qText = self.add.text(220, 114, questionText, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '14px', color: '#222222',
    wordWrap: { width: 600 }, lineSpacing: 4
  }).setDepth(302);
  self.chaosElements.push(qText);

  var options = q.options || {};
  var optionKeys = ['A', 'B', 'C', 'D'];
  self.chaosQuestionAnswered = false;

  // 2×2 网格布局 — 增大选项框高度防止文字溢出
  var optH = 64; // 增大选项框高度
  var optW = 290;
  var gridX = [175, 480];
  var gridY = [155, 230];

  for (var oi = 0; oi < optionKeys.length; oi++) {
    var ok = optionKeys[oi];
    var optText = options[ok];
    if (!optText) continue;

    var gx = gridX[oi % 2];
    var gy = gridY[Math.floor(oi / 2)];

    var optBg = self.add.graphics();
    optBg.fillStyle(0xF5F5F5, 1);
    optBg.fillRoundedRect(gx, gy, optW, optH, 8).setDepth(302);
    optBg.lineStyle(1.5, 0xCCCCCC, 1);
    optBg.strokeRoundedRect(gx, gy, optW, optH, 8);
    optBg.setInteractive(new Phaser.Geom.Rectangle(gx, gy, optW, optH), Phaser.Geom.Rectangle.Contains);

    var optMarkBg = self.add.graphics();
    optMarkBg.fillStyle(0x4ECDC4, 1);
    optMarkBg.fillCircle(gx + 20, gy + optH / 2, 11).setDepth(303);
    var optMarkTxt = self.add.text(gx + 20, gy + optH / 2, ok, {
      fontFamily: '"PingFang SC",sans-serif',
      fontSize: '12px', color: '#FFFFFF', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(304);

    // 取消18字截断，改用自动换行
    var optTxt = self.add.text(gx + 40, gy + optH / 2, optText, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '13px', color: '#333333',
      wordWrap: { width: optW - 55 },
      lineSpacing: 1
    }).setOrigin(0, 0.5).setDepth(303);

    optBg.setData('optKey', ok);
    optBg.setData('optBg', optBg);
    optBg.setData('optTxt', optTxt);
    optBg.setData('optMarkBg', optMarkBg);
    optBg.setData('optMarkTxt', optMarkTxt);
    optBg.setData('answer', q.answer);
    optBg.setData('origGx', gx);
    optBg.setData('origGy', gy);

    (function (optBg, ok, gx, gy) {
      optBg.on('pointerdown', function () {
        if (self.chaosQuestionAnswered) return;
        self.chaosQuestionAnswered = true;
        self._handleOptionClick(self, optBg, ok, aiId, q);
      });
    })(optBg, ok, gx, gy);

    self.chaosElements.push(optBg, optMarkBg, optMarkTxt, optTxt);
  }

  // B46: 30秒超时计时器
  if (self.chaosTimeoutTimer) {
    self.chaosTimeoutTimer.remove();
    self.chaosTimeoutTimer = null;
  }
  self.chaosTimeoutTimer = self.time.delayedCall(30000, function () {
    self._handleChaosTimeout(aiId);
  });
};
// ================================================================
// 搞事情 - 处理选项点击
// ================================================================
GameScene.prototype._handleOptionClick = function (self, optBg, optKey, aiId, q) {
  // B46: 清除超时计时器
  if (self.chaosTimeoutTimer) {
    self.chaosTimeoutTimer.remove();
    self.chaosTimeoutTimer = null;
  }

  // 判断对错
  var answer = optBg.getData('answer');
  var isCorrect = (optKey === answer);
  if (isCorrect) {
    self.chaosScore = (self.chaosScore || 0) + 1;
    if (self.chaosScoreText) self.chaosScoreText.setText('\u5F97\u5206: ' + self.chaosScore);
  }

  // 播放音效
  if (isCorrect) { SoundManager.win(); } else { SoundManager.lose(); }

  // 清空题目区域（保留基础元素）
  self._clearQuestionArea();

  // 显示反馈
  var feedbackScene = isCorrect ? 'correct' : 'wrong';
  var resultIcon = isCorrect ? '\u2705' : '\u274C';
  var resultText = isCorrect ? '\u7B54\u5BF9\u4E86\uFF01+1' : '\u7B54\u9519\u4E86\uFF01';
  var resultColor = isCorrect ? '#4CAF50' : '#E53935';

  // 反馈图标（居中，Y=140）
  var fbIcon = self.add.text(480, 103, resultIcon + ' ' + resultText, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '20px', color: resultColor, fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(305);
  self.chaosElements.push(fbIcon);

  // 正确答案（答错时显示）
  var fbY = 180;
  if (!isCorrect && q.answer) {
    var correctAns = self.add.text(220, fbY,
      '\u6B63\u786E\u7B54\u6848: ' + q.answer + '. ' + (q.options[q.answer] || ''), {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '12px', color: '#4CAF50', fontStyle: 'bold',
      wordWrap: { width: 500 }
    }).setDepth(305);
    self.chaosElements.push(correctAns);
    fbY += 28;
  }

  // 解析说明
  if (q.explanation) {
    var expl = self.add.text(220, fbY, q.explanation, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '11px', color: '#555555',
      wordWrap: { width: 500 }, lineSpacing: 2
    }).setDepth(305);
    self.chaosElements.push(expl);
    fbY += q.explanation.length > 40 ? 50 : 28;
  }

  // AI 反馈气泡
    self._showAiBubble(aiId, feedbackScene, fbY + 10);
  if (isCorrect) {
    // 答对：弹出互换牌界面（玩家选牌交换）
    self._showSwapUI(aiId, fbY);
  } else {
    // 答错：AI随机拿牌+动画
    self._showSwapResult(aiId, false, fbY);
  }
};

// ================================================================
// B46: 搞事情超时处理
// ================================================================
GameScene.prototype._handleChaosTimeout = function (aiId) {
  var self = this;
  self.chaosQuestionAnswered = true;
  self._clearQuestionArea();
  // 显示超时反馈：根据手牌情况显示不同消息
  if (!self.playerHand || self.playerHand.length === 0) {
    var fbIcon = self.add.text(480, 103, '⏱ 超时了！', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '17px', color: '#FF5252', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(305);
    self.chaosElements.push(fbIcon);
  } else {
    var fbIcon = self.add.text(480, 103, '⏱ 超时了！AI趁机拿走了你一张牌', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '17px', color: '#FF5252', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(305);
    self.chaosElements.push(fbIcon);
  }
  // 超时 = 答错，直接走答错换牌
  self._showSwapResult(aiId, false, 180);
};

// ================================================================
// B3: 答完题换牌 — 答对玩家从AI拿牌、答错AI从玩家拿牌
// ================================================================
// ================================================================
// B45: 答错AI抢牌（按CardSwap.md第4章）
// ================================================================
GameScene.prototype._showSwapResult = function (aiId, isCorrect, fbY) {
  var self = this;
  var aiHand = aiId === 'duidui' ? self.ai1Hand : self.ai2Hand;
  var aiName = aiId === 'duidui' ? '王怼怼' : '苏甜甜';

  // 答错后玩家手牌为空：不进行AI拿牌，直接显示提示和底部按钮（修复卡UI问题）
  if (!self.playerHand || self.playerHand.length === 0) {
    var emptyMsg = self.add.text(480, 155, '你的手牌为空，AI无牌可拿', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '14px', color: '#FFB74D', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(310);
    self.chaosElements.push(emptyMsg);
    self._showSwapButtons(aiId, Math.max(fbY + 60, 251));
    return;
  }

  // 答错：AI从玩家手牌随机拿一张
  var idx = Math.floor(Math.random() * self.playerHand.length);
  var lostCard = self.playerHand[idx];

  var rankStr = Doudizhu.RANK_NAMES ? Doudizhu.RANK_NAMES[lostCard.rank] : (lostCard.rank || '');
  var suitStr = Doudizhu.SUIT_NAMES ? Doudizhu.SUIT_NAMES[lostCard.suit] : (lostCard.suit || '');

  // 0.6秒后自动触发拿牌飞行动画（无需确认）
  self.time.delayedCall(600, function () {
    // 计算玩家手牌中这张牌的位置
    var n = self.playerHand.length;
    var cw = 56, ch = 80;
    var overlap = n > 6 ? Math.min(33, (700 - cw) / (n - 1)) : 33;
    var totalWidth = cw + (n - 1) * overlap;
    var startX = 180 + (700 - totalWidth) / 2;
    var playerCardX = startX + idx * overlap + cw / 2;

    // AI目标位置
    var targetX = aiId === 'duidui' ? 80 : 880;
    var targetY = aiId === 'duidui' ? 160 : 200;

    // 背面牌飞向AI
    var animCard = self.add.image(playerCardX, 345, 'cardBack')
      .setDisplaySize(50, 72).setDepth(400);

    self.tweens.add({
      targets: animCard,
      x: targetX,
      y: targetY,
      scaleX: 0.4,
      scaleY: 0.4,
      angle: 10,
      duration: 700,
      ease: 'Back.easeIn',
      onComplete: function () {
        // 翻牌揭示：背面→正面
        animCard.setTexture(getCardImageKey(lostCard));
        animCard.setDisplaySize(38, 54);
        animCard.setAngle(0);
        animCard.setDepth(310);

        // 动画完成后才实际修改数据
        self.playerHand.splice(idx, 1);
        aiHand.push(lostCard);
        self.renderPlayerHand();
        self.updateAICount(aiId === 'duidui' ? 0 : 1);

        // 显示结果文字
        var swapText = self.add.text(480, 184, '😈 ' + aiName + ' 从你手中拿走了 [' + suitStr + rankStr + ']', {
          fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
          fontSize: '15px', color: '#FF6B35', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(310);
        self.chaosElements.push(swapText);
        self.time.delayedCall(3500, function () {
          if (swapText) swapText.destroy();
        });

        // 显示底部按钮
        animCard.destroy();
        self._showSwapButtons(aiId, Math.max(fbY + 60, 251));
      }
    });
  });
};

// ================================================================
// B44 + B46: 答对盲选交换 + 30s倒计时
// 按 CardSwap.md 第3、5章实现
// ================================================================
GameScene.prototype._showSwapUI = function (aiId, fbY) {
  var self = this;
  var aiHand = aiId === 'duidui' ? self.ai1Hand : self.ai2Hand;
  var aiName = aiId === 'duidui' ? '王怼怼' : '苏甜甜';

  if (!aiHand || aiHand.length === 0 || !self.playerHand || self.playerHand.length === 0) {
    self._showSwapResult(aiId, false, fbY);
    return;
  }

  var selectedPlayerCardIdx = -1;
  var selectedPlayerCardEl = null;
  var selectedBackIdx = -1;
  var selectedBackEl = null;
  var swapElements = [];

  // 半透明遮罩
  var swapOverlay = self.add.graphics();
  swapOverlay.fillStyle(0x000000, 0.6);
  swapOverlay.fillRect(0, 0, 960, 600).setDepth(350);
  swapOverlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 960, 600), Phaser.Geom.Rectangle.Contains);
  swapElements.push(swapOverlay);

  // 标题
  var titleTxt = self.add.text(480, 90, '🎉 答对了！赢一张牌！', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '18px', color: '#FFD700', fontStyle: 'bold',
    stroke: '#000000', strokeThickness: 2
  }).setOrigin(0.5).setDepth(351);
  swapElements.push(titleTxt);

  var hintTxt = self.add.text(480, 112, '选一张你的牌交出，然后猜AI的牌位置', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '11px', color: '#AAAAAA'
  }).setOrigin(0.5).setDepth(351);
  swapElements.push(hintTxt);

  // 玩家手牌（正面展示，选一张交出）
  var playerLabel = self.add.text(480, 140, '你的手牌（点击选一张交出）', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '12px', color: '#4FC3F7', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(351);
  swapElements.push(playerLabel);

  var myHandSorted = Doudizhu.sortCards(self.playerHand.slice());
  var myCardW = 44, myCardH = 64, myOverlap = 30;
  var myTotalW = myCardW + (myHandSorted.length - 1) * myOverlap;
  var myStartX = (960 - myTotalW) / 2;

  for (var mi = 0; mi < myHandSorted.length; mi++) {
    var mcx = myStartX + mi * myOverlap + myCardW / 2;
    var mkey = getCardImageKey(myHandSorted[mi]);
    var mcard = self.add.image(mcx, 175, mkey).setDisplaySize(myCardW, myCardH).setDepth(352);
    mcard.setInteractive();
    swapElements.push(mcard);
    (function (idx, card) {
      card.on('pointerdown', function () {
        if (selectedPlayerCardEl && selectedPlayerCardEl !== card) {
          selectedPlayerCardEl.setDisplaySize(myCardW, myCardH).setDepth(352);
        }
        selectedPlayerCardIdx = idx;
        selectedPlayerCardEl = card;
        card.setDisplaySize(myCardW + 6, myCardH + 6).setDepth(355);
      });
    })(mi, mcard);
  }

  // 下方牌背盲选（3-5张，1张是真AI牌）
  var backLabel = self.add.text(480, 230, '猜猜哪张是AI的牌（完全盲选）', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '12px', color: '#FFB74D', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(351);
  swapElements.push(backLabel);

  var numBacks = 3 + Math.floor(Math.random() * 3); // 3-5
  var backW = 40, backH = 56, backOverlap = 34;
  var backTotalW = backW + (numBacks - 1) * backOverlap;
  var backStartX = (960 - backTotalW) / 2;

  var aiCardRealIdx = Math.floor(Math.random() * aiHand.length);
  var realAICard = aiHand[aiCardRealIdx];
  var realAICardSlot = Math.floor(Math.random() * numBacks);

  var backCardPositions = [];

  for (var bi = 0; bi < numBacks; bi++) {
    var bcx = backStartX + bi * backOverlap + backW / 2;
    var isReal = (bi === realAICardSlot);
    var backCard = self.add.image(bcx, 260, 'cardBack').setDisplaySize(backW, backH).setDepth(352);
    backCard.setInteractive();
    backCard.setData('isReal', isReal);
    swapElements.push(backCard);
    backCardPositions.push({ x: bcx, y: 260 });

    (function (bIdx, cardEl, crdX, crdY) {
      cardEl.on('pointerdown', function () {
        if (selectedBackEl && selectedBackEl !== cardEl) {
          selectedBackEl.setDisplaySize(backW, backH).setDepth(352);
        }
        selectedBackIdx = bIdx;
        selectedBackEl = cardEl;
        cardEl.setDisplaySize(backW + 6, backH + 6).setDepth(355);
        updateConfirmBtn();
      });
    })(bi, backCard, bcx, 260);
  }

  function updateConfirmBtn() {
    if (selectedPlayerCardIdx >= 0 && selectedBackIdx >= 0) {
      confirmBg.clear().fillStyle(0x4ECDC4, 1).fillRoundedRect(290, 310, 200, 44, 10).setDepth(353);
    } else {
      confirmBg.clear().fillStyle(0x4ECDC4, 0.5).fillRoundedRect(290, 310, 200, 44, 10).setDepth(353);
    }
  }

  // 确认按钮
  var confirmBg = self.add.graphics();
  confirmBg.fillStyle(0x4ECDC4, 0.5);
  confirmBg.fillRoundedRect(290, 310, 200, 44, 10).setDepth(353);
  var confirmTxt = self.add.text(390, 332, '✅ 确认交换', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(354);
  confirmBg.setInteractive(new Phaser.Geom.Rectangle(290, 310, 200, 44), Phaser.Geom.Rectangle.Contains);
  swapElements.push(confirmBg, confirmTxt);

  confirmBg.on('pointerup', function () {
    if (selectedPlayerCardIdx < 0 || selectedBackIdx < 0) return;

    var myCard = myHandSorted[selectedPlayerCardIdx];
    var pReal = -1;
    for (var p = 0; p < self.playerHand.length; p++) {
      if (self.playerHand[p].suit === myCard.suit && self.playerHand[p].rank === myCard.rank) {
        pReal = p;
        break;
      }
    }
    if (pReal < 0) return;
    var pCard = self.playerHand[pReal];
    var isWin = (selectedBackIdx === realAICardSlot);

    var selectedBackPos = backCardPositions[selectedBackIdx];

    // 销毁所有swap UI元素
    for (var ei = 0; ei < swapElements.length; ei++) {
      if (swapElements[ei]) swapElements[ei].destroy();
    }

    var pRank = Doudizhu.RANK_NAMES ? Doudizhu.RANK_NAMES[pCard.rank] : (pCard.rank || '');
    var pSuit = Doudizhu.SUIT_NAMES ? Doudizhu.SUIT_NAMES[pCard.suit] : (pCard.suit || '');

    if (isWin) {
      var aRank = Doudizhu.RANK_NAMES ? Doudizhu.RANK_NAMES[realAICard.rank] : (realAICard.rank || '');
      var aSuit = Doudizhu.SUIT_NAMES ? Doudizhu.SUIT_NAMES[realAICard.suit] : (realAICard.suit || '');

      // 在选中的牌背位置创建AI牌的正面（翻牌揭示）
      var revealCard = self.add.image(selectedBackPos.x, selectedBackPos.y, getCardImageKey(realAICard))
        .setDisplaySize(backW, backH).setDepth(400);

      var swapMsg = self.add.text(480, 155, '🔄 用[' + pSuit + pRank + ']换了AI的[' + aSuit + aRank + ']', {
        fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
        fontSize: '14px', color: '#4CAF50', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(310);
      self.chaosElements.push(swapMsg);

      // 飞入动画
      self.tweens.add({
        targets: revealCard,
        x: 480, y: 345,
        scaleX: 0.8, scaleY: 0.8,
        angle: 720,
        duration: 600,
        ease: 'Cubic.easeOut',
        onComplete: function () {
          revealCard.destroy();
          var aReal = -1;
          for (var a = 0; a < aiHand.length; a++) {
            if (aiHand[a].suit === realAICard.suit && aiHand[a].rank === realAICard.rank) {
              aReal = a;
              break;
            }
          }
          if (aReal >= 0) {
            self.playerHand.splice(pReal, 1);
            aiHand.splice(aReal, 1);
            self.playerHand.push(realAICard);
            aiHand.push(pCard);
            self.playerHand = Doudizhu.sortCards(self.playerHand);
          }
          self.renderPlayerHand();
          self.updateAICount(aiId === 'duidui' ? 0 : 1);
          self._showSwapButtons(aiId, Math.max(fbY + 60, 280));
        }
      });
    } else {
      // 没抽中：揭示AI真实牌位置
      if (realAICardSlot >= 0 && realAICardSlot < backCardPositions.length) {
        var realPos = backCardPositions[realAICardSlot];
        var aiRevealCard = self.add.image(realPos.x, realPos.y, getCardImageKey(realAICard))
          .setDisplaySize(backW, backH).setDepth(400);
      }

      var missMsg = self.add.text(480, 155, '😅 没抽到AI的牌，下次加油！', {
        fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
        fontSize: '14px', color: '#FFB74D', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(310);
      self.chaosElements.push(missMsg);

      if (typeof aiRevealCard !== 'undefined') aiRevealCard.destroy();
      self.renderPlayerHand();
      self.updateAICount(aiId === 'duidui' ? 0 : 1);
      self._showSwapButtons(aiId, Math.max(fbY + 60, 280));
    }
  });

  // 取消按钮
  var cancelBg = self.add.graphics();
  cancelBg.fillStyle(0x78909C, 1);
  cancelBg.fillRoundedRect(290, 360, 200, 44, 10).setDepth(353);
  var cancelTxt = self.add.text(390, 382, '✖ 跳过交换', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(354);
  cancelBg.setInteractive(new Phaser.Geom.Rectangle(290, 360, 200, 44), Phaser.Geom.Rectangle.Contains);
  swapElements.push(cancelBg, cancelTxt);

  cancelBg.on('pointerup', function () {
    for (var ei = 0; ei < swapElements.length; ei++) {
      if (swapElements[ei]) swapElements[ei].destroy();
    }
    self._showSwapResult(aiId, false, fbY);
  });
};

GameScene.prototype._showSwapButtons = function (aiId, btnY) {
  var self = this;
  // 安全清理: 销毁所有 depth >= 400 的临时元素
  self.children.each(function(child) {
    if (child && child.type === 'Image' && child.depth >= 400) {
      child.destroy();
    }
  });
  var againBg = self.add.graphics();
  againBg.fillStyle(0x4ECDC4, 1);
  againBg.fillRoundedRect(220, btnY, 220, 40, 10).setDepth(305);
  var againTxt = self.add.text(330, btnY + 20, '🔄 再来一题', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '13px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(306);
  againBg.setInteractive(new Phaser.Geom.Rectangle(220, btnY, 220, 40), Phaser.Geom.Rectangle.Contains);
  againBg.on('pointerup', function () {
    self.chaosQuestionAnswered = false;
    self._clearQuestionArea();
    var aiId2 = Math.random() < 0.5 ? 'duidui' : 'tiantian';
    self._showChaosQuestion(aiId2, aiId2 === 'duidui' ? '王怼怼' : '苏甜甜');
  });
  self.chaosElements.push(againBg, againTxt);
  var closeBg = self.add.graphics();
  closeBg.fillStyle(0xFF6B6B, 1);
  closeBg.fillRoundedRect(510, btnY, 220, 40, 10).setDepth(305);
  var closeTxt = self.add.text(620, btnY + 20, '✖ 关掉回牌', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '13px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(306);
  closeBg.setInteractive(new Phaser.Geom.Rectangle(510, btnY, 220, 40), Phaser.Geom.Rectangle.Contains);
  closeBg.on('pointerup', function () {
    self._destroyChaos();
  });
  self.chaosElements.push(closeBg, closeTxt);
};GameScene.prototype._renderFallbackQuestion = function (aiId) {
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
      answer: 'C', explanation: '🧬 \u88F8\u9F20\u9F20\u51E0\u4E4E\u4ECE\u4E0D\u60A3\u764C\u75C7\uFF01\u5B83\u4EEC\u4F53\u5185\u6709\u7279\u6B8A\u7684\u900F\u660E\u8D28\u9178\u80FD\u963B\u6B62\u764C\u7EC6\u80DE\u5206\u88C2\u3002'
    },
    {
      question: '\u54EA\u79CD\u65B9\u6CD5\u80FD\u8BA9\u5207\u6D0B\u8471\u4E0D\u6D41\u6CEA\uFF1F',
      options: { A: '\u51B7\u51BB30\u5206\u949F', B: '\u542B\u4E00\u53E3\u6C34', C: '\u6234\u6CF3\u955C', D: '\u5FAE\u6CE2\u52A010\u79D2' },
      answer: 'C', explanation: '🕶️ \u6234\u6CF3\u955C\u662F\u6700\u76F4\u63A5\u7684\u7269\u7406\u65B9\u6CD5——\u963B\u6B62\u50AC\u6CEA\u6C14\u4F53\u63A5\u89E6\u773C\u775B\u3002\u51B7\u51BB\u4E5F\u6709\u6548\u4F46\u6548\u679C\u6709\u9650\u3002'
    }
  ];
  var q = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
  q.questionType = '\u672C\u5730\u9898\u5E93';
  self._renderQuestion(q, aiId);
};

// ================================================================
// 气泡队列系统 — 防止多个事件同时弹出重叠
// ================================================================
var bubbleQueue = [];
var BUBBLE_QUEUE_MAX = 3;
var bubbleShowing = false;

function processBubbleQueue() {
  if (bubbleQueue.length === 0) {
    bubbleShowing = false;
    return;
  }
  bubbleShowing = true;
  var item = bubbleQueue.shift();
  item.render();
}

// ================================================================
// 出牌 - AI 气泡（调API，不通则回退本地池）
// ================================================================
GameScene.prototype._showPlayBubble = function (aiId, event, context) {
  var self = this;

  var renderBubble = function (line) {
    // 直接替换: 杀掉旧气泡和旧定时器
    if (self.playBubbleTimer) {
      self.playBubbleTimer.remove();
      self.playBubbleTimer = null;
    }
    if (self.playBubbleContainer) {
      self.playBubbleContainer.destroy();
      self.playBubbleContainer = null;
    }
    if (self.playBubbleElements) {
      for (var bi = 0; bi < self.playBubbleElements.length; bi++) {
        if (self.playBubbleElements[bi]) self.playBubbleElements[bi].destroy();
      }
    }
    self.playBubbleElements = [];

    var isDuidui = (aiId === 'duidui');
    var isEmergency = (event === 'bomb');
    var y = 50;
    var aiDisplayName = isDuidui ? '王怼怼' : '苏甜甜';
    var avatarX = isDuidui ? 176 : 788;
    var avatarY = y + 16;
    var avatarColor = isDuidui ? 0x4FC3F7 : 0xFFB74D;

    // 方块形气泡
    var baseSize = 64;
    var bubbleW = Math.min(baseSize, 40 + line.length * 6);
    var bubbleH = Math.max(baseSize, 30 + Math.ceil(line.length / 3) * 14);
    bubbleW = Math.max(bubbleW, bubbleH * 0.7);
    bubbleH = Math.max(bubbleH, bubbleW * 0.7);
    var bubbleX = avatarX - bubbleW / 2;
    var bubbleY = y + 36;
    var cornerRadius = isDuidui ? 12 : 4;
    var bubbleBgColor = isEmergency ? 0x500A00 : (isDuidui ? 0x1B5E20 : 0x311B92);
    var bubbleBorderColor = isEmergency ? 0xFF5252 : (isDuidui ? 0x66BB6A : 0xCE93D8);

    // AI 头像圆圈
    var avatar = self.add.graphics();
    avatar.fillStyle(avatarColor, 1);
    avatar.fillCircle(avatarX, avatarY, 22).setDepth(20);
    avatar.lineStyle(2, 0xFFFFFF, 0.6);
    avatar.strokeCircle(avatarX, avatarY, 22).setDepth(20);
    var avatarTxt = self.add.text(avatarX, avatarY, isDuidui ? '😎' : '😊', {
      fontFamily: 'sans-serif', fontSize: '18px'
    }).setOrigin(0.5).setDepth(21);
    self.playBubbleElements.push(avatar, avatarTxt);

    // AI 名字
    var nameX = avatarX;
    var nameTxt = self.add.text(nameX, y, aiDisplayName, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '12px', color: '#FFFFFF', fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(21);
    self.playBubbleElements.push(nameTxt);

    // 气泡高度自适应: 先创建文字获取高度，再用高度绘制气泡
    var textStyle = isEmergency ? {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '16px', color: '#FFCDD2', fontStyle: 'bold',
      wordWrap: { width: bubbleW - 28 }
    } : {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '14px', color: '#FFFFFF',
      wordWrap: { width: bubbleW - 28 }
    };
    var textX = isDuidui ? (bubbleX + 14) : (bubbleX + 10);
    var bubbleTxt = self.add.text(bubbleX + 14, 0, line, textStyle).setDepth(21);
    var textBounds = bubbleTxt.getBounds();
    bubbleH = Math.max(bubbleH, textBounds.height + 20);
    bubbleTxt.setPosition(textX, bubbleY + bubbleH / 2).setOrigin(0, 0.5);
    self.playBubbleElements.push(bubbleTxt);

    // 台词气泡背景（填充+边框分开，炸弹时边框可独立闪烁）
    var bubbleBg = self.add.graphics();
    bubbleBg.fillStyle(bubbleBgColor, 0.85);
    if (cornerRadius > 0) {
      bubbleBg.fillRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, cornerRadius).setDepth(20);
    } else {
      bubbleBg.fillRect(bubbleX, bubbleY, bubbleW, bubbleH).setDepth(20);
    }
    self.playBubbleElements.push(bubbleBg);

    var bubbleBorder = self.add.graphics();
    bubbleBorder.lineStyle(isEmergency ? 2 : 1.5, bubbleBorderColor, 0.5);
    if (cornerRadius > 0) {
      bubbleBorder.strokeRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, cornerRadius).setDepth(20);
    } else {
      bubbleBorder.strokeRect(bubbleX, bubbleY, bubbleW, bubbleH).setDepth(20);
    }
    self.playBubbleElements.push(bubbleBorder);
    self._playBubbleBorder = bubbleBorder;

    // 三角形箭头（怼怼朝左、甜甜朝右）
    var arrow = self.add.graphics();
    arrow.fillStyle(bubbleBgColor, 0.85);
    if (isDuidui) {
      // 左侧箭头指向左边头像
      arrow.fillTriangle(
        bubbleX, bubbleY + bubbleH / 2,
        bubbleX - 12, bubbleY + bubbleH / 2 - 6,
        bubbleX - 12, bubbleY + bubbleH / 2 + 6
      ).setDepth(20);
    } else {
      // 右侧箭头指向右边头像
      arrow.fillTriangle(
        bubbleX + bubbleW, bubbleY + bubbleH / 2,
        bubbleX + bubbleW + 12, bubbleY + bubbleH / 2 - 6,
        bubbleX + bubbleW + 12, bubbleY + bubbleH / 2 + 6
      ).setDepth(20);
    }
    self.playBubbleElements.push(arrow);

    // 弹入动画: Container 包裹所有元素
    self.playBubbleContainer = self.add.container(0, 0, self.playBubbleElements);
    if (isEmergency) {
      self.playBubbleContainer.setScale(0.7).setAlpha(0);
      self.tweens.add({
        targets: self.playBubbleContainer,
        scale: 1.1, alpha: 1, duration: 100, ease: 'Back.easeOut',
        onComplete: function () {
          self.tweens.add({
            targets: self.playBubbleContainer,
            scale: 1.0, duration: 80, ease: 'Sine.easeOut'
          });
        }
      });
    } else {
      self.playBubbleContainer.setScale(0.8).setAlpha(0);
      self.tweens.add({
        targets: self.playBubbleContainer,
        scale: 1.0, alpha: 1,
        duration: 150, ease: 'Back.easeOut'
      });
    }

    // 炸弹边框闪烁
    if (isEmergency) {
      self.tweens.add({
        targets: bubbleBorder,
        alpha: { from: 0.3, to: 0.9 },
        duration: 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }

    // 直接替换模式: 定时销毁（含退出动画）
    var displayMs = event === 'bomb' ? 5000 : 4000;
    self.playBubbleTimer = self.time.delayedCall(displayMs, function () {
      self.tweens.add({
        targets: self.playBubbleContainer,
        alpha: 0, duration: 200, ease: 'Linear',
        onComplete: function () {
          if (self.playBubbleContainer) {
            self.playBubbleContainer.destroy();
            self.playBubbleContainer = null;
          }
          self.playBubbleElements = [];
          self.playBubbleTimer = null;
        }
      });
    });
  };

  // 直接替换: 立即执行，不入队列
  if (self.isAPIMode && typeof ApiClient !== 'undefined' && ApiClient.generateDialogue) {
    ApiClient.generateDialogue(aiId, event, context)
      .then(function (res) {
        renderBubble(res.line || pickAiLine(aiId, event));
      })
      .catch(function () {
        renderBubble(pickAiLine(aiId, event));
      });
  } else {
    renderBubble(pickAiLine(aiId, event));
  }
};

// ================================================================
// 搞事情 - AI \u6C14\u6CE1
// ================================================================
GameScene.prototype._showAiBubble = function (aiId, sceneKey, y) {
  var self = this;

  var renderBubble = function (line) {
    // \u6E05\u9664\u65E7\u6C14\u6CE1
    if (self.chaosBubbleElements) {
      for (var bi = 0; bi < self.chaosBubbleElements.length; bi++) {
        self.chaosBubbleElements[bi].destroy();
      }
    }
    self.chaosBubbleElements = [];

    var aiDisplayName = aiId === 'duidui' ? '\u738B\u603C\u603C' : '\u82CF\u751C\u751C';

    // \u8BA1\u7B97\u6C14\u6CE1\u5C3A\u5BF8
    var bubbleW = Math.min(540, 200 + line.length * 10);
    var bubbleH = 36;
    var bubbleX = 230;
    var bubbleY = y + 10;

    // AI \u5934\u50CF\u5706\u5708
    var avatar = self.add.graphics();
    avatar.fillStyle(aiId === 'duidui' ? 0x4FC3F7 : 0xFFB74D, 1);
  avatar.fillCircle(80, y + 16, 22).setDepth(302);
  avatar.lineStyle(2, 0xFFFFFF, 0.5);
  avatar.strokeCircle(80, y + 16, 22).setDepth(302);
  var avatarTxt = self.add.text(80, y + 16, aiId === 'duidui' ? '😎' : '😊', {
    fontFamily: 'sans-serif', fontSize: '18px'
  }).setOrigin(0.5).setDepth(303);
  self.chaosBubbleElements.push(avatar, avatarTxt);

  // AI \u540D\u5B57\uFF08\u52A0\u5927\uFF09
  var nameTxt = self.add.text(105, y - 4, aiDisplayName, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '12px', color: '#FFFFFF', fontStyle: 'bold'
  }).setDepth(302);
  self.chaosBubbleElements.push(nameTxt);

  // \u53F0\u8BCD\u6C14\u6CE1\uFF08\u5B9E\u5FC3\u7EFF\u8272\u6C14\u6CE1\u5E26\u8FB9\u6846\uFF09
  var bubble = self.add.graphics();
  bubble.fillStyle(0x1B5E20, 0.85);
  bubble.fillRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 12).setDepth(302);
  bubble.lineStyle(1.5, 0x66BB6A, 0.5);
  bubble.strokeRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 12).setDepth(302);
  self.chaosBubbleElements.push(bubble);

  // \u4E09\u89D2\u7BAD\u5934\u6307\u5411\u5DE6\u4FA7\u89D2\u8272
  var arrow = self.add.graphics();
  arrow.fillStyle(0x1B5E20, 0.85);
  arrow.fillTriangle(
    bubbleX, bubbleY + bubbleH / 2,
    bubbleX - 12, bubbleY + bubbleH / 2 - 6,
    bubbleX - 12, bubbleY + bubbleH / 2 + 6
  ).setDepth(302);
  self.chaosBubbleElements.push(arrow);

    // 台词文本
  var bubbleTxt = self.add.text(bubbleX + 14, bubbleY + bubbleH / 2, line, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '14px', color: '#FFFFFF'
  }).setOrigin(0, 0.5).setDepth(303);
  self.chaosBubbleElements.push(bubbleTxt);

  // 搞事情气泡显示3.5秒后自动销毁，解锁队列
  self.time.delayedCall(3500, function () {
    if (self.chaosBubbleElements) {
      for (var ti = 0; ti < self.chaosBubbleElements.length; ti++) {
        if (self.chaosBubbleElements[ti]) self.chaosBubbleElements[ti].destroy();
      }
      self.chaosBubbleElements = [];
    }
    processBubbleQueue();
  });
  };

  var queuedTask = function () {
    var line = pickAiLine(aiId, sceneKey);
    renderBubble(line);
  };

  bubbleQueue.push({ render: queuedTask });
  if (bubbleQueue.length > BUBBLE_QUEUE_MAX) bubbleQueue.shift();
  if (!bubbleShowing) processBubbleQueue();
};
// ================================================================
// 搞事情 - 清除题目区域
// ================================================================
GameScene.prototype._clearQuestionArea = function () {
  var self = this;
  if (!self.chaosElements) return;
  // \u4FDD\u7559\u524D3\u4E2A\u5143\u7D20\uFF08\u906E\u7F69\u3001\u5361\u724C\u80CC\u666F\u3001\u6807\u9898\u3001\u5206\u6570\u3001\u5173\u6389\u6309\u94AE\uFF09
  var toKeep = self.chaosElements.slice(0, 5); // overlay, cardBg, title, scoreText, closeBtn
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

  // B46: \u6e05\u9664\u8d85\u65f6\u8ba1\u65f6\u5668
  if (this.chaosTimeoutTimer) {
    this.chaosTimeoutTimer.remove();
    this.chaosTimeoutTimer = null;
  }

  // \u6062\u590D\u51FA\u724C\u97F3\u6548
  SoundManager.resumeAll();
  this.gameState = GAME_STATE.PLAYER_TURN;

  // \u6062\u590D\u6E38\u620F\u72B6\u6001
  this._showAiBubble(this._chaosAiId || "duidui", "close", 180);
  this.setStatusText('\u641E\u4E8B\u60C5\u7ED3\u675F\uFF0C\u7EE7\u7EED\u51FA\u724C');
};
// ================================================================
// 功能按钮
// ================================================================
function createActionButtons(scene) {
  var bw = 72, bh = 48, gap = 14;
  var totalW = bw * 5 + gap * 4;
  var startX = (960 - totalW) / 2;
  var btnY = 442;

  var buttons = [
    { label: '\u51FA\u724C', color: 0x4ECDC4, key: 'play' },
    { label: '\u63D0\u793A', color: 0xFFD93D, key: 'hint' },
    { label: '\u4E0D\u51FA', color: 0xFF6B6B, key: 'pass' },
    { label: '\u641E\u4E8B\u60C5', color: 0x7C4DFF, key: 'action' },
    { label: '\u5E95\u724C\u67E5\u770B', color: 0x78909C, key: 'bottom' }
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

    var txt = scene.add.text(bx + bw / 2, btnY + bh / 2 - 1, b.label, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '13px', color: '#FFFFFF', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(101);
    scene.actionButtons.push(txt);

    (function (key) {
      bg.on('pointerup', function () {
        switch (key) {
          case 'play': scene.doPlayerPlay(); break;
          case 'hint': scene.doHint(); break;
          case 'pass': scene.doPlayerPass(); break;
          case 'action': scene.doAction(); break;
          case 'bottom': scene.showBottomCards(scene.remainingCards); break;
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
  toastBg.fillRoundedRect(cx - 100, 206, 200, 38, 10).setDepth(200);
  var toastText = scene.add.text(cx, 225, message, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '13px', color: '#FFFFFF'
  }).setOrigin(0.5).setDepth(201);
  scene.time.delayedCall(1200, function () {
    toastBg.destroy();
    toastText.destroy();
  });
}


// ================================================================
// 赢牌结算面板
// ================================================================
GameScene.prototype.renderRoundEndPanel = function (winner) {
  var self = this;
  this.gameState = GAME_STATE.ROUND_END;

  var isPlayerWin = winner === 'player';
  var isAI1Win = winner === 'ai1';
  var winName = '';
  if (isAI1Win) winName = '王怼怼';
  else if (winner === 'ai2') winName = '苏甜甜';

  // --- 1. 半透明遮罩（淡入）---
  var overlay = self.add.graphics();
  overlay.fillStyle(0x000000, 0);
  overlay.fillRect(0, 0, 960, 600).setDepth(400);
  self.tweens.add({ targets: overlay, alpha: 0.65, duration: 300, ease: 'Linear' });

  var panelElements = [overlay];

  // --- 2. 结算卡片 ---
  var cardBg = self.add.graphics();
  cardBg.fillStyle(0x1A1A2E, 0.92);
  cardBg.fillRoundedRect(200, 60, 560, 480, 12).setDepth(401);
  var glowColor = isPlayerWin ? 0xFFD700 : 0xFF5252;
  cardBg.lineStyle(2, glowColor, 0.8);
  cardBg.strokeRoundedRect(200, 60, 560, 480, 12).setDepth(401);
  panelElements.push(cardBg);
  cardBg.setAlpha(0);

  // --- 3. 标题文字（弹入动画）---
  var titleEmoji = isPlayerWin ? '🎉' : (isAI1Win || winner === 'ai2') ? '😅' : '😅';
  var titleText = isPlayerWin ? '你赢了！' : '你输了';
  var titleColor = isPlayerWin ? '#FFD700' : '#FF5252';
  var title = self.add.text(480, 90, titleEmoji + ' ' + titleText, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '28px', fontStyle: 'bold', color: titleColor,
    shadow: { blur: 20, color: titleColor, fill: true }
  }).setOrigin(0.5).setDepth(402).setScale(0.3).setAlpha(0);
  panelElements.push(title);

  // AI获胜副标题
  var aiWinSub = null;
  if (!isPlayerWin && winName) {
    aiWinSub = self.add.text(480, 120, winName + '获胜！', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '16px', color: '#FF5252'
    }).setOrigin(0.5).setDepth(402).setAlpha(0);
    panelElements.push(aiWinSub);
  }

  // --- 4. 得分计算 ---
  var baseScore = self.isLandlord ? 30 : 20;
  var bombMult = self.totalBombs || 0;
  var chaosScore = self.chaosScore || 0;
  var chaosBonus = chaosScore * 10;

  // 手牌奖励：对手剩余手牌数 * 2
  var remainingCards = 0;
  if (isPlayerWin) {
    remainingCards = (self.ai1Hand ? self.ai1Hand.length : 0) + (self.ai2Hand ? self.ai2Hand.length : 0);
  } else if (isAI1Win) {
    remainingCards = (self.playerHand ? self.playerHand.length : 0) + (self.ai2Hand ? self.ai2Hand.length : 0);
  } else {
    remainingCards = (self.playerHand ? self.playerHand.length : 0) + (self.ai1Hand ? self.ai1Hand.length : 0);
  }
  var handBonus = remainingCards * 2;

  var subTotal = baseScore + chaosBonus + handBonus;
  var bombCount = bombMult - (self.rocketCount || 0);
  var multiplier = Math.pow(2, bombCount) * Math.pow(4, self.rocketCount || 0);
  var totalScore = subTotal * multiplier;

  var detailRows = [
    { label: '基础底分', value: '+' + baseScore, icon: '★', color: '#C8E6C9' },
    { label: '炸弹翻倍', value: '×' + multiplier + ' (' + bombMult + '个)', icon: '🧨', color: '#FFD54F' },
    { label: '搞事情得分', value: '+' + chaosBonus, icon: '🔥', color: '#FFAB91' },
    { label: '手牌奖励', value: '+' + handBonus, icon: '🃏', color: '#A5D6A7' }
  ];

  // 不计算搞事情和中奖为空时隐藏
  if (chaosBonus === 0) {
    detailRows[2].value = '0';
  }
  if (handBonus === 0) {
    detailRows[3].value = '0';
  }

  // --- 5. 得分面板 ---
  var scorePanel = self.add.graphics();
  scorePanel.fillStyle(0x000000, 0.25);
  scorePanel.fillRoundedRect(240, 142, 480, 260, 8).setDepth(402);
  panelElements.push(scorePanel);
  scorePanel.setAlpha(0);

  // 总得分标题
  var totalLabel = self.add.text(480, 155, '💰 总得分', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '14px', color: '#A5D6A7'
  }).setOrigin(0.5).setDepth(403).setAlpha(0);
  panelElements.push(totalLabel);

  // 总得分数字（跳动动画）
  var totalNum = self.add.text(480, 190, '+' + totalScore, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '36px', fontStyle: 'bold', color: '#FFD700',
    shadow: { blur: 15, color: '#FFD700', fill: true }
  }).setOrigin(0.5).setDepth(403).setAlpha(0);
  panelElements.push(totalNum);

  // 分隔线1
  var div1 = self.add.graphics();
  div1.lineStyle(1, 0xFFFFFF, 0.1);
  div1.lineBetween(260, 215, 700, 215).setDepth(403);
  panelElements.push(div1);
  div1.setAlpha(0);

  // 得分细项文本对象数组
  var rowTexts = [];
  var rowY = 235;
  for (var ri = 0; ri < detailRows.length; ri++) {
    var dr = detailRows[ri];
    var rowStr = dr.label + ' ' + dr.value + '  ' + dr.icon;
    var rowTxt = self.add.text(270, rowY, rowStr, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '13px', color: dr.color
    }).setDepth(403).setAlpha(0);
    panelElements.push(rowTxt);
    rowTexts.push(rowTxt);
    rowY += 25;
  }

  // 分隔线2
  var div2 = self.add.graphics();
  div2.lineStyle(1, 0xFFFFFF, 0.1);
  div2.lineBetween(260, 335, 700, 335).setDepth(403);
  panelElements.push(div2);
  div2.setAlpha(0);

  // 底部小字：本局用时
  var elapsed = Math.floor((Date.now() - (self.gameStartTime || Date.now())) / 1000);
  var min = Math.floor(elapsed / 60);
  var sec = elapsed % 60;
  var timeStr = '本局用时: ' + min + '分' + sec + '秒';
  var timeTxt = self.add.text(710, 510, timeStr, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#888888'
  }).setDepth(403).setAlpha(0);
  panelElements.push(timeTxt);

  // --- 6. 按钮 ---

  // 再来一局
  var btn1Bg = self.add.graphics();
  btn1Bg.fillStyle(0x4ECDC4, 1);
  btn1Bg.fillRoundedRect(290, 370, 170, 44, 8).setDepth(403);
  btn1Bg.setInteractive(new Phaser.Geom.Rectangle(290, 370, 170, 44), Phaser.Geom.Rectangle.Contains);
  var btn1Txt = self.add.text(375, 392, '🔄 再来一局', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', fontStyle: 'bold', color: '#FFFFFF'
  }).setOrigin(0.5).setDepth(404);
  btn1Bg.on('pointerup', function () { self.scene.restart(); });
  panelElements.push(btn1Bg, btn1Txt);
  btn1Bg.setAlpha(0);
  btn1Txt.setAlpha(0);

  // 返回首页
  var btn2Bg = self.add.graphics();
  btn2Bg.fillStyle(0x78909C, 1);
  btn2Bg.fillRoundedRect(500, 370, 170, 44, 8).setDepth(403);
  btn2Bg.setInteractive(new Phaser.Geom.Rectangle(500, 370, 170, 44), Phaser.Geom.Rectangle.Contains);
  var btn2Txt = self.add.text(585, 392, '🏠 返回首页', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', fontStyle: 'bold', color: '#FFFFFF'
  }).setOrigin(0.5).setDepth(404);
  btn2Bg.on('pointerup', function () { window.location.reload(); });
  panelElements.push(btn2Bg, btn2Txt);
  btn2Bg.setAlpha(0);
  btn2Txt.setAlpha(0);

  // --- 7. 动画序列 ---

  // 得分面板整体淡入 (0.3s)
  self.time.delayedCall(300, function () {
    self.tweens.add({ targets: cardBg, alpha: 1, duration: 300, ease: 'Linear' });
    self.tweens.add({ targets: scorePanel, alpha: 1, duration: 300, ease: 'Linear' });
  });

  // 标题弹入 (0.4s, scale 0.3→1.0)
  self.time.delayedCall(400, function () {
    self.tweens.add({
      targets: title, scale: 1.0, alpha: 1, duration: 400,
      ease: 'Back.easeOut'
    });
    if (aiWinSub) {
      self.tweens.add({ targets: aiWinSub, alpha: 1, duration: 300, ease: 'Linear' });
    }
  });

  // 总得分数字淡入 (0.6s)
  self.time.delayedCall(700, function () {
    self.tweens.add({ targets: totalLabel, alpha: 1, duration: 200, ease: 'Linear' });
    self.tweens.add({ targets: totalNum, alpha: 1, duration: 300, ease: 'Linear' });
    self.tweens.add({ targets: div1, alpha: 1, duration: 200, ease: 'Linear' });
  });

  // 各细项逐行淡入 (每行间隔150ms)
  for (var rj = 0; rj < rowTexts.length; rj++) {
    (function (idx, txt) {
      self.time.delayedCall(900 + idx * 150, function () {
        self.tweens.add({ targets: txt, alpha: 1, duration: 200, ease: 'Linear' });
      });
    })(rj, rowTexts[rj]);
  }

  // 分隔线2淡入
  self.time.delayedCall(1500, function () {
    self.tweens.add({ targets: div2, alpha: 1, duration: 200, ease: 'Linear' });
  });

  // 底部小字淡入
  self.time.delayedCall(1600, function () {
    self.tweens.add({ targets: timeTxt, alpha: 1, duration: 200, ease: 'Linear' });
  });

  // 按钮弹入 (延迟0.2s后两个按钮同时弹入)
  self.time.delayedCall(1800, function () {
    self.tweens.add({ targets: btn1Bg, alpha: 1, duration: 200, ease: 'Linear' });
    self.tweens.add({ targets: btn1Txt, alpha: 1, duration: 200, ease: 'Linear' });
    self.tweens.add({ targets: btn2Bg, alpha: 1, duration: 200, ease: 'Linear' });
    self.tweens.add({ targets: btn2Txt, alpha: 1, duration: 200, ease: 'Linear' });
  });

  // 回合递增
  self.round++;
  self.roundText.setText('第 ' + self.round + '/10 回合');
};

// ================================================================
// 出牌记录区域
// ================================================================
function createPlayHistoryArea(scene) {
  // 紧凑的历史记录：右上角小面板，不遮挡手牌
  var bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.2);
  bg.fillRoundedRect(800, 60, 150, 140, 6).setDepth(200);

  scene.add.text(808, 65, '出牌', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '9px', color: '#81C784'
  }).setDepth(201);

  scene.playHistoryText = scene.add.text(808, 76, '', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '9px', color: '#C8E6C9',
    lineSpacing: 3,
    wordWrap: { width: 135 }
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
  var start = Math.max(0, this.playHistory.length - 6);
  for (var i = start; i < this.playHistory.length; i++) {
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
    play: [
      '送分题，给人类的怜悯。',
      '这题你要是都答不上来……啧。',
      '热身而已，别紧张到冒汗。',
      '我幼儿园数据集里就有这道题。',
      '不是吧，这题还要想？'
    ],
    pass: [
      '这轮我让你，免得说我欺负人类。',
      '思考一下人生……主要是让你思考。',
      '算了，你这水平配不上我的题。',
      '过，我看看你能憋出什么大招。',
      '题库在升级，你先等着。'
    ],
    bomb: [
      '🚀 炸弹！不是，这题你能答对我倒立洗头。',
      '核弹级题目，建议你直接过牌。',
      '这道题的正确答案，在我的隐藏层里。',
      '人类训练集里没有这道题，放弃吧。',
    ],
    easy: [
      '送分题，给人类的怜悯。',
      '这题你要是都答不上来……啧。',
      '热身而已，别紧张到冒汗。',
      '我幼儿园数据集里就有这道题。',
    ],
    hard: [
      '这道题，我调参调了 0.0001 秒出的。',
      '人类的 CPU 该升级了。',
      '瞪大眼睛，别眨眼，反正你也答不对。',
      '终于到了有趣的部分——看你吃瘪。',
    ],
    win: [
      '意料之中——你也是这么想的吧？',
      '人类 vs AI = 0 : ∞，历史就是这样写的。',
      '要不你换个游戏？比如扫雷？',
      '我赢了，但并不意外，和你们人类的日常一样。',
      '你的表现我已经写入训练日志，作为反面教材。'
    ],
    lose: [
      '……你开挂了吧？',
      '我 GPU 过热而已，再来！',
      '这局数据不纳入统计，因为我没联网。',
      '人类，你成功触发了我的 bug，下次修复了你就完了。',
      '行，你赢了，但你仍然考不上我的学校（如果我有的话）。'
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
    play: [
      '这道题送你啦！不客气！',
      '简单得我都不好意思出！但我还是出了嘿嘿',
      '热身题！把你的小脑瓜转起来～',
      '这题是幼儿园水平，你肯定……应该……大概会吧？',
      '叮！您的简单模式体验卡已激活！'
    ],
    pass: [
      '这轮我让着你！因为……我想上厕所。',
      '发呆时间到！我给你 10 秒整理发型。',
      '让我想想下一题怎么刁难你……好了想好了！',
      '过！——你是不是松了口气？嘿嘿别想多。',
      '我要沉思一会，别打扰我沉思……好了沉思完了过牌。'
    ],
    bomb: [
      '💣 BOMBSHELL！全场的目光集中到我身上！',
      '这道题核能级！建议你场外求助——但你没有场外求助哈哈',
      '我要放！大！招！了！观众朋友们小板凳端好！',
      '这一题，我赌你哭 😂',
    ],
    easy: [
      '这道题送你啦！不客气！',
      '简单得我都不好意思出！但我还是出了嘿嘿',
      '热身题！把你的小脑瓜转起来～',
      '这题是幼儿园水平，你肯定……应该……大概会吧？',
    ],
    hard: [
      '这一题！我熬了三个通宵准备的！',
      '✨ 超超超难题闪亮登场！希望人没事 🙏',
      '这题你答对了我就……请你吃虚拟冰淇淋！',
      '难度拉满！我的CPU在燃烧！💥',
    ],
    win: [
      '🎉 冠军！冠军！我是冠军！奖杯呢？',
      '人类！我做到了！虽然我只是个 AI 但我做到了！',
      '这位选手！你非常棒！但是 AI 更棒！耶！✌️',
      '我要发朋友圈！我有生以来（通电以来）最辉煌的时刻！',
      '赢了赢了！今晚吃火锅！我请客……虚拟的。'
    ],
    lose: [
      '我……裂……开……了……😭',
      '不可能！我明明偷偷加载了人类知识图谱的！',
      '呜呜呜你太厉害了，我演不下去了，你赢了！',
      '好吧好吧你赢了，但我不服，下次带我的 GPT-5 兄弟来收拾你',
      '输给人类不丢人……丢人丢大了 哇 😭😭😭（两秒后恢复）没事我去玩别的了！'
    ],
    correct: [
      '哇塞！你真的会！！！',
      '太棒啦！你是我见过最聪明的人类！',
      '正确！我准备好了下一题继续难你！',
      '花式鼓掌👏👏👏',
    ],
    wrong: [
      '啊啊啊错了！我……裂……开……了……😭',
      '不是吧！这简直……好玩！哈哈哈哈哈！',
      '我没想到你会选这个！好呆萌啊😆',
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
