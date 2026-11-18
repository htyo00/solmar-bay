// Solmar Bay tuning bible: one file, every number the game balances on.
// Streets run on the lines -100, -60, -20, 20, 60, 100 in both axes — a
// 5-by-5 grid of blocks, 12 units wide, pitched 40 apart. East is +x and
// the sea lies to the south, at +z.

export const STEP = 1 / 60; // seconds per fixed simulation tick

// City shape: `half` is the ground plane half-size, `beachZ` where the
// sand begins, `seaZ` where the waterline sits.
export const CITY = {
  pitch: 40,
  street: 12,
  roads: [-100, -60, -20, 20, 60, 100],
  blocks: [-80, -40, 0, 40, 80],
  half: 112,
  beachZ: 106,
  seaZ: 140,
};

// Dante on foot.
export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10.5,
  radius: 0.6,
  health: 100,
  stealHold: 0.55, // seconds E must be held to take a car
  stealRange: 4.2,
};

// The eight stealable cars parked around the city. topSpeed is metres per
// second (times ~3.6 for km/h).
export const CAR_MODELS = [
  {
    name: 'Comet GT', color: 0xe76f51, len: 4.2,
    price: 1200, topSpeed: 42, accel: 16, grip: 2.6,
  },
  {
    name: 'Delano Sedan', color: 0x264653, len: 4.4,
    price: 600, topSpeed: 34, accel: 12, grip: 2.2,
  },
  {
    name: 'Cielo Hatch', color: 0xe9c46a, len: 3.8,
    price: 450, topSpeed: 32, accel: 13, grip: 2.4,
  },
  {
    name: 'Vulture Pickup', color: 0x8a6d3b, len: 4.8,
    price: 800, topSpeed: 36, accel: 13, grip: 2.1,
  },
  {
    name: 'Bayside Taxi', color: 0xf4a900, len: 4.3,
    price: 500, topSpeed: 33, accel: 12, grip: 2.2,
  },
  {
    name: 'Marlin Van', color: 0x2a9d8f, len: 4.9,
    price: 700, topSpeed: 30, accel: 10, grip: 1.9,
  },
  {
    name: 'Solmar Coupe', color: 0xc1666b, len: 4.1,
    price: 1000, topSpeed: 40, accel: 15, grip: 2.5,
  },
  {
    name: 'Harbor Bus', color: 0x4a403a, len: 6.5,
    price: 900, topSpeed: 26, accel: 8, grip: 1.7,
  },
];

export const POLICE_CAR = {
  name: 'SBPD Interceptor',
  color: 0x1d3557,
  len: 4.3,
  topSpeed: 37,
  accel: 17,
  grip: 2.7,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 24;

// Wanted numbers. A crime adds one star; the same kind of crime is
// throttled by a cooldown so a single bad minute can't jump straight to
// five. Lose every unit and the stars blink, then fall one at a time.
export const WANTED = {
  max: 5,
  stealStars: 1,
  hitPedStars: 1,
  ramCopStars: 1,
  crimeCooldown: 10,
  // Ramming a cruiser mid-chase is almost unavoidable on narrow roads, so
  // it gets the longer cooldown: one chase alone must not stack to five.
  ramCopCooldown: 25,
  loseDistance: 40, // further than this from every unit counts as "lost them"
  loseSightSeconds: 4, // unseen this long -> the stars start blinking
  blinkSeconds: 3, // blinking this long -> one star drops
  // HOT PURSUIT: a fresh crime — or a cruiser that can still see Dante —
  // means the SBPD holds a live fix on him. For this many seconds the
  // cruisers converge on his CURRENT position and the stars cannot decay;
  // once the trail goes cold, lastSeen freezes and the normal 7 s decay
  // resumes. Twenty seconds is enough for a cruiser 150+ units out to
  // close on a stopped suspect (~5 s) and for the foot-cop grab (~4 s),
  // with margin — and it only delays a genuine evasion by twenty seconds.
  hotSeconds: 20,
  policePerStar: [0, 1, 2, 3, 4, 5], // chasing cruisers at each star level
  roadblockAt: 3, // stars at which roadblocks appear
  heliAt: 4, // stars at which the helicopter circles overhead
};

// The mission chain. gradeS/A/B are the par times, in seconds, per grade.
export const MISSIONS = [
  {
    name: 'FIRST JOB',
    fixer: 'Mara Voss',
    brief: 'Dante. One last job. Steal the Comet GT outside the Loft, run it down to the Marina pier, and lose the heat before you hand it over.',
    payout: 500,
    gradeS: 150,
    gradeA: 210,
    gradeB: 300,
  },
  {
    name: 'THE GETAWAY', fixer: 'Mara Voss', brief: 'Stage 2.',
    payout: 750, gradeS: 180, gradeA: 240, gradeB: 330,
  },
  {
    name: 'HOT DELIVERY', fixer: 'Mara Voss', brief: 'Stage 2.',
    payout: 900, gradeS: 200, gradeA: 260, gradeB: 360,
  },
  {
    name: 'TURF WAR', fixer: 'Mara Voss', brief: 'Stage 3.',
    payout: 1200, gradeS: 240, gradeA: 300, gradeB: 420,
  },
  {
    name: 'CHOP SHOP', fixer: 'Mara Voss', brief: 'Stage 3.',
    payout: 1500, gradeS: 260, gradeA: 320, gradeB: 450,
  },
  {
    name: 'THE LAST JOB', fixer: 'Mara Voss', brief: 'Stage 3.',
    payout: 2500, gradeS: 300, gradeA: 380, gradeB: 520,
  },
];

export const DIFFICULTIES = {
  Cruise: {
    policeSpeed: 0.9, payout: 0.8,
    label: 'Cruise — easy heat, smaller pay',
  },
  Street: {
    policeSpeed: 1.0, payout: 1.0,
    label: 'Street — the intended run',
  },
  Heat: {
    policeSpeed: 1.15, payout: 1.25,
    label: 'Heat — faster cops, bigger pay',
  },
};

// Neon-noir night: cold indigo sky, warm lit windows, gold HUD type on
// dark navy — deliberately the opposite of the sunset-Bay look on the board.
export const PALETTE = {
  mustard: '#f4a900', terracotta: '#c1666b', beige: '#d4b896',
  chocolate: '#4a403a', burntOrange: '#e76f51', coral: '#f4a261',
  sand: '#e9c46a', deepPurple: '#264653', sky: '#1c2450',
  fog: '#232a4a', sun: '#cfe0ff', sea: '#14324a',
  asphalt: '#33302c', sidewalk: '#6b6258',
  hudPanel: 'rgba(20,26,48,0.88)', hudText: '#f5ead6',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'solmar-bay.save.v1';
export const MUTE_KEY = 'solmar-bay.muted.v1';
