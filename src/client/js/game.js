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
  width: 1320,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#0D3B0F',
  dom: { createContainer: true },
  resolution: window.devicePixelRatio || 2,
  roundPixels: false,
  autoRound: false,
  antialias: true,
  antialiasGL: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
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
  audioReady: false,
  init: function (scene) {
    this.scene = scene;
    var self = this;
    function tryResume() {
      if (self.audioReady) return;
      var ctx = scene.sound && scene.sound.context;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(function () {
          self.audioReady = true;
          self.playBGM(); // 激活时尝试播放背景音乐
        }).catch(function () {});
      } else if (ctx && ctx.state === 'running') {
        self.audioReady = true;
        self.playBGM();
      }
      if (!ctx) self.audioReady = true;
    }
    scene.input.on('pointerdown', tryResume);
    scene.time.delayedCall(500, tryResume);
  },
  // 播放背景音乐（带容错，找不到文件也不会报错崩溃）
  bgmNames: ['bgm_chinese', 'bgm_jazz', 'bgm_ambient'],
  bgmIndex: 0,
  currentBgm: null,
  playBGM: function() {
    if (this.bgmPlaying || !this.scene) return;
    try {
      var name = this.bgmNames[this.bgmIndex];
      var bgm = this.scene.sound.add(name, { loop: true, volume: 0.25 });
      this.bgmPlaying = true;
      this.currentBgm = bgm;
      if (this.scene.sound.locked) {
        this.scene.sound.once('unlocked', function() { bgm.play(); });
      } else {
        bgm.play();
      }
    } catch (e) {
      console.warn('BGM出错:', e.message);
    }
  },
  switchBGM: function() {
    // 安全判断：如果BGM文件尚未加载，跳过
    if (!this.scene || !this.scene.cache.audio.exists(this.bgmNames[this.bgmIndex])) {
      if (this.scene && this.scene.showToast) this.scene.showToast(this.scene, 'BGM加载中...');
      return '加载中';
    }
    // 停止当前BGM
    if (this.currentBgm) {
      this.currentBgm.stop();
      this.currentBgm.destroy();
      this.currentBgm = null;
    }
    this.bgmPlaying = false;
    // 切换到下一首
    this.bgmIndex = (this.bgmIndex + 1) % this.bgmNames.length;
    var names = ['古风', '爵士', '氛围'];
    console.log('BGM切换为: ' + names[this.bgmIndex]);
    // 播放新BGM
    try {
      var name = this.bgmNames[this.bgmIndex];
      var bgm = this.scene.sound.add(name, { loop: true, volume: 0.25 });
      bgm.play();
      this.bgmPlaying = true;
      this.currentBgm = bgm;
    } catch (e) {
      console.warn('BGM切换失败');
    }
    return names[this.bgmIndex];
  },
  // 纯本地动态 TTS 语音引擎
  speak: function(text, aiId) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'zh-CN';
    if (aiId === 'duidui') {
      msg.pitch = 0.7;   // 王怼怼：低沉、傲慢
      msg.rate = 1.1;
    } else {
      msg.pitch = 1.6;   // 苏甜甜：高频、可爱
      msg.rate = 1.25;
    }
    window.speechSynthesis.speak(msg);
  },
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
  playCard: function () { if(this._ensureReady()) this.scene.sound.play(this._random('cardPlace', 3), { volume: 0.8 }); },
  selectCard: function () { if(this._ensureReady()) this.scene.sound.play(this._random('cardSlide', 3), { volume: 0.6 }); },
  deselectCard: function () { if(this._ensureReady()) this.scene.sound.play(this._random('cardSlide', 3), { volume: 0.5 }); },
  playerTurn: function () { if(this._ensureReady()) this.scene.sound.play(this._random('chipsCollide', 3), { volume: 0.7 }); },
  bid: function () { if(this._ensureReady()) this.scene.sound.play(this._random('chipsCollide', 3), { volume: 0.7 }); },
  passBid: function () { if(this._ensureReady()) this.scene.sound.play(this._random('cardSlide', 3), { volume: 0.5 }); },
  win: function () { if(this._ensureReady()) this.scene.sound.play('cardPlace3', { volume: 0.9 }); },
  lose: function () { if(this._ensureReady()) this.scene.sound.play('cardSlide1', { volume: 0.6 }); },
  aiThink: function () {},
  bomb: function () {
    if(this._ensureReady()) this.scene.sound.play(this._random('cardPlace', 3), { volume: 1.0, detune: -400 });
    try { this.scene.sound.play('voice_duidui_bomb', { volume: 0.8 }); } catch(e) {}
  },
  pauseAll: function () { if (this.scene) this.scene.sound.pauseAll(); },
  resumeAll: function () { if (this.scene) this.scene.sound.resumeAll(); },
  playVoice: function(key) {
    if (!this.scene || !this._ensureReady()) return;
    try {
      this.scene.sound.play(key, { volume: 0.8 });
    } catch(e) { /* 语音文件没加载到就静默跳过 */ }
  },
  playTypeVoice: function(type, aiId) {
    if (!this.scene || !this._ensureReady()) return;
    var voiceMap = {
      SINGLE: 'voice_' + aiId + '_single',
      PAIR: 'voice_' + aiId + '_pair',
      TRIPLE: 'voice_duidui_triple',
      TRIPLE_PLUS_ONE: 'voice_duidui_triple_one',
      TRIPLE_PLUS_TWO: 'voice_duidui_triple_two',
      STRAIGHT: 'voice_' + aiId + '_straight',
      CONSECUTIVE_PAIRS: 'voice_duidui_consecutive_pairs',
      AIRPLANE: 'voice_' + aiId + '_airplane',
      AIRPLANE_PLUS_SINGLES: 'voice_duidui_airplane_plus',
      AIRPLANE_PLUS_PAIRS: 'voice_duidui_airplane_plus',
      FOUR_PLUS_TWO: 'voice_duidui_four_two',
      FOUR_PLUS_TWO_PAIRS: 'voice_duidui_four_two',
      BOMB: 'voice_duidui_bomb',
      ROCKET: 'voice_duidui_rocket'
    };
    var key = voiceMap[type];
    if (key) this.playVoice(key);
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
  this.hasDoneChaosThisTurn = false;
  this.chaosScore = 0;
  this.chaosTimeoutTimer = null;
  this.chaosPrefetchCache = {};
  // 重置气泡队列全局变量
  this.chaosBubbleTimer = null;
  this.chaosBubbleQueue = [];
  this.bubbleShowing = false;
  this.BUBBLE_QUEUE_MAX = 3;
};

GameScene.prototype.preload = function () {
  var cx = 660, cy = 300;
  var progressBox = this.add.graphics();
  progressBox.fillStyle(0x222222, 0.8);
  progressBox.fillRoundedRect(cx - 160, cy - 25, 320, 50, 10);
  var progressBar = this.add.graphics();
  var loadingText = this.add.text(cx, cy - 50, '游戏加载中...', {
    fontSize: '20px', color: '#ffffff'
  }).setOrigin(0.5);
  this.load.on('progress', function(v) {
    progressBar.clear().fillStyle(0x4ECDC4, 1).fillRoundedRect(cx - 150, cy - 15, 300 * v, 30, 8);
  });
  this.load.on('complete', function() {
    progressBar.destroy(); progressBox.destroy(); loadingText.destroy();
  });
  // \u5934\u50CF
  this.load.image('avatar_wang', 'assets/avatars/wang_duidui.png');
  this.load.image('avatar_su', 'assets/avatars/su_tiantian.png');
  this.load.image('avatar_player', 'assets/avatars/player_avatar.png');

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
    this.load.audio('cardPlace' + ai, 'assets/sounds/cardPlace' + ai + '.mp3');
    this.load.audio('cardSlide' + ai, 'assets/sounds/cardSlide' + ai + '.mp3');
    this.load.audio('chipsCollide' + ai, 'assets/sounds/chipsCollide' + ai + '.mp3');
  }
  this.load.audio('dieShuffle1', 'assets/sounds/dieShuffle1.mp3');
  this.load.audio('bgm_chinese', 'assets/sounds/bgm_chinese.mp3');
  // 额外音效
  this.load.audio('cardShuffle', 'assets/sounds/cardShuffle.mp3');
  this.load.audio('cardFan1', 'assets/sounds/cardFan1.mp3');
  this.load.audio('packOpen1', 'assets/sounds/packOpen1.mp3');
  this.load.audio('cardPlace4', 'assets/sounds/cardPlace4.mp3');
  this.load.audio('cardSlide4', 'assets/sounds/cardSlide4.mp3');
  this.load.audio('cardShove1', 'assets/sounds/cardShove1.mp3');
  this.load.audio('chipLay1', 'assets/sounds/chipLay1.mp3');
  this.load.audio('chipsStack1', 'assets/sounds/chipsStack1.mp3');
  this.load.audio('chipsHandle1', 'assets/sounds/chipsHandle1.mp3');

  // 角色语音（怼怼8句 + 甜甜7句）
  this.load.audio('voice_duidui_taunt', 'assets/sounds/voice_duidui_taunt.mp3');
  this.load.audio('voice_duidui_correct', 'assets/sounds/voice_duidui_correct.mp3');
  this.load.audio('voice_duidui_wrong', 'assets/sounds/voice_duidui_wrong.mp3');
  this.load.audio('voice_duidui_swap', 'assets/sounds/voice_duidui_swap.mp3');
  this.load.audio('voice_duidui_bomb', 'assets/sounds/voice_duidui_bomb.mp3');
  this.load.audio('voice_duidui_rocket', 'assets/sounds/voice_duidui_rocket.mp3');
  this.load.audio('voice_duidui_hurry', 'assets/sounds/voice_duidui_hurry.mp3');
  this.load.audio('voice_duidui_pass', 'assets/sounds/voice_duidui_pass.mp3');
  this.load.audio('voice_tiantian_start', 'assets/sounds/voice_tiantian_start.mp3');
  this.load.audio('voice_tiantian_correct', 'assets/sounds/voice_tiantian_correct.mp3');
  this.load.audio('voice_tiantian_wrong', 'assets/sounds/voice_tiantian_wrong.mp3');
  this.load.audio('voice_tiantian_timeout', 'assets/sounds/voice_tiantian_timeout.mp3');
  this.load.audio('voice_tiantian_swap', 'assets/sounds/voice_tiantian_swap.mp3');
  this.load.audio('voice_tiantian_turn', 'assets/sounds/voice_tiantian_turn.mp3');

  // 牌型语音
  var voiceFiles = ['single','pair','triple','triple_one','triple_two','straight',
    'consecutive_pairs','airplane','airplane_plus','four_two','spring','lastone'];
  voiceFiles.forEach(function(v) {
    this.load.audio('voice_duidui_' + v, 'assets/sounds/voice_duidui_' + v + '.mp3');
  }, this);
  ['pair','straight','airplane'].forEach(function(v) {
    this.load.audio('voice_tiantian_' + v, 'assets/sounds/voice_tiantian_' + v + '.mp3');
  }, this);

  this.load.audio('voice_duidui_weak', 'assets/sounds/voice_duidui_weak.mp3');
  this.load.audio('voice_duidui_arrogant', 'assets/sounds/voice_duidui_arrogant.mp3');
  this.load.audio('voice_duidui_confident', 'assets/sounds/voice_duidui_confident.mp3');
  this.load.audio('voice_duidui_beat', 'assets/sounds/voice_duidui_beat.mp3');
  this.load.audio('voice_duidui_cantbeat', 'assets/sounds/voice_duidui_cantbeat.mp3');
  this.load.audio('voice_duidui_call', 'assets/sounds/voice_duidui_call.mp3');
  this.load.audio('voice_duidui_nocall', 'assets/sounds/voice_duidui_nocall.mp3');
  this.load.audio('voice_tiantian_amazing', 'assets/sounds/voice_tiantian_amazing.mp3');
  this.load.audio('voice_tiantian_cheer', 'assets/sounds/voice_tiantian_cheer.mp3');
  this.load.audio('voice_tiantian_unlucky', 'assets/sounds/voice_tiantian_unlucky.mp3');
  this.load.audio('voice_tiantian_plead', 'assets/sounds/voice_tiantian_plead.mp3');
  this.load.audio('voice_tiantian_grab', 'assets/sounds/voice_tiantian_grab.mp3');
}

