// world.js — rules / simulation for "Shadow Vault", top-down stealth on a
// fixed 1280x720 playfield. Owns the thief, guards, cameras, alarm, loot
// (gems + idol) and exit. Rendering / input live elsewhere; this file only
// simulates and reports events. Angles are radians (0 = east, +y is down).
import { FIELD, STEP, PLAYER, GUARD, ALARM, WALLS, OBSTACLES, SHADOWS, GUARDS, CAMERA, CAMERAS, IDOL, EXIT_ZONE, PLAYER_START, GEMS, ROUTE_TO_IDOL, ROUTE_TO_EXIT } from './config.js';

// Events (bitmask returned by step()).
export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_IDOL = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;
export const EVENT_SPOTTED = 16;
export const EVENT_ALARM = 32;
export { FIELD, GEMS, IDOL, EXIT_ZONE }; // re-exported for convenience

// Field bounds / player size, derived once from config.
const FIELD_LEFT = typeof FIELD.x === 'number' ? FIELD.x : 0;
const FIELD_TOP = typeof FIELD.y === 'number' ? FIELD.y : 0;
const FIELD_WIDTH = typeof FIELD.w === 'number' ? FIELD.w : (typeof FIELD.width === 'number' ? FIELD.width : 1280);
const FIELD_HEIGHT = typeof FIELD.h === 'number' ? FIELD.h : (typeof FIELD.height === 'number' ? FIELD.height : 720);
const FIELD_RIGHT = FIELD_LEFT + FIELD_WIDTH;
const FIELD_BOTTOM = FIELD_TOP + FIELD_HEIGHT;
const PLAYER_RADIUS = typeof PLAYER.radius === 'number' ? PLAYER.radius : (typeof PLAYER.r === 'number' ? PLAYER.r : 16);
const PLAYER_SPEED = typeof PLAYER.speed === 'number' ? PLAYER.speed : 140;
const PICKUP_RADIUS = 26;
// ROUTE_TO_IDOL / ROUTE_TO_EXIT describe the intended thief path (idol,
// then exit) for level / hint systems; the simulation does not steer
// the player along them. STEP is part of the shared config surface.
void ROUTE_TO_IDOL; void ROUTE_TO_EXIT; void STEP;

