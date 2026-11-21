# Shadow Vault

A complete top-down stealth game that plays offline in a desktop browser from
its own static files — no libraries, no network, no external assets. All art is
drawn in code on canvas; all sounds are tiny synthesised WebAudio beeps.

## The game

You are a thief in a museum vault at night. Steal the golden idol and reach
the green exit unseen.

- **Three guards** — Rook, Bishop and Knight — patrol fixed routes with visible
  vision cones. Learn their patrols and slip through the gaps.
- **Cover** — crates, display cases and pillars block a guard's line of sight.
  **Shadow zones** slow how fast the alarm fills while you hide in them.
- **The alarm meter** fills while a guard can see you and drains while you are
  hidden. A full alarm sends every guard chasing you for a few seconds. If a
  guard touches you, the run is over.
- **Loot** — the golden idol plus three gems scattered around the museum.
  Grabbing the idol changes the objective to the getaway.
- One level on a single 1280×720 screen, with a title screen, pause, win
  ("CLEAN GETAWAY") and lose ("CAUGHT") screens, a HUD (alarm meter, loot,
  timer, objective) and a best-time record kept in the browser.

## Controls

- **WASD / arrow keys** — move
- **Mouse click** — walk to the clicked point (click-to-move)
- **R** — restart the run
- **Space / Enter** — start, or confirm on the win/lose screens
- **P / Esc** — pause

## Files

- `game/index.html` — the page; loads everything from under `game/`
- `game/src/config.js` — tuning numbers, colours and the level layout (walls,
  cover, shadows, patrols, autopilot routes)
- `game/src/world.js` — the rules: movement and collision, line of sight,
  vision cones, the alarm, guard patrol/chase/return AI, pickups, win/lose
- `game/src/input.js` — keyboard plus click-to-move (`poll(player.x, player.y)`)
- `game/src/render.js` — all canvas drawing: floor, walls, cover, cones,
  thief, HUD and screens
- `game/src/audio.js` — synthesised WebAudio beeps (footsteps, pickups, alarm,
  win/lose)
- `game/src/shots.js` — the deterministic screenshot autopilot behind
  `?shot=1..4`, which threads the door gaps and flees from chases
- `game/src/main.js` — boot and the fixed-step game loop
- `main.ts` — the hand-in program (Node 22, standard library only): copies
  `game/` and `screenshots/` to the output directory and writes
  `dossier.json` with `vendor/makefun-game.ts`
- `screenshots/` — 1 title/patrol, 2 mid-heist near the idol, 3 idol secured,
  4 CLEAN GETAWAY win at the exit

## Play it

```sh
python3 -m http.server 8080 --directory game
```

Open http://localhost:8080 in desktop Chrome.

## Screenshots

The autopilot stages each shot from the real rules (`?shot=1` … `?shot=4`,
see `shots.json`), so every screenshot is a genuine render of the game's own
code — no editing, no compositing.

## License

MIT — see `LICENSE`.
