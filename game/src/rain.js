// Rain — dynamic weather: drizzle <-> storm fronts, deterministic from elapsed
// time (seeded phase per world), lightning flashes every ~20-35 s, puddle
// strength that follows intensity. No Math.random: the schedule is a pure
// function of elapsed + the world's seeded phase.

export const DROP_COUNT = 220;

export function createRain(random) {
  const drops = [];
  for (let i = 0; i < DROP_COUNT; i += 1) {
    drops.push({
      x: random() * 1280,
      y: random() * 720,
      len: 14 + random() * 22,
      speed: 620 + random() * 380,
      drift: -40 - random() * 60,
    });
  }
  // Seeded phase so different seeds get different weather fronts.
  const phase = random() * Math.PI * 2;
  const flashGap = 20 + random() * 15;
  return {
    intensity: 0.35,
    drops,
    storm: false,
    phase,
    flash: 0,
    nextFlash: 18 + flashGap,
    flashGap,
    puddle: 0.35,
  };
}

/**
 * Weather fronts: a slow sine swell (period ~75 s) over a base that builds
 * from drizzle to a storm peak around t=40-60 s, then eases. Lightning fires
 * on a deterministic schedule (nextFlash), only while it is storming hard.
 */
export function stepRain(rain, dt, elapsed) {
  const swell = 0.5 + 0.5 * Math.sin(elapsed * 0.084 + rain.phase);
  let base;
  if (elapsed < 8) base = 0.3;
  else if (elapsed < 35) base = 0.3 + 0.55 * ((elapsed - 8) / 27);
  else if (elapsed < 60) base = 0.85;
  else if (elapsed < 95) base = 0.85 - 0.35 * ((elapsed - 60) / 35);
  else base = 0.5;
  const target = Math.max(0.12, Math.min(1, base * (0.55 + 0.45 * swell) + 0.12 * swell));
  // Ease toward the target so fronts roll in instead of snapping.
  rain.intensity += (target - rain.intensity) * Math.min(1, 0.5 * dt);
  rain.storm = rain.intensity >= 0.8;
  rain.puddle = rain.intensity;

  // Lightning: a brief full-screen flash when a storm peak is due.
  if (elapsed >= rain.nextFlash) {
    if (rain.intensity >= 0.65) rain.flash = 1;
    // Next strike in ~20-35 s, deterministic from the strike count.
    const n = Math.floor(elapsed / 10) + 1;
    const frac = (Math.sin(n * 12.9898) * 43758.5453) % 1;
    rain.nextFlash = elapsed + 20 + 15 * Math.abs(frac);
  }
  if (rain.flash > 0) rain.flash = Math.max(0, rain.flash - dt * 3.5);

  // Drops fall; recycle at the bottom with a seeded-looking offset from elapsed.
  for (const drop of rain.drops) {
    drop.y += drop.speed * dt * (0.7 + 0.3 * rain.intensity);
    drop.x += drop.drift * dt;
    if (drop.y > 720) {
      drop.y = -drop.len;
      drop.x = (drop.x + 97) % 1280;
    }
    if (drop.x < -10) drop.x += 1300;
  }
}

/** Force a storm now (hook for weather events). */
export function startStorm(rain) {
  rain.intensity = 1.0;
  rain.storm = true;
  rain.flash = 1;
}

/** Grip multiplier from rain: 1.0 dry .. 0.55 in the heaviest storm. */
export function gripFactor(rain) {
  return Math.max(0.55, 1.0 - 0.45 * rain.intensity);
}

/**
 * Wanted-decay multiplier from rain: heavy rain (> 0.8) washes the trail
 * x3 faster, so the player can lose the heat in a storm.
 */
export function washWanted(rain) {
  if (!rain) return 1;
  return rain.intensity > 0.8 ? 3 : 1;
}
