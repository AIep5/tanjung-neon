// The screenshot scenes behind ?shot=<name>&seed=N. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (walk to the taxi, steal it, then drive intersection to
// intersection toward the mission target), so the frame is what real play looks
// like and the same seed always gives the same frame.
//
// Names: 'chase' | 'steal' | 'market' | 'finale' | 'start' (+ aliases 'play'
// and 'end' for the coordinator's shots.json).

import { CANAL, FIXED_DT, ROADS_X, ROADS_Y } from './config.js';
import { collidesBuilding, isWater, nearestRoadPoint } from './city.js';
import { ACTION_ENTER } from './input.js';
import { raiseWanted } from './police.js';
import { startMission } from './missions.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const STEAL_SECONDS = 8;
const MARKET_SECONDS = 25;
const CHASE_SECONDS = 35;
const FINALE_SECONDS = 50;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Nearest grid intersection to a point. */
function nearestIntersection(x, y) {
  let bx = ROADS_X[0];
  let by = ROADS_Y[0];
  for (const cx of ROADS_X) if (Math.abs(cx - x) < Math.abs(bx - x)) bx = cx;
  for (const cy of ROADS_Y) if (Math.abs(cy - y) < Math.abs(by - y)) by = cy;
  return { x: bx, y: by };
}

/**
 * Path from a car to a target that never asks for a U-turn: the first leg runs
 * along the road the car is already on, in the direction it already faces,
 * to the next intersection — like a real driver pulling out — then the grid
 * route takes over from there. Near an intersection, the facing direction is
 * meaningless (cos ≈ 0 is noise), so the route just starts at that
 * intersection instead.
 */
function buildPathFromCar(car, to) {
  const near = nearestIntersection(car.x, car.y);
  if (Math.hypot(near.x - car.x, near.y - car.y) < 60) return gridPath(near, to);
  const vx = ROADS_X.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
  const hy = ROADS_Y.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
  let start;
  if (Math.abs(car.x - vx) <= Math.abs(car.y - hy)) {
    const dir = Math.sin(car.angle) >= 0 ? 1 : -1;
    const ys = ROADS_Y.filter((y) => (dir > 0 ? y > car.y + 10 : y < car.y - 10));
    const y = ys.length ? (dir > 0 ? ys[0] : ys[ys.length - 1]) : (dir > 0 ? ROADS_Y[ROADS_Y.length - 1] : ROADS_Y[0]);
    start = { x: vx, y };
  } else {
    const dir = Math.cos(car.angle) >= 0 ? 1 : -1;
    const xs = ROADS_X.filter((x) => (dir > 0 ? x > car.x + 10 : x < car.x - 10));
    const x = xs.length ? (dir > 0 ? xs[0] : xs[xs.length - 1]) : (dir > 0 ? ROADS_X[ROADS_X.length - 1] : ROADS_X[0]);
    start = { x, y: hy };
  }
  return gridPath(start, to);
}

