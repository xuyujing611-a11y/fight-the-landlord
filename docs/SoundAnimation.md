# Sound & Animation Design Document

**Version:** v1.0  
**Author:** 产品老大  
**Date:** 2026-05-02  
**Doc ID:** SOUND-ANIM-001  
**Corresponding File:** `src/client/js/game.js`  

---

## 1. Overview

This document covers all sound effects and animations used throughout the game. The game uses Phaser 3's built-in sound system (`scene.sound`) and tween system (`scene.tweens`) — no external libraries required.

---

## 2. Sound Manager

### 2.1 SoundManager Singleton

```javascript
var SoundManager = {
  scene: null,
  audioReady: false,
  init: function(scene) { ... },
  ...
};
```

Location: game.js lines 31-117

**Initialization:** Called in `GameScene.create()` as `SoundManager.init(this)`. The init method listens for the first `pointerdown` event to resume the AudioContext (required by browser autoplay policy).

**Autoplay handling:**
- First click on the canvas → `AudioContext.resume()`
- A `tryResume()` function is also called after 500ms delay
- All `_ensureReady()` calls check if AudioContext state is 'running' before playing

### 2.2 Sound Pool System

Each sound effect uses `_random(base, count)` to pick from 3 variants:

```javascript
_random: function(base, count) {
  return base + (Math.floor(Math.random() * count) + 1);
}
```

This prevents audio fatigue by adding subtle variation on each play.

### 2.3 Sound Catalog

| Sound Function | File(s) | Volume | Trigger Event | Gameplay Context |
|---------------|---------|:------:|---------------|------------------|
| `playCard()` | cardPlace1-3 (.mp3/.ogg) | 0.8 | Player confirms play | Satisfying card-slap feedback |
| `selectCard()` | cardSlide1-3 | 0.6 | Card click to select | Low-volume slide sound for selection |
| `deselectCard()` | cardSlide1-3 | 0.5 | Card click to deselect | Slightly quieter on deselect |
| `playerTurn()` | chipsCollide1-3 | 0.7 | "轮到你出牌" notification | Attention-grabbing turn indicator |
| `bid()` | chipsCollide1-3 | 0.7 | Player bids | Confident chip-clack sound |
| `passBid()` | cardSlide1-3 | 0.5 | Player passes in bidding | Quieter, less assertive |
| `win()` | cardPlace3 | 0.9 | Player wins round | Triumphant single strong sound |
| `lose()` | cardSlide1 | 0.6 | Player loses round | Deflating slide sound |
| `bomb()` | cardPlace1 + bombEffect | 0.9 | Bomb/rocket is played | Explosive effect, double-length tail |
| `aiThink()` | — | — | AI's turn | Currently silent, intentional |

### 2.4 Sound File Requirements

**Format:** Both `.mp3` and `.ogg` are loaded for each sound, allowing cross-browser compatibility.

**Loaded in preload:**
```javascript
for (var ai = 1; ai <= 3; ai++) {
  this.load.audio('cardPlace' + ai, ['assets/sounds/cardPlace' + ai + '.mp3', 'assets/sounds/cardPlace' + ai + '.ogg']);
  this.load.audio('cardSlide' + ai, ['assets/sounds/cardSlide' + ai + '.mp3', 'assets/sounds/cardSlide' + ai + '.ogg']);
  this.load.audio('chipsCollide' + ai, ['assets/sounds/chipsCollide' + ai + '.mp3', 'assets/sounds/chipsCollide' + ai + '.ogg']);
}
this.load.audio('dieShuffle1', ['assets/sounds/dieShuffle1.mp3', 'assets/sounds/dieShuffle1.ogg']);
```

**Note:** `dieShuffle1` is loaded but not currently used in any code path — available for future shuffle animations.

**Asset location:** `assets/sounds/`

### 2.5 SoundManager Limitations

| Limitation | Description | Future Improvement |
|-----------|-------------|-------------------|
| No volume control UI | Volume is hardcoded per sound type | Add settings panel with volume slider |
| No mute toggle | No way to mute all sounds | Add mute button (e.g., speaker icon in top bar) |
| Single channel | Sounds play on the default channel | Add separate music/SFX channels |
| No background music | No BGM during gameplay | Add BGM track for play and bidding phases |