// --- Small local helpers ---------------------------------------------------
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function distance(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
// Shortest signed difference between two angles, in (-PI, PI].
function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
function circleHitsCircle(x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1, dy = y2 - y1, rr = r1 + r2;
  return dx * dx + dy * dy < rr * rr;
}
// True when a shape is a circle (pillar-style) rather than a rectangle.
function isCircleShape(s) { return typeof s.r === 'number' || typeof s.radius === 'number'; }
function shapeRadius(s) {
  if (typeof s.r === 'number') return s.r;
  if (typeof s.radius === 'number') return s.radius;
  return 0;
}
function shapeRect(s) {
  return {
    x: s.x, y: s.y,
    w: typeof s.w === 'number' ? s.w : (typeof s.width === 'number' ? s.width : 0),
    h: typeof s.h === 'number' ? s.h : (typeof s.height === 'number' ? s.height : 0),
  };
}
function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// --- Circle vs solid geometry ----------------------------------------------
export function circleHitsRect(x, y, r, rect) {
  const rx = typeof rect.x === 'number' ? rect.x : 0;
  const ry = typeof rect.y === 'number' ? rect.y : 0;
  const rw = typeof rect.w === 'number' ? rect.w : (typeof rect.width === 'number' ? rect.width : 0);
  const rh = typeof rect.h === 'number' ? rect.h : (typeof rect.height === 'number' ? rect.height : 0);
  const cx = clamp(x, rx, rx + rw), cy = clamp(y, ry, ry + rh);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy < r * r;
}
// True when a circle overlaps any wall or obstacle.
function circleHitsSolid(x, y, r) {
  for (const wall of WALLS) if (circleHitsRect(x, y, r, wall)) return true;
  for (const o of OBSTACLES) {
    if (isCircleShape(o)) { if (circleHitsCircle(x, y, r, o.x, o.y, shapeRadius(o))) return true; }
    else if (circleHitsRect(x, y, r, o)) return true;
  }
  return false;
}
// Move a circle by (dx, dy), resolving x then y separately so it slides
// along solids instead of stopping dead; also kept inside the field.
function moveCircle(x, y, r, dx, dy) {
  let nx = x, ny = y;
  const tryX = clamp(x + dx, FIELD_LEFT + r, FIELD_RIGHT - r);
  if (!circleHitsSolid(tryX, y, r)) nx = tryX;
  const tryY = clamp(y + dy, FIELD_TOP + r, FIELD_BOTTOM - r);
  if (!circleHitsSolid(nx, tryY, r)) ny = tryY;
  return { x: nx, y: ny };
}

// --- Segment geometry (for line of sight) ----------------------------------
// True when segments (p1,p2) and (p3,p4) cross (including touching).
function segmentsCross(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d1 = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
  const d2 = (x4 - x3) * (y2 - y3) - (y4 - y3) * (x2 - x3);
  const d3 = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const d4 = (x2 - x1) * (y4 - y1) - (y2 - y1) * (x4 - x1);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const onSeg = (px, py, ax, ay, bx, by) =>
    px >= Math.min(ax, bx) && px <= Math.max(ax, bx) && py >= Math.min(ay, by) && py <= Math.max(ay, by);
  return (d1 === 0 && onSeg(x1, y1, x3, y3, x4, y4)) || (d2 === 0 && onSeg(x2, y2, x3, y3, x4, y4)) ||
    (d3 === 0 && onSeg(x3, y3, x1, y1, x2, y2)) || (d4 === 0 && onSeg(x4, y4, x1, y1, x2, y2));
}
// True when a segment touches or crosses an axis-aligned rectangle.
function segmentHitsRect(x1, y1, x2, y2, rect) {
  const r = shapeRect(rect);
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  const l = r.x, ri = r.x + r.w, t = r.y, b = r.y + r.h;
  return segmentsCross(x1, y1, x2, y2, l, t, ri, t) || segmentsCross(x1, y1, x2, y2, ri, t, ri, b) ||
    segmentsCross(x1, y1, x2, y2, ri, b, l, b) || segmentsCross(x1, y1, x2, y2, l, b, l, t);
}
// True when a segment touches or crosses a circle.
function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1, lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) t = clamp(((cx - x1) * dx + (cy - y1) * dy) / lenSq, 0, 1);
  const ox = cx - (x1 + t * dx), oy = cy - (y1 + t * dy);
  return ox * ox + oy * oy < r * r;
}
// True when the segment is not blocked by any wall or obstacle.
// Walls are rectangles; pillars are circles; crates / cases are rectangles.
export function lineOfSightClear(x1, y1, x2, y2) {
  for (const wall of WALLS) if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  for (const o of OBSTACLES) {
    if (isCircleShape(o)) { if (segmentHitsCircle(x1, y1, x2, y2, o.x, o.y, shapeRadius(o))) return false; }
    else if (segmentHitsRect(x1, y1, x2, y2, o)) return false;
  }
  return true;
}

// --- Shadows and vision ------------------------------------------------------
export function pointInShadow(x, y) {
  for (const zone of SHADOWS) {
    if (isCircleShape(zone)) { if (distance(x, y, zone.x, zone.y) <= shapeRadius(zone)) return true; }
    else if (pointInRect(x, y, shapeRect(zone))) return true;
  }
  return false;
}
// True when a guard can see the player: in range, inside the vision cone,
// and with a clear line of sight.
export function guardSeesPlayer(guard, player) {
  if (distance(guard.x, guard.y, player.x, player.y) > GUARD.visionRange) return false;
  const toPlayer = Math.atan2(player.y - guard.y, player.x - guard.x);
  if (Math.abs(angleDifference(toPlayer, guard.angle)) > GUARD.visionHalfAngle) return false;
  return lineOfSightClear(guard.x, guard.y, player.x, player.y);
}
// Same cone test for a camera, using its own range / half-angle.
function cameraSeesPlayer(camera, player) {
  const range = typeof camera.range === 'number' ? camera.range : CAMERA.range;
  const halfAngle = typeof camera.halfAngle === 'number' ? camera.halfAngle : CAMERA.halfAngle;
  if (distance(camera.x, camera.y, player.x, player.y) >= range) return false;
  const toPlayer = Math.atan2(player.y - camera.y, player.x - camera.x);
  if (Math.abs(angleDifference(toPlayer, camera.angle)) > halfAngle) return false;
  return lineOfSightClear(camera.x, camera.y, player.x, player.y);
}
// Move `from` toward `target` by at most `maxStep` px. Returns the new
// position, whether the target was reached, and the facing angle (if moved).
function stepToward(from, target, maxStep) {
  const dx = target.x - from.x, dy = target.y - from.y, dist = Math.hypot(dx, dy);
  if (dist === 0) return { x: from.x, y: from.y, reached: true, angle: null };
  if (dist <= maxStep) return { x: target.x, y: target.y, reached: true, angle: Math.atan2(dy, dx) };
  const s = maxStep / dist;
  return { x: from.x + dx * s, y: from.y + dy * s, reached: false, angle: Math.atan2(dy, dx) };
}

