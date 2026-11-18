// The Solmar Bay PD: interceptors that chase on the road graph and ram up
// close, foot cops who climb out and run Dante down on foot, roadblocks
// once the heat hits three stars, and a searchlight helicopter at four.
// The wanted stars decide how many units are on the street.
import * as THREE from 'three';
import { POLICE_CAR, WANTED } from './config.js';
import { createCar, stepCar } from './vehicles.js';
import { nextNodeToward, nearestRoad } from './city.js';
import { pick } from './random.js';

export function createPolice(world) {
  const heli = makeHeliFigure();
  heli.visible = false;
  world.scene.add(heli);
  return {
    cars: [], // interceptor cars; also tracked in world.cars
    footCops: [], // { x, z, heading, phase, grabTimer, group }
    roadblock: [], // parked interceptors forming a block
    // Where Dante was last seen by a cruiser (see driveCruiser below).
    lastSeen: null,
    // Seconds left of the HOT trail: a fresh crime, or a cruiser that just
    // saw Dante, means the SBPD holds a live fix — lastSeen tracks his
    // current position and the stars cannot decay yet (see stepPolice).
    hotTimer: 0,
    heli,
    heliAngle: 0,
    spawnTimer: 0,
  };
}

function makeFootCopFigure() {
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

function makeHeliFigure() {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.5, metalness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 4.5), hullMat);
  group.add(hull);

  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), darkMat);
  rotor.position.y = 0.9;
  group.add(rotor);

  // The beam you can actually see: a faint cone from the heli to the road.
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 48, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff2c0, transparent: true, opacity: 0.08,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  beam.position.y = -24;
  group.add(beam);

  const lamp = new THREE.SpotLight(0xfff2c0, 800, 120, 0.25, 0.5, 1.5);
  lamp.position.set(0, -0.5, 1);
  const lampAim = new THREE.Object3D();
  lampAim.position.set(0, -40, 0);
  lamp.target = lampAim;
  group.add(lamp, lampAim);

  group.userData = { rotor, light: lamp };
  return group;
}

// A road intersection far enough from Dante to spawn a cruiser at.
function farSpawnJunction(world, random) {
  const grid = world.city.roads;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const x = pick(random, grid);
    const z = pick(random, grid);
    const away = Math.hypot(x - world.player.x, z - world.player.z);
    if (away > 60) return { x, z };
  }
  return { x: nearestRoad(world.player.x + 80), z: nearestRoad(world.player.z) };
}

function launchCruiser(world, random) {
  const node = farSpawnJunction(world, random);
  const car = createCar(POLICE_CAR, node.x, node.z, 0, { isPolice: true });
  car.topSpeedBoost = world.difficulty.policeSpeed;
  world.police.cars.push(car);
  world.cars.push(car);
  world.scene.add(car.group);
  return car;
}

