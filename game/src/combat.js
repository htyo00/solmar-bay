// Combat, Stage 1: no guns yet — crashes, rams and being run over. A hard
// impact shakes the camera and hurts; Dante's health hits zero and he wakes
// up at the hospital (WASTED, cash lost). Ramming a police car on purpose is
// a crime of its own.
import { PLAYER } from './config.js';

export function damagePlayer(world, amount, cause) {
  const player = world.player;
  if (player.inCar) {
    player.inCar.health -= amount * 2;
    if (player.inCar.health <= 0) {
      player.inCar.health = 0;
      player.inCar.wrecked = true;
    }
    return false;
  }
  player.health -= amount;
  world.shake = Math.min(1, world.shake + amount / 40);
  if (player.health <= 0) {
    player.health = 0;
    world.events |= 64; // EVENT_WASTED
    world.feed(`WASTED — ${cause}. The hospital bill stings.`);
    return true;
  }
  return false;
}

/**
 * After the physics step: the player car ramming a police car, a car running
 * Dante over on foot, and wrecked-car smoke. Returns event flags.
 */
export function resolveCombat(world, dt) {
  let events = 0;
  const player = world.player;
  if (player.inCar) {
    for (const cop of world.police.cars) {
      const dist = Math.hypot(cop.x - player.inCar.x, cop.z - player.inCar.z);
      const rel = Math.abs(player.inCar.speed - cop.speed);
      if (dist < 4 && rel > 8) {
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