/** Grid route from intersection `start` to point `to` via road intersections. */
function gridPath(start, to) {
  const end = nearestIntersection(to.x, to.y);
  // The canal can only be crossed on a bridge (x=1080 or x=1960). If the
  // route would cross it on a bridgeless road, cross at the nearest bridge
  // instead: drive along the near side to the bridge, cross there, then
  // continue along the far side to the target's road.
  const crossesCanal = (start.y < CANAL.y0 && end.y > CANAL.y1) || (start.y > CANAL.y1 && end.y < CANAL.y0);
  const crossX = crossesCanal && !CANAL.bridges.includes(end.x)
    ? CANAL.bridges.reduce((a, b) => (Math.abs(b - end.x) < Math.abs(a - end.x) ? b : a))
    : end.x;
  const pts = [{ x: start.x, y: start.y }];
  const stepX = crossX >= start.x ? 1 : -1;
  // Walk the real road list between start and the crossing road.
  const xs = ROADS_X.filter((cx) => (stepX > 0 ? cx > start.x && cx < crossX : cx < start.x && cx > crossX));
  xs.sort((a, b) => (stepX > 0 ? a - b : b - a));
  for (const cx of xs) pts.push({ x: cx, y: start.y });
  pts.push({ x: crossX, y: start.y });
  const stepY = end.y >= start.y ? 1 : -1;
  const ys = ROADS_Y.filter((cy) => (stepY > 0 ? cy > start.y && cy < end.y : cy < start.y && cy > end.y));
  ys.sort((a, b) => (stepY > 0 ? a - b : b - a));
  for (const cy of ys) pts.push({ x: crossX, y: cy });
  pts.push({ x: crossX, y: end.y });
  if (crossX !== end.x) pts.push({ x: end.x, y: end.y });
  pts.push({ x: to.x, y: to.y });
  // Drop consecutive duplicates.
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i += 1) {
    const last = out[out.length - 1];
    if (Math.hypot(pts[i].x - last.x, pts[i].y - last.y) > 4) out.push(pts[i]);
  }
  return out;
}

/**
 * Autopilot input. mode 'drive': walk to the nearest parked car, steal it,
 * then drive the waypoint path to the mission target. mode 'approach': walk
 * toward the taxi and stop beside it (for the 'steal' shot).
 */
