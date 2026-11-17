// The simulation: no drawing, no browser in here except localStorage save/load.
// Fixed 1/60 s steps. The player walks or drives, steals parked cars, traffic
// and crowds live their lives, rain sets the grip, missions advance on reaching
// their markers. Returns event bit flags so the caller can react (banner, sound,
// game over) without the world knowing about screens. No Math.random in here:
// every random draw comes from the seeded RNG passed to createWorld.

import { BEST_KEY, CAMERA_ZOOM_DEFAULT, SAVE_KEY, TUNING, VIEW_H, VIEW_W, WORLD_H, WORLD_W } from './config.js';
import { ACTION_ENTER, ACTION_USE } from './input.js';
import { buildCity, collidesBuilding, isWater } from './city.js';
import { createTraffic, driveCar, stealCar, stepTraffic } from './vehicles.js';
import { createCrowd, stepCrowd } from './pedestrians.js';
import { createRain, gripFactor, stepRain } from './rain.js';
import { createPolice, raiseWanted, stepPolice } from './police.js';
import { MISSIONS, completeMission, dialogueFor, failMission, setDialogue, startMission } from './missions.js';
import { buyShopItem, nearestStall, shopItems } from './market.js';
import { punchAttack, stepGuard } from './combat.js';

export const EVENT_MISSION = 1;
export const EVENT_WANTED = 2;
export const EVENT_BOUGHT = 4;
export const EVENT_GAMEOVER = 8;

