import { describe, expect, it } from 'vitest';
import { BASE_MOD, COSTS, DEV_DECK, MODS, PIECE_LIMITS, PLAYER_COLORS, isModId, modFor } from '../src';

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
    expect(isModId('seafarers')).toBe(false);
    expect(isModId(42)).toBe(false);
  });
  it('a game without a mod (old save) is the base game', () => {
    expect(modFor({ config: {} })).toBe(BASE_MOD);
    expect(modFor({ config: { mod: 'base' } })).toBe(BASE_MOD);
  });
});