// Smallest signed turn from heading b to heading a, in (-PI, PI].
function turnDelta(a, b) {
  let delta = a - b;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function driveCruiser(world, car, dt, random) {
  const suspect = world.player;
  const sx = suspect.inCar ? suspect.inCar.x : suspect.x;
  const sz = suspect.inCar ? suspect.inCar.z : suspect.z;

  // LAST-SEEN targeting, GTA search style: a cruiser only knows where
  // Dante IS while it is close enough to see him (inside loseDistance);
  // further out it drives to where he was LAST SEEN. Without this the
  // cruisers would home perfectly forever and a star could never drop —
  // the player has to be able to break contact by outrunning them (in
  // one early round the lap never held a 40-unit gap, rams stacked the
  // stars 1 -> 4 and the car got pinned at the map edge). lastSeen is
  // refreshed by stepPolice whenever any cruiser is close; a cruiser
  // that reaches a stale lastSeen mills around there while Dante slips
  // away.
  const seen = world.police.lastSeen;
  const outOfSight = seen && Math.hypot(sx - car.x, sz - car.z) > WANTED.loseDistance;
  const targetX = outOfSight ? seen.x : sx;
  const targetZ = outOfSight ? seen.z : sz;
  const gap = Math.hypot(targetX - car.x, targetZ - car.z);

  let wantHeading;
  if (gap > 30) {
    // Follow the road graph toward the suspect. The waypoint is STICKY:
    // commit to a route and re-plan every 2 s, so the cruiser neither
    // re-rolls (and U-turns) every frame nor chases a stale node forever
    // once it gets wedged against a building.
    car.repathTimer = (car.repathTimer || 0) - dt;
    const nodeReached = car.targetNode
      && Math.hypot(car.targetNode.x - car.x, car.targetNode.z - car.z) < 8;
    if (!car.targetNode || car.repathTimer <= 0 || nodeReached) {
      car.targetNode = nextNodeToward(world.city, car.x, car.z, targetX, targetZ, random);
      car.repathTimer = 2;
    }
    const waypoint = car.targetNode;
    // Greedy dead-end: when the target sits OFF the road grid — a
    // suspect stopped on the beach south of the last road — no
    // neighbouring intersection is any closer to the target than the
    // cruiser already is, so the graph just ping-pongs between
    // intersections ((-100,100) <-> (-60,100)) and the cruiser never
    // closes in. Drive straight at the target instead: the beach is
    // open ground, and the check below only fires when the graph offers
    // no progress at all, so in-city routing (where a neighbour always
    // improves the distance) is untouched. The mode is re-evaluated
    // every step, so the cruiser drops back to the graph as soon as a
    // route makes progress again.
    const hereFar = Math.abs(car.x - targetX) + Math.abs(car.z - targetZ);
    const nodeFar = Math.abs(waypoint.x - targetX) + Math.abs(waypoint.z - targetZ);
    wantHeading = nodeFar >= hereFar
      ? Math.atan2(targetX - car.x, targetZ - car.z)
      : Math.atan2(waypoint.x - car.x, waypoint.z - car.z);
  } else {
    // Close in: drive straight at the target and ram.
    car.targetNode = null;
    wantHeading = Math.atan2(targetX - car.x, targetZ - car.z);
  }

  const steer = Math.max(-1, Math.min(1, turnDelta(wantHeading, car.heading) * 1.8));
  const boost = car.topSpeedBoost || 1;
  const tuned = { ...car.model, topSpeed: car.model.topSpeed * boost };
  const baseModel = car.model;
  car.model = tuned;

  // A cruiser hunting a driver rams at full speed. A cruiser hunting
  // Dante ON FOOT brakes to a stop beside him — otherwise it just drives
  // through him forever, never slows below the foot-cop spawn speed, and
  // no cop ever gets out (that is why BUSTED never fired in early
  // playtests). After a hard ram the cruiser backs off for 2 s instead
  // of grinding into the player again at once — without a gap the player
  // can never drive away from a pin (in one probe two cruisers ground
  // the Comet to 15 health in a block pocket and it never got out; the
  // pier drive failed at the steal three runs running for the same
  // reason).
  car.ramRecover = Math.max(0, (car.ramRecover || 0) - dt);
  let throttle = 1;
  if (car.ramRecover > 0) {
    throttle = -0.5; // back off, give the player room to pull away
  } else if (!suspect.inCar) {
    const cruiseSpeed = Math.min(tuned.topSpeed * 0.5, gap * 0.6);
    throttle = car.speed < cruiseSpeed ? 1 : (car.speed > cruiseSpeed + 1 ? -1 : 0);
  }
  const impact = stepCar(car, { throttle, steer, handbrake: false }, dt, world.city, world.cars);
  car.model = baseModel;
  if (impact > 8) car.ramRecover = 2;

  // A ram only counts as the player's crime when Dante is actually
  // moving TOWARD the cruiser — his velocity, not just where he faces.
  // A cruiser rear-ending him, or ramming him while he sits still, is
  // the SBPD's doing, not his (in one probe a pinned, stationary Comet
  // collected stars 1 -> 5 from cruisers ramming it head-on).
  const rdx = car.x - suspect.x;
  const rdz = car.z - suspect.z;
  const rdist = Math.hypot(rdx, rdz);
  const facing = suspect.inCar
    ? (Math.sin(suspect.inCar.heading) * rdx + Math.cos(suspect.inCar.heading) * rdz) / (rdist || 1)
    : -1;
  const closing = suspect.inCar && Math.abs(suspect.inCar.speed) > 3
    ? Math.sign(suspect.inCar.speed) * facing
    : -1;
  if (impact > 8 && suspect.inCar && closing > 0.3 && rdist < 5) {
    world.crime('ramCop');
  }

  // Dante on foot and the cruiser stopped beside him: a cop gets out.
  // Spawn range 12 (not 7): the cruiser brakes as it closes in, and if
  // the parked car (or a building corner) sits between it and Dante it
  // can grind at 9-10 units for a minute without ever reaching 7 — one
  // playtest watched exactly that stall, then BUSTED fired seconds after
  // the 150 s wait window closed. A real cop gets out and runs the last
  // few units; the foot cop runs 7.5 m/s, so a spawn at 12 still reaches
  // a standing Dante in ~2 s, and a running Dante (10.5 m/s) can still
  // outrun him.
  if (!suspect.inCar && gap < 12 && Math.abs(car.speed) < 3 && world.police.footCops.length < 2) {
    const cop = {
      x: car.x + 2,
      z: car.z + 2,
      heading: 0,
      phase: 0,
      grabTimer: 0,
      group: makeFootCopFigure(),
    };
    cop.group.position.set(cop.x, 0, cop.z);
    world.police.footCops.push(cop);
    world.scene.add(cop.group);
    world.feed('SBPD: officer on foot — do not resist.');
  }
}

function moveFootCops(world, dt) {
  let events = 0;
  const suspect = world.player;
  for (const cop of world.police.footCops) {
    const dist = Math.hypot(suspect.x - cop.x, suspect.z - cop.z);
    if (suspect.inCar) {
      // Nobody to grab: the cop jogs back toward the cruiser and leaves.
      cop.x += Math.sin(cop.heading) * 4 * dt;
      cop.z += Math.cos(cop.heading) * 4 * dt;
      if (dist > 40) {
        world.scene.remove(cop.group);
        world.police.footCops.splice(world.police.footCops.indexOf(cop), 1);
        continue;
      }
    } else {
      cop.heading = Math.atan2(suspect.x - cop.x, suspect.z - cop.z);
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

function manageRoadblock(world, dt) {
  const stars = world.wanted.stars;
  if (stars >= WANTED.roadblockAt && world.police.roadblock.length === 0) {
    const suspect = world.player;
    const px = suspect.inCar ? suspect.inCar.x : suspect.x;
    const pz = suspect.inCar ? suspect.inCar.z : suspect.z;
    const heading = suspect.inCar ? suspect.inCar.heading : suspect.heading;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    for (const side of [-4, 4]) {
      const blocker = createCar(
        POLICE_CAR,
        px + fx * 45 - fz * side,
        pz + fz * 45 + fx * side,
        heading + Math.PI / 2,
        { isPolice: true },
      );
      world.police.roadblock.push(blocker);
      world.cars.push(blocker);
      world.scene.add(blocker.group);
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

function flyHeli(world, dt) {
  const stars = world.wanted.stars;
  const heli = world.police.heli;
  if (stars < WANTED.heliAt) {
    heli.visible = false;
    return;
  }
  heli.visible = true;
  world.police.heliAngle += dt * 0.25;
  const px = world.player.inCar ? world.player.inCar.x : world.player.x;
  const pz = world.player.inCar ? world.player.inCar.z : world.player.z;
  heli.position.set(
    px + Math.cos(world.police.heliAngle) * 32,
    48,
    pz + Math.sin(world.police.heliAngle) * 32,
  );
  heli.rotation.y = -world.police.heliAngle;
  heli.userData.rotor.rotation.y += dt * 20;
  heli.userData.light.target.position.set(px - heli.position.x, -48, pz - heli.position.z);
}

export function stepPolice(world, dt, random) {
  let events = 0;
  const want = WANTED.policePerStar[Math.min(WANTED.max, world.wanted.stars)];

  // HOT PURSUIT: a cruiser only knows where Dante IS while it is close
  // enough to see him — but a fresh crime is a fresh tip-off, and a
  // cruiser that JUST saw him still holds a live fix. While the trail
  // is hot (hotTimer > 0) every cruiser converges on Dante's CURRENT
  // position, so a suspect who stops 160 units away is still run down
  // instead of watched from a stale spot while the star decays. Once the
  // trail goes cold (no visual contact for hotSeconds) lastSeen freezes
  // and the pack searches the last-seen spot instead of homing perfectly
  // — that freeze is what lets a fast driver break contact and lose the
  // heat. Visual contact (inside loseDistance) re-heats the trail.
  const px = world.player.inCar ? world.player.inCar.x : world.player.x;
  const pz = world.player.inCar ? world.player.inCar.z : world.player.z;
  const anyClose = world.police.cars.some(
    (c) => Math.hypot(c.x - px, c.z - pz) < WANTED.loseDistance,
  );
  if (anyClose) {
    world.police.hotTimer = WANTED.hotSeconds;
  } else {
    world.police.hotTimer = Math.max(0, world.police.hotTimer - dt);
  }
  if (world.police.hotTimer > 0) world.police.lastSeen = { x: px, z: pz };

  world.police.spawnTimer -= dt;
  while (world.police.cars.length < want && world.police.spawnTimer <= 0) {
    launchCruiser(world, random);
    world.police.spawnTimer = 1.5;
  }

  // Too many cruisers (the heat dropped): the furthest peels off.
  if (world.police.cars.length > want) {
    const far = world.police.cars.reduce((a, b) => {
      const da = Math.hypot(a.x - world.player.x, a.z - world.player.z);
      const db = Math.hypot(b.x - world.player.x, b.z - world.player.z);
      return da > db ? a : b;
    });
    world.scene.remove(far.group);
    world.cars.splice(world.cars.indexOf(far), 1);
    world.police.cars.splice(world.police.cars.indexOf(far), 1);
  }

  for (const car of world.police.cars) driveCruiser(world, car, dt, random);
  events |= moveFootCops(world, dt);
  manageRoadblock(world, dt);
  flyHeli(world, dt);
  return events;
}
