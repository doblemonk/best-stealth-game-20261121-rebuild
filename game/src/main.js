// main.js — boot + fixed-step game loop for Shadow Vault.
import { STEP } from './config.js';
import {
  createWorld,
  EVENT_ALARM,
  EVENT_CAUGHT,
  EVENT_IDOL,
  EVENT_PICKUP,
  EVENT_SPOTTED,
  EVENT_WIN,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_LOSE,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';
const BEST_TIME_KEY = 'shadow-vault.best-time';
const FOOTSTEP_INTERVAL = 0.34;
const ALARM_TICK_INTERVAL = 0.5;
const MAX_FRAME_DT = 0.25;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);
const input = createInput(canvas);
let world = createWorld();
let screen = SCREEN_TITLE;
let bestTime = loadBestTime();
let footstepTimer = 0;
let alarmTimer = 0;
let acc = 0;
let last = performance.now();
function loadBestTime() {
  try {
    const t = Number(localStorage.getItem(BEST_TIME_KEY));
    return Number.isFinite(t) && t > 0 ? t : null;
  } catch (err) {
    return null;
  }
}
function saveBestTime(t) {
  try {
    localStorage.setItem(BEST_TIME_KEY, String(t));
  } catch (err) {
    // Storage unavailable — the best time just isn't kept.
  }
}
function announce(message) {
  if (statusEl) statusEl.textContent = message;
}
const SCREEN_MESSAGES = {
  [SCREEN_TITLE]: 'Shadow Vault. Press Space or click to start.',
  [SCREEN_PLAY]: 'Playing. Steal the idol and reach the exit unseen.',
  [SCREEN_PAUSED]: 'Paused. Press Space or P to resume.',
  [SCREEN_WIN]: 'You escaped with the idol!',
  [SCREEN_LOSE]: 'Caught! Press R to try again.',
};
function setScreen(next) {
  screen = next;
  announce(SCREEN_MESSAGES[next] || '');
}
function restartRun() {
  world = createWorld();
  footstepTimer = 0;
  alarmTimer = 0;
  acc = 0;
  input.clearTarget();
  setScreen(SCREEN_PLAY);
}
function handleEvent(ev) {
  switch (ev) {
    case EVENT_PICKUP: audio.pickup(); break;
    case EVENT_IDOL: audio.idol(); break;
    case EVENT_ALARM: audio.alarmFull(); break;
    case EVENT_SPOTTED: audio.alarmTick(); alarmTimer = 0; break;
    case EVENT_WIN: {
      audio.win();
      const t = world.state.time;
      if (typeof t === 'number' && (bestTime === null || t < bestTime)) {
        bestTime = t;
        saveBestTime(t);
      }
      setScreen(SCREEN_WIN);
      break;
    }
    case EVENT_CAUGHT: audio.lose(); setScreen(SCREEN_LOSE); break;
    default: break;
  }
}
function stepWorld() {
  // On play, poll every step with the thief's CURRENT position:
  // click-to-move steering needs it, and it changes after each step.
  let move = { x: 0, y: 0 };
  if (screen === SCREEN_PLAY) {
    const player = world.state.player;
    move = input.poll(player.x, player.y);
  }
  // world.step returns an events bitmask (a number), not an array.
  const events = world.step(STEP, move);
  if (events & EVENT_PICKUP) handleEvent(EVENT_PICKUP);
  if (events & EVENT_IDOL) handleEvent(EVENT_IDOL);
  if (events & EVENT_ALARM) handleEvent(EVENT_ALARM);
  if (events & EVENT_SPOTTED) handleEvent(EVENT_SPOTTED);
  if (events & EVENT_WIN) handleEvent(EVENT_WIN);
  else if (events & EVENT_CAUGHT) handleEvent(EVENT_CAUGHT);
  if (screen !== SCREEN_PLAY) return;

  if (move.x !== 0 || move.y !== 0) {
    footstepTimer += STEP;
    if (footstepTimer >= FOOTSTEP_INTERVAL) {
      footstepTimer -= FOOTSTEP_INTERVAL;
      audio.footstep();
    }
  } else {
    footstepTimer = 0;
  }

  if (world.state.spotted) {
    alarmTimer += STEP;
    if (alarmTimer >= ALARM_TICK_INTERVAL) {
      alarmTimer -= ALARM_TICK_INTERVAL;
      audio.alarmTick();
    }
  } else {
    alarmTimer = 0;
  }
}
function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_RESTART) { restartRun(); return; }
  if (actions & ACTION_CONFIRM) {
    if (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_LOSE) {
      audio.unlock();
      restartRun();
    } else if (screen === SCREEN_PAUSED) {
      setScreen(SCREEN_PLAY);
    }
  }
  if (actions & ACTION_PAUSE) {
    if (screen === SCREEN_PLAY) setScreen(SCREEN_PAUSED);
    else if (screen === SCREEN_PAUSED) setScreen(SCREEN_PLAY);
  }
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;
  if (dt < 0) dt = 0;

  handleActions();

  acc += dt;
  while (acc >= STEP) {
    acc -= STEP;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) stepWorld();
  }

  renderer.draw(world.state, screen, bestTime);
}

function boot() {
  announce(SCREEN_MESSAGES[SCREEN_TITLE]);
  window.__shadowVault = {
    get world() { return world; },
    input,
    get screen() { return screen; },
  };

  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot && /^[1-4]$/.test(shot)) {
    // stageShot takes the plain shot number ('1'..'4') and returns the
    // screen + best time to paint for that scene.
    const staged = stageShot(shot, world);
    const shotScreen = staged.screen === 'win' ? SCREEN_WIN : staged.screen === 'title' ? SCREEN_TITLE : SCREEN_PLAY;
    const shotBest = staged.bestTime ?? bestTime;
    requestAnimationFrame(() => {
      renderer.draw(world.state, shotScreen, shotBest);
      requestAnimationFrame(() => {
        renderer.draw(world.state, shotScreen, shotBest);
        window.__shotReady = true;
      });
    });
    return;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) setScreen(SCREEN_PAUSED);
  });

  requestAnimationFrame(frame);
}

boot();
