/**
 * Seeded PRNG (mulberry32). The seed lives in GameState.rng so every random
 * outcome (dice, shuffles, steals) is reproducible from a persisted state and
 * fully controlled by the server. The seed is never sent to clients.
 */
export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0;
  const nextSeed = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, nextSeed];
}

/** Mutable helper used inside a single action application. */
export class Rng {
  constructor(public seed: number) {}

  next(): number {
    const [value, seed] = nextRandom(this.seed);
    this.seed = seed;
    return value;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  shuffle<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
