import { describe, expect, it } from 'vitest';
import { GRAPH, legalRoads, legalSetupSettlements, totalRes, victoryPoints } from '../src';
import {
  act,
  completeSetup,
  expectFail,
  mainPhaseGame,
  newGame,
  pathFrom,
  placeBuilding,
  placeRoadDirect,
  setResources,
} from './helpers';

describe('initial placement', () => {
  it('uses A, B, B, A order for two players', () => {
    let s = newGame(2);
    const order: number[] = [];
    while (s.phase === 'INITIAL_PLACEMENT') {
      order.push(s.currentPlayer);
      s = completeSetupStep(s);
    }
    expect(order).toEqual([0, 1, 1, 0]);
    expect(s.phase).toBe('PRE_ROLL');
    expect(s.currentPlayer).toBe(0);
  });

  it('uses snake order for four players', () => {
    let s = newGame(4);
    const order: number[] = [];
    while (s.phase === 'INITIAL_PLACEMENT') {
      order.push(s.currentPlayer);
      s = completeSetupStep(s);
    }
    expect(order).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);
  });

  it('enforces the distance rule and connected setup road', () => {
    let s = newGame(2);
    const v = 'v20';
    s = act(s, 0, { type: 'placeSetupSettlement', vertex: v });
    const farEdge = GRAPH.edgeIds.find((e) => !GRAPH.edges[e].vertices.includes(v))!;
    expect(expectFail(s, 0, { type: 'placeSetupRoad', edge: farEdge })).toMatch(/touch/);
    s = act(s, 0, { type: 'placeSetupRoad', edge: GRAPH.vertices[v].edges[0] });
    const neighbor = GRAPH.vertices[v].neighbors[0];
    expect(expectFail(s, 1, { type: 'placeSetupSettlement', vertex: neighbor })).toMatch(/two roads/);
    expect(expectFail(s, 1, { type: 'placeSetupSettlement', vertex: v })).toBeTruthy();
    expect(expectFail(s, 0, { type: 'placeSetupSettlement', vertex: 'v40' })).toMatch(/not your turn/);
  });

  it('gives starting resources only for the second settlement', () => {
    let s = newGame(2);
    s = completeSetupStep(s);
    expect(totalRes(s.players[0].resources)).toBe(0);
    s = completeSetupStep(s); // P1 first
    const before = totalRes(s.players[1].resources);
    const v = legalSetupSettlements(s)[0];
    s = act(s, 1, { type: 'placeSetupSettlement', vertex: v });
    const producing = GRAPH.vertices[v].hexes.filter((h) => s.board.hexes[h].terrain !== 'desert').length;
    expect(totalRes(s.players[1].resources) - before).toBe(producing);
  });

  it('house rule: gives starting resources for both settlements', () => {
    let s = newGame(2);
    s.config.startResBothSettlements = true;
    const v = legalSetupSettlements(s)[0];
    s = act(s, 0, { type: 'placeSetupSettlement', vertex: v });
    const producing = GRAPH.vertices[v].hexes.filter((h) => s.board.hexes[h].terrain !== 'desert').length;
    expect(producing).toBeGreaterThan(0);
    expect(totalRes(s.players[0].resources)).toBe(producing);
  });

  it('rejects building before rolling', () => {
    const s = completeSetup(newGame(2));
    setResources(s, 0, { lumber: 5, brick: 5 });
    expect(expectFail(s, 0, { type: 'buildRoad', edge: legalRoads(s, 0)[0] })).toMatch(/PRE_ROLL/);
  });
});

function completeSetupStep(s: ReturnType<typeof newGame>) {
  const p = s.currentPlayer;
  const v = legalSetupSettlements(s)[0];
  s = act(s, p, { type: 'placeSetupSettlement', vertex: v });
  return act(s, p, { type: 'placeSetupRoad', edge: GRAPH.vertices[v].edges.find((e) => s.roads[e] === undefined)! });
}

