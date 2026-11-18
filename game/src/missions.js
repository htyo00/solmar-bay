// Missions: FIRST JOB (steal, evade, deliver) + the locked chain + Bay Coins.
import * as THREE from 'three';
import { CFG } from './config.js';
import { PLACES } from './city.js';
import { dist2 } from './random.js';

export const MISSION_LIST = [
  { n: 1, name: 'FIRST JOB', desc: 'Steal the Comet GT, lose the cops, deliver it to the pier.' },
  { n: 2, name: 'NEON DEBT', desc: 'Collect three drops for the Loft before sunrise.' },
  { n: 3, name: 'DOCKSIDE', desc: 'Move the Foundry cargo without a single star.' },
  { n: 4, name: 'PALM COURT', desc: 'Valet the hotel fleet — then keep one.' },
  { n: 5, name: 'TOWER HEIST', desc: 'Solmar Tower vault. Bring a fast car.' },
  { n: 6, name: 'KING OF THE BAY', desc: 'One last run. Everyone is watching.' },
];

export function createMissions(G) {
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.85 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 34, 12, 1, true), beaconMat);
  beacon.position.set(PLACES.cometSpawn.x, 17, PLACES.cometSpawn.z);
  G.scene.add(beacon);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 8, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd23c }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(PLACES.cometSpawn.x, 0.4, PLACES.cometSpawn.z);
  G.scene.add(ring);

  const M = {
    active: true,
    step: 0,
    timer: 0,
    grade: null,
    paid: 0,
    done: false,
    comet: null,
    target: { x: PLACES.cometSpawn.x, z: PLACES.cometSpawn.z },
  };

  function stepText() {
    if (M.done) return 'FIRST JOB complete — talk to the Loft for the next run.';
    if (!M.comet) return 'Steal the Comet GT outside the Loft';
    if (M.step === 1) {
      if (G.player.inCar) return 'Lose the cops';
      return 'Get back in the Comet GT';
    }
    if (M.step === 2) {
      if (G.player.inCar) return 'Deliver the Comet GT to the pier';
      return 'Get back in the Comet GT';
    }
    return 'Steal the Comet GT outside the Loft';
  }

  function gradeFor(t, damage) {
    if (t <= CFG.gradeTime.S && damage < 20) return 'S';
    if (t <= CFG.gradeTime.A && damage < 45) return 'A';
    if (t <= CFG.gradeTime.B) return 'B';
    return 'C';
  }

  function complete() {
    M.done = true;
    M.active = false;
    M.grade = gradeFor(M.timer, M.comet ? M.comet.damage : 0);
    M.paid = CFG.pay[M.grade];
    const s = G.save;
    s.cash += M.paid;
    s.jobs += 1;
    s.rep += 10;
    const order = ['C', 'B', 'A', 'S'];
    if (order.indexOf(M.grade) > order.indexOf(s.bestGrade)) s.bestGrade = M.grade;
    G.storeSave();
    G.audio.coin();
    G.hud.showComplete(M.grade, M.paid, M.timer);
    beacon.visible = false;
    ring.visible = false;
  }

  function update(dt) {
    // beacon pulse + ring spin
    const pulse = 0.6 + Math.sin(G.time * 4) * 0.3;
    beaconMat.opacity = pulse;
    ring.rotation.z += dt * 0.6;
    if (M.done) return;
    M.timer += dt;
    // step 0 -> 1: player got into the Comet
    if (M.step === 0 && M.comet && G.player.inCar && G.player.car === M.comet) {
      M.step = 1;
      G.wanted.addStars(1);
      G.hud.flash('1 STAR — THE COPS ARE COMING');
      G.audio.pickup();
    }
    // step 1 -> 2: heat fully gone
    if (M.step === 1 && G.wanted.stars === 0) {
      M.step = 2;
      M.target = { x: PLACES.pierDrop.x, z: PLACES.pierDrop.z };
      beacon.position.set(M.target.x, 17, M.target.z);
      ring.position.set(M.target.x, 0.4, M.target.z);
      G.hud.flash('CLEAN — DELIVER THE COMET TO THE PIER');
    }
    // step 2 -> done: Comet at the pier
    if (M.step === 2 && M.comet && G.player.inCar && G.player.car === M.comet) {
      if (dist2(M.comet.pos.x, M.comet.pos.z, PLACES.pierDrop.x, PLACES.pierDrop.z) < 64) complete();
    }
    // keep the beacon on the current target
    if (M.step === 0 || M.step === 1) {
      beacon.position.set(PLACES.cometSpawn.x, 17, PLACES.cometSpawn.z);
      ring.position.set(PLACES.cometSpawn.x, 0.4, PLACES.cometSpawn.z);
    }
    // Bay Coins
    for (const c of G.world.coins) {
      if (c.taken) continue;
      if (dist2(G.player.pos.x, G.player.pos.z, c.x, c.z) < 9) {
        c.taken = true;
        c.mesh.visible = false;
        G.save.cash += CFG.coinValue;
        G.save.coins += 1;
        G.storeSave();
        G.audio.coin();
        G.hud.flash('BAY COIN +$' + CFG.coinValue);
      }
    }
  }

  M.update = update;
  M.stepText = stepText;
  return M;
}
