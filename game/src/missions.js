// Missions: the story chain Mara Voss hands Dante by phone. Stage 1 ships
// mission 1 fully — steal the Comet GT, run it to the Marina pier, lose the
// heat, deliver it — and lists the rest as the chain to come. Each mission is
// steps with a waypoint, an objective line, a payout and a grade on time.
import { MISSIONS } from './config.js';

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

export function gradeFor(mission, seconds) {
  if (seconds <= mission.gradeS) return 'S';
  if (seconds <= mission.gradeA) return 'A';
  if (seconds <= mission.gradeB) return 'B';
  return 'C';
}

function setObjective(world, text, waypoint) {
  world.missions.objective = text;
  world.missions.waypoint = waypoint || null;
  world.missionEvents = (world.missionEvents || 0) | 8; // EVENT_OBJECTIVE
}

export function startMission(world) {
  const missions = world.missions;
  missions.active = true;
  missions.done = false;
  missions.step = 0;
  missions.timer = 0;
  const comet = world.city.cometSpot;
  setObjective(world, 'Steal the Comet GT outside the Loft', { x: comet.x, z: comet.z, label: 'Comet GT' });
  world.feed(`Mara Voss: "${MISSIONS[0].brief}"`);
}

function completeMission(world) {
  const missions = world.missions;
  const mission = MISSIONS[missions.index];
  const seconds = missions.timer;
  const grade = gradeFor(mission, seconds);
  const payout = Math.round(mission.payout * world.difficulty.payout);
  missions.grade = grade;
  missions.done = true;
  missions.active = false;
  world.save.cash += payout;
  world.save.stats.missionsDone += 1;
  if (!world.save.carsOwned.includes('Comet GT')) world.save.carsOwned.push('Comet GT');
  if (world.save.bestGrade === null || grade < world.save.bestGrade) world.save.bestGrade = grade;
  if (world.save.bestTime === null || seconds < world.save.bestTime) world.save.bestTime = Math.round(seconds);
  world.saveMissionResult = { mission: mission.name, grade, seconds, payout, stats: { ...missions.stats }, garage: [...world.save.carsOwned] };
  setObjective(world, 'Job done. Mara Voss is pleased.', null);
  world.feed(`Mara Voss: "Clean work, Dante. $${payout} is yours."`);
  world.missionEvents = (world.missionEvents || 0) | 16; // EVENT_COMPLETE
}

export function stepMissions(world, dt, events) {
  const out = world.missionEvents || 0;
  world.missionEvents = 0;
  const missions = world.missions;
  if (!missions.active) return out;
  missions.timer += dt;
  const player = world.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;
  if (events & 1) missions.stats.carsStolen += 1; // EVENT_STEAL
  if (player.inCar) missions.stats.topSpeed = Math.max(missions.stats.topSpeed, Math.abs(player.inCar.speed) * 3.6);

  if (missions.index === 0) {
    if (missions.step === 0) {
      if (player.inCar && player.inCar.model.name === 'Comet GT') {
        missions.step = 1;
        const pier = world.city.pier;
        setObjective(world, 'Drive the Comet GT to the Marina pier', { x: pier.x, z: pier.z, label: 'Marina pier' });
      }
    } else if (missions.step === 1) {
      const pier = world.city.pier;
      if (Math.hypot(px - pier.x, pz - pier.z) < 18) {
        missions.step = 2;
        setObjective(world, 'Lose the cops — break line of sight until the stars drop', null);
      }
    } else if (missions.step === 2) {
      if (world.wanted.stars === 0) {
        missions.step = 3;
        const pier = world.city.pier;
        setObjective(world, 'Deliver the Comet GT at the pier', { x: pier.x, z: pier.z, label: 'Deliver here' });
      }
    } else if (missions.step === 3) {
      const pier = world.city.pier;
      // 16 units: the car stops on the sand beside the pier, not on its planks.
      if (player.inCar && Math.hypot(px - pier.x, pz - pier.z) < 16) completeMission(world);
    }
  }
  return (world.missionEvents || 0) | out;
}
