// Dante Cross on foot: tank-style walk/run, building collision, damage model.
import * as THREE from 'three';
import { CFG } from './config.js';
import { clamp } from './random.js';
import { pushOut } from './city.js';
import { PLACES } from './city.js';

export function createPlayer(G) {
  const body = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.5, 0.6),
    new THREE.MeshLambertMaterial({ color: 0x7a1f2b, emissive: 0x2a0508, emissiveIntensity: 0.7 })
  );
  torso.position.y = 1.5;
  body.add(torso);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.7, 0.7),
    new THREE.MeshLambertMaterial({ color: 0xd8a075 })
  );
  head.position.y = 2.6;
  body.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.1, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x1c2438 })
  );
  legs.position.y = 0.55;
  body.add(legs);
  // neon jacket stripe so Dante reads at a glance in the dark
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.14, 0.22, 0.64),
    new THREE.MeshBasicMaterial({ color: 0x35e0ff })
  );
  stripe.position.y = 1.9;
  body.add(stripe);
  G.scene.add(body);

  const P = {
    pos: { x: PLACES.playerStart.x, z: PLACES.playerStart.z },
    heading: PLACES.playerStart.heading,
    speed: 0,
    health: CFG.maxHealth,
    armor: 40,
    inCar: false,
    car: null,
    mesh: body,
    hurtFlash: 0,
  };

  function stepOut() {
    const c = P.car;
    if (!c) return;
    P.inCar = false;
    P.car = null;
    const side = { x: Math.cos(c.heading), z: -Math.sin(c.heading) };
    P.pos.x = c.pos.x + side.x * 3;
    P.pos.z = c.pos.z + side.z * 3;
    P.heading = c.heading;
    pushOut(P.pos, 1, G.world.solids);
  }

  function takeDamage(amount, cause) {
    if (P.health <= 0) return;
    const toArmor = Math.min(P.armor, amount * 0.6);
    P.armor -= toArmor;
    P.health -= (amount - toArmor);
    P.hurtFlash = 0.35;
    if (P.health <= 0) {
      P.health = 0;
      G.onWasted(cause);
    }
  }

  function update(dt) {
    if (P.inCar) {
      P.pos.x = P.car.pos.x;
      P.pos.z = P.car.pos.z;
      P.heading = P.car.heading;
      body.visible = false;
      return;
    }
    body.visible = true;
    const ax = G.input.axis();
    const run = G.input.down('ShiftLeft') || G.input.down('ShiftRight');
    const top = run ? CFG.runSpeed : CFG.walkSpeed;
    // A/D turn, W/S move along the facing (reverse flips steering, like a car)
    const dir = ax.f >= 0 ? -1 : 1;
    P.heading += ax.s * 3.4 * dt * dir;
    const target = ax.f * top;
    P.speed += (target - P.speed) * Math.min(1, dt * 10);
    P.pos.x -= Math.sin(P.heading) * P.speed * dt;
    P.pos.z -= Math.cos(P.heading) * P.speed * dt;
    P.pos.x = clamp(P.pos.x, -CFG.bound, CFG.bound);
    P.pos.z = clamp(P.pos.z, -CFG.bound, CFG.bound);
    pushOut(P.pos, 0.9, G.world.solids);
    if (P.hurtFlash > 0) P.hurtFlash -= dt;
    body.position.set(P.pos.x, 0, P.pos.z);
    body.rotation.y = P.heading;
    // walk bob
    legs.position.y = 0.55 + Math.abs(Math.sin(G.time * 9)) * 0.08 * Math.min(1, Math.abs(P.speed) / 5);
  }

  P.update = update;
  P.stepOut = stepOut;
  P.takeDamage = takeDamage;
  return P;
}