describe('building', () => {
  it('builds a connected road and charges the cost', () => {
    const s = mainPhaseGame();
    placeBuilding(s, 0, 'v20');
    setResources(s, 0, { lumber: 1, brick: 1 });
    const edge = GRAPH.vertices.v20.edges[0];
    const next = act(s, 0, { type: 'buildRoad', edge });
    expect(next.roads[edge]).toBe(0);
    expect(totalRes(next.players[0].resources)).toBe(0);
    expect(next.bank.lumber).toBe(19);
  });

  it('rejects roads without resources, disconnected, or on occupied edges', () => {
    const s = mainPhaseGame();
    placeBuilding(s, 0, 'v20');
    const edge = GRAPH.vertices.v20.edges[0];
    expect(expectFail(s, 0, { type: 'buildRoad', edge })).toMatch(/Not enough/);
    setResources(s, 0, { lumber: 2, brick: 2 });
    const far = GRAPH.edgeIds.find((e) => !GRAPH.edges[e].vertices.some((v) => v === 'v20' || GRAPH.vertices.v20.neighbors.includes(v)))!;
    expect(expectFail(s, 0, { type: 'buildRoad', edge: far })).toMatch(/connect/);
    placeRoadDirect(s, 1, edge);
    expect(expectFail(s, 0, { type: 'buildRoad', edge })).toMatch(/already/);
  });

  it('does not let a road pass through an opponent settlement', () => {
    const s = mainPhaseGame();
    const { vertices, edges } = pathFrom('v20', 2);
    placeBuilding(s, 0, vertices[0]);
    placeRoadDirect(s, 0, edges[0]);
    placeBuilding(s, 1, vertices[1]);
    setResources(s, 0, { lumber: 1, brick: 1 });
    expect(expectFail(s, 0, { type: 'buildRoad', edge: edges[1] })).toMatch(/connect/);
  });

  it('requires settlements to connect to a road and obey distance', () => {
    const s = mainPhaseGame();
    const { vertices, edges } = pathFrom('v20', 2);
    placeBuilding(s, 0, vertices[0]);
    placeRoadDirect(s, 0, edges[0]);
    setResources(s, 0, { lumber: 2, brick: 2, wool: 2, grain: 2 });
    expect(expectFail(s, 0, { type: 'buildSettlement', vertex: vertices[1] })).toMatch(/two roads/);
    expect(expectFail(s, 0, { type: 'buildSettlement', vertex: vertices[2] })).toMatch(/connect/);
    placeRoadDirect(s, 0, edges[1]);
    const next = act(s, 0, { type: 'buildSettlement', vertex: vertices[2] });
    expect(next.buildings[vertices[2]]).toEqual({ owner: 0, type: 'settlement' });
    expect(victoryPoints(next, 0)).toBe(2);
  });

  it('enforces the settlement limit', () => {
    const s = mainPhaseGame();
    const { vertices, edges } = pathFrom('v20', 2);
    placeBuilding(s, 0, vertices[0]);
    edges.forEach((e) => placeRoadDirect(s, 0, e));
    s.players[0].settlementsBuilt = 5;
    setResources(s, 0, { lumber: 1, brick: 1, wool: 1, grain: 1 });
    expect(expectFail(s, 0, { type: 'buildSettlement', vertex: vertices[2] })).toMatch(/No settlements left/);
  });

  it('upgrades own settlements only, and frees a settlement piece', () => {
    const s = mainPhaseGame();
    placeBuilding(s, 0, 'v20');
    placeBuilding(s, 1, 'v40');
    setResources(s, 0, { grain: 2, ore: 3 });
    expect(expectFail(s, 0, { type: 'buildCity', vertex: 'v40' })).toMatch(/your settlements/);
    s.players[0].settlementsBuilt = 5; // all settlements on board, upgrading frees one
    const next = act(s, 0, { type: 'buildCity', vertex: 'v20' });
    expect(next.buildings.v20.type).toBe('city');
    expect(next.players[0].settlementsBuilt - next.players[0].citiesBuilt).toBe(4);
    expect(victoryPoints(next, 0)).toBe(6);
    expect(expectFail(next, 0, { type: 'buildCity', vertex: 'v20' })).toMatch(/your settlements/);
  });

  it('enforces the city limit', () => {
    const s = mainPhaseGame();
    placeBuilding(s, 0, 'v20');
    s.players[0].citiesBuilt = 4;
    s.players[0].settlementsBuilt = 5;
    setResources(s, 0, { grain: 2, ore: 3 });
    expect(expectFail(s, 0, { type: 'buildCity', vertex: 'v20' })).toMatch(/No cities/);
  });

  it('rejects actions from the wrong player and leaves state untouched', () => {
    const s = mainPhaseGame();
    const snapshot = JSON.stringify(s);
    expect(expectFail(s, 1, { type: 'endTurn' })).toMatch(/not your turn/);
    expect(expectFail(s, 0, { type: 'buildRoad', edge: 'nope' })).toBeTruthy();
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
