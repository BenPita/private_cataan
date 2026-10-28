import { describe, expect, it } from 'vitest';
import {
  BASE_MOD,
  createGame,
  getPlayerView,
  graphBounds,
  graphFor,
  hasAdjacentRedNumbers,
  modFor,
  modPlayerRange,
  victoryPoints,
  type GameState,
  type Terrain,
} from '../src';
import { act, expectFail, give, mainPhaseGame, placeBuilding, placeRoadDirect, setResources } from './helpers';

const seats = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const }));
const LARGE = BASE_MOD.large!;

describe('5–6 player layout', () => {
  const g = graphFor('classic56');

  it('has 30 hexes in rows 3-4-5-6-5-4-3', () => {
    expect(g.hexes).toHaveLength(30);
    const rows = new Map<number, number>();
    for (const h of g.hexes) rows.set(h.r, (rows.get(h.r) ?? 0) + 1);
    expect([...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n)).toEqual([3, 4, 5, 6, 5, 4, 3]);
    expect(g.vertexIds).toHaveLength(80);
    expect(g.edgeIds).toHaveLength(109);
    for (const h of g.hexes) expect(h.neighbors.length).toBeGreaterThanOrEqual(3);
  });

  it('coast is one closed loop of 38 edges, in order', () => {
    expect(g.coastalEdges).toHaveLength(38);
    g.coastalEdges.forEach((e, i) => {
      const next = g.coastalEdges[(i + 1) % g.coastalEdges.length];
      const shared = g.edges[e].vertices.filter((v) => g.edges[next].vertices.includes(v));
      expect(shared).toHaveLength(1);
    });
  });

  it('is centred, and bounds are exported for renderers', () => {
    const cx = g.hexes.reduce((s, h) => s + h.x, 0) / g.hexes.length;
    const cy = g.hexes.reduce((s, h) => s + h.y, 0) / g.hexes.length;
    expect(Math.abs(cx)).toBeLessThan(1e-9);
    expect(Math.abs(cy)).toBeLessThan(1e-9);
    const b = graphBounds(g);
    expect(b.maxX).toBeCloseTo(3 * Math.sqrt(3));
    expect(b.maxY).toBeCloseTo(5.5);
    const c = graphBounds(graphFor('classic'));
    expect(c.maxX).toBeCloseTo(2.5 * Math.sqrt(3));
    expect(c.maxY).toBeCloseTo(4);
  });
});

describe('5–6 player mod rules', () => {
  it('the base mod covers 2–6 participants; 5+ switch to the large rules', () => {
    expect(modPlayerRange(BASE_MOD)).toEqual({ min: 2, max: 6 });
    expect(LARGE).toMatchObject({ id: 'base', minPlayers: 5, maxPlayers: 6, layout: 'classic56', bankPerResource: 24, pairedPlayers: true });
    expect(modFor({ config: {}, players: seats(4) })).toBe(BASE_MOD);
    expect(modFor({ config: { mod: 'base' }, players: seats(5) })).toBe(LARGE);
    expect(modFor({ config: {}, players: seats(6) })).toBe(LARGE);
    expect(LARGE.harborGaps.reduce((a, b) => a + b, 0)).toBe(graphFor('classic56').coastalEdges.length);
    expect(Math.min(...LARGE.harborGaps)).toBeGreaterThanOrEqual(2);
  });

  for (const n of [5, 6]) {
    it(`a ${n}-player game uses the large bank, deck, board and colours`, () => {
      const s = createGame(seats(n), 7);
      expect(s.board.layout).toBe('classic56');
      expect(s.board.hexes).toHaveLength(30);
      expect(Object.values(s.bank)).toEqual([24, 24, 24, 24, 24]);
      expect(s.devDeck).toHaveLength(34);
      const count = (t: string) => s.devDeck.filter((c) => c === t).length;
      expect([count('knight'), count('victoryPoint'), count('roadBuilding'), count('yearOfPlenty'), count('monopoly')]).toEqual([20, 5, 3, 3, 3]);
      expect(s.players.map((p) => p.color)).toEqual(['#d8392b', '#2f6fd6', '#f4f1e8', '#f08a1c', '#3d9a3f', '#7d4fb8'].slice(0, n));
      expect(s.paired).toBeNull();
    });
  }

  it('2–4 player games keep the classic rules', () => {
    const s = createGame(seats(4), 7);
    expect(s.board.layout).toBe('classic');
    expect(s.devDeck).toHaveLength(25);
    expect(s.bank.ore).toBe(19);
  });

  it('participant limits come from the overall range', () => {
    expect(() => createGame(seats(1), 1)).toThrow(/2-6/);
    expect(() => createGame(seats(7), 1)).toThrow(/2-6/);
  });
});

