// Seeded randomness for Solmar Bay. One seed, one city: the same seed must
// rebuild the same blocks, the same traffic and the same staged shots, so the
// generator below is a small deterministic PRNG (mulberry32) rather than
// Math.random.

export function createRandom(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draw one element out of a list using the seeded stream.
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

// A float in [min, max) drawn from the seeded stream.
export function range(random, min, max) {
  return min + random() * (max - min);
}
