// A small seeded random number generator (mulberry32): the same seed gives the
// same city, the same traffic and the same screenshot scenes, which is what
// makes the staged shots repeatable.

export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one entry of `list` with the seeded random. */
export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** A number in [min, max) from the seeded random. */
export function range(random, min, max) {
  return min + random() * (max - min);
}
