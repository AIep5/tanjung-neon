// The black market — real, safe rules. Contraband and car upgrades.
// Every function returns true/false and never lets money go negative.
// Prices in config.js (CONTRABAND_BUY / CONTRABAND_SELL / UPGRADES); upgrade
// cost rises per level (level 1 = base, level 2 = 2x base, level 3 = 3x base).
// The shop UI (render.js drawShop) is driven by shopItems() below.

import { CONTRABAND_BUY, CONTRABAND_SELL, UPGRADES } from './config.js';

/** Buy qty contraband at CONTRABAND_BUY each. False when money is short. */
export function buyContraband(state, qty) {
  const n = Math.max(0, Math.floor(qty));
  if (n === 0) return false;
  const cost = n * CONTRABAND_BUY;
  if (state.money < cost) return false;
  state.money -= cost;
  state.inventory.contraband += n;
  return true;
}

/** Sell qty contraband at CONTRABAND_SELL each. False when stock is short. */
export function sellContraband(state, qty) {
  const n = Math.max(0, Math.floor(qty));
  if (n === 0 || state.inventory.contraband < n) return false;
  state.inventory.contraband -= n;
  state.money += n * CONTRABAND_SELL;
  return true;
}

/** Rising price for the next level of an upgrade kind. */
export function upgradeCost(state, kind) {
  const def = UPGRADES[kind];
  if (!def) return Infinity;
  const level = state.upgrades[kind] ?? 0;
  if (level >= def.max) return Infinity;
  return def.cost * (level + 1);
}

/** Buy one level of an upgrade ('tyres' | 'engine' | 'armour'). False when broke or maxed. */
export function buyUpgrade(state, kind) {
  const def = UPGRADES[kind];
  if (!def) return false;
  const level = state.upgrades[kind] ?? 0;
  if (level >= def.max) return false;
  const cost = upgradeCost(state, kind);
  if (state.money < cost) return false;
  state.money -= cost;
  state.upgrades[kind] = level + 1;
  return true;
}

/** Rows for the shop panel: {id, label, detail, price, canBuy}. */
export function shopItems(state) {
  const items = [
    { id: 'buy', label: 'Beli Kontraband', detail: `Stok: ${state.inventory.contraband}`, price: CONTRABAND_BUY, canBuy: state.money >= CONTRABAND_BUY },
    { id: 'sell', label: 'Jual Kontraband', detail: `Stok: ${state.inventory.contraband}`, price: -CONTRABAND_SELL, canBuy: state.inventory.contraband > 0 },
  ];
  for (const kind of ['tyres', 'engine', 'armour']) {
    const def = UPGRADES[kind];
    const level = state.upgrades[kind] ?? 0;
    items.push({
      id: `up:${kind}`,
      label: `${def.label}  Lv ${level}/${def.max}`,
      detail: def.effect,
      price: level >= def.max ? 0 : upgradeCost(state, kind),
      canBuy: level < def.max && state.money >= upgradeCost(state, kind),
    });
  }
  return items;
}

/** Buy the shop row with this id. Returns true when something changed. */
export function buyShopItem(state, id) {
  if (id === 'buy') return buyContraband(state, 1);
  if (id === 'sell') return sellContraband(state, 1);
  if (id.startsWith('up:')) return buyUpgrade(state, id.slice(3));
  return false;
}

/** True when the player is on foot near a market stall (within SHOP_RANGE px). */
export const SHOP_RANGE = 85;

export function nearestStall(state, city) {
  const p = state.player;
  if (!p.onFoot) return null;
  let best = null;
  let bestD = SHOP_RANGE;
  for (const s of city.stalls) {
    const cx = s.x + s.w / 2;
    const cy = s.y + s.h / 2;
    const d = Math.hypot(cx - p.x, cy - p.y);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}
