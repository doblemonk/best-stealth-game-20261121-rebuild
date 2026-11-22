# Shadow Vault

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/doblemonk/best-stealth-game-20261121-rebuild/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/doblemonk/best-stealth-game-20261121-rebuild/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

Built for the make.fun "Make the best stealth game" bounty. A complete
top-down stealth game that runs offline in a desktop browser from static
files: no libraries, no network, all art drawn in code, all sounds
synthesised with WebAudio.

## The game

You are a thief in a museum vault at night. Steal the golden idol and
reach the green exit unseen. Three guards — Rook, Bishop and Knight —
patrol the hall with visible vision cones and flashlight beams. Cover
(crates, display cases, pillars) blocks their line of sight, and shadow
zones slow the alarm. Two sweeping security cameras add a second threat:
their beams fill the alarm too. The alarm meter fills while you are
seen and drains while you stay hidden; a full alarm sends every guard
chasing you. Loot is the golden idol plus three gems.

One level on a single 1280x720 screen. Title, pause, win ("CLEAN
GETAWAY") and lose ("CAUGHT") screens, a HUD with the alarm meter,
loot, timer and objective, and a best-time record.

## Controls

- **WASD / arrow keys** — move
- **Mouse click** — walk to that spot
- **R** — restart
- **Space / Enter** — start / confirm
- **P / Esc** — pause

## Files

- `game/index.html` — the game page
- `game/src/config.js` — tuning: speeds, alarm rates, guard patrols
- `game/src/world.js` — the vault layout, guards, cameras, loot
- `game/src/input.js` — keyboard and mouse controls
- `game/src/render.js` — all drawing: vault, cones, beams, HUD
- `game/src/audio.js` — synthesised WebAudio sound effects
- `game/src/shots.js` — scripted screenshot scenes
- `game/src/main.js` — game loop and state machine
- `main.ts` — the make.fun hand-in program (copies the game and
  screenshots to the output directory and writes `dossier.json`)
- `screenshots/` — 1 title/patrol with a camera beam, 2 mid-heist
  dodging a camera beam near the idol, 3 idol secured, 4 CLEAN
  GETAWAY win at the exit

## Play it

Serve the repo root with any static server and open
`game/index.html`, for example:

```sh
python3 -m http.server
# then open http://localhost:8000/game/index.html
```

Or run the hand-in program to build the submission bundle:

```sh
node main.ts
```