function makeAutopilot(world, mode) {
  const state = world.state;
  const city = world.city;
  let plan = { steer: 0, throttle: 0, ax: 0, ay: 0 };
  let path = null;
  let pathTarget = null;
  let wp = 0;
  let stuckT = 0;
  let recovering = false;
  let recoveryTarget = null;
  let backingOut = 0;
  let turningAround = false;
  let turnDir = 1;
  let dodging = false;
  let dodgeDir = 1;
  let dodgeObs = null;
  let dodgeT = 0;

  function nearestParked() {
    let best = null;
    let bestD = Infinity;
    for (const car of state.cars) {
      if (car.driver !== 'parked') continue;
      const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return { car: best, dist: bestD };
  }

  function currentTarget() {
    if (state.mission) {
      const t = state.mission.def.targets[state.mission.checkpoint];
      return { x: t.x, y: t.y };
    }
    return null;
  }

  function compute() {
    const p = state.player;
    plan = { steer: 0, throttle: 0, ax: 0, ay: 0 };
    if (p.onFoot) {
      const { car, dist } = nearestParked();
      if (!car) return 0;
      if (mode === 'approach') {
        if (dist > 56) {
          plan.ax = (car.x - p.x) / dist;
          plan.ay = (car.y - p.y) / dist;
        }
        return 0;
      }
      if (dist < 46) return ACTION_ENTER;
      plan.ax = (car.x - p.x) / dist;
      plan.ay = (car.y - p.y) / dist;
      return 0;
    }
    // Driving.
    const target = currentTarget();
    if (!target) return 0;
    const car = p.car;
    if (!car) return 0;
    // Recovery: wedged off the road (overshot a corner into a block)? Drive
    // to the nearest intersection first, then rebuild the route from there.
    // Also triggers whenever the car has drifted well off the road network,
    // not only when it is fully stuck.
    const roadPoint = nearestRoadPoint(city, p.x, p.y);
    if (!recovering && Math.hypot(roadPoint.x - p.x, roadPoint.y - p.y) > 40) {
      recovering = true;
      recoveryTarget = roadPoint;
    }
    // Backing out of a wedge: reverse straight back for a moment first —
    // the wall is in front, so forward is not going to help.
    if (backingOut > 0) {
      backingOut -= FIXED_DT;
      plan.steer = 0;
      plan.throttle = -0.7;
      if (backingOut <= 0) {
        recovering = true;
        recoveryTarget = nearestRoadPoint(city, p.x, p.y);
      }
      return 0;
    }
    if (recovering) {
      const rdist = Math.hypot(recoveryTarget.x - p.x, recoveryTarget.y - p.y);
      if (rdist < 25) {
        recovering = false;
        pathTarget = null;
        return 0;
      }
      const rdesired = Math.atan2(recoveryTarget.y - p.y, recoveryTarget.x - p.x);
      const rdiff = wrapAngle(rdesired - car.angle);
      plan.steer = clamp(rdiff * 2.5, -1, 1);
      plan.throttle = Math.abs(rdiff) > 1.0 ? 0.3 : 0.6;
      return 0;
    }
    if (!pathTarget || pathTarget.x !== target.x || pathTarget.y !== target.y) {
      path = buildPathFromCar(p.car, target);
      pathTarget = target;
      wp = 0;
    }
    if (wp >= path.length) return 0;
    const goal = path[wp];
    const dist = Math.hypot(goal.x - p.x, goal.y - p.y);
    if (dist < 55) {
      wp += 1;
      return 0;
    }
    const desired = Math.atan2(goal.y - p.y, goal.x - p.x);
    const diff = wrapAngle(desired - car.angle);
    let steer = clamp(diff * 2.5, -1, 1);
    // Facing away from the waypoint (e.g. spun around by a shunt): reverse
    // until nearly aligned, then drive forward. The turn direction is fixed
    // when the manoeuvre starts: near ±π both ways look equally short, and
    // flipping the choice each step just wobbles the nose in place.
    if (turningAround) {
      if (Math.abs(diff) < 0.6) turningAround = false;
      else {
        plan.steer = turnDir;
        plan.throttle = -0.6;
        return 0;
      }
    } else if (Math.abs(diff) > 2.2) {
      turningAround = true;
      turnDir = diff > 0 ? 1 : -1;
      plan.steer = turnDir;
      plan.throttle = -0.6;
      return 0;
    }
    // Speed target: brake for corners, cruise otherwise. Throttle alone
    // never slows the car (it only adds accel), so the pilot must brake
    // before a turning waypoint or it blows past the corner into a block.
    // Stay slow until the nose is actually pointing at the goal: a turn is
    // only done when |diff| is small, not when it first dips under 1 rad.
    // Cruise is deliberately modest: on 90px roads, 240 is fast enough and
    // slow enough to make every corner.
    const next = wp + 1 < path.length ? path[wp + 1] : null;
    let legTurn = 0;
    if (next) legTurn = Math.abs(wrapAngle(Math.atan2(next.y - goal.y, next.x - goal.x) - desired));
    let desiredSpeed = 240;
    if (dist < 260) desiredSpeed = legTurn > 0.5 ? 45 : 150;
    if (Math.abs(diff) > 0.6) desiredSpeed = Math.min(desiredSpeed, 90);
    if (Math.abs(diff) > 1.0) desiredSpeed = Math.min(desiredSpeed, 50);
    let throttle;
    if (car.speed > desiredSpeed + 25) throttle = -1;
    else if (car.speed < desiredSpeed - 10) throttle = 1;
    else throttle = 0;
    if (Math.abs(car.speed) < 18) stuckT += FIXED_DT;
    else stuckT = 0;
    if (stuckT > 1.2) {
      // Wedged: back out first, then route to the nearest road point.
      stuckT = 0;
      backingOut = 0.8;
      plan.steer = 0;
      plan.throttle = -0.7;
      return 0;
    }
    // Dodging: a car right ahead gets a gentle sidestep, never a hard swing
    // and never at the cost of braking — the speed controller above stays in
    // charge, so a dodge can never throw the car through a corner too fast.
    // A dodge always ends: after ~0.8 s, or once the car is beside it.
    function carAhead(x, y) {
      for (const other of state.cars) {
        if (other === car) continue;
        if (Math.hypot(other.x - x, other.y - y) < 30) return { x: other.x, y: other.y };
      }
      return null;
    }
    if (dodging) {
      dodgeT += FIXED_DT;
      const ox = dodgeObs.x - p.x;
      const oy = dodgeObs.y - p.y;
      const fwd = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
      const lat = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
      if (fwd < 5 || lat > 42 || dodgeT > 0.8) dodging = false;
      else {
        steer = dodgeDir * 0.5;
        throttle = Math.min(throttle, 0.5);
      }
    }
    if (!dodging) {
      const probeX = p.x + Math.cos(car.angle) * 65;
      const probeY = p.y + Math.sin(car.angle) * 65;
      const obstacle = carAhead(probeX, probeY);
      if (obstacle) {
        const lx = p.x + Math.cos(car.angle - 0.7) * 65;
        const ly = p.y + Math.sin(car.angle - 0.7) * 65;
        const rx = p.x + Math.cos(car.angle + 0.7) * 65;
        const ry = p.y + Math.sin(car.angle + 0.7) * 65;
        const leftFree = !carAhead(lx, ly);
        const rightFree = !carAhead(rx, ry);
        if (leftFree && !rightFree) dodgeDir = -1;
        else if (rightFree && !leftFree) dodgeDir = 1;
        else dodgeDir = Math.sin(state.elapsed * 2.5) > 0 ? 1 : -1;
        dodging = true;
        dodgeObs = obstacle;
        dodgeT = 0;
        steer = dodgeDir * 0.5;
        throttle = Math.min(throttle, 0.5);
      }
    }
    // A building or the canal right in front: brake. Steering around walls
    // is the waypoint route's job, not the probe's.
    const wallX = p.x + Math.cos(car.angle) * 65;
    const wallY = p.y + Math.sin(car.angle) * 65;
    if ((collidesBuilding(city, wallX, wallY, 14) || isWater(city, wallX, wallY)) && car.speed > 60) {
      throttle = -1;
    }
    plan.steer = steer;
    plan.throttle = throttle;
    return 0;
  }

  return {
    direction() {
      return plan.steer;
    },
    throttle() {
      return plan.throttle;
    },
    axis() {
      return { x: plan.ax, y: plan.ay };
    },
    handbrake() {
      return false;
    },
    takeGameActions() {
      return compute();
    },
  };
}

function runSeconds(world, input, seconds) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i += 1) world.step(FIXED_DT, input);
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names fall back to 'start'.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'start' || !name) {
    runSeconds(world, null, START_SECONDS);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'steal') {
    runSeconds(world, makeAutopilot(world, 'approach'), STEAL_SECONDS);
    return { screen: SCREEN_PLAY, best: state.best };
  }
  if (name === 'market' || name === 'play') {
    startMission(state, name === 'play' ? 0 : 1);
    runSeconds(world, makeAutopilot(world, 'drive'), name === 'play' ? 26 : MARKET_SECONDS);
    return { screen: SCREEN_PLAY, best: state.best };
  }
  if (name === 'chase') {
    startMission(state, 1);
    raiseWanted(state, 3);
    runSeconds(world, makeAutopilot(world, 'drive'), CHASE_SECONDS);
    state.police.wanted = 3;
    state.wanted = 3;
    return { screen: SCREEN_PLAY, best: state.best };
  }
  if (name === 'finale') {
    startMission(state, 3);
    raiseWanted(state, 4);
    runSeconds(world, makeAutopilot(world, 'drive'), FINALE_SECONDS);
    state.police.wanted = 4;
    state.wanted = 4;
    return { screen: SCREEN_PLAY, best: state.best };
  }
  if (name === 'end') {
    startMission(state, 3);
    raiseWanted(state, 5);
    runSeconds(world, makeAutopilot(world, 'drive'), 40);
    state.player.health = 0;
    return { screen: SCREEN_OVER, best: state.best };
  }
  runSeconds(world, null, START_SECONDS);
  return { screen: SCREEN_TITLE, best: 0 };
}
