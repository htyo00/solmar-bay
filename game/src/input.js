// Keyboard and mouse input for Solmar Bay.
//
// Two kinds of input live here. Held keys (drive, walk, run, handbrake,
// steal) report a live steering state every frame. One-shot presses
// (confirm, pause, mute, restart, map) are queued as bit flags and taken
// exactly once by the loop, so a press that lands between two frames is
// neither lost nor counted twice. Steal (E) is a held key, not a one-shot.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_STEAL = 4; // E held (read as a held key, not a one-shot)
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;
export const ACTION_MAP = 32;

// Keys that steer, drive, run, brake, or steal. Tab is not in this table:
// it opens the map, but its default action still has to be suppressed.
const HELD = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  handbrake: ['Space'],
  steal: ['KeyE'],
};

// One-shot presses, by code. M stays mute, so the map lives on Tab.
const PRESS_ONCE = new Map([
  ['Enter', ACTION_CONFIRM],
  ['KeyP', ACTION_PAUSE],
  ['Escape', ACTION_PAUSE],
  ['KeyM', ACTION_MUTE],
  ['KeyR', ACTION_RESTART],
  ['Tab', ACTION_MAP],
]);

export function createInput() {
  const down = new Set();
  let pending = 0;
  let dragSinceRead = 0; // mouse-drag yaw in pixels, since the last read
  let dragging = false;

  const heldGroups = Object.values(HELD).map((codes) => new Set(codes));
  const isDriveKey = (code) => heldGroups.some((group) => group.has(code));

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    down.add(event.code);
    const flag = PRESS_ONCE.get(event.code);
    if (flag !== undefined) pending |= flag;
    // Arrows, Tab, Space, and the driving keys would otherwise scroll the
    // page or pull focus away from the canvas.
    if (isDriveKey(event.code) || event.code === 'Tab') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => down.delete(event.code));
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => down.clear());
  window.addEventListener('mousedown', () => { dragging = true; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (event) => {
    if (dragging) dragSinceRead += event.movementX || 0;
  });

  const held = (codes) => codes.some((code) => down.has(code));

  return {
    forward: () => held(HELD.forward),
    back: () => held(HELD.back),
    left: () => held(HELD.left),
    right: () => held(HELD.right),
    run: () => held(HELD.run),
    handbrake: () => held(HELD.handbrake),
    steal: () => held(HELD.steal),
    /** Mouse-drag yaw since the last call, in pixels; resets to 0. */
    takeDrag() {
      const taken = dragSinceRead;
      dragSinceRead = 0;
      return taken;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = pending;
      pending = 0;
      return taken;
    },
  };
}
