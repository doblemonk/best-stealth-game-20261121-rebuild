// Shadow Vault — everything drawn on canvas, in code. The museum floor, walls,
// cover, shadow pools, the golden idol, the green exit, the guards with their
// vision cones, the hooded thief, the HUD and the title/win/lose screens.
// The canvas backing store is always 1280x720; CSS scales it to the window.

import {
  EXIT_ZONE,
  FIELD,
  GEMS,
  GUARD,
  IDOL,
  OBSTACLES,
  PALETTE,
  FONT,
  SHADOWS,
  WALLS,
} from './config.js';
import { pointInShadow } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  function drawFloor() {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const tile = 80;
    for (let y = 24; y < 696; y += tile) {
      for (let x = 24; x < 1256; x += tile) {
        ctx.fillStyle = ((x + y) / tile) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x, y, tile, tile);
      }
    }
    ctx.strokeStyle = PALETTE.floorLine;
    ctx.lineWidth = 1;
    for (let x = 24; x <= 1256; x += tile) {
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x, 696);
      ctx.stroke();
    }
    for (let y = 24; y <= 696; y += tile) {
      ctx.beginPath();
      ctx.moveTo(24, y);
      ctx.lineTo(1256, y);
      ctx.stroke();
    }
    // Room labels, painted on the floor like museum signage.
    ctx.fillStyle = 'rgba(238,241,245,0.16)';
    ctx.font = `600 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('GALLERY', 227, 70);
    ctx.fillText('GREAT HALL', 652, 70);
    ctx.fillText('THE VAULT', 1053, 70);
  }

  function drawShadows() {
    for (const shadow of SHADOWS) {
      ctx.fillStyle = PALETTE.shadow;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(shadow.x, shadow.y, shadow.w, shadow.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(127,184,216,0.35)';
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(shadow.x + 1, shadow.y + 1, shadow.w - 2, shadow.h - 2);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(154,161,181,0.8)';
      ctx.font = `600 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SHADOW', shadow.x + shadow.w / 2, shadow.y + shadow.h - 10);
    }
  }

  function drawExit() {
    const pulse = 0.75 + 0.25 * Math.sin(Date.now() / 350);
    ctx.save();
    ctx.shadowColor = PALETTE.exitGlow;
    ctx.shadowBlur = 18 * pulse;
    ctx.fillStyle = PALETTE.exit;
    ctx.fillRect(EXIT_ZONE.x, EXIT_ZONE.y, EXIT_ZONE.w, EXIT_ZONE.h);
    ctx.restore();
    ctx.strokeStyle = PALETTE.exitGlow;
    ctx.lineWidth = 3;
    ctx.strokeRect(EXIT_ZONE.x + 2, EXIT_ZONE.y + 2, EXIT_ZONE.w - 4, EXIT_ZONE.h - 4);
    ctx.fillStyle = '#062b16';
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', EXIT_ZONE.x + EXIT_ZONE.w / 2, EXIT_ZONE.y + 34);
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('get out unseen', EXIT_ZONE.x + EXIT_ZONE.w / 2, EXIT_ZONE.y + 58);
  }

  function drawIdol(state) {
    if (state.idolTaken) return;
    const glow = 0.7 + 0.3 * Math.sin(Date.now() / 300);
    ctx.save();
    ctx.shadowColor = PALETTE.idolGlow;
    ctx.shadowBlur = 22 * glow;
    // Pedestal.
    ctx.fillStyle = '#3a3f58';
    ctx.beginPath();
    ctx.arc(IDOL.x, IDOL.y, IDOL.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.caseFrame;
    ctx.lineWidth = 3;
    ctx.stroke();
    // The golden idol: a little winged figure.
    ctx.fillStyle = PALETTE.idol;
    ctx.beginPath();
    ctx.arc(IDOL.x, IDOL.y - 6, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(IDOL.x - 16, IDOL.y + 2);
    ctx.lineTo(IDOL.x - 4, IDOL.y - 2);
    ctx.lineTo(IDOL.x - 14, IDOL.y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(IDOL.x + 16, IDOL.y + 2);
    ctx.lineTo(IDOL.x + 4, IDOL.y - 2);
    ctx.lineTo(IDOL.x + 14, IDOL.y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(IDOL.x - 5, IDOL.y + 2, 10, 14);
    ctx.restore();
    ctx.fillStyle = PALETTE.idolGlow;
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('THE GOLDEN IDOL', IDOL.x, IDOL.y - IDOL.radius - 8);
  }

  function drawGems(state) {
    for (let i = 0; i < GEMS.length; i += 1) {
      if (state.gemsTaken[i]) continue;
      const gem = GEMS[i];
      ctx.save();
      ctx.shadowColor = PALETTE.gem;
      ctx.shadowBlur = 10;
      ctx.fillStyle = PALETTE.gem;
      ctx.beginPath();
      ctx.moveTo(gem.x, gem.y - 10);
      ctx.lineTo(gem.x + 8, gem.y);
      ctx.lineTo(gem.x, gem.y + 10);
      ctx.lineTo(gem.x - 8, gem.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawObstacles() {
    for (const obstacle of OBSTACLES) {
      if (obstacle.kind === 'pillar') {
        ctx.fillStyle = PALETTE.pillar;
        ctx.beginPath();
        ctx.arc(obstacle.x, obstacle.y, obstacle.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.arc(obstacle.x - 6, obstacle.y - 6, obstacle.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      if (obstacle.kind === 'crate') {
        ctx.fillStyle = PALETTE.crate;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
        ctx.strokeStyle = PALETTE.crateEdge;
        ctx.lineWidth = 3;
        ctx.strokeRect(obstacle.x + 2, obstacle.y + 2, obstacle.w - 4, obstacle.h - 4);
        ctx.beginPath();
        ctx.moveTo(obstacle.x, obstacle.y);
        ctx.lineTo(obstacle.x + obstacle.w, obstacle.y + obstacle.h);
        ctx.moveTo(obstacle.x + obstacle.w, obstacle.y);
        ctx.lineTo(obstacle.x, obstacle.y + obstacle.h);
        ctx.stroke();
        continue;
      }
      // Display case: brass frame, glass top, something glinting inside.
      ctx.fillStyle = PALETTE.caseFrame;
      ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
      ctx.fillStyle = 'rgba(127,184,216,0.45)';
      ctx.fillRect(obstacle.x + 6, obstacle.y + 6, obstacle.w - 12, obstacle.h - 12);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(obstacle.x + 10, obstacle.y + obstacle.h - 8);
      ctx.lineTo(obstacle.x + obstacle.w / 2, obstacle.y + 8);
      ctx.stroke();
    }
  }

  function drawWalls() {
    for (const wall of WALLS) {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = PALETTE.wallTop;
      if (wall.h <= 24) ctx.fillRect(wall.x, wall.y, wall.w, 5);
      else ctx.fillRect(wall.x, wall.y, 5, wall.h);
    }
    // Door frames glow faintly so the gaps read as doors, not holes.
    ctx.fillStyle = 'rgba(200,162,74,0.9)';
    ctx.fillRect(430, 296, 24, 8);
    ctx.fillRect(430, 396, 24, 8);
    ctx.fillRect(850, 416, 24, 8);
    ctx.fillRect(850, 516, 24, 8);
  }

  function drawCone(guard, alert) {
    const range = GUARD.visionRange;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.arc(guard.x, guard.y, range, guard.facing - GUARD.visionHalfAngle, guard.facing + GUARD.visionHalfAngle);
    ctx.closePath();
    ctx.fillStyle = alert ? 'rgba(255,90,60,0.30)' : 'rgba(255,215,94,0.22)';
    ctx.fill();
    ctx.restore();
  }

  function drawGuard(guard, alert) {
    drawCone(guard, alert);
    ctx.save();
    ctx.shadowColor = alert ? '#ff5a3c' : '#ffd75e';
    ctx.shadowBlur = alert ? 14 : 6;
    ctx.fillStyle = alert ? PALETTE.guard : PALETTE.guardDark;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#ffd75e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
    ctx.stroke();
    // Facing tick and a little helmet brim.
    ctx.strokeStyle = '#eef1f5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * (guard.radius + 8), guard.y + Math.sin(guard.facing) * (guard.radius + 8));
    ctx.stroke();
    ctx.fillStyle = '#eef1f5';
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(guard.name.toUpperCase(), guard.x, guard.y - guard.radius - 6);
  }

  function drawPlayer(player, inShadow) {
    ctx.save();
    if (inShadow) {
      ctx.globalAlpha = 0.75;
    }
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 8;
    // Hooded cloak.
    ctx.fillStyle = PALETTE.playerCloak;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius - 5, 0, Math.PI * 2);
    ctx.fill();
    // Gold trim and eyes, so the thief reads against the dark floor.
    ctx.strokeStyle = PALETTE.playerTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe98a';
    ctx.beginPath();
    ctx.arc(player.x - 4, player.y - 2, 2, 0, Math.PI * 2);
    ctx.arc(player.x + 4, player.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHud(state, screen) {
    ctx.fillStyle = 'rgba(20,24,36,0.92)';
    ctx.fillRect(0, 0, FIELD.width, 0);
    const barX = 470;
    const barY = 8;
    const barW = 340;
    const barH = 18;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(0, 0, FIELD.width, 34);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('SHADOW VAULT', 14, 22);
    // Alarm meter.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText('ALARM', barX - 58, 21);
    ctx.fillStyle = '#000';
    ctx.fillRect(barX, barY, barW, barH);
    const frac = state.alarm / 100;
    ctx.fillStyle = frac > 0.66 ? PALETTE.alarm : frac > 0.33 ? '#ffb02e' : PALETTE.alarmSafe;
    ctx.fillRect(barX, barY, Math.max(0, barW * frac), barH);
    ctx.strokeStyle = '#eef1f5';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    if (state.chasing) {
      ctx.fillStyle = PALETTE.alarm;
      ctx.font = `700 13px ${FONT}`;
      ctx.fillText('! CHASE !', barX + barW + 10, 21);
    } else if (state.spotted) {
      ctx.fillStyle = '#ffb02e';
      ctx.font = `700 13px ${FONT}`;
      ctx.fillText('SPOTTED', barX + barW + 10, 21);
    }
    // Loot, timer, objective.
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 14px ${FONT}`;
    ctx.textAlign = 'right';
    const lootText = `LOOT ${state.loot}/4  ${state.idolTaken ? 'IDOL ✓' : 'IDOL ✗'}`;
    ctx.fillText(lootText, 1050, 22);
    // The title screen runs an attract mode behind the overlay; show 0:00 there.
    ctx.fillText(formatTime(screen === SCREEN_TITLE ? 0 : state.time), 1140, 22);
    // Objective as a small pill on the bottom wall, out of the playfield.
    if (screen !== SCREEN_TITLE) {
      const objective = state.idolTaken
        ? 'Objective: reach the green EXIT'
        : 'Objective: steal the golden idol';
      ctx.font = `600 13px ${FONT}`;
      const w = ctx.measureText(objective).width + 24;
      ctx.fillStyle = 'rgba(20,24,36,0.92)';
      ctx.fillRect(FIELD.width / 2 - w / 2, 694, w, 24);
      ctx.fillStyle = PALETTE.muted;
      ctx.textAlign = 'center';
      ctx.fillText(objective, FIELD.width / 2, 711);
    }
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(5,7,12,0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = accent;
    ctx.font = `800 64px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, FIELD.width / 2, 300);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `400 21px ${FONT}`;
    lines.forEach((line, index) => {
      ctx.fillText(line, FIELD.width / 2, 350 + index * 34);
    });
  }

  function draw(state, screen, best) {
    drawFloor();
    drawShadows();
    drawExit();
    drawIdol(state);
    drawGems(state);
    drawObstacles();
    drawWalls();
    for (const guard of state.guards) drawGuard(guard, state.chasing || state.spotted);
    drawPlayer(state.player, pointInShadow(state.player.x, state.player.y));
    drawHud(state, screen);
    if (screen === SCREEN_TITLE) {
      overlay('SHADOW VAULT', [
        'A thief. A museum at night. One golden idol.',
        'Slip past the guards — their yellow cones are their eyes.',
        'Crates and cases block their sight. Shadows slow the alarm.',
        'Steal the idol, then reach the green EXIT unseen.',
        '',
        'Move: WASD / arrows, or click where to walk.  R: restart.  P: pause.',
        'Press Space or click to begin.',
      ], PALETTE.idol);
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Press P or Space to keep sneaking.'], PALETTE.text);
    } else if (screen === SCREEN_WIN) {
      overlay('CLEAN GETAWAY', [
        `The idol is yours. Loot ${state.loot}/4 in ${formatTime(state.time)}.`,
        `Best time ${best === null ? '—' : formatTime(best)}.`,
        'Press R or Space to steal again.',
      ], PALETTE.exitGlow);
    } else if (screen === SCREEN_LOSE) {
      overlay('CAUGHT', [
        'A guard got a hand on your cloak. The vault keeps its idol.',
        `Loot ${state.loot}/4 · ${formatTime(state.time)}`,
        'Press R or Space to try again.',
      ], PALETTE.alarm);
    }
  }

  return { draw };
}
