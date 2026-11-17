// The deterministic screenshot scenes behind ?shot=chase|title|mission|complete.
// Each one plays the real rules forward from a fresh world for a fixed number
// of steps, so the frame is what a short game really looks like and the same
// seed always gives the same frame. The loop then paints it twice and sets
// window.__shotReady.
import { STEP, CAR_MODELS, POLICE_CAR } from './config.js';
import { createCar } from './vehicles.js';
import { resetWorld, stepWorld } from './world.js';

const nullInput = {
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

function putPlayerInCar(world, car, x, z, heading, speed) {
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

function addPoliceBehind(world, x, z, heading, speed) {
  const car = createCar(POLICE_CAR, x, z, heading, { isPolice: true });
  car.speed = speed;
  world.police.cars.push(car);
  world.cars.push(car);
  world.scene.add(car.group);
  return car;
}

function driveForward(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, STEP, nullInput, { throttle: 1, steer: 0, handbrake: false });
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * chase: the cover — a police chase down Ocean Drive, 3 stars, minimap, objective.
 * title: the title screen over a slow orbit of the city.
 * mission: the mission banner — Dante driving the Comet GT to the Marina.
 * complete: the mission-complete screen, grade S, over the car at the pier.
 */
export function stageShot(name, world) {
  resetWorld(world);
  world.cameraMode = 'play';
  const comet = world.cars.find((car) => car.model.name === 'Comet GT');
  if (name === 'title') {
    world.cameraMode = 'title';
    world.elapsed = 40; // a fixed orbit angle: downtown + the bay behind the logo
    for (let i = 0; i < 30; i += 1) stepWorld(world, STEP, nullInput, null);
    return 'title';
  }
  if (name === 'mission') {
    // On the street, not the sidewalk: east down the Hills avenue toward the bay.
    putPlayerInCar(world, comet, -58, -60, Math.PI / 2, 12);
    world.wanted.stars = 1;
    addPoliceBehind(world, -72, -60, Math.PI / 2, 14);
    world.missions.active = true;
    world.missions.step = 1;
    world.missions.objective = 'Drive the Comet GT to the Marina pier';
    world.missions.waypoint = { x: world.city.pier.x, z: world.city.pier.z, label: 'Marina pier' };
    world.feed('Mara Voss: "Clean work, Dante. $500 is yours."');
    driveForward(world, 1.5);
    return 'play';
  }
  if (name === 'complete') {
    putPlayerInCar(world, comet, world.city.pier.x, world.city.pier.z - 6, Math.PI, 0);
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
  // Default: chase. Short run-up so the cruisers stay close behind Dante,
  // and a side-rear camera that keeps them in the frame with him.
  putPlayerInCar(world, comet, -30, 60, Math.PI / 2, 28);
  world.wanted.stars = 3;
  addPoliceBehind(world, -42, 62, Math.PI / 2, 30);
  addPoliceBehind(world, -48, 58, Math.PI / 2, 30);
  world.missions.active = true;
  world.missions.step = 2;
  world.missions.objective = 'Lose the cops — break line of sight until the stars drop';
  world.missions.waypoint = { x: world.city.pier.x, z: world.city.pier.z, label: 'Marina pier' };
  world.feed('SBPD: vehicle theft reported in Ocean Drive. Units responding.');
  world.feed('Mara Voss: "Lose them first, then deliver."');
  driveForward(world, 0.8);
  const car = world.player.inCar;
  world.shotCam = { x: car.x - 4, y: 5.5, z: car.z - 15, lx: car.x + 10, ly: 1, lz: car.z + 3 };
  return 'play';
}
