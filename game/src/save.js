// Save persistence: cash, jobs done, best grade, coins, rep. localStorage.
const KEY = 'solmar-bay-save-v1';

export function defaultSave() {
  return { cash: 250, jobs: 0, bestGrade: '-', coins: 0, rep: 0, busted: 0, wasted: 0 };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const s = JSON.parse(raw);
    return { ...defaultSave(), ...s };
  } catch (e) {
    return defaultSave();
  }
}

export function storeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (e) { /* storage unavailable: session-only progress */ }
}
