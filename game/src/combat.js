// Brawling without bullets, for now: this module covers what happens when
// metal meets flesh — Dante getting clipped by traffic, his ride smashing
// into a cruiser, and the smoke that pours out of a dying engine. There are
// no firearms in this build, so every wound here comes from a collision.
import { PLAYER } from './config.js';

// Hurt Dante by `hit` points, blaming `how` in the feed if it kills him.
// Answers true only when the hit wastes him.
export function damagePlayer(world, hit, how) {
  const dante = world.player;
  if (dante.inCar) {
    // Seated in a ride, the bodywork takes the blow instead — twice as hard,
    // but the player's own car is unbreakable by design (see vehicles.js),
    // so a crash can never send him to the hospital on its own.
    const ride = dante.inCar;
    ride.health -= hit * 2;
    if (ride.health <= 0) ride.health = 15;
    return false;
  }
  // On foot the vest eats the blow first, and health only takes what is left.
  const eaten = Math.min(dante.armor, hit);
  dante.armor -= eaten;
  dante.health -= hit - eaten;
  world.shake = Math.min(1, world.shake + hit / 40);
  if (dante.health > 0) return false;
  dante.health = 0;
  world.events |= 64; // EVENT_WASTED
  world.feed(`WASTED — ${how}. The hospital bill stings.`);
  return true;
}

/**
 * Run once per step, after the cars have moved. Three jobs: spot Dante
 * deliberately ramming a cruiser, spot traffic running Dante down while he
 * is on foot, and tick down the smoke timers of battered cars. The flags it
 * returns mirror the WASTED bit the caller needs.
 */
export function resolveCombat(world, dt) {
  let flags = 0;
  const dante = world.player;
  if (dante.inCar) {
    const ride = dante.inCar;
    for (const cruiser of world.police.cars) {
      const gapX = cruiser.x - ride.x;
      const gapZ = cruiser.z - ride.z;
      const gap = Math.hypot(gapX, gapZ);
      const speedGap = Math.abs(ride.speed - cruiser.speed);
      // Which way is Dante actually travelling relative to the cruiser?
      // Heading alone lies: a parked Comet facing an oncoming cruiser is the
      // victim, not the rammer. (Probe 2 caught the old heading-only rule
      // handing out stars 1 -> 5 to a pinned, stationary Comet that cruisers
      // kept smashing into head-on.)
      const along = (Math.sin(ride.heading) * gapX + Math.cos(ride.heading) * gapZ) / (gap || 1);
      const drivingAt = Math.abs(ride.speed) > 3 ? Math.sign(ride.speed) * along : -1;
      if (gap < 4 && speedGap > 8 && drivingAt > 0.3) {
        world.crime('ramCop');
        world.shake = Math.min(1, world.shake + 0.5);
      }
    }
  } else {
    for (const traffic of world.cars) {
      if (traffic.wrecked || traffic.isPlayer) continue;
      const gap = Math.hypot(traffic.x - dante.x, traffic.z - dante.z);
      if (gap < 1.3 && Math.abs(traffic.speed) > 4) {
        if (damagePlayer(world, 25, 'run over by a car')) flags |= 64;
        traffic.speed *= 0.5;
        break;
      }
    }
  }
  // A car that is wrecked or badly hurt puffs smoke until it is repaired;
  // the renderer turns the timer into visible puffs.
  for (const traffic of world.cars) {
    if (traffic.health < 40 && !traffic.wrecked) traffic.smokeTimer -= dt;
    else traffic.smokeTimer = 0;
  }
  return flags;
}

export { PLAYER };
