// Dante Cross on foot: WASD movement relative to the camera, Shift to run,
// mouse-drag to orbit the camera, E to steal the nearest car (hold) or to
// step out of a slow car (tap). Stealing a car the driver is sitting in
// throws the driver out as a fleeing pedestrian — and earns a wanted star.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { collideBuildings } from './city.js';
import { stepCar } from './vehicles.js';

export function createPlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x264653, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 0.7 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), jacket);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.8, 0.3), jeans);
  legL.position.set(-0.18, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.18;
  group.add(legL, legR);
  group.userData = { legL, legR, torso };
  return group;
}

export function createPlayer(city) {
  const group = createPlayerMesh();
  group.position.set(city.start.x, 0, city.start.z);
  return {
    x: city.start.x, z: city.start.z,
    heading: city.start.heading,
    camYaw: city.start.heading,
    speed: 0,
    health: PLAYER.health,
    walkPhase: 0,
    inCar: null,
    stealTarget: null,
    stealProgress: 0,
    prevSteal: false,
    group,
  };
}

/** The nearest car Dante can reach from where he stands. */
export function nearestCar(world, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of world.cars) {
    if (car.wrecked) continue;
    const dist = Math.hypot(car.x - world.player.x, car.z - world.player.z);
    if (dist < bestDist) {
      bestDist = dist;
      best = car;
    }
  }
  return best;
}

function syncPlayerMesh(player, dt) {
  const group = player.group;
  group.position.set(player.x, 0, player.z);
  group.rotation.y = player.heading;
  const swing = Math.sin(player.walkPhase) * 0.5 * Math.min(1, player.speed / 6);
  group.userData.legL.rotation.x = swing;
  group.userData.legR.rotation.x = -swing;
  group.userData.torso.rotation.x = Math.min(0.15, player.speed * 0.008);
}

/**
 * On-foot step. Returns event flags (see world.js). When Dante is in a car,
 * world.js drives the car instead and this only syncs the hidden mesh.
 */
export function stepPlayer(world, dt, input) {
  const player = world.player;
  if (player.inCar) return 0;
  let events = 0;
  // Camera orbit from mouse drag; movement is relative to the camera.
  player.camYaw -= input.takeDrag() * 0.005;
  const moveX = (input.right() ? 1 : 0) - (input.left() ? 1 : 0);
  const moveZ = (input.back() ? 1 : 0) - (input.forward() ? 1 : 0);
  const moving = moveX !== 0 || moveZ !== 0;
  const targetSpeed = moving ? (input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed) : 0;
  player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 10);
  if (moving) {
    // Move relative to the camera: W along where it looks, A/D strafing.
    // Camera forward is (sin(camYaw), cos(camYaw)); right is (-cos, sin).
    const fwd = -moveZ; // 1 while W is held
    const dirX = Math.sin(player.camYaw) * fwd - Math.cos(player.camYaw) * moveX;
    const dirZ = Math.cos(player.camYaw) * fwd + Math.sin(player.camYaw) * moveX;
    const len = Math.hypot(dirX, dirZ) || 1;
    const wanted = Math.atan2(dirX / len, dirZ / len);
    let diff = wanted - player.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.heading += diff * Math.min(1, dt * 12);
    player.walkPhase += dt * player.speed * 1.6;
    const nx = player.x + Math.sin(player.heading) * player.speed * dt;
    const nz = player.z + Math.cos(player.heading) * player.speed * dt;
    const resolved = collideBuildings(world.city, nx, nz, PLAYER.radius);
    player.x = resolved.x;
    player.z = resolved.z;
    player.x = Math.max(-108, Math.min(108, player.x));
    player.z = Math.max(-108, Math.min(138, player.z));
  }
  // Steal / enter: hold E near a car. A traffic car throws its driver out.
  const target = nearestCar(world, PLAYER.stealRange);
  player.stealTarget = target;
  if (target && input.steal()) {
    player.stealProgress += dt / PLAYER.stealHold;
    if (player.stealProgress >= 1) {
      enterCar(world, target);
      player.stealProgress = 0;
      events |= 1; // EVENT_STEAL
    }
  } else {
    player.stealProgress = 0;
  }
  syncPlayerMesh(player, dt);
  return events;
}

export function enterCar(world, car) {
  const player = world.player;
  if (car.isTraffic && car.driver) {
    // The driver bails and runs — a new pedestrian, scared.
    world.addFleeingPed(car.x + 1.5, car.z + 1.5);
    car.driver = null;
    car.isTraffic = false;
  }
  car.isPlayer = true;
  player.inCar = car;
  player.group.visible = false;
  world.crime('steal');
}

export function exitCar(world) {
  const player = world.player;
  const car = player.inCar;
  if (!car) return;
  car.isPlayer = false;
  player.inCar = null;
  const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
  player.x = car.x + side.x * 2.2;
  player.z = car.z + side.z * 2.2;
  player.heading = car.heading;
  player.camYaw = car.heading;
  player.group.visible = true;
  player.group.position.set(player.x, 0, player.z);
}

/** Driving input mapped from the keyboard, for the car Dante is sitting in. */
export function drivingInput(input) {
  return {
    throttle: (input.forward() ? 1 : 0) - (input.back() ? 1 : 0),
    steer: (input.left() ? 1 : 0) - (input.right() ? 1 : 0),
    handbrake: input.handbrake(),
  };
}

export { stepCar };
