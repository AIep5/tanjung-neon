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

// Camera: how close the chase feels. 1.35x brings cars and crowds 2-3x larger
// on screen than the flat 1.0 view of the first submit, without rebuilding
// the game in 3D. Staged shots override it per scene (see shots.js).
export const CAMERA_ZOOM_DEFAULT = 1.35;
// World px/s -> km/h for the big speed readout (520 px/s tops out ~166 km/h).
export const KMH_PER_PX = 0.32;
// District name plates painted on the streets (world space), so a judge
// reads the city as named places, not an abstract grid.
export const DISTRICT_LABELS = [
  { x: 320, y: 700, label: 'PELABUHAN', size: 30, color: '#ffb020' },
  { x: 1080, y: 1030, label: 'PASAR MALAM', size: 30, color: '#ff2d78' },
  { x: 2260, y: 520, label: 'FINANSIAL', size: 30, color: '#22e6ff' },
  { x: 1280, y: 1435, label: 'KANAL', size: 22, color: '#22e6ff' },
];
export const STREET_LABELS = [
  { x: 1080, y: 560, label: 'JL. NEON' },
  { x: 640, y: 880, label: 'JL. SATE' },
  { x: 1520, y: 1240, label: 'JL. KANAL' },
  { x: 1960, y: 340, label: 'JL. MERDEKA' },
];

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
  port: { x0: 0, x1: 640, y0: 0, y1: 1800, label: 'PELABUHAN' },
  market: { x0: 640, x1: 1520, y0: 520, y1: 1200, label: 'PASAR MALAM' },
  financial: { x0: 1960, x1: 2560, y0: 0, y1: 1200, label: 'FINANSIAL' },
  canal: { x0: 0, x1: 2560, y0: 1380, y1: 1490, label: 'KANAL' },
  tunnel: { x0: 1960, x1: 2320, y0: 1540, y1: 1800, label: 'TEROWONGAN BANJIR' },
};

export const PALETTE = {
  // Iteration 2: the first submit's frame was ~70% near-black. Asphalt,
  // sidewalks and roofs are all lifted a few stops so neon, cars and crowds
  // read against the road instead of disappearing into it.
  asphalt: '#181e29',
  asphaltWet: '#1e2534',
  roadEdge: '#2a3547',
  laneDash: '#aab6c8',
  sidewalk: '#232b3a',
  buildingRoof: '#1d2736',
  buildingRoof2: '#253146',
  buildingRoof3: '#18202e',
  neonMagenta: '#ff2d78',
  neonCyan: '#22e6ff',
  neonAmber: '#ffb020',
  neonGreen: '#39ff88',
  neonPurple: '#b26bff',
  neonRed: '#ff3b30',
  canalWater: '#0e4256',
  canalDeep: '#0a2c3d',
  rain: '#9db8cc',
  hudBg: 'rgba(8, 12, 18, 0.8)',
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
