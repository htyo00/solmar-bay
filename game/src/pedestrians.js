// Pedestrians: they stroll the sidewalk loops around their home block,
// scatter when a fast car bears down on them, and fall when a car actually
// hits them — which counts as a crime the police notice. Simple capsule
// people, assembled from boxes.
import * as THREE from 'three';
import { PED_COUNT } from './config.js';
import { pick, range } from './random.js';

const SHIRTS = [0xe76f51, 0x2a9d8f, 0xf4a900, 0xc1666b, 0xe9c46a, 0x264653, 0xf5ead6];
const SKINS = [0xd4b896, 0xc98e6b, 0x8a5a3b, 0xe8b98a];

// One walker mesh: shirt torso, skin head, hair cap, arms, legs, shoes.
export function createPedMesh(shirt, skin) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: [0x1a1210, 0x3a2a18, 0x555555][Math.floor(Math.random() * 3)], roughness: 0.9 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirtMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skinMat);
  head.position.y = 1.65;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), hairMat);
  hair.position.y = 1.82;
  group.add(hair);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), shirtMat);
  armL.position.set(-0.36, 1.05, 0);
  const armR = armL.clone();
  armR.position.x = 0.36;
  group.add(armL, armR);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.24), pantsMat);
  legL.position.set(-0.14, 0.33, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  group.add(legL, legR);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.34), shoeMat);
  shoeL.position.set(-0.14, 0.05, 0.04);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.14;
  group.add(shoeL, shoeR);
  group.userData = { legL, legR, armL, armR };
  return group;
}

export function createPeds(world, random, count = PED_COUNT) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const homeX = pick(random, world.city.blocks);
    const homeZ = pick(random, world.city.blocks);
    const onSand = i >= count - 4; // four people stand on the sand, watching the bay
    const ped = {
      x: onSand ? -60 + (i - (count - 4)) * 40 : homeX + range(random, -14, 14),
      z: onSand ? 118 + (i % 2) * 6 : homeZ + 14.5,
      heading: onSand ? 0 : range(random, 0, Math.PI * 2),
      speed: onSand ? 0 : range(random, 1.0, 1.5),
      state: onSand ? 'idle' : 'walk', // walk | idle | flee | fallen
      blockX: homeX, blockZ: homeZ,
      side: Math.floor(random() * 4), // which sidewalk edge of the block
      edgeT: random(),
      fleeTimer: 0,
      fallenTimer: 0,
      phase: random() * 6,
      group: createPedMesh(pick(random, SHIRTS), pick(random, SKINS)),
    };
    peds.push(ped);
    world.scene.add(ped.group);
  }
  return peds;
}

// A scared pedestrian thrown out of a stolen car, or one who watched a crime.
export function addFleeingPed(world, x, z) {
  const ped = {
    x, z,
    heading: Math.atan2(x - world.player.x, z - world.player.z),
    speed: 3.5,
    state: 'flee',
    blockX: 0, blockZ: 0,
    side: 0, edgeT: 0,
    fleeTimer: 3,
    fallenTimer: 0,
    phase: 0,
    group: createPedMesh(pick(world.random, SHIRTS), pick(world.random, SKINS)),
  };
  world.peds.push(ped);
  world.scene.add(ped.group);
  return ped;
}

// The nearest fast car within 7 units of a walker, if any.
function nearestThreat(world, ped) {
  let closest = null;
  let closestDist = 7;
  for (const car of world.cars) {
    if (car.wrecked) continue;
    const dist = Math.hypot(car.x - ped.x, car.z - ped.z);
    if (dist < closestDist && Math.abs(car.speed) > 9) {
      closestDist = dist;
      closest = car;
    }
  }
  return closest;
}

// Send a walker running away from a threat, with a throttled scream line.
function scarePed(world, ped, threat) {
  ped.state = 'flee';
  ped.fleeTimer = 3;
  ped.heading = Math.atan2(ped.x - threat.x, ped.z - threat.z);
  // One scream per 8 s: three identical feed lines read as a bug.
  if (world.elapsed - (world.lastScream || -99) > 8) {
    world.lastScream = world.elapsed;
    world.feed('A pedestrian screams and runs for cover.');
  }
}

export function stepPeds(world, dt) {
  let events = 0;
  for (const ped of world.peds) {
    if (ped.state === 'fallen') {
      ped.fallenTimer -= dt;
      ped.group.rotation.x = -Math.PI / 2;
      ped.group.position.y = 0.3;
      if (ped.fallenTimer <= 0) {
        ped.state = 'flee';
        ped.fleeTimer = 3;
        ped.group.rotation.x = 0;
        ped.group.position.y = 0;
      }
      continue;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      ped.speed = 3.5;
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.z += Math.cos(ped.heading) * ped.speed * dt;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    } else if (ped.state === 'idle') {
      // Beach watchers stand still, facing the bay; a fast car still scares them off.
      const threat = nearestThreat(world, ped);
      if (threat) scarePed(world, ped, threat);
    } else {
      // Stroll the sidewalk loop of the home block: four edges, one after another.
      const half = 14.5;
      const corners = [
        [ped.blockX - half, ped.blockZ - half], [ped.blockX + half, ped.blockZ - half],
        [ped.blockX + half, ped.blockZ + half], [ped.blockX - half, ped.blockZ + half],
      ];
      const from = corners[ped.side];
      const to = corners[(ped.side + 1) % 4];
      ped.edgeT += (ped.speed * dt) / 29;
      if (ped.edgeT >= 1) {
        ped.edgeT = 0;
        ped.side = (ped.side + 1) % 4;
      }
      ped.x = from[0] + (to[0] - from[0]) * ped.edgeT;
      ped.z = from[1] + (to[1] - from[1]) * ped.edgeT;
      ped.heading = Math.atan2(to[0] - from[0], to[1] - from[1]);
      const threat = nearestThreat(world, ped);
      if (threat) scarePed(world, ped, threat);
    }
    // Hit by a car? Fall down — and the police take note.
    for (const car of world.cars) {
      if (car.wrecked) continue;
      const dist = Math.hypot(car.x - ped.x, car.z - ped.z);
      if (dist < 1.4 && Math.abs(car.speed) > 3 && ped.state !== 'fallen') {
        ped.state = 'fallen';
        ped.fallenTimer = 2;
        car.speed *= 0.7;
        events |= 2; // EVENT_HIT_PED
        break;
      }
    }
    ped.phase += dt * ped.speed * 3;
    const swing = Math.sin(ped.phase) * 0.4 * Math.min(1, ped.speed / 2);
    ped.group.userData.legL.rotation.x = swing;
    ped.group.userData.legR.rotation.x = -swing;
    ped.group.userData.armL.rotation.x = -swing * 0.8;
    ped.group.userData.armR.rotation.x = swing * 0.8;
    ped.group.position.set(ped.x, ped.group.position.y, ped.z);
    ped.group.rotation.y = ped.heading;
  }
  return events;
}
