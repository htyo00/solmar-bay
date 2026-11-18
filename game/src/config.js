// All tuning for Solmar Bay. One place, so the playtest can reason about it.
export const CFG = {
  // world
  roadLines: [-200, -100, 0, 100, 200],
  roadHalf: 7,
  bound: 252,
  bayX: 262,
  pierZ: 100,
  pierEndX: 322,
  // clock: fixed step, many steps per frame so game time tracks wall time
  // even when SwiftShader only manages a few frames a second.
  step: 1 / 60,
  maxSteps: 48,
  frameCap: 0.9,
  // on foot
  walkSpeed: 7,
  runSpeed: 10.5,
  turnRate: 9,
  maxHealth: 100,
  maxArmor: 100,
  // cars (arcade)
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  steerRate: 2.1,
  grip: 0.92,
  nitroBoost: 13,
  nitroMax: 100,
  nitroDrain: 32,
  nitroRegen: 7,
  topSpeed: { comet: 35, sedan: 27, taxi: 26, truck: 21, van: 23, cruiser: 30.5 },
  // wanted
  maxStars: 5,
  sightRange: 72,
  sightRangeFoot: 46,
  hiddenPerStar: 8,
  copCatchDist: 1.7,
  bustHold: 1.1,
  // police numbers by stars: [cruisers, foot cops]
  force: [[0, 0], [1, 1], [2, 2], [3, 2], [4, 3], [5, 3]],
  cruiserSpawnDist: 90,
  footSpawnDist: 42,
  // traffic + peds
  trafficCars: 14,
  peds: 22,
  // mission 1 payouts by grade
  pay: { S: 1200, A: 1000, B: 900, C: 850 },
  gradeTime: { S: 75, A: 110, B: 160 },
  coinValue: 50,
  bustFine: 100,
  wastedFine: 100,
};