export function createWorld(random) {
  const city = buildCity(random);
  const state = {
    elapsed: 0,
    money: 120,
    wanted: 0,
    missionIndex: -1,
    mission: null,
    player: { x: 0, y: 0, angle: -Math.PI / 2, speed: 0, onFoot: true, car: null, health: 100 },
    cars: [],
    peds: [],
    rain: null,
    police: null,
    upgrades: { tyres: 0, engine: 0, armour: 0 },
    inventory: { contraband: 0 },
    camera: { x: 0, y: 0, zoom: CAMERA_ZOOM_DEFAULT },
    best: 0,
    shop: { open: false, sel: 0, cd: 0 },
    guard: null,
    dialogue: null,
    missionFailed: false,
    failedMissionIndex: -1,
  };
  const world = { state, city, random, reset, step, save, load };

  function reset() {
    state.elapsed = 0;
    state.money = 120;
    state.wanted = 0;
    state.missionIndex = -1;
    state.mission = null;
    state.player.x = city.spawn.x;
    state.player.y = city.spawn.y;
    state.player.angle = -Math.PI / 2;
    state.player.speed = 0;
    state.player.onFoot = true;
    state.player.car = null;
    state.player.health = 100;
    state.cars = createTraffic(city, random);
    state.peds = createCrowd(city, random);
    state.rain = createRain(random);
    state.police = createPolice(city, random);
    state.upgrades = { tyres: 0, engine: 0, armour: 0 };
    state.inventory = { contraband: 0 };
    state.shop = { open: false, sel: 0, cd: 0 };
    state.guard = null;
    state.dialogue = null;
    state.missionFailed = false;
    state.failedMissionIndex = -1;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    state.camera.zoom = CAMERA_ZOOM_DEFAULT;
    // Best is NOT reset: it is the player's record across runs.
  }

  /** True when a circle of radius r at (x, y) is blocked for the player. */
  function solid(x, y, r) {
    return collidesBuilding(city, x, y, r) || isWater(city, x, y);
  }

  function moveOnFoot(dt, ax, run) {
    const p = state.player;
    // Shift while on foot is a sprint (1.35x); in a car the same key is the
    // handbrake — one key, two jobs, both visible in the HUD hint.
    const speed = TUNING.walkSpeed * (run ? 1.35 : 1);
    const nx = p.x + ax.x * speed * dt;
    const ny = p.y + ax.y * speed * dt;
    if (!solid(nx, p.y, 10) && nx > 10 && nx < 2550) p.x = nx;
    if (!solid(p.x, ny, 10) && ny > 10 && ny < 1790) p.y = ny;
    if (ax.x !== 0 || ax.y !== 0) p.angle = Math.atan2(ax.y, ax.x);
    p.speed = (ax.x !== 0 || ax.y !== 0) ? speed : 0;
  }

  function enterOrExitCar() {
    const p = state.player;
    if (p.onFoot) {
      const car = stealCar(p, state.cars);
      if (!car) return false;
      car.driver = 'player';
      p.car = car;
      p.onFoot = false;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      if (!car.stolen) {
        car.stolen = true;
        raiseWanted(state, 1);
        return 'stolen';
      }
      return 'entered';
    }
    const car = p.car;
    car.driver = 'parked';
    car.speed = 0;
    p.car = null;
    p.onFoot = true;
    // Step out to the car's left side.
    p.x = car.x - Math.sin(car.angle) * 26;
    p.y = car.y + Math.cos(car.angle) * 26;
    p.angle = car.angle;
    p.speed = 0;
    return 'exited';
  }

  function checkMission(dt) {
    const mission = state.mission;
    if (!mission) return 0;
    const target = mission.def.targets[mission.checkpoint];
    const p = state.player;
    const dist = Math.hypot(target.x - p.x, target.y - p.y);
    if (mission.def.timer) {
      mission.timeLeft -= dt;
      if (mission.timeLeft <= 0) {
        // Out of time: the job falls through — park it for a retry.
        failMission(state);
        return EVENT_MISSION;
      }
    }
    let reached = false;
    if (target.hold) {
      if (dist < TUNING.missionRadius) {
        mission.hold += dt;
        if (mission.hold >= target.hold) reached = true;
      } else {
        mission.hold = 0;
      }
    } else if (dist < TUNING.missionRadius) {
      reached = true;
    }
    if (!reached) return 0;
    mission.checkpoint += 1;
    mission.hold = 0;
    // Market Run: every delivered package draws more heat.
    if (mission.def.id === 'market-run') raiseWanted(state, 1);
    if (mission.checkpoint < mission.def.targets.length) {
      setDialogue(state, dialogueFor(mission), 4);
      return EVENT_MISSION;
    }
    completeMission(state);
    // Roll straight into the next job when there is one.
    if (state.missionIndex < MISSIONS.length) startMission(state, state.missionIndex);
    return EVENT_MISSION;
  }

  /** Shop open/close + buying, while the world is frozen. Returns events. */
  function stepShop(dt, input) {
    const shop = state.shop;
    const items = shopItems(state);
    if (shop.cd > 0) shop.cd -= dt;
    if (input) {
      const actions = input.takeGameActions();
      const axis = input.axis();
      if (axis.y !== 0 && shop.cd <= 0) {
        shop.sel = (shop.sel + (axis.y > 0 ? 1 : -1) + items.length) % items.length;
        shop.cd = 0.18;
      }
      if (actions & ACTION_ENTER) {
        shop.open = false;
        return EVENT_BOUGHT;
      }
      if (actions & ACTION_USE) {
        const item = items[shop.sel];
        if (item && buyShopItem(state, item.id)) return EVENT_BOUGHT;
        return 0;
      }
    }
    return 0;
  }

  /** F near a stall opens the shop; F near the heist guard punches him. */
  function handleUse() {
    const p = state.player;
    if (punchAttack(state) !== null) return 'punch';
    if (nearestStall(state, city)) {
      state.shop.open = true;
      state.shop.sel = 0;
      state.shop.cd = 0.2;
      if (p.car) p.car.speed = 0;
      p.speed = 0;
      return 'shop';
    }
    return null;
  }

  /**
   * One fixed step. `input` is the input object (direction/throttle/axis/
   * takeActions/handbrake) or null for a backdrop with no player control.
   */
  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    stepRain(state.rain, dt, state.elapsed);

    // Shop open: the world freezes (rain still falls); only shop input counts.
    if (state.shop.open) {
      events |= stepShop(dt, input);
      if (state.money > state.best) state.best = state.money;
      return events;
    }

    const p = state.player;
    if (input) {
      const gameActions = input.takeGameActions();
      if (gameActions & ACTION_ENTER) {
        const result = enterOrExitCar();
        if (result === 'stolen') events |= EVENT_WANTED;
      }
      if (gameActions & ACTION_USE) {
        const used = handleUse();
        if (used === 'shop') events |= EVENT_BOUGHT;
      }
      if (p.onFoot) {
        // Autopilot inputs (shots.js) predate run(): fall back to handbrake.
        moveOnFoot(dt, input.axis(), typeof input.run === 'function' ? input.run() : input.handbrake());
      } else if (p.car) {
        p.car.handbrake = input.handbrake();
        const grip = gripFactor(state.rain) * (1 + 0.05 * state.upgrades.tyres);
        const boost = 1 + 0.08 * state.upgrades.engine;
        const px = p.car.x;
        const py = p.car.y;
        driveCar(p.car, input.direction(), input.throttle(), dt, grip, solid, boost);
        // Don't drive through another car: bounce back to the pre-move spot.
        // A move that opens the gap (backing out of a jam) is always allowed,
        // or two cars nose-to-nose freeze each other forever.
        for (const other of state.cars) {
          if (other === p.car) continue;
          const before = Math.hypot(other.x - px, other.y - py);
          const after = Math.hypot(other.x - p.car.x, other.y - p.car.y);
          if (after < 18 && after <= before) {
            p.car.x = px;
            p.car.y = py;
            p.car.speed *= 0.3;
            break;
          }
        }
        p.x = p.car.x;
        p.y = p.car.y;
        p.angle = p.car.angle;
        p.speed = p.car.speed;
      }
    }

    stepTraffic(state.cars, city, dt, random);
    stepCrowd(state.peds, city, dt, random, state.player);
    stepGuard(state, city, dt);
    stepPolice(state.police, world, dt);

    events |= checkMission(dt);

    // Camera follows the player (or their car), clamped to the world.
    // The clamp follows the zoom: a zoomed-in camera can hug the edges.
    const zoom = state.camera.zoom ?? 1;
    const hw = VIEW_W / (2 * zoom);
    const hh = VIEW_H / (2 * zoom);
    const tx = Math.min(Math.max(p.x, hw), WORLD_W - hw);
    const ty = Math.min(Math.max(p.y, hh), WORLD_H - hh);
    const k = Math.min(1, TUNING.cameraLerp * dt);
    state.camera.x += (tx - state.camera.x) * k;
    state.camera.y += (ty - state.camera.y) * k;

    if (state.money > state.best) state.best = state.money;
    if (p.health <= 0) events |= EVENT_GAMEOVER;
    return events;
  }

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: state.money,
        upgrades: state.upgrades,
        missionIndex: state.missionIndex,
        best: state.best,
      }));
      window.localStorage.setItem(BEST_KEY, String(state.best));
    } catch {
      // Storage can be off (private windows): progress then lasts this visit only.
    }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (typeof data.money === 'number') state.money = data.money;
        if (data.upgrades) state.upgrades = { ...state.upgrades, ...data.upgrades };
        if (typeof data.missionIndex === 'number') state.missionIndex = data.missionIndex;
        if (typeof data.best === 'number') state.best = data.best;
      } else {
        const best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10);
        if (Number.isInteger(best) && best > 0) state.best = best;
      }
    } catch {
      // Corrupt or unavailable save: keep the fresh defaults.
    }
  }

  reset();
  return world;
}
