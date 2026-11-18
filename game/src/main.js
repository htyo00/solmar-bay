// Solmar Bay bootstrap: builds the world, runs the fixed-step loop,
// owns the state machine (title / play / map / pause / busted / wasted).
import { CFG } from './config.js';
import { PLACES } from './city.js';
import { createRender } from './render.js';
import { buildWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, storeSave } from './save.js';
import { createPlayer } from './player.js';
import { createCar, driveCar } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPeds } from './pedestrians.js';
import { createPolice } from './police.js';
import { createWanted } from './wanted.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const R = createRender(canvas);
const G = {
  time: 0,
  state: 'title',
  camOrbit: 0,
  fps: 0,
  errors: [],
  shotMode: false,
  scene: R.scene,
  save: loadSave(),
};
G.storeSave = () => storeSave(G.save);
G.input = createInput();
G.audio = createAudio();
G.world = buildWorld(R.scene);
G.player = createPlayer(G);
G.traffic = createTraffic(G);
G.peds = createPeds(G);
G.police = createPolice(G);
G.wanted = createWanted(G);
G.missions = createMissions(G);
G.combat = createCombat(G);
G.hud = createHud(G);
G.render = R;

// the Comet GT + a few parked cars worth stealing
const comet = createCar(G, 'comet', PLACES.cometSpawn.x, PLACES.cometSpawn.z, PLACES.cometSpawn.heading);
G.missions.comet = comet;
G.cars = [comet];
const parkedSpots = [
  ['sedan', -100, 52, 0], ['taxi', 100, -48, Math.PI / 2], ['van', -52, 200, Math.PI],
  ['sedan', 52, -200, -Math.PI / 2], ['taxi', -200, -52, 0], ['sedan', 148, 100, Math.PI],
];
for (const [type, x, z, h] of parkedSpots) G.cars.push(createCar(G, type, x, z, h));

G.onBusted = () => {
  if (G.state === 'busted') return;
  if (G.player.inCar) G.player.stepOut();
  G.state = 'busted';
  G.save.busted += 1;
  G.save.cash = Math.max(0, G.save.cash - CFG.bustFine);
  G.storeSave();
  G.wanted.stars = 0;
  G.wanted.searching = false;
  G.police.standDown();
  G.audio.busted();
  G.hud.showBusted();
};
G.onWasted = () => {
  if (G.state === 'wasted') return;
  if (G.player.inCar) G.player.stepOut();
  G.state = 'wasted';
  G.save.wasted += 1;
  G.save.cash = Math.max(0, G.save.cash - CFG.wastedFine);
  G.storeSave();
  G.wanted.stars = 0;
  G.wanted.searching = false;
  G.police.standDown();
  G.audio.busted();
  G.hud.showWasted();
};

function respawn(at) {
  G.player.pos.x = at.x;
  G.player.pos.z = at.z;
  G.player.heading = 0;
  G.player.speed = 0;
  G.player.health = CFG.maxHealth;
  G.player.armor = 40;
  G.state = 'play';
  G.hud.hideOverlays();
  G.audio.click();
}

function tryEnterCar() {
  const p = G.player.pos;
  let best = null, bd = 16;
  for (const c of G.cars) {
    const dx = c.pos.x - p.x, dz = c.pos.z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bd) { best = c; bd = d2; }
  }
  if (!best) return;
  G.player.inCar = true;
  G.player.car = best;
  G.audio.pickup();
  if (best !== comet) G.wanted.addStars(1);
}

function interact() {
  if (G.player.inCar) {
    G.player.stepOut();
    G.audio.click();
  } else {
    tryEnterCar();
  }
}

function nearestCarPrompt() {
  if (G.player.inCar) { G.hud.prompt('E — STEP OUT'); return; }
  const p = G.player.pos;
  for (const c of G.cars) {
    const dx = c.pos.x - p.x, dz = c.pos.z - p.z;
    if (dx * dx + dz * dz < 16) {
      G.hud.prompt(c === comet ? 'E — STEAL THE COMET GT' : 'E — STEAL CAR');
      return;
    }
  }
  G.hud.prompt(null);
}

