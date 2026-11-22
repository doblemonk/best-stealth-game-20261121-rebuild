// Shadow Vault — tuning and level definition.
// Top-down stealth on a fixed 1280x720 playfield: three museum rooms
// (left gallery, middle hall, right vault) joined by two door gaps.
// Plain data only: every export is a constant other modules import;
// there are no functions and no imports in this file.

// Playfield size in pixels.
export const FIELD = { width: 1280, height: 720 };

// Fixed simulation step, in seconds (60 ticks per second).
export const STEP = 1 / 60;

// The thief: collision radius and movement speed (px per second).
export const PLAYER = { radius: 14, speed: 205 };

// Guard tuning: radii, movement speeds and vision cone.
export const GUARD = { radius: 14, patrolSpeed: 62, chaseSpeed: 138, returnSpeed: 95, visionRange: 225, visionHalfAngle: 0.61, catchDistance: 28 };

// Alarm meter: how fast being seen fills it, how fast it drains,
// how much shadows slow it, and when it triggers a chase.
export const ALARM = { seenRate: 95, decayRate: 16, shadowFactor: 0.3, chaseAt: 100, chaseSeconds: 5, chaseSettle: 42 };

// Solid walls: block movement and line of sight. Outer shell plus
// two interior walls, each with a single door gap.
export const WALLS = [
  { x: 0, y: 0, w: 1280, h: 24 },
  { x: 0, y: 696, w: 1280, h: 24 },
  { x: 0, y: 0, w: 24, h: 720 },
  { x: 1256, y: 0, w: 24, h: 720 },
  { x: 430, y: 24, w: 24, h: 276 },
  { x: 430, y: 400, w: 24, h: 296 },
  { x: 850, y: 24, w: 24, h: 396 },
  { x: 850, y: 520, w: 24, h: 176 },
];

// Cover: crates and display cases block sight, pillars block sight
// and movement. All pieces stay clear of the autopilot routes and
// clear of the guard patrol lines.
export const OBSTACLES = [
  { kind: 'crate', x: 150, y: 300, w: 64, h: 64 },
  { kind: 'crate', x: 260, y: 470, w: 70, h: 70 },
  { kind: 'crate', x: 500, y: 600, w: 70, h: 60 },
  { kind: 'crate', x: 1150, y: 480, w: 70, h: 70 },
  { kind: 'case', x: 560, y: 200, w: 110, h: 50 },
  { kind: 'case', x: 880, y: 620, w: 120, h: 50 },
  { kind: 'pillar', x: 340, y: 240, r: 24 },
  { kind: 'pillar', x: 700, y: 520, r: 26 },
];

// Shadow zones: standing inside one slows the alarm fill rate.
export const SHADOWS = [
  { x: 130, y: 480, w: 150, h: 96 },
  { x: 560, y: 560, w: 170, h: 96 },
  { x: 940, y: 520, w: 160, h: 96 },
];

// Guard patrols: name, spawn point and the two endpoints they pace
// between. Rook sweeps the middle hall, Bishop the right vault,
// Knight the left gallery.
export const GUARDS = [
  {
    name: 'Rook',
    start: { x: 480, y: 120 },
    patrol: [
      { x: 480, y: 120 },
      { x: 820, y: 120 },
    ],
  },
  {
    name: 'Bishop',
    start: { x: 900, y: 180 },
    patrol: [
      { x: 900, y: 180 },
      { x: 1220, y: 180 },
    ],
  },
  {
    name: 'Knight',
    start: { x: 60, y: 140 },
    patrol: [
      { x: 60, y: 140 },
      { x: 400, y: 140 },
    ],
  },
];

// The golden idol: the heist target in the right vault.
export const IDOL = { x: 1100, y: 600, radius: 34 };

// The exit zone in the top-left corner of the left gallery.
export const EXIT_ZONE = { x: 36, y: 36, w: 110, h: 80 };

// Where the thief starts, in the bottom-left of the left gallery.
export const PLAYER_START = { x: 120, y: 600 };

// Optional pickups: one in each room.
export const GEMS = [
  { x: 200, y: 120 },
  { x: 700, y: 620 },
  { x: 1000, y: 120 },
];

// Autopilot route to the idol: through door gap A (x 430, y 300-400)
// then door gap B (x 850, y 420-520). Every leg is clear of walls
// and cover.
export const ROUTE_TO_IDOL = [
  { x: 120, y: 600 },
  { x: 200, y: 520 },
  { x: 380, y: 350 },
  { x: 470, y: 350 },
  { x: 640, y: 300 },
  { x: 800, y: 470 },
  { x: 900, y: 470 },
  { x: 1010, y: 360 },
  { x: 1060, y: 560 },
  { x: 1100, y: 600 },
];

// Getaway route after grabbing the idol: back through both door gaps
// to the exit zone.
export const ROUTE_TO_EXIT = [
  { x: 1010, y: 560 },
  { x: 900, y: 470 },
  { x: 800, y: 470 },
  { x: 640, y: 350 },
  { x: 470, y: 350 },
  { x: 380, y: 350 },
  { x: 300, y: 250 },
  { x: 150, y: 120 },
  { x: 91, y: 76 },
];

// Security camera tuning: range, cone half-angle, alarm fill rate
// while spotted, and sweep speed (radians per second).
export const CAMERA = { range: 250, halfAngle: 0.30, seenRate: 55, sweepSpeed: 0.8 };

// Wall-mounted sweeping cameras: position plus the angle range the
// beam sweeps between, in radians.
export const CAMERAS = [
  {
    x: 850,
    y: 300,
    sweepFrom: Math.PI - 0.75,
    sweepTo: Math.PI + 0.75,
  },
  {
    x: 1256,
    y: 500,
    sweepFrom: Math.PI - 0.6,
    sweepTo: Math.PI + 0.6,
  },
];

// Wall torches: warm glow points along the top and bottom walls.
export const TORCHES = [
  { x: 120, y: 120 },
  { x: 640, y: 120 },
  { x: 1180, y: 120 },
  { x: 640, y: 640 },
];

// Moody museum-at-night palette, as hex strings.
export const PALETTE = {
  backdrop: '#0a0d13',
  floorA: '#252a3a',
  floorB: '#1d2230',
  floorLine: '#2e3450',
  wall: '#4b5272',
  wallTop: '#60688f',
  crate: '#7a5a33',
  crateEdge: '#a67c44',
  caseGlass: '#7fb8d8',
  caseFrame: '#c8a24a',
  pillar: '#6b7194',
  shadow: '#080a10',
  exit: '#2fbf71',
  exitGlow: '#7dffb0',
  idol: '#f2c94c',
  idolGlow: '#ffe98a',
  gem: '#59d6ff',
  player: '#20242e',
  playerCloak: '#3b4a6b',
  playerTrim: '#f2c94c',
  guard: '#c0392b',
  guardDark: '#7e241a',
  cone: '#ffd75e',
  coneAlert: '#ff5a3c',
  cameraBeam: '#ffb020',
  hudPanel: '#141824',
  text: '#eef1f5',
  muted: '#9aa1b5',
  alarm: '#ff5a3c',
  alarmSafe: '#2fbf71',
};

// UI font stack.
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
