import { describe, expect, it } from 'vitest';
import { GRAPH, applyAction, totalRes, type GameState } from '../src';
import { act, expectFail, mainPhaseGame, placeBuilding, setResources } from './helpers';

/** Finds an RNG seed whose next roll sums to `target`, then puts the game in PRE_ROLL. */
function rollFor(state: GameState, target: number): GameState {
  state.phase = 'PRE_ROLL';
  state.hasRolled = false;
  for (let seed = 1; seed < 100000; seed++) {
    state.rng = seed;
    const res = applyAction(state, state.currentPlayer, { type: 'rollDice' });
    if (res.ok && res.state.lastRoll!.dice[0] + res.state.lastRoll!.dice[1] === target) return res.state;
  }
  throw new Error('no seed');
}

/** A hex with a given number token and the vertex ids around it. */
function hexWithNumber(s: GameState, n: number) {
  const hex = s.board.hexes.find((h) => h.number === n)!;
  return { hex, vertices: GRAPH.hexes[hex.id].vertices };
}

describe('resource production', () => {
  it('pays 1 per settlement and 2 per city, for every player', () => {
    const s = mainPhaseGame();
    const { hex, vertices } = hexWithNumber(s, 5);
    placeBuilding(s, 0, vertices[0]);
    placeBuilding(s, 1, vertices[2], 'city');
    const next = rollFor(s, 5);
    const resource = { forest: 'lumber', hills: 'brick', pasture: 'wool', fields: 'grain', mountains: 'ore' }[
      hex.terrain as 'forest'
    ] as 'lumber';
    expect(next.players[0].resources[resource]).toBeGreaterThanOrEqual(1);
    expect(next.players[1].resources[resource]).toBeGreaterThanOrEqual(2);
    expect(next.lastRoll!.producingHexes).toContain(hex.id);
    expect(next.phase).toBe('MAIN_ACTIONS');
  });

  it('robber blocks the hex it sits on', () => {
    const s = mainPhaseGame();
    const { hex, vertices } = hexWithNumber(s, 9);
    s.board.robberHex = hex.id;
    placeBuilding(s, 0, vertices[0]);
    const next = rollFor(s, 9);
    expect(next.lastRoll!.producingHexes).not.toContain(hex.id);
  });

  it('gives remaining supply to a single claimant when the bank runs short', () => {
    const s = mainPhaseGame();
    const hex = s.board.hexes.find((h) => h.number === 6 && h.terrain !== 'desert')!;
    const resource = ({ forest: 'lumber', hills: 'brick', pasture: 'wool', fields: 'grain', mountains: 'ore' } as const)[
      hex.terrain as 'forest'
    ];
    // Only this 6-hex is occupied, by one city of player 0.
    placeBuilding(s, 0, GRAPH.hexes[hex.id].vertices[0], 'city');
    const others = s.board.hexes.filter((h) => h.number === 6 && h.id !== hex.id);
    for (const o of others) s.board.robberHex = o.id; // block the other 6
    s.bank[resource] = 1;
    s.players[1].resources[resource] = 18;
    const next = rollFor(s, 6);
    expect(next.players[0].resources[resource]).toBe(1);
    expect(next.bank[resource]).toBe(0);
  });

  it('gives nobody a resource when several players are short-changed', () => {
    const s = mainPhaseGame(3);
    const hex = s.board.hexes.find((h) => h.number === 8)!;
    const resource = ({ forest: 'lumber', hills: 'brick', pasture: 'wool', fields: 'grain', mountains: 'ore' } as const)[
      hex.terrain as 'forest'
    ];
    const vs = GRAPH.hexes[hex.id].vertices;
    placeBuilding(s, 0, vs[0]);
    placeBuilding(s, 1, vs[2]);
    s.board.robberHex = s.board.hexes.find((h) => h.number === 8 && h.id !== hex.id)!.id;
    s.players[2].resources[resource] = 18;
    s.bank[resource] = 1;
    const next = rollFor(s, 8);
    expect(next.players[0].resources[resource]).toBe(0);
    expect(next.players[1].resources[resource]).toBe(0);
    expect(next.bank[resource]).toBe(1);
  });
});

