// The wanted system: one to five stars. Crimes add a star (each crime type has
// a cooldown, so one bad minute cannot jump straight to five). Break line of
// sight — no police unit close for eight seconds — and the stars blink, then
// drop one at a time until Dante is clean again.
import { WANTED } from './config.js';

export function createWanted() {
  return {
    stars: 0,
    cooldowns: { steal: 0, hitPed: 0, ramCop: 0 },
    loseTimer: 0,
    blinkTimer: 0,
    blinking: false,
  };
}

const CRIME_LINES = {
  steal: 'SBPD: vehicle theft reported in {district}. Units responding.',
  hitPed: 'SBPD: pedestrian struck — units responding.',
  ramCop: 'SBPD: officer rammed! All units converge.',
};

export function crime(world, type) {
  const wanted = world.wanted;
  if (wanted.cooldowns[type] > 0) return false;
  wanted.cooldowns[type] = WANTED.crimeCooldown;
  if (wanted.stars < WANTED.max) {
    wanted.stars += 1;
    wanted.loseTimer = 0;
    wanted.blinking = false;
    const district = world.districtName(world.player.x, world.player.z);
    world.feed(CRIME_LINES[type].replace('{district}', district));
    return true;
  }
  return false;
}

function nearestPoliceDist(world) {
  let best = Infinity;
  for (const car of world.police.cars) {
    best = Math.min(best, Math.hypot(car.x - world.player.x, car.z - world.player.z));
  }
  for (const cop of world.police.footCops) {
    best = Math.min(best, Math.hypot(cop.x - world.player.x, cop.z - world.player.z));
  }
  for (const car of world.police.roadblock) {
    best = Math.min(best, Math.hypot(car.x - world.player.x, car.z - world.player.z));
  }
  return best;
}

export function stepWanted(world, dt) {
  const wanted = world.wanted;
  for (const key of Object.keys(wanted.cooldowns)) {
    wanted.cooldowns[key] = Math.max(0, wanted.cooldowns[key] - dt);
  }
  if (wanted.stars === 0) {
    wanted.loseTimer = 0;
    wanted.blinking = false;
    return;
  }
  const near = nearestPoliceDist(world);
  if (near > 55) {
    wanted.loseTimer += dt;
    if (wanted.loseTimer > WANTED.loseSightSeconds) {
      wanted.blinking = true;
      wanted.blinkTimer += dt;
      if (wanted.blinkTimer > WANTED.blinkSeconds) {
        wanted.stars -= 1;
        wanted.loseTimer = 0;
        wanted.blinkTimer = 0;
        wanted.blinking = false;
        world.feed(wanted.stars === 0 ? 'Clean. The heat is off — for now.' : 'You lost a star. Keep moving.');
      }
    }
  } else {
    wanted.loseTimer = 0;
    wanted.blinkTimer = 0;
    wanted.blinking = false;
  }
}