GameScene.prototype.create = function () {
  var self = this;
  // 唯一ID（不重复，绑定数据归属）
  var playerId = localStorage.getItem('doudizhu_playerId');
  if (!playerId) {
    playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    localStorage.setItem('doudizhu_playerId', playerId);
  }
  // 昵称（界面显示用）
  var displayName = localStorage.getItem('doudizhu_displayName');
  if (!displayName) {
    displayName = prompt('请输入你的昵称：') || '玩家';
    localStorage.setItem('doudizhu_displayName', displayName);
  }
  showToast(self, '欢迎回来，' + displayName + '！');
  // 画布尺寸已设为1320×600，所有UI坐标基于此布局，无需相机偏移
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

  var fsBtn = self.add.text(1300, 24, '⤢', {
    fontSize: '22px', color: '#FFFFFF',
    backgroundColor: '#00000066', padding: { x: 8, y: 6 }
  }).setOrigin(1, 0.5).setInteractive().setDepth(200);

  fsBtn.on('pointerdown', function () {
    // 在"等比留边"和"裁剪放大"之间切换
    if (game.scale.scaleMode === Phaser.Scale.FIT) {
      game.scale.scaleMode = Phaser.Scale.ENVELOP;
      showToast(self, '已切换为：放大沉浸模式');
    } else {
      game.scale.scaleMode = Phaser.Scale.FIT;
      showToast(self, '已切换为：等比全览模式');
    }
    game.scale.updateScale();

    // 触发系统级全屏
    var el = document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  });

  // 静音按钮
  var muteBtn = self.add.text(1250, 24, '🔊', {
    fontSize: '20px', color: '#FFFFFF',
    backgroundColor: '#00000066', padding: { x: 6, y: 4 }
  }).setOrigin(1, 0.5).setInteractive().setDepth(200);
  muteBtn.on('pointerdown', function() {
    self.sound.mute = !self.sound.mute;
    muteBtn.setText(self.sound.mute ? '🔇' : '🔊');
  });

  // 首次点击自动全屏
  var autoFSdone = false;
  self.input.once('pointerdown', function () {
    if (autoFSdone) return;
    autoFSdone = true;
    var el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(function(){});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  });

  // BGM切换按钮
  var bgmBtn = self.add.text(1200, 24, '🎵', {
    fontSize: '20px', color: '#FFFFFF',
    backgroundColor: '#00000066',
    padding: { x: 6, y: 4 }
  }).setOrigin(1, 0.5).setInteractive().setDepth(200);
  bgmBtn.on('pointerdown', function () {
    var name = SoundManager.switchBGM();
    showToast(self, 'BGM: ' + name);
  });

  // 开始斗地主按钮（替换自动延迟启动）
  var startBtnBg = self.add.graphics();
  startBtnBg.fillStyle(0x4ECDC4, 1);
  startBtnBg.fillRoundedRect(560, 260, 200, 80, 15).setDepth(250);
  startBtnBg.setInteractive(new Phaser.Geom.Rectangle(560, 260, 200, 80), Phaser.Geom.Rectangle.Contains);
  var startBtnTxt = self.add.text(660, 300, '开始斗地主', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '28px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(251);
  startBtnBg.on('pointerup', function() {
    startBtnBg.destroy();
    startBtnTxt.destroy();
    self.startBiddingPhase();
  });

  // 预取题目
  if (self.prefetchChaosQuestions) self.prefetchChaosQuestions();
  // 延迟加载非核心音频
  this.time.delayedCall(2000, function() {
    self.load.audio('bgm_jazz', 'assets/sounds/bgm_jazz.mp3');
    self.load.audio('bgm_ambient', 'assets/sounds/bgm_ambient.mp3');
    self.load.audio('voice_tiantian_chaos', 'assets/sounds/voice_tiantian_chaos.mp3');
    self.load.start();
  });
};

// ================================================================
// 背景
// ================================================================
function drawTableBackground(scene) {
  var W = 1320, H = 600;
  var cx = 660, cy = 260;

  var bg = scene.add.graphics();
  bg.fillGradientStyle(0x1B5E20, 0x1B5E20, 0x0D3B0F, 0x0D3B0F, 1);
  bg.fillRect(0, 0, W, H);

  // 中心光晕
  bg.fillStyle(0x2E7D32, 0.15);
  bg.fillEllipse(cx, cy, 320, 354);
  bg.fillStyle(0x388E3C, 0.1);
  bg.fillEllipse(cx, cy, 240, 360);

  // 外圈圆角边框
  bg.lineStyle(2, 0x4CAF50, 0.3);
  bg.strokeRoundedRect(13, 52, W - 26, 500, 9);

  // 四角装饰圆
  var corners = [[35, 63], [W - 35, 63], [35, 573], [W - 35, 573]];
  corners.forEach(function (pos) {
    bg.lineStyle(1, 0x4CAF50, 0.18);
    bg.strokeCircle(pos[0], pos[1], 9);
    bg.strokeCircle(pos[0], pos[1], 10);
    bg.strokeCircle(pos[0], pos[1], 5);
  });

  // 中心装饰矩形
  bg.lineStyle(1, 0x66BB6A, 0.15);
  bg.strokeRect(cx - 59, cy - 83, 118, 166);
  bg.strokeRect(cx - 48, cy - 59, 96, 118);

  // 中心装饰圆
  bg.lineStyle(1, 0x66BB6A, 0.08);
  bg.strokeCircle(cx, cy - 10, 67);
  bg.strokeCircle(cx, cy - 10, 93);
}

// ================================================================
// 顶部状态栏
// ================================================================
function createTopBar(scene) {
  var tb = scene.add.graphics();
  tb.fillStyle(0x000000, 0.35);
  tb.fillRect(0, 0, 1320, 56).setDepth(10);

  scene.roundText = scene.add.text(20, 18, '第 1/10 回合', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '18px', color: '#E8F5E9', fontStyle: 'bold'
  }).setDepth(11);

  // AI1 (王怼怼) - 向左拉开
  var ai1X = 240;
  var wAvatar = makeAvatarImage(scene, 'avatar_wang', ai1X, 28, 0x4FC3F7);
  scene.add.text(ai1X + 34, 12, '王怼怼', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '17px', color: '#E8F5E9', fontStyle: 'bold'
  }).setDepth(11);
  scene.ai1Count = scene.add.text(ai1X + 34, 30, '剩余 17 张', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '30px', color: '#A5D6A7'
  }).setDepth(11).setScale(0.5);

  // AI2 (苏甜甜) - 向右拉开
  var ai2X = 1080;
  var sAvatar = makeAvatarImage(scene, 'avatar_su', ai2X, 28, 0xFFB74D);
  scene.add.text(ai2X - 34, 12, '苏甜甜', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '17px', color: '#E8F5E9', fontStyle: 'bold'
  }).setOrigin(1, 0).setDepth(11);
  scene.ai2Count = scene.add.text(ai2X - 34, 30, '剩余 17 张', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '30px', color: '#A5D6A7'
  }).setOrigin(1, 0).setDepth(11).setScale(0.5);

  // 中央状态文字居中至 660
  scene.statusText = scene.add.text(660, 18, '', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '18px', color: '#A5D6A7', fontStyle: 'bold'
  }).setOrigin(0.5, 0).setDepth(11);

  var sep = scene.add.graphics();
  sep.lineStyle(1.5, 0x66BB6A, 0.3);
  sep.lineBetween(0, 56, 1320, 56);
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
  var cx = 660;
  var playBg = scene.add.graphics();
  playBg.fillStyle(0x000000, 0.1);
  playBg.fillRoundedRect(340, 59, 640, 206, 10).setDepth(10);

  scene.add.text(cx, 218, '\u51FA\u724C\u533A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '28px', color: '#66BB6A', alpha: 0.4
  }).setOrigin(0.5).setDepth(11).setScale(0.5);

  scene.ai1PlayLabel = scene.add.text(362, 65, '\u738B\u603C\u603C\uFF1A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '28px', color: '#A5D6A7'
  }).setDepth(11).setScale(0.5);
  scene.ai1PlayCardsGraphics = scene.add.graphics().setDepth(11);

  scene.ai2PlayLabel = scene.add.text(870, 65, '\u82CF\u751C\u751C\uFF1A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '28px', color: '#A5D6A7'
  }).setDepth(11).setScale(0.5);
  scene.ai2PlayCardsGraphics = scene.add.graphics().setDepth(11);

  scene.myPlayLabel = scene.add.text(cx, 270, '\u4F60\u51FA\uFF1A', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '28px', color: '#A5D6A7'
  }).setOrigin(0.5).setDepth(11).setScale(0.5);
  scene.myPlayCardsGraphics = scene.add.graphics().setDepth(11);

  scene.add.text(460, 60, '\u5E95\u724C: ? ? ?', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '24px', color: '#66BB6A', alpha: 0.4
  }).setDepth(11).setScale(0.5);
}

