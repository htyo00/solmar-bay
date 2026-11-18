// Save data lives in localStorage: pocket cash, the mission chain's
// progress, garage cars, best run and difficulty. A save file can be
// missing, half-written or hostile (private mode, corrupted JSON), so
// every read and write is guarded — the worst outcome is Dante starting
// over with a fresh wallet, never a crash.

import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    cash: 250,
    missionUnlocked: 1, // job one is open from the start; each finish opens the next
    carsOwned: [],
    bestGrade: null,
    bestTime: null,
    difficulty: 'Street',
    stats: { missionsDone: 0, carsStolen: 0, busted: 0, wasted: 0, topSpeed: 0, copsLost: 0, coins: 0 },
  };
}

export function loadSave() {
  const fresh = defaultSave();
  let text = null;
  try {
    text = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return fresh;
  }
  if (!text) return fresh;
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fresh;
  }
  if (!parsed || typeof parsed !== 'object') return fresh;
  const mergedStats = { ...fresh.stats, ...(parsed.stats || {}) };
  const garage = Array.isArray(parsed.carsOwned) ? parsed.carsOwned : [];
  return { ...fresh, ...parsed, stats: mergedStats, carsOwned: garage };
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage may be unavailable (private browsing): the run then only
    // survives until the tab closes, and the game carries on regardless.
  }
}
