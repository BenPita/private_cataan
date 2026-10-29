import { describe, expect, it } from 'vitest';
import {
  RESOURCES,
  boardGraph,
  createGame,
  getPlayerView,
  isLandHex,
  legalSetupSettlements,
  scenarioFor,
  type GameState,
  type Terrain,
} from '../src';
import { act, completeOrderRoll, expectFail, give, playBotGame } from './helpers';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const }));

function fogGame(n = 3, seed = 7): GameState {
  return completeOrderRoll(createGame(players(n), seed, { mod: 'seafarers', scenario: 'fogIslands' }));
}

/** Skips the setup: `player` is in their Action phase with nothing built. */
function actionPhase(s: GameState, player = 0): GameState {
  s.phase = 'MAIN_ACTIONS';
  s.setup = null;
  s.turn = 1;
  s.hasRolled = true;
  s.currentPlayer = player;
  return s;
}

const fogHexes = (s: GameState) => s.board.hexes.filter((h) => h.terrain === 'fog').map((h) => h.id);

/**
 * A ship edge with one end touching exactly one empty space `fog` (the other end touches none),
 * so building it discovers exactly that space.
 */
function discoveryShip(s: GameState): { edge: string; from: string; fog: number } {
  const G = boardGraph(s.board);
  const fogAt = (v: string) => G.vertices[v].hexes.filter((h) => s.board.hexes[h].terrain === 'fog');
  for (const e of Object.values(G.edges)) {
    const [a, b] = e.vertices;
    if (!e.hexes.some((h) => s.board.hexes[h].terrain === 'sea')) continue;
    if (e.hexes.length === 2 && e.hexes.some((h) => s.board.hexes[h].terrain === 'fog')) continue;
    for (const [from, to] of [[a, b], [b, a]]) {
      if (fogAt(from).length === 0 && fogAt(to).length === 1) return { edge: e.id, from, fog: fogAt(to)[0] };
    }
  }
  throw new Error('no discovery edge');
}

describe('The Fog Islands', () => {
  it('wins at 12; 12 empty spaces and a hidden stack of 12 hexes and 10 discs', () => {
    for (const n of [3, 4]) {
      const s = fogGame(n);
      expect(scenarioFor(s)!.victoryTarget).toBe(12);
      expect(fogHexes(s)).toHaveLength(12);
      expect(s.fogStack!.hexes).toHaveLength(12);
      expect(s.fogStack!.numbers).toHaveLength(10);
      const count = (t: Terrain) => s.fogStack!.hexes.filter((x) => x === t).length;
      expect([count('sea'), count('gold'), count('hills'), count('forest'), count('pasture'), count('fields'), count('mountains')]).toEqual([
        2, 2, 2, 1, 1, 2, 2,
      ]);
      const view = getPlayerView(s, 0);
      expect('fogStack' in view).toBe(false);
      expect(view.fogLeft).toBe(12);
    }
  });

  it('starting settlements go on either island, never on a spot touching only empty spaces and sea', () => {
    const s = fogGame();
    const G = boardGraph(s.board);
    const legal = legalSetupSettlements(s);
    const regions = new Set(legal.flatMap((v) => G.vertices[v].hexes.map((h) => s.board.hexes[h].region).filter(Boolean)));
    expect(regions).toEqual(new Set(['east', 'west']));
    for (const v of legal) expect(G.vertices[v].hexes.some((h) => isLandHex(s.board, h))).toBe(true);
  });

  it('a ship next to an empty space discovers it: land gets a disc and pays 1 resource, sea pays nothing', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      let s = actionPhase(fogGame(3, seed));
      const { edge, from, fog } = discoveryShip(s);
      s.buildings[from] = { owner: 0, type: 'settlement' };
      s.players[0].settlementsBuilt = 1;
      give(s, 0, { lumber: 1, wool: 1 });
      const bankBefore = { ...s.bank };
      s = act(s, 0, { type: 'buildShip', edge });
      const tile = s.board.hexes[fog];
      expect(tile.terrain).not.toBe('fog');
      expect(s.fogStack!.hexes).toHaveLength(11);
      const hand = RESOURCES.reduce((t, r) => t + s.players[0].resources[r], 0);
      if (tile.terrain === 'sea') {
        seen.add('sea');
        expect(tile.number).toBeNull();
        expect(s.fogStack!.numbers).toHaveLength(10);
        expect(hand).toBe(0);
        expect(s.phase).toBe('MAIN_ACTIONS');
      } else if (tile.terrain === 'gold') {
        seen.add('gold');
        expect(tile.number).not.toBeNull();
        expect(s.phase).toBe('GOLD_CHOICE');
        expect(s.pendingGold).toEqual({ 0: 1 });
        s = act(s, 0, { type: 'chooseGold', resources: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 1 } });
        expect(s.phase).toBe('MAIN_ACTIONS');
        expect(s.players[0].resources.ore).toBe(1);
        // A discovered gold field is not dice production.
        expect(s.lastRoll).toBeNull();
      } else {
        seen.add('land');
        expect(tile.number).not.toBeNull();
        expect(s.fogStack!.numbers).toHaveLength(9);
        expect(hand).toBe(1);
        const r = RESOURCES.find((x) => s.players[0].resources[x] === 1)!;
        expect(s.bank[r]).toBe(bankBefore[r] + (r === 'lumber' || r === 'wool' ? 1 : 0) - 1);
        expect(s.log.some((l) => l.key === 'discoveredLand')).toBe(true);
      }
    }
    expect(seen).toEqual(new Set(['sea', 'gold', 'land']));
  });

  it('empty spaces are not land or sea: no robber, no road between them and the sea, no ship between two of them', () => {
    const s = actionPhase(fogGame());
    s.phase = 'ROBBER_MOVE';
    const fog = fogHexes(s)[0];
    expect(expectFail(s, 0, { type: 'moveRobber', hex: fog })).toMatch(/land/);
    expect(expectFail(s, 0, { type: 'movePirate', hex: fog })).toMatch(/sea hex/);

    const t = actionPhase(fogGame());
    const G = boardGraph(t.board);
    give(t, 0, { lumber: 2, wool: 1, brick: 1 });
    const isFog = (h: number) => t.board.hexes[h].terrain === 'fog';
    const fogFog = Object.values(G.edges).find((e) => e.hexes.length === 2 && e.hexes.every(isFog))!;
    t.buildings[fogFog.vertices[0]] = { owner: 0, type: 'settlement' };
    expect(expectFail(t, 0, { type: 'buildShip', edge: fogFog.id })).toMatch(/sea/);
    const fogSea = Object.values(G.edges).find(
      (e) => e.hexes.length === 2 && e.hexes.some(isFog) && e.hexes.some((h) => t.board.hexes[h].terrain === 'sea'),
    )!;
    t.buildings[fogSea.vertices[0]] = { owner: 0, type: 'settlement' };
    expect(expectFail(t, 0, { type: 'buildRoad', edge: fogSea.id })).toMatch(/land/);
  });

  it('bots explore and finish games; resources are conserved', () => {
    for (const n of [3, 4]) {
      const r = playBotGame(Array(n).fill('hard'), 75, 15000, { mod: 'seafarers', scenario: 'fogIslands' });
      expect(r.state.phase).toBe('GAME_OVER');
      expect(r.state.fogStack!.hexes.length).toBeLessThan(12);
      expect(fogHexes(r.state).length).toBe(r.state.fogStack!.hexes.length);
      for (const res of RESOURCES) expect(r.state.bank[res] + r.state.players.reduce((t, p) => t + p.resources[res], 0)).toBe(19);
    }
  }, 120_000);
});