describe('5–6 player boards', () => {
  const G = graphFor('classic56');

  it('random boards are balanced and have 11 separated harbors', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = createGame(seats(5 + (seed % 2)), seed);
      const counts: Record<string, number> = {};
      for (const h of s.board.hexes) counts[h.terrain] = (counts[h.terrain] ?? 0) + 1;
      expect(counts).toEqual({ hills: 5, forest: 6, pasture: 6, fields: 6, mountains: 5, desert: 2 });
      expect(hasAdjacentRedNumbers(s.board.hexes, G)).toBe(false);
      expect(s.board.harbors).toHaveLength(11);
      const types = s.board.harbors.map((h) => h.type).sort();
      expect(types).toEqual(['brick', 'generic', 'generic', 'generic', 'generic', 'generic', 'grain', 'lumber', 'ore', 'wool', 'wool']);
      const used = new Set<string>();
      for (const h of s.board.harbors) {
        expect(G.coastalEdges).toContain(h.edge);
        for (const v of G.edges[h.edge].vertices) {
          expect(used.has(v)).toBe(false);
          used.add(v);
        }
      }
      expect(s.board.hexes[s.board.robberHex].terrain).toBe('desert');
    }
  });

  it('the beginner board matches the rulebook map', () => {
    const rows: Array<Array<[Terrain, number | null]>> = [
      [['hills', 10], ['pasture', 6], ['desert', null]],
      [['hills', 6], ['fields', 2], ['mountains', 9], ['hills', 11]],
      [['forest', 3], ['mountains', 11], ['forest', 5], ['fields', 10], ['pasture', 4]],
      [['desert', null], ['pasture', 5], ['fields', 4], ['mountains', 6], ['pasture', 3], ['fields', 8]],
      [['forest', 12], ['mountains', 10], ['pasture', 2], ['hills', 4], ['forest', 11]],
      [['forest', 8], ['fields', 3], ['forest', 9], ['fields', 5]],
      [['hills', 9], ['pasture', 12], ['mountains', 8]],
    ];
    const s = createGame(seats(6), 3, { boardType: 'beginner' });
    expect(s.board.hexes.map((h) => [h.terrain, h.number])).toEqual(rows.flat());
    expect(s.board.robberHex).toBe(2);
    expect(s.board.harbors.map((h) => h.type)).toEqual(
      ['generic', 'wool', 'generic', 'ore', 'generic', 'grain', 'brick', 'generic', 'lumber', 'generic', 'wool'],
    );
    expect(s.board.harbors[0].edge).toBe(G.coastalEdges[0]);
  });
});

/** Ends the active part of a turn; a Player 1 who has not rolled is treated as having rolled. */
function pass(s: GameState): GameState {
  if (s.phase === 'PRE_ROLL') {
    s = structuredClone(s);
    s.phase = 'MAIN_ACTIONS';
    s.hasRolled = true;
  }
  return act(s, s.currentPlayer, { type: 'endTurn' });
}

