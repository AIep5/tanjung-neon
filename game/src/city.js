// The city: a deterministic grid built from one seeded RNG. One dense district
// (the night market), a container port west, neon towers east, a canal with two
// bridges, and a flood tunnel south-east. Buildings are solid AABBs; roads are
// the only drivable surface; the canal is water except at its two bridges.

import { CANAL, DISTRICTS, PALETTE, ROADS_X, ROADS_Y, ROAD_W, TUNNEL, WORLD_H, WORLD_W } from './config.js';
import { pick } from './random.js';

// Block cells: the gaps between roads. Buildings only ever spawn inside these.
const BLOCK_X = [[0, 155], [245, 595], [685, 1035], [1125, 1475], [1565, 1915], [2005, 2275], [2365, 2560]];
const BLOCK_Y = [[0, 135], [225, 475], [565, 815], [905, 1155], [1245, 1380], [1585, 1800]];

const ROOFS = [PALETTE.buildingRoof, PALETTE.buildingRoof2, PALETTE.buildingRoof3];
const NEONS = [PALETTE.neonMagenta, PALETTE.neonCyan, PALETTE.neonAmber, PALETTE.neonGreen, PALETTE.neonPurple];
const SHOP_SIGNS = ['MIE AYAM', 'SATE', 'KOPI', 'ES TEH', 'BAKSO', 'RAMEN', 'NEON', '24H', 'TAXI', 'HOTEL', 'BAR', 'KTV', 'PHO', 'MART'];
const CONTAINER_COLORS = ['#b3402e', '#2e7fb3', '#c98a1b', '#3d8a4f', '#7a4fb3', '#8a6d3b'];

function inMarket(x0, x1, y0, y1) {
  return x0 >= DISTRICTS.market.x0 && x1 <= DISTRICTS.market.x1 && y0 >= DISTRICTS.market.y0 && y1 <= DISTRICTS.market.y1;
}
function inPort(x1) {
  return x1 <= DISTRICTS.port.x1;
}
function inFinancial(x0) {
  return x0 >= DISTRICTS.financial.x0;
}
function inTunnelArea(x0, x1, y0, y1) {
  return x1 > TUNNEL.x0 && x0 < TUNNEL.x1 && y1 > TUNNEL.y && y0 < WORLD_H;
}

export function buildCity(random) {
  const buildings = [];
  const stalls = [];
  const containers = [];

  for (const [bx0, bx1] of BLOCK_X) {
    for (const [by0, by1] of BLOCK_Y) {
      if (inTunnelArea(bx0, bx1, by0, by1)) continue; // flood plain stays open
      if (inPort(bx1)) {
        // Port blocks: container stacks, with a few low sheds.
        const rows = 2 + Math.floor(random() * 2);
        for (let r = 0; r < rows; r += 1) {
          const y = by0 + 14 + r * ((by1 - by0 - 28) / Math.max(1, rows - 1 || 1));
          const n = 2 + Math.floor(random() * 3);
          for (let i = 0; i < n; i += 1) {
            const x = bx0 + 10 + i * ((bx1 - bx0 - 60) / Math.max(1, n - 1 || 1));
            containers.push({ x, y, w: 44, h: 20, color: pick(random, CONTAINER_COLORS) });
          }
        }
        if (random() < 0.4) {
          buildings.push({
            x: bx0 + 18, y: by0 + 16, w: bx1 - bx0 - 36, h: by1 - by0 - 32,
            color: PALETTE.buildingRoof2, neon: pick(random, NEONS), sign: false, label: 'GUDANG', tall: false,
          });
        }
        continue;
      }
      // Normal block: one or two buildings.
      const split = random() < 0.45;
      const parts = split ? 2 : 1;
      for (let p = 0; p < parts; p += 1) {
        const w = (bx1 - bx0 - 24) / parts;
        const x = bx0 + 12 + p * w;
        const y = by0 + 12;
        const h = by1 - by0 - 24;
        const financial = inFinancial(x);
        buildings.push({
          x, y,
          w: w - 8,
          h: h - (financial ? 4 : 8),
          color: pick(random, ROOFS),
          neon: pick(random, NEONS),
          sign: random() < (financial ? 0.9 : inMarket(x, x + w, y, y + h) ? 0.85 : 0.45),
          label: financial ? 'TOWER' : pick(random, SHOP_SIGNS),
          tall: financial,
        });
      }
      // Night-market blocks get food stalls along their street-facing edge.
      if (inMarket(bx0, bx1, by0, by1)) {
        const n = 3 + Math.floor(random() * 3);
        for (let i = 0; i < n; i += 1) {
          const along = bx0 + 20 + random() * (bx1 - bx0 - 40);
          const top = random() < 0.5;
          stalls.push({
            x: along, y: top ? by0 - 6 : by1 - 12,
            w: 30, h: 16,
            color: pick(random, NEONS),
            awning: pick(random, [PALETTE.neonMagenta, PALETTE.neonAmber, PALETTE.neonCyan, PALETTE.neonRed]),
          });
        }
      }
    }
  }

  // Extra stall rows down the market's main street (x=1080, both sidewalks).
  for (let y = 560; y <= 1160; y += 46) {
    if (random() < 0.75) {
      stalls.push({ x: 1080 - 62, y, w: 28, h: 16, color: pick(random, NEONS), awning: pick(random, [PALETTE.neonMagenta, PALETTE.neonAmber, PALETTE.neonCyan]) });
    }
    if (random() < 0.75) {
      stalls.push({ x: 1080 + 34, y: y + 12, w: 28, h: 16, color: pick(random, NEONS), awning: pick(random, [PALETTE.neonCyan, PALETTE.neonAmber, PALETTE.neonPurple]) });
    }
  }

  const city = {
    roads: { x: ROADS_X, y: ROADS_Y, w: ROAD_W },
    buildings,
    stalls,
    containers,
    canal: CANAL,
    tunnel: TUNNEL,
    spawn: { x: 1080, y: 860 },
    districts: DISTRICTS,
  };
  return city;
}

/** True when the point is on a road (canal water interrupts roads except at bridges). */
export function isRoad(city, x, y) {
  if (isWater(city, x, y)) return false;
  for (const cx of city.roads.x) if (Math.abs(x - cx) <= ROAD_W / 2) return true;
  for (const cy of city.roads.y) if (Math.abs(y - cy) <= ROAD_W / 2) return true;
  return false;
}

/** True when the point is canal water (not on a bridge). */
export function isWater(city, x, y) {
  const c = city.canal;
  if (y < c.y0 || y > c.y1) return false;
  for (const bx of c.bridges) if (Math.abs(x - bx) <= ROAD_W / 2) return false;
  return true;
}

/** True when a circle of radius r at (x, y) touches any building. */
export function collidesBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/** Nearest point on the road network to (x, y). */
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const cx of city.roads.x) {
    const d = Math.abs(x - cx);
    if (d < bestD) { bestD = d; best = { x: cx, y: Math.min(Math.max(y, 0), WORLD_H) }; }
  }
  for (const cy of city.roads.y) {
    const d = Math.abs(y - cy);
    if (d < bestD) { bestD = d; best = { x: Math.min(Math.max(x, 0), WORLD_W), y: cy }; }
  }
  return best;
}

/** True when the point is inside the flood-tunnel road segment. */
export function inTunnel(city, x, y) {
  const t = city.tunnel;
  return x >= t.x0 && x <= t.x1 && Math.abs(y - t.y) <= t.w / 2;
}
