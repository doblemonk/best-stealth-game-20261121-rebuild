// Shadow Vault — keyboard and mouse input.
//
// Keyboard: WASD or arrow keys to move, R to restart, Space/Enter to confirm,
// P or Escape to pause. Mouse: click anywhere to walk there (click-to-move).
//
// The fix that matters: click-to-move needs to know where the thief is, so the
// loop calls poll(player.x, player.y) every frame — poll(player) works too.
// poll() returns the move direction for this frame: held keys win over a click
// target, and the click target clears itself once the thief arrives.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  /** Logical (1280x720) point the thief is walking toward, or null. */
  let clickTarget = null;

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * FIELD.width,
      y: ((event.clientY - rect.top) / rect.height) * FIELD.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });

  canvas.addEventListener('pointerdown', (event) => {
    clickTarget = toLogical(event);
    actions |= ACTION_CONFIRM;
    event.preventDefault();
  });

  function keyboardDirection() {
    let x = 0;
    let y = 0;
    for (const code of held) {
      if (LEFT.has(code)) x -= 1;
      else if (RIGHT.has(code)) x += 1;
      else if (UP.has(code)) y -= 1;
      else if (DOWN.has(code)) y += 1;
    }
    return { x, y };
  }

  return {
    /**
     * The move direction for this frame. Call it every frame with the thief's
     * current position: poll(player.x, player.y) — or poll(player) with the
     * player object itself. Keyboard steering wins; otherwise the thief walks
     * toward the last clicked point until it arrives.
     */
    poll(px, py) {
      const playerX = typeof px === 'object' ? px.x : px;
      const playerY = typeof px === 'object' ? px.y : py;
      const keys = keyboardDirection();
      if (keys.x !== 0 || keys.y !== 0) {
        clickTarget = null;
        const len = Math.hypot(keys.x, keys.y) || 1;
        return { x: keys.x / len, y: keys.y / len };
      }
      if (clickTarget !== null) {
        const dx = clickTarget.x - playerX;
        const dy = clickTarget.y - playerY;
        const dist = Math.hypot(dx, dy);
        if (dist < 12) {
          clickTarget = null;
          return { x: 0, y: 0 };
        }
        return { x: dx / dist, y: dy / dist };
      }
      return { x: 0, y: 0 };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Forget any click target (used when a new run starts). */
    clearTarget() {
      clickTarget = null;
    },
    /** For tests and the autopilot: is a click target still active? */
    hasTarget() {
      return clickTarget !== null;
    },
  };
}
