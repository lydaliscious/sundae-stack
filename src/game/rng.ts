/** A small seedable PRNG (mulberry32). The whole simulation draws from one of these. */
export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean;
  readonly seed: number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed,
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
  };
}