// ================================================================
// 手牌区
// ================================================================
function createHandArea(scene) {
  var handBg = scene.add.graphics();
  handBg.fillStyle(0x000000, 0.15);
  handBg.fillRoundedRect(200, 330, 920, 115, 10).setDepth(10);
  scene.add.text(68, 305, '\u4F60\u7684\u624B\u724C', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '22px', color: '#A5D6A7'
  }).setDepth(11).setScale(0.5);
  scene.playerAvatar = makeAvatarImage(scene, 'avatar_player', 100, 385, 0x66BB6A);
  scene.add.text(100, 415, '我', {
    fontSize: '16px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(12).setScale(0.5);
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

  var n = hand.length;
  var cw = 84, ch = 120;
  var maxHandZoneW = 1000;
  var overlap = n > 1 ? Math.min(45, (maxHandZoneW - cw) / (n - 1)) : 45;
  var totalWidth = cw + (n - 1) * overlap;
  var startX = (1320 - totalWidth) / 2;
  var baseY = 400;

  for (var ii = 0; ii < n; ii++) {
    var card = hand[ii];
    var cx = startX + ii * overlap + cw / 2;
    var arcOffset = Math.pow((ii / (n - 1)) - 0.5, 2) * 36;
    var cy = baseY - arcOffset;
    var key = getCardImageKey(card);

    var img = self.add.image(cx, cy, key).setDisplaySize(cw, ch).setDepth(110 + ii);

    // \u70B9\u51FB\u4E0E\u9009\u62E9
    img.setInteractive();
    img.setData('cardIdx', ii);
    img.setData('card', card);
    img.setData('selected', false);
    img.setData('origY', cy);
    img.setData('baseDepth', 110 + ii);

    img.on('pointerdown', function () {
      if (self.gameState !== GAME_STATE.PLAYER_TURN) {
        showToast(self, '\u73B0\u5728\u4E0D\u662F\u4F60\u7684\u51FA\u724C\u9636\u6BB5');
        return;
      }
      var idx2 = this.getData('cardIdx');
      var s = this.getData('selected');
      if (s) {
        this.y += 24;
        this.setData('selected', false);
        this.setDepth(this.getData('baseDepth'));
        var pos = self.selectedCards.indexOf(idx2);
        if (pos >= 0) self.selectedCards.splice(pos, 1);
        SoundManager.deselectCard();
      } else {
        this.y -= 24;
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
      if (origY !== undefined) { el.y = origY; }
      el.setData('selected', false);
      el.setDepth(el.getData('baseDepth') || 110);
    }
  }
};
GameScene.prototype._highlightCard = function (el) {
  if (!el) return;
  el.setData('selected', true);
  var origY = el.getData('origY');
  if (origY !== undefined) { el.y = origY - 24; }
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

  var cx = 660;
  var uiY = 280;
  var bids = [
    { label: '\u4E0D\u53EB', value: 0, color: 0xFF6B6B },
    { label: '1\u5206', value: 1, color: 0x4ECDC4 },
    { label: '2\u5206', value: 2, color: 0xFFD93D },
    { label: '3\u5206', value: 3, color: 0xFF6B35 }
  ];

  // 提示文字
  var promptText = this.add.text(cx, 180, '\u8BF7\u53EB\u5206', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(200);
  this.biddingUI.push(promptText);

  var bw = 110, bh = 60, gap = 20;
  var totalW = bw * 4 + gap * 3;
  var startX = cx - totalW / 2;

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
    var infoText = this.add.text(cx, 230, '\u2605 ' + label + ' (\u5F3A\u5EA6\u5206: ' + strength + ')', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '20px', color: '#A5D6A7'
    }).setOrigin(0.5).setDepth(200).setScale(0.5);
    this.biddingUI.push(infoText);
  }
};

GameScene.prototype.hideBiddingUI = function () {
  for (var i = 0; i < this.biddingUI.length; i++) {
    if (this.biddingUI[i]) {
      this.tweens.killTweensOf(this.biddingUI[i]);
      this.biddingUI[i].destroy();
    }
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
  if (bid >= 2 && aiIndex === 1) SoundManager.playVoice('voice_duidui_call');
  if (bid === 0 && aiIndex === 1) SoundManager.playVoice('voice_duidui_nocall');
  if (bid === 3 && aiIndex === 2) SoundManager.playVoice('voice_tiantian_grab');

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

// ================================================================
// 地主/农民身份标识
// ================================================================
GameScene.prototype.updateLandlordUI = function() {
  if (this.landlordBadgePlayer) this.landlordBadgePlayer.destroy();
  if (this.landlordBadgeAi1) this.landlordBadgeAi1.destroy();
  if (this.landlordBadgeAi2) this.landlordBadgeAi2.destroy();
  var positions = [
    { x: 100, y: 425 },
    { x: 240, y: 55 },
    { x: 1080, y: 55 }
  ];
  for (var i = 0; i < 3; i++) {
    var isLandlord = (this.landlordIndex === i);
    var roleText = isLandlord ? '👑 地主' : '👨‍🌾 农民';
    var bgColor = isLandlord ? '#FFD700' : '#81C784';
    var badge = this.add.text(positions[i].x, positions[i].y, roleText, {
      fontSize: '32px', color: '#000000',
      backgroundColor: bgColor, padding: { x: 4, y: 2 }, fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(15).setScale(0.5);
    if (i === 0) this.landlordBadgePlayer = badge;
    else if (i === 1) this.landlordBadgeAi1 = badge;
    else this.landlordBadgeAi2 = badge;
  }
};

GameScene.prototype.finishBidding = function (res) {
  this.landlordIndex = res.highestBidder;
  this.isLandlord = (res.highestBidder === 0);
  this.updateLandlordUI();

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
    self.hasDoneChaosThisTurn = false;
    if (self.startTurnTimer) self.startTurnTimer();
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
    this.bottomCardText = this.add.text(660, 72, '\u5E95\u724C: ? ? ?', {
      fontFamily: '\u201CPingFang SC\u201D,\u201CMicrosoft YaHei\u201D,sans-serif',
      fontSize: '24px', color: '#66BB6A', alpha: 0.4
    }).setOrigin(0.5).setDepth(20).setScale(0.5);
    return;
  }
  // 展示3张底牌牌面
  var startX = 660 - 50;
  for (var i = 0; i < cards.length; i++) {
    var key = getCardImageKey(cards[i]);
    var img = this.add.image(startX + i * 50, 72, key)
      .setDisplaySize(42, 60).setDepth(20);
    this.bottomCardImgs.push(img);
  }
};

// ================================================================
// 叫地主 - 本地逻辑
// ================================================================
GameScene.prototype.localAssignLandlord = function () {
  this.landlordIndex = Math.floor(Math.random() * 3);
  this.isLandlord = (this.landlordIndex === 0);
  this.updateLandlordUI();
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
    self.hasDoneChaosThisTurn = false;
    if (self.startTurnTimer) self.startTurnTimer();
    self.setStatusText('轮到你出牌（自由出牌）');
    SoundManager.playVoice('voice_tiantian_turn');
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
  var url = (typeof window !== 'undefined' ? (window.location.protocol + '//' + window.location.host) : 'http://localhost:3100') + path;
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
  this.clearTurnTimer();
  // 1. \u72B6\u6001\u62E6\u622A
  if (self.gameState !== GAME_STATE.PLAYER_TURN) {
    showToast(self, '\u73B0\u5728\u4E0D\u662F\u4F60\u7684\u51FA\u724C\u9636\u6BB5');
    return;
  }
  if (this.selectedCards.length === 0) {
    showToast(this, '\u8BF7\u5148\u9009\u62E9\u624B\u724C');
    return;
  }
  // 2. \u83B7\u53D6\u9009\u4E2D\u7684\u724C\u5E76\u672C\u5730\u8BC6\u522B\u724C\u578B
  var playCards = this.selectedCards.map(function (idx) { return self.playerHand[idx]; });
  var info = Doudizhu.identifyType(playCards);
  if (info.type === Doudizhu.HAND_TYPES.INVALID) {
    showToast(this, '\u975E\u6CD5\u724C\u578B\u7EC4\u5408');
    return;
  }
  // 3. \u672C\u5730\u9A8C\u8BC1\u80FD\u5426\u538B\u8FC7\u4E0A\u5BB6
  if (this.lastPlay && this.lastPlay.length > 0) {
    if (!Doudizhu.canBeat(playCards, this.lastPlay)) {
      showToast(this, '\u4E0D\u80FD\u538B\u8FC7\u4E0A\u5BB6\u7684\u724C');
      return;
    }
  }
  // 4. [\u6838\u5FC3\u4FEE\u590D] \u5E9F\u5F03 API \u7F51\u7EDC\u8BF7\u6C42\uFF0C\u76F4\u63A5\u5224\u5B9A\u6210\u529F\u5E76\u51FA\u724C
  this.confirmPlay(playCards, info);
};

GameScene.prototype.confirmPlay = function (playCards, info) {
  this.clearTurnTimer();
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
  SoundManager.playTypeVoice(info.type, 'duidui');
  if (this.playerHand.length === 1) {
    SoundManager.playVoice('voice_duidui_lastone');
  }
  if (info.type === 'BOMB' || info.type === 'ROCKET') { this.totalBombs++; SoundManager.bomb();
    SoundManager.playVoice('voice_tiantian_amazing');
    if (this.lastPlayPlayer && this.lastPlayPlayer !== 'player') {
      SoundManager.playVoice('voice_tiantian_unlucky');
    }
  }
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
  this.clearTurnTimer();
  if (this.gameState !== GAME_STATE.PLAYER_TURN) return;
  if (!this.lastPlay || this.lastPlay.length === 0) {
    showToast(this, '\u81EA\u7531\u51FA\u724C\u9636\u6BB5\u4E0D\u80FD\u8DF3\u8FC7');
    return;
  }
  this.passCount++;
  showToast(this, '\u4E0D\u51FA');
  SoundManager.playVoice('voice_duidui_pass');
  this.setStatusText('\u4F60\u9009\u62E9\u4E0D\u51FA');
  this.selectedCards = [];
  this.addPlayHistory('player', true);
  if (this.passCount >= 2) {
    this.clearTablePlays();
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
  this.hasDoneChaosThisTurn = false;
      if (this.startTurnTimer) this.startTurnTimer();
      this.setStatusText('\u4E24\u5BB6\u90FD\u8FC7\uFF0C\u8F6E\u5230\u4F60\u81EA\u7531\u51FA\u724C');
    }
    return;
  }
  var self = this;
  this.gameState = GAME_STATE.WAITING_AI;
  this.time.delayedCall(800, function () { self.doAITurn(0); });
};

GameScene.prototype.doHint = function () {
  if (this.gameState !== GAME_STATE.PLAYER_TURN) return;
  this.setStatusText('\u8BA1\u7B97\u53EF\u51FA\u724C\u578B...');
  // \u6838\u5FC3\u4F18\u5316\uFF1A\u4F7F\u7528 CardEngine \u672C\u5730\u5F15\u64CE\uFF0C\u5B9E\u73B0 0 \u5EF6\u8FDF\u79D2\u51FA\u63D0\u793A
  this.localHint();
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
  // 如果AI无牌可出，直接过牌，不走API
  if (this.lastPlay && this.lastPlay.length > 0) {
    var validPlays = Doudizhu.findValidPlays(hand, this.lastPlay);
    if (validPlays.length === 0) {
      this.time.delayedCall(1000, function() { self.handleAIPass(aiIndex, aiName); });
      return;
    }
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
  // 先出气泡，模拟AI思考感
  var bubbleKey = info.type === 'BOMB' || info.type === 'ROCKET' ? 'bomb' : 'play';
  this._showPlayBubble(aiIndex === 0 ? 'duidui' : 'tiantian', bubbleKey, info.type);
  if (info.type === 'BOMB' || info.type === 'ROCKET') { this.totalBombs++; SoundManager.bomb();
    if (aiIndex === 0) SoundManager.playVoice('voice_duidui_arrogant'); }
  if (info.type === 'ROCKET') this.rocketCount++;
  SoundManager.playTypeVoice(info.type, aiIndex === 0 ? 'duidui' : 'tiantian');
  if (info.type !== 'BOMB' && info.type !== 'ROCKET' && aiIndex === 0 && this.lastPlayPlayer === 'player') {
    SoundManager.playVoice('voice_duidui_beat');
  }
  if (playCards.length > 0 && playCards[0].rank <= 6 && aiIndex === 0 && Math.random() < 0.3) {
    SoundManager.playVoice('voice_duidui_weak');
  }
  if (aiIndex === 0 && hand.length === 1) {
    SoundManager.playVoice('voice_duidui_confident');
  }
  if (aiIndex === 1 && Math.random() < 0.2) {
    SoundManager.playVoice('voice_tiantian_cheer');
  }
  if (hand.length === 1 && aiIndex === 1 && Math.random() < 0.5) {
    SoundManager.playVoice('voice_tiantian_plead');
  }
  this.addPlayHistory(aiIndex === 0 ? 'ai1' : 'ai2', playCards);
  var self = this;
  // 800ms后摆牌+更新UI
  this.time.delayedCall(800, function () {
    self.displayPlay(playCards, aiIndex === 0 ? 'ai1' : 'ai2');
    self.setStatusText(aiName + ' \u51FA\u4E86 ' + (Doudizhu.HAND_TYPE_NAMES[info.type] || info.type));
    self.updateAICount(aiIndex);
    if (hand.length === 0) {
      self.renderRoundEndPanel(aiIndex === 0 ? 'ai1' : 'ai2');
      return;
    }
    if (aiIndex === 0) {
      self.setStatusText(aiName + ' \u51FA\u4E86 ' + (Doudizhu.HAND_TYPE_NAMES[info.type] || info.type) + '\uFF0C\u8F6E\u5230\u82CF\u751C\u751C');
      self.time.delayedCall(1200, function () { self.doAITurn(1); });
    } else {
      self.gameState = GAME_STATE.PLAYER_TURN;
    self.hasDoneChaosThisTurn = false;
      if (self.startTurnTimer) self.startTurnTimer();
      SoundManager.playerTurn();
      self.setStatusText('\u8F6E\u5230\u4F60\u51FA\u724C');
    }
  });
};

GameScene.prototype.handleAIPass = function (aiIndex, aiName) {
  this.passCount++;
  if (aiIndex === 0 && Math.random() < 0.5) {
    SoundManager.playVoice('voice_duidui_cantbeat');
  }
  this.setStatusText(aiName + ' \u4E0D\u51FA');
  this.updateAICount(aiIndex);
  this.addPlayHistory(aiIndex === 0 ? 'ai1' : 'ai2', true);
  this._showPlayBubble(aiIndex === 0 ? 'duidui' : 'tiantian', 'pass', '');
  if (this.passCount >= 2) {
    this.clearTablePlays();
    this.passCount = 0;
    this.lastPlay = null;
    this.lastPlayInfo = null;
    // \u81EA\u7531\u51FA\u724C\u6743\u7ED9\u4E0A\u4E00\u8F6E\u6700\u540E\u51FA\u724C\u8005\uFF08\u4E0D\u662F\u5F53\u524Dpass\u7684\u4EBA\uFF09
    if (this.lastPlayPlayer === 'player') {
      this.gameState = GAME_STATE.PLAYER_TURN;
  this.hasDoneChaosThisTurn = false;
      if (this.startTurnTimer) this.startTurnTimer();
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
  this.hasDoneChaosThisTurn = false;
    if (this.startTurnTimer) this.startTurnTimer();
      this.setStatusText('\u8F6E\u5230\u4F60\u51FA\u724C');
  }
};

GameScene.prototype.localAIPlay = function (aiIndex, aiName) {
  try {
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
  if (info.type === 'BOMB' || info.type === 'ROCKET') { this.totalBombs++; SoundManager.bomb();
    if (aiIndex === 0) SoundManager.playVoice('voice_duidui_arrogant'); }
  if (info.type === 'ROCKET') this.rocketCount++;
  SoundManager.playTypeVoice(info.type, aiIndex === 0 ? 'duidui' : 'tiantian');
  if (info.type !== 'BOMB' && info.type !== 'ROCKET' && aiIndex === 0 && this.lastPlayPlayer === 'player') {
    SoundManager.playVoice('voice_duidui_beat');
  }
  if (chosen.length > 0 && chosen[0].rank <= 6 && aiIndex === 0 && Math.random() < 0.3) {
    SoundManager.playVoice('voice_duidui_weak');
  }
  if (aiIndex === 0 && hand.length === 1) {
    SoundManager.playVoice('voice_duidui_confident');
  }
  if (aiIndex === 1 && Math.random() < 0.2) {
    SoundManager.playVoice('voice_tiantian_cheer');
  }
  if (hand.length === 1 && aiIndex === 1 && Math.random() < 0.5) {
    SoundManager.playVoice('voice_tiantian_plead');
  }
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
  this.hasDoneChaosThisTurn = false;
    if (this.startTurnTimer) this.startTurnTimer();
    SoundManager.playerTurn();
    this.setStatusText('\u8F6E\u5230\u4F60\u51FA\u724C');
  }
  } catch (e) {
    console.error("[localAIPlay] Error:", e);
    this.handleAIPass(aiIndex, aiName);
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
  var maxPlayZoneW = 600;
  var positions = {
    player: { x: 660, y: 195, w: 85, h: 122, origin: 0.5 },
    ai1:    { x: 360, y: 133, w: 72, h: 103, origin: 0.5 },
    ai2:    { x: 960, y: 133, w: 72, h: 103, origin: 0.5 }
  };
  var pos = positions[player] || positions.player;
  var n = cards.length;
  var overlap = Math.min(pos.w * 0.6, (maxPlayZoneW - pos.w) / Math.max(n - 1, 1));
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
  if (this.hasDoneChaosThisTurn) {
    showToast(this, '每回合只能搞事情一次');
    return;
  }
  this.hasDoneChaosThisTurn = true;

  // 暂停出牌音效
  SoundManager.pauseAll();

  // 清除出牌倒计时
  this.clearTurnTimer();

  // 设置螺旋模式
  this.gameState = GAME_STATE.CHAOS_MODE;
  this.chaosScore = this.chaosScore || 0;
  this.setStatusText('选题型...');

  // 选择被搞的AI角色
  var aiId = Math.random() < 0.5 ? 'duidui' : 'tiantian';
  var aiName = aiId === 'duidui' ? '王怼怼' : '苏甜甜';

  // 创建遮罩 -> 先显示题型选择
  try {
    self._createChaosOverlay(aiId, function () {
      self._showTypeSelection(aiId, aiName);
    });
  } catch (e) {
    console.error('[Chaos] doAction error:', e);
    self.gameState = GAME_STATE.PLAYER_TURN;
    self.hasDoneChaosThisTurn = false;
    if (self.startTurnTimer) self.startTurnTimer();
    SoundManager.resumeAll();
  }
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

  var title2 = self.add.text(660, 77, '📋 选个题型，开始搞事情', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '14px', color: '#333333', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(302);
  self.chaosElements.push(title2);

  // 2x2 网格：题型卡片
  var cardX = [300, 680];
  var cardY = [107, 257];
  var cardW = 340, cardH = 120;

  for (var ti = 0; ti < types.length; ti++) {
    var t = types[ti];
    var cx = cardX[ti % 2];
    var cy = cardY[Math.floor(ti / 2)];

    // 采用 Container 方案实现中心点完美的呼吸缩放动效
    var cardGroup = self.add.container(cx + cardW / 2, cy + cardH / 2).setDepth(302);
    var cardBg = self.add.graphics();
    cardBg.fillStyle(0xF8FAFF, 1);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    cardBg.lineStyle(1.5, 0xCCD8FF, 1);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);

    var iconTxt = self.add.text(-cardW / 2 + 16, -cardH / 2 + 16, t.icon, {
      fontFamily: 'sans-serif', fontSize: '48px'
    });

    var labelTxt = self.add.text(-cardW / 2 + 80, -cardH / 2 + 18, t.label, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '22px', color: '#222222', fontStyle: 'bold'
    });

    var descTxt = self.add.text(-cardW / 2 + 80, -cardH / 2 + 50, t.desc, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '14px', color: '#888888'
    });

    cardGroup.add([cardBg, iconTxt, labelTxt, descTxt]);
    cardGroup.setSize(cardW, cardH);
    cardGroup.setInteractive();
    self.chaosElements.push(cardGroup);

    (function (typeId, group, bg) {
      group.on('pointerover', function () {
        self.tweens.add({ targets: group, scale: 1.05, duration: 150, ease: 'Power2' });
        bg.clear().fillStyle(0xE8EEFF, 1).fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12)
          .lineStyle(2, 0x7C4DFF, 1).strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
      });
      group.on('pointerout', function () {
        self.tweens.add({ targets: group, scale: 1.0, duration: 150, ease: 'Power2' });
        bg.clear().fillStyle(0xF8FAFF, 1).fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12)
          .lineStyle(1.5, 0xCCD8FF, 1).strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
      });
      group.on('pointerdown', function () {
        if (self.chaosTypeSelection) {
          self.chaosTypeSelection = false;
          self.currentChaosType = typeId;
          if (self.chaosTitle) self.chaosTitle.setVisible(true);
          for (var di = self.chaosElements.length - 1; di >= 8; di--) {
            if (self.chaosElements[di]) self.chaosElements[di].destroy();
          }
          self.chaosElements = self.chaosElements.slice(0, 8);
          self._showChaosQuestion(aiId, aiName, typeId);
        }
      });
    })(t.id, cardGroup, cardBg);
  }
};

// ================================================================
// 搞事情 - 创建遮罩
// ================================================================
GameScene.prototype._createChaosOverlay = function (aiId, callback) {
  if (this.chaosOverlay) return;
  var self = this;

  // 1. 半透明遮罩（加深暗度增强沉浸感）
  var overlay = self.add.graphics();
  overlay.fillStyle(0x000000, 0.85);
  overlay.fillRect(0, 0, 1320, 600).setDepth(300);
  overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 1320, 600), Phaser.Geom.Rectangle.Contains);
  self.chaosElements = [overlay];
  self.chaosOverlay = overlay;

  // 2. 白色题目卡片背景（增加阴影与层次感）
  var cardShadow = self.add.graphics();
  cardShadow.fillStyle(0x000000, 0.4);
  cardShadow.fillRoundedRect(232, 52, 860, 380, 16).setDepth(300);
  self.chaosElements.push(cardShadow);
  self.chaosShadow = cardShadow;

  var cardX = 230, cardY = 50, cardW = 860;
  var cardBg = self.add.graphics();
  cardBg.fillStyle(0xFFFFFF, 1);
  cardBg.fillRoundedRect(cardX, cardY, cardW, 380, 16);
  // 内发光 / 主题紫色边框
  cardBg.lineStyle(3, 0x7C4DFF, 0.8);
  cardBg.strokeRoundedRect(cardX, cardY, cardW, 380, 16);
  cardBg.setDepth(301);
  self.chaosElements.push(cardBg);
  self.chaosCardBg = cardBg;

  // 3. 标题（美化排版）
  var title = self.add.text(660, 77, "🔥 搞事情！答题挑战", {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '26px',
    color: '#7C4DFF',
    fontStyle: 'bold',
    stroke: '#FFFFFF',
    strokeThickness: 4
  }).setOrigin(0.5, 0).setDepth(302);
  self.chaosElements.push(title);
  self.chaosTitle = title;

  // 4. 分数显示（变为胶囊样式）
  var scoreBg = self.add.graphics();
  scoreBg.fillStyle(0xFFD700, 0.2);
  scoreBg.fillRoundedRect(945, 76, 80, 26, 13).setDepth(302);
  var scoreText = self.add.text(985, 89, "得分: " + (self.chaosScore || 0), {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '13px',
    color: '#D84315',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(303);
  self.chaosElements.push(scoreBg, scoreText);
  self.chaosScoreText = scoreText;

  // AI 台词气泡
  self._showAiBubble(aiId, 'easy', 420);
  self._chaosAiId = aiId;

  // 5. 新版圆形关闭按钮（悬浮在卡片右上角边缘，红底白叉）
  var closeBtnBg = self.add.graphics();
  closeBtnBg.fillStyle(0xFF4757, 1);
  closeBtnBg.fillCircle(cardX + cardW - 17, cardY + 17, 16).setDepth(304);
  closeBtnBg.lineStyle(3, 0xFFFFFF, 1);
  closeBtnBg.strokeCircle(cardX + cardW - 17, cardY + 17, 16).setDepth(304);
  closeBtnBg.setInteractive(new Phaser.Geom.Circle(cardX + cardW - 17, cardY + 17, 16), Phaser.Geom.Circle.Contains);
  closeBtnBg.on('pointerup', function () { self._destroyChaos(); });
  var closeBtnText = self.add.text(cardX + cardW - 17, cardY + 17, "✖", {
    fontFamily: 'sans-serif',
    fontSize: '16px',
    color: '#FFFFFF',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(305);
  self.chaosElements.push(closeBtnBg, closeBtnText);

  if (callback) callback();
};// ================================================================
// 搞事情 - 显示题目（含4个选项）
// ================================================================
GameScene.prototype._showChaosQuestion = function (aiId, aiName, type) {
  var self = this;
  self.setStatusText(aiName + ' 出题中...');
  // 1. 屏幕中间加个醒目的加载提示面板
  var loadingBg = self.add.graphics();
  loadingBg.fillStyle(0x000000, 0.7);
  loadingBg.fillRoundedRect(560, 200, 200, 60, 12).setDepth(350);
  var loadingTxt = self.add.text(660, 230, '⏳ ' + aiName + ' 正在生成题目...', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '14px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(351);
  self.chaosElements.push(loadingBg, loadingTxt);
  self._chaosLoadingElements = [loadingBg, loadingTxt]; // 暂存，稍后销毁

  // 随机播放搞事情开场语音
  var chaosVoice = Math.random() > 0.5 ? 'voice_duidui_taunt' : 'voice_tiantian_chaos';
  SoundManager.playVoice(chaosVoice);

  // 查预取缓存
  var cached = self.chaosPrefetchCache && self.chaosPrefetchCache[type];
  if (cached && cached.length > 0) {
    var q = cached.shift();
    if (self._chaosLoadingElements) {
      self._chaosLoadingElements.forEach(function(el) { if(el) el.destroy(); });
      self._chaosLoadingElements = null;
    }
    self._renderQuestion(q, aiId);
    return;
  }

  if (this.isAPIMode && typeof ApiClient !== 'undefined') {
    ApiClient.generateChaosQuestion(type || 'random', 'normal', 1)
      .then(function (res) {
        // 先销毁加载面板（在渲染题目前）
        if (self._chaosLoadingElements) {
          self._chaosLoadingElements.forEach(function(el) { if(el) el.destroy(); });
          self._chaosLoadingElements = null;
        }
        if (res.success && res.questions && res.questions.length > 0) {
          self._renderQuestion(res.questions[0], aiId);
        } else {
          self._renderFallbackQuestion(aiId);
        }
      })
      .catch(function () {
        if (self._chaosLoadingElements) {
          self._chaosLoadingElements.forEach(function(el) { if(el) el.destroy(); });
          self._chaosLoadingElements = null;
        }
        self._renderFallbackQuestion(aiId);
      });
  } else {
    if (self._chaosLoadingElements) {
      self._chaosLoadingElements.forEach(function(el) { if(el) el.destroy(); });
      self._chaosLoadingElements = null;
    }
    self._renderFallbackQuestion(aiId);
  }
};

// ================================================================
// 搞事情 - 渲染题目
// ================================================================
GameScene.prototype._renderQuestion = function (q, aiId) {
  var self = this;
  // 销毁加载提示
  if (self._chaosLoadingElements) {
    self._chaosLoadingElements.forEach(function(el) { if(el) el.destroy(); });
    self._chaosLoadingElements = null;
  }
  self._clearQuestionArea();

  var rawType = q.questionType || q.type || '';
  var typeMap = {
    'vocabulary':'四六级单词','expression':'口语表达',
    'trivia':'冷知识','life_hack':'生活常识','bomb_mixed':'混合炸弹'
  };
  var typeLabel = typeMap[rawType] || rawType || '知识题';
  console.log('[Chaos] typeLabel:', typeLabel, 'q:', JSON.stringify(q));
  var typeIcon = '🧠';
  if (typeLabel.indexOf('voc') >= 0 || typeLabel.indexOf('word') >= 0) typeIcon = '📚';
  if (typeLabel.indexOf('expr') >= 0) typeIcon = '💬';
  if (typeLabel.indexOf('trivia') >= 0) typeIcon = '💡';
  if (typeLabel.indexOf('life') >= 0) typeIcon = '🏠';

  var tag = self.add.text(660, 120, typeIcon + ' ' + typeLabel, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '13px', color: '#FF6B35', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(302);
  self.chaosElements.push(tag);

  // 保留口语题兼容：q.expression, q.word
  var questionText = q.question || q.text || q.word || '';
  if (!questionText && q.scene) {
    questionText = '场景：' + q.scene + '\n对话：' + (q.dialogue || '');
  }
  if (!questionText) questionText = '【题目解析降级，请直接根据选项推理】';
  var qText = self.add.text(660, 140, questionText, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '22px', color: '#222222', fontStyle: 'bold',
    wordWrap: { width: 760 }, lineSpacing: 6
  }).setOrigin(0.5, 0).setDepth(302);
  self.chaosElements.push(qText);

  var options = q.options || q.Options || {};
  if (Array.isArray(options)) {
    var tmp = {}; ['A','B','C','D'].forEach(function(k,i){tmp[k]=options[i];});
    options = tmp;
  }
  if (Object.keys(options).length === 0) {
    options = { A:'选项解析失败', B:'盲猜B', C:'盲猜C', D:'盲猜D' };
    if (!q.answer) q.answer = 'A';
  }
  var optionKeys = ['A', 'B', 'C', 'D'];
  self.chaosQuestionAnswered = false;

  var optH = 120;
  var optW = 380;
  var startX = 660 - (optW * 2 + 40) / 2;
  var gridX = [startX, startX + optW + 40];
  var startY = Math.max(185, 140 + qText.displayHeight + 20);
  var gridY = [startY, startY + optH + 15];
  // 如果题目文字+选项超出卡片，拉伸白色卡片
  var neededHeight = startY + (optH * 2) + 40;
  if (neededHeight > 380 && self.chaosCardBg) {
    self.chaosCardBg.clear().fillStyle(0xFFFFFF, 1).fillRoundedRect(230, 50, 860, neededHeight, 16)
      .lineStyle(3, 0x7C4DFF, 0.8).strokeRoundedRect(230, 50, 860, neededHeight, 16);
    if (self.chaosShadow) self.chaosShadow.clear().fillStyle(0x000000, 0.4).fillRoundedRect(232, 52, 860, neededHeight, 16);
  }

  for (var oi = 0; oi < optionKeys.length; oi++) {
    var ok = optionKeys[oi];
    var optText = options[ok];
    if (!optText) continue;

    var gx = gridX[oi % 2];
    var gy = gridY[Math.floor(oi / 2)];

    // 保留微拟物阴影
    var optShadow = self.add.graphics();
    optShadow.fillStyle(0x000000, 0.06);
    optShadow.fillRoundedRect(gx+2, gy+3, optW, optH, 8).setDepth(301);

    var optBg = self.add.graphics();
    optBg.fillStyle(0xF5F5F5, 1);
    optBg.fillRoundedRect(gx, gy, optW, optH, 8).setDepth(302);
    optBg.lineStyle(2, 0xE0E0E0, 1);
    optBg.strokeRoundedRect(gx, gy, optW, optH, 8);
    optBg.setInteractive(new Phaser.Geom.Rectangle(gx, gy, optW, optH), Phaser.Geom.Rectangle.Contains);

    var optMarkBg = self.add.graphics();
    optMarkBg.fillStyle(0x4ECDC4, 1);
    optMarkBg.fillCircle(gx + 26, gy + optH / 2, 16).setDepth(303);
    var optMarkTxt = self.add.text(gx + 24, gy + optH / 2, ok, {
      fontFamily: '"PingFang SC",sans-serif',
      fontSize: '20px', color: '#FFFFFF', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(304);

    var optTxt = self.add.text(gx + 46, gy + optH / 2, optText, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '22px', color: '#333333',
      wordWrap: { width: optW - 56 },
      lineSpacing: 2
    }).setOrigin(0, 0.5).setDepth(303);

    optBg.setData('optKey', ok);
    optBg.setData('optBg', optBg);
    optBg.setData('optTxt', optTxt);
    optBg.setData('optMarkBg', optMarkBg);
    optBg.setData('optMarkTxt', optMarkTxt);
    optBg.setData('answer', q.answer);
    optBg.setData('origGx', gx);
    optBg.setData('origGy', gy);

    (function (optBg, ok) {
      optBg.on('pointerdown', function () {
        if (self.chaosQuestionAnswered) return;
        self.chaosQuestionAnswered = true;
        self._handleOptionClick(self, optBg, ok, aiId, q);
      });
    })(optBg, ok);

    self.chaosElements.push(optShadow, optBg, optMarkBg, optMarkTxt, optTxt);
  }

  // 倒计时栏
  if (self.chaosTimeoutTimer) {
    self.chaosTimeoutTimer.remove();
    self.chaosTimeoutTimer = null;
  }
  var progressBarBg = self.add.graphics();
  progressBarBg.fillStyle(0x000000, 0.1);
  progressBarBg.fillRoundedRect(250, 55, 820, 6, 3).setDepth(305);
  var progressBar = self.add.graphics().setDepth(306);
  self.chaosElements.push(progressBarBg, progressBar);
  var timerStart = Date.now();
  var timerDuration = 60000;
  self.chaosTimeoutTimer = self.time.addEvent({
    delay: 50, loop: true,
    callback: function () {
      var elapsed = Date.now() - timerStart;
      var remaining = 1 - Math.min(elapsed / timerDuration, 1);
      var color = remaining > 0.5 ? 0x4ECDC4 : (remaining > 0.2 ? 0xFFC107 : 0xFF5252);
      progressBar.clear().fillStyle(color, 1).fillRoundedRect(250, 55, 820 * remaining, 6, 3);
      if (elapsed >= timerDuration) {
        if (self.chaosTimeoutTimer) {
          self.chaosTimeoutTimer.remove();
          self.chaosTimeoutTimer = null;
        }
        self._handleChaosTimeout(aiId);
      }
    }
  });
};
// ================================================================
// 搞事情 - 处理选项点击
// ================================================================
GameScene.prototype._handleOptionClick = function (self, optBg, optKey, aiId, q) {
  if (self.chaosTimeoutTimer) {
    self.chaosTimeoutTimer.remove();
    self.chaosTimeoutTimer = null;
  }
  var answer = optBg.getData('answer');
  var isCorrect = (optKey === answer);
  if (isCorrect) {
    self.chaosScore = (self.chaosScore || 0) + 1;
    if (self.chaosScoreText) self.chaosScoreText.setText('得分: ' + self.chaosScore);
    SoundManager.win();
    SoundManager.playVoice(Math.random() > 0.5 ? 'voice_duidui_correct' : 'voice_tiantian_correct');
  } else {
    SoundManager.lose();
    SoundManager.playVoice(Math.random() > 0.5 ? 'voice_duidui_wrong' : 'voice_tiantian_wrong');
    // 答错时记录错题
    var playerId = localStorage.getItem('doudizhu_playerId');
    var recordedQuestion = q.question || q.text || q.word || '';
    if (!recordedQuestion && q.scene) {
      recordedQuestion = '场景：' + q.scene + ' / 对话：' + (q.dialogue || '');
    }
    if (!recordedQuestion) recordedQuestion = '未知题目';
    if (self.isAPIMode && typeof ApiClient !== 'undefined') {
      ApiClient.recordWrong({
        questionType: q._type || q.questionType || q.type || 'trivia',
        question: recordedQuestion,
        options: q.options || q.Options || {},
        userAnswer: optKey,
        correctAnswer: q.answer,
        difficulty: q._difficulty || q.difficulty || 'normal',
        playerId: playerId
      }).catch(function(err){ console.warn('错题记录失败:', err); });
    }
    // 本地备份
    var localWrongBook = JSON.parse(localStorage.getItem('doudizhu_wrongbook') || '[]');
    localWrongBook.unshift({
      id: 'local_' + Date.now(),
      questionType: q._type || q.questionType || q.type || 'trivia',
      question: recordedQuestion,
      options: q.options || q.Options || {},
      userAnswer: optKey,
      correctAnswer: q.answer,
      isCorrect: false,
      timestamp: new Date().toISOString()
    });
    if (localWrongBook.length > 100) localWrongBook = localWrongBook.slice(0, 100);
    localStorage.setItem('doudizhu_wrongbook', JSON.stringify(localWrongBook));
  }
  self._clearQuestionArea();

  var feedbackScene = isCorrect ? 'correct' : 'wrong';
  var fbIcon = self.add.text(660, 115, (isCorrect ? '✅ 答对了！+1' : '❌ 答错了！'), {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '20px', color: (isCorrect ? '#4CAF50' : '#E53935'), fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(305);
  self.chaosElements.push(fbIcon);

  // 动态叠加 Y 坐标，防止长答案重叠
  var fbY = 145;
  if (!isCorrect && q.answer) {
    var correctAns = self.add.text(660, fbY, '正确答案: ' + q.answer + '. ' + (q.options[q.answer] || ''), {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '22px', color: '#2E7D32', fontStyle: 'bold',
      wordWrap: { width: 760 }, lineSpacing: 4
    }).setOrigin(0.5, 0).setDepth(305);
    self.chaosElements.push(correctAns);
    fbY += correctAns.displayHeight + 8;
  }
  var explText = q.explanation || q.definition || q.translation || q.fun_fact || q.pro_tip;
  if (explText) {
    var expl = self.add.text(660, fbY, '解析: ' + explText, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '17px', color: '#333333',
      wordWrap: { width: 760 }, lineSpacing: 2
    }).setOrigin(0.5, 0).setDepth(305);
    self.chaosElements.push(expl);
    fbY += expl.displayHeight + 8;
  }
  self._showAiBubble(aiId, feedbackScene, fbY + 5);
  if (isCorrect) {
    self._showSwapUI(aiId, fbY);
  } else {
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
  // Y=120 避开 Y=77的标题重叠
  var fbIcon = self.add.text(660, 120, '⏱ 超时了！', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '20px', color: '#FF5252', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(305);
  self.chaosElements.push(fbIcon);
  SoundManager.playVoice('voice_tiantian_timeout');
  if (!self.playerHand || self.playerHand.length === 0) {
    self._showSwapButtons(aiId, 160);
    return;
  }
  self._showSwapResult(aiId, false, 120);
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
  // 将牌面映射为全中文简体
  var getChineseCardName = function(c) {
    if (!c) return '无';
    if (c.suit === 'joker') return c.rank > 14 ? '大王' : '小王';
    var suits = { 'spade': '黑桃', 'heart': '红桃', 'club': '梅花', 'diamond': '方块' };
    var rankNames = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
    var rankDisplay = (c.rank >= 0 && c.rank < rankNames.length) ? rankNames[c.rank] : '?';
    return (suits[c.suit] || '') + rankDisplay;
  };
  // 确认面板的起始位置，根据上一块动态决定，保证不遮挡
  var confirmPanelY = Math.max(fbY + 10, 150);
  if (!self.playerHand || self.playerHand.length === 0) {
    var emptyMsg = self.add.text(660, confirmPanelY + 30, '你的手牌为空，AI无牌可拿', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '16px', color: '#FFB74D', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(310);
    self.chaosElements.push(emptyMsg);
    self._showSwapButtons(aiId, confirmPanelY + 80);
    return;
  }
  var idx = Math.floor(Math.random() * self.playerHand.length);
  var lostCard = self.playerHand[idx];
  var aiMinCard = null;
  var aiMinIdx = -1;
  if (confirmPanelY > 380) confirmPanelY = 380;
  if (aiHand && aiHand.length > 0) {
    for (var k = 0; k < aiHand.length; k++) {
      if (aiMinCard === null || aiHand[k].rank < aiMinCard.rank) {
        aiMinCard = aiHand[k];
        aiMinIdx = k;
      }
    }
  }
  var panelBg = self.add.graphics();
  panelBg.fillStyle(0xFFF8E1, 1);
  panelBg.fillRoundedRect(360, confirmPanelY, 600, 190, 10).setDepth(308);
  panelBg.lineStyle(2, 0xFFC107, 1);
  panelBg.strokeRoundedRect(360, confirmPanelY, 600, 190, 10).setDepth(308);
  self.chaosElements.push(panelBg);
  var hintTxt = self.add.text(660, confirmPanelY + 20, '⚠️ 惩罚：' + aiName + ' 决定用它的最小牌换走你的一张牌！', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '16px', color: '#E65100', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(309);
  self.chaosElements.push(hintTxt);
  // 绘制展示牌面的通用方法（带阴影）
  var drawCardWithShadow = function(x, y, cardObj) {
    var shadow = self.add.graphics();
    shadow.fillStyle(0x000000, 0.2);
    shadow.fillRoundedRect(x - 38 + 3, y - 53 + 3, 75, 105, 4).setDepth(309);
    self.chaosElements.push(shadow);
    var key = getCardImageKey(cardObj);
    var img = self.add.image(x, y, key).setDisplaySize(75, 105).setDepth(310);
    self.chaosElements.push(img);
  };
  var t1 = self.add.text(450, confirmPanelY + 85, '你的牌:', {
    fontFamily: '"PingFang SC"', fontSize: '18px', color: '#333'
  }).setOrigin(1, 0.5).setDepth(309);
  drawCardWithShadow(480, confirmPanelY + 85, lostCard);
  var swapIcon = self.add.text(660, confirmPanelY + 85, '🔄', {
    fontSize: '36px'
  }).setOrigin(0.5).setDepth(309);
  var t2 = self.add.text(870, confirmPanelY + 85, 'AI的牌:', {
    fontFamily: '"PingFang SC"', fontSize: '18px', color: '#333'
  }).setOrigin(0, 0.5).setDepth(309);
  if (aiMinCard) {
    drawCardWithShadow(900, confirmPanelY + 85, aiMinCard);
  } else {
    self.add.text(590, confirmPanelY + 85, '无牌', {
      fontSize: '16px', color: '#E65100'
    }).setOrigin(0.5).setDepth(309);
  }
  self.chaosElements.push(t1, swapIcon, t2);
  var btnBg = self.add.graphics();
  btnBg.fillStyle(0xFF5252, 1);
  btnBg.fillRoundedRect(560, confirmPanelY + 150, 200, 50, 10).setDepth(310);
  btnBg.setInteractive(new Phaser.Geom.Rectangle(560, confirmPanelY + 150, 200, 50), Phaser.Geom.Rectangle.Contains);
  var btnTxt = self.add.text(660, confirmPanelY + 175, '接受惩罚', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '17px', color: '#FFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(311);
  self.chaosElements.push(btnBg, btnTxt);
  btnBg.on('pointerup', function() {
    SoundManager.playVoice(aiId === 'duidui' ? 'voice_duidui_swap' : 'voice_tiantian_swap');
    btnBg.destroy();
    btnTxt.destroy();
    hintTxt.destroy();
    self.playerHand.splice(idx, 1);
    aiHand.push(lostCard);
    if (aiMinIdx >= 0) {
      aiHand.splice(aiMinIdx, 1);
      self.playerHand.push(aiMinCard);
      self.playerHand = Doudizhu.sortCards(self.playerHand);
    }
    self.renderPlayerHand();
    self.updateAICount(aiId === 'duidui' ? 0 : 1);
    var pName = getChineseCardName(lostCard);
    var aName = getChineseCardName(aiMinCard);
    var swapText = self.add.text(660, 470, '✅ 互换完毕：' + aiName + ' 用 [' + aName + '] 换了你的 [' + pName + ']', {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '16px', color: '#4CAF50', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(310);
    self.chaosElements.push(swapText);
    self._showSwapButtons(aiId, confirmPanelY + 150);
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
  swapOverlay.fillRect(0, 0, 1320, 600).setDepth(350);
  swapOverlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 1320, 600), Phaser.Geom.Rectangle.Contains);
  swapElements.push(swapOverlay);

  // 标题
  var titleTxt = self.add.text(660, 90, '🎉 答对了！赢一张牌！', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '18px', color: '#FFD700', fontStyle: 'bold',
    stroke: '#000000', strokeThickness: 2
  }).setOrigin(0.5).setDepth(351);
  swapElements.push(titleTxt);

  var hintTxt = self.add.text(660, 118, '选一张你的牌交出，然后猜AI的牌位置', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '16px', color: '#FFFFFF', fontStyle: 'bold',
    stroke: '#000000', strokeThickness: 3
  }).setOrigin(0.5).setDepth(351);
  swapElements.push(hintTxt);

  // 玩家手牌（正面展示，选一张交出）
  var playerLabel = self.add.text(660, 140, '你的手牌（点击选一张交出）', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '12px', color: '#4FC3F7', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(351);
  swapElements.push(playerLabel);

  var myHandSorted = Doudizhu.sortCards(self.playerHand.slice());
  var myCardW = 84, myCardH = 120, myOverlap = 25;
  var myTotalW = myCardW + (myHandSorted.length - 1) * myOverlap;
  var myStartX = Math.floor((1320 - myTotalW) / 2);

  for (var mi = 0; mi < myHandSorted.length; mi++) {
    var mcx = myStartX + mi * myOverlap + myCardW / 2;
    var mkey = getCardImageKey(myHandSorted[mi]);
    var mcard = self.add.image(mcx, 195, mkey).setDisplaySize(myCardW, myCardH).setDepth(352);
    mcard.setInteractive();
    mcard.setData('origY', 195);
    swapElements.push(mcard);
    (function (idx, card) {
      card.on('pointerdown', function () {
        if (selectedPlayerCardEl && selectedPlayerCardEl !== card) {
          selectedPlayerCardEl.setDisplaySize(myCardW, myCardH).setDepth(352);
          selectedPlayerCardEl.setY(selectedPlayerCardEl.getData('origY'));
        }
        if (selectedPlayerCardEl === card) {
          // Q3: 已选中→取消
          card.setDisplaySize(myCardW, myCardH).setDepth(352);
          card.setY(card.getData('origY'));
          selectedPlayerCardIdx = -1;
          selectedPlayerCardEl = null;
          return;
        }
        selectedPlayerCardIdx = idx;
        selectedPlayerCardEl = card;
        card.setDisplaySize(myCardW + 10, myCardH + 10).setDepth(352);
        card.setY(card.getData('origY') - 15);
      });
    })(mi, mcard);
  }

  // 下方牌背盲选（3-5张，1张是真AI牌）
  var backLabel = self.add.text(660, 245, '猜猜哪张是AI的牌（完全盲选）', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '12px', color: '#FFB74D', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(351);
  swapElements.push(backLabel);

  var numBacks = 2 + Math.floor(Math.random() * 2); // 2-3
  var backW = 78, backH = 108, backOverlap = backW + 16;
  var backTotalW = backW + (numBacks - 1) * backOverlap;
  var backStartX = Math.floor((1320 - backTotalW) / 2);

  var aiHandSorted = Doudizhu.sortCards(aiHand.slice());
  var realAICard = aiHandSorted[0];  // 排序后取最小
  var realAICardSlot = Math.floor(Math.random() * numBacks);

  var backCardPositions = [];

  var selectedGoldBorder = null;
  for (var bi = 0; bi < numBacks; bi++) {
    var bcx = backStartX + bi * backOverlap + backW / 2;
    var bcy = 320;
    var isReal = (bi === realAICardSlot);
    // 牌背阴影
    var cardShadow = self.add.graphics();
    cardShadow.fillStyle(0x000000, 0.5);
    cardShadow.fillRoundedRect(bcx - backW/2 - 2, bcy - backH/2 - 2, backW + 4, backH + 4, 4).setDepth(351 + bi * 2);
    swapElements.push(cardShadow);
    var backCard = self.add.image(bcx, bcy, 'cardBack').setDisplaySize(backW, backH).setDepth(352 + bi * 2);
    backCard.setInteractive();
    backCard.setData('isReal', isReal);
    swapElements.push(backCard);
    backCardPositions.push({ x: bcx, y: bcy });

    (function (bIdx, cardEl, crdX, crdY) {
      cardEl.setData('origY', crdY);
      cardEl.on('pointerdown', function () {
        if (selectedBackEl && selectedBackEl !== cardEl) {
          selectedBackEl.setDisplaySize(backW, backH).setDepth(352 + bIdx * 2);
          selectedBackEl.setY(selectedBackEl.getData('origY'));
          if (selectedGoldBorder) {
            selectedGoldBorder.destroy();
            selectedGoldBorder = null;
          }
        }
        if (selectedBackEl === cardEl) {
          // Q3: 已选中→取消
          cardEl.setDisplaySize(backW, backH).setDepth(352 + bIdx * 2);
          cardEl.setY(cardEl.getData('origY'));
          if (selectedGoldBorder) {
            selectedGoldBorder.destroy();
            selectedGoldBorder = null;
          }
          selectedBackIdx = -1;
          selectedBackEl = null;
          updateConfirmBtn();
          return;
        }
        selectedBackIdx = bIdx;
        selectedBackEl = cardEl;
        cardEl.setDisplaySize(backW + 10, backH + 10).setDepth(360);
        cardEl.setY(cardEl.getData('origY') - 15);
        if (selectedGoldBorder) selectedGoldBorder.destroy();
        selectedGoldBorder = self.add.graphics();
        var boxW = backW + 18; var boxH = backH + 18;
        selectedGoldBorder.lineStyle(3, 0xFFD700, 1);
        selectedGoldBorder.strokeRoundedRect(
          crdX - (backW+10)/2 - 4,
          crdY - 15 - (backH+10)/2 - 4,
          boxW, boxH, 8
        ).setDepth(361);
        swapElements.push(selectedGoldBorder);
        updateConfirmBtn();
      });
    })(bi, backCard, bcx, bcy);
  }

  function updateConfirmBtn() {
    if (selectedPlayerCardIdx >= 0 && selectedBackIdx >= 0) {
      confirmBg.clear().fillStyle(0x4ECDC4, 1).fillRoundedRect(450, 410, 200, 44, 10).setDepth(353);
    } else {
      confirmBg.clear().fillStyle(0x4ECDC4, 0.5).fillRoundedRect(450, 410, 200, 44, 10).setDepth(353);
    }
  }

  // 确认按钮（左）
  var confirmBg = self.add.graphics();
  confirmBg.fillStyle(0x4ECDC4, 0.5);
  confirmBg.fillRoundedRect(450, 410, 200, 44, 10).setDepth(353);
  var confirmTxt = self.add.text(550, 432, '✅ 确认交换', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '17px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(354);
  confirmBg.setInteractive(new Phaser.Geom.Rectangle(450, 410, 200, 44), Phaser.Geom.Rectangle.Contains);
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

    // 销毁所有swap UI元素，避免挡住视线
    for (var ei = 0; ei < swapElements.length; ei++) {
      if (swapElements[ei]) swapElements[ei].destroy();
    }

    // 核心修复：无论是否猜中，都给玩家强制换牌！
    // 猜中给 realAICard，猜错随机从 AI 手里抽一张
    var aiTargetCard = isWin ? realAICard : aiHand[Math.floor(Math.random() * aiHand.length)];

    // 在选中的牌背位置创建飞出的动画卡片
    var revealCard = self.add.image(selectedBackPos.x, selectedBackPos.y, getCardImageKey(aiTargetCard))
      .setDisplaySize(backW, backH).setDepth(400);

    // 飞入动画
    self.tweens.add({
      targets: revealCard,
      x: 660, y: 370,
      scaleX: 0.8, scaleY: 0.8, angle: 720, duration: 600, ease: 'Cubic.easeOut',
      onComplete: function () {
        revealCard.destroy();

        // 执行底层数据互换
        var aReal = -1;
        for (var a = 0; a < aiHand.length; a++) {
          if (aiHand[a].suit === aiTargetCard.suit && aiHand[a].rank === aiTargetCard.rank) {
            aReal = a; break;
          }
        }
        if (aReal >= 0) {
          self.playerHand.splice(pReal, 1);
          aiHand.splice(aReal, 1);
          self.playerHand.push(aiTargetCard);
          aiHand.push(pCard);
          self.playerHand = Doudizhu.sortCards(self.playerHand);
        }

        // 重新渲染，让玩家立刻看到牌变了
        self.renderPlayerHand();
        self.updateAICount(aiId === 'duidui' ? 0 : 1);

        // 弹出明确的交换成功提示
        var pSuitStr = Doudizhu.SUIT_NAMES ? Doudizhu.SUIT_NAMES[pCard.suit] : '';
        var pRankStr = Doudizhu.RANK_NAME_MAP[pCard.rank] || '';
        var aSuitStr = Doudizhu.SUIT_NAMES ? Doudizhu.SUIT_NAMES[aiTargetCard.suit] : '';
        var aRankStr = Doudizhu.RANK_NAME_MAP[aiTargetCard.rank] || '';

        var resultText = isWin ? '🎯 欧皇手气！用' : '🔄 盲抽成功！用';
        var swapMsg = self.add.text(660, fbY + 20, resultText + '[' + pSuitStr + pRankStr + ']换了AI的[' + aSuitStr + aRankStr + ']', {
          fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
          fontSize: '17px', color: isWin ? '#FFD700' : '#4CAF50', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 2
        }).setOrigin(0.5).setDepth(310);
        self.chaosElements.push(swapMsg);

        self._showSwapButtons(aiId, Math.max(fbY + 60, 280));
      }
    });
  });

  // 取消按钮（右）
  var cancelBg = self.add.graphics();
  cancelBg.fillStyle(0x78909C, 1);
  cancelBg.fillRoundedRect(670, 410, 200, 44, 10).setDepth(353);
  var cancelTxt = self.add.text(770, 432, '✖ 跳过交换', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '17px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(354);
  cancelBg.setInteractive(new Phaser.Geom.Rectangle(670, 410, 200, 44), Phaser.Geom.Rectangle.Contains);
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
  btnY = 520;
  var againBg = self.add.graphics();
  againBg.fillStyle(0x4ECDC4, 1);
  againBg.fillRoundedRect(420, btnY, 220, 50, 10).setDepth(305);
  var againTxt = self.add.text(540, btnY + 25, '🔄 再来一题', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '22px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(306);
  againBg.setInteractive(new Phaser.Geom.Rectangle(420, btnY, 220, 50), Phaser.Geom.Rectangle.Contains);
  againBg.on('pointerup', function () {
    self.chaosQuestionAnswered = false;
    self._clearQuestionArea();
    var aiId2 = Math.random() < 0.5 ? 'duidui' : 'tiantian';
    var chaosType = self.currentChaosType || undefined;
    self._showChaosQuestion(aiId2, aiId2 === 'duidui' ? '王怼怼' : '苏甜甜', chaosType);
  });
  self.chaosElements.push(againBg, againTxt);
  var closeBg = self.add.graphics();
  closeBg.fillStyle(0xFF6B6B, 1);
  closeBg.fillRoundedRect(660, btnY, 220, 50, 10).setDepth(305);
  var closeTxt = self.add.text(780, btnY + 25, '✖ 关掉回牌', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '22px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(306);
  closeBg.setInteractive(new Phaser.Geom.Rectangle(660, btnY, 220, 50), Phaser.Geom.Rectangle.Contains);
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
      answer: 'A', explanation: 'abandon \u610F\u4E3A"\u653E\u5F03"\uFF0C\u662F\u56DB\u7EA7\u5FC3\u8BCD\u6C47\u3002',
      questionType: 'vocabulary'
    },
    {
      question: '\u201CI\'m feeling under the weather\u201D \u610F\u601D\u662F:',
      options: { A: '\u5728\u5929\u6C14\u4E0B\u9762', B: '\u751F\u75C5\u4E86', C: '\u559C\u6B22\u4E0D\u540C\u5929\u6C14', D: '\u50BB\u50BB\u7B28\u7B28' },
      answer: 'B', explanation: '"Under the weather"\u662F\u5730\u9053\u53E3\u8BEd\uFF0C\u610F\u4E3A"\u751F\u75C5\u4E0D\u8212\u670D"\u3002',
      questionType: 'expression'
    },
    {
      question: '\u54EA\u4E2A\u52A8\u7269\u51E0\u4E4E\u4E0D\u751F\u764C\u75C7\uFF1F',
      options: { A: '\u9CA8\u9C7C', B: '\u5927\u8C61', C: '\u88F8\u9F20\u9F20', D: '\u4E4C\u9F9F' },
      answer: 'C', explanation: '🧬 \u88F8\u9F20\u9F20\u51E0\u4E4E\u4ECE\u4E0D\u60A3\u764C\u75C7\uFF01\u5B83\u4EEC\u4F53\u5185\u6709\u7279\u6B8A\u7684\u900F\u660E\u8D28\u9178\u80FD\u963B\u6B62\u764C\u7EC6\u80DE\u5206\u88C2\u3002',
      questionType: 'trivia'
    },
    {
      question: '\u54EA\u79CD\u65B9\u6CD5\u80FD\u8BA9\u5207\u6D0B\u8471\u4E0D\u6D41\u6CEA\uFF1F',
      options: { A: '\u51B7\u51BB30\u5206\u949F', B: '\u542B\u4E00\u53E3\u6C34', C: '\u6234\u6CF3\u955C', D: '\u5FAE\u6CE2\u52A010\u79D2' },
      answer: 'C', explanation: '🕶️ \u6234\u6CF3\u955C\u662F\u6700\u76F4\u63A5\u7684\u7269\u7406\u65B9\u6CD5——\u963B\u6B62\u50AC\u6CEA\u6C14\u4F53\u63A5\u89E6\u773C\u775B\u3002\u51B7\u51BB\u4E5F\u6709\u6548\u4F46\u6548\u679C\u6709\u9650\u3002',
      questionType: 'life_hack'
    }
  ];
  var q = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
  self._renderQuestion(q, aiId);
};

// ================================================================
// 气泡队列系统 — 防止多个事件同时弹出重叠
// ================================================================

// Q1: 改为 GameScene 方法
GameScene.prototype._processBubbleQueue = function () {
  if (!this.chaosBubbleQueue) return;
  if (this.chaosBubbleQueue.length === 0) {
    this.bubbleShowing = false;
    return;
  }
  this.bubbleShowing = true;
  var item = this.chaosBubbleQueue.shift();
  item.render();
};

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
    // C2: 增大气泡尺寸防止长文字溢出
    var baseSize = 64;
    // 先创建临时文本获取精确尺寸
    var tempStyle = isEmergency ? {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '16px', color: '#FFCDD2', fontStyle: 'bold',
      wordWrap: { width: 200 }
    } : {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '14px', color: '#FFFFFF',
      wordWrap: { width: 200 }
    };
    var tempTxt = self.add.text(0, 0, line, tempStyle);
    var tempBounds = tempTxt.getBounds();
    tempTxt.destroy();
    var bubbleW = Math.min(200, Math.max(80, tempBounds.width + 30));
    var bubbleH = Math.max(50, tempBounds.height + 24);
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

    // AI 名字 - 名字放在头像正下方，不再与气泡顶部对齐
    var nameTxt = self.add.text(avatarX, avatarY + 30, aiDisplayName, {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '11px', color: '#A5D6A7', fontStyle: 'bold'
    }).setOrigin(0.5, 0);
    self.playBubbleElements.push(nameTxt);

    // 气泡高度自适应: 先创建文字获取高度，再用高度绘制气泡
    var textStyle = isEmergency ? {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '16px', color: '#FFCDD2', fontStyle: 'bold',
      wordWrap: { width: bubbleW - 28 }
    } : {
      fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
      fontSize: '14px', color: '#FFFFFF',
      wordWrap: { width: bubbleW - 28 },
      lineSpacing: 4
    };
    var textX = isDuidui ? (bubbleX + 14) : (bubbleX + 10);
    var bubbleTxt = self.add.text(bubbleX + 14, 0, line, textStyle);
    var textBounds = bubbleTxt.getBounds();
    bubbleH = Math.max(bubbleH, textBounds.height + 20);
    bubbleTxt.setPosition(textX, bubbleY + bubbleH / 2).setOrigin(0, 0.5);

    // 台词气泡背景（填充+边框分开，炸弹时边框可独立闪烁）
    var bubbleBg = self.add.graphics();
    bubbleBg.fillStyle(0x000000, 0.8);
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
    arrow.fillStyle(0x000000, 0.8);
    if (isDuidui) {
      // 左侧箭头指向左边头像
      arrow.fillTriangle(
        bubbleX, bubbleY + bubbleH / 2,
        bubbleX - 10, bubbleY + bubbleH / 2 - 6,
        bubbleX - 10, bubbleY + bubbleH / 2 + 6
      ).setDepth(20);
    } else {
      // 右侧箭头指向右边头像
      arrow.fillTriangle(
        bubbleX + bubbleW, bubbleY + bubbleH / 2,
        bubbleX + bubbleW + 10, bubbleY + bubbleH / 2 - 6,
        bubbleX + bubbleW + 10, bubbleY + bubbleH / 2 + 6
      ).setDepth(20);
    }
    self.playBubbleElements.push(arrow);
    // 文字最后push到底部渲染在上层
    self.playBubbleElements.push(bubbleTxt);

    // 弹入动画: Container 包裹所有元素
    self.playBubbleContainer = self.add.container(0, 0, self.playBubbleElements).setDepth(500);
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

    // C2: 气泡自适应高度，防止长文字溢出
    var bubbleW = Math.min(540, 200 + line.length * 10);
    var bubbleH = Math.max(44, 36 + Math.ceil(line.length / 20) * 18);
    var bubbleX = 390;
    var bubbleY = y + 10;

    // AI \u5934\u50CF\u5706\u5708
    var avatar = self.add.graphics();
    avatar.fillStyle(aiId === 'duidui' ? 0x4FC3F7 : 0xFFB74D, 1);
  avatar.fillCircle(260, y + 16, 22).setDepth(500);
  avatar.lineStyle(2, 0xFFFFFF, 0.5);
  avatar.strokeCircle(260, y + 16, 22).setDepth(500);
  var avatarTxt = self.add.text(260, y + 16, aiId === 'duidui' ? '😎' : '😊', {
    fontFamily: 'sans-serif', fontSize: '18px'
  }).setOrigin(0.5).setDepth(501);
  self.chaosBubbleElements.push(avatar, avatarTxt);

  // AI \u540D\u5B57\uFF08\u52A0\u5927\uFF09
  var nameTxt = self.add.text(105, y - 4, aiDisplayName, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '12px', color: '#FFFFFF', fontStyle: 'bold'
  }).setDepth(500);
  self.chaosBubbleElements.push(nameTxt);

  // \u53F0\u8BCD\u6C14\u6CE1\uFF08\u5B9E\u5FC3\u7EFF\u8272\u6C14\u6CE1\u5E26\u8FB9\u6846\uFF09
  var bubble = self.add.graphics();
  bubble.fillStyle(0x1B5E20, 0.85);
  bubble.fillRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 12).setDepth(500);
  bubble.lineStyle(1.5, 0x66BB6A, 0.5);
  bubble.strokeRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 12).setDepth(500);
  self.chaosBubbleElements.push(bubble);

  // \u4E09\u89D2\u7BAD\u5934\u6307\u5411\u5DE6\u4FA7\u89D2\u8272
  var arrow = self.add.graphics();
  arrow.fillStyle(0x1B5E20, 0.85);
  arrow.fillTriangle(
    bubbleX, bubbleY + bubbleH / 2,
    bubbleX - 12, bubbleY + bubbleH / 2 - 6,
    bubbleX - 12, bubbleY + bubbleH / 2 + 6
  ).setDepth(500);
  self.chaosBubbleElements.push(arrow);

    // 台词文本
  var bubbleTxt = self.add.text(bubbleX + 14, bubbleY + bubbleH / 2, line, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '14px', color: '#FFFFFF',
    wordWrap: { width: bubbleW - 28 },
    lineSpacing: 2
  }).setOrigin(0, 0.5).setDepth(501);
  self.chaosBubbleElements.push(bubbleTxt);

  // 搞事情气泡显示3.5秒后自动销毁，解锁队列
  self.time.delayedCall(3500, function () {
    if (self.chaosBubbleElements) {
      for (var ti = 0; ti < self.chaosBubbleElements.length; ti++) {
        if (self.chaosBubbleElements[ti]) self.chaosBubbleElements[ti].destroy();
      }
      self.chaosBubbleElements = [];
    }
    self._processBubbleQueue();
  });
  };

  var queuedTask = function () {
    var line = pickAiLine(aiId, sceneKey);
    renderBubble(line);
  };

  self.chaosBubbleQueue.push({ render: queuedTask });
  if (self.chaosBubbleQueue.length > this.BUBBLE_QUEUE_MAX) self.chaosBubbleQueue.shift();
  if (!this.bubbleShowing) self._processBubbleQueue();
};
// ================================================================
// 搞事情 - 清除题目区域
// ================================================================
GameScene.prototype._clearQuestionArea = function () {
  var self = this;
  if (!self.chaosElements) return;
  // \u4FDD\u7559\u524D3\u4E2A\u5143\u7D20\uFF08\u906E\u7F69\u3001\u5361\u724C\u80CC\u666F\u3001\u6807\u9898\u3001\u5206\u6570\u3001\u5173\u6389\u6309\u94AE\uFF09
  var toKeep = self.chaosElements.slice(0, 8); // overlay, cardShadow, cardBg, title, scoreBg, scoreText, closeBtnBg, closeBtnText
  for (var di = 8; di < self.chaosElements.length; di++) {
    if (self.chaosElements[di]) self.chaosElements[di].destroy();
  }
  self.chaosElements = toKeep;
  // \u53D6\u6D88\u6C14\u6CE1\u5B9A\u65F6\u5668
  if (self.chaosBubbleTimer) {
    self.chaosBubbleTimer.remove();
    self.chaosBubbleTimer = null;
  }
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
  console.log('_destroyChaos called, state=', this.gameState);
  if (this.chaosElements) {
    for (var i = 0; i < this.chaosElements.length; i++) {
      if (this.chaosElements[i]) {
        this.tweens.killTweensOf(this.chaosElements[i]);
        this.chaosElements[i].destroy();
      }
    }
  }
  if (this.chaosBubbleElements) {
    for (var j = 0; j < this.chaosBubbleElements.length; j++) {
      if (this.chaosBubbleElements[j]) {
        this.tweens.killTweensOf(this.chaosBubbleElements[j]);
        this.chaosBubbleElements[j].destroy();
      }
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

  // \u53d6\u6d88\u6c14\u6ce1\u5b9a\u65f6\u5668
  if (this.chaosBubbleTimer) {
    this.chaosBubbleTimer.remove();
    this.chaosBubbleTimer = null;
  }
  // Q2: 346270205347251272346260224346263241351230237345210227
  this.chaosBubbleQueue = [];

  // \u6062\u590D\u51FA\u724C\u97F3\u6548
  SoundManager.resumeAll();
  this.gameState = GAME_STATE.PLAYER_TURN;
  this.hasDoneChaosThisTurn = false;
  if (this.startTurnTimer) this.startTurnTimer();

  // \u6062\u590D\u6E38\u620F\u72B6\u6001
  this._showAiBubble(this._chaosAiId || "duidui", "close", 180);
  this.setStatusText('搞事情结束，继续出牌');
};

// ================================================================
// 题目预取
// ================================================================
GameScene.prototype.prefetchChaosQuestions = function () {
  var self = this;
  if (typeof ApiClient === 'undefined' || !this.isAPIMode) return;
  var types = ['vocabulary','expression','trivia','life_hack'];
  types.forEach(function(type) {
    if (self.chaosPrefetchCache[type] && self.chaosPrefetchCache[type].length > 0) return;
    ApiClient.generateChaosQuestion(type, 'normal', 2)
      .then(function(res) {
        if (res.success && res.questions && res.questions.length > 0) {
          self.chaosPrefetchCache[type] = res.questions;
        }
      })
      .catch(function() {});
  });
};

// ================================================================
// 回合倒计时
// ================================================================
GameScene.prototype.startTurnTimer = function () {
  this.clearTurnTimer();
  var self = this;
  var duration = 30000;
  var startTime = Date.now();
  var barBg = self.add.graphics();
  barBg.fillStyle(0x000000, 0.3);
  barBg.fillRoundedRect(360, 465, 600, 8, 4).setDepth(150);
  self._turnTimerBarBg = barBg;
  var bar = self.add.graphics().setDepth(151);
  self._turnTimerBar = bar;
  self._turnTimer = self.time.addEvent({
    delay: 100, loop: true,
    callback: function() {
      var elapsed = Date.now() - startTime;
      var remaining = 1 - Math.min(elapsed / duration, 1);
      var color = remaining > 0.33 ? 0x4ECDC4 : (remaining > 0.1 ? 0xFFC107 : 0xFF5252);
      bar.clear().fillStyle(color, 1).fillRoundedRect(362, 467, 596 * remaining, 4, 2);
      if (remaining < 0.17 && Math.floor(elapsed / 500) % 2 === 0) {
        bar.clear().fillStyle(0xFF1744, 1).fillRoundedRect(362, 467, 596 * remaining, 4, 2);
      }
      if (elapsed >= duration) {
        self.clearTurnTimer();
        self.autoPlayOnTimeout();
      }
    }
  });
};

GameScene.prototype.clearTurnTimer = function () {
  if (this._turnTimer) { this._turnTimer.remove(); this._turnTimer = null; }
  if (this._turnTimerBar) { this._turnTimerBar.destroy(); this._turnTimerBar = null; }
  if (this._turnTimerBarBg) { this._turnTimerBarBg.destroy(); this._turnTimerBarBg = null; }
};

GameScene.prototype.autoPlayOnTimeout = function () {
  if (this.gameState !== GAME_STATE.PLAYER_TURN) return;
  if (this.selectedCards.length > 0) {
    this.doPlayerPlay();
    return;
  }
  if (this.lastPlay && this.lastPlay.length > 0) {
    this.doPlayerPass();
    return;
  }
  if (this.playerHand && this.playerHand.length > 0) {
    this.selectedCards = [0];
    this.doPlayerPlay();
    this.selectedCards = [];
  }
};

// ================================================================
// 错题本UI
// ================================================================
GameScene.prototype.closeWrongBook = function () {
  // 恢复倒计时
  if (this._turnTimer) this._turnTimer.paused = false;
  if (this.chaosTimeoutTimer) this.chaosTimeoutTimer.paused = false;

  if (this.wrongBookOverlay) this.wrongBookOverlay.destroy();
  if (this.wbFixedElements) this.wbFixedElements.forEach(function(e){e.destroy();});
  if (this.wrongBookContent) { this.wrongBookContent.destroy(); this.wrongBookContent = null; }
  if (this.wrongBookTabs) { this.wrongBookTabs.forEach(function(e){e.destroy();}); this.wrongBookTabs = null; }
  this.wbFixedElements = null;
  this.wrongBookOverlay = null;
};

GameScene.prototype.showWrongBookUI = function () {
  var self = this;
  self.closeWrongBook();
  self._wrongBookDismissed = false;
  // 重置分页状态
  self.wbRecords = [];
  self.wbCurrentOffset = 0;
  self.wbPageSize = 10;
  self.wbHasMore = false;
  self.wbActiveTab = null;
  // 先渲染空框架
  self.renderWrongBookDOM([]);
  // 冻结时钟和动画
  self.time.paused = true;
  self.tweens.pauseAll();
  // 加载第一页
  self.loadWrongBookData();
};

GameScene.prototype.loadWrongBookData = function () {
  var self = this;
  var playerId = localStorage.getItem('doudizhu_playerId');
  var params = {
    playerId: playerId,
    offset: self.wbCurrentOffset,
    limit: self.wbPageSize
  };
  if (self.wbActiveTab) params.type = self.wbActiveTab;
  // 尝试从API加载
  if (typeof ApiClient !== 'undefined' && self.isAPIMode) {
    ApiClient.getWrongBook(params)
      .then(function (data) {
        if (data.records && data.total > 0) {
          self.wbRecords = self.wbRecords.concat(data.records);
          self.wbHasMore = (self.wbCurrentOffset + self.wbPageSize) < data.total;
          self.wbCurrentOffset += self.wbPageSize;
          self.renderWrongBookDOM(self.wbRecords);
        } else if (data.total === 0) {
          // API无数据，尝试本地
          self._loadLocalWrongBook();
        } else {
          self.renderWrongBookDOM(self.wbRecords);
        }
      })
      .catch(function () {
        // API失败，降级本地
        self._loadLocalWrongBook();
      });
  } else {
    // 纯前端模式，直接从本地加载
    self._loadLocalWrongBook();
  }
};

GameScene.prototype._loadLocalWrongBook = function () {
  var self = this;
  try {
    var allRecords = JSON.parse(localStorage.getItem('doudizhu_wrongbook') || '[]');
    var filtered = self.wbActiveTab ? allRecords.filter(function(r) { return r.questionType === self.wbActiveTab; }) : allRecords;
    var page = filtered.slice(self.wbCurrentOffset, self.wbCurrentOffset + self.wbPageSize);
    if (page.length > 0) {
      self.wbRecords = self.wbRecords.concat(page);
      self.wbCurrentOffset += self.wbPageSize;
      self.wbHasMore = self.wbCurrentOffset < filtered.length;
    }
    self.renderWrongBookDOM(self.wbRecords);
  } catch (e) {
    console.warn('本地错题加载失败:', e);
    self.renderWrongBookDOM([]);
  }
};

GameScene.prototype.renderWrongBookDOM = function (records) {
  var self = this;
  if (self._wrongBookDismissed) return;
  self.closeWrongBook();

  // 遮罩
  var overlay = self.add.graphics();
  overlay.fillStyle(0x000000, 0.8);
  overlay.fillRect(0, 0, 1320, 600).setDepth(400);
  overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, 1320, 600), Phaser.Geom.Rectangle.Contains);
  self.wrongBookOverlay = overlay;

  // 面板背景
  var panelBg = self.add.graphics();
  panelBg.fillStyle(0x1A1A2E, 0.95);
  panelBg.fillRoundedRect(180, 30, 960, 540, 12).setDepth(401);
  panelBg.lineStyle(2, 0x7C4DFF, 0.8);
  panelBg.strokeRoundedRect(180, 30, 960, 540, 12).setDepth(401);

  // 标题
  var titleTxt = self.add.text(660, 52, '📖 错题本', {
    fontSize: '24px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(402);

  // 关闭按钮
  var closeBg = self.add.graphics();
  closeBg.fillStyle(0xFF4757, 1);
  closeBg.fillCircle(1120, 50, 20).setDepth(405);
  closeBg.lineStyle(2, 0xFFFFFF, 0.8);
  closeBg.strokeCircle(1120, 50, 20).setDepth(405);
  closeBg.setInteractive(new Phaser.Geom.Circle(1120, 50, 20), Phaser.Geom.Circle.Contains);
  var closeTxt = self.add.text(1120, 50, '✖', {
    fontSize: '20px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(406);
  closeBg.on('pointerup', function() {
    self._wrongBookDismissed = true;
    self.time.paused = false;
    self.tweens.resumeAll();
    self.closeWrongBook();
  });

  // 固定UI存到this上，方便closeWrongBook统一销毁
  self.wbFixedElements = [panelBg, titleTxt, closeBg, closeTxt];

  // 分类tab（独立，不会被销毁）
  var tabs = ['全部','单词','口语','冷知识','生活'];
  var tabTypes = [null,'vocabulary','expression','trivia','life_hack'];
  var tabElements = [];
  var activeTabType = null;

  function renderTabButtons() {
    tabElements.forEach(function(e) { e.destroy(); });
    tabElements = [];
    for (var ti = 0; ti < tabs.length; ti++) {
      (function(tabType, tabLabel, idx) {
        var isActive = (tabType === activeTabType);
        var tBg = self.add.graphics();
        tBg.fillStyle(isActive ? 0x7C4DFF : 0x444444, 1);
        tBg.fillRoundedRect(240 + idx * 140, 80, 130, 30, 6).setDepth(403);
        tBg.setInteractive(new Phaser.Geom.Rectangle(240 + idx * 140, 80, 130, 30), Phaser.Geom.Rectangle.Contains);
        tabElements.push(tBg);
        var tTxt = self.add.text(240 + idx * 140 + 65, 95, tabLabel, {
          fontSize: '15px', color: '#FFFFFF', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(404);
        tabElements.push(tTxt);
        tBg.on('pointerup', function() {
          activeTabType = tabType;
          self.wbActiveTab = tabType;
          self.wbRecords = [];
          self.wbCurrentOffset = 0;
          self.wbHasMore = false;
          renderTabButtons();
          renderRecords(null);
          self.loadWrongBookData();
        });
      })(tabTypes[ti], tabs[ti], ti);
    }
    self.wrongBookTabs = tabElements;
  }

  // 渲染记录列表
  var contentGroup = null;
  function renderRecords(filterType) {
    if (contentGroup) { contentGroup.destroy(); contentGroup = null; }
    var container = self.add.container(0, 0).setDepth(403);
    contentGroup = container;
    var filtered = filterType ? records.filter(function(r) { return r.questionType === filterType; }) : records;

    if (filtered.length === 0) {
      var empty = self.add.text(660, 300, '暂无错题记录 📝', {
        fontSize: '20px', color: '#888888'
      }).setOrigin(0.5).setDepth(403);
      container.add(empty);
      self.wrongBookContent = container;
      return;
    }

    var yPos = 120;
    var maxShow = filtered.length;

    // 遮罩
    var maskShape = self.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(180, 110, 960, 450);
    var mask = maskShape.createGeometryMask();
    container.setMask(mask);
    self.wbFixedElements.push(maskShape);
    for (var ri = 0; ri < maxShow; ri++) {
      var r = filtered[ri];

      // 卡片背景（高度加大到110）
      var cardBg = self.add.graphics();
      cardBg.fillStyle(0x252540, 1);
      cardBg.fillRoundedRect(210, yPos, 900, 110, 8).setDepth(403);
      container.add(cardBg);

      // 编号
      var numTxt = self.add.text(225, yPos + 6, (ri+1) + '.', {
        fontSize: '14px', color: '#F48FB1', fontStyle: 'bold'
      }).setDepth(404);
      container.add(numTxt);

      // 题型标签
      var typeNames = { 'vocabulary':'📚单词','expression':'💬口语','trivia':'🧠冷知识','life_hack':'🏠生活','bomb_mixed':'💣混合' };
      var typeTag = self.add.text(255, yPos + 6, typeNames[r.questionType] || r.questionType, {
        fontSize: '12px', color: '#7C4DFF', fontStyle: 'bold',
        backgroundColor: '#2A1A4E', padding: {x:4, y:2}
      }).setDepth(404);
      container.add(typeTag);

      // 题目（完整显示，自动换行）
      var qTxt = self.add.text(255, yPos + 26, r.question || '', {
        fontSize: '14px', color: '#E0E0E0', wordWrap: { width: 600 }
      }).setDepth(404);
      container.add(qTxt);

      // 选项（从yPos+62移到yPos+48，wordWrap 800）
      var optStr = '';
      if (r.options) {
        var ks = ['A','B','C','D'];
        for (var oi = 0; oi < ks.length; oi++) {
          if (r.options[ks[oi]]) optStr += ks[oi] + '.' + r.options[ks[oi]] + '  ';
        }
      }
      var optTxt = self.add.text(255, yPos + 58, optStr, {
        fontSize: '12px', color: '#AAAAAA', wordWrap: { width: 800 }
      }).setDepth(404);
      container.add(optTxt);

      // 答案（yPos+90）
      var ansTxt = self.add.text(255, yPos + 90, '❌ 你选: ' + (r.userAnswer || '?') + '  ✅ 正确: ' + (r.correctAnswer || '?'), {
        fontSize: '13px', color: (r.isCorrect ? '#4ECDC4' : '#FF6B6B'), fontStyle: 'bold'
      }).setDepth(404);
      container.add(ansTxt);

      // 时间（右下角右对齐yPos+90）
      var timeStr = r.timestamp ? r.timestamp.substring(0, 10) + ' ' + r.timestamp.substring(11, 16) : '';
      var timeTxt = self.add.text(1080, yPos + 90, timeStr, {
        fontSize: '11px', color: '#666666'
      }).setOrigin(1, 0).setDepth(404);
      container.add(timeTxt);

      yPos += 120;
    }

    if (self.wbHasMore) {
      var loadBg = self.add.graphics();
      loadBg.fillStyle(0x7C4DFF, 1);
      loadBg.fillRoundedRect(560, yPos + 10, 200, 36, 8).setDepth(404);
      loadBg.setInteractive(new Phaser.Geom.Rectangle(560, yPos + 10, 200, 36), Phaser.Geom.Rectangle.Contains);
      container.add(loadBg);
      var loadTxt = self.add.text(660, yPos + 28, '加载更多...', {
        fontSize: '15px', color: '#FFFFFF', fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(405);
      container.add(loadTxt);
      loadBg.on('pointerup', function() {
        self.loadWrongBookData();
      });
    }

    // 可滚动交互
    var hitZone = self.add.zone(660, 335, 960, 450).setInteractive();
    container.add(hitZone);
    self.input.setDraggable(hitZone);
    var contentHeight = yPos - 120 + 80;
    var minY = Math.min(0, 450 - contentHeight);
    hitZone.on('drag', function(pointer) {
      container.y += (pointer.y - pointer.prevPosition.y);
      container.y = Math.round(container.y);
      checkScroll();
    });
    hitZone.on('wheel', function(pointer, deltaX, deltaY, deltaZ) {
      container.y -= Math.round(deltaY * 0.5);
      container.y = Math.round(container.y);
      checkScroll();
    });

    function checkScroll() {
      if (container.y > 0) container.y = 0;
      if (container.y < minY) container.y = minY;
    }
    checkScroll();
    self.wrongBookContent = container;
  }

  renderTabButtons();
  renderRecords(null);
};

// ================================================================
// 功能按钮
// ================================================================
function createActionButtons(scene) {
  var bw = 100, bh = 60, gap = 20;
  var totalW = bw * 5 + gap * 4;
  var startX = 660 - totalW / 2;
  var btnY = 480;

  var buttons = [
    { label: '出牌', color: 0x4ECDC4, key: 'play' },
    { label: '提示', color: 0xFFD93D, key: 'hint' },
    { label: '不出', color: 0xFF6B6B, key: 'pass' },
    { label: '搞事情', color: 0x7C4DFF, key: 'action' },
    { label: '底牌查看', color: 0x29B6F6, key: 'bottom' }
  ];

  var bottomBtnW = 200, bottomBtnH = 50;

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
      fontSize: '20px', color: '#FFFFFF', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(101);
    scene.actionButtons.push(txt);

    (function (key) {
      bg.on('pointerup', function () {
        switch (key) {
          case 'play': scene.doPlayerPlay(); break;
          case 'hint': scene.doHint(); break;
          case 'pass': scene.doPlayerPass(); break;
          case 'action': scene.doAction(); break;
          case 'bottom':
            if (scene.gameState === GAME_STATE.BIDDING || scene.gameState === GAME_STATE.INIT) {
              showToast(scene, '叫分阶段尚未结束，不能查看底牌！');
            } else {
              scene.showBottomCards(scene.remainingCards);
              showToast(scene, '已在顶部中心展示底牌');
            }
            break;
        }
      });
    })(b.key);
  }

  // 第二行：错题本按钮
  var wbBg = scene.add.graphics();
  wbBg.fillStyle(0x8D6E63, 1);
  wbBg.fillRoundedRect(560, btnY + 70, bottomBtnW, bottomBtnH, 8).setDepth(100);
  wbBg.setInteractive(new Phaser.Geom.Rectangle(560, btnY + 70, bottomBtnW, bottomBtnH), Phaser.Geom.Rectangle.Contains);
  scene.actionButtons.push(wbBg);
  var wbTxt = scene.add.text(660, btnY + 95, '📖 错题本', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '20px', color: '#FFFFFF', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(101);
  scene.actionButtons.push(wbTxt);
  wbBg.on('pointerup', function() {
    scene.showWrongBookUI();
  });
}

// ================================================================
// Toast
// ================================================================
function showToast(scene, message) {
  var cx = 660;
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
  overlay.fillRect(0, 0, 1320, 600).setDepth(400);
  self.tweens.add({ targets: overlay, alpha: 0.65, duration: 300, ease: 'Linear' });

  var panelElements = [overlay];

  // --- 2. 结算卡片 ---
  var cardBg = self.add.graphics();
  cardBg.fillStyle(0x1A1A2E, 0.92);
  cardBg.fillRoundedRect(380, 60, 560, 480, 12).setDepth(401);
  var glowColor = isPlayerWin ? 0xFFD700 : 0xFF5252;
  cardBg.lineStyle(2, glowColor, 0.8);
  cardBg.strokeRoundedRect(380, 60, 560, 480, 12).setDepth(401);
  panelElements.push(cardBg);
  cardBg.setAlpha(0);

  // --- 3. 标题文字（弹入动画）---
  var titleEmoji = isPlayerWin ? '🎉' : (isAI1Win || winner === 'ai2') ? '😅' : '😅';
  var titleText = isPlayerWin ? '你赢了！' : '你输了';
  var titleColor = isPlayerWin ? '#FFD700' : '#FF5252';
  var title = self.add.text(660, 90, titleEmoji + ' ' + titleText, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '28px', fontStyle: 'bold', color: titleColor,
    shadow: { blur: 20, color: titleColor, fill: true }
  }).setOrigin(0.5).setDepth(402).setScale(0.3).setAlpha(0);
  panelElements.push(title);

  // AI获胜副标题
  var aiWinSub = null;
  if (!isPlayerWin && winName) {
    aiWinSub = self.add.text(660, 120, winName + '获胜！', {
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
  scorePanel.fillRoundedRect(420, 142, 480, 260, 8).setDepth(402);
  panelElements.push(scorePanel);
  scorePanel.setAlpha(0);

  // 总得分标题
  var totalLabel = self.add.text(660, 155, '💰 总得分', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '14px', color: '#A5D6A7'
  }).setOrigin(0.5).setDepth(403).setAlpha(0);
  panelElements.push(totalLabel);

  // 总得分数字（跳动动画）
  var totalNum = self.add.text(660, 190, '+' + totalScore, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '36px', fontStyle: 'bold', color: '#FFD700',
    shadow: { blur: 15, color: '#FFD700', fill: true }
  }).setOrigin(0.5).setDepth(403).setAlpha(0);
  panelElements.push(totalNum);

  // 分隔线1
  var div1 = self.add.graphics();
  div1.lineStyle(1, 0xFFFFFF, 0.1);
  div1.lineBetween(440, 215, 880, 215).setDepth(403);
  panelElements.push(div1);
  div1.setAlpha(0);

  // 得分细项文本对象数组
  var rowTexts = [];
  var rowY = 235;
  for (var ri = 0; ri < detailRows.length; ri++) {
    var dr = detailRows[ri];
    var rowStr = dr.label + ' ' + dr.value + '  ' + dr.icon;
    var rowTxt = self.add.text(450, rowY, rowStr, {
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
  div2.lineBetween(440, 335, 880, 335).setDepth(403);
  panelElements.push(div2);
  div2.setAlpha(0);

  // 底部小字：本局用时
  var elapsed = Math.floor((Date.now() - (self.gameStartTime || Date.now())) / 1000);
  var min = Math.floor(elapsed / 60);
  var sec = elapsed % 60;
  var timeStr = '本局用时: ' + min + '分' + sec + '秒';
  var timeTxt = self.add.text(900, 510, timeStr, {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '10px', color: '#888888'
  }).setDepth(403).setAlpha(0);
  panelElements.push(timeTxt);

  // --- 6. 按钮 ---

  // 再来一局
  var btn1Bg = self.add.graphics();
  btn1Bg.fillStyle(0x4ECDC4, 1);
  btn1Bg.fillRoundedRect(470, 370, 170, 44, 8).setDepth(403);
  btn1Bg.setInteractive(new Phaser.Geom.Rectangle(470, 370, 170, 44), Phaser.Geom.Rectangle.Contains);
  var btn1Txt = self.add.text(555, 392, '🔄 再来一局', {
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
  btn2Bg.fillRoundedRect(680, 370, 170, 44, 8).setDepth(403);
  btn2Bg.setInteractive(new Phaser.Geom.Rectangle(680, 370, 170, 44), Phaser.Geom.Rectangle.Contains);
  var btn2Txt = self.add.text(765, 392, '🏠 返回首页', {
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
  var areaWidth = 192;
  var targetX = 1320 - areaWidth - 12;
  var bg = scene.add.graphics();
  // 颜色加深，增加边框质感
  bg.fillStyle(0x000000, 0.45);
  bg.fillRoundedRect(targetX, 58, areaWidth, 350, 8).setDepth(200);
  bg.lineStyle(1.5, 0x4CAF50, 0.5);
  bg.strokeRoundedRect(targetX, 58, areaWidth, 350, 8).setDepth(200);

  scene.add.text(targetX + areaWidth / 2, 68, '📜 出牌记录', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '16px', color: '#A5D6A7', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(201);

  scene.playHistoryText = scene.add.text(targetX + 6, 85, '', {
    fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif',
    fontSize: '15px', color: '#FFFFFF',
    lineSpacing: 8,
    wordWrap: { width: areaWidth - 17 }
  }).setDepth(201);
}

// ================================================================
// 新增：清理桌面上一轮打出的废牌
// ================================================================
GameScene.prototype.clearTablePlays = function() {
  var self = this;
  ['myPlayCardsGfx', 'ai1PlayCardsGfx', 'ai2PlayCardsGfx'].forEach(function(key) {
    if (self[key]) {
      self[key].forEach(function(img) { img.destroy(); });
      self[key] = [];
    }
  });
};

GameScene.prototype.addPlayHistory = function (player, cardsOrPass) {
  var labels = { player: '你', ai1: '怼怼', ai2: '甜甜' };
  var label = labels[player] || player;
  var entry;
  if (cardsOrPass === true) {
    entry = { text: label + ': 不出', pass: true };
  } else if (cardsOrPass && cardsOrPass.length > 0) {
    // 增加扑克牌花色符号显示
    var suitSymbol = { spade:'♠', heart:'♥', club:'♣', diamond:'♦', joker:'🃏' };
    var display = cardsOrPass.map(function (c) {
      return (suitSymbol[c.suit] || '') + (Doudizhu.RANK_NAME_MAP[c.rank] || '?');
    }).join(' ');
    entry = { text: label + ': ' + display, cards: cardsOrPass };
  } else {
    return;
  }
  this.playHistory.push(entry);
  // 保留最近 9 条记录，避免撑爆面板
  if (this.playHistory.length > 12) {
    this.playHistory.shift();
  }
  this.renderPlayHistory();
};

GameScene.prototype.renderPlayHistory = function () {
  if (!this.playHistoryText) return;
  var lines = [];
  for (var i = 0; i < this.playHistory.length; i++) {
    lines.push(this.playHistory[i].text);
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

var lastUsedLines = {};

function pickAiLine(aiId, sceneKey) {
  var ai = AI_LINES[aiId];
  if (!ai) return '...';
  var pool = ai[sceneKey];
  if (!pool || pool.length === 0) return '...';
  // 过滤掉上一次刚刚说过的台词
  var historyKey = aiId + '_' + sceneKey;
  var available = pool.filter(function(line) { return line !== lastUsedLines[historyKey]; });
  // 如果词库太少导致全被过滤，就重置
  if (available.length === 0) available = pool;
  var picked = available[Math.floor(Math.random() * available.length)];
  lastUsedLines[historyKey] = picked;
  return picked;
}