function update(dt) {
  G.time += dt;
  // world dressing keeps moving in every state
  for (const c of G.world.coins) if (!c.taken) c.mesh.rotation.y += dt * 1.5;
  G.world.wheel.rotation.z -= dt * 0.12;
  if (G.state !== 'play') return;
  G.camOrbit += G.input.orbit();
  G.camOrbit *= 0.995;
  const ax = G.input.axis();
  if (G.player.inCar) {
    driveCar(G, G.player.car, dt, {
      throttle: ax.f,
      steer: ax.s,
      nitro: G.input.down('ShiftLeft') || G.input.down('ShiftRight'),
      brake: G.input.down('Space'),
    });
    G.audio.engine(G.player.car.speed, true);
  } else {
    G.audio.engine(0, false);
  }
  G.player.update(dt);
  G.traffic.update(dt);
  G.peds.update(dt);
  G.police.update(dt);
  G.wanted.update(dt);
  G.missions.update(dt);
  G.combat.update(dt);
  if (G.input.pressed('KeyE')) interact();
  if (G.input.pressed('KeyF')) G.combat.punch();
  if (G.input.pressed('KeyM')) { G.state = 'map'; G.hud.showMap(); }
  if (G.input.pressed('KeyP') || G.input.pressed('Escape')) { G.state = 'pause'; G.hud.showPause(); }
  nearestCarPrompt();
  G.hud.update(dt);
}

function keyMenu() {
  const I = G.input;
  if (G.state === 'title' && I.consume('Enter')) {
    G.audio.start();
    G.audio.click();
    G.state = 'play';
    G.hud.hideOverlays();
    G.hud.flash('MISSION 1 — STEAL THE COMET GT');
  } else if (G.state === 'map' && (I.consume('KeyM') || I.consume('Escape') || I.consume('KeyP'))) {
    G.state = 'play';
    G.hud.hideOverlays();
  } else if (G.state === 'pause' && (I.consume('KeyP') || I.consume('Escape'))) {
    G.state = 'play';
    G.hud.hideOverlays();
  } else if (G.state === 'busted' && I.consume('Enter')) {
    respawn(PLACES.policeHq);
  } else if (G.state === 'wasted' && I.consume('Enter')) {
    respawn(PLACES.hospital);
  } else if (G.state === 'play' && G.missions.done && I.consume('Enter')) {
    G.hud.hideOverlays();
  }
}

// fixed-step loop: game time tracks wall time even at 2-3 FPS
let last = performance.now();
let acc = 0;
let frames = 0, fpsT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > CFG.frameCap) dt = CFG.frameCap;
  frames += 1;
  fpsT += dt;
  if (fpsT >= 1) { G.fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  keyMenu();
  if (!G.shotMode) {
    acc += dt;
    let n = 0;
    while (acc >= CFG.step && n < CFG.maxSteps) {
      update(CFG.step);
      acc -= CFG.step;
      // edge-triggered keys (E, F) must fire once per press, not once per
      // fixed sub-step: clear them after the first sub-step of the frame
      if (n === 0) G.input.endFrame();
      n += 1;
    }
    if (n === CFG.maxSteps) acc = 0;
  }
  R.updateCamera(G, dt);
  R.renderer.render(R.scene, R.camera);
  G.input.endFrame();
}

function resize() {
  R.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('error', (e) => {
  G.errors.push(String(e.message || e.error));
});

// test + playtest hook: live state, no cheats beyond what the game allows
window.SB = {
  game: G,
  snapshot() {
    return {
      state: G.state,
      stars: G.wanted.stars,
      searching: G.wanted.searching,
      cash: G.save.cash,
      jobs: G.save.jobs,
      bestGrade: G.save.bestGrade,
      missionStep: G.missions.step,
      missionDone: G.missions.done,
      pos: { x: Math.round(G.player.pos.x), z: Math.round(G.player.pos.z) },
      heading: Math.round(G.player.heading * 100) / 100,
      inCar: G.player.inCar,
      health: Math.round(G.player.health),
      fps: G.fps,
      errors: G.errors.slice(),
    };
  },
};

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  G.hud.hideOverlays();
  applyShot(G, shot);
  // shot mode skips updates, so place Dante's mesh where the shot put him
  G.player.update(0);
  // the title shot is the city alone: Dante stays out of the frame
  if (shot === 'title') G.player.mesh.visible = false;
} else {
  G.hud.showTitle();
}
G.hud.update(0);
requestAnimationFrame(frame);
