// Solmar Bay — boot and the one loop.
//
// One module owns the screens and the clock: it reads input once per frame,
// advances the world in fixed 1/60 s slices (up to eight per frame, so a
// slow frame never spirals), and asks the renderer to paint the result. The
// game lives on seven screens — title, play, paused, map, complete, busted,
// wasted — and the same module serves the deterministic screenshot scenes:
// ?shot=chase|title|mission|complete (plus &seed=N) stages a scene, paints
// it twice, and raises window.__shotReady.
//
// ?seed=N pins the city and the traffic to one layout; without it the seed
// is drawn at random.
import { STEP } from './config.js';
import {
  createWorld,
  resetWorld,
  stepWorld,
  startMission,
  EVENT_COMPLETE,
  EVENT_BUSTED,
  EVENT_WASTED,
  EVENT_OBJECTIVE,
  EVENT_STEAL,
} from './world.js';
import { createRender } from './render.js';
import { createHud } from './hud.js';
import {
  createInput,
  ACTION_CONFIRM,
  ACTION_PAUSE,
  ACTION_MUTE,
  ACTION_RESTART,
  ACTION_MAP,
} from './input.js';
import { createAudio } from './audio.js';
import { writeSave } from './save.js';
import { stageShot } from './shots.js';

// A frame longer than this is treated as a quarter of a second, so a hitch
// can never fast-forward the simulation.
const MAX_DT = 0.25;
// How many fixed steps one frame may run before the leftover time is dropped.
const MAX_STEPS_PER_FRAME = 8;

const query = new URLSearchParams(window.location.search);
const shotName = query.get('shot');
const seedRaw = Number.parseInt(query.get('seed') ?? '', 10);
const seed = Number.isInteger(seedRaw)
  ? seedRaw
  : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const render = createRender(canvas);
const world = createWorld(seed, render.scene);
const hud = createHud();
const input = createInput();
const audio = createAudio();
window.__solmar = { world, render };

// The screens the game moves between.
const S = {
  title: 'title',
  play: 'play',
  paused: 'paused',
  map: 'map',
  complete: 'complete',
  busted: 'busted',
  wasted: 'wasted',
};

function say(text) {
  statusLine.textContent = text;
}

// Getting caught or killed costs a tenth of the cash on hand.
function forfeitCash() {
  const cut = Math.round(world.save.cash * 0.1);
  world.save.cash = Math.max(0, world.save.cash - cut);
  return cut;
}

// ---- screenshot mode -----------------------------------------------------

