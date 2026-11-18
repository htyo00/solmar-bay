// Ambient pedestrians: walk the sidewalks, flee from speeding cars.
import * as THREE from 'three';
import { CFG } from './config.js';
import { dist2 } from './random.js';
import { makeRng, range, pick, clamp } from './random.js';

const SHIRTS = [0xe8e8e8, 0xffc233, 0x35e0ff, 0xff2e88, 0x7ae07a, 0xff9a3c];

export function createPeds(G) {
  const rng = makeRng(424242);
  const peds = [];
  for (let i = 0; i < CFG.peds; i++) {
    const x = pick(rng, CFG.roadLines) + range(rng, -11, 11);
    const z = pick(rng, CFG.roadLines) + range(rng, -11, 11);
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.4, 0.5),
      new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS), emissive: 0x111111, emissiveIntensity: 0.4 })
    );
    body.position.y = 1.35;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), new THREE.MeshLambertMaterial({ color: 0xd8a075 }));
    head.position.y = 2.3;
    g.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.45), new THREE.MeshLambertMaterial({ color: 0x22222a }));
    legs.position.y = 0.45;
    g.add(legs);
    g.position.set(x, 0, z);
    G.scene.add(g);
    peds.push({
      mesh: g, pos: { x, z }, heading: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1.2, 2.2), target: null, flee: 0, down: 0,
    });
  }

  function newTarget(p) {
    const line = pick(rng, CFG.roadLines);
    const along = range(rng, -230, 230);
    if (chance(rng, 0.5)) p.target = { x: line + range(rng, -11, 11), z: along };
    else p.target = { x: along, z: line + range(rng, -11, 11) };
  }

  function update(dt) {
    for (const p of peds) {
      if (p.down > 0) { p.down -= dt; p.mesh.rotation.x = Math.PI / 2 * 0.9; continue; }
      p.mesh.rotation.x = 0;
      // flee a fast car nearby
      const car = G.player.inCar ? G.player.car : null;
      if (car && Math.abs(car.speed) > 8 && dist2(car.pos.x, car.pos.z, p.pos.x, p.pos.z) < 130) {
        p.flee = 1.2;
        const dx = p.pos.x - car.pos.x, dz = p.pos.z - car.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        p.pos.x += (dx / d) * 5 * dt;
        p.pos.z += (dz / d) * 5 * dt;
        p.heading = Math.atan2(-(dx / d), -(dz / d));
      } else {
        if (p.flee > 0) p.flee -= dt;
        if (!p.target) newTarget(p);
        const dx = p.target.x - p.pos.x, dz = p.target.z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2) { p.target = null; continue; }
        p.heading = Math.atan2(-dx, -dz);
        p.pos.x += -Math.sin(p.heading) * p.speed * dt;
        p.pos.z += -Math.cos(p.heading) * p.speed * dt;
      }
      p.pos.x = clamp(p.pos.x, -CFG.bound, CFG.bound);
      p.pos.z = clamp(p.pos.z, -CFG.bound, CFG.bound);
      p.mesh.position.set(p.pos.x, 0, p.pos.z);
      p.mesh.rotation.y = p.heading;
    }
  }

  return { peds, update };
}

function chance(rng, p) { return rng() < p; }
