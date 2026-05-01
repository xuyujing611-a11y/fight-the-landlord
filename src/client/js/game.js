/**
 * game.js - 斗地主 Phaser 3 主游戏
 * 375x812 手机竖屏布局
 * 依赖: Phaser 3 CDN + CardEngine.js
 */

// ================================================================
// Phaser 配置
// ================================================================
var GameConfig = {
  type: Phaser.AUTO,
  width: 375,
  height: 812,
  parent: 'game-container',
  backgroundColor: '#1B5E20',
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [GameScene]
};

// 启动游戏
var game = new Phaser.Game(GameConfig);

// ================================================================
// 工具函数
// ================================================================

// 适配坐标（从PRD设计尺寸映射到实际画布）
function px(x, y) {
  return { x: x, y: y };
}

// 生成圆形纹理（用于头像、按钮等）
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

// 生成圆角矩形纹理
function createRoundedRectTexture(scene, key, w, h, color, radius) {
  radius = radius || 8;
  var g = scene.make.graphics({ add: false });
  g.fillStyle(color, 1);
  g.fillRoundedRect(0, 0, w, h, radius);
  g.generateTexture(key, w, h);
  g.destroy();
}

// ================================================================
// GameScene — 主游戏场景
// ================================================================

function GameScene() {
  Phaser.Scene.call(this, { key: 'GameScene' });
  this.selectedCards = [];
  this.handCards = [];
  this.playerHand = [];
  this.cardDomElements = [];
  this.domContainer = null;
}

GameScene.prototype = Object.create(Phaser.Scene.prototype);
GameScene.prototype.constructor = GameScene;

// ---- 初始化 ----
GameScene.prototype.init = function () {
  // 创建一副牌并模拟发牌
  var deck = new Doudizhu.Deck();
  deck.shuffle();
  var dealResult = deck.deal(3, 17);
  this.playerHand = Doudizhu.sortCards(dealResult.hands[0]);
  this.ai1Hand = dealResult.hands[1];
  this.ai2Hand = dealResult.hands[2];
  this.remainingCards = dealResult.remaining;
  this.selectedCards = [];
  this.round = 1;
  this.maxRounds = 10;
  this.currentTurn = 'player'; // 'player', 'ai1', 'ai2'
};

// ---- Preload ----
GameScene.prototype.preload = function () {
  // 没有外部资源需要加载
};

// ---- Create ----
GameScene.prototype.create = function () {
  var self = this;

  // 1. 绘制绿色牌桌背景
  drawTableBackground(this);

  // 2. 顶部状态栏
  createTopBar(this);

  // 3. AI 区域
  createAIArea(this);

  // 4. 中央出牌区
  createPlayArea(this);

  // 5. 底部手牌区 + 功能按钮
  createHandArea(this);
  createActionButtons(this);

  // 6. 创建 DOM 容器放置卡牌（确保在 canvas 上面）
  this.domContainer = this.add.dom(0, 0).setOrigin(0, 0);
  this.domContainer.setDepth(100);

  // 7. 渲染手牌
  this.renderPlayerHand();

  // 8. 模拟 AI 出牌（测试用）
  this.time.delayedCall(800, function () {
    self.renderAIPlay(0); // AI 1 出牌
  });
  this.time.delayedCall(1600, function () {
    self.renderAIPlay(1); // AI 2 出牌
  });
};

// ---- Update ----
GameScene.prototype.update = function () {
  // 后续加入动画逻辑
};

// ================================================================
// 1. 牌桌背景
// ================================================================

