// Traffic: AI cars driving the road graph on the right-hand side of the
// road. They follow their lane, slow for the car ahead, stop for a
// pedestrian or a crash in front of them, honk when blocked, and respawn
// far away when the player leaves them behind.
import { CAR_MODELS, TRAFFIC_COUNT } from './config.js';
import { createCar, stepCar } from './vehicles.js';
import { nearestRoad } from './city.js';
import { pick, range } from './random.js';

/** Lane offset for a direction of travel (right-hand traffic). */
function laneShift(dx, dz) {
  if (dx > 0) return { x: 0, z: 2.2 };
  if (dx < 0) return { x: 0, z: -2.2 };
  if (dz > 0) return { x: -2.2, z: 0 };
  return { x: 2.2, z: 0 };
}

function randomJunction(random, roads) {
  return { x: pick(random, roads), z: pick(random, roads) };
}

function pickNextLeg(random, roads, from, avoid) {
  const options = [];
  for (const delta of [-40, 40]) {
    if (roads.includes(from.x + delta)) options.push({ x: from.x + delta, z: from.z });
    if (roads.includes(from.z + delta)) options.push({ x: from.x, z: from.z + delta });
  }
  const usable = options.filter((o) => !(avoid && o.x === avoid.x && o.z === avoid.z));
  const pool = usable.length > 0 ? usable : options;
  return pick(random, pool);
}

export function createTraffic(world, random, count = TRAFFIC_COUNT) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const model = pick(random, CAR_MODELS);
    const node = randomJunction(random, world.city.roads);
    const next = pickNextLeg(random, world.city.roads, node, null);
    const car = createCar(
      model, node.x, node.z,
      Math.atan2(next.x - node.x, next.z - node.z),
      { isTraffic: true },
    );
    car.driver = { name: 'driver' };
    car.edgeFrom = node;
    car.edgeTo = next;
    car.edgeT = 0;
    car.cruise = range(random, 9, 13);
    car.blockedTimer = 0;
    cars.push(car);
    world.cars.push(car);
  }
  return cars;
}

function carAhead(world, car, dist) {
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  for (const other of world.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < dist && side < 2.5) return other;
  }
  return null;
}

function pedAhead(world, car, dist) {
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  for (const ped of world.peds) {
    if (ped.state === 'fallen') continue;
    const dx = ped.x - car.x;
    const dz = ped.z - car.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along < dist && side < 2) return ped;
  }
  return null;
}

export function stepTraffic(world, dt, random) {
  for (const car of world.traffic) {
    if (car.isPlayer || car.wrecked) continue;
    const from = car.edgeFrom;
    const to = car.edgeTo;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const edgeLen = Math.hypot(dx, dz) || 1;
    const ux = dx / edgeLen;
    const uz = dz / edgeLen;
    const lane = laneShift(ux, uz);
    // Slow for traffic ahead, stop for a pedestrian in the way.
    let target = car.cruise;
    if (carAhead(world, car, 12)) target = 0;
    else if (carAhead(world, car, 22)) target = car.cruise * 0.4;
    if (pedAhead(world, car, 7)) target = 0;
    if (target === 0) {
      car.blockedTimer += dt;
      if (car.blockedTimer > 2.5 && random() < dt * 0.4) {
        world.feed('Traffic: a driver leans on the horn near Ocean Drive.');
      }
      car.blockedTimer = Math.min(car.blockedTimer, 4);
    } else {
      car.blockedTimer = 0;
    }
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    car.edgeT += (car.speed * dt) / edgeLen;
    if (car.edgeT >= 1) {
      car.edgeFrom = to;
      car.edgeTo = pickNextLeg(random, world.city.roads, to, from);
      car.edgeT = 0;
    }
    const t = Math.min(1, car.edgeT);
    car.x = from.x + dx * t + lane.x;
    car.z = from.z + dz * t + lane.z;
    car.heading = Math.atan2(ux, uz);
    // Far from the player? Respawning keeps the streets alive around Dante.
    const playerDist = Math.hypot(car.x - world.player.x, car.z - world.player.z);
    if (playerDist > 170) {
      const node = randomJunction(random, world.city.roads);
      const next = pickNextLeg(random, world.city.roads, node, null);
      car.edgeFrom = node;
      car.edgeTo = next;
      car.edgeT = 0;
      car.x = node.x;
      car.z = node.z;
      car.speed = car.cruise;
    }
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    const spin = (car.speed * dt) / 0.36;
    car.group.userData.wheels.forEach((wheel) => { wheel.rotation.x += spin; });
  }
}

export { stepCar };
