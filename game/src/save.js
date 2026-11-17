// Save and load through localStorage: cash, mission progress, owned cars,
// best stats and the chosen difficulty. Everything is guarded — a private
// window or a corrupt save just means a fresh start.

import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    cash: 250,
    missionUnlocked: 1, // mission 1 is open; completing one unlocks the next
    carsOwned: [],
    bestGrade: null,
    bestTime: null,
    difficulty: 'Street',
    stats: { missionsDone: 0, carsStolen: 0, busted: 0, wasted: 0, topSpeed: 0 },
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const fresh = defaultSave();
    return {
      ...fresh,
      ...parsed,
      stats: { ...fresh.stats, ...(parsed.stats || {}) },
      carsOwned: Array.isArray(parsed.carsOwned) ? parsed.carsOwned : [],
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}
