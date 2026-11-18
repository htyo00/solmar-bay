// The Solmar Bay PD: interceptor cars that chase on the road graph and ram
// up close, foot cops who get out and run Dante down on foot, roadblocks at
// three stars, and a searchlight helicopter at four. Wanted stars decide how
// many of them are on the street.
import * as THREE from 'three';
import { POLICE_CAR, WANTED } from './config.js';
import { createCar, stepCar } from './vehicles.js';
import { nextNodeToward, nearestRoad } from './city.js';
import { pick } from './random.js';

function createFootCopMesh() {
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 0.7 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), navy);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.85;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), navy);
  cap.position.y = 2.02;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), navy);
  legL.position.set(-0.18, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.18;
  group.add(legL, legR);
  group.userData = { legL, legR };
  return group;
}

function createHeliMesh() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.5, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 4.5), bodyMat);
  group.add(body);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
  rotor.position.y = 0.9;
  group.add(rotor);
  const light = new THREE.SpotLight(0xfff2c0, 800, 120, 0.25, 0.5, 1.5);
  light.position.set(0, -0.5, 1);
  const target = new THREE.Object3D();
  target.position.set(0, -40, 0);
  light.target = target;
  group.add(light, target);
  // The visible searchlight beam: a faint cone from the heli to the street.
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 48, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = -24;
  group.add(beam);
  group.userData = { rotor, light };
  return group;
}

export function createPolice(world) {
  const heli = createHeliMesh();
  heli.visible = false;
  world.scene.add(heli);
  return {
    cars: [], // police cars, also in world.cars
    footCops: [], // { x, z, heading, phase, grabTimer, group }
    roadblock: [], // parked police cars forming a block
    heli,
    heliAngle: 0,
    spawnTimer: 0,
  };
}

function randomSpawnNode(world, random) {
  const roads = world.city.roads;
  for (let tries = 0; tries < 12; tries += 1) {
    const x = pick(random, roads);
    const z = pick(random, roads);
    if (Math.hypot(x - world.player.x, z - world.player.z) > 60) return { x, z };
  }
  return { x: nearestRoad(world.player.x + 80), z: nearestRoad(world.player.z) };
}

function spawnPoliceCar(world, random) {
  const node = randomSpawnNode(world, random);
  const car = createCar(POLICE_CAR, node.x, node.z, 0, { isPolice: true });
  car.topSpeedBoost = world.difficulty.policeSpeed;
  world.police.cars.push(car);
  world.cars.push(car);
  world.scene.add(car.group);
  return car;
}

