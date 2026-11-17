// Cars: player physics, traffic that follows the road grid, parked cars to steal.
// A car is {x, y, angle, speed, color, kind, driver, w, h, target, axis, dir}.
// angle 0 = east, PI/2 = south. Traffic drives intersection to intersection.

import { ROADS_X, ROADS_Y, TUNING, WORLD_H, WORLD_W } from './config.js';
import { collidesBuilding, isWater } from './city.js';
import { pick } from './random.js';

const KINDS = [
  { kind: 'taxi', color: '#f5b301', w: 46, h: 24 },
  { kind: 'sedan', color: '#c94f6d', w: 46, h: 24 },
  { kind: 'sedan', color: '#4f7ec9', w: 46, h: 24 },
  { kind: 'sedan', color: '#e8e8e8', w: 46, h: 24 },
  { kind: 'truck', color: '#7a8899', w: 62, h: 28 },
  { kind: 'sport', color: '#ff2d78', w: 48, h: 23 },
];

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function makeCar(random, x, y, angle, driver) {
  const spec = pick(random, KINDS);
  return {
    x, y, angle, speed: 0,
    color: spec.color, kind: spec.kind, driver,
    w: spec.w, h: spec.h,
    target: null, axis: 'v', dir: 1, cruise: TUNING.trafficCruise,
    stolen: false, handbrake: false, blockedT: 0, reverseT: 0,
  };
}

/** Traffic + parked cars for a fresh world. One parked taxi waits by the spawn. */
export function createTraffic(city, random) {
  const cars = [];
  // Driving traffic: start each one at a random intersection, heading along a road.
  for (let i = 0; i < 14; i += 1) {
    const cx = pick(random, ROADS_X);
    const cy = pick(random, ROADS_Y);
    const vertical = random() < 0.5;
    const dir = random() < 0.5 ? 1 : -1;
    const car = makeCar(random, cx, cy, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), 'traffic');
    car.axis = vertical ? 'v' : 'h';
    car.dir = dir;
    car.target = nextIntersection(city, random, cx, cy, car.axis, car.dir);
    setLane(car);
    car.speed = TUNING.trafficCruise * (0.7 + random() * 0.5);
    cars.push(car);
  }
  // Parked cars along roads (driver 'parked'). The first is the taxi by the spawn.
  const parkedSpots = [
    { x: 1080, y: 945, angle: Math.PI / 2, kind: 'taxi' },
    { x: 640, y: 700, angle: 0, kind: 'sedan' },
    { x: 1520, y: 1000, angle: Math.PI, kind: 'sedan' },
    { x: 200, y: 420, angle: Math.PI / 2, kind: 'truck' },
    { x: 1960, y: 300, angle: -Math.PI / 2, kind: 'sport' },
    { x: 2320, y: 1300, angle: Math.PI / 2, kind: 'sedan' },
    { x: 1080, y: 300, angle: 0, kind: 'sedan' },
    { x: 640, y: 1330, angle: Math.PI, kind: 'taxi' },
    { x: 1520, y: 200, angle: Math.PI / 2, kind: 'sedan' },
    { x: 200, y: 1100, angle: 0, kind: 'truck' },
  ];
  for (const spot of parkedSpots) {
    const spec = KINDS.find((k) => k.kind === spot.kind) ?? KINDS[1];
    cars.push({
      x: spot.x, y: spot.y, angle: spot.angle, speed: 0,
      color: spot.kind === 'taxi' ? '#f5b301' : spec.color,
      kind: spot.kind, driver: 'parked',
      w: spec.w, h: spec.h, target: null, axis: 'v', dir: 1,
      cruise: 0, stolen: false, handbrake: false,
    });
  }
  return cars;
}

/** Right-hand lane offset for a traffic car (±20px off the road centre). */
function setLane(car) {
  if (car.axis === 'v') car.lane = { x: car.dir > 0 ? -20 : 20, y: 0 };
  else car.lane = { x: 0, y: car.dir > 0 ? 20 : -20 };
}

/** Pick the next intersection to drive to from (x, y) along the current road. */
function nextIntersection(city, random, x, y, axis, dir) {
  if (axis === 'v') {
    const options = ROADS_Y.filter((cy) => (dir > 0 ? cy > y + 20 : cy < y - 20));
    if (options.length === 0) return { x, y: dir > 0 ? ROADS_Y[ROADS_Y.length - 1] : ROADS_Y[0] };
    return { x, y: dir > 0 ? options[0] : options[options.length - 1] };
  }
  const options = ROADS_X.filter((cx) => (dir > 0 ? cx > x + 20 : cx < x - 20));
  if (options.length === 0) return { x: dir > 0 ? ROADS_X[ROADS_X.length - 1] : ROADS_X[0], y };
  return { x: dir > 0 ? options[0] : options[options.length - 1], y };
}

/**
 * Player car physics. steer in [-1, 1], throttle 1 forward / -1 reverse.
 * grip 1.0 dry .. 0.55 heavy rain. `solid` is an optional (x, y, r) => boolean
 * for buildings/water; without it only the world bounds stop the car.
 * Handbrake (car.handbrake) cuts grip for a drift feel.
 */
