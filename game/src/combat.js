// Combat — simple on-foot punching for the Container Heist guard.
// F (ACTION_USE) punches when the guard is close; 3 punches knock him out.
// The guard chases the player on foot and shoves back when he gets close.

import { collidesBuilding, isWater } from './city.js';

export const PUNCH_RANGE = 56;
export const GUARD_PUNCHES_TO_KO = 3;

/** Spawn the port guard beside the heist truck. */
export function createGuard(x, y) {
  return { x, y, hp: GUARD_PUNCHES_TO_KO, down: false, angle: 0, hitCd: 0, hurtCd: 0, alerted: false };
}

/**
 * Punch the guard if he is in range of the player (on foot). Returns
 * 'hit' | 'ko' | null. Knocks the guard back a step on every hit.
 */
export function punchAttack(state) {
  const guard = state.guard;
  const p = state.player;
  if (!guard || guard.down || !p.onFoot) return null;
  const d = Math.hypot(guard.x - p.x, guard.y - p.y);
  if (d > PUNCH_RANGE) return null;
  guard.hp -= 1;
  guard.hurtCd = 0.25;
  guard.alerted = true;
  const away = Math.atan2(guard.y - p.y, guard.x - p.x);
  guard.x += Math.cos(away) * 16;
  guard.y += Math.sin(away) * 16;
  if (guard.hp <= 0) {
    guard.down = true;
    return 'ko';
  }
  return 'hit';
}

/** One guard step: chase the player on foot, shove when he reaches them. */
export function stepGuard(state, city, dt) {
  const guard = state.guard;
  const p = state.player;
  if (!guard || guard.down) return;
  if (guard.hitCd > 0) guard.hitCd -= dt;
  if (guard.hurtCd > 0) {
    guard.hurtCd -= dt;
    return; // Staggered by a punch: stands still a beat.
  }
  if (!p.onFoot) return;
  const d = Math.hypot(p.x - guard.x, p.y - guard.y);
  // The guard wakes sooner now (340 px, was 280) and, once alerted by a
  // punch, closes in faster — the heist fight should feel like a fight.
  if (d > 340) return;
  guard.alerted = true;
  if (d < 26) {
    // The guard shoves Dara: a little damage, with a cooldown.
    if (guard.hitCd <= 0) {
      const armour = state.upgrades?.armour ?? 0;
      p.health = Math.max(0, p.health - Math.max(1, Math.round(4 * (1 - 0.15 * armour))));
      guard.hitCd = 1.1;
    }
    return;
  }
  const desired = Math.atan2(p.y - guard.y, p.x - guard.x);
  guard.angle = desired;
  const chaseSpeed = guard.alerted ? 185 : 170;
  const nx = guard.x + Math.cos(desired) * chaseSpeed * dt;
  const ny = guard.y + Math.sin(desired) * chaseSpeed * dt;
  if (!collidesBuilding(city, nx, ny, 8) && !isWater(city, nx, ny)) {
    guard.x = nx;
    guard.y = ny;
  }
}
