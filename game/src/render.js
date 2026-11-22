// Shadow Vault — renderer.
// All art is drawn in code on a 2D canvas: no libraries, no images, no network.
// Logical game size is 1280x720; the canvas is letterboxed and scaled to fit,
// with the backing store scaled for devicePixelRatio (capped at 2).

import {
  FIELD, WALLS, OBSTACLES, SHADOWS, TORCHES,
  IDOL, EXIT_ZONE, GEMS, PALETTE, FONT,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

const LOGICAL_W = 1280;
const LOGICAL_H = 720;

// Palette defaults; anything config provides wins.
const P = {
  backdrop: '#04060d',
  floorA: '#1c2436',
  floorB: '#151c2b',
  grid: 'rgba(255,255,255,0.045)',
  rug: '#2a2118',
  rugTrim: '#c9a227',
  wall: '#232c42',
  wallTop: '#3a4767',
  wallLine: 'rgba(0,0,0,0.25)',
  crate: '#7a5230',
  crateEdge: '#4a2f1a',
  caseGlass: 'rgba(150,200,255,0.16)',
  caseFrame: '#c9a227',
  pillar: '#5a6478',
  pillarRim: '#333c4e',
  shadow: 'rgba(2,4,10,0.72)',
  gold: '#ffd75e',
  exit: '#1fae5f',
  exitGlow: 'rgba(60,255,140,0.35)',
  ...(PALETTE || {}),
};

const F = FONT || 'Arial, sans-serif';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function fmtTime(t) {
  if (t == null || !isFinite(t)) return '0:00.0';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
}

function rr(ctx, x, y, w, h, r) {
  // Rounded-rect path (works even where ctx.roundRect is unavailable).
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function wedge(ctx, x, y, angle, range, halfAngle) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
}

function cone(ctx, x, y, angle, range, halfAngle, fill) {
  wedge(ctx, x, y, angle, range, halfAngle);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;

  function resize() {
    const w = canvas.clientWidth || LOGICAL_W;
    const h = canvas.clientHeight || LOGICAL_H;
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w !== cssW || h !== cssH || nextDpr !== dpr) {
      cssW = w;
      cssH = h;
      dpr = nextDpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
  }

  // ---- world pieces -------------------------------------------------------

  function drawFloor() {
    const fx = FIELD.x ?? 0;
    const fy = FIELD.y ?? 0;
    const fw = FIELD.w ?? FIELD.width ?? LOGICAL_W;
    const fh = FIELD.h ?? FIELD.height ?? LOGICAL_H;
    const tile = 64;

    ctx.fillStyle = P.floorB;
    ctx.fillRect(fx, fy, fw, fh);

    for (let ty = 0; ty * tile < fh; ty++) {
      for (let tx = 0; tx * tile < fw; tx++) {
        if ((tx + ty) % 2 === 0) {
          ctx.fillStyle = P.floorA;
          ctx.fillRect(fx + tx * tile, fy + ty * tile, tile, tile);
        }
      }
    }

    // Subtle grid lines.
    ctx.strokeStyle = P.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = fx; x <= fx + fw; x += tile) {
      ctx.moveTo(x + 0.5, fy);
      ctx.lineTo(x + 0.5, fy + fh);
    }
    for (let y = fy; y <= fy + fh; y += tile) {
      ctx.moveTo(fx, y + 0.5);
      ctx.lineTo(fx + fw, y + 0.5);
    }
    ctx.stroke();

    // Faint dust speckles.
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 90; i++) {
      const sx = fx + ((i * 137.5) % fw);
      const sy = fy + ((i * 89.3) % fh);
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Ornate rug in the middle hall: concentric gold-trimmed rectangles.
    const rx = fx + fw / 2 - 260;
    const ry = fy + fh / 2 - 150;
    const rw = 520;
    const rh = 300;
    ctx.fillStyle = P.rug;
    rr(ctx, rx, ry, rw, rh, 10);
    ctx.fill();
    ctx.strokeStyle = P.rugTrim;
    ctx.lineWidth = 3;
    rr(ctx, rx + 10, ry + 10, rw - 20, rh - 20, 8);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(201,162,39,0.55)';
    rr(ctx, rx + 26, ry + 26, rw - 52, rh - 52, 6);
    ctx.stroke();
    rr(ctx, rx + 44, ry + 44, rw - 88, rh - 88, 4);
    ctx.stroke();
    // Rug centre motif.
    ctx.save();
    ctx.translate(fx + fw / 2, fy + fh / 2);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = 'rgba(201,162,39,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-26, -26, 52, 52);
    ctx.restore();
  }

  function drawShadows() {
    for (const s of SHADOWS || []) {
      ctx.save();
      if (s.r != null) {
        const g = ctx.createRadialGradient(s.x, s.y, s.r * 0.2, s.x, s.y, s.r);
        g.addColorStop(0, P.shadow);
        g.addColorStop(1, 'rgba(2,4,10,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Soft edge: draw a faint halo, then the dark core.
        ctx.fillStyle = 'rgba(2,4,10,0.28)';
        rr(ctx, (s.x ?? 0) - 8, (s.y ?? 0) - 8, (s.w ?? 0) + 16, (s.h ?? 0) + 16, 22);
        ctx.fill();
        ctx.fillStyle = P.shadow;
        rr(ctx, s.x ?? 0, s.y ?? 0, s.w ?? 0, s.h ?? 0, 16);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawExit() {
    const z = EXIT_ZONE || { x: 0, y: 0, w: 80, h: 80 };
    const cx = (z.x ?? 0) + (z.w ?? 80) / 2;
    const cy = (z.y ?? 0) + (z.h ?? 80) / 2;

    const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.max(z.w ?? 80, z.h ?? 80));
    glow.addColorStop(0, P.exitGlow);
    glow.addColorStop(1, 'rgba(60,255,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 90, cy - 90, 180, 180);

    ctx.fillStyle = P.exit;
    rr(ctx, z.x ?? 0, z.y ?? 0, z.w ?? 80, z.h ?? 80, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    rr(ctx, (z.x ?? 0) + 4, (z.y ?? 0) + 4, (z.w ?? 80) - 8, (z.h ?? 80) - 8, 4);
    ctx.stroke();

    // Door slats.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, z.y ?? 0);
    ctx.lineTo(cx, (z.y ?? 0) + (z.h ?? 80));
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px ' + F;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('EXIT', cx, (z.y ?? 0) - 10);
  }

  function drawGem(x, y, t) {
    const bob = Math.sin(t * 2.4 + x * 0.05) * 2;
    const gy = y + bob;
    const sparkle = 0.6 + 0.4 * Math.sin(t * 4 + x);
    ctx.save();
    ctx.translate(x, gy);
    ctx.shadowColor = '#39d5ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#39d5ff';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3, 0);
    ctx.lineTo(0, 5);
    ctx.lineTo(-3, 0);
    ctx.closePath();
    ctx.fill();
    // Sparkle cross.
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * sparkle).toFixed(2) + ')';
    ctx.lineWidth = 1.5;
    const s = 5 + 4 * sparkle;
    ctx.beginPath();
    ctx.moveTo(-s, -s);
    ctx.lineTo(s, s);
    ctx.moveTo(s, -s);
    ctx.lineTo(-s, s);
    ctx.stroke();
    ctx.restore();
  }

  function drawIdol(t) {
    const ix = IDOL.x ?? LOGICAL_W / 2;
    const iy = IDOL.y ?? LOGICAL_H / 2;
    const pulse = 0.75 + 0.25 * Math.sin(t * 3);

    const glow = ctx.createRadialGradient(ix, iy, 4, ix, iy, 70 * pulse);
    glow.addColorStop(0, 'rgba(255,215,94,0.55)');
    glow.addColorStop(0.5, 'rgba(255,190,60,0.18)');
    glow.addColorStop(1, 'rgba(255,190,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ix, iy, 70 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Pedestal.
    ctx.fillStyle = '#3a3f52';
    ctx.fillRect(ix - 16, iy + 12, 32, 8);
    ctx.fillStyle = '#2a2f42';
    ctx.fillRect(ix - 20, iy + 20, 40, 6);

    // Golden statue: diamond body + head + star rays.
    ctx.save();
    ctx.translate(ix, iy);
    ctx.shadowColor = '#ffd75e';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(10, -2);
    ctx.lineTo(6, 12);
    ctx.lineTo(-6, 12);
    ctx.lineTo(-10, -2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(0, -24, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,94,' + (0.5 + 0.4 * pulse).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + t * 0.8;
      ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 16);
      ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawObstacle(o) {
    const kind = o.kind || o.type || 'crate';
    if (kind === 'pillar' || o.r != null) {
      const px = o.x ?? 0;
      const py = o.y ?? 0;
      const pr = o.r ?? (o.w ?? 40) / 2;
      ctx.fillStyle = P.pillarRim;
      ctx.beginPath();
      ctx.arc(px, py, pr + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = P.pillar;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      // Highlight arc.
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, pr - 4, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
      return;
    }
    const x = o.x ?? 0;
    const y = o.y ?? 0;
    const w = o.w ?? 48;
    const h = o.h ?? 48;
    if (kind === 'case') {
      ctx.fillStyle = P.caseGlass;
      rr(ctx, x, y, w, h, 4);
      ctx.fill();
      ctx.strokeStyle = P.caseFrame;
      ctx.lineWidth = 3;
      rr(ctx, x, y, w, h, 4);
      ctx.stroke();
      // Glint.
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + h - 8);
      ctx.lineTo(x + w * 0.4, y + 8);
      ctx.stroke();
      return;
    }
    // Crate: wooden box with darker edge and diagonal plank lines.
    ctx.fillStyle = P.crate;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = P.crateEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + w - 4, y + h - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w - 4, y + 4);
    ctx.lineTo(x + 4, y + h - 4);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + h / 3);
    ctx.lineTo(x + w, y + h / 3);
    ctx.moveTo(x, y + (2 * h) / 3);
    ctx.lineTo(x + w, y + (2 * h) / 3);
    ctx.stroke();
  }

  function drawWalls() {
    for (const w of WALLS || []) {
      const x = w.x ?? 0;
      const y = w.y ?? 0;
      const ww = w.w ?? 0;
      const wh = w.h ?? 0;
      ctx.fillStyle = P.wall;
      ctx.fillRect(x, y, ww, wh);
      // Lighter top edge.
      ctx.fillStyle = P.wallTop;
      if (wh <= ww) {
        ctx.fillRect(x, y, ww, 5);
      } else {
        ctx.fillRect(x, y, 5, wh);
      }
      // Faint horizontal brick lines.
      ctx.strokeStyle = P.wallLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let by = y + 14; by < y + wh; by += 14) {
        ctx.moveTo(x, by + 0.5);
        ctx.lineTo(x + ww, by + 0.5);
      }
      ctx.stroke();
    }
  }

  function drawTorches() {
    for (const t of TORCHES || []) {
      const tx = t.x ?? 0;
      const ty = t.y ?? 0;
      const glow = ctx.createRadialGradient(tx, ty, 4, tx, ty, 90);
      glow.addColorStop(0, 'rgba(255,154,60,0.5)');
      glow.addColorStop(0.5, 'rgba(255,140,50,0.16)');
      glow.addColorStop(1, 'rgba(255,140,50,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(tx, ty, 90, 0, Math.PI * 2);
      ctx.fill();
      // Bracket.
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(tx - 3, ty - 2, 6, 12);
      ctx.fillStyle = '#6b4a26';
      ctx.fillRect(tx - 6, ty - 4, 12, 4);
      // Flame.
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.arc(tx, ty - 6, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.arc(tx, ty - 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCamera(cam) {
    const cx = cam.x ?? 0;
    const cy = cam.y ?? 0;
    const range = cam.range ?? 250;
    const half = cam.halfAngle ?? 0.3;
    const spotting = !!cam.spotting;

    // Beam: thin amber wedge, red when spotting.
    cone(
      ctx, cx, cy, cam.angle ?? 0, range, half,
      spotting ? 'rgba(255,90,60,0.35)' : 'rgba(255,176,32,0.20)',
    );
    cone(
      ctx, cx, cy, cam.angle ?? 0, range * 0.55, half * 0.6,
      spotting ? 'rgba(255,90,60,0.25)' : 'rgba(255,176,32,0.14)',
    );

    // Wall-mounted unit: 16x10 box plus a lens dot, aimed along the beam.
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(cam.angle ?? 0);
    ctx.fillStyle = '#14161d';
    rr(ctx, -8, -5, 16, 10, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    rr(ctx, -8, -5, 16, 10, 2);
    ctx.stroke();
    ctx.fillStyle = spotting ? '#ff5a3c' : '#ffb020';
    ctx.beginPath();
    ctx.arc(8, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGuard(g, spottedThief) {
    const gx = g.x ?? 0;
    const gy = g.y ?? 0;
    const angle = g.angle ?? 0;
    const isSpotting = spottedThief || g.mode === 'chase';

    // Vision cone: soft-edged pale gold wedge, red-orange when spotting.
    cone(
      ctx, gx, gy, angle, 225, 0.61,
      isSpotting ? 'rgba(255,90,60,0.28)' : 'rgba(255,215,94,0.16)',
    );
    cone(
      ctx, gx, gy, angle, 225 * 0.6, 0.61 * 0.7,
      isSpotting ? 'rgba(255,90,60,0.18)' : 'rgba(255,215,94,0.10)',
    );
    // Flashlight: narrower, brighter warm-white cone.
    cone(ctx, gx, gy, angle, 260, 0.22, 'rgba(255,240,200,0.10)');
    cone(ctx, gx, gy, angle, 260 * 0.6, 0.22 * 0.6, 'rgba(255,240,200,0.08)');

    // Body: red figure with darker rim, white helmet dot, direction tick.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(gx, gy + 10, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8f1d1d';
    ctx.beginPath();
    ctx.arc(gx, gy, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c22e2e';
    ctx.beginPath();
    ctx.arc(gx, gy, 13, 0, Math.PI * 2);
    ctx.fill();

    // White helmet dot, offset toward facing.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(gx + Math.cos(angle) * 6, gy + Math.sin(angle) * 6, 4, 0, Math.PI * 2);
    ctx.fill();

    // Short direction tick.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(gx + Math.cos(angle) * 14, gy + Math.sin(angle) * 14);
    ctx.lineTo(gx + Math.cos(angle) * 22, gy + Math.sin(angle) * 22);
    ctx.stroke();

    // Chase marker.
    if (g.mode === 'chase') {
      ctx.fillStyle = '#ff5a3c';
      ctx.font = 'bold 16px ' + F;
      ctx.textAlign = 'center';
      ctx.fillText('!', gx, gy - 22);
    }
  }

  function drawPlayer(player) {
    const px = player.x ?? LOGICAL_W / 2;
    const py = player.y ?? LOGICAL_H / 2;

    // Soft dark shadow ellipse under the thief.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(px, py + 11, 15, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cloak wedge (slightly lighter, trailing below the body).
    ctx.fillStyle = '#2c2f45';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, 15, Math.PI * 0.35, Math.PI * 0.65);
    ctx.closePath();
    ctx.fill();

    // Dark hooded body.
    ctx.fillStyle = '#14161f';
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a3f5c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.stroke();

    // Thin gold trim arc.
    ctx.strokeStyle = P.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 11, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    // Small pale face dot.
    ctx.fillStyle = '#f2e6c8';
    ctx.beginPath();
    ctx.arc(px, py - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(
      LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.42,
      LOGICAL_W / 2, LOGICAL_H / 2, LOGICAL_H * 0.95,
    );
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  // ---- HUD ----------------------------------------------------------------

  function drawHUD(state, best) {
    const t = state.time ?? 0;
    const alarm = clamp(state.alarm ?? 0, 0, 100);
    const loot = (state.loot ?? 0) + (state.idolTaken ? 1 : 0);
    const lootTotal = state.lootTotal ?? 4;

    // Dark translucent panel across the top.
    ctx.fillStyle = 'rgba(4,6,14,0.72)';
    ctx.fillRect(0, 0, LOGICAL_W, 58);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, 58, LOGICAL_W, 1);

    // Left: objective.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px ' + F;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const objective = state.idolTaken ? 'REACH THE EXIT' : 'STEAL THE IDOL';
    ctx.fillText(objective, 20, 30);

    // Centre: alarm meter.
    const barX = LOGICAL_W / 2 - 190;
    const barY = 18;
    const barW = 380;
    const barH = 22;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px ' + F;
    ctx.textAlign = 'right';
    ctx.fillText('ALARM', barX - 12, barY + barH / 2);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, barH);
    if (alarm > 0) {
      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, '#2fae5f');
      grad.addColorStop(0.5, '#e8c832');
      grad.addColorStop(1, '#e83a2a');
      ctx.fillStyle = grad;
      ctx.fillRect(barX + 2, barY + 2, (barW - 4) * (alarm / 100), barH - 4);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    // Flashing red edge when the alarm is critical.
    if (alarm > 70) {
      const blink = Math.floor(t * 4) % 2 === 0;
      if (blink) {
        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = 3;
        ctx.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);
      }
    }

    // SPOTTED! label flashing under the alarm bar.
    if (state.spotted) {
      const blink = Math.floor(t * 6) % 2 === 0;
      if (blink) {
        ctx.fillStyle = '#ff5a3c';
        ctx.font = 'bold 18px ' + F;
        ctx.textAlign = 'center';
        ctx.fillText('SPOTTED!', LOGICAL_W / 2, 76);
      }
    }

    // Right: loot, timer, best.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px ' + F;
    ctx.fillText('LOOT ' + loot + '/' + lootTotal, LOGICAL_W - 20, 22);
    ctx.fillText(fmtTime(t), LOGICAL_W - 20, 44);
    if (best != null) {
      ctx.fillStyle = P.gold;
      ctx.font = 'bold 13px ' + F;
      ctx.textAlign = 'left';
      ctx.fillText('BEST ' + fmtTime(best), LOGICAL_W - 250, 22);
    }
  }

  // ---- screens ------------------------------------------------------------

  function dim(alpha) {
    ctx.fillStyle = 'rgba(2,4,10,' + alpha + ')';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  }

  function centreText(text, y, font, color) {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, LOGICAL_W / 2, y);
  }

  function drawTitle() {
    dim(0.62);
    centreText('SHADOW VAULT', 220, 'bold 72px ' + F, P.gold);
    ctx.strokeStyle = 'rgba(255,215,94,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LOGICAL_W / 2 - 260, 268);
    ctx.lineTo(LOGICAL_W / 2 + 260, 268);
    ctx.stroke();
    centreText('Steal the idol. Reach the exit. Stay unseen.', 310, '22px ' + F, '#e8ecf4');
    centreText('WASD / arrows — move · Click — walk to point · R — restart', 400, '18px ' + F, '#b9c2d4');
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) {
      centreText('Press Space to start', 470, 'bold 24px ' + F, '#ffffff');
    }
  }

  function drawPaused() {
    dim(0.6);
    centreText('PAUSED', 330, 'bold 64px ' + F, '#ffffff');
    centreText('Press Space to resume · R — restart', 410, '20px ' + F, '#b9c2d4');
  }

  function drawWin(state, best) {
    dim(0.6);
    centreText('CLEAN GETAWAY', 260, 'bold 64px ' + F, '#3ddc78');
    centreText('Time  ' + fmtTime(state.time ?? 0), 350, 'bold 28px ' + F, '#ffffff');
    if (best != null) {
      centreText('Best  ' + fmtTime(best), 395, '22px ' + F, P.gold);
    }
    centreText('Press Space to play again', 470, 'bold 22px ' + F, '#e8ecf4');
  }

  function drawLose() {
    dim(0.62);
    centreText('CAUGHT', 300, 'bold 72px ' + F, '#ff4a3c');
    centreText('The guards found you in the dark.', 380, '22px ' + F, '#e8ecf4');
    centreText('Press R to try again', 450, 'bold 22px ' + F, '#ffffff');
  }

  // ---- main draw ----------------------------------------------------------

  function draw(state, screen, best) {
    resize();

    // Backdrop clears the whole canvas (including letterbox bars).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = P.backdrop;
    ctx.fillRect(0, 0, cssW, cssH);

    // Fit 1280x720 into the canvas, centred.
    const scale = Math.min(cssW / LOGICAL_W, cssH / LOGICAL_H);
    const ox = (cssW - LOGICAL_W * scale) / 2;
    const oy = (cssH - LOGICAL_H * scale) / 2;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);

    const t = state.time ?? 0;
    const guards = state.guards || [];
    const cameras = state.cameras || [];

    // World, back to front.
    drawFloor();
    drawShadows();
    drawExit();

    // Gems (skip taken ones) and the idol.
    const gems = state.gems || GEMS || [];
    for (const gem of gems) {
      if (gem.taken) continue;
      drawGem(gem.x ?? 0, gem.y ?? 0, t);
    }
    if (!state.idolTaken) {
      drawIdol(t);
    }

    for (const o of OBSTACLES || []) drawObstacle(o);
    drawWalls();
    drawTorches();

    // Cameras (beams then units) and guards (cones then bodies).
    for (const cam of cameras) drawCamera(cam);
    for (const g of guards) drawGuard(g, state.spotted && g.mode === 'chase');

    if (state.player) drawPlayer(state.player);

    // Soft dark vignette over the whole scene.
    drawVignette();

    // HUD is always on top.
    drawHUD(state, best);

    // Screen overlays.
    if (screen === SCREEN_TITLE) drawTitle();
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_WIN) drawWin(state, best);
    else if (screen === SCREEN_LOSE) drawLose();
  }

  return { draw };
}
