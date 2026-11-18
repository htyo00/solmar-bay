// Ambient traffic: cars that follow the road grid and brake for trouble.
import { CFG } from './config.js';
import { roadRoute, nearestLine } from './city.js';
import { angleDiff, dist2 } from './random.js';
import { createCar, driveCar } from './vehicles.js';
import { makeRng, range, pick } from './random.js';

const TYPES = ['sedan', 'sedan', 'taxi', 'van', 'truck', 'sedan'];

export function createTraffic(G) {
  const rng = makeRng(777001);
  const cars = [];
  for (let i = 0; i < CFG.trafficCars; i++) {
    const x = pick(rng, CFG.roadLines);
    const z = pick(rng, CFG.roadLines);
    const car = createCar(G, pick(rng, TYPES), x + range(rng, -3, 3), z + range(rng, -3, 3), pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]));
    car.cruise = range(rng, 9, 14);
    car.route = null;
    car.wait = range(rng, 0, 2);
    cars.push(car);
  }

  function reRoute(car) {
    const tx = pick(rng, CFG.roadLines) + range(rng, -2, 2);
    const tz = pick(rng, CFG.roadLines) + range(rng, -2, 2);
    car.route = roadRoute(car.pos.x, car.pos.z, tx, tz);
  }

  function blockedAhead(car) {
    // anything slow right in front of us on the same road?
    const fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
    const all = [G.player.car, ...cars, ...G.police.cruisers].filter(Boolean);
    for (const o of all) {
      if (o === car) continue;
      const dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z;
      const ahead = dx * fx + dz * fz;
      if (ahead > 0 && ahead < 9 && Math.abs(dx * fz - dz * fx) < 3.2) return true;
    }
    return false;
  }

  function update(dt) {
    for (const car of cars) {
      if (car.wait > 0) { car.wait -= dt; continue; }
      if (!car.route || car.route.length === 0) reRoute(car);
      const wp = car.route[0];
      const dx = wp.x - car.pos.x, dz = wp.z - car.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 4) { car.route.shift(); continue; }
      const desired = Math.atan2(-dx, -dz);
      const steer = Math.max(-1, Math.min(1, angleDiff(car.heading, desired) * 1.6));
      const blocked = blockedAhead(car);
      const target = blocked ? 0 : Math.min(car.cruise, car.top);
      const throttle = car.speed < target ? 0.7 : 0;
      driveCar(G, car, dt, { throttle, steer, nitro: false, brake: blocked });
      // running over Dante on foot hurts
      if (!G.player.inCar && G.player.health > 0) {
        if (dist2(car.pos.x, car.pos.z, G.player.pos.x, G.player.pos.z) < 7) {
          if (!car.hitCd || car.hitCd <= 0) {
            car.hitCd = 0.9;
            G.player.takeDamage(14, 'run over');
            G.hud.flash('HIT BY TRAFFIC');
          }
        }
      }
      if (car.hitCd > 0) car.hitCd -= dt;
    }
  }

  return { cars, update };
}