describe('paired players (5–6)', () => {
  it('Player 2 is the third player after Player 1 and acts without rolling', () => {
    for (const n of [5, 6]) {
      let s = mainPhaseGame(n);
      s = act(s, 0, { type: 'endTurn' });
      expect(s.paired).toEqual({ first: 0 });
      expect(s.currentPlayer).toBe(3);
      expect(s.phase).toBe('MAIN_ACTIONS');
      expect(s.hasRolled).toBe(true);
      expect(s.turn).toBe(2);
      expect(s.log.at(-1)).toMatchObject({ key: 'pairedTurn', params: { p: 3 } });
      expect(expectFail(s, 3, { type: 'rollDice' })).toMatch(/PRE_ROLL|MAIN_ACTIONS/);
      expect(getPlayerView(s, 1).paired).toEqual({ first: 0 });

      s = act(s, 3, { type: 'endTurn' });
      expect(s.paired).toBeNull();
      expect(s.currentPlayer).toBe(1);
      expect(s.phase).toBe('PRE_ROLL');
      expect(s.hasRolled).toBe(false);
      expect(s.turn).toBe(3);
    }
  });

  it('follows the turn order, wrapping around', () => {
    let s = mainPhaseGame(5);
    s.turnOrder = [2, 0, 4, 1, 3];
    s.currentPlayer = 1;
    s = act(s, 1, { type: 'endTurn' });
    expect(s.currentPlayer).toBe(0); // third after seat 1 in 1 → 3 → 2 → 0
    s = act(s, 0, { type: 'endTurn' });
    expect(s.currentPlayer).toBe(3); // the player after seat 1
  });

  it('Player 2 may not trade with other players', () => {
    let s = mainPhaseGame(6);
    give(s, 0, { ore: 1 });
    s = act(s, 0, { type: 'proposeTrade', give: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 1 }, get: { lumber: 0, brick: 0, wool: 1, grain: 0, ore: 0 }, to: [3] });
    s = act(s, 0, { type: 'endTurn' });
    expect(s.trade).toBeNull();
    give(s, 3, { ore: 2, wool: 2 });
    const offer = { give: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 1 }, get: { lumber: 0, brick: 0, wool: 0, grain: 1, ore: 0 } };
    expect(expectFail(s, 3, { type: 'proposeTrade', ...offer, to: [1] })).toMatch(/Player 2 may not trade/);
    // Even a leftover offer cannot be answered or confirmed.
    const injected = structuredClone(s);
    injected.trade = { id: 9, from: 3, ...offer, to: [1], responses: { 1: 'accepted' }, counters: {} };
    expect(expectFail(injected, 1, { type: 'respondTrade', tradeId: 9, response: 'accept' })).toMatch(/Player 2 may not trade/);
    expect(expectFail(injected, 1, { type: 'counterTrade', tradeId: 9, give: offer.get, get: offer.give })).toMatch(/Player 2 may not trade/);
    expect(expectFail(injected, 3, { type: 'confirmTrade', tradeId: 9, with: 1 })).toMatch(/Player 2 may not trade/);
  });

  it('Player 2 may bank-trade, build, buy and play a development card', () => {
    let s = mainPhaseGame(6);
    s.board.harbors = []; // plain 4:1 bank trade
    placeBuilding(s, 3, 'v20');
    const G = graphFor('classic56');
    const edge = G.vertices.v20.edges[0];
    placeRoadDirect(s, 3, edge);
    s.players[3].devCards = [{ type: 'knight', boughtTurn: 0 }];
    s = act(s, 0, { type: 'endTurn' });
    setResources(s, 3, { lumber: 5, brick: 1, wool: 1, grain: 1, ore: 1 });
    s = act(s, 3, { type: 'bankTrade', give: 'lumber', get: 'brick' });
    expect(s.players[3].resources).toMatchObject({ lumber: 1, brick: 2 });
    const next = G.edges[edge].vertices.find((v) => v !== 'v20')!;
    const road = G.vertices[next].edges.find((e) => e !== edge && s.roads[e] === undefined)!;
    s = act(s, 3, { type: 'buildRoad', edge: road });
    s.devDeck[0] = 'monopoly';
    s = act(s, 3, { type: 'buyDevCard' });
    s = act(s, 3, { type: 'playKnight' });
    expect(s.phase).toBe('ROBBER_MOVE');
    const target = s.board.hexes.find((h) => h.id !== s.board.robberHex)!.id;
    s = act(s, 3, { type: 'moveRobber', hex: target });
    if (s.phase === 'ROBBER_STEAL') s = act(s, 3, { type: 'steal', victim: s.stealCandidates[0] });
    expect(s.phase).toBe('MAIN_ACTIONS');
    expect(expectFail(s, 3, { type: 'playMonopoly', resource: 'ore' })).toMatch(/already played|turn they were bought/);
    s = act(s, 3, { type: 'endTurn' });
    expect(s.currentPlayer).toBe(1);
  });

  it('a card bought as Player 2 can be played on the next own turn, and vice versa', () => {
    let s = mainPhaseGame(6);
    s.devDeck[0] = 'knight';
    s.devDeck[1] = 'knight';
    give(s, 0, { wool: 1, grain: 1, ore: 1 });
    s = act(s, 0, { type: 'buyDevCard' }); // seat 0 buys as Player 1
    s = act(s, 0, { type: 'endTurn' });
    give(s, 3, { wool: 1, grain: 1, ore: 1 });
    s = act(s, 3, { type: 'buyDevCard' }); // seat 3 buys as Player 2
    expect(expectFail(s, 3, { type: 'playKnight' })).toMatch(/turn they were bought/);
    // Play on until seat 3 is Player 1 (before rolling).
    while (!(s.currentPlayer === 3 && s.paired === null)) s = pass(s);
    expect(s.phase).toBe('PRE_ROLL');
    expect(act(s, 3, { type: 'playKnight' }).phase).toBe('ROBBER_MOVE');
    // Seat 0 is Player 2 when seat 3 is Player 1.
    s = pass(s);
    expect(s.paired).toEqual({ first: 3 });
    expect(s.currentPlayer).toBe(0);
    expect(act(s, 0, { type: 'playKnight' }).phase).toBe('ROBBER_MOVE');
  });

  it('Player 2 can win during their phase', () => {
    let s = mainPhaseGame(5);
    for (const v of ['v0', 'v20', 'v40', 'v60']) placeBuilding(s, 3, v, 'city');
    expect(victoryPoints(s, 3)).toBe(8);
    s.players[3].devCards = [{ type: 'victoryPoint', boughtTurn: 0 }];
    s.devDeck[0] = 'victoryPoint';
    give(s, 3, { wool: 1, grain: 1, ore: 1 });
    s = act(s, 0, { type: 'endTurn' });
    expect(s.winner).toBeNull();
    s = act(s, 3, { type: 'buyDevCard' });
    expect(s.winner).toBe(3);
    expect(s.phase).toBe('GAME_OVER');
  });

  it('2–4 player games have no paired phase', () => {
    let s = mainPhaseGame(4);
    s = act(s, 0, { type: 'endTurn' });
    expect(s.paired).toBeNull();
    expect(s.currentPlayer).toBe(1);
    expect(s.phase).toBe('PRE_ROLL');
  });

  it('an old save without `paired` plays on normally', () => {
    let s = mainPhaseGame(4);
    delete (s as Partial<GameState>).paired;
    s = act(s, 0, { type: 'endTurn' });
    expect(s.currentPlayer).toBe(1);
  });
});
