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
    car.blockedT = 0;
    car.stuckT = 0;
    car.backup = 0;
    cars.push(car);
  }

  function reRoute(car) {
    const tx = pick(rng, CFG.roadLines) + range(rng, -2, 2);
    const tz = pick(rng, CFG.roadLines) + range(rng, -2, 2);
    const raw = roadRoute(car.pos.x, car.pos.z, tx, tz);
    // Drive on the right: shift every waypoint to the right of its leg, so
    // cars meeting head-on pass each other instead of stopping nose to nose
    // in the middle of the road. Facing east the right side is south (+z),
    // facing south it is west (-x), and so on.
    let px = car.pos.x, pz = car.pos.z;
    car.route = raw.map((w) => {
      const dx = w.x - px, dz = w.z - pz;
      let ox = 0, oz = 0;
      if (Math.abs(dx) > Math.abs(dz)) oz = dx > 0 ? 2.5 : -2.5;
      else ox = dz > 0 ? -2.5 : 2.5;
      px = w.x; pz = w.z;
      return { x: w.x + ox, z: w.z + oz };
    });
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
      // steer sign matters: driveCar turns the heading DOWN for steer > 0
      // (that is what KeyD does), so steering toward a desired heading that
      // sits above the current one needs a NEGATIVE steer. The old sign
      // turned every car away from its waypoint instead.
      const steer = Math.max(-1, Math.min(1, -angleDiff(car.heading, desired) * 1.6));
      const blocked = blockedAhead(car);
      // A car that waits behind a jam or grinds against a wall forever
      // would freeze its street. A stopped car cannot turn (steering needs
      // speed), so after a few seconds with no progress it backs up to make
      // room, then takes a fresh route somewhere else.
      let ctrl;
      if (car.backup > 0) {
        car.backup -= dt;
        ctrl = { throttle: -0.6, steer: 0, nitro: false, brake: false };
      } else if (blocked) {
        car.blockedT += dt;
        car.stuckT = 0;
        if (car.blockedT > 3) {
          reRoute(car);
          car.blockedT = 0;
          car.backup = 1.2;
        }
        ctrl = { throttle: 0, steer, nitro: false, brake: true };
      } else {
        car.blockedT = 0;
        if (car.speed < 0.5) {
          car.stuckT += dt;
          if (car.stuckT > 4) { reRoute(car); car.stuckT = 0; }
        } else {
          car.stuckT = 0;
        }
        const target = Math.min(car.cruise, car.top);
        ctrl = { throttle: car.speed < target ? 0.7 : 0, steer, nitro: false, brake: false };
      }
      driveCar(G, car, dt, ctrl);
      // running over Dante on foot hurts
      if (!G.player.inCar && G.player.health > 0) {
        if (dist2(car.pos.x, car.pos.z, G.player.pos.x, G.player.pos.z) < 25) {
          if (!car.hitCd || car.hitCd <= 0) {
            car.hitCd = 0.9;
            G.player.takeDamage(40, 'run over');
            G.hud.flash('HIT BY TRAFFIC');
          }
        }
      }
      if (car.hitCd > 0) car.hitCd -= dt;
    }
  }

  return { cars, update };
}
