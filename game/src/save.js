// Persistence through localStorage: pocket cash, how far along the mission
// chain Dante is, cars in the garage, best run and difficulty. Every access
// is wrapped, because a private window or a mangled save must never crash
// the game — worst case, Dante just starts fresh.

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
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const stored = JSON.parse(raw);
    const blank = defaultSave();
    return {
      ...blank,
      ...stored,
      stats: { ...blank.stats, ...(stored.stats || {}) },
      carsOwned: Array.isArray(stored.carsOwned) ? stored.carsOwned : [],
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage may be unavailable (private browsing): the run then only
    // survives until the tab closes, and the game carries on regardless.
  }
}
