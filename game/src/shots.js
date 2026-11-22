// shots.js — deterministic screenshot autopilot for "Shadow Vault".
//
// Steers the thief along the fixed routes from config.js, waiting out
// guard vision cones and camera beams, fleeing at full speed during a
// chase, and skipping waypoints it gets stuck on. stageShot() replays
// those routes from a fresh world to stage the four screenshot scenes.
//
// Deterministic: no randomness, no Date.now(), fixed 1/60 s steps, so
// re-running a shot paints the same frame.

import { ROUTE_TO_IDOL, ROUTE_TO_EXIT, GUARD, CAMERA, CAMERAS } from './config.js';
import { lineOfSightClear, pointInShadow } from './world.js';

const DT = 1 / 60;
const WAYPOINT_RADIUS = 26; // px — close enough to advance to the next waypoint
const STUCK_WINDOW = 0.5; // s — window for stuck detection
const STUCK_DISTANCE = 4; // px — moved less than this in the window = stuck
const MAX_WAIT = 1.0; // s — longest to wait out a vision cone at one waypoint
const NEAR_IDOL = 90; // px — "near the idol" for shot 2
const ATTRACT_SECONDS = 4; // s — patrol time behind the title screen

// --- helpers ---------------------------------------------------------------

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function thiefOf(state) { return state.thief || state.player || { x: 0, y: 0 }; }

// True when point (px, py) lies inside a vision cone rooted at (ox, oy)
// facing `angle`, with the given range and half-angle, and with a clear
// line of sight (no wall between the watcher and the point).
function inVisionCone(state, px, py, ox, oy, angle, range, halfAngle) {
  if (dist(px, py, ox, oy) >= range) return false;
  if (Math.abs(angleDiff(Math.atan2(py - oy, px - ox), angle)) > halfAngle) return false;
  return lineOfSightClear(ox, oy, px, py);
}

// True when the waypoint would be seen right now by a guard or a camera.
function waypointInDanger(state, wp) {
  const guards = state.guards || [];
  for (const g of guards) {
    if (inVisionCone(state, wp.x, wp.y, g.x, g.y, g.angle || 0, GUARD.visionRange, GUARD.visionHalfAngle)) return true;
  }
  const cams = state.cameras || CAMERAS || [];
  for (let i = 0; i < cams.length; i++) {
    const cam = cams[i];
    const angle = cam.angle ?? (CAMERAS[i] && CAMERAS[i].angle) ?? 0;
    if (inVisionCone(state, wp.x, wp.y, cam.x, cam.y, angle, CAMERA.range, CAMERA.halfAngle)) return true;
  }
  return false;
}

function isChase(state) {
  if ((state.alarm || 0) >= 100) return true;
  return (state.guards || []).some((g) => (g.mode || g.state) === 'chase');
}

// True when the thief's CURRENT position is inside a guard cone or a
// camera beam. The pilot never waits out a cone while already seen —
// standing still in a beam just lets the alarm fill and the guards
// close in, so in that case it moves on instead.
function thiefInDanger(state) {
  const thief = thiefOf(state);
  const guards = state.guards || [];
  for (const g of guards) {
    if (inVisionCone(state, thief.x, thief.y, g.x, g.y, g.angle || 0, GUARD.visionRange, GUARD.visionHalfAngle)) return true;
  }
  const cams = state.cameras || CAMERAS || [];
  for (let i = 0; i < cams.length; i++) {
    const cam = cams[i];
    const angle = cam.angle ?? (CAMERAS[i] && CAMERAS[i].angle) ?? 0;
    if (inVisionCone(state, thief.x, thief.y, cam.x, cam.y, angle, CAMERA.range, CAMERA.halfAngle)) return true;
  }
  return false;
}

// --- pilot -----------------------------------------------------------------

function createPilot() {
  return { route: null, index: 0, wait: 0, stuckTimer: 0, lastX: null, lastY: null, stuckCheck: 0 };
}

