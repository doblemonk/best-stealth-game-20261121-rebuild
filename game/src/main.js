// Shadow Vault — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between five screens:
// title, play, paused, win and lose.
//
// ?shot=1..4 stages that screenshot scene instead of running the loop, paints
// it twice and sets window.__shotReady for the screenshot taker:
//   1 title and patrols, 2 mid-heist near the idol,
//   3 the idol secured, 4 a CLEAN GETAWAY win at the exit.

import { STEP } from './config.js';
import { createWorld, EVENT_ALARM, EVENT_CAUGHT, EVENT_IDOL, EVENT_PICKUP, EVENT_SPOTTED, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_LOSE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
const BEST_KEY = 'shadow-vault.best-time';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld();
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    const value = Number.parseFloat(window.localStorage.getItem(BEST_KEY) ?? '');
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.bestTime || null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let stepSoundTimer = 0;
  let alarmSoundTimer = 0;
  let wasSpotted = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    input.clearTarget();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal the golden idol, then reach the exit unseen.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_LOSE;
    if (won && (best === null || world.state.time < best)) {
      best = world.state.time;
      saveBest(best);
    }
    announce(won ? `Clean getaway in ${world.state.time.toFixed(1)} seconds.` : 'Caught. Press R to try again.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_RESTART) {
      audio.unlock();
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && screen !== SCREEN_PLAY && screen !== SCREEN_PAUSED) {
      audio.unlock();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the guards patrol behind the title.
      world.step(STEP, { x: 0, y: 0 });
      return;
    }
    // Click-to-move needs the thief's current position: pass it every frame.
    const move = input.poll(world.state.player.x, world.state.player.y);
    const events = world.step(STEP, move);
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_IDOL) audio.idol();
    if (events & EVENT_ALARM) audio.alarmFull();
    if (events & EVENT_WIN) {
      audio.win();
      endGame(true);
    } else if (events & EVENT_CAUGHT) {
      audio.lose();
      endGame(false);
    }
    // Footsteps while moving, and a tick while the alarm is climbing.
    if (move.x !== 0 || move.y !== 0) {
      stepSoundTimer -= STEP;
      if (stepSoundTimer <= 0) {
        audio.footstep();
        stepSoundTimer = 0.34;
      }
    }
    if (world.state.spotted && !wasSpotted) audio.alarmTick();
    wasSpotted = world.state.spotted;
    if (world.state.spotted) {
      alarmSoundTimer -= STEP;
      if (alarmSoundTimer <= 0) {
        audio.alarmTick();
        alarmSoundTimer = 0.5;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Debug/testing handle: the screenshot taker and play-tests read the live
  // state through this (screen, player position, alarm) without touching the DOM.
  window.__shadowVault = {
    world,
    input,
    get screen() {
      return screen;
    },
  };

  announce('Shadow Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
