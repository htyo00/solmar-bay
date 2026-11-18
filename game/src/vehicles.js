// Cars: boxy procedural meshes + arcade drive physics + nitro.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp } from './random.js';
import { pushOut } from './city.js';

const PAINT = {
  comet: 0xe8362a, sedan: 0x3a6fd8, taxi: 0xf2c200, truck: 0x7a7f8a,
  van: 0x8a5fd0, cruiser: 0xe8e8e8,
};

export function makeCarMesh(type) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({
    color: PAINT[type] || 0x888888, emissive: PAINT[type] || 0x888888, emissiveIntensity: 0.12,
  });
  const glass = new THREE.MeshLambertMaterial({ color: 0x0a1420, emissive: 0x1a3a55, emissiveIntensity: 0.8 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x111114 });
  const low = type === 'comet';
  const L = type === 'truck' ? 7.4 : low ? 4.6 : 5.2;
  const W = type === 'truck' ? 2.8 : 2.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, low ? 0.85 : 1.1, L), paint);
  body.position.y = low ? 0.62 : 0.85;
  g.add(body);
  if (type === 'truck') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.4, 4.2), new THREE.MeshLambertMaterial({ color: 0xb8b0a0 }));
    box.position.set(0, 1.9, 1.2);
    g.add(box);
  } else {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.75, L * 0.42), glass);
    cab.position.set(0, low ? 1.25 : 1.6, low ? 0.2 : -0.3);
    g.add(cab);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  for (const [x, z] of [[-W / 2, L / 2 - 0.9], [W / 2, L / 2 - 0.9], [-W / 2, -L / 2 + 0.9], [W / 2, -L / 2 + 0.9]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w);
  }
  // headlights + taillights
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.1), headMat);
    h.position.set(x, 0.8, -L / 2 - 0.03);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.1), tailMat);
    t.position.set(x, 0.8, L / 2 + 0.03);
    g.add(t);
  }
  if (type === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 2.05, -0.3);
    g.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(-0.7, 2.05, -0.3);
    g.add(bar2);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 2.2), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    door.position.set(-W / 2 - 0.02, 0.9, 0);
    g.add(door);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe970 }));
    sign.position.set(0, 2.05, -0.3);
    g.add(sign);
  }
  return g;
}

export function createCar(G, type, x, z, heading) {
  const mesh = makeCarMesh(type);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    type, mesh,
    pos: { x, z },
    heading,
    speed: 0,
    steer: 0,
    nitro: CFG.nitroMax,
    boosting: false,
    damage: 0,
    top: CFG.topSpeed[type] || 26,
    radius: type === 'truck' ? 3.4 : 2.3,
  };
  return car;
}

// ctrl: {throttle -1..1, steer -1..1, nitro bool, brake bool}
export function driveCar(G, car, dt, ctrl) {
  const top = car.top + (car.boosting ? CFG.nitroBoost : 0);
  if (ctrl.throttle > 0) car.speed += CFG.accel * ctrl.throttle * dt;
  else if (ctrl.throttle < 0) car.speed += CFG.reverseAccel * ctrl.throttle * dt;
  if (ctrl.brake) car.speed -= Math.sign(car.speed) * CFG.brake * dt;
  // drag + rolling resistance
  car.speed -= car.speed * 0.55 * dt;
  if (Math.abs(car.speed) < 0.15 && ctrl.throttle === 0) car.speed = 0;
  car.speed = clamp(car.speed, -top * 0.45, top);
  // steering scales with speed, flips in reverse
  const sf = clamp(Math.abs(car.speed) / 8, 0, 1);
  car.heading += ctrl.steer * CFG.steerRate * sf * dt * (car.speed >= 0 ? -1 : 1);
  const fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;
  car.pos.x = clamp(car.pos.x, -CFG.bound, CFG.bound);
  car.pos.z = clamp(car.pos.z, -CFG.bound, CFG.bound);
  // nitro
  car.boosting = ctrl.nitro && ctrl.throttle > 0 && car.nitro > 0;
  if (car.boosting) car.nitro = Math.max(0, car.nitro - CFG.nitroDrain * dt);
  else car.nitro = Math.min(CFG.nitroMax, car.nitro + CFG.nitroRegen * dt);
  // building collision: slide along, lose speed, take damage on hard hits
  const before = { x: car.pos.x, z: car.pos.z };
  if (pushOut(car.pos, car.radius, G.world.solids)) {
    const impact = Math.abs(car.speed);
    car.speed *= 0.45;
    if (impact > 12) {
      car.damage += impact * 0.4;
      G.audio.crash();
      G.hud.flash('CRASH');
    }
  }
  meshSync(car);
}

export function meshSync(car) {
  car.mesh.position.set(car.pos.x, 0, car.pos.z);
  car.mesh.rotation.y = car.heading;
}