function drawTableBackground(scene) {
  var W = 375, H = 812;

  // 绿色渐变背景
  var bg = scene.add.graphics();
  bg.fillGradientStyle(0x1B5E20, 0x1B5E20, 0x0D3B0F, 0x0D3B0F, 1);
  bg.fillRect(0, 0, W, H);

  // 桌面纹理：径向渐变椭圆（模拟灯光效果）
  var tableGlow = scene.add.graphics();
  tableGlow.fillStyle(0x2E7D32, 0.15);
  tableGlow.fillEllipse(W / 2, H / 2 - 40, 320, 480);
  tableGlow.fillStyle(0x388E3C, 0.1);
  tableGlow.fillEllipse(W / 2, H / 2 - 40, 240, 360);

  // 桌面边框装饰线
  var border = scene.add.graphics();
  border.lineStyle(2, 0x4CAF50, 0.3);
  border.strokeRoundedRect(8, 60, W - 16, H - 110, 12);

  // 中间装饰菱形
  var diamond = scene.add.graphics();
  diamond.lineStyle(1, 0x66BB6A, 0.15);
  var cx = W / 2, cy = H / 2 - 40;
  diamond.strokeRect(cx - 50, cy - 70, 100, 140);
  diamond.strokeRect(cx - 30, cy - 50, 60, 100);
}

// ================================================================
// 2. 顶部状态栏
// ================================================================

function createTopBar(scene) {
  // 回合数
  scene.roundText = scene.add.text(16, 12, '第 1/10 回合', {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '14px',
    color: '#E8F5E9',
    fontStyle: 'bold'
  }).setDepth(10);

  // 退出按钮
  var quitBtn = scene.add.graphics();
  quitBtn.fillStyle(0xFF5252, 1);
  quitBtn.fillRoundedRect(335, 8, 28, 28, 6);
  quitBtn.setInteractive(new Phaser.Geom.Rectangle(335, 8, 28, 28), Phaser.Geom.Rectangle.Contains);
  quitBtn.setDepth(10);

  var quitX = scene.add.text(340, 12, '\u2716', {
    fontFamily: 'Arial',
    fontSize: '16px',
    color: '#FFFFFF'
  }).setDepth(11);

  quitBtn.on('pointerdown', function () {
    if (confirm('确认退出当前游戏？')) {
      // 回到首页
    }
  });

  // 中间分界线
  var line = scene.add.graphics();
  line.lineStyle(1, 0x66BB6A, 0.2);
  line.lineBetween(0, 44, 375, 44);
  line.setDepth(10);

  // 计时条（占位）
  var timerBarBg = scene.add.graphics();
  timerBarBg.fillStyle(0x1B5E20, 0.8);
  timerBarBg.fillRoundedRect(140, 12, 120, 6, 3);
  timerBarBg.setDepth(10);
  var timerBar = scene.add.graphics();
  timerBar.fillStyle(0x4ECDC4, 1);
  timerBar.fillRoundedRect(140, 12, 80, 6, 3);
  timerBar.setDepth(11);
}

// ================================================================
// 3. AI 区域
// ================================================================

