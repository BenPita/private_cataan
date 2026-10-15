import { describe, expect, it } from 'vitest';
import { faceValues, simulateFlat, topSlot } from '../src/game/dice3d';

describe('3D dice', () => {
  it('always shows the server result on top, with opposite faces adding to 7', () => {
    for (let n = 0; n < 200; n++) {
      const rec = simulateFlat(0.12);
      const last = rec.frames[rec.frames.length - 1];
      last.forEach((state, i) => {
        const want = ((n + i * 3) % 6) + 1;
        const top = topSlot(state.q);
        const values = faceValues(top, want);
        expect(values[top]).toBe(want);
        expect([...values].sort()).toEqual([1, 2, 3, 4, 5, 6]);
        for (const [a, b] of [[0, 1], [2, 3], [4, 5]]) expect(values[a] + values[b]).toBe(7);
      });
      // Dice settle on the board, not floating or flying off.
      for (const s of last) {
        expect(s.p.y).toBeLessThan(0.12 + 0.29 + 0.06);
        expect(Math.abs(s.p.x)).toBeLessThan(2.7);
      }
    }
  });
});
