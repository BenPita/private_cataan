import { describe, expect, it } from 'vitest';
import { Rng, createGame, generateBeginnerBoard, generateRandomBoard } from '../src';
import { fingerprint, playBotGame } from './helpers';

/**
 * Stage-0 safety net for the mods refactor: the base game must play exactly
 * as before. The snapshot was recorded before the refactor; never update it
 * to make a refactor pass.
 */
describe('base game regression', () => {
  it('random boards are unchanged', () => {
    const boards = [1, 2, 3, 99].map((seed) => {
      const b = generateRandomBoard(new Rng(seed));
      return { hexes: b.hexes, harbors: b.harbors, robberHex: b.robberHex };
    });
    expect(boards).toMatchSnapshot();
  });

  it('beginner board is unchanged', () => {
    const b = generateBeginnerBoard();
    expect({ hexes: b.hexes, harbors: b.harbors, robberHex: b.robberHex }).toMatchSnapshot();
  });

  it('a fresh game is unchanged', () => {
    const s = createGame([{ name: 'A', kind: 'human' }, { name: 'B', kind: 'human' }, { name: 'C', kind: 'human' }], 777);
    expect(fingerprint(s)).toMatchSnapshot();
  });

  for (const [levels, seed] of [
    [['easy', 'medium'], 11],
    [['medium', 'hard', 'easy'], 22],
    [['hard', 'hard', 'medium', 'easy'], 33],
  ] as const) {
    it(`bot game ${levels.join('/')} seed ${seed} plays out identically`, () => {
      const r = playBotGame([...levels], seed);
      expect({ steps: r.steps, rejected: r.rejected, game: fingerprint(r.state) }).toMatchSnapshot();
    });
  }
});
