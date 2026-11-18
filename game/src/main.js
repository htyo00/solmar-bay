// Solmar Bay — startup and the single game loop.
//
// This file boots the game and owns the clock. Each animation frame it
// samples the keyboard once, pushes the world forward in 1/60 s slices, and
// hands the result to the renderer. Seven screens live here — title, play,
// paused, map, complete, busted, wasted — and so do the staged screenshot
// scenes: ?shot=chase|title|mission|complete (with &seed=N) builds a scene,
// paints it twice, and sets window.__shotReady.
//
// ?seed=N pins the city and its traffic to one layout; with no seed the
// layout is drawn at random.
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

// A frame longer than this is treated as half a second: on a slow machine
// one real frame can last ~0.5 s, and clamping it any lower would make
// game-time run at half the speed of wall-time. The simulation still
// advances in fixed 1/60 s slices, so a hitch never breaks the physics;
// on a 60 FPS machine this changes nothing.
const MAX_DT = 0.5;
// How many fixed slices one frame may spend before the leftover is
// thrown away. 30/60 = 0.5 s, the same as MAX_DT, so a frame that was
// clamped at the cap can be fully consumed instead of half-dropped.
const MAX_STEPS_PER_FRAME = 30;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedText = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedText)
  ? seedText
  : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const render = createRender(canvas);
const world = createWorld(seed, render.scene);
const hud = createHud();
const input = createInput();
const audio = createAudio();
window.__solmar = { world, render };

// Every screen the game can sit on.
const SCREEN = {
  title: 'title',
  play: 'play',
  paused: 'paused',
  map: 'map',
  complete: 'complete',
  busted: 'busted',
  wasted: 'wasted',
};

function showStatus(text) {
  statusLine.textContent = text;
}

// Getting caught or killed costs a tenth of the cash Dante carries.
function takeCashCut() {
  const cut = Math.round(world.save.cash * 0.1);
  world.save.cash = Math.max(0, world.save.cash - cut);
  return cut;
}

// ---- staged screenshots --------------------------------------------------

