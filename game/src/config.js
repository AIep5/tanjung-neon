// Tanjung Neon — tuning + palette.
// Logical viewport 1280x720, world 2560x1800. Night city, wet asphalt, neon.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const WORLD_W = 2560;
export const WORLD_H = 1800;

export const FIXED_DT = 1 / 60;
export const MAX_FRAME = 0.25;

export const SAVE_KEY = 'tanjung-neon.save';
export const BEST_KEY = 'tanjung-neon.best';

// Road grid (centres, px). Roads are 90 wide.
export const ROADS_X = [200, 640, 1080, 1520, 1960, 2320];
export const ROADS_Y = [180, 520, 860, 1200, 1540];
export const ROAD_W = 90;

// Canal: horizontal water strip, crossed by bridges on two vertical roads.
export const CANAL = { y0: 1380, y1: 1490, bridges: [1080, 1960] };
// Flood tunnel: the y=1540 road segment from x=1960 to x=2320 is enclosed.
export const TUNNEL = { x0: 1960, x1: 2320, y: 1540, w: ROAD_W };

// Districts (x/y bounds in world space).
export const DISTRICTS = {
  port: { x0: 0, x1: 640, y0: 0, y1: 1800, label: 'PORT' },
  market: { x0: 640, x1: 1520, y0: 520, y1: 1200, label: 'NIGHT MARKET' },
  financial: { x0: 1960, x1: 2560, y0: 0, y1: 1200, label: 'FINANCIAL' },
  canal: { x0: 0, x1: 2560, y0: 1380, y1: 1490, label: 'CANAL' },
  tunnel: { x0: 1960, x1: 2320, y0: 1540, y1: 1800, label: 'FLOOD TUNNEL' },
};

export const PALETTE = {
  asphalt: '#0d1117',
  asphaltWet: '#12161d',
  roadEdge: '#1c2530',
  laneDash: '#8a94a6',
  sidewalk: '#171d26',
  buildingRoof: '#131a24',
  buildingRoof2: '#1a2230',
  buildingRoof3: '#10151f',
  neonMagenta: '#ff2d78',
  neonCyan: '#22e6ff',
  neonAmber: '#ffb020',
  neonGreen: '#39ff88',
  neonPurple: '#b26bff',
  neonRed: '#ff3b30',
  canalWater: '#0a2e3d',
  canalDeep: '#071f2b',
  rain: '#9db8cc',
  hudBg: 'rgba(8, 12, 18, 0.72)',
  hudText: '#e8f1f8',
  hudDim: '#8fa3b5',
  vignette: 'rgba(2, 4, 8, 0.55)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const TUNING = {
  walkSpeed: 230,
  carAccel: 420,
  carMaxSpeed: 520,
  carReverseMax: 160,
  carBrake: 620,
  carDrag: 0.55, // per-second speed decay while coasting
  carTurnRate: 3.6, // rad/s at full steer, scaled by speed factor
  trafficCruise: 150,
  trafficAccel: 260,
  pedSpeed: 55,
  pedSpeedMarket: 75,
  enterRange: 46,
  missionRadius: 70,
  cameraLerp: 6,
};

export const UPGRADES = {
  tyres: { cost: 150, max: 3, label: 'Ban Hujan', effect: '+grip di jalan basah' },
  engine: { cost: 300, max: 3, label: 'Mesin', effect: '+kecepatan puncak' },
  armour: { cost: 250, max: 3, label: 'Bodi Baja', effect: '+tahan benturan' },
};

export const CONTRABAND_BUY = 15;
export const CONTRABAND_SELL = 25;
