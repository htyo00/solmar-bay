// The deterministic screenshot scenes behind ?shot=chase|title|mission|complete.
//
// Each scene plays the real rules forward from a fresh world for a fixed
// number of steps, so the frame is a moment of genuine play — not a mockup —
// and the same seed always paints the same frame. The loop then paints it
// twice and raises window.__shotReady.
import { STEP, POLICE_CAR } from './config.js';
import { createCar } from './vehicles.js';
import { resetWorld, stepWorld } from './world.js';

// An input that never presses anything: staged scenes drive themselves.
const noInput = {
  forward: () => false,
  back: () => false,
  left: () => false,
  right: () => false,
  run: () => false,
  handbrake: () => false,
  steal: () => false,
  takeDrag: () => 0,
  takeActions: () => 0,
};

// Seat Dante in a car at a spot, facing a heading, rolling at a speed.
function putDriver(world, car, x, z, heading, speed) {
  car.isPlayer = true;
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speed;
  world.player.inCar = car;
  world.player.group.visible = false;
  world.player.x = x;
  world.player.z = z;
}

// A cruiser already on the player's tail, rolling at speed.
function addTail(world, x, z, heading, speed) {
  const car = createCar(POLICE_CAR, x, z, heading, { isPolice: true });
  car.speed = speed;
  world.police.cars.push(car);
  world.cars.push(car);
  world.scene.add(car.group);
  return car;
}

// Roll the staged world forward with the throttle held down.
function driveForward(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, STEP, noInput, { throttle: 1, steer: 0, handbrake: false });
  }
}

// Frame the camera over the player's shoulder: (dx, dy, dz) is where the
// camera sits relative to the car, (ax, ay, az) is where it looks.
function shoulderCam(world, dx, dy, dz, ax, ay, az) {
  const car = world.player.inCar;
  world.shotCam = {
    x: car.x + dx, y: dy, z: car.z + dz,
    lx: car.x + ax, ly: ay, lz: car.z + az,
  };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * chase: the cover — a police chase down Ocean Drive, 4 stars, minimap, objective.
 * title: the title screen over a slow orbit of the city.
 * mission: the mission banner — Dante driving the Comet GT to the Marina.
 * complete: the mission-complete screen, grade S, over the car at the pier.
 */
export function stageShot(name, world) {
  resetWorld(world);
  world.noBanner = true; // staged shots frame the action, not the notification
  world.cameraMode = 'play';
  const comet = world.cars.find((car) => car.model.name === 'Comet GT');

  if (name === 'title') {
    world.cameraMode = 'title';
    world.elapsed = 40; // a fixed orbit angle: downtown + the bay behind the logo
    for (let i = 0; i < 30; i += 1) stepWorld(world, STEP, noInput, null);
    return 'title';
  }

  if (name === 'mission') {
    // On the street, not the sidewalk: east down the Hills avenue toward the bay.
    putDriver(world, comet, -58, -60, Math.PI / 2, 12);
    world.wanted.stars = 1;
    addTail(world, -72, -60, Math.PI / 2, 14);
    world.missions.active = true;
    world.missions.step = 1;
    world.missions.objective = 'Drive the Comet GT to the Marina pier';
    world.missions.waypoint = { x: world.city.pier.x, z: world.city.pier.z, label: 'Marina pier' };
    world.feed('Mara Voss: "Take the Hills avenue down to the pier. Don\'t scratch her."');
    driveForward(world, 1.5);
    shoulderCam(world, -8, 4, 9, 12, 1.5, -2);
    return 'play';
  }

  if (name === 'complete') {
    putDriver(world, comet, world.city.pier.x, world.city.pier.z - 6, Math.PI, 0);
    world.saveMissionResult = {
      mission: 'FIRST JOB',
      grade: 'S',
      seconds: 132,
      payout: 500,
      stats: { carsStolen: 1, topSpeed: 142 },
      garage: ['Comet GT'],
    };
    world.missions.objective = 'Job done. Mara Voss is pleased.';
    return 'complete';
  }

  // Default: chase. The cover — a police chase down Ocean Drive at neon
  // dusk: the Comet GT westbound under the SOLMAR BAY arch, 4 stars, the
  // heli's searchlight overhead, two cruisers on its tail, HUD complete.
  world.save.cash = 7420; // a mid-game state: big cash, real variable
  putDriver(world, comet, 44, 100, -Math.PI / 2, 28);
  world.wanted.stars = 4;
  world.police.heliAngle = Math.PI; // heli ahead-west, in frame over the arch
  addTail(world, 56, 102, -Math.PI / 2, 28);
  addTail(world, 62, 98, -Math.PI / 2, 28);
  // Clear the shot corridor: no traffic car may sit in the hero's path.
  for (const car of world.traffic) {
    if (Math.abs(car.z - 100) < 8 && car.x > -20 && car.x < 70) {
      car.x = -90;
      car.z = -60;
    }
  }
  world.missions.active = true;
  world.missions.step = 2;
  world.missions.objective = 'Lose the cops — break line of sight until the stars drop';
  world.missions.waypoint = { x: world.city.pier.x, z: world.city.pier.z, label: 'Marina pier' };
  world.feed('SBPD: vehicle theft reported in Ocean Drive. Units responding.');
  world.feed('Mara Voss: "Lose them first, then deliver."');
  driveForward(world, 0.6);
  shoulderCam(world, 9, 3.8, 8, -12, 1.5, -2);
  return 'play';
}