function playScreenshot(name) {
  const screen = stageShot(name, world);
  hud.show(
    screen === SCREEN.title
      ? 'title-screen'
      : screen === SCREEN.complete
        ? 'complete-screen'
        : null,
  );
  if (screen === SCREEN.title) hud.setTitle(world.save);
  if (screen === SCREEN.complete && world.saveMissionResult) {
    hud.setComplete(world.saveMissionResult);
  }
  // A staged scene never runs the live loop, so the HUD is synced by hand.
  hud.update(world, 1 / 60);
  let painted = 0;
  const paint = () => {
    // Point the camera straight at its target: the chase lerp would need
    // many frames to settle, and a screenshot only gets two.
    render.updateCamera(world, 1);
    render.updateEffects(world, 1 / 60);
    render.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
}

// ---- the live game -------------------------------------------------------

function playLive() {
  let screen = SCREEN.title;
  let leftover = 0;
  let lastTime = performance.now();
  let framesSeen = 0;
  let fpsWindow = 0;

  function startJob() {
    audio.unlock();
    resetWorld(world);
    startMission(world);
    screen = SCREEN.play;
    hud.show(null);
    showStatus('First job. Steal the Comet GT outside the Loft.');
  }

  function goTitle() {
    resetWorld(world);
    world.cameraMode = 'title';
    screen = SCREEN.title;
    hud.setTitle(world.save);
    hud.show('title-screen');
    showStatus('Solmar Bay. Press Enter to start.');
  }

  function finishRun(kind) {
    const busted = kind === 'busted';
    world.save.stats[busted ? 'busted' : 'wasted'] += 1;
    const cut = takeCashCut();
    writeSave(world.save);
    screen = busted ? SCREEN.busted : SCREEN.wasted;
    hud.setEnd(busted ? 'busted' : 'wasted', cut);
    hud.show(busted ? 'busted-screen' : 'wasted-screen');
    showStatus(
      busted
        ? 'Busted. The SBPD took you in.'
        : 'Wasted. You woke up at St. Marina Hospital.',
    );
  }

  function handlePresses() {
    const pressed = input.takeActions();
    if (pressed & ACTION_MUTE) {
      const muted = audio.toggleMute();
      world.feed(muted ? 'Sound off.' : 'Sound on.');
    }
    if (pressed & ACTION_RESTART && (screen === SCREEN.play || screen === SCREEN.paused)) {
      startJob();
      return;
    }
    if (pressed & ACTION_CONFIRM && screen === SCREEN.title) {
      startJob();
      return;
    }
    if (
      pressed & ACTION_CONFIRM
      && (screen === SCREEN.complete || screen === SCREEN.busted || screen === SCREEN.wasted)
    ) {
      startJob();
      return;
    }
    if (pressed & ACTION_MAP && screen === SCREEN.play) {
      screen = SCREEN.map;
      hud.showMap(world);
      hud.show('map-screen');
      showStatus('City map. Tab to close.');
      return;
    }
    if (pressed & (ACTION_MAP | ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN.map) {
      screen = SCREEN.play;
      hud.show(null);
      showStatus('Playing.');
      return;
    }
    if (pressed & ACTION_PAUSE && screen === SCREEN.play) {
      screen = SCREEN.paused;
      hud.show('pause-screen');
      showStatus('Paused.');
    } else if (pressed & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN.paused) {
      screen = SCREEN.play;
      hud.show(null);
      showStatus('Playing.');
    }
  }

  function advance() {
    if (screen === SCREEN.title) {
      // The title floats above a living city: traffic and pedestrians move.
      stepWorld(world, STEP, input, null);
      return;
    }
    if (screen !== SCREEN.play) return;
    const events = stepWorld(world, STEP, input, null);
    if (world.lastImpact > 8) audio.crash();
    if (events & EVENT_OBJECTIVE) audio.mission();
    if (events & EVENT_STEAL) {
      world.save.stats.carsStolen += 1;
      audio.crime();
    }
    if (events & EVENT_COMPLETE) {
      writeSave(world.save);
      screen = SCREEN.complete;
      hud.setComplete(world.saveMissionResult);
      hud.show('complete-screen');
      audio.mission();
      showStatus(`Job done. Grade ${world.saveMissionResult.grade}.`);
    } else if (events & EVENT_BUSTED) {
      finishRun('busted');
    } else if (events & EVENT_WASTED) {
      // Dante wakes at the Loft, health restored, heat gone.
      world.player.health = 100;
      finishRun('wasted');
    }
    // The engine and siren mix follow the car and the nearest cruiser.
    const kmh = world.player.inCar ? Math.abs(world.player.inCar.speed) * 3.6 : 0;
    let nearestCop = Infinity;
    for (const cruiser of world.police.cars) {
      nearestCop = Math.min(
        nearestCop,
        Math.hypot(cruiser.x - world.player.x, cruiser.z - world.player.z),
      );
    }
    audio.update(kmh, nearestCop);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - lastTime) / 1000, MAX_DT);
    lastTime = now;
    framesSeen += 1;
    fpsWindow += dt;
    if (fpsWindow >= 1) {
      world.fpsSample = Math.round(framesSeen / fpsWindow);
      framesSeen = 0;
      fpsWindow = 0;
    }
    leftover += dt;
    handlePresses();
    if (screen === SCREEN.title || screen === SCREEN.play) {
      let ran = 0;
      while (
        leftover >= STEP
        && (screen === SCREEN.title || screen === SCREEN.play)
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

  // The buttons on the menu screens.
  document.getElementById('btn-play').addEventListener('click', () => { audio.unlock(); startJob(); });
  document.getElementById('btn-continue').addEventListener('click', () => { audio.unlock(); startJob(); });
  document.getElementById('btn-resume').addEventListener('click', () => { screen = SCREEN.play; hud.show(null); });
  document.getElementById('btn-restart-mission').addEventListener('click', () => startJob());
  document.getElementById('btn-save-quit').addEventListener('click', () => { writeSave(world.save); goTitle(); });
  document.getElementById('btn-replay').addEventListener('click', () => startJob());
  document.getElementById('btn-continue-2').addEventListener('click', () => {
    screen = SCREEN.play;
    hud.show(null);
    world.missions.active = false;
    world.missions.objective = 'Free roam — press Enter to run the next job.';
  });
  document.getElementById('btn-retry').addEventListener('click', () => startJob());
  document.getElementById('btn-retry-2').addEventListener('click', () => startJob());
  document.getElementById('btn-to-title').addEventListener('click', () => goTitle());
  document.getElementById('btn-to-title-2').addEventListener('click', () => goTitle());
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

  // Leaving the tab pauses a running game instead of letting the heat
  // build up unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN.play) {
      screen = SCREEN.paused;
      hud.show('pause-screen');
      showStatus('Paused.');
    }
  });

  hud.setTitle(world.save);
  hud.show('title-screen');
  showStatus('Solmar Bay. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shotName) playScreenshot(shotName);
else playLive();