describe('rolling a seven', () => {
  it.each([
    [7, 0],
    [8, 4],
    [9, 4],
    [11, 5],
  ])('a player with %i cards discards %i', (cards, discard) => {
    const s = mainPhaseGame();
    setResources(s, 1, { lumber: cards });
    const next = rollFor(s, 7);
    expect(next.pendingDiscards[1] ?? 0).toBe(discard);
    expect(next.phase).toBe(discard > 0 ? 'ROBBER_DISCARD' : 'ROBBER_MOVE');
  });

  it('requires all discards before the robber moves, and blocks other actions', () => {
    const s = mainPhaseGame();
    setResources(s, 0, { lumber: 4, brick: 4 });
    setResources(s, 1, { ore: 9 });
    let next = rollFor(s, 7);
    expect(next.pendingDiscards).toEqual({ 0: 4, 1: 4 });
    expect(expectFail(next, 0, { type: 'endTurn' })).toBeTruthy();
    expect(expectFail(next, 0, { type: 'bankTrade', give: 'lumber', get: 'ore' })).toBeTruthy();
    expect(expectFail(next, 0, { type: 'moveRobber', hex: 0 })).toBeTruthy();
    expect(expectFail(next, 1, { type: 'discard', resources: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 3 } })).toMatch(/exactly 4/);
    expect(expectFail(next, 1, { type: 'discard', resources: { lumber: 4, brick: 0, wool: 0, grain: 0, ore: 0 } })).toMatch(/do not have/);
    next = act(next, 1, { type: 'discard', resources: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 4 } });
    expect(next.phase).toBe('ROBBER_DISCARD');
    next = act(next, 0, { type: 'discard', resources: { lumber: 2, brick: 2, wool: 0, grain: 0, ore: 0 } });
    expect(next.phase).toBe('ROBBER_MOVE');
    expect(next.players[1].resources.ore).toBe(5);
  });

  it('must move the robber to a different hex and steals automatically from a single victim', () => {
    const s = mainPhaseGame();
    const target = s.board.hexes.find((h) => h.id !== s.board.robberHex)!;
    placeBuilding(s, 1, GRAPH.hexes[target.id].vertices[0]);
    setResources(s, 1, { wool: 3 });
    let next = rollFor(s, 7);
    expect(expectFail(next, 0, { type: 'moveRobber', hex: next.board.robberHex })).toMatch(/different/);
    next = act(next, 0, { type: 'moveRobber', hex: target.id });
    expect(next.players[0].resources.wool).toBe(1);
    expect(next.players[1].resources.wool).toBe(2);
    expect(next.phase).toBe('MAIN_ACTIONS');
  });

  it('lets the active player choose among several victims', () => {
    const s = mainPhaseGame(3);
    const target = s.board.hexes.find((h) => h.id !== s.board.robberHex)!;
    const vs = GRAPH.hexes[target.id].vertices;
    placeBuilding(s, 1, vs[0]);
    placeBuilding(s, 2, vs[3]);
    setResources(s, 1, { wool: 1 });
    setResources(s, 2, { ore: 1 });
    let next = rollFor(s, 7);
    next = act(next, 0, { type: 'moveRobber', hex: target.id });
    expect(next.phase).toBe('ROBBER_STEAL');
    expect(next.stealCandidates).toEqual([1, 2]);
    expect(expectFail(next, 0, { type: 'steal', victim: 0 })).toBeTruthy();
    next = act(next, 0, { type: 'steal', victim: 2 });
    expect(next.players[0].resources.ore).toBe(1);
    expect(next.phase).toBe('MAIN_ACTIONS');
  });

  it('skips stealing when the victim has no cards', () => {
    const s = mainPhaseGame();
    const target = s.board.hexes.find((h) => h.id !== s.board.robberHex)!;
    placeBuilding(s, 1, GRAPH.hexes[target.id].vertices[0]);
    let next = rollFor(s, 7);
    next = act(next, 0, { type: 'moveRobber', hex: target.id });
    expect(next.phase).toBe('MAIN_ACTIONS');
    expect(totalRes(next.players[0].resources)).toBe(0);
  });
});
