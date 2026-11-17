// Cars: procedural low-poly models (body, cabin, wheels, lights — no asset
// files) and arcade handling: throttle, brake/reverse, steering that bites
// harder at speed, handbrake drift, building and car collisions, damage.
import * as THREE from 'three';
import { collideBuildings } from './city.js';

let nextId = 1;

export function createCarMesh(model, color, isPolice) {
  const group = new THREE.Group();
  const len = model.len;
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1d2b33, roughness: 0.1, metalness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, len), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, len * 0.45), glass);
  cabin.position.set(0, 1.05, -len * 0.05);
  cabin.castShadow = true;
  group.add(cabin);
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.18, len * 0.6),
      new THREE.MeshStandardMaterial({ color: 0xf5ead6, roughness: 0.4 }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a8, emissiveIntensity: 1.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa2222, emissive: 0x881111, emissiveIntensity: 0.8 });
  for (const side of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.08), headMat);
    head.position.set(side, 0.6, len / 2);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.08), tailMat);
    tail.position.set(side, 0.6, -len / 2);
    group.add(tail);
  }
  // Light bar on police cars; the two lamps flash in police.js.
  let lightBar = null;
  if (isPolice) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 }));
    red.position.x = -0.35;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 2 }));
    blue.position.x = 0.35;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.38, 0);
    lightBar.userData = { red, blue };
    group.add(lightBar);
  }
  // Wheels: spin with speed, front pair steers.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheels = [];
  for (const [wx, wz] of [[-0.85, len / 2 - 0.7], [0.85, len / 2 - 0.7], [-0.85, -len / 2 + 0.7], [0.85, -len / 2 + 0.7]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData = { wheels, lightBar };
  return group;
}

export function createCar(model, x, z, heading, options = {}) {
  const color = options.color ?? model.color;
  const group = createCarMesh(model, color, !!options.isPolice);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  return {
    id: nextId,
    model,
    color,
    x, z, heading,
    speed: 0,
    steer: 0,
    health: 100,
    wrecked: false,
    isPlayer: false,
    isPolice: !!options.isPolice,
    isTraffic: !!options.isTraffic,
    driver: options.driver ?? null,
    group,
    smokeTimer: 0,
  };
}

export function carSpeedKmh(car) {
  return Math.abs(car.speed) * 3.6;
}

function forward(car) {
  return { x: Math.sin(car.heading), z: Math.cos(car.heading) };
}

/**
 * One fixed step of arcade handling. `drive` is { throttle: -1..1, steer: -1..1,
 * handbrake }. Returns the impact speed when a hard collision happened.
 */
export function stepCar(car, drive, dt, city, others) {
  if (car.wrecked) return 0;
  const model = car.model;
  const fwd = forward(car);
  const grip = car.isPolice ? model.grip : model.grip * (drive.handbrake ? 0.45 : 1);
  const targetSteer = drive.steer * (0.55 + 0.45 * Math.min(1, Math.abs(car.speed) / 12));
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);

  if (drive.throttle > 0) car.speed += model.accel * drive.throttle * dt;
  else if (drive.throttle < 0) {
    car.speed += (car.speed > 0.5 ? model.accel * 1.4 * drive.throttle : model.accel * 0.6 * drive.throttle) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  if (drive.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 14 * dt);
  const maxReverse = 9;
  car.speed = Math.max(-maxReverse, Math.min(model.topSpeed, car.speed));

  // Yaw follows steering; handbrake slides the tail out.
  const yawRate = car.steer * (car.speed / (model.len * 0.9)) * grip * 0.55;
  car.heading += yawRate * dt;
  const nf = forward(car);
  let nx = car.x + nf.x * car.speed * dt;
  let nz = car.z + nf.z * car.speed * dt;

  // Buildings: slide along the wall, lose speed, take damage on a hard hit.
  let impact = 0;
  const resolved = collideBuildings(city, nx, nz, 1.1);
  if (resolved.hit) {
    const intoWall = Math.abs(nf.x * resolved.hit.nx + nf.z * resolved.hit.nz);
    if (intoWall > 0.2) {
      impact = Math.abs(car.speed) * intoWall;
      car.speed *= (1 - intoWall * 0.7);
      if (impact > 6) car.health -= (impact - 6) * 2;
    }
    nx = resolved.x;
    nz = resolved.z;
  }
  // Other cars: soft circle push.
  for (const other of others) {
    if (other === car || other.wrecked) continue;
    const dx = nx - other.x;
    const dz = nz - other.z;
    const dist = Math.hypot(dx, dz);
    const minDist = (car.model.len + other.model.len) / 2 - 0.6;
    if (dist > 0.01 && dist < minDist) {
      const push = (minDist - dist) / 2;
      const ux = dx / dist;
      const uz = dz / dist;
      nx += ux * push;
      nz += uz * push;
      other.x -= ux * push;
      other.z -= uz * push;
      const rel = Math.abs(car.speed - other.speed);
      if (rel > 5) {
        impact = Math.max(impact, rel);
        car.health -= (rel - 5) * 1.5;
        other.health -= (rel - 5) * 1.5;
        other.speed *= 0.8;
        car.speed *= 0.85;
      }
    }
  }
  car.x = nx;
  car.z = nz;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
  }
  syncCarMesh(car, dt);
  return impact;
}

/** Write the physics state into the mesh: position, yaw, wheel spin/steer, lean. */
export function syncCarMesh(car, dt) {
  const group = car.group;
  group.position.set(car.x, 0, car.z);
  group.rotation.y = car.heading;
  const wheels = group.userData.wheels;
  const spin = (car.speed * dt) / 0.36;
  wheels.forEach((wheel, i) => {
    wheel.rotation.x += spin;
    if (i < 2) wheel.rotation.y = car.steer * 0.4;
  });
  // Body lean into corners, a little dive under braking.
  group.rotation.z = -car.steer * Math.min(1, Math.abs(car.speed) / 20) * 0.05;
  group.rotation.x = 0;
  if (group.userData.lightBar) {
    const flash = Math.floor(performance.now() / 180) % 2 === 0;
    group.userData.lightBar.userData.red.material.emissiveIntensity = flash ? 3 : 0.2;
    group.userData.lightBar.userData.blue.material.emissiveIntensity = flash ? 0.2 : 3;
  }
}
