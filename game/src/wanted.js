// Wanted stars, one to five. A crime adds a star; each crime kind has its
// own cooldown, so one bad minute cannot jump straight to five. Break
// contact — no police unit close for a few seconds — and the stars blink,
// then fall one at a time until Dante is clean again.
import { WANTED } from './config.js';

// Fresh wanted state, for a new run or a reset.
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

// Distance from Dante to the nearest police unit of any kind.
function closestUnit(world) {
  let best = Infinity;
  const px = world.player.x;
  const pz = world.player.z;
  for (const car of world.police.cars) {
    best = Math.min(best, Math.hypot(car.x - px, car.z - pz));
  }
  for (const cop of world.police.footCops) {
    best = Math.min(best, Math.hypot(cop.x - px, cop.z - pz));
  }
  for (const block of world.police.roadblock) {
    best = Math.min(best, Math.hypot(block.x - px, block.z - pz));
  }
  return best;
}

// Shed one star after Dante has stayed unseen long enough.
function shedStar(world) {
  const wanted = world.wanted;
  wanted.stars -= 1;
  wanted.loseTimer = 0;
  wanted.blinkTimer = 0;
  wanted.blinking = false;
  if (wanted.stars === 0) world.save.stats.copsLost += 1; // escaped: counts toward REP
  world.feed(wanted.stars === 0
    ? 'Clean. The heat is off — for now.'
    : 'You lost a star. Keep moving.');
}

// Record a crime. True when it actually added a star.
export function crime(world, type) {
  const wanted = world.wanted;
  if (wanted.cooldowns[type] > 0) return false;
  wanted.cooldowns[type] = type === 'ramCop'
    ? WANTED.ramCopCooldown
    : WANTED.crimeCooldown;
  if (wanted.stars >= WANTED.max) return false;

  const firstStar = wanted.stars === 0;
  wanted.stars += 1;
  wanted.loseTimer = 0;
  wanted.blinking = false;

  // A fresh crime is a fresh tip-off: the SBPD now knows exactly where it
  // JUST happened. Without this reset, lastSeen stays frozen on the
  // previous chase (the pier evasion, say), so a cruiser sent out for the
  // new crime drives to the old spot while Dante stands somewhere else
  // entirely — the stars decay before any unit ever gets close and BUSTED
  // can never fire. The tip-off also heats the trail: for hotSeconds the
  // cruisers converge on Dante's CURRENT position and the stars cannot
  // decay yet, because the response still needs time to arrive (in one
  // playtest the only cruiser was 150 units out when the star decayed at
  // 7 seconds).
  if (firstStar) {
    world.police.lastSeen = { x: world.player.x, z: world.player.z };
  }
  world.police.hotTimer = WANTED.hotSeconds;

  const district = world.districtName(world.player.x, world.player.z);
  world.feed(CRIME_LINES[type].replace('{district}', district));
  return true;
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

  // HOT PURSUIT: while the SBPD still holds a live fix — a fresh crime,
  // or a cruiser that just saw Dante — the heat cannot fade. The response
  // is still converging on him, so the decay clock only starts once the
  // trail goes cold (in one playtest the star decayed while the only
  // cruiser was still 150 units out, driving to a stale spot). A real
  // evasion still works: break contact, stay unseen for hotSeconds, and
  // then the normal decay runs.
  if (world.police.hotTimer > 0) {
    wanted.loseTimer = 0;
    wanted.blinkTimer = 0;
    wanted.blinking = false;
    return;
  }

  // Seen: the clocks reset.
  if (closestUnit(world) <= WANTED.loseDistance) {
    wanted.loseTimer = 0;
    wanted.blinkTimer = 0;
    wanted.blinking = false;
    return;
  }

  // Unseen: count up, blink, then shed one star.
  wanted.loseTimer += dt;
  if (wanted.loseTimer <= WANTED.loseSightSeconds) return;
  wanted.blinking = true;
  wanted.blinkTimer += dt;
  if (wanted.blinkTimer > WANTED.blinkSeconds) shedStar(world);
}
