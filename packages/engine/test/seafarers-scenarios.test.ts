import { describe, expect, it } from 'vitest';
import { RESOURCES, boardGraph, createGame, legalSetupSettlements, scenarioFor, victoryPoints, type GameState } from '../src';
import { completeOrderRoll, expectFail, playBotGame } from './helpers';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const }));

/** A Seafarers game of `scenario` with the opening roll done. */
function game(scenario: string, n = 3): GameState {
  return completeOrderRoll(createGame(players(n), 7, { mod: 'seafarers', scenario }));
}

/** Regions of the land hexes around a vertex. */
const regionsAt = (s: GameState, v: string) =>
  boardGraph(s.board).vertices[v].hexes.map((h) => s.board.hexes[h].region).filter(Boolean);

describe('The Four Islands', () => {
  it('wins at 13 and allows starting settlements on any island', () => {
    const s = game('fourIslands');
    expect(scenarioFor(s)!.victoryTarget).toBe(13);
    const regions = new Set(s.board.hexes.filter((h) => h.region).map((h) => h.region));
    expect(regions).toEqual(new Set(['isle1', 'isle2', 'isle3', 'isle4']));
    expect(legalSetupSettlements(s).length).toBeGreaterThan(20);
  });

  it('home islands come from the starting settlements; other islands give +2 once', () => {
    for (const seed of [3, 4]) {
      const r = playBotGame(['hard', 'hard', 'medium'], seed, 12000, { mod: 'seafarers', scenario: 'fourIslands' });
      expect(r.state.phase).toBe('GAME_OVER');
      expect(victoryPoints(r.state, r.state.winner!)).toBeGreaterThanOrEqual(13);
      for (const p of r.state.players) {
        expect(p.homeRegions?.length ?? 0).toBeGreaterThanOrEqual(1);
        expect(p.homeRegions!.length).toBeLessThanOrEqual(2);
        // No bonus for a home island, and at most one bonus per island.
        for (const reg of p.bonusRegions ?? []) expect(p.homeRegions).not.toContain(reg);
        expect(new Set(p.bonusRegions ?? []).size).toBe((p.bonusRegions ?? []).length);
        expect(p.vpTokens ?? 0).toBe(2 * (p.bonusRegions ?? []).length);
      }
    }
  }, 120_000);
});

describe('Through the Desert', () => {
  it('starts on the main island only and wins at 14', () => {
    const s = game('throughDesert', 4);
    expect(scenarioFor(s)!.victoryTarget).toBe(14);
    const legal = legalSetupSettlements(s);
    expect(legal.length).toBeGreaterThan(0);
    for (const v of legal) expect(regionsAt(s, v)).toContain('main');
    // A spot touching only the strip beyond the desert is refused.
    const G = boardGraph(s.board);
    const stripOnly = Object.keys(G.vertices).find((v) => {
      const regs = regionsAt(s, v);
      return regs.length > 0 && regs.every((r) => r === 'strip');
    })!;
    expect(stripOnly).toBeDefined();
    expect(expectFail(s, s.currentPlayer, { type: 'placeSetupSettlement', vertex: stripOnly })).toMatch(/main island/);
  });

  it('bots finish games; the strip and islands give the bonus, main never does', () => {
    for (const n of [3, 4]) {
      const r = playBotGame(Array(n).fill('hard'), 50 + n, 12000, { mod: 'seafarers', scenario: 'throughDesert' });
      expect(r.state.phase).toBe('GAME_OVER');
      for (const p of r.state.players) {
        expect(p.bonusRegions ?? []).not.toContain('main');
        expect(p.vpTokens ?? 0).toBe(2 * (p.bonusRegions ?? []).length);
      }
      for (const res of RESOURCES) expect(r.state.bank[res] + r.state.players.reduce((t, p) => t + p.resources[res], 0)).toBe(19);
    }
  }, 120_000);
});
