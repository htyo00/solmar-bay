// Deterministic dice for Solmar Bay. The whole city — blocks, traffic,
// staged camera shots — is rebuilt from a single seed, so every random
// draw here has to come from one repeatable stream instead of Math.random.
// The stream below is mulberry32: tiny, fast, and identical for a given
// seed on every machine.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function draw() {
    state = (state + 0x6d2b79f5) | 0;
    let mix = Math.imul(state ^ (state >>> 15), 1 | state);
    mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}

// Pull a single item from a list, spending one draw from the stream.
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

// A float in [min, max), spending one draw from the stream.
export function range(random, min, max) {
  return min + random() * (max - min);
}
