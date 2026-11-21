// Shadow Vault — every tuning number, colour and level shape in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. The museum has three rooms:
// a left gallery, a middle hall and a right vault, joined by two door gaps the
// autopilot's waypoints thread (door A at x 430, y 300-400; door B at x 850, y 420-520).

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 205,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 62,
  chaseSpeed: 138,
  returnSpeed: 95,
  /** How far a guard can see, in pixels. */
  visionRange: 225,
  /** Half of a guard's vision-cone angle, in radians. */
  visionHalfAngle: 0.61,
  /** Touching a guard closer than this ends the run. */
  catchDistance: 28,
};

export const ALARM = {
  /** Alarm points per second while fully seen at point-blank range. */
  seenRate: 95,
  /** Alarm points per second while hidden. */
  decayRate: 16,
  /** In a shadow zone the seen rate is multiplied by this. */
  shadowFactor: 0.3,
  /** Alarm value at which guards break patrol and chase. */
  chaseAt: 100,
  /** Seconds a chase lasts once the alarm is full. */
  chaseSeconds: 5,
  /** Alarm value a chase decays back to. */
  chaseSettle: 42,
};

/** Solid rectangles. Walls block movement and line of sight. */
export const WALLS = [
  // Outer shell.
  { x: 0, y: 0, w: 1280, h: 24 },
  { x: 0, y: 696, w: 1280, h: 24 },
  { x: 0, y: 0, w: 24, h: 720 },
  { x: 1256, y: 0, w: 24, h: 720 },
  // Wall A (left gallery / middle hall): door gap y 300-400.
  { x: 430, y: 24, w: 24, h: 276 },
  { x: 430, y: 400, w: 24, h: 296 },
  // Wall B (middle hall / right vault): door gap y 420-520.
  { x: 850, y: 24, w: 24, h: 396 },
  { x: 850, y: 520, w: 24, h: 176 },
];

/**
 * Cover. Crates and display cases are solid rectangles; pillars are solid circles.
 * Every piece sits at least 60 px from the autopilot's routes so the thief never
 * has to squeeze past one, and clear of every guard patrol line.
 */
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

/** Shadow zones: standing in one slows how fast the alarm fills. */
export const SHADOWS = [
  { x: 130, y: 480, w: 150, h: 96 },
  { x: 560, y: 560, w: 170, h: 96 },
  { x: 940, y: 520, w: 160, h: 96 },
];

/** Guard patrols: each guard walks its points back and forth. */
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

export const IDOL = { x: 1100, y: 600, radius: 34 };
export const EXIT_ZONE = { x: 36, y: 36, w: 110, h: 80 };
export const PLAYER_START = { x: 120, y: 600 };

/** Small loot scattered around the museum; each is worth one loot point. */
export const GEMS = [
  { x: 200, y: 120 },
  { x: 700, y: 620 },
  { x: 1000, y: 120 },
];

/**
 * The autopilot's route to the idol, threading door gap A (430, y 300-400)
 * then door gap B (850, y 420-520). Every leg stays clear of walls and cover.
 */
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

/**
 * The getaway route after the idol is taken: back through door gap B, then
 * door gap A, then up the left gallery to the green exit door.
 */
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

export const PALETTE = {
  backdrop: '#0b0e14',
  floorA: '#232838',
  floorB: '#1e2333',
  floorLine: '#2b3049',
  wall: '#4a5170',
  wallTop: '#5d6488',
  crate: '#7a5a33',
  crateEdge: '#a67c44',
  caseGlass: '#7fb8d8',
  caseFrame: '#c8a24a',
  pillar: '#6b7194',
  shadow: '#0a0c12',
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
  hudPanel: '#141824',
  text: '#eef1f5',
  muted: '#9aa1b5',
  alarm: '#ff5a3c',
  alarmSafe: '#2fbf71',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