function runShot(name) {
  const screen = stageShot(name, world);
  hud.show(
    screen === S.title ? 'title-screen' : screen === S.complete ? 'complete-screen' : null,
  );
  if (screen === S.title) hud.setTitle(world.save);
  if (screen === S.complete && world.saveMissionResult) {
    hud.setComplete(world.saveMissionResult);
  }
  // A staged scene never runs the live loop, so sync the HUD once by hand.
  hud.update(world, 1 / 60);
  let painted = 0;
  const paint = () => {
    // Snap the camera straight to its target: the chase lerp would take
    // many frames to settle, and a screenshot gets two.
    render.updateCamera(world, 1);
    render.updateEffects(world, 1 / 60);
    render.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
}

// ---- live game -----------------------------------------------------------

function runGame() {
  let screen = S.title;
  let leftover = 0;
  let lastTime = performance.now();
  let frameCount = 0;
  let fpsClock = 0;

  function beginJob() {
    audio.unlock();
    resetWorld(world);
    startMission(world);
    screen = S.play;
    hud.show(null);
    say('First job. Steal the Comet GT outside the Loft.');
  }

  function backToTitle() {
    resetWorld(world);
    world.cameraMode = 'title';
    screen = S.title;
    hud.setTitle(world.save);
    hud.show('title-screen');
    say('Solmar Bay. Press Enter to start.');
  }

  function endRun(kind) {
    const busted = kind === 'busted';
    world.save.stats[busted ? 'busted' : 'wasted'] += 1;
    const cut = forfeitCash();
    writeSave(world.save);
    screen = busted ? S.busted : S.wasted;
    hud.setEnd(busted ? 'busted' : 'wasted', cut);
    hud.show(busted ? 'busted-screen' : 'wasted-screen');
    say(
      busted
        ? 'Busted. The SBPD took you in.'
        : 'Wasted. You woke up at St. Marina Hospital.',
    );
  }

  function handleActions() {
    const pressed = input.takeActions();
    if (pressed & ACTION_MUTE) {
      const muted = audio.toggleMute();
      world.feed(muted ? 'Sound off.' : 'Sound on.');
    }
    if (pressed & ACTION_RESTART && (screen === S.play || screen === S.paused)) {
      beginJob();
      return;
    }
    if (pressed & ACTION_CONFIRM && screen === S.title) {
      beginJob();
      return;
    }
    if (pressed & ACTION_CONFIRM && (screen === S.complete || screen === S.busted || screen === S.wasted)) {
      beginJob();
      return;
    }
    if (pressed & ACTION_MAP && screen === S.play) {
      screen = S.map;
      hud.showMap(world);
      hud.show('map-screen');
      say('City map. Tab to close.');
      return;
    }
    if (pressed & (ACTION_MAP | ACTION_PAUSE | ACTION_CONFIRM) && screen === S.map) {
      screen = S.play;
      hud.show(null);
      say('Playing.');
      return;
    }
    if (pressed & ACTION_PAUSE && screen === S.play) {
      screen = S.paused;
      hud.show('pause-screen');
      say('Paused.');
    } else if (pressed & (ACTION_PAUSE | ACTION_CONFIRM) && screen === S.paused) {
      screen = S.play;
      hud.show(null);
      say('Playing.');
    }
  }

  function advance() {
    if (screen === S.title) {
      // The title floats over a living city: traffic and pedestrians move.
      stepWorld(world, STEP, input, null);
      return;
    }
    if (screen !== S.play) return;
    const events = stepWorld(world, STEP, input, null);
    if (world.lastImpact > 8) audio.crash();
    if (events & EVENT_OBJECTIVE) audio.mission();
    if (events & EVENT_STEAL) {
      world.save.stats.carsStolen += 1;
      audio.crime();
    }
    if (events & EVENT_COMPLETE) {
      writeSave(world.save);
      screen = S.complete;
      hud.setComplete(world.saveMissionResult);
      hud.show('complete-screen');
      audio.mission();
      say(`Job done. Grade ${world.saveMissionResult.grade}.`);
    } else if (events & EVENT_BUSTED) {
      endRun('busted');
    } else if (events & EVENT_WASTED) {
      // Dante wakes at the Loft, health restored, heat gone.
      world.player.health = 100;
      endRun('wasted');
    }
    // The engine and siren mix follow the car and the closest cruiser.
    const kmh = world.player.inCar ? Math.abs(world.player.inCar.speed) * 3.6 : 0;
    let closestCop = Infinity;
    for (const cruiser of world.police.cars) {
      closestCop = Math.min(
        closestCop,
        Math.hypot(cruiser.x - world.player.x, cruiser.z - world.player.z),
      );
    }
    audio.update(kmh, closestCop);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - lastTime) / 1000, MAX_DT);
    lastTime = now;
    frameCount += 1;
    fpsClock += dt;
    if (fpsClock >= 1) {
      world.fpsSample = Math.round(frameCount / fpsClock);
      frameCount = 0;
      fpsClock = 0;
    }
    leftover += dt;
    handleActions();
    if (screen === S.title || screen === S.play) {
      let ran = 0;
      while (
        leftover >= STEP
        && (screen === S.title || screen === S.play)
        && ran < MAX_STEPS_PER_FRAME
      ) {
        advance();
        leftover -= STEP;
        ran += 1;
      }
      if (ran >= MAX_STEPS_PER_FRAME) leftover = 0;
    } else {
      leftover = 0;
    }
    hud.update(world, dt);
    render.updateCamera(world, dt);
    render.updateEffects(world, dt);
    render.render();
  }

  // Buttons on the menu screens.
  document.getElementById('btn-play').addEventListener('click', () => { audio.unlock(); beginJob(); });
  document.getElementById('btn-continue').addEventListener('click', () => { audio.unlock(); beginJob(); });
  document.getElementById('btn-resume').addEventListener('click', () => { screen = S.play; hud.show(null); });
  document.getElementById('btn-restart-mission').addEventListener('click', () => beginJob());
  document.getElementById('btn-save-quit').addEventListener('click', () => { writeSave(world.save); backToTitle(); });
  document.getElementById('btn-replay').addEventListener('click', () => beginJob());
  document.getElementById('btn-continue-2').addEventListener('click', () => {
    screen = S.play;
    hud.show(null);
    world.missions.active = false;
    world.missions.objective = 'Free roam — press Enter to run the next job.';
  });
  document.getElementById('btn-retry').addEventListener('click', () => beginJob());
  document.getElementById('btn-retry-2').addEventListener('click', () => beginJob());
  document.getElementById('btn-to-title').addEventListener('click', () => backToTitle());
  document.getElementById('btn-to-title-2').addEventListener('click', () => backToTitle());
  for (const button of document.querySelectorAll('.diff-btn')) {
    button.addEventListener('click', () => {
      world.save.difficulty = button.dataset.diff;
      world.difficultyName = button.dataset.diff;
      writeSave(world.save);
      for (const other of document.querySelectorAll('.diff-btn')) {
        other.classList.toggle('active', other === button);
      }
    });
    button.classList.toggle('active', button.dataset.diff === world.save.difficulty);
  }

  // Leaving the tab pauses a running game rather than letting the heat build unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === S.play) {
      screen = S.paused;
      hud.show('pause-screen');
      say('Paused.');
    }
  });

  hud.setTitle(world.save);
  hud.show('title-screen');
  say('Solmar Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shotName) runShot(shotName);
else runGame();