function angleDiff(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function stepPoliceCar(world, car, dt, random) {
  const player = world.player;
  const targetX = player.inCar ? player.inCar.x : player.x;
  const targetZ = player.inCar ? player.inCar.z : player.z;
  const dist = Math.hypot(targetX - car.x, targetZ - car.z);
  let wantHeading;
  if (dist > 30) {
    // Follow the road graph toward the player. The target node is STICKY:
    // commit to a route and re-plan every 2 s, so the cruiser neither
    // re-rolls (and U-turns) every frame nor chases a stale node forever
    // when it gets wedged against a building.
    car.repathTimer = (car.repathTimer || 0) - dt;
    if (!car.targetNode || car.repathTimer <= 0
      || Math.hypot(car.targetNode.x - car.x, car.targetNode.z - car.z) < 8) {
      car.targetNode = nextNodeToward(world.city, car.x, car.z, targetX, targetZ, random);
      car.repathTimer = 2;
    }
    const next = car.targetNode;
    wantHeading = Math.atan2(next.x - car.x, next.z - car.z);
  } else {
    // Close in: drive straight at the target and ram.
    car.targetNode = null;
    wantHeading = Math.atan2(targetX - car.x, targetZ - car.z);
  }
  const steer = Math.max(-1, Math.min(1, angleDiff(wantHeading, car.heading) * 1.8));
  const boost = car.topSpeedBoost || 1;
  const model = { ...car.model, topSpeed: car.model.topSpeed * boost };
  const saved = car.model;
  car.model = model;
  // A cruiser hunting a driver rams at full speed. A cruiser hunting Dante
  // ON FOOT brakes to a stop beside him — otherwise it just drives through
  // him forever, never slows below the foot-cop spawn speed, and no cop
  // ever gets out (that is why BUSTED never fired in the playtests).
  let throttle = 1;
  if (!player.inCar) {
    const targetSpeed = Math.min(model.topSpeed * 0.5, dist * 0.6);
    throttle = car.speed < targetSpeed ? 1 : (car.speed > targetSpeed + 1 ? -1 : 0);
  }
  const impact = stepCar(car, { throttle, steer, handbrake: false }, dt, world.city, world.cars);
  car.model = saved;
  if (impact > 8 && player.inCar && Math.hypot(car.x - player.inCar.x, car.z - player.inCar.z) < 5) {
    world.crime('ramCop');
  }
  // Player on foot and the cruiser is stopped beside him: a cop gets out.
  if (!player.inCar && dist < 7 && Math.abs(car.speed) < 1.5 && world.police.footCops.length < 2) {
    const cop = {
      x: car.x + 2, z: car.z + 2, heading: 0, phase: 0, grabTimer: 0,
      group: createFootCopMesh(),
    };
    cop.group.position.set(cop.x, 0, cop.z);
    world.police.footCops.push(cop);
    world.scene.add(cop.group);
    world.feed('SBPD: officer on foot — do not resist.');
  }
}

function stepFootCops(world, dt) {
  let events = 0;
  const player = world.player;
  for (const cop of world.police.footCops) {
    const dist = Math.hypot(player.x - cop.x, player.z - cop.z);
    if (player.inCar) {
      // No one to grab: the cop jogs back to the cruiser and despawns.
      cop.x += Math.sin(cop.heading) * 4 * dt;
      cop.z += Math.cos(cop.heading) * 4 * dt;
      if (dist > 40) {
        world.scene.remove(cop.group);
        world.police.footCops.splice(world.police.footCops.indexOf(cop), 1);
        continue;
      }
    } else {
      cop.heading = Math.atan2(player.x - cop.x, player.z - cop.z);
      cop.x += Math.sin(cop.heading) * 7.5 * dt;
      cop.z += Math.cos(cop.heading) * 7.5 * dt;
      cop.phase += dt * 12;
      if (dist < 1.4) {
        cop.grabTimer += dt;
        if (cop.grabTimer > 1.5) events |= 32; // EVENT_BUSTED
      } else {
        cop.grabTimer = 0;
      }
    }
    const swing = Math.sin(cop.phase) * 0.5;
    cop.group.userData.legL.rotation.x = swing;
    cop.group.userData.legR.rotation.x = -swing;
    cop.group.position.set(cop.x, 0, cop.z);
    cop.group.rotation.y = cop.heading;
  }
  return events;
}

function stepRoadblock(world, dt) {
  const stars = world.wanted.stars;
  if (stars >= WANTED.roadblockAt && world.police.roadblock.length === 0) {
    const player = world.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    const heading = player.inCar ? player.inCar.heading : player.heading;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    for (const side of [-4, 4]) {
      const car = createCar(POLICE_CAR, px + fx * 45 - fz * side, pz + fz * 45 + fx * side, heading + Math.PI / 2, { isPolice: true });
      world.police.roadblock.push(car);
      world.cars.push(car);
      world.scene.add(car.group);
    }
    world.feed('SBPD: roadblock ahead — turn around.');
  } else if (stars < WANTED.roadblockAt && world.police.roadblock.length > 0) {
    for (const car of world.police.roadblock) {
      world.scene.remove(car.group);
      world.cars.splice(world.cars.indexOf(car), 1);
    }
    world.police.roadblock = [];
  }
}

function stepHeli(world, dt) {
  const stars = world.wanted.stars;
  const heli = world.police.heli;
  if (stars >= WANTED.heliAt) {
    heli.visible = true;
    world.police.heliAngle += dt * 0.25;
    const px = world.player.inCar ? world.player.inCar.x : world.player.x;
    const pz = world.player.inCar ? world.player.inCar.z : world.player.z;
    heli.position.set(px + Math.cos(world.police.heliAngle) * 32, 48, pz + Math.sin(world.police.heliAngle) * 32);
    heli.rotation.y = -world.police.heliAngle;
    heli.userData.rotor.rotation.y += dt * 20;
    heli.userData.light.target.position.set(px - heli.position.x, -48, pz - heli.position.z);
  } else {
    heli.visible = false;
  }
}

export function stepPolice(world, dt, random) {
  let events = 0;
  const want = WANTED.policePerStar[Math.min(WANTED.max, world.wanted.stars)];
  world.police.spawnTimer -= dt;
  while (world.police.cars.length < want && world.police.spawnTimer <= 0) {
    spawnPoliceCar(world, random);
    world.police.spawnTimer = 1.5;
  }
  // Too many cruisers (heat dropped): the furthest one peels off and despawns.
  if (world.police.cars.length > want) {
    const far = world.police.cars.reduce((a, b) =>
      Math.hypot(a.x - world.player.x, a.z - world.player.z) > Math.hypot(b.x - world.player.x, b.z - world.player.z) ? a : b);
    world.scene.remove(far.group);
    world.cars.splice(world.cars.indexOf(far), 1);
    world.police.cars.splice(world.police.cars.indexOf(far), 1);
  }
  for (const car of world.police.cars) stepPoliceCar(world, car, dt, random);
  events |= stepFootCops(world, dt);
  stepRoadblock(world, dt);
  stepHeli(world, dt);
  return events;
}
