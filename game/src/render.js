// Drawing only: the world and the current screen in, pixels out. The 1280x720
// logical view is scaled to fit the window and centred. The signature look is
// wet asphalt: every neon sign and every car throws a mirrored streak onto the
// road below it, so rain + neon reflections are visible in every shot.
//
// Iteration 2: the first submit read as a dark abstract grid at contact-sheet
// size, so the camera now zooms in (state.camera.zoom, ~1.35x live, up to
// 1.6x in the staged chase), the palette is lifted, buildings get lit
// windows, district names are painted on the streets, police cars carry a
// flashing red/blue halo, and the rain vignette no longer swallows the frame.
// All HUD panels live in hud.js now; this file keeps the world + screens.

import { DISTRICT_LABELS, FONT, PALETTE, ROADS_X, ROADS_Y, ROAD_W, STREET_LABELS, TUNNEL, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';
import { nearestStall, shopItems } from './market.js';
import { drawDialogue as drawDialogueHud, drawDistrictTag, drawMinimap, drawMissionCard, drawObjectiveArrow, drawSpeedCluster, drawTimerBar, drawWantedPanel } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  // The HUD module's functions share these two helpers + the canvas context.
  const ui = { ctx, text, rr };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_W, height / VIEW_H);
    view.x = (width - VIEW_W * view.scale) / 2;
    view.y = (height - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    ctx.font = fonts.get(size);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(value, x, y);
  }

  // ---------- world ----------

  function drawRoads(state) {
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // Wet sheen: faint lighter bands along every road.
    ctx.fillStyle = PALETTE.asphaltWet;
    for (const cx of ROADS_X) ctx.fillRect(cx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
    for (const cy of ROADS_Y) ctx.fillRect(0, cy - ROAD_W / 2, WORLD_W, ROAD_W);
    // Sidewalk strips hugging each road.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const cx of ROADS_X) {
      ctx.fillRect(cx - ROAD_W / 2 - 14, 0, 12, WORLD_H);
      ctx.fillRect(cx + ROAD_W / 2 + 2, 0, 12, WORLD_H);
    }
    for (const cy of ROADS_Y) {
      ctx.fillRect(0, cy - ROAD_W / 2 - 14, WORLD_W, 12);
      ctx.fillRect(0, cy + ROAD_W / 2 + 2, WORLD_W, 12);
    }
    // Lane dashes.
    ctx.fillStyle = PALETTE.laneDash;
    for (const cx of ROADS_X) {
      for (let y = 20; y < WORLD_H; y += 64) ctx.fillRect(cx - 2, y, 4, 30);
    }
    for (const cy of ROADS_Y) {
      for (let x = 20; x < WORLD_W; x += 64) ctx.fillRect(x, cy - 2, 30, 4);
    }
    // Road edges.
    ctx.strokeStyle = PALETTE.roadEdge;
    ctx.lineWidth = 3;
    for (const cx of ROADS_X) {
      ctx.beginPath(); ctx.moveTo(cx - ROAD_W / 2, 0); ctx.lineTo(cx - ROAD_W / 2, WORLD_H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + ROAD_W / 2, 0); ctx.lineTo(cx + ROAD_W / 2, WORLD_H); ctx.stroke();
    }
    for (const cy of ROADS_Y) {
      ctx.beginPath(); ctx.moveTo(0, cy - ROAD_W / 2); ctx.lineTo(WORLD_W, cy - ROAD_W / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy + ROAD_W / 2); ctx.lineTo(WORLD_W, cy + ROAD_W / 2); ctx.stroke();
    }
  }

  /** Soft pools of coloured light over the three liveliest districts. */
  function drawAmbientGlow() {
    const pools = [
      { x: 1080, y: 860, r: 520, color: '255, 45, 120' },
      { x: 320, y: 860, r: 420, color: '255, 176, 32' },
      { x: 2260, y: 600, r: 420, color: '34, 230, 255' },
    ];
    for (const pool of pools) {
      const grad = ctx.createRadialGradient(pool.x, pool.y, 20, pool.x, pool.y, pool.r);
      grad.addColorStop(0, `rgba(${pool.color}, 0.07)`);
      grad.addColorStop(1, `rgba(${pool.color}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(pool.x - pool.r, pool.y - pool.r, pool.r * 2, pool.r * 2);
    }
  }

  /** District + street name plates painted on the ground, like the top entries'. */
  function drawDistrictLabels() {
    ctx.save();
    ctx.globalAlpha = 0.32;
    for (const d of DISTRICT_LABELS) text(d.label, d.x, d.y, d.size, d.color, 'center');
    ctx.globalAlpha = 0.55;
    for (const s of STREET_LABELS) text(s.label, s.x, s.y, 13, '#c8d4e0', 'center');
    ctx.restore();
  }

  function drawCanal(state, city) {
    const c = city.canal;
    ctx.fillStyle = PALETTE.canalDeep;
    ctx.fillRect(0, c.y0, WORLD_W, c.y1 - c.y0);
    ctx.fillStyle = PALETTE.canalWater;
    ctx.fillRect(0, c.y0 + 6, WORLD_W, c.y1 - c.y0 - 12);
    // Moving shimmer lines, deterministic from elapsed.
    ctx.strokeStyle = 'rgba(34, 230, 255, 0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i += 1) {
      const y = c.y0 + 12 + i * 10;
      const off = ((state.elapsed * 24 + i * 173) % 240) - 120;
      ctx.beginPath();
      ctx.moveTo(off, y);
      ctx.lineTo(off + 120, y);
      ctx.stroke();
    }
    // Bridge decks over the canal.
    ctx.fillStyle = PALETTE.asphaltWet;
    for (const bx of c.bridges) ctx.fillRect(bx - ROAD_W / 2, c.y0 - 4, ROAD_W, c.y1 - c.y0 + 8);
    ctx.fillStyle = PALETTE.laneDash;
    for (const bx of c.bridges) {
      for (let y = c.y0; y < c.y1; y += 48) ctx.fillRect(bx - 2, y, 4, 22);
    }
  }

  function drawTunnel(state, city) {
    const t = city.tunnel;
    // Darkened enclosed stretch + mouth arches at both ends.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(t.x0, t.y - t.w / 2, t.x1 - t.x0, t.w);
    // Flood water rising during the Flood Tunnel mission: level follows the
    // timer (0 at start, full when time runs out).
    if (state.mission?.def.id === 'flood-tunnel') {
      const frac = 1 - Math.max(0, state.mission.timeLeft) / (state.mission.def.timer || 90);
      const h = t.w * (0.25 + 0.65 * frac);
      ctx.fillStyle = `rgba(10, 80, 110, ${0.35 + 0.4 * frac})`;
      ctx.fillRect(t.x0, t.y + t.w / 2 - h, t.x1 - t.x0, h);
      ctx.strokeStyle = 'rgba(34, 230, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x0, t.y + t.w / 2 - h);
      ctx.lineTo(t.x1, t.y + t.w / 2 - h);
      ctx.stroke();
    }
    ctx.strokeStyle = PALETTE.neonAmber;
    ctx.lineWidth = 4;
    for (const mx of [t.x0, t.x1]) {
      ctx.beginPath();
      ctx.moveTo(mx, t.y - t.w / 2);
      ctx.lineTo(mx, t.y + t.w / 2);
      ctx.stroke();
    }
    text('TEROWONGAN BANJIR', (t.x0 + t.x1) / 2, t.y - t.w / 2 - 10, 13, PALETTE.neonAmber, 'center');
  }

  /** Deterministic 0..1 hash of a point, for rooftop clutter that never moves. */
  function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >> 13)) | 0;
    return ((h >>> 0) % 1000) / 1000;
  }

  function drawBuildings(state, city, cam, zoom) {
    const hw = VIEW_W / (2 * zoom);
    const hh = VIEW_H / (2 * zoom);
    const vx0 = cam.x - hw - 120;
    const vx1 = cam.x + hw + 120;
    const vy0 = cam.y - hh - 120;
    const vy1 = cam.y + hh + 120;
    for (const b of city.buildings) {
      if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // Rooftop detail: inner panel + a few clutter blocks (AC units, vents).
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
      for (let i = 0; i < 3; i += 1) {
        const hx = hash2(b.x + i * 31, b.y + i * 17);
        const hy = hash2(b.x + i * 13, b.y + i * 47);
        const cw = 8 + hx * 14;
        const ch = 8 + hy * 12;
        ctx.fillRect(b.x + 12 + hx * Math.max(1, b.w - 24 - cw), b.y + 12 + hy * Math.max(1, b.h - 24 - ch), cw, ch);
      }
      // Lit windows: a dark slab becomes a building when some windows glow.
      if (b.w >= 70 && b.h >= 50) {
        const cols = Math.max(2, Math.floor(b.w / 34));
        const rows = Math.max(1, Math.floor(b.h / 40));
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            if (hash2(b.x + cx * 53, b.y + cy * 71) < 0.45) continue;
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = hash2(b.x + cx * 29, b.y + cy * 41) > 0.5 ? '#ffd27a' : '#9beaff';
            ctx.fillRect(b.x + 12 + cx * ((b.w - 24) / cols), b.y + 12 + cy * ((b.h - 24) / rows), 9, 7);
          }
        }
        ctx.globalAlpha = 1;
      }
      // Tall financial towers get a vertical neon strip on their west edge.
      if (b.tall) {
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = b.neon;
        ctx.fillRect(b.x + 3, b.y + 6, 3, b.h - 12);
        ctx.globalAlpha = 1;
      }
      // Neon edge glow on the street-facing (south) side.
      if (b.sign) {
        ctx.strokeStyle = b.neon;
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.stroke();
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h); ctx.stroke();
        ctx.globalAlpha = 1;
        if (b.w > 70) text(b.label, b.x + b.w / 2, b.y + b.h - 8, 11, b.neon, 'center');
      }
    }
  }

  /** Mirrored neon streaks on the wet ground — the signature visual. */
  function drawReflections(state, city, cam, zoom) {
    const hw = VIEW_W / (2 * zoom);
    const hh = VIEW_H / (2 * zoom);
    const vx0 = cam.x - hw - 120;
    const vx1 = cam.x + hw + 120;
    const vy0 = cam.y - hh - 120;
    const vy1 = cam.y + hh + 120;
    const wobble = Math.sin(state.elapsed * 2.2) * 3;
    // Puddle strength follows rain intensity: heavier rain, longer/brighter streaks.
    const puddle = 0.14 + 0.3 * (state.rain?.intensity ?? 0.35);
    const streakLen = 30 + 40 * (state.rain?.intensity ?? 0.35);
    for (const b of city.buildings) {
      if (!b.sign || b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
      const grad = ctx.createLinearGradient(0, b.y + b.h, 0, b.y + b.h + streakLen);
      grad.addColorStop(0, b.neon);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = puddle;
      ctx.fillStyle = grad;
      ctx.fillRect(b.x + 6 + wobble, b.y + b.h, b.w - 12, streakLen);
      ctx.globalAlpha = 1;
    }
    for (const car of state.cars) {
      if (car.x < vx0 || car.x > vx1 || car.y < vy0 || car.y > vy1) continue;
      ctx.globalAlpha = 0.1 + 0.16 * (state.rain?.intensity ?? 0.35);
      ctx.fillStyle = car.driver === 'player' ? PALETTE.neonMagenta : car.color;
      ctx.beginPath();
      ctx.ellipse(car.x, car.y + 16, car.w * 0.55, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawStallsAndContainers(state, city, cam, zoom) {
    const hw = VIEW_W / (2 * zoom);
    const hh = VIEW_H / (2 * zoom);
    const vx0 = cam.x - hw - 80;
    const vx1 = cam.x + hw + 80;
    const vy0 = cam.y - hh - 80;
    const vy1 = cam.y + hh + 80;
    for (const c of city.containers) {
      if (c.x < vx0 || c.x > vx1 || c.y < vy0 || c.y > vy1) continue;
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillRect(c.x, c.y + c.h - 5, c.w, 5);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w, c.h);
    }
    for (const s of city.stalls) {
      if (s.x < vx0 || s.x > vx1 || s.y < vy0 || s.y > vy1) continue;
      ctx.fillStyle = '#2a2118';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = s.awning;
      ctx.fillRect(s.x - 2, s.y - 4, s.w + 4, 7);
      // Warm stall light spilling onto the wet street.
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = PALETTE.neonAmber;
      ctx.fillRect(s.x - 2, s.y + s.h, s.w + 4, 12);
      ctx.globalAlpha = 1;
    }
  }

  function drawPeds(state, cam, zoom) {
    const hw = VIEW_W / (2 * zoom);
    const hh = VIEW_H / (2 * zoom);
    for (const ped of state.peds) {
      if (Math.abs(ped.x - cam.x) > hw + 40 || Math.abs(ped.y - cam.y) > hh + 40) continue;
      // Soft shadow so the crowd reads on the wet road.
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y + 8, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y - 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(ped.x - 3.5, ped.y - 2, 7, 11);
    }
  }

  function drawCar(car, isPlayer, elapsed = 0) {
    // Police halo: a flashing red/blue pool of light around the patrol car,
    // so a chase reads even at contact-sheet size. Drawn in world space,
    // before the car's own rotation.
    if (car.driver === 'police') {
      const phase = Math.floor(elapsed * 3.5) % 2 === 0;
      const halo = ctx.createRadialGradient(car.x, car.y, 4, car.x, car.y, 85);
      halo.addColorStop(0, phase ? 'rgba(255, 59, 48, 0.34)' : 'rgba(59, 130, 255, 0.34)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(car.x, car.y, 85, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Neon underglow.
    ctx.globalAlpha = isPlayer ? 0.35 : 0.2;
    ctx.fillStyle = isPlayer ? PALETTE.neonMagenta : car.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, car.w * 0.62, car.h * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Headlight cone.
    const beam = ctx.createLinearGradient(car.w / 2, 0, car.w / 2 + 150, 0);
    beam.addColorStop(0, 'rgba(255, 240, 180, 0.20)');
    beam.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(car.w / 2 - 4, -8);
    ctx.lineTo(car.w / 2 + 150, -34);
    ctx.lineTo(car.w / 2 + 150, 34);
    ctx.lineTo(car.w / 2 - 4, 8);
    ctx.closePath();
    ctx.fill();
    // Body.
    ctx.fillStyle = car.color;
    rr(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(10, 16, 24, 0.85)';
    rr(ctx, -car.w / 2 + 10, -car.h / 2 + 4, car.w / 2 - 8, car.h - 8, 4);
    ctx.fill();
    // Headlights + taillights.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(car.w / 2 - 3, -car.h / 2 + 2, 3, 5);
    ctx.fillRect(car.w / 2 - 3, car.h / 2 - 7, 3, 5);
    ctx.fillStyle = PALETTE.neonRed;
    ctx.fillRect(-car.w / 2, -car.h / 2 + 2, 3, 5);
    ctx.fillRect(-car.w / 2, car.h / 2 - 7, 3, 5);
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#111';
      text('TAXI', 0, -car.h / 2 - 6, 9, '#f5b301', 'center');
    }
    if (car.driver === 'police') {
      // Blue door stripe + roof light bar, flashing red/blue (deterministic
      // phase from elapsed) + the unit call-sign over the roof.
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#3b82ff';
      ctx.fillRect(-car.w / 2 + 8, -2, car.w - 16, 4);
      ctx.globalAlpha = 1;
      const phase = Math.floor(elapsed * 3.5) % 2 === 0;
      ctx.fillStyle = '#0b0e13';
      ctx.fillRect(-8, -5, 16, 10);
      ctx.fillStyle = phase ? '#ff3b30' : '#3b82ff';
      ctx.fillRect(-7, -4, 6, 8);
      ctx.fillStyle = phase ? '#3b82ff' : '#ff3b30';
      ctx.fillRect(1, -4, 6, 8);
    }
    ctx.restore();
    // Unit call-sign, drawn unrotated in world space: inside the rotated
    // body it came out upside-down whenever the car faced south.
    if (car.driver === 'police') {
      text(car.unit ?? 'POLISI', car.x, car.y - car.h / 2 - 8, 9, '#dfe6ee', 'center');
    }
  }

  function drawPlayerOnFoot(state) {
    const p = state.player;
    if (!p.onFoot) return;
    // Soft shadow + reflection streak under Dara.
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = PALETTE.neonMagenta;
    ctx.fillRect(p.x - 5, p.y + 10, 10, 16);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ff2d78';
    ctx.beginPath();
    ctx.arc(0, -4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22e6ff';
    rr(ctx, -5, 0, 10, 13, 4);
    ctx.fill();
    ctx.restore();
  }

  /** The heist guard: orange hi-vis, red when knocked out (lying flat). */
  function drawGuard(state) {
    const g = state.guard;
    if (!g) return;
    ctx.save();
    ctx.translate(g.x, g.y);
    if (g.down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#c94f2e';
      ctx.fillRect(-8, -4, 16, 8);
      ctx.restore();
      text('KO', g.x, g.y - 16, 12, PALETTE.neonGreen, 'center');
      return;
    }
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.arc(0, -4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e8e8';
    rr(ctx, -5, 0, 10, 13, 4);
    ctx.fill();
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(-5, 3, 10, 3);
    ctx.restore();
    text('PENJAGA', g.x, g.y - 18, 10, '#ff7a1a', 'center');
    // HP pips.
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i < g.hp ? PALETTE.neonRed : 'rgba(255,255,255,0.25)';
      ctx.fillRect(g.x - 12 + i * 9, g.y + 12, 7, 4);
    }
  }

  /** Police helicopter + its spotlight pool on the ground below the player. */
  function drawHelicopter(state) {
    const h = state.police?.heli;
    if (!h) return;
    const p = state.player;
    // Spotlight: pale pool tracking the player.
    const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 170);
    grad.addColorStop(0, 'rgba(255, 244, 190, 0.32)');
    grad.addColorStop(1, 'rgba(255, 244, 190, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 170, 0, Math.PI * 2);
    ctx.fill();
    // Heli body + spinning rotor.
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(h.angle * 0.15);
    ctx.strokeStyle = 'rgba(223, 230, 238, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(26, 0);
    ctx.stroke();
    ctx.fillStyle = '#1c2530';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(12, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    text('HELI', h.x, h.y - 18, 10, '#dfe6ee', 'center');
  }

  function drawMissionMarker(state) {
    if (!state.mission) return;
    const target = state.mission.def.targets[state.mission.checkpoint];
    const pulse = 1 + 0.18 * Math.sin(state.elapsed * 4);
    ctx.save();
    // Pulsing diamond + ring.
    ctx.translate(target.x, target.y);
    ctx.rotate(Math.PI / 4 + Math.sin(state.elapsed * 1.5) * 0.12);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = PALETTE.neonMagenta;
    const s = 16 * pulse;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-Math.PI / 4 - Math.sin(state.elapsed * 1.5) * 0.12);
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = PALETTE.neonMagenta;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 40 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.85;
    // Light beam rising from the marker.
    const grad = ctx.createLinearGradient(0, target.y, 0, target.y - 90);
    grad.addColorStop(0, 'rgba(255, 45, 120, 0.35)');
    grad.addColorStop(1, 'rgba(255, 45, 120, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(target.x - 6, target.y - 90, 12, 90);
    ctx.globalAlpha = 1;
    text(target.label, target.x, target.y - 96, 14, PALETTE.neonMagenta, 'center');
    // Hold-progress ring (Container Heist truck).
    if (target.hold && state.mission.hold > 0) {
      const frac = Math.min(1, state.mission.hold / target.hold);
      ctx.strokeStyle = PALETTE.neonGreen;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 30, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
      text(`${Math.ceil(target.hold - state.mission.hold)}s`, target.x, target.y + 52, 14, PALETTE.neonGreen, 'center');
    }
    ctx.restore();
  }

  function drawWorld(world) {
    const state = world.state;
    const city = world.city;
    const cam = state.camera;
    // Zoomed camera: the player, cars and crowds fill the frame instead of
    // the city grid. Zoom lives on state.camera (default 1.35, per-shot
    // override in shots.js, ?zoom= in main.js).
    const zoom = cam.zoom ?? 1;
    ctx.setTransform(view.scale * zoom, 0, 0, view.scale * zoom, view.x + (VIEW_W / 2 - cam.x * zoom) * view.scale, view.y + (VIEW_H / 2 - cam.y * zoom) * view.scale);
    drawRoads(state);
    drawAmbientGlow();
    drawCanal(state, city);
    drawTunnel(state, city);
    drawDistrictLabels();
    drawBuildings(state, city, cam, zoom);
    drawReflections(state, city, cam, zoom);
    drawStallsAndContainers(state, city, cam, zoom);
    drawPeds(state, cam, zoom);
    for (const car of state.cars) drawCar(car, car.driver === 'player', state.elapsed);
    drawPlayerOnFoot(state);
    drawGuard(state);
    drawHelicopter(state);
    drawMissionMarker(state);
  }

  // ---------- screen space (rain, HUD, panels) ----------

  function drawRain(state) {
    const rain = state.rain;
    if (!rain) return;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.strokeStyle = PALETTE.rain;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.25 + 0.45 * rain.intensity;
    ctx.beginPath();
    for (const drop of rain.drops) {
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + drop.drift * 0.03, drop.y + drop.len);
    }
    ctx.stroke();
    // Splash rings, deterministic from elapsed + drop index.
    ctx.globalAlpha = 0.3 * rain.intensity;
    for (let i = 0; i < 60; i += 1) {
      const t = (state.elapsed * 1.7 + i * 0.37) % 1;
      const x = (i * 311 + 97) % VIEW_W;
      const y = (i * 173 + 53) % VIEW_H;
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + t * 9, 1.5 + t * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Lightning flash: brief full-screen brighten (visual only).
    if (rain.flash > 0) {
      ctx.fillStyle = `rgba(210, 225, 255, ${0.2 * rain.flash})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    // Vignette: lighter than the first submit — heavy rain used to swallow
    // the frame (0.3 + 0.45 * intensity); now it only shades the corners.
    const vig = 0.1 + 0.22 * rain.intensity;
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    grad.addColorStop(0, 'rgba(2, 4, 8, 0)');
    grad.addColorStop(1, `rgba(2, 4, 8, ${vig})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function drawHud(state, best, city) {
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawMissionCard(ui, state);
    drawWantedPanel(ui, state);
    drawTimerBar(ui, state);
    drawObjectiveArrow(ui, state);
    drawDistrictTag(ui, state);
    drawMinimap(ui, state);
    drawSpeedCluster(ui, state);
    // Bottom hint line: near a stall it names the shop key first.
    const hint = state.player.onFoot
      ? (nearestStall(state, city) ? 'F — buka Pasar Gelap • WASD jalan • E curi mobil • M suara • P jeda' : 'WASD jalan • E curi mobil • F aksi/beli • M suara • P jeda')
      : 'WASD mengemudi • Shift handbrake • E keluar mobil • M suara • P jeda';
    text(hint, VIEW_W / 2, VIEW_H - 14, 14, PALETTE.hudDim, 'center');
    void best;
  }

  function drawPanel(title, lines, prompt, accent) {
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.fillStyle = 'rgba(4, 7, 12, 0.66)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 640;
    const h = 150 + lines.length * 30;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = 'rgba(10, 15, 22, 0.92)';
    rr(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    rr(ctx, x, y, w, h, 12);
    ctx.stroke();
    text(title, VIEW_W / 2, y + 64, 44, accent, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW_W / 2, y + 104 + i * 30, 17, PALETTE.hudText, 'center');
    }
    text(prompt, VIEW_W / 2, y + h - 26, 16, PALETTE.neonAmber, 'center');
  }

  function drawDialogue(state) {
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawDialogueHud(ui, state);
  }

  /** Black-market shop panel (world is paused while it is open). */
  function drawShop(state) {
    if (!state.shop?.open) return;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.fillStyle = 'rgba(4, 7, 12, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 560;
    const h = 320;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = 'rgba(10, 15, 22, 0.96)';
    rr(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.neonAmber;
    ctx.lineWidth = 2;
    rr(ctx, x, y, w, h, 12);
    ctx.stroke();
    text('PASAR GELAP', VIEW_W / 2, y + 44, 26, PALETTE.neonAmber, 'center');
    text(`Uang: $ ${state.money}   •   Kontraband: ${state.inventory.contraband}   •   Ban Lv${state.upgrades.tyres}  Mesin Lv${state.upgrades.engine}  Bodi Lv${state.upgrades.armour}`, VIEW_W / 2, y + 72, 14, PALETTE.hudText, 'center');
    const items = shopItems(state);
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      const iy = y + 96 + i * 34;
      if (i === state.shop.sel) {
        ctx.fillStyle = 'rgba(255, 176, 32, 0.18)';
        rr(ctx, x + 24, iy - 20, w - 48, 30, 6);
        ctx.fill();
      }
      const price = it.price === 0 ? 'MAX' : it.price > 0 ? `$ ${it.price}` : `+ $ ${-it.price}`;
      const color = it.canBuy ? PALETTE.hudText : '#5a6b7d';
      text(`${i === state.shop.sel ? '▶ ' : '  '}${it.label}`, x + 40, iy, 16, color, 'left');
      text(it.detail, x + 330, iy, 13, PALETTE.hudDim, 'left');
      text(price, x + w - 40, iy, 16, it.canBuy ? PALETTE.neonGreen : '#5a6b7d', 'right');
    }
    text('W/S pilih • F beli • E tutup', VIEW_W / 2, y + h - 20, 14, PALETTE.neonAmber, 'center');
  }

  function drawBanner(banner) {
    if (!banner) return;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const w = 520;
    ctx.fillStyle = 'rgba(10, 15, 22, 0.88)';
    rr(ctx, (VIEW_W - w) / 2, 160, w, 52, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.neonGreen;
    ctx.lineWidth = 2;
    rr(ctx, (VIEW_W - w) / 2, 160, w, 52, 10);
    ctx.stroke();
    text(banner, VIEW_W / 2, 194, 20, PALETTE.neonGreen, 'center');
  }

  /** Paint one frame: world, rain, HUD, then the panel for the current screen. */
  function draw(world, screen, best, banner) {
    const state = world.state;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawWorld(world);
    drawRain(state);
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'TANJUNG NEON',
        [
          'Hujan. Neon. Pelarian.',
          'Dara, sopir taksi malam, jadi kurir',
          'di kota pelabuhan yang tak pernah tidur.',
          'Curi mobil, antar paket, dan jangan sampai ketangkap.',
          '',
          'WASD / panah — jalan & mengemudi    E — curi / keluar mobil',
          'Shift — handbrake (lari saat jalan kaki)    F — aksi    P — jeda',
          best > 0 ? `Rekor uang: $ ${best}` : '',
        ],
        'Tekan Spasi atau klik untuk mulai',
        PALETTE.neonMagenta,
      );
      return;
    }
    drawHud(state, best, world.city);
    drawBanner(banner);
    drawDialogue(state);
    if (state.missionFailed) {
      ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
      text('MISI GAGAL — tekan R atau Spasi untuk coba lagi', VIEW_W / 2, 190, 20, PALETTE.neonRed, 'center');
    }
    drawShop(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('JEDA', ['Hujan terus turun di luar sana.', 'Mobilmu menunggu.'], 'Tekan P untuk lanjut', PALETTE.neonCyan);
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'BUSTED',
        [`Polisi akhirnya menangkap Dara.`, `Uang: $ ${state.money}   •   Misi selesai: ${Math.max(0, state.missionIndex)}`, best > 0 ? `Rekor: $ ${best}` : ''],
        'Tekan Spasi atau klik untuk coba lagi',
        PALETTE.neonRed,
      );
    } else if (screen === SCREEN_WIN) {
      drawPanel(
        'KOTA MILIKMU',
        ['Semua misi selesai. Tanjung Neon mengenal nama Dara.', `Uang akhir: $ ${state.money}`],
        'Tekan Spasi atau klik untuk main lagi',
        PALETTE.neonGreen,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
