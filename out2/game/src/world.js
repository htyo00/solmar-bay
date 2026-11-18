// The world: one state object, every system stepped in a fixed order, events
// returned as bit flags so the loop can react without the world knowing about
// screens or sound. Nothing here draws or touches the DOM.
import { STEP, CAR_MODELS, DIFFICULTIES } from './config.js';
import { createRandom, pick } from './random.js';
import { createCity, createCityMeshes, districtAt } from './city.js';
import { createCar, stepCar } from './vehicles.js';
import { createPlayer, stepPlayer, exitCar, drivingInput } from './player.js';
import { createTraffic, stepTraffic } from './traffic.js';
import { createPeds, stepPeds, addFleeingPed } from './pedestrians.js';
import { createPolice, stepPolice } from './police.js';
import { createWanted, crime, stepWanted } from './wanted.js';
import { createMissions, startMission, stepMissions } from './missions.js';
import { resolveCombat } from './combat.js';
import { loadSave } from './save.js';

export const EVENT_STEAL = 1;
export const EVENT_HIT_PED = 2;
export const EVENT_WANTED = 4;
export const EVENT_OBJECTIVE = 8;
export const EVENT_COMPLETE = 16;
export const EVENT_BUSTED = 32;
export const EVENT_WASTED = 64;
export const EVENT_RAM_COP = 128;

const DISTRICT_NAMES = { downtown: 'Downtown', marina: 'Marina', hills: 'Hills', port: 'Port', beach: 'Ocean Drive' };

const PARKED_SPOTS = [
  { x: -20, z: -52, heading: Math.PI / 2 },
  { x: 20, z: 68, heading: -Math.PI / 2 },
  { x: 68, z: -20, heading: 0 },
  { x: -68, z: 20, heading: Math.PI },
  { x: 40, z: 108, heading: Math.PI / 2 },
];

export function createWorld(seed, scene) {
  const random = createRandom(seed);
  const city = createCity(random);
  const save = loadSave();
  const world = {
    seed, random, city, save, scene,
    elapsed: 0,
    events: 0,
    shake: 0,
    handbrakeSmoke: false,
    lastImpact: 0,
    cameraMode: 'title',
    shotCam: null,
    difficulty: DIFFICULTIES[save.difficulty] || DIFFICULTIES.Street,
    difficultyName: save.difficulty,
    feedLog: [],
    fpsSample: null,
    saveMissionResult: null,
    player: null,
    cars: [],
    traffic: [],
    peds: [],
    police: null,
    wanted: null,
    missions: null,
  };
  world.feed = (text) => {
    world.feedLog.push(text);
    if (world.feedLog.length > 6) world.feedLog.shift();
  };
  world.crime = (type) => crime(world, type);
  world.districtName = (x, z) => {
    const bx = [-80, -40, 0, 40, 80].reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
    const bz = [-80, -40, 0, 40, 80].reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a));
    return DISTRICT_NAMES[districtAt(bx, bz)] || 'Solmar Bay';
  };
  world.addFleeingPed = (x, z) => addFleeingPed(world, x, z);

  scene.add(createCityMeshes(city, random));
  world.player = createPlayer(city);
  scene.add(world.player.group);
  spawnParkedCars(world, random);
  world.traffic = createTraffic(world, random);
  for (const car of world.traffic) scene.add(car.group);
  world.peds = createPeds(world, random);
  world.police = createPolice(world);
  world.wanted = createWanted();
  world.missions = createMissions(world);
  return world;
}

function spawnParkedCars(world, random) {
  const comet = createCar(CAR_MODELS[0], world.city.cometSpot.x, world.city.cometSpot.z, world.city.cometSpot.heading);
  world.cars.push(comet);
  world.scene.add(comet.group);
  for (const spot of PARKED_SPOTS) {
    const model = pick(random, CAR_MODELS.slice(1));
    const car = createCar(model, spot.x, spot.z, spot.heading);
    world.cars.push(car);
    world.scene.add(car.group);
  }
}

function clearPolice(world) {
  for (const car of world.police.cars) {
    world.scene.remove(car.group);
    world.cars.splice(world.cars.indexOf(car), 1);
  }
  for (const car of world.police.roadblock) {
    world.scene.remove(car.group);
    world.cars.splice(world.cars.indexOf(car), 1);
  }
  for (const cop of world.police.footCops) world.scene.remove(cop.group);
  world.police.cars = [];
  world.police.roadblock = [];
  world.police.footCops = [];
  world.police.heli.visible = false;
}

