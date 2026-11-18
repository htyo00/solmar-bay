// The job chain Mara Voss hands Dante over the phone. Stage 1 ships job
// one end to end — lift the Comet GT, run it to the Marina pier, shake the
// heat, bring it in — and names the rest of the chain as jobs to come.
// Every job is a short chain of steps; each step has a waypoint, an
// objective line, a payout and a grade against the clock.
import { MISSIONS } from './config.js';

// Fresh per-run mission state. The chain always opens on job one.
export function createMissions(world) {
  return {
    index: 0,
    step: 0,
    timer: 0,
    active: false,
    done: false,
    grade: null,
    stats: { carsStolen: 0, topSpeed: 0, busted: 0, wasted: 0 },
    objective: 'Talk to Mara Voss — press Enter to start the first job.',
    waypoint: null,
  };
}

export function missionName(missions) {
  return MISSIONS[missions.index].name;
}

// Time grade for a finished job: faster is better, S is the top mark.
export function gradeFor(mission, seconds) {
  if (seconds <= mission.gradeS) return 'S';
  if (seconds <= mission.gradeA) return 'A';
  if (seconds <= mission.gradeB) return 'B';
  return 'C';
}

// Set a new objective line (and its map marker) and raise the event flag.
function publishObjective(world, text, waypoint) {
  world.missions.objective = text;
  world.missions.waypoint = waypoint || null;
  world.missionEvents = (world.missionEvents || 0) | 8; // EVENT_OBJECTIVE
}

export function startMission(world) {
  const ms = world.missions;
  const comet = world.city.cometSpot;
  ms.active = true;
  ms.done = false;
  ms.step = 0;
  ms.timer = 0;
  publishObjective(world, 'Steal the Comet GT outside the Loft', { x: comet.x, z: comet.z, label: 'Comet GT' });
  world.feed(`Mara Voss: "${MISSIONS[0].brief}"`);
}

function finishMission(world) {
  const ms = world.missions;
  const job = MISSIONS[ms.index];
  const seconds = ms.timer;
  const grade = gradeFor(job, seconds);
  const payout = Math.round(job.payout * world.difficulty.payout);
  ms.grade = grade;
  ms.done = true;
  ms.active = false;
  world.save.cash += payout;
  world.save.stats.missionsDone += 1;
  if (!world.save.carsOwned.includes('Comet GT')) world.save.carsOwned.push('Comet GT');
  if (world.save.bestGrade === null || grade < world.save.bestGrade) world.save.bestGrade = grade;
  if (world.save.bestTime === null || seconds < world.save.bestTime) world.save.bestTime = Math.round(seconds);
  world.saveMissionResult = {
    mission: job.name,
    grade,
    seconds,
    payout,
    stats: { ...ms.stats },
    garage: [...world.save.carsOwned],
  };
  publishObjective(world, 'Job done. Mara Voss is pleased.', null);
  world.feed(`Mara Voss: "Clean work, Dante. $${payout} is yours."`);
  world.missionEvents = (world.missionEvents || 0) | 16; // EVENT_COMPLETE
}

// One step of job one, keyed by the current step number. Returns nothing;
// a step advances by writing ms.step and publishing the next objective.
function advanceJobOne(world, px, pz) {
  const ms = world.missions;
  const player = world.player;
  const pier = world.city.pier;
  switch (ms.step) {
    case 0: {
      if (player.inCar && player.inCar.model.name === 'Comet GT') {
        ms.step = 1;
        publishObjective(world, 'Drive the Comet GT to the Marina pier', { x: pier.x, z: pier.z, label: 'Marina pier' });
      }
      break;
    }
    case 1: {
      if (Math.hypot(px - pier.x, pz - pier.z) < 18) {
        ms.step = 2;
        publishObjective(world, 'Lose the cops — break line of sight until the stars drop', null);
      }
      break;
    }
    case 2: {
      if (world.wanted.stars === 0) {
        ms.step = 3;
        publishObjective(world, 'Deliver the Comet GT at the pier', { x: pier.x, z: pier.z, label: 'Deliver here' });
      }
      break;
    }
    case 3: {
      // 16 units: the car stops on the sand beside the pier, not on its planks.
      if (player.inCar && Math.hypot(px - pier.x, pz - pier.z) < 16) finishMission(world);
      break;
    }
    default:
      break;
  }
}

export function stepMissions(world, dt, events) {
  const pending = world.missionEvents || 0;
  world.missionEvents = 0;
  const ms = world.missions;
  if (!ms.active) return pending;
  ms.timer += dt;
  const player = world.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;
  if (events & 1) ms.stats.carsStolen += 1; // EVENT_STEAL
  if (player.inCar) ms.stats.topSpeed = Math.max(ms.stats.topSpeed, Math.abs(player.inCar.speed) * 3.6);
  if (ms.index === 0) advanceJobOne(world, px, pz);
  return (world.missionEvents || 0) | pending;
}
