// Keyboard + mouse-drag orbit. Edge-triggered "justPressed" resets each frame.
export function createInput() {
  const keys = new Set();
  const justPressed = new Set();
  let orbitX = 0;
  let dragging = false;
  let lastX = 0;
  const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!e.repeat) justPressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  window.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    orbitX += (e.clientX - lastX) * 0.004;
    lastX = e.clientX;
  });

  return {
    keys, justPressed,
    down(code) { return keys.has(code); },
    pressed(code) { return justPressed.has(code); },
    // read-and-clear: menu handling eats the press so gameplay update
    // in the same frame does not fire it a second time
    consume(code) {
      if (!justPressed.has(code)) return false;
      justPressed.delete(code);
      return true;
    },
    axis() {
      // forward/back, left/right as -1..1 from WASD + arrows
      const f = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0) - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
      const s = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
      return { f, s };
    },
    orbit() { const o = orbitX; orbitX *= 0.9; return o; },
    endFrame() { justPressed.clear(); },
  };
}
