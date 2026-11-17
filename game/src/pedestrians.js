// Pedestrians: a crowd that walks the sidewalks and blocks, dense in the night
// market, sparse elsewhere. Peds pick a nearby target, walk to it, then pick
// another; a blocked step makes them turn around and pick again. They cross
// roads when their target is on the other side.

import { DISTRICTS, TUNING } from './config.js';
import { collidesBuilding, isWater } from './city.js';

const SHIRT_COLORS = ['#e8e8e8', '#ff2d78', '#22e6ff', '#ffb020', '#39ff88', '#b26bff', '#f5f5f5', '#c9a86a'];

function freeSpot(city, random, x0, x1, y0, y1) {
  for (let tries = 0; tries < 24; tries += 1) {
    const x = x0 + random() * (x1 - x0);
    const y = y0 + random() * (y1 - y0);
    if (!collidesBuilding(city, x, y, 8) && !isWater(city, x, y)) return { x, y };
  }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

function makePed(city, random, x0, x1, y0, y1, market) {
  const spot = freeSpot(city, random, x0, x1, y0, y1);
  const target = freeSpot(city, random, x0, x1, y0, y1);
  return {
    x: spot.x, y: spot.y,
    tx: target.x, ty: target.y,
    angle: random() * Math.PI * 2,
    speed: (market ? TUNING.pedSpeedMarket : TUNING.pedSpeed) * (0.7 + random() * 0.6),
    color: SHIRT_COLORS[Math.floor(random() * SHIRT_COLORS.length)],
    state: 'walk',
  };
}

export function createCrowd(city, random) {
  const peds = [];
  const m = DISTRICTS.market;
  // Dense night-market crowd: 60+ peds inside the market district.
  for (let i = 0; i < 68; i += 1) peds.push(makePed(city, random, m.x0, m.x1, m.y0, m.y1, true));
  // Sparse elsewhere: a few dozen spread over the rest of the city.
  for (let i = 0; i < 34; i += 1) {
    const west = random() < 0.5;
    const x0 = west ? 0 : 1520;
    const x1 = west ? 640 : 2560;
    const y0 = 0;
    const y1 = 1380;
    peds.push(makePed(city, random, x0, x1, y0, y1, false));
  }
  // A handful south of the canal, near the tunnel approach.
  for (let i = 0; i < 10; i += 1) peds.push(makePed(city, random, 1520, 2560, 1540, 1800, false));
  return peds;
}

/** One crowd step: walk toward each ped's target, repick on arrival or when blocked. */
export function stepCrowd(peds, city, dt, random) {
  for (const ped of peds) {
    const dx = ped.tx - ped.x;
    const dy = ped.ty - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) {
      // Arrived: pick a new nearby target (stay roughly in the same district).
      const near = 220;
      const spot = freeSpot(city, random, ped.x - near, ped.x + near, ped.y - near, ped.y + near);
      ped.tx = spot.x;
      ped.ty = spot.y;
      continue;
    }
    const desired = Math.atan2(dy, dx);
    ped.angle = desired;
    const nx = ped.x + Math.cos(desired) * ped.speed * dt;
    const ny = ped.y + Math.sin(desired) * ped.speed * dt;
    if (!collidesBuilding(city, nx, ny, 6) && !isWater(city, nx, ny)) {
      ped.x = nx;
      ped.y = ny;
    } else {
      // Blocked: turn around and pick a fresh target.
      const spot = freeSpot(city, random, ped.x - 200, ped.x + 200, ped.y - 200, ped.y + 200);
      ped.tx = spot.x;
      ped.ty = spot.y;
    }
  }
}