---

## 3. Animations

All animations use Phaser 3 Tweens (`scene.tweens.add`).

### 3.1 Card Selection (Hand Area)

**Trigger:** Click on a hand card during `GAME_STATE.PLAYER_TURN`

| Property | Value |
|----------|-------|
| Effect | Card shifts Y: -16px (lifts up) or +16px (drops back) |
| Duration | Instant (no tween, direct property change) |
| Sound | selectCard (0.6) / deselectCard (0.5) |
| Visual indicator | Selected cards render on top via Z-order |

**Code location:** game.js lines 490-515 (pointerdown handler on each card image)

**Future improvement:** Add a 50ms tween with slight ease for smoother selection feel.

### 3.2 Card Play (Play Area)

**Trigger:** Player clicks "出牌" button → confirmPlay()

| Property | Value |
|----------|-------|
| Origin | Hand area (Y: ~345) |
| Destination | Play area (Player: Y=195, center aligned) |
| Destination (AI) | Play area (AI1 Y=133 left, AI2 Y=133 right) |
| Animation | Direct image creation at target position |
| Sound | `playCard()` volume 0.8 |
| Cleanup | Previous plays cleared before new ones |

**Code location:** game.js `displayPlay()` at line 1304

### 3.3 AI Card Animation

**Trigger:** AI plays → handleAIPlay()

| Property | Value |
|----------|-------|
| Delay before AI turn | 1200ms (`time.delayedCall(1200, ...)`) |
| Play reasoning bubble | `_showPlayBubble()` appears before play animation |
| Card display | Instant placement at target coordinates |
| AI-to-AI delay | 1200ms between AI1 and AI2 turns |
| AI-to-Player delay | 1500ms after AI finishes |

**Code location:** game.js `doAITurn()` at line 1120

### 3.4 Round End Panel

**Trigger:** Any player runs out of cards (hand.length === 0)

| Phase | Animation | Duration | Ease |
|-------|-----------|:--------:|:----:|
| 1. Overlay fade-in | Alpha 0 → 0.65 | 300ms | Linear |
| 2. Title bounce | Scale 0.3 → 1.0 | 400ms | Back.easeOut |
| 3. Score panel fade | Alpha 0 → 1 | 300ms | Linear |
| 4a. Score count-up | Total number ticks from 0 to final | 1200ms | Step (30ms interval) |
| 4b. Score items | Each row fades in sequentially | 150ms/row | Linear |
| 5. Buttons bounce | Both buttons scale 0→1 | 300ms | Back.easeOut (200ms delay after items) |

**Total animation time:** ~2.8 seconds before interactivity

**Code location:** game.js `renderRoundEndPanel()` at line 2302

#### Score Count-up Implementation

```javascript
var duration = 1200;
var interval = 30;
var totalSteps = duration / interval;
var stepValue = totalScore / totalSteps;
var currentValue = 0;
var countTimer = scene.time.addEvent({
  delay: interval,
  callback: function() {
    currentValue += stepValue;
    scoreText.setText('+' + Math.floor(currentValue));
    if (Math.floor(currentValue) >= totalScore) {
      scoreText.setText('+' + totalScore);
      countTimer.remove();
    }
  },
  loop: true
});
```

### 3.5 AI Bubble Animation

**Trigger:** AI play/pass/bomb event

| Phase | Animation | Duration | Ease |
|-------|-----------|:--------:|:----:|
| Entrance | Scale 0.8 → 1.0, Alpha 0 → 1 | 150ms | Back.easeOut |
| Hold | Display period (4-5s) | 240-300 frames | — |
| Exit | Alpha 1 → 0 | 200ms | Linear |

**Bomb bubble special:** Scale 0.7 → 1.1 → 1.0 (bounce overshoot) with red border flash (alpha 0.3↔0.9, 400ms).

**Code location:** game.js `_showPlayBubble()` at line 1973

### 3.6 Card Swap Animation

**Trigger:** Wrong answer / timeout → AI takes player card

