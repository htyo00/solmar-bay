// SOLMAR BAY — every tuning number and colour in one place.
// The city is a 5x5 block grid on a 40-unit pitch; streets 12 wide run at
// x and z = -100, -60, -20, 20, 60, 100. +x is east, +z is south (the sea).

export const STEP = 1 / 60; // fixed simulation step, seconds

export const CITY = {
  pitch: 40,
  street: 12,
  roads: [-100, -60, -20, 20, 60, 100],
  blocks: [-80, -40, 0, 40, 80],
  half: 112, // ground plane half-size
  beachZ: 106, // sand starts here; the sea is further south
  seaZ: 140,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10.5,
  radius: 0.6,
  health: 100,
  stealHold: 0.55, // seconds holding E to take a car
  stealRange: 4.2,
};

// Eight named, stealable car models. topSpeed in m/s (~x3.6 = km/h).
export const CAR_MODELS = [
  { name: 'Comet GT', color: 0xe76f51, topSpeed: 42, accel: 16, grip: 2.6, price: 1200, len: 4.2 },
  { name: 'Delano Sedan', color: 0x264653, topSpeed: 34, accel: 12, grip: 2.2, price: 600, len: 4.4 },
  { name: 'Cielo Hatch', color: 0xe9c46a, topSpeed: 32, accel: 13, grip: 2.4, price: 450, len: 3.8 },
  { name: 'Vulture Pickup', color: 0x8a6d3b, topSpeed: 36, accel: 13, grip: 2.1, price: 800, len: 4.8 },
  { name: 'Bayside Taxi', color: 0xf4a900, topSpeed: 33, accel: 12, grip: 2.2, price: 500, len: 4.3 },
  { name: 'Marlin Van', color: 0x2a9d8f, topSpeed: 30, accel: 10, grip: 1.9, price: 700, len: 4.9 },
  { name: 'Solmar Coupe', color: 0xc1666b, topSpeed: 40, accel: 15, grip: 2.5, price: 1000, len: 4.1 },
  { name: 'Harbor Bus', color: 0x4a403a, topSpeed: 26, accel: 8, grip: 1.7, price: 900, len: 6.5 },
];

export const POLICE_CAR = { name: 'SBPD Interceptor', color: 0x1d3557, topSpeed: 40, accel: 17, grip: 2.7, len: 4.3 };

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 24;

// Wanted stars: crimes add stars, heat fades when no police unit can see you.
export const WANTED = {
  max: 5,
  stealStars: 1,
  hitPedStars: 1,
  ramCopStars: 1,
  crimeCooldown: 10, // seconds before the same crime type adds a star again
  loseSightSeconds: 8, // unseen this long -> stars start blinking, then drop one
  blinkSeconds: 3,
  policePerStar: [0, 1, 2, 3, 4, 5], // chasing police cars per star level
  roadblockAt: 3, // stars at which roadblocks appear
  heliAt: 4, // stars at which the police helicopter circles
};

export const MISSIONS = [
  {
    name: 'FIRST JOB',
    fixer: 'Mara Voss',
    brief: 'Dante. One last job. Steal the Comet GT outside the Loft, run it down to the Marina pier, and lose the heat before you hand it over.',
    payout: 500,
    gradeS: 150, gradeA: 210, gradeB: 300, // seconds for each grade
  },
  { name: 'THE GETAWAY', fixer: 'Mara Voss', brief: 'Stage 2.', payout: 750, gradeS: 180, gradeA: 240, gradeB: 330 },
  { name: 'HOT DELIVERY', fixer: 'Mara Voss', brief: 'Stage 2.', payout: 900, gradeS: 200, gradeA: 260, gradeB: 360 },
  { name: 'TURF WAR', fixer: 'Mara Voss', brief: 'Stage 3.', payout: 1200, gradeS: 240, gradeA: 300, gradeB: 420 },
  { name: 'CHOP SHOP', fixer: 'Mara Voss', brief: 'Stage 3.', payout: 1500, gradeS: 260, gradeA: 320, gradeB: 450 },
  { name: 'THE LAST JOB', fixer: 'Mara Voss', brief: 'Stage 3.', payout: 2500, gradeS: 300, gradeA: 380, gradeB: 520 },
];

export const DIFFICULTIES = {
  Cruise: { policeSpeed: 0.9, payout: 0.8, label: 'Cruise — easy heat, smaller pay' },
  Street: { policeSpeed: 1.0, payout: 1.0, label: 'Street — the intended run' },
  Heat: { policeSpeed: 1.15, payout: 1.25, label: 'Heat — faster cops, bigger pay' },
};

// Neon-noir night (theme-factory): cold indigo sky, warm lit windows, gold
// HUD on dark navy — the opposite of the sunset-Bay monoculture on the board.
export const PALETTE = {
  mustard: '#f4a900',
  terracotta: '#c1666b',
  beige: '#d4b896',
  chocolate: '#4a403a',
  burntOrange: '#e76f51',
  coral: '#f4a261',
  sand: '#e9c46a',
  deepPurple: '#264653',
  sky: '#1c2450',
  fog: '#232a4a',
  sun: '#cfe0ff',
  sea: '#14324a',
  asphalt: '#33302c',
  sidewalk: '#6b6258',
  hudPanel: 'rgba(20,26,48,0.88)',
  hudText: '#f5ead6',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'solmar-bay.save.v1';
export const MUTE_KEY = 'solmar-bay.muted.v1';
