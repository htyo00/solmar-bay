// Police: cruisers that chase on the roads, foot cops that grab Dante.
// Cruisers never despawn mid-pursuit; they only stand down once stars hit 0.
import * as THREE from 'three';
import { CFG } from './config.js';
import { roadRoute, pushOut } from './city.js';
import { angleDiff, dist2 } from './random.js';
import { createCar, driveCar } from './vehicles.js';
import { makeRng, range, pick, clamp } from './random.js';

export function createPolice(G) {
  const rng = makeRng(900913);
  const cruisers = [];
  const foot = [];
  let reRouteT = 0;

  function spawnCruiser() {
    // a road point roughly one spawn-distance away from the player
    const a = range(rng, 0, Math.PI * 2);
    const d = CFG.cruiserSpawnDist + range(rng, 0, 40);
    let x = G.player.pos.x + Math.cos(a) * d;
    let z = G.player.pos.z + Math.sin(a) * d;
    x = clamp(x, -CFG.bound, CFG.bound);
    z = clamp(z, -CFG.bound, CFG.bound);
    const car = createCar(G, 'cruiser', x, z, range(rng, 0, Math.PI * 2));
    car.route = null;
    car.reRouteCd = 0;
    cruisers.push(car);
  }

  function spawnFootCop() {
    const a = range(rng, 0, Math.PI * 2);
    const d = CFG.footSpawnDist + range(rng, 0, 20);
    const x = clamp(G.player.pos.x + Math.cos(a) * d, -CFG.bound, CFG.bound);
    const z = clamp(G.player.pos.z + Math.sin(a) * d, -CFG.bound, CFG.bound);
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x1a2a55, emissive: 0x0a1530, emissiveIntensity: 0.7 }));
    body.position.y = 1.5;
    g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65),
      new THREE.MeshLambertMaterial({ color: 0xd8a075 }));
    head.position.y = 2.55;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.7),
      new THREE.MeshBasicMaterial({ color: 0x0a1530 }));
    cap.position.y = 2.95;
    g.add(cap);
    g.position.set(x, 0, z);
    G.scene.add(g);
    foot.push({ mesh: g, pos: { x, z }, heading: 0, grab: 0, speed: 6.6 });
  }

  function removeUnit(list, u) {
    const i = list.indexOf(u);
    if (i >= 0) list.splice(i, 1);
    G.scene.remove(u.mesh);
  }

  function updateCruiser(car, dt) {
    car.reRouteCd -= dt;
    if (car.reRouteCd <= 0 || !car.route || car.route.length === 0) {
      car.route = roadRoute(car.pos.x, car.pos.z, G.player.pos.x, G.player.pos.z);
      car.reRouteCd = 1.4;
    }
    const wp = car.route[0];
    const dx = wp.x - car.pos.x, dz = wp.z - car.pos.z;
    if (Math.hypot(dx, dz) < 5) { car.route.shift(); return; }
    const desired = Math.atan2(-dx, -dz);
    const steer = clamp(angleDiff(car.heading, desired) * 1.8, -1, 1);
    // close in and ram the player's car gently
    const pd = Math.hypot(G.player.pos.x - car.pos.x, G.player.pos.z - car.pos.z);
    const throttle = pd < 4 ? 0.5 : 0.95;
    driveCar(G, car, dt, { throttle, steer, nitro: false, brake: false });
    // ramming the player on foot hurts
    if (!G.player.inCar && G.player.health > 0 && pd < 3) {
      G.player.takeDamage(10, 'rammed by cruiser');
    }
  }

  function updateFootCop(cop, dt) {
    const dx = G.player.pos.x - cop.pos.x, dz = G.player.pos.z - cop.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    cop.heading = Math.atan2(-dx, -dz);
    cop.pos.x += -Math.sin(cop.heading) * cop.speed * dt;
    cop.pos.z += -Math.cos(cop.heading) * cop.speed * dt;
    pushOut(cop.pos, 0.9, G.world.solids);
    cop.mesh.position.set(cop.pos.x, 0, cop.pos.z);
    cop.mesh.rotation.y = cop.heading;
    // grabbing Dante: close for a sustained hold while he is on foot
    if (!G.player.inCar && G.player.health > 0 && d < CFG.copCatchDist) {
      cop.grab += dt;
      if (cop.grab >= CFG.bustHold) G.onBusted();
    } else {
      cop.grab = Math.max(0, cop.grab - dt * 2);
    }
  }

  function update(dt) {
    const stars = G.wanted.stars;
    const [wantCruisers, wantFoot] = CFG.force[stars] || [0, 0];
    while (cruisers.length < wantCruisers) spawnCruiser();
    while (foot.length < wantFoot) spawnFootCop();
    // stand down only when the heat is fully gone
    if (stars === 0) {
      for (const c of [...cruisers]) {
        if (dist2(c.pos.x, c.pos.z, G.player.pos.x, G.player.pos.z) > 110 * 110) removeUnit(cruisers, c);
      }
      for (const c of [...foot]) {
        if (dist2(c.pos.x, c.pos.z, G.player.pos.x, G.player.pos.z) > 70 * 70) removeUnit(foot, c);
      }
    }
    for (const c of cruisers) updateCruiser(c, dt);
    for (const c of foot) updateFootCop(c, dt);
    reRouteT -= dt;
  }

  function standDown() {
    for (const c of [...cruisers]) removeUnit(cruisers, c);
    for (const c of [...foot]) removeUnit(foot, c);
  }

  return { cruisers, foot, update, standDown };
}