| Phase | Animation | Duration | Start Y → End Y |
|-------|-----------|:--------:|:---------------:|
| 1. Card highlight | Selected card border glow | 200ms | — |
| 2. Card lift | Y shift up 30px | 200ms | 345 → 315 |
| 3. Card fly to AI | Y rise + X shift to AI area | 400ms | 315 → 160 |
| 4. Rotation & scale | Rotate 10°, scale to 60% | 200ms | concurrently with step 3 |
| 5. Flip reveal | Face-down → face-up | 200ms | show card front |
| 6. Result text | "🤖 AI 拿走了 [♠K]" | — | After animation |

**Total duration:** ~1.2s

For **correct answer swap** (player gives + AI gives):
- Player's card flies from hand to AI area
- AI's card flies from AI slot to player hand
- Both cards flip reveal simultaneously
- Cross paths mid-animation

### 3.7 Card Hint System

**Trigger:** Click "提示" button

| Property | Value |
|----------|-------|
| Detection | `findValidPlays()` returns list |
| Selection | Last card in list highlighted |
| Highlight | Card border glow (2px, #FFD700, no visual tween) |
| Card shift | Selected cards Y: -16px |
| No hint | If no valid plays → "没有能出的牌" toast |

**Code location:** game.js `doHint()` at line 1055

### 3.8 Chaos Mode Animations

**Trigger:** "搞事情" button, question pane, result display

| Phase | Animation | Duration |
|-------|-----------|:--------:|
| Type selection grid | Instant display of 2×2 grid | — |
| Question pane fade | Alpha 0 → 1 | 200ms |
| Option highlight (hover) | Background color change (white → #81C784) | 100ms |
| Correct answer flash | Option bg pulses green 3 times | 900ms total |
| Wrong answer shake | Option shakes left-right 3px × 3 | 300ms |
| Feedback text | "🎉 答对了!" or "😅 答错了" scale bounce | 200ms |
| Swap buttons enter | Scale 0.8 → 1.0 | 150ms |

**Code location:** game.js chaos functions at lines 1358-2206

---

## 4. Animation Timing Reference Table

| Animation | Duration (ms) | Ease Type | Sound |
|-----------|:-------------:|:---------:|:-----:|
| Card select click | instant | none | selectCard (0.6) |
| Card deselect click | instant | none | deselectCard (0.5) |
| Player play cards | instant (direct render) | none | playCard (0.8) |
| AI think delay | 1200 | — | aiThink (none) |
| AI-to-player delay | 1500 | — | playerTurn (0.7) |
| Round-end overlay fade | 300 | Linear | — |
| Round-end title bounce | 400 | Back.easeOut | win/lose |
| Score count-up | 1200 | step (30ms) | — |
| Score items fade-in | 150 per row | Linear | — |
| Buttons bounce | 300 | Back.easeOut | — |
| Bubble entrance | 150 | Back.easeOut | — |
| Bubble exit | 200 | Linear | — |
| Bomb bubble special | 250 | overshoot bounce | — |
| Card swap fly | 400 | Sine.easeOut | — |
| Card swap flip reveal | 200 | Linear | — |
| Answer correct flash | 900 (3×300ms) | step | — |
| Answer wrong shake | 300 | step | — |
| Chaos option hover | 100 | Linear | — |

---

## 5. Audio File Inventory

| File | Type | Variants | Purpose | On Disk |
|------|:----:|:---------:|---------|:-------:|
| cardPlace1-3 | SFX | 3 | Card play to table | ✅ |
| cardSlide1-3 | SFX | 3 | Card selection/deselection | ✅ |
| chipsCollide1-3 | SFX | 3 | Turn notification, bidding | ✅ |
| dieShuffle1 | SFX | 1 | Available, not used | ✅ |

**Total: 10 sound files (loaded in preload)**

---

## 6. Future Animation TODO

| Feature | Priority | Notes |
|---------|:--------:|-------|
| Card dealing animation | P2 | Cards fly from center to hands when game starts |
| Card shuffle animation | P2 | Visual deck shuffle before deal |
| Win particle burst | P1 | Gold/green particle rain on player win (manual or Phaser particle system) |
| Card flip animation | P2 | Smooth card rotation (scaleX 1→0→1) for blind pick reveal |
| Loser card collapse | P3 | Remaining cards of loser get smaller/darker |
| Timer pulse animation | P1 | Countdown bar pulses faster at <5s |
| Background music | P3 | Add BGM for play and menu phases |
| Stage transitions | P2 | Smooth transitions between bidding→playing→game-over |
