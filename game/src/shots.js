// Shadow Vault — the screenshot scenes behind ?shot=1..4. Each scene plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a deterministic autopilot, so the frame is what a real game looks like and
// the same scene always gives the same frame.
//
// The autopilot follows waypoints (see config.js ROUTE_TO_IDOL / ROUTE_TO_EXIT)
// that thread the two door gaps. If a chase starts it abandons the loot route
// and flees along the getaway route toward the exit; if a guard's cone is about
// to sweep across its next waypoint it waits in place briefly, then goes anyway.
// A stuck detector nudges it sideways if a wall ever pins it, so it never
// drives into a wall and stops there.

import { IDOL, ROUTE_TO_EXIT, ROUTE_TO_IDOL, STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_WIN, lineOfSightClear } from './world.js';
import { SCREEN_LOSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const WAYPOINT_REACH = 26;
const MAX_WAIT = 1.0;
const STUCK_WINDOW = 0.5;
const STUCK_MOVE = 4;

function angleDifference(a, b) {
  let diff = (a - b) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function createPilot() {
  return {
    routeKind: 'idol',
    index: 0,
    waitLeft: 0,
    lastX: 0,
    lastY: 0,
    stuckTimer: 0,
    detourUntil: 0,
    detourSide: 1,
    elapsed: 0,
  };
}

/** The nearest guard and how far away it is. */
function nearestGuard(state) {
  let best = null;
  let bestDist = Infinity;
  for (const guard of state.guards) {
    const dist = Math.hypot(guard.x - state.player.x, guard.y - state.player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = guard;
    }
  }
  return { guard: best, dist: bestDist };
}

/** True when a guard is close, facing the thief and has a clear look at it. */
function guardAboutToSpot(state) {
  const player = state.player;
  for (const guard of state.guards) {
    const dist = Math.hypot(guard.x - player.x, guard.y - player.y);
    if (dist > 190) continue;
    const angle = Math.atan2(player.y - guard.y, player.x - guard.x);
    if (Math.abs(angleDifference(angle, guard.facing)) > 0.85) continue;
    if (!lineOfSightClear(guard.x, guard.y, player.x, player.y)) continue;
    return true;
  }
  return false;
}

/**
 * The autopilot's move for one step. `pilot` carries its waypoint and
 * wait/stuck state between calls; `dt` is the fixed step.
 */
export function autopilotMove(state, pilot, dt) {
  const player = state.player;
  pilot.elapsed += dt;

  // Pick the route: to the idol until it is taken, then the getaway to the exit.
  const wantKind = state.idolTaken ? 'exit' : 'idol';
  if (wantKind !== pilot.routeKind) {
    pilot.routeKind = wantKind;
    pilot.index = 0;
    pilot.waitLeft = 0;
  }
  const route = wantKind === 'exit' ? ROUTE_TO_EXIT : ROUTE_TO_IDOL;

  // On a chase, run for the exit along the getaway route from the nearest point.
  let target;
  if (state.chasing || state.alarm > 70) {
    let nearestIndex = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < ROUTE_TO_EXIT.length; i += 1) {
      const d = Math.hypot(ROUTE_TO_EXIT[i].x - player.x, ROUTE_TO_EXIT[i].y - player.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIndex = i;
      }
    }
    target = ROUTE_TO_EXIT[Math.min(nearestIndex + 1, ROUTE_TO_EXIT.length - 1)];
    pilot.routeKind = 'exit';
    pilot.index = Math.min(nearestIndex + 1, ROUTE_TO_EXIT.length - 1);
  } else {
    while (pilot.index < route.length) {
      const point = route[pilot.index];
      if (Math.hypot(point.x - player.x, point.y - player.y) < WAYPOINT_REACH) {
        pilot.index += 1;
      } else {
        break;
      }
    }
    target = route[Math.min(pilot.index, route.length - 1)];
  }

  // Wait out a guard whose cone is sweeping onto us — but never while seen,
  // and never longer than MAX_WAIT, so the scene always finishes.
  if (!state.chasing && pilot.waitLeft <= 0 && !state.spotted && guardAboutToSpot(state)) {
    pilot.waitLeft = MAX_WAIT;
  }
  if (pilot.waitLeft > 0) {
    pilot.waitLeft -= dt;
    return { x: 0, y: 0 };
  }

  let dx = target.x - player.x;
  let dy = target.y - player.y;
  const dist = Math.hypot(dx, dy) || 1;
  dx /= dist;
  dy /= dist;

  // Flee: blend a push away from a close guard into the getaway direction.
  if (state.chasing) {
    const near = nearestGuard(state);
    if (near.dist < 130) {
      const ax = (player.x - near.guard.x) / (near.dist || 1);
      const ay = (player.y - near.guard.y) / (near.dist || 1);
      dx += ax * 1.2;
      dy += ay * 1.2;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
    }
  }

  // Stuck detector: barely moved while trying to move — sidestep around it.
  pilot.stuckTimer += dt;
  if (pilot.stuckTimer >= STUCK_WINDOW) {
    const moved = Math.hypot(player.x - pilot.lastX, player.y - pilot.lastY);
    if (moved < STUCK_MOVE && pilot.elapsed > 1) {
      pilot.detourUntil = pilot.elapsed + 0.7;
      pilot.detourSide *= -1;
    }
    pilot.lastX = player.x;
    pilot.lastY = player.y;
    pilot.stuckTimer = 0;
  }
  if (pilot.elapsed < pilot.detourUntil) {
    const px = -dy * pilot.detourSide;
    const py = dx * pilot.detourSide;
    return { x: (dx + px) / Math.SQRT2, y: (dy + py) / Math.SQRT2 };
  }
  return { x: dx, y: dy };
}

/**
 * Set `world` to the named scene ('1'..'4') and return the screen to draw over
 * it and the run time to show. Any other name stages the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  const pilot = createPilot();
  const player = world.state.player;
  pilot.lastX = player.x;
  pilot.lastY = player.y;

  if (name !== '2' && name !== '3' && name !== '4') {
    // Shot 1: the title scene — guards patrol, the thief waits by the door.
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, { x: 0, y: 0 });
    return { screen: SCREEN_TITLE, bestTime: 0 };
  }

  const limit = name === '2' ? 45 : name === '3' ? 70 : 100;
  for (let i = 0; i < limit / STEP; i += 1) {
    const move = autopilotMove(world.state, pilot, STEP);
    const events = world.step(STEP, move);
    if (events & EVENT_CAUGHT) return { screen: SCREEN_LOSE, bestTime: world.state.time };
    if (events & EVENT_WIN) return { screen: SCREEN_WIN, bestTime: world.state.time };
    if (name === '2' && Math.hypot(player.x - IDOL.x, player.y - IDOL.y) < 150) {
      return { screen: SCREEN_PLAY, bestTime: world.state.time };
    }
    if (name === '3' && world.state.idolTaken) {
      return { screen: SCREEN_PLAY, bestTime: world.state.time };
    }
  }
  const won = world.state.status === 'won';
  return { screen: won ? SCREEN_WIN : SCREEN_PLAY, bestTime: world.state.time };
}
