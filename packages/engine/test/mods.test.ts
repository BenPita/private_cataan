import { describe, expect, it } from 'vitest';
import { BASE_MOD, createGame, COSTS, DEV_DECK, MODS, PIECE_LIMITS, PLAYER_COLORS, isModId, modFor } from '../src';

describe('mods registry', () => {
  it('has the base game', () => {
    expect(MODS.base).toBe(BASE_MOD);
    expect(BASE_MOD).toMatchObject({ id: 'base', version: 1, minPlayers: 2, maxPlayers: 4, layout: 'classic', bankPerResource: 19 });
    expect(BASE_MOD.costs).toBe(COSTS);
    expect(BASE_MOD.devDeck).toBe(DEV_DECK);
    expect(BASE_MOD.pieceLimits).toBe(PIECE_LIMITS);
    expect(BASE_MOD.colors).toBe(PLAYER_COLORS);
  });
  it('recognises mod ids', () => {
    expect(isModId('base')).toBe(true);
    expect(isModId('seafarers')).toBe(true);
    expect(isModId('citiesAndKnights')).toBe(false);
    expect(isModId(42)).toBe(false);
  });
  it('a game without a mod (old save) is the base game', () => {
    expect(modFor({ config: {}, players: [] })).toBe(BASE_MOD);
    expect(modFor({ config: { mod: 'base' }, players: [] })).toBe(BASE_MOD);
  });
});

describe('games record their mod', () => {
  const two = [{ name: 'A', kind: 'human' as const }, { name: 'B', kind: 'human' as const }];
  it('a new game is base, version 1', () => {
    const s = createGame(two, 1);
    expect(s.config.mod).toBe('base');
    expect(s.config.modVersion).toBe(1);
    expect(s.board.layout).toBe('classic');
  });
  it('player range comes from the mod', () => {
    expect(() => createGame([two[0]], 1)).toThrow(/2-6/);
    expect(() => createGame(Array(7).fill(two[0]), 1)).toThrow(/2-6/);
  });
});

describe('mod safety', () => {
  it('every mod has a colour per seat', () => {
    for (const base of Object.values(MODS)) {
      for (const mod of [base, base.large ?? base]) expect(mod.colors.length).toBeGreaterThanOrEqual(mod.maxPlayers);
    }
  });
  it('an unknown mod is a clear error, not a crash', () => {
    const two = [{ name: 'A', kind: 'human' as const }, { name: 'B', kind: 'human' as const }];
    expect(() => createGame(two, 1, { mod: 'toString' as never })).toThrow('Unknown mod');
    expect(() => modFor({ config: { mod: 'nope' as never }, players: [] })).toThrow(/Unknown mod/);
  });
});
