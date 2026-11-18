// Keyboard and mouse input.
//
// Held keys produce a steering/throttle state; one-shot presses (confirm,
// pause, mute, restart, map) are queued as bit flags and taken exactly once
// by the loop, so a press that lands between two frames is neither lost nor
// counted twice. Steal (E) is read as a held key, not a one-shot.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_STEAL = 4; // E held (read as a held key, not a one-shot)
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;
export const ACTION_MAP = 32;

// Keys that steer, drive, run, brake or steal. Tab stays out of this table:
// it opens the map, but it still needs its default action suppressed.
const HELD_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  handbrake: ['Space'],
  steal: ['KeyE'],
};

// One-shot presses, by code. M stays mute, so the map lives on Tab.
const ONE_SHOT = new Map([
  ['Enter', ACTION_CONFIRM],
  ['KeyP', ACTION_PAUSE],
  ['Escape', ACTION_PAUSE],
  ['KeyM', ACTION_MUTE],
  ['KeyR', ACTION_RESTART],
  ['Tab', ACTION_MAP],
]);

export function createInput() {
  const down = new Set();
  let queued = 0;
  let dragTotal = 0; // mouse-drag yaw accumulated since the last read
  let mouseDown = false;

  const heldSets = Object.values(HELD_KEYS).map((codes) => new Set(codes));
  const isHeldKey = (code) => heldSets.some((set) => set.has(code));

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    down.add(event.code);
    const flag = ONE_SHOT.get(event.code);
    if (flag !== undefined) queued |= flag;
    // Arrows, Tab, Space and the driving keys would otherwise scroll the
    // page or move focus away from the canvas.
    if (isHeldKey(event.code) || event.code === 'Tab') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => down.delete(event.code));
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => down.clear());
  window.addEventListener('mousedown', () => { mouseDown = true; });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  window.addEventListener('mousemove', (event) => {
    if (mouseDown) dragTotal += event.movementX || 0;
  });

  const pressed = (codes) => codes.some((code) => down.has(code));

  return {
    forward: () => pressed(HELD_KEYS.forward),
    back: () => pressed(HELD_KEYS.back),
    left: () => pressed(HELD_KEYS.left),
    right: () => pressed(HELD_KEYS.right),
    run: () => pressed(HELD_KEYS.run),
    handbrake: () => pressed(HELD_KEYS.handbrake),
    steal: () => pressed(HELD_KEYS.steal),
    /** Mouse-drag yaw since the last call, in pixels; resets to 0. */
    takeDrag() {
      const taken = dragTotal;
      dragTotal = 0;
      return taken;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}