export function driveCar(car, steer, throttle, dt, grip, solid, boost = 1) {
  const g = car.handbrake ? grip * 0.55 : grip;
  const maxSpeed = TUNING.carMaxSpeed * (0.82 + 0.18 * g) * boost;
  const maxReverse = TUNING.carReverseMax;
  if (throttle > 0) {
    car.speed += TUNING.carAccel * g * dt;
  } else if (throttle < 0) {
    if (car.speed > 5) car.speed -= TUNING.carBrake * dt; // braking first
    else car.speed -= TUNING.carAccel * 0.5 * g * dt; // then reverse
  } else {
    car.speed -= car.speed * TUNING.carDrag * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  car.speed = Math.min(maxSpeed, Math.max(-maxReverse, car.speed));

  // Steering bites harder as speed grows, then eases off at the very top.
  // A floor keeps low-speed turns (corners, parking) responsive.
  const speedFactor = Math.max(0.5, Math.min(1, Math.abs(car.speed) / 180)) * (1 - 0.3 * Math.min(1, Math.abs(car.speed) / maxSpeed));
  const turn = steer * TUNING.carTurnRate * speedFactor * (car.handbrake ? 1.6 : 1);
  car.angle += turn * dt * (car.speed < 0 ? -1 : 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = Math.max(car.w, car.h) / 2 - 4;
  const blocked = (x, y) =>
    x < 20 || x > WORLD_W - 20 || y < 20 || y > WORLD_H - 20 || (solid ? solid(x, y, r) : false);
  if (!blocked(nx, ny)) {
    car.x = nx;
    car.y = ny;
  } else if (!blocked(nx, car.y)) {
    car.x = nx;
    car.speed *= 0.45;
  } else if (!blocked(car.x, ny)) {
    car.y = ny;
    car.speed *= 0.45;
  } else {
    car.speed *= 0.3;
  }
  return car;
}

/** The nearest parked car within range of the player, or null. */
export function stealCar(player, cars) {
  let best = null;
  let bestD = TUNING.enterRange;
  for (const car of cars) {
    if (car.driver !== 'parked') continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** One traffic step: follow waypoints, turn at intersections, slow for the car ahead. */
export function stepTraffic(cars, city, dt, random) {
  for (const car of cars) {
    if (car.driver !== 'traffic' || !car.target) continue;
    const lane = car.lane ?? { x: 0, y: 0 };
    const gx = car.target.x + lane.x;
    const gy = car.target.y + lane.y;
    const dx = gx - car.x;
    const dy = gy - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 26) {
      // At the intersection: keep going or turn onto the crossing road.
      const turn = random() < 0.45;
      if (turn) {
        car.axis = car.axis === 'v' ? 'h' : 'v';
        car.dir = random() < 0.5 ? 1 : -1;
      }
      car.target = nextIntersection(city, random, car.target.x, car.target.y, car.axis, car.dir);
      // If the new target is behind us (dead end), flip around.
      if (Math.hypot(car.target.x - car.x, car.target.y - car.y) < 10) {
        car.dir = -car.dir;
        car.target = nextIntersection(city, random, car.x, car.y, car.axis, car.dir);
      }
      setLane(car);
      continue;
    }
    // Slow down if another car is right ahead.
    let ahead = false;
    for (const other of cars) {
      if (other === car) continue;
      const ox = other.x - car.x;
      const oy = other.y - car.y;
      const forward = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
      const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
      if (forward > 0 && forward < 64 && side < 26) { ahead = true; break; }
    }
    // Blocked for a while by the car ahead? Back up briefly to open the
    // gap instead of sitting in a jam forever.
    if (ahead) car.blockedT += dt;
    else car.blockedT = 0;
    if (car.blockedT > 2.5) {
      car.blockedT = 0;
      car.reverseT = 1.2;
    }
    let want;
    if (car.reverseT > 0) {
      car.reverseT -= dt;
      want = -70;
    } else {
      want = ahead ? 0 : car.cruise;
    }
    if (car.speed < want) car.speed = Math.min(want, car.speed + TUNING.trafficAccel * dt);
    else if (car.speed > want) car.speed = Math.max(want, car.speed - TUNING.carBrake * dt);

    const desired = Math.atan2(dy, dx);
    const diff = wrapAngle(desired - car.angle);
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const r = 14;
    // Don't drive through another car: stop short instead of overlapping it.
    // A move that opens the gap (pulling out of a jam) is always allowed,
    // or two cars nose-to-nose freeze each other forever.
    let blockedByCar = false;
    for (const other of cars) {
      if (other === car) continue;
      const before = Math.hypot(other.x - car.x, other.y - car.y);
      const after = Math.hypot(other.x - nx, other.y - ny);
      if (after < 26 && after <= before) { blockedByCar = true; break; }
    }
    if (!blockedByCar && !collidesBuilding(city, nx, ny, r) && !isWater(city, nx, ny)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.speed *= 0.5;
    }
  }
}