// --- World -------------------------------------------------------------------
export function createWorld() {
  // Chase bookkeeping lives outside `state` (derived timing, not level
  // state); reset() clears it alongside the state.
  let chaseTimer = 0;
  let chasing = false;

  function buildState() {
    const guards = GUARDS.map((def) => {
      const patrol = Array.isArray(def.patrol) && def.patrol.length > 0
        ? def.patrol.map((p) => ({ x: p.x, y: p.y }))
        : [{ x: def.x, y: def.y }];
      let angle = typeof def.angle === 'number' ? def.angle : 0;
      if (patrol.length > 1) angle = Math.atan2(patrol[1].y - patrol[0].y, patrol[1].x - patrol[0].x);
      return {
        name: def.name, x: patrol[0].x, y: patrol[0].y, angle, mode: 'patrol',
        patrol, patrolIndex: patrol.length > 1 ? 1 : 0, patrolDir: 1,
      };
    });
    const cameras = CAMERAS.map((def) => {
      const sweepFrom = typeof def.sweepFrom === 'number' ? def.sweepFrom : 0;
      const sweepTo = typeof def.sweepTo === 'number' ? def.sweepTo : 0;
      return {
        x: def.x, y: def.y, angle: (sweepFrom + sweepTo) / 2,
        sweepFrom, sweepTo,
        range: typeof def.range === 'number' ? def.range : CAMERA.range,
        halfAngle: typeof def.halfAngle === 'number' ? def.halfAngle : CAMERA.halfAngle,
        spotting: false, phase: typeof def.phase === 'number' ? def.phase : 0,
        _mid: (sweepFrom + sweepTo) / 2, _amp: (sweepTo - sweepFrom) / 2,
      };
    });
    return {
      player: { x: PLAYER_START.x, y: PLAYER_START.y },
      guards, cameras,
      alarm: 0, spotted: false, cameraSpotted: false,
      loot: 0, gems: GEMS.map((g) => ({ x: g.x, y: g.y, taken: false })),
      idolTaken: false, time: 0, won: false, caught: false,
    };
  }

  const state = buildState();

  function reset() {
    const fresh = buildState();
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, fresh);
    chaseTimer = 0; chasing = false;
  }

  function step(dt, move) {
    if (state.won || state.caught) return EVENT_NONE;
    const safeDt = Math.max(0, typeof dt === 'number' ? dt : 0);
    if (safeDt === 0) return EVENT_NONE;
    let events = EVENT_NONE;
    state.time += safeDt;

    // Player movement (axis-separated, slides along solids).
    const mx = move && typeof move.x === 'number' ? move.x : 0;
    const my = move && typeof move.y === 'number' ? move.y : 0;
    const moved = moveCircle(state.player.x, state.player.y, PLAYER_RADIUS,
      mx * PLAYER_SPEED * safeDt, my * PLAYER_SPEED * safeDt);
    state.player.x = moved.x; state.player.y = moved.y;

    // Guards.
    const wasSeen = state.spotted || state.cameraSpotted;
    for (const guard of state.guards) {
      if (guard.mode === 'patrol') {
        const result = stepToward(guard, guard.patrol[guard.patrolIndex], GUARD.patrolSpeed * safeDt);
        guard.x = result.x; guard.y = result.y;
        if (result.angle !== null) guard.angle = result.angle;
        if (result.reached) {
          guard.patrolIndex += guard.patrolDir;
          if (guard.patrolIndex >= guard.patrol.length) {
            guard.patrolIndex = Math.max(0, guard.patrol.length - 2); guard.patrolDir = -1;
          } else if (guard.patrolIndex < 0) {
            guard.patrolIndex = Math.min(1, guard.patrol.length - 1); guard.patrolDir = 1;
          }
          if (guard.patrol.length <= 1) { guard.patrolIndex = 0; guard.patrolDir = 1; }
        }
      } else if (guard.mode === 'chase') {
        const result = stepToward(guard, state.player, GUARD.chaseSpeed * safeDt);
        guard.x = result.x; guard.y = result.y;
        if (result.angle !== null) guard.angle = result.angle;
      } else if (guard.mode === 'return') {
        const result = stepToward(guard, guard.patrol[0], GUARD.returnSpeed * safeDt);
        guard.x = result.x; guard.y = result.y;
        if (result.angle !== null) guard.angle = result.angle;
        if (result.reached) {
          guard.mode = 'patrol';
          guard.patrolIndex = guard.patrol.length > 1 ? 1 : 0; guard.patrolDir = 1;
        }
      }
      if (distance(guard.x, guard.y, state.player.x, state.player.y) <= GUARD.catchDistance) {
        state.caught = true; events |= EVENT_CAUGHT;
      }
    }
    if (state.caught) return events;

    // Cameras: smooth sweep (angle = mid + amp * sin(phase)), then cone test.
    for (const camera of state.cameras) {
      camera.phase += CAMERA.sweepSpeed * safeDt;
      camera.angle = camera._mid + camera._amp * Math.sin(camera.phase);
      camera.spotting = cameraSeesPlayer(camera, state.player);
    }

    // Vision + alarm.
    state.spotted = state.guards.some((g) => guardSeesPlayer(g, state.player));
    state.cameraSpotted = state.cameras.some((c) => c.spotting);
    const seen = state.spotted || state.cameraSpotted;
    if (seen && !wasSeen) events |= EVENT_SPOTTED;
    if (chasing) {
      chaseTimer -= safeDt;
      state.alarm = ALARM.chaseAt;
      if (chaseTimer <= 0) {
        chasing = false; chaseTimer = 0; state.alarm = ALARM.chaseSettle;
        for (const guard of state.guards) guard.mode = 'return';
      }
    } else if (seen) {
      let rate = 0;
      if (state.spotted) rate += ALARM.seenRate;
      if (state.cameraSpotted) rate += CAMERA.seenRate;
      if (pointInShadow(state.player.x, state.player.y)) rate *= ALARM.shadowFactor;
      state.alarm = clamp(state.alarm + rate * safeDt, 0, 100);
      if (state.alarm >= ALARM.chaseAt) {
        state.alarm = ALARM.chaseAt; chasing = true; chaseTimer = ALARM.chaseSeconds;
        for (const guard of state.guards) guard.mode = 'chase';
        events |= EVENT_ALARM;
      }
    } else {
      state.alarm = clamp(state.alarm - ALARM.decayRate * safeDt, 0, 100);
    }

    // Pickups: gems within 26 px, then the idol within IDOL.radius.
    for (const gem of state.gems) {
      if (!gem.taken && distance(state.player.x, state.player.y, gem.x, gem.y) <= PICKUP_RADIUS) {
        gem.taken = true; state.loot += 1; events |= EVENT_PICKUP;
      }
    }
    if (!state.idolTaken && distance(state.player.x, state.player.y, IDOL.x, IDOL.y) <= IDOL.radius) {
      state.idolTaken = true; events |= EVENT_IDOL;
    }

    // Win: idol in hand and inside the exit zone.
    if (state.idolTaken && pointInRect(state.player.x, state.player.y, shapeRect(EXIT_ZONE))) {
      state.won = true; events |= EVENT_WIN;
    }
    return events;
  }

  return { state, reset, step };
}
// ---------------------------------------------------------------------------
// Design notes
// ---------------------------------------------------------------------------
//
// Events
// ------
// step() returns a bitmask, so several things can happen in one tick:
// a gem pickup and the idol, or being spotted in the same tick as a
// pickup. Callers should test each bit with (events & EVENT_X) !== 0
// rather than comparing the returned value for equality.
//
// Vision
// ------
// A guard or camera only sees the thief inside its cone and with a
// clear line of sight. Walls, crates and cases block sight as
// rectangles; pillars block it as circles. Shadows do not hide the
// thief outright — they only slow the alarm rise by ALARM.shadowFactor.
//
// Alarm and chase
// ---------------
// The alarm rises only while the thief is seen and decays otherwise.
// Reaching ALARM.chaseAt (100) flips every guard to 'chase' for
// ALARM.chaseSeconds; when that timer expires the guards walk back
// to their patrol start ('return') and the alarm settles to
// ALARM.chaseSettle instead of dropping straight to zero, so a
// second sighting shortly afterwards escalates quickly again.
//
// Movement and collision
// -----------------------
// The player is a circle. Movement is resolved axis by axis (x, then
// y), so pushing diagonally into a wall slides along it instead of
// stopping. Guards are points for movement purposes: they follow
// patrol waypoints and do not collide with walls, which keeps their
// patrols predictable and keeps the simulation cheap.
//
// Reset
// -----
// reset() rebuilds the state in place, so a reference to world.state
// taken before the call stays valid afterwards. The chase timer is
// cleared with it.
// ---------------------------------------------------------------------------
