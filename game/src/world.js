// Shadow Vault — the rules. No DOM here: pure state, so the screenshot autopilot
// (shots.js) and a headless test can drive it with fixed steps.
//
// A run: steal the golden idol in the right vault, grab what gems you can, and
// reach the green exit unseen. Guards patrol fixed routes with vision cones.
// Cover (walls, crates, cases, pillars) blocks their line of sight; shadow zones
// slow the alarm. A full alarm sends every guard chasing for a few seconds.
// A guard touching the thief ends the run.

import {
  ALARM,
  EXIT_ZONE,
  FIELD,
  GEMS,
  GUARD,
  GUARDS,
  IDOL,
  OBSTACLES,
  PLAYER,
  PLAYER_START,
  SHADOWS,
  WALLS,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_IDOL = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;
export const EVENT_SPOTTED = 16;
export const EVENT_ALARM = 32;

const TWO_PI = Math.PI * 2;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** True when the circle at (x, y) with radius r overlaps the rectangle. */
export function circleHitsRect(x, y, r, rect) {
  const cx = clamp(x, rect.x, rect.x + rect.w);
  const cy = clamp(y, rect.y, rect.y + rect.h);
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r;
}

function circleHitsCircle(x, y, r, circle) {
  return distance(x, y, circle.x, circle.y) < r + circle.r;
}

function circleHitsSolid(x, y, r) {
  for (const wall of WALLS) {
    if (circleHitsRect(x, y, r, wall)) return true;
  }
  for (const obstacle of OBSTACLES) {
    if (obstacle.kind === 'pillar') {
      if (circleHitsCircle(x, y, r, obstacle)) return true;
    } else if (circleHitsRect(x, y, r, obstacle)) {
      return true;
    }
  }
  return false;
}

/** Move a circle one axis at a time so it slides along walls instead of sticking. */
function moveCircle(body, dx, dy) {
  if (dx !== 0 && !circleHitsSolid(body.x + dx, body.y, body.radius)) body.x += dx;
  if (dy !== 0 && !circleHitsSolid(body.x, body.y + dy, body.radius)) body.y += dy;
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function segmentHitsRect(x1, y1, x2, y2, rect) {
  if (x1 >= rect.x && x1 <= rect.x + rect.w && y1 >= rect.y && y1 <= rect.y + rect.h) return true;
  if (x2 >= rect.x && x2 <= rect.x + rect.w && y2 >= rect.y && y2 <= rect.y + rect.h) return true;
  const rx = rect.x;
  const ry = rect.y;
  const rw = rect.x + rect.w;
  const rh = rect.y + rect.h;
  return (
    segmentsCross(x1, y1, x2, y2, rx, ry, rw, ry) ||
    segmentsCross(x1, y1, x2, y2, rw, ry, rw, rh) ||
    segmentsCross(x1, y1, x2, y2, rw, rh, rx, rh) ||
    segmentsCross(x1, y1, x2, y2, rx, rh, rx, ry)
  );
}

function segmentHitsCircle(x1, y1, x2, y2, circle) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((circle.x - x1) * dx + (circle.y - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t;
  const py = y1 + dy * t;
  return distance(px, py, circle.x, circle.y) < circle.r;
}

/** True when nothing solid stands between the two points. */
export function lineOfSightClear(x1, y1, x2, y2) {
  for (const wall of WALLS) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  }
  for (const obstacle of OBSTACLES) {
    if (obstacle.kind === 'pillar') {
      if (segmentHitsCircle(x1, y1, x2, y2, obstacle)) return false;
    } else if (segmentHitsRect(x1, y1, x2, y2, obstacle)) {
      return false;
    }
  }
  return true;
}

export function pointInShadow(x, y) {
  for (const shadow of SHADOWS) {
    if (x >= shadow.x && x <= shadow.x + shadow.w && y >= shadow.y && y <= shadow.y + shadow.h) {
      return true;
    }
  }
  return false;
}

function angleDifference(a, b) {
  let diff = (a - b) % TWO_PI;
  if (diff > Math.PI) diff -= TWO_PI;
  if (diff < -Math.PI) diff += TWO_PI;
  return diff;
}

/** Can this guard see the thief right now? Distance, cone angle and cover all count. */
export function guardSeesPlayer(guard, player) {
  const dist = distance(guard.x, guard.y, player.x, player.y);
  const range = pointInShadow(player.x, player.y) ? GUARD.visionRange * 0.62 : GUARD.visionRange;
  if (dist > range) return { seen: false, dist };
  const angle = Math.atan2(player.y - guard.y, player.x - guard.x);
  if (Math.abs(angleDifference(angle, guard.facing)) > GUARD.visionHalfAngle && dist > 46) {
    return { seen: false, dist };
  }
  if (!lineOfSightClear(guard.x, guard.y, player.x, player.y)) return { seen: false, dist };
  return { seen: true, dist };
}

function freshGuard(def) {
  return {
    name: def.name,
    x: def.start.x,
    y: def.start.y,
    radius: GUARD.radius,
    facing: 0,
    patrol: def.patrol,
    patrolIndex: 1,
    patrolForward: true,
    mode: 'patrol',
    chaseTimer: 0,
  };
}

export function createWorld() {
  const state = {
    player: { x: PLAYER_START.x, y: PLAYER_START.y, radius: PLAYER.radius },
    guards: GUARDS.map(freshGuard),
    alarm: 0,
    chasing: false,
    loot: 0,
    idolTaken: false,
    gemsTaken: GEMS.map(() => false),
    time: 0,
    status: 'play',
    spotted: false,
    /** Seconds the thief has been continuously seen; drives the alarm beep. */
    seenTime: 0,
  };

  function reset() {
    state.player.x = PLAYER_START.x;
    state.player.y = PLAYER_START.y;
    state.guards = GUARDS.map(freshGuard);
    state.alarm = 0;
    state.chasing = false;
    state.loot = 0;
    state.idolTaken = false;
    state.gemsTaken = GEMS.map(() => false);
    state.time = 0;
    state.status = 'play';
    state.spotted = false;
    state.seenTime = 0;
  }

  function stepGuard(guard, dt, player) {
    if (guard.mode === 'chase') {
      guard.chaseTimer -= dt;
      const dx = player.x - guard.x;
      const dy = player.y - guard.y;
      const dist = Math.hypot(dx, dy) || 1;
      guard.facing = Math.atan2(dy, dx);
      moveCircle(guard, (dx / dist) * GUARD.chaseSpeed * dt, (dy / dist) * GUARD.chaseSpeed * dt);
      if (guard.chaseTimer <= 0) {
        guard.mode = 'return';
      }
      return;
    }
    if (guard.mode === 'return') {
      // Walk back to the nearest patrol point, then resume the route.
      let best = guard.patrol[0];
      let bestDist = Infinity;
      for (const point of guard.patrol) {
        const d = distance(guard.x, guard.y, point.x, point.y);
        if (d < bestDist) {
          bestDist = d;
          best = point;
        }
      }
      const dx = best.x - guard.x;
      const dy = best.y - guard.y;
      if (bestDist < 8) {
        guard.mode = 'patrol';
        guard.patrolIndex = guard.patrol.indexOf(best) === 0 ? 1 : 0;
        return;
      }
      guard.facing = Math.atan2(dy, dx);
      moveCircle(guard, (dx / bestDist) * GUARD.returnSpeed * dt, (dy / bestDist) * GUARD.returnSpeed * dt);
      return;
    }
    const target = guard.patrol[guard.patrolIndex];
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      if (guard.patrolForward) {
        guard.patrolIndex += 1;
        if (guard.patrolIndex >= guard.patrol.length) {
          guard.patrolIndex = guard.patrol.length - 2;
          guard.patrolForward = false;
        }
      } else {
        guard.patrolIndex -= 1;
        if (guard.patrolIndex < 0) {
          guard.patrolIndex = 1;
          guard.patrolForward = true;
        }
      }
      return;
    }
    guard.facing = Math.atan2(dy, dx);
    moveCircle(guard, (dx / dist) * GUARD.patrolSpeed * dt, (dy / dist) * GUARD.patrolSpeed * dt);
  }

  /**
   * Advance the world one fixed step. `move` is the thief's intended direction
   * ({x, y}, each -1..1, already normalised by the caller). Returns event flags.
   */
  function step(dt, move) {
    if (state.status !== 'play') return EVENT_NONE;
    let events = EVENT_NONE;
    state.time += dt;

    const len = Math.hypot(move.x, move.y) || 1;
    const nx = Math.abs(move.x) + Math.abs(move.y) > 0.01 ? move.x / len : 0;
    const ny = Math.abs(move.x) + Math.abs(move.y) > 0.01 ? move.y / len : 0;
    moveCircle(state.player, nx * PLAYER.speed * dt, ny * PLAYER.speed * dt);

    // Pickups.
    for (let i = 0; i < GEMS.length; i += 1) {
      if (!state.gemsTaken[i] && distance(state.player.x, state.player.y, GEMS[i].x, GEMS[i].y) < 32) {
        state.gemsTaken[i] = true;
        state.loot += 1;
        events |= EVENT_PICKUP;
      }
    }
    if (!state.idolTaken && distance(state.player.x, state.player.y, IDOL.x, IDOL.y) < IDOL.radius + 6) {
      state.idolTaken = true;
      state.loot += 1;
      events |= EVENT_IDOL;
    }

    // Vision and the alarm.
    let seen = false;
    let nearestSeen = Infinity;
    for (const guard of state.guards) {
      const result = guardSeesPlayer(guard, state.player);
      if (result.seen) {
        seen = true;
        nearestSeen = Math.min(nearestSeen, result.dist);
      }
    }
    state.spotted = seen;
    if (seen) {
      state.seenTime += dt;
      const closeness = 1 - nearestSeen / GUARD.visionRange;
      let rate = ALARM.seenRate * (0.35 + 0.65 * closeness);
      if (pointInShadow(state.player.x, state.player.y)) rate *= ALARM.shadowFactor;
      state.alarm = Math.min(ALARM.chaseAt, state.alarm + rate * dt);
      events |= EVENT_SPOTTED;
    } else {
      state.seenTime = 0;
      state.alarm = Math.max(0, state.alarm - ALARM.decayRate * dt);
    }
    if (state.alarm >= ALARM.chaseAt && !state.chasing) {
      state.chasing = true;
      events |= EVENT_ALARM;
      for (const guard of state.guards) {
        guard.mode = 'chase';
        guard.chaseTimer = ALARM.chaseSeconds;
      }
    }
    if (state.chasing) {
      const anyChasing = state.guards.some((guard) => guard.mode === 'chase');
      if (!anyChasing) {
        state.chasing = false;
        state.alarm = Math.min(state.alarm, ALARM.chaseSettle);
      }
    }

    for (const guard of state.guards) stepGuard(guard, dt, state.player);

    // Caught on contact.
    for (const guard of state.guards) {
      if (distance(guard.x, guard.y, state.player.x, state.player.y) < GUARD.catchDistance) {
        state.status = 'caught';
        return events | EVENT_CAUGHT;
      }
    }

    // The win: idol in hand and standing in the green exit.
    if (
      state.idolTaken &&
      state.player.x >= EXIT_ZONE.x &&
      state.player.x <= EXIT_ZONE.x + EXIT_ZONE.w &&
      state.player.y >= EXIT_ZONE.y &&
      state.player.y <= EXIT_ZONE.y + EXIT_ZONE.h
    ) {
      state.status = 'won';
      return events | EVENT_WIN;
    }
    return events;
  }

  return { state, reset, step };
}

export { FIELD, GEMS, IDOL, EXIT_ZONE };
