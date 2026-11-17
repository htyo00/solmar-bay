// Keyboard and mouse input. Held keys give a steering/throttle state; one-shot
// presses (steal, pause, confirm, mute) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_STEAL = 4; // E held (read as a held key, not a one-shot)
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const HANDBRAKE = new Set(['Space']);
const STEAL = new Set(['KeyE']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

export function createInput() {
  const held = new Set();
  let actions = 0;
  let dragX = 0; // accumulated mouse-drag yaw since the last read
  let dragging = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else if (RESTART.has(event.code)) actions |= ACTION_RESTART;
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || STEAL.has(event.code) || HANDBRAKE.has(event.code) || RUN.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => held.clear());
  window.addEventListener('mousedown', () => { dragging = true; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (event) => {
    if (dragging) dragX += event.movementX || 0;
  });

  function any(keys) {
    for (const key of keys) if (held.has(key)) return true;
    return false;
  }

  return {
    forward: () => any(FORWARD),
    back: () => any(BACK),
    left: () => any(LEFT),
    right: () => any(RIGHT),
    run: () => any(RUN),
    handbrake: () => any(HANDBRAKE),
    steal: () => any(STEAL),
    /** Mouse-drag yaw since the last call, in pixels; resets to 0. */
    takeDrag() {
      const taken = dragX;
      dragX = 0;
      return taken;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