// Steer the thief toward the pilot's current route waypoint.
// Returns a normalised {x, y} direction, or {x: 0, y: 0} to stand still.
export function autopilotMove(state, pilot, dt) {
  const step = dt || DT;
  const thief = thiefOf(state);
  const route = pilot.route;
  if (!route || route.length === 0 || pilot.index >= route.length) return { x: 0, y: 0 };

  // Advance past any waypoint already reached.
  while (pilot.index < route.length) {
    const wp = route[pilot.index];
    if (dist(thief.x, thief.y, wp.x, wp.y) < WAYPOINT_RADIUS) { pilot.index++; pilot.wait = 0; }
    else break;
  }
  if (pilot.index >= route.length) return { x: 0, y: 0 };

  // Stuck detection: barely moved in the last window while trying to
  // move means the waypoint is unreachable — skip to the next one.
  if (pilot.lastX === null || pilot.lastY === null) { pilot.lastX = thief.x; pilot.lastY = thief.y; }
  pilot.stuckTimer += step;
  if (pilot.stuckTimer >= STUCK_WINDOW) {
    const moved = dist(thief.x, thief.y, pilot.lastX, pilot.lastY);
    if (moved < STUCK_DISTANCE) {
      pilot.stuckCheck++;
      pilot.index++;
      pilot.wait = 0;
      if (pilot.index >= route.length) return { x: 0, y: 0 };
    } else pilot.stuckCheck = 0;
    pilot.lastX = thief.x;
    pilot.lastY = thief.y;
    pilot.stuckTimer = 0;
  }
  const target = route[pilot.index];

  // Chase: run for the next waypoint at full speed, never wait.
  // Only wait out a cone/beam when the thief is currently safe.
  if (!isChase(state) && waypointInDanger(state, target) && !thiefInDanger(state)) {
    pilot.wait += step;
    if (pilot.wait < MAX_WAIT) return { x: 0, y: 0 };
    // Waited the full second — proceed anyway rather than stall forever.
  } else pilot.wait = 0;

  const dx = target.x - thief.x;
  const dy = target.y - thief.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

// --- staging ---------------------------------------------------------------

function idolPos() { return ROUTE_TO_IDOL[ROUTE_TO_IDOL.length - 1]; }

function hasIdol(state) {
  return Boolean(state.hasIdol || state.idolTaken || (state.idol && state.idol.taken));
}

function hasWon(state) {
  return Boolean(state.won || state.win || state.status === 'win' || state.result === 'win');
}

function nearIdol(state) {
  const thief = thiefOf(state);
  const idol = idolPos();
  return dist(thief.x, thief.y, idol.x, idol.y) <= NEAR_IDOL;
}

// Drive `route` with the autopilot until stopFn(state) is true, the route
// is finished, or maxSeconds of simulated time have passed.
function runRoute(world, route, stopFn, maxSeconds) {
  const pilot = createPilot();
  pilot.route = route;
  let elapsed = 0;
  while (elapsed < maxSeconds) {
    if (stopFn && stopFn(world.state)) break;
    if (pilot.index >= route.length) break;
    world.step(DT, autopilotMove(world.state, pilot, DT));
    elapsed += DT;
  }
  return pilot;
}

function stepStill(world, seconds) {
  let elapsed = 0;
  while (elapsed < seconds) { world.step(DT, { x: 0, y: 0 }); elapsed += DT; }
}

export function stageShot(name, world) {
  world.reset();

  if (name === '1') {
    // Title / cover: attract mode — guards patrol and a camera beam sweeps
    // the middle hall behind the title screen.
    stepStill(world, ATTRACT_SECONDS);
    return { screen: 'title', bestTime: null };
  }

  if (name === '2') {
    // Mid-heist: stop just short of the idol, behind cover.
    runRoute(world, ROUTE_TO_IDOL, nearIdol, 40);
    // Let a camera beam sweep past while the thief sits in shadow.
    let settle = 0;
    while (settle < 2) {
      const thief = thiefOf(world.state);
      if (pointInShadow(thief.x, thief.y)) break;
      world.step(DT, { x: 0, y: 0 });
      settle += DT;
    }
    return { screen: 'play', bestTime: null };
  }

  if (name === '3') {
    // Idol secured: take it, then start back toward the exit.
    runRoute(world, ROUTE_TO_IDOL, hasIdol, 30);
    runRoute(world, ROUTE_TO_EXIT, null, 3);
    return { screen: 'play', bestTime: null };
  }

  // '4' (and any unknown name): clean getaway — idol, then exit to a win.
  runRoute(world, ROUTE_TO_IDOL, hasIdol, 30);
  runRoute(world, ROUTE_TO_EXIT, hasWon, 30);
  if (hasWon(world.state)) return { screen: 'win', bestTime: 8.0 };
  return { screen: 'play', bestTime: null };
}
