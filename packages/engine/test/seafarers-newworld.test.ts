import { describe, expect, it } from 'vitest';
import { SEAFARERS_MOD, boardGraph, createGame, legalSetupSettlements, type Board, type GameState } from '../src';
import { act, completeOrderRoll, give, playBotGame } from './helpers';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const }));
const isLand = (t: string) => t !== 'sea' && t !== 'fog';
const isRed = (n: number | null) => n === 6 || n === 8;

function game(scenario: string, n = 4, seed = 7, variableSetup = false): GameState {
  return completeOrderRoll(createGame(players(n), seed, { mod: 'seafarers', scenario, variableSetup }));
}

const count = <T,>(xs: T[]) => xs.reduce<Record<string, number>>((m, x) => ({ ...m, [String(x)]: (m[String(x)] ?? 0) + 1 }), {});

describe('New World: the dealt board', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    it(`seed ${seed}: hexes, discs and ports match the component table`, () => {
      const { board } = game('newWorld', seed % 2 ? 3 : 4, seed);
      const G = boardGraph(board);
      expect(board.hexes).toHaveLength(42);
      expect(count(board.hexes.map((h) => h.terrain))).toEqual({ sea: 19, hills: 4, forest: 5, pasture: 5, fields: 5, mountains: 4 });
      const discs = board.hexes.filter((h) => h.number !== null);
      expect(discs.every((h) => isLand(h.terrain))).toBe(true);
      expect(count(discs.map((h) => h.number))).toEqual({ 2: 1, 3: 3, 4: 3, 5: 3, 6: 2, 8: 2, 9: 3, 10: 3, 11: 2, 12: 1 });
      // no two red discs side by side
      for (const h of board.hexes) if (isRed(h.number)) expect(G.hexes[h.id].neighbors.some((n) => isRed(board.hexes[n].number))).toBe(false);
      // 10 ports (5 x 2:1, 5 x 3:1) on coastal edges, never sharing a corner
      expect(count(board.harbors.map((p) => p.type))).toEqual({ lumber: 1, brick: 1, wool: 1, grain: 1, ore: 1, generic: 5 });
      const corners = board.harbors.flatMap((p) => G.edges[p.edge].vertices);
      expect(new Set(corners).size).toBe(corners.length);
      for (const p of board.harbors) {
        const hs = G.edges[p.edge].hexes;
        expect(hs.filter((h) => isLand(board.hexes[h].terrain))).toHaveLength(1);
      }
      // robber and pirate start on the frame
      expect(board.robberHex).toBe(-1);
      expect(board.pirateHex).toBe(-1);
      // islands: every land hex has one; neighbouring land shares it; sea has none
      for (const h of board.hexes) {
        if (!isLand(h.terrain)) expect(h.region).toBeUndefined();
        else for (const n of G.hexes[h.id].neighbors) if (isLand(board.hexes[n].terrain)) expect(board.hexes[n].region).toBe(h.region);
      }
    });
  }

  it('different games get different boards', () => {
    const a = game('newWorld', 4, 1).board.hexes.map((h) => h.terrain).join();
    const b = game('newWorld', 4, 2).board.hexes.map((h) => h.terrain).join();
    expect(a).not.toBe(b);
  });

  it('robber and pirate leave the frame on the first 7; starting islands are home, others +1 VP', () => {
    const s = game('newWorld', 3, 5);
    expect(s.config.victoryTarget).toBe(12);
    expect(legalSetupSettlements(s).length).toBeGreaterThan(20);
    s.phase = 'ROBBER_MOVE';
    s.setup = null;
    const land = s.board.hexes.find((h) => isLand(h.terrain))!;
    const moved = act(s, s.currentPlayer, { type: 'moveRobber', hex: land.id });
    expect(moved.board.robberHex).toBe(land.id);
    const sea = s.board.hexes.find((h) => h.terrain === 'sea')!;
    const sailed = act(s, s.currentPlayer, { type: 'movePirate', hex: sea.id });
    expect(sailed.board.pirateHex).toBe(sea.id);
    // a first settlement on a non-home island earns 1 VP
    const t = game('newWorld', 3, 5);
    t.phase = 'MAIN_ACTIONS';
    t.setup = null;
    t.turn = 3;
    t.hasRolled = true;
    t.players[t.currentPlayer].homeRegions = ['isle-none'];
    const G = boardGraph(t.board);
    const v = legalSetupSettlements(t)[0];
    t.roads[G.vertices[v].edges.find((e) => G.edges[e].hexes.some((h) => isLand(t.board.hexes[h].terrain)))!] = t.currentPlayer;
    give(t, t.currentPlayer, { lumber: 1, brick: 1, wool: 1, grain: 1 });
    const after = act(t, t.currentPlayer, { type: 'buildSettlement', vertex: v });
    expect(after.players[after.currentPlayer].vpTokens).toBe(1);
  });
});

