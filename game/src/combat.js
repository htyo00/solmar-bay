// Combat, Stage 1: no guns yet — crashes, rams and being run over. A hard
// impact shakes the camera and hurts; Dante's health hits zero and he wakes
// up at the hospital (WASTED, cash lost). Ramming a police car on purpose is
// a crime of its own.
import { PLAYER } from './config.js';

export function damagePlayer(world, amount, cause) {
  const player = world.player;
  // In a car the hit lands on the car, doubled — but the player's car
  // never wrecks outright (see vehicles.js), so this can never WASTE him.
  if (player.inCar) {
    const car = player.inCar;
    car.health -= amount * 2;
    if (car.health <= 0) car.health = 15;
    return false;
  }
  // On foot the SBPD vest soaks damage before health does.
  const soaked = Math.min(player.armor, amount);
  player.armor -= soaked;
  player.health -= amount - soaked;
  world.shake = Math.min(1, world.shake + amount / 40);
  if (player.health > 0) return false;
  player.health = 0;
  world.events |= 64; // EVENT_WASTED
  world.feed(`WASTED — ${cause}. The hospital bill stings.`);
  return true;
}

/**
 * After the physics step: the player car ramming a police car, a car running
 * Dante over on foot, and wrecked-car smoke. Returns event flags.
 */
export function resolveCombat(world, dt) {
  let events = 0;
  const player = world.player;
  if (player.inCar) {
    const car = player.inCar;
    for (const cop of world.police.cars) {
      const dx = cop.x - car.x;
      const dz = cop.z - car.z;
      const dist = Math.hypot(dx, dz);
      const rel = Math.abs(car.speed - cop.speed);
      // Velocity, not facing: a stationary Dante facing an incoming
      // cruiser is not ramming it — the cruiser is ramming him. (Probe 2:
      // a pinned, stationary Comet collected stars 1 -> 5 from cruisers
      // ramming it head-on, because the old rule only checked heading.)
      const facing = (Math.sin(car.heading) * dx + Math.cos(car.heading) * dz) / (dist || 1);
      const closing = Math.abs(car.speed) > 3 ? Math.sign(car.speed) * facing : -1;
      if (dist < 4 && rel > 8 && closing > 0.3) {
        world.crime('ramCop');
        world.shake = Math.min(1, world.shake + 0.5);
      }
    }
  } else {
    for (const car of world.cars) {
      if (car.wrecked || car.isPlayer) continue;
      const dist = Math.hypot(car.x - player.x, car.z - player.z);
      if (dist < 1.3 && Math.abs(car.speed) > 4) {
        if (damagePlayer(world, 25, 'run over by a car')) events |= 64;
        car.speed *= 0.5;
        break;
      }
    }
  }
  // Wrecked or badly hurt cars smoke — the render layer draws the puffs.
  for (const car of world.cars) {
    if (car.health < 40 && !car.wrecked) car.smokeTimer -= dt;
    else car.smokeTimer = 0;
  }
  return events;
}

export { PLAYER };
