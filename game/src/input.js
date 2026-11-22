// input.js — keyboard + click-to-move input for Shadow Vault.
//
// Keyboard: WASD / arrow keys move, Space / Enter confirms,
// P / Escape pauses, R restarts. A mouse click on the canvas sets a
// click-to-move target in the 1280x720 logical field, and also counts
// as a confirm press — the main loop only acts on confirm off the
// play screen, so clicks steer during play and start / resume the
// game everywhere else.
//
// takeActions() is edge-triggered: a key held down reports once,
// until it is released and pressed again.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

const FIELD_W = 1280;
const FIELD_H = 720;
const ARRIVE_PX = 10;

// Every key the game cares about. Anything else is left alone so
// browser shortcuts and typing in other fields keep working.
const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'Space', 'Enter', 'KeyP', 'Escape', 'KeyR',
]);

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let target = null;

  function onKeyDown(event) {
    if (!GAME_KEYS.has(event.code)) return;
    // Stop the page scrolling on arrows / Space while playing.
    event.preventDefault();
    if (!held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseDown(event) {
    const rect = canvas.getBoundingClientRect();
    // Convert canvas pixels to the 1280x720 logical field, so clicks
    // land in the right place even when the canvas is scaled by CSS.
    target = {
      x: (event.clientX - rect.left) * (FIELD_W / rect.width),
      y: (event.clientY - rect.top) * (FIELD_H / rect.height),
    };
    // A click also counts as confirm; the main loop only acts on it
    // on non-play screens, where it starts / resumes the game.
    pressed.add('MouseConfirm');
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);

  function keyboardDirection() {
    let x = 0;
    let y = 0;
    if (held.has('ArrowLeft') || held.has('KeyA')) x -= 1;
    if (held.has('ArrowRight') || held.has('KeyD')) x += 1;
    if (held.has('ArrowUp') || held.has('KeyW')) y -= 1;
    if (held.has('ArrowDown') || held.has('KeyS')) y += 1;
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  // Returns the movement direction for this step. While a click
  // target is set, steer toward it; once the thief is within
  // ARRIVE_PX of it, forget it and stop. Otherwise fall back to
  // the normalised keyboard direction (0, 0 if no keys held).
  function poll(x, y) {
    if (target) {
      const dx = target.x - x;
      const dy = target.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist <= ARRIVE_PX) {
        target = null;
        return { x: 0, y: 0 };
      }
      return { x: dx / dist, y: dy / dist };
    }
    return keyboardDirection();
  }

  // Bitmask of ACTION_* for keys pressed since the last call.
  // Edge-triggered: draining here is what makes a held key
  // report only once.
  function takeActions() {
    let actions = 0;
    if (pressed.has('Space') || pressed.has('Enter') || pressed.has('MouseConfirm')) {
      actions |= ACTION_CONFIRM;
    }
    if (pressed.has('KeyP') || pressed.has('Escape')) actions |= ACTION_PAUSE;
    if (pressed.has('KeyR')) actions |= ACTION_RESTART;
    pressed.clear();
    return actions;
  }

  function clearTarget() {
    target = null;
  }

  return { poll, takeActions, clearTarget };
}