describe('Variable setup (scenarios 1-4 and 8)', () => {
  const scenarios = ['newShores', 'fourIslands', 'fogIslands', 'throughDesert', 'wondersOfCatan'];
  const regionKey = (b: Board) => b.hexes.map((h) => (isLand(h.terrain) ? h.region : h.terrain)).join();

  for (const id of scenarios) {
    for (const n of [3, 4]) {
      it(`${id}, ${n} players: same sea and regions, the same hexes/discs/ports re-dealt under the scenario's rules`, () => {
        const printed = game(id, n, 3).board;
        const def = SEAFARERS_MOD.scenarios![id];
        const v = def.variable!;
        let changed = false;
        for (const seed of [1, 2, 3, 4, 5]) {
          const b = game(id, n, seed, true).board;
          const G = boardGraph(b);
          expect(regionKey(b)).toBe(regionKey(printed));
          expect(count(b.hexes.map((h) => h.terrain))).toEqual(count(printed.hexes.map((h) => h.terrain)));
          expect(count(b.hexes.map((h) => h.number))).toEqual(count(printed.hexes.map((h) => h.number)));
          expect(count(b.harbors.map((p) => p.type))).toEqual(count(printed.harbors.map((p) => p.type)));
          expect(b.harbors.map((p) => p.edge)).toEqual(printed.harbors.map((p) => p.edge));
          for (const h of b.hexes) {
            if ((v.fixed ?? []).includes(printed.hexes[h.id].terrain)) expect(h).toEqual(printed.hexes[h.id]);
            if (h.terrain === 'desert') expect(h.number).toBeNull();
            if (isRed(h.number)) {
              if (v.noRedOnGold) expect(h.terrain).not.toBe('gold');
              for (const nb of G.hexes[h.id].neighbors) {
                if (v.noAdjacentRed) expect(isRed(b.hexes[nb].number)).toBe(false);
                if (v.noRedNextTo) expect(b.hexes[nb].terrain).not.toBe(v.noRedNextTo);
              }
            }
            if ((v.lowNotOn ?? []).includes(h.terrain)) expect([2, 3, 11, 12]).not.toContain(h.number);
          }
          const robber = typeof v.robber === 'object' ? v.robber[n as 3 | 4] : v.robber;
          if (robber === 'twelve') expect(b.hexes[b.robberHex].number).toBe(12);
          if (robber === 'desert') expect(b.hexes[b.robberHex].terrain).toBe('desert');
          if (robber === 'keep') expect(b.robberHex).toBe(printed.robberHex);
          if (b.hexes.some((h, i) => h.terrain !== printed.hexes[i].terrain || h.number !== printed.hexes[i].number)) changed = true;
        }
        expect(changed).toBe(true);
      });
    }
  }

  it('Pirate Islands, Forgotten Tribe and Cloth for Catan ignore the option (no variable setup)', () => {
    for (const id of ['pirateIslands', 'forgottenTribe', 'clothForCatan']) {
      expect(game(id, 4, 3, true).board.hexes).toEqual(game(id, 4, 3).board.hexes);
    }
  });
});

describe('New World and variable setup: bot games finish', () => {
  for (const [scenario, variableSetup] of [['newWorld', false], ['newShores', true], ['wondersOfCatan', true]] as const) {
    for (const n of [3, 4]) {
      it(`${scenario}${variableSetup ? ' (variable)' : ''}, ${n} bots`, () => {
        const levels = (['easy', 'medium', 'hard', 'medium'] as const).slice(0, n);
        const { state } = playBotGame([...levels], 21 + n, 30000, { mod: 'seafarers', scenario, variableSetup });
        expect(state.phase).toBe('GAME_OVER');
      }, 120_000);
    }
  }
});