function createAIArea(scene) {
  var W = 375;

  // ---- AI 1 (左上) ----
  // 头像
  createCircleTexture(scene, 'ai1_avatar', 24, 0xFF6B35, 0xFFFFFF, 2);

  // 头像阴影
  var ai1Shadow = scene.add.graphics();
  ai1Shadow.fillStyle(0x000000, 0.2);
  ai1Shadow.fillCircle(50, 77, 26);
  ai1Shadow.setDepth(10);

  var ai1Avatar = scene.add.image(48, 74, 'ai1_avatar');
  ai1Avatar.setDepth(11);

  // 名字标签
  scene.add.text(78, 62, '王怼怼', {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '13px',
    color: '#FFFFFF',
    fontStyle: 'bold'
  }).setDepth(11);

  // 剩余牌数
  scene.add.text(78, 80, '\u5269\u4F59 17 \u5F20', {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '11px',
    color: '#A5D6A7'
  }).setDepth(11);

  // AI 1 座位装饰（淡色圆环）
  var ai1Ring = scene.add.graphics();
  ai1Ring.lineStyle(1, 0x66BB6A, 0.15);
  ai1Ring.strokeCircle(48, 74, 30);
  ai1Ring.setDepth(9);

  // ---- AI 2 (右上) ----
  createCircleTexture(scene, 'ai2_avatar', 24, 0x7C4DFF, 0xFFFFFF, 2);

  var ai2Shadow = scene.add.graphics();
  ai2Shadow.fillStyle(0x000000, 0.2);
  ai2Shadow.fillCircle(327, 77, 26);
  ai2Shadow.setDepth(10);

  var ai2Avatar = scene.add.image(325, 74, 'ai2_avatar');
  ai2Avatar.setDepth(11);

  // 名字标签（右对齐）
  scene.add.text(248, 62, '\u82CF\u751C\u751C', {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '13px',
    color: '#FFFFFF',
    fontStyle: 'bold'
  }).setOrigin(1, 0).setDepth(11);

  scene.add.text(248, 80, '\u5269\u4F59 17 \u5F20', {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '11px',
    color: '#A5D6A7'
  }).setOrigin(1, 0).setDepth(11);

  var ai2Ring = scene.add.graphics();
  ai2Ring.lineStyle(1, 0x66BB6A, 0.15);
  ai2Ring.strokeCircle(325, 74, 30);
  ai2Ring.setDepth(9);

  // 中间"VS"标签
  scene.add.text(W / 2, 72, 'VS', {
    fontFamily: '"Arial", sans-serif',
    fontSize: '11px',
    color: '#66BB6A',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(11);

  // 分隔线
  var divider = scene.add.graphics();
  divider.lineStyle(1, 0x66BB6A, 0.1);
  divider.lineBetween(0, 110, 375, 110);
  divider.setDepth(10);
}

// ================================================================
// 4. 中央出牌区
// ================================================================

function createPlayArea(scene) {
  var W = 375;
  var cx = W / 2;

  // 出牌区背景（半透明圆角矩形）
  var playBg = scene.add.graphics();
  playBg.fillStyle(0x000000, 0.1);
  playBg.fillRoundedRect(20, 120, W - 40, 260, 12);
  playBg.setDepth(10);

  // "出牌区" 占位文字（后续替换为实际牌面）
  scene.playAreaText = scene.add.text(cx, 250, '\u51FA\u724C\u533A', {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '12px',
    color: '#66BB6A',
    alpha: 0.5
  }).setOrigin(0.5).setDepth(11);

  // AI 1 出牌显示位置
  scene.ai1PlayLabel = scene.add.text(50, 130, 'AI1:', {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '10px',
    color: '#A5D6A7'
  }).setDepth(11);
  scene.ai1PlayCards = scene.add.dom(50, 150).setOrigin(0, 0).setDepth(11);

  // AI 2 出牌显示位置
  scene.ai2PlayLabel = scene.add.text(280, 130, 'AI2:', {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '10px',
    color: '#A5D6A7'
  }).setDepth(11);
  scene.ai2PlayCards = scene.add.dom(280, 150).setOrigin(0, 0).setDepth(11);

  // 玩家出牌显示位置
  scene.myPlayLabel = scene.add.text(cx, 310, '\u4F60\u7684\u51FA\u724C', {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '10px',
    color: '#A5D6A7'
  }).setOrigin(0.5).setDepth(11);
  scene.myPlayCards = scene.add.dom(cx, 335).setOrigin(0.5, 0).setDepth(11);

  // 底牌显示
  scene.add.text(10, 355, '\u5E95\u724C: ? ? ?', {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '9px',
    color: '#66BB6A',
    alpha: 0.4
  }).setDepth(11);
}

// ================================================================
// 5. 手牌区（弧形排列）
// ================================================================

function createHandArea(scene) {
  var W = 375;
  var H = 812;

  // 手牌区背景高亮
  var handBg = scene.add.graphics();
  handBg.fillStyle(0x000000, 0.15);
  handBg.fillRoundedRect(4, 510, W - 8, 160, 12);
  handBg.setDepth(10);

  // "你的手牌" 标签
  scene.add.text(16, 514, '\u4F60\u7684\u624B\u724C', {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '11px',
    color: '#A5D6A7'
  }).setDepth(11);
}

// ---- 渲染玩家手牌 ----
GameScene.prototype.renderPlayerHand = function () {
  var self = this;
  var hand = this.playerHand;
  if (!hand || hand.length === 0) return;

  // 清空已有的卡牌 DOM 元素
  for (var i = 0; i < this.cardDomElements.length; i++) {
    if (this.cardDomElements[i]) {
      this.cardDomElements[i].destroy();
    }
  }
  this.cardDomElements = [];
  this.handCards = [];

  var W = 375;
  var n = hand.length;
  var cardWidth = 44;
  var cardHeight = 64;
  var overlap = n > 6 ? Math.min(16, (W - 60 - cardWidth) / (n - 1)) : 30;
  var totalWidth = cardWidth + (n - 1) * overlap;
  var startX = (W - totalWidth) / 2;
  var baseY = 590;

  for (var i = 0; i < n; i++) {
    var card = hand[i];
    var x = startX + i * overlap + cardWidth / 2;
    // 弧形效果：中间卡片最高，两边略低
    var arcOffset = Math.pow((i / (n - 1)) - 0.5, 2) * 32;
    var y = baseY - arcOffset;

    // 使用 CardEngine.js 样式渲染卡牌
    var isRed = card.isRed ? card.isRed() : (card.suit === 'heart' || card.suit === 'diamond' || card.rank === 14);
    var colorClass = isRed ? 'ddz-card-red' : 'ddz-card-black';
    var display = card.displayName ? card.displayName() : RANK_NAME_MAP[card.rank];
    var symbol = card.suitSymbol ? card.suitSymbol() : SUIT_SYMBOLS[card.suit];

    var cardHTML = '<div class="ddz-card-dom ' + colorClass + '" data-card-idx="' + i + '">' +
      '<div class="ddz-dom-top">' + display + '</div>' +
      '<div class="ddz-dom-center">' + symbol + '</div>' +
      '<div class="ddz-dom-bottom">' + display + '</div>' +
      '</div>';

    var cardEl = this.add.dom(x, y, cardHTML).setOrigin(0.5, 0.5).setDepth(110);
    cardEl.setData('cardIdx', i);
    cardEl.setData('card', card);
    cardEl.setData('selected', false);

    // 点击选中/取消
    cardEl.addListener('click');
    cardEl.on('click', function () {
      var idx = this.getData('cardIdx');
      var isSelected = this.getData('selected');
      // 获取卡牌 DOM 节点（第一个子元素）
      var cardNode = this.node && this.node.firstElementChild;
      if (isSelected) {
        // 取消选中
        if (cardNode) cardNode.classList.remove('ddz-card-selected');
        this.setY(this.y + 20);
        this.setData('selected', false);
        // 从选中列表移除
        var pos = self.selectedCards.indexOf(idx);
        if (pos >= 0) self.selectedCards.splice(pos, 1);
      } else {
        // 选中
        if (cardNode) cardNode.classList.add('ddz-card-selected');
        this.setY(this.y - 20);
        this.setData('selected', true);
        self.selectedCards.push(idx);
      }
    });

    this.cardDomElements.push(cardEl);
    this.handCards.push(cardEl);
  }

  // 添加卡牌样式（只添加一次）
  ensureCardCSS();
};

// ---- 更新手牌（AI出牌后更新手牌数量） ----
GameScene.prototype.updateHandCount = function (aiIndex) {
  var countText;
  if (aiIndex === 0) {
    // AI 1 出牌后更新
    countText = '\u5269\u4F59 ' + this.ai1Hand.length + ' \u5F20';
    // Find and update AI 1's count text (it's created in createAIArea)
  } else {
    countText = '\u5269\u4F59 ' + this.ai2Hand.length + ' \u5F20';
  }
};

// ---- 模拟 AI 出牌（测试用） ----
GameScene.prototype.renderAIPlay = function (aiIndex) {
  var self = this;
  var hand = aiIndex === 0 ? this.ai1Hand : this.ai2Hand;
  var labelEl = aiIndex === 0 ? this.ai1PlayCards : this.ai2PlayCards;
  var name = aiIndex === 0 ? '\u738B\u603C\u603C' : '\u82CF\u751C\u751C';

  if (hand.length < 2) return;

  // 模拟出一对
  var pairRank = 0;
  while (pairRank < 12) {
    var cards = hand.filter(function (c) { return c.rank === pairRank; });
    if (cards.length >= 2) {
      var playCards = cards.slice(0, 2);
      // 从手牌移除
      for (var i = hand.length - 1; i >= 0; i--) {
        if (hand[i].rank === pairRank && playCards.indexOf(hand[i]) >= 0) {
          hand.splice(i, 1);
        }
      }

      // 渲染 AI 出牌
      var aiHTML = '<div style="display:flex;gap:3px;align-items:center">';
      for (var j = 0; j < playCards.length; j++) {
        var c = playCards[j];
        var isRed = c.isRed ? c.isRed() : (c.suit === 'heart' || c.suit === 'diamond');
        var colorClass = isRed ? 'ddz-card-red' : 'ddz-card-black';
        var display = c.displayName ? c.displayName() : RANK_NAME_MAP[c.rank];
        var symbol = c.suitSymbol ? c.suitSymbol() : SUIT_SYMBOLS[c.suit];
        aiHTML += '<span class="ddz-card-compact ' + colorClass + '">' + symbol + display + '</span>';
      }
      aiHTML += '</div>';
      if (labelEl && labelEl.node) {
        labelEl.node.innerHTML = aiHTML;
      }
      // 确保卡片样式已添加
      ensureCardCSS();
      break;
    }
    pairRank++;
  }

  // 更新剩余牌数
  var countText = '\u5269\u4F59 ' + hand.length + ' \u5F20';
};

// ================================================================
// 6. 功能按钮
// ================================================================

function createActionButtons(scene) {
  var W = 375;
  var bw = 72, bh = 38, gap = 8;
  var totalWidth = bw * 4 + gap * 3;
  var startX = (W - totalWidth) / 2;
  var btnY = 700;

  var buttons = [
    { label: '\u51FA\u724C', color: 0x4ECDC4, hoverColor: 0x45B8AC, key: 'play' },
    { label: '\u63D0\u793A', color: 0xFFD93D, hoverColor: 0xF0C938, key: 'hint' },
    { label: '\u4E0D\u51FA', color: 0xFF6B6B, hoverColor: 0xE05555, key: 'pass' },
    { label: '\u641E\u4E8B\u60C5', color: 0x7C4DFF, hoverColor: 0x6B3FE0, key: 'action' }
  ];

  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    var bx = startX + i * (bw + gap);

    // 按钮背景
    var bg = scene.add.graphics();
    bg.fillStyle(b.color, 1);
    bg.fillRoundedRect(bx, btnY, bw, bh, 8);
    bg.setDepth(100);
    bg.setInteractive(new Phaser.Geom.Rectangle(bx, btnY, bw, bh), Phaser.Geom.Rectangle.Contains);

    // 按钮文字
    var txt = scene.add.text(bx + bw / 2, btnY + bh / 2, b.label, {
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: '14px',
      color: '#FFFFFF',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(101);

    // 按钮交互
    bg.on('pointerover', function () {
      this.clear();
      this.fillStyle(0xFFFFFF, 0.2);
      this.fillRoundedRect(this.x || 0, this.y || 0, bw, bh, 8);
    });

    bg.on('pointerout', function () {
      this.clear();
      bg.clear();
      bg.fillStyle(b.color, 1);
      bg.fillRoundedRect(bx, btnY, bw, bh, 8);
    });

    bg.on('pointerdown', function () {
      // 按钮点击反馈
      txt.setScale(0.92);
    });

    bg.on('pointerup', function () {
      txt.setScale(1);
      handleAction(scene, b.key);
    });

    // 存储坐标用于 hover 效果
    bg.x = bx;
    bg.y = btnY;
  }
}

// ---- 按钮动作处理 ----
function handleAction(scene, action) {
  switch (action) {
    case 'play':
      if (scene.selectedCards.length === 0) {
        showToast(scene, '\u8BF7\u5148\u9009\u62E9\u624B\u724C');
        return;
      }
      var playCards = scene.selectedCards.map(function (idx) {
        return scene.playerHand[idx];
      });
      var info = Doudizhu.identifyType(playCards);
      if (info.type === Doudizhu.HAND_TYPES.INVALID) {
        showToast(scene, '\u975E\u6CD5\u51FA\u724C\u7EC4\u5408');
        return;
      }
      showToast(scene, '\u51FA\u724C\u6210\u529F\uFF01' + Doudizhu.HAND_TYPE_NAMES[info.type]);
      break;

    case 'hint':
      showToast(scene, '\u63D0\u793A\u529F\u80FD\u5F00\u53D1\u4E2D...');
      break;

    case 'pass':
      showToast(scene, '\u4E0D\u51FA');
      break;

    case 'action':
      showToast(scene, '\u641E\u4E8B\u60C5\uFF01\u52A8\u753B\u53D1\u5C55\u4E2D...');
      break;
  }
}

// ---- Toast 提示 ----
function showToast(scene, message) {
  var cx = 375 / 2;
  var toastBg = scene.add.graphics();
  toastBg.fillStyle(0x000000, 0.7);
  toastBg.fillRoundedRect(cx - 80, 390, 160, 32, 8);
  toastBg.setDepth(200);

  var toastText = scene.add.text(cx, 406, message, {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '13px',
    color: '#FFFFFF'
  }).setOrigin(0.5).setDepth(201);

  scene.time.delayedCall(1200, function () {
    toastBg.destroy();
    toastText.destroy();
  });
}

// ================================================================
// 卡牌 CSS 样式
// ================================================================

// ---- 确保卡牌 CSS 已注入（全局只加一次） ----
var _cardCSSInjected = false;
function ensureCardCSS() {
  if (_cardCSSInjected) return;
  _cardCSSInjected = true;
  var style = document.createElement('style');
  style.textContent = getCardCSS();
  document.head.appendChild(style);
}

function getCardCSS() {
  return [
    '.ddz-card-dom {',
    '  display: inline-flex; flex-direction: column; align-items: center; justify-content: center;',
    '  width: 40px; height: 60px;',
    '  background: linear-gradient(145deg, #FFFFFF, #F5F5F5);',
    '  border: 1.5px solid #90A4AE; border-radius: 6px;',
    '  font-size: 14px; font-weight: bold;',
    '  cursor: pointer; user-select: none;',
    '  box-shadow: 0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.8);',
    '  transition: transform 0.15s ease, box-shadow 0.15s ease;',
    '}',
    '.ddz-card-dom:hover {',
    '  transform: translateY(-2px);',
    '  box-shadow: 0 4px 12px rgba(0,0,0,0.3);',
    '}',
    '.ddz-card-selected {',
    '  border-color: #4ECDC4 !important;',
    '  box-shadow: 0 0 0 2px #4ECDC4, 0 4px 12px rgba(78,205,196,0.4) !important;',
    '  transform: translateY(-4px);',
    '}',
    '.ddz-card-red { color: #E53935; }',
    '.ddz-card-black { color: #212121; }',
    '.ddz-dom-top { font-size: 10px; line-height: 1.2; align-self: flex-start; margin-left: 3px; }',
    '.ddz-dom-center { font-size: 18px; line-height: 1.4; }',
    '.ddz-dom-bottom { font-size: 10px; line-height: 1.2; align-self: flex-end; margin-right: 3px; transform: rotate(180deg); }',
    '',
    '.ddz-card-compact {',
    '  display: inline-flex; align-items: center; justify-content: center;',
    '  width: 30px; height: 42px; margin: 1px;',
    '  background: linear-gradient(145deg, #FFFFFF, #F5F5F5);',
    '  border: 1px solid #90A4AE; border-radius: 4px;',
    '  font-size: 11px; font-weight: bold;',
    '  box-shadow: 0 1px 3px rgba(0,0,0,0.2);',
    '}',
    '',
    '/* Phaser DOM container needs pointer-events */',
    '#game-container canvas { display: block; }',
    '#game-container div { pointer-events: auto; }'
  ].join('\n');
}
