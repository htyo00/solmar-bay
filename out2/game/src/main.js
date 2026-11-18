// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, mission-complete, busted and wasted.
//
// ?seed=N fixes the city and the traffic. ?shot=chase|title|mission|complete
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createWorld, resetWorld, stepWorld, startMission, EVENT_COMPLETE, EVENT_BUSTED, EVENT_WASTED, EVENT_OBJECTIVE, EVENT_STEAL } from './world.js';
import { createRender } from './render.js';
import { createHud } from './hud.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, ACTION_RESTART, ACTION_MAP } from './input.js';
import { createAudio } from './audio.js';
import { writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const render = createRender(canvas);
const world = createWorld(seed, render.scene);
const hud = createHud();
const input = createInput();
const audio = createAudio();
window.__solmar = { world, render };

const SCREEN_TITLE = 'title';
const SCREEN_PLAY = 'play';
const SCREEN_PAUSED = 'paused';
const SCREEN_MAP = 'map';
const SCREEN_COMPLETE = 'complete';
const SCREEN_BUSTED = 'busted';
const SCREEN_WASTED = 'wasted';

function cashLost() {
  const lost = Math.round(world.save.cash * 0.1);
  world.save.cash = Math.max(0, world.save.cash - lost);
  return lost;
}

function runShot(name) {
  const screen = stageShot(name, world);
  hud.show(screen === 'title' ? 'title-screen' : screen === 'complete' ? 'complete-screen' : null);
  if (screen === 'title') hud.setTitle(world.save);
  if (screen === 'complete' && world.saveMissionResult) hud.setComplete(world.saveMissionResult);
  // Sync the HUD DOM once (a staged shot never runs the live loop that does it).
  hud.update(world, 1 / 60);
  let painted = 0;
  function paint() {
    // Snap the camera: the chase lerp would need many frames to settle.
    render.updateCamera(world, 1);
    render.updateEffects(world, 1 / 60);
    render.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let frames = 0;
  let fpsTimer = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    resetWorld(world);
    startMission(world);
    screen = SCREEN_PLAY;
    hud.show(null);
    announce('First job. Steal the Comet GT outside the Loft.');
  }

  function toTitle() {
    resetWorld(world);
    world.cameraMode = 'title';
    screen = SCREEN_TITLE;
    hud.setTitle(world.save);
    hud.show('title-screen');
    announce('Solmar Bay. Press Enter to start.');
  }

  function endMission(kind) {
    if (kind === 'busted') {
      world.save.stats.busted += 1;
      const lost = cashLost();
      writeSave(world.save);
      screen = SCREEN_BUSTED;
      hud.setEnd('busted', lost);
      hud.show('busted-screen');
      announce('Busted. The SBPD took you in.');
    } else {
      world.save.stats.wasted += 1;
      const lost = cashLost();
      writeSave(world.save);
      screen = SCREEN_WASTED;
      hud.setEnd('wasted', lost);
      hud.show('wasted-screen');
      announce('Wasted. You woke up at St. Marina Hospital.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      world.feed(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_COMPLETE || screen === SCREEN_BUSTED || screen === SCREEN_WASTED)) {
      startGame();
      return;
    }
    if (actions & ACTION_MAP && screen === SCREEN_PLAY) {
      screen = SCREEN_MAP;
      hud.showMap(world);
      hud.show('map-screen');
      announce('City map. Tab to close.');
      return;
    }
    if (actions & (ACTION_MAP | ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_MAP) {
      screen = SCREEN_PLAY;
      hud.show(null);
      announce('Playing.');
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      hud.show('pause-screen');
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      hud.show(null);
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Ambient city behind the title: traffic and pedestrians keep moving.
      stepWorld(world, STEP, input, null);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = stepWorld(world, STEP, input, null);
    if (world.lastImpact > 8) audio.crash();
    if (events & EVENT_OBJECTIVE) audio.mission();
    if (events & EVENT_STEAL) {
      world.save.stats.carsStolen += 1;
      audio.crime();
    }
    if (events & EVENT_COMPLETE) {
      writeSave(world.save);
      screen = SCREEN_COMPLETE;
      hud.setComplete(world.saveMissionResult);
      hud.show('complete-screen');
      audio.mission();
      announce(`Job done. Grade ${world.saveMissionResult.grade}.`);
    } else if (events & EVENT_BUSTED) {
      endMission('busted');
    } else if (events & EVENT_WASTED) {
      // Dante wakes at the Loft, health restored, heat gone.
      world.player.health = 100;
      endMission('wasted');
    }
    // Audio follows the car and the nearest cruiser.
    const speed = world.player.inCar ? Math.abs(world.player.inCar.speed) * 3.6 : 0;
    let nearestCop = Infinity;
    for (const car of world.police.cars) {
      nearestCop = Math.min(nearestCop, Math.hypot(car.x - world.player.x, car.z - world.player.z));
    }
    audio.update(speed, nearestCop);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    frames += 1;
    fpsTimer += dt;
    if (fpsTimer >= 1) {
      world.fpsSample = Math.round(frames / fpsTimer);
      frames = 0;
      fpsTimer = 0;
    }
    accumulator += dt;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let guard = 0;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY) && guard < 8) {
        step();
        accumulator -= STEP;
        guard += 1;
      }
      if (guard >= 8) accumulator = 0;
    } else {
      accumulator = 0;
    }
    hud.update(world, dt);
    render.updateCamera(world, dt);
    render.updateEffects(world, dt);
    render.render();
  }

  // Buttons on the menu screens.
  document.getElementById('btn-play').addEventListener('click', () => { audio.unlock(); startGame(); });
  document.getElementById('btn-continue').addEventListener('click', () => { audio.unlock(); startGame(); });
  document.getElementById('btn-resume').addEventListener('click', () => { screen = SCREEN_PLAY; hud.show(null); });
  document.getElementById('btn-restart-mission').addEventListener('click', () => startGame());
  document.getElementById('btn-save-quit').addEventListener('click', () => { writeSave(world.save); toTitle(); });
  document.getElementById('btn-replay').addEventListener('click', () => startGame());
  document.getElementById('btn-continue-2').addEventListener('click', () => {
    screen = SCREEN_PLAY;
    hud.show(null);
    world.missions.active = false;
    world.missions.objective = 'Free roam — press Enter to run the next job.';
  });
  document.getElementById('btn-retry').addEventListener('click', () => startGame());
  document.getElementById('btn-retry-2').addEventListener('click', () => startGame());
  document.getElementById('btn-to-title').addEventListener('click', () => toTitle());
  document.getElementById('btn-to-title-2').addEventListener('click', () => toTitle());
  for (const button of document.querySelectorAll('.diff-btn')) {
    button.addEventListener('click', () => {
      world.save.difficulty = button.dataset.diff;
      world.difficultyName = button.dataset.diff;
      writeSave(world.save);
      for (const other of document.querySelectorAll('.diff-btn')) other.classList.toggle('active', other === button);
    });
  }
  for (const button of document.querySelectorAll('.diff-btn')) {
    button.classList.toggle('active', button.dataset.diff === world.save.difficulty);
  }

  // Leaving the tab pauses a running game rather than letting the heat build unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      hud.show('pause-screen');
      announce('Paused.');
    }
  });

  hud.setTitle(world.save);
  hud.show('title-screen');
  announce('Solmar Bay. Press Enter to start.');
  window.__solmar = { world, render };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
