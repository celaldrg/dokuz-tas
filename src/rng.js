/**
 * Small seeded random number helpers, so games and tests are reproducible.
 */

/**
 * Creates a deterministic pseudo-random generator (mulberry32).
 * @param {number} seed any number; the same seed always yields the same sequence
 * @returns {() => number} a function returning floats in [0, 1)
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Shuffles an array in place (Fisher-Yates) and returns it.
 * @template T
 * @param {T[]} items
 * @param {() => number} rng generator from createRng
 * @returns {T[]}
 */
export function shuffle(items, rng) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