/** Back to the start of mission 1: Dante on foot at the Loft, city reset. */
export function resetWorld(world) {
  const player = world.player;
  if (player.inCar) {
    player.inCar.isPlayer = false;
    player.inCar = null;
  }
  player.x = world.city.start.x;
  player.z = world.city.start.z;
  player.heading = world.city.start.heading;
  player.camYaw = world.city.start.heading;
  player.health = 100;
  player.speed = 0;
  player.group.visible = true;
  player.group.position.set(player.x, 0, player.z);
  clearPolice(world);
  // Parked cars back to their spots, traffic respawned fresh.
  for (const car of world.cars) world.scene.remove(car.group);
  world.cars = [];
  for (const car of world.traffic) world.scene.remove(car.group);
  world.traffic = [];
  spawnParkedCars(world, world.random);
  world.traffic = createTraffic(world, world.random);
  for (const car of world.traffic) world.scene.add(car.group);
  for (const ped of world.peds) {
    ped.state = 'walk';
    ped.fleeTimer = 0;
    ped.fallenTimer = 0;
    ped.group.rotation.x = 0;
    ped.group.position.y = 0;
  }
  world.wanted = createWanted();
  world.missions = createMissions(world);
  for (const coin of world.city.coins) {
    coin.taken = false;
    if (coin.mesh) coin.mesh.visible = true;
  }
  for (const crate of world.city.armorCrates) {
    crate.taken = false;
    if (crate.mesh) crate.mesh.visible = true;
  }
  world.elapsed = 0;
  world.shake = 0;
  world.feedLog = [];
  world.saveMissionResult = null;
  world.cameraMode = 'play';
  world.shotCam = null;
}

/**
 * One fixed step. `driveOverride` (shots) steers the player car directly;
 * otherwise the keyboard drives. Returns the event flags for this step.
 */
function stepPickups(world) {
  const player = world.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;
  for (const coin of world.city.coins) {
    if (!coin.taken && Math.hypot(px - coin.x, pz - coin.z) < 2.2) {
      coin.taken = true;
      if (coin.mesh) coin.mesh.visible = false;
      world.save.stats.coins += 1;
      world.save.cash += 25;
      world.feed(`Bay Coin ${world.save.stats.coins}/8 — +$25.`);
    }
  }
  for (const crate of world.city.armorCrates) {
    if (!crate.taken && !player.inCar && Math.hypot(px - crate.x, pz - crate.z) < 2.2) {
      crate.taken = true;
      if (crate.mesh) crate.mesh.visible = false;
      player.armor = Math.min(100, player.armor + 50);
      world.feed('SBPD vest picked up — armour +50.');
    }
  }
}

export function stepWorld(world, dt, input, driveOverride) {
  world.elapsed += dt;
  world.lastImpact = 0;
  let events = 0;
  const player = world.player;
  if (player.inCar) {
    const car = player.inCar;
    const drive = driveOverride || drivingInput(input);
    world.handbrakeSmoke = drive.handbrake && Math.abs(car.speed) > 10;
    const impact = stepCar(car, drive, dt, world.city, world.cars);
    if (impact > 0) world.lastImpact = impact;
    if (impact > 8) world.shake = Math.min(1, world.shake + impact / 25);
    // Keep Dante's position and facing glued to his car: every distance
    // check and the exit facing read them.
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    // Tap E while crawling to step out.
    if (input.steal() && !player.prevSteal && Math.abs(car.speed) < 2) exitCar(world);
    player.prevSteal = input.steal();
    player.camYaw = car.heading;
  } else {
    events |= stepPlayer(world, dt, input);
    player.prevSteal = input.steal();
  }
  stepPickups(world);
  events |= stepTraffic(world, dt, world.random);
  events |= stepPeds(world, dt);
  events |= stepPolice(world, dt, world.random);
  stepWanted(world, dt);
  events |= resolveCombat(world, dt);
  events |= stepMissions(world, dt, events);
  world.events = events;
  return events;
}

export { STEP, startMission };
