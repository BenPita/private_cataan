import { describe, expect, it } from 'vitest';
import {
  SEAFARERS_MOD,
  boardGraph,
  createGame,
  getPlayerView,
  graphBounds,
  isRoadEdge,
  isShipEdge,
  legalSetupSettlements,
  legalShips,
  longestRoadLength,
  modPlayerRange,
  shipLinksBuildings,
  victoryPoints,
  type GameState,
} from '../src';
import { act, expectFail, mainPhaseGame, placeBuilding, placeRoadDirect, setResources } from './helpers';
import { TEST_MAP, edgeVV, hexAt, rollTo, sfGame, side, vertexOf } from './seafarers-helpers';

/*
 * Key spots on TEST_MAP (see seafarers-helpers.ts):
 *   V1 = hills ∩ (0,0) ∩ pasture      coastal corner of the main island
 *   V2 = (0,0) ∩ pasture ∩ (0,1)      coastal, main island
 *   V3 = (0,0) ∩ (1,0) ∩ (0,1)        open sea
 *   V4 = (1,0) ∩ (0,1) ∩ fields       coastal, small island 'isle'
 *   e1 = V1–V2 (coast), e2 = V2–V3 (sea), e3 = V3–V4 (sea): a ship route to the island.
 */
function spots(s: GameState) {
  const V1 = vertexOf(s, [[-1, 0], [0, 0], [-1, 1]]);
  const V2 = vertexOf(s, [[0, 0], [-1, 1], [0, 1]]);
  const V3 = vertexOf(s, [[0, 0], [1, 0], [0, 1]]);
  const V4 = vertexOf(s, [[1, 0], [0, 1], [1, 1]]);
  const V5 = vertexOf(s, [[0, 0], [1, 0], [1, -1]]);
  const e1 = edgeVV(s, V1, V2);
  const e2 = edgeVV(s, V2, V3);
  const e3 = edgeVV(s, V3, V4);
  return { V1, V2, V3, V4, V5, e1, e2, e3 };
}

const placeShipDirect = (s: GameState, player: number, edge: string) => {
  s.ships![edge] = player;
  s.players[player].shipsBuilt = (s.players[player].shipsBuilt ?? 0) + 1;
};

const goldTop = (s: GameState) => boardGraph(s.board).hexes[hexAt(s, 2, 0)].vertices[0];

describe('seafarers: mod, scenarios and boards', () => {
  it('is registered with ships, 2–6 players (5–6 with the large rules) and the newShores default scenario', () => {
    expect(SEAFARERS_MOD.pieceLimits.ships).toBe(15);
    expect(SEAFARERS_MOD.costs.ship).toEqual({ lumber: 1, wool: 1 });
    expect(modPlayerRange(SEAFARERS_MOD)).toEqual({ min: 2, max: 6 });
    expect(SEAFARERS_MOD.defaultScenario).toBe('newShores');
    expect(Object.keys(SEAFARERS_MOD.scenarios!)).toContain('newShores');
  });

  const people = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const }));

  it('picks the 3-player map for 2–3 participants, the 4-player map for 4, the 5–6 map for 5–6', () => {
    expect(createGame(people(2), 1, { mod: 'seafarers' }).board.layout).toBe('sf-newShores-3p');
    expect(createGame(people(3), 1, { mod: 'seafarers' }).board.layout).toBe('sf-newShores-3p');
    expect(createGame(people(4), 1, { mod: 'seafarers', scenario: 'newShores' }).board.layout).toBe('sf-newShores-4p');
    expect(createGame(people(5), 1, { mod: 'seafarers' }).board.layout).toBe('sf-newShores-6p');
    expect(() => createGame(people(7), 1, { mod: 'seafarers' })).toThrow(/2-6/);
  });

  it('the scenario sets the victory target and is recorded in the config', () => {
    const s = createGame(people(3), 1, { mod: 'seafarers', victoryTarget: 10 });
    expect(s.config.victoryTarget).toBe(14);
    expect(s.config.scenario).toBe('newShores');
    expect(() => createGame(people(3), 1, { mod: 'seafarers', scenario: 'nope' })).toThrow('Unknown scenario');
    expect(() => createGame(people(3), 1, { mod: 'seafarers', scenario: 'toString' })).toThrow('Unknown scenario');
  });

  it('builds the fixed map: every hex in map order (frame sea last), numbers, ports, robber and pirate', () => {
    for (const n of [3, 4]) {
      const s = createGame(people(n), 1, { mod: 'seafarers' });
      const G = boardGraph(s.board);
      expect(G.hexes.length).toBe(s.board.hexes.length);
      expect(s.board.hexes[s.board.robberHex].terrain).not.toBe('sea');
      expect(s.board.hexes[s.board.pirateHex!].terrain).toBe('sea');
      expect(s.board.startRegions).toEqual(['main']);
      const b = graphBounds(G);
      expect(Number.isFinite(b.maxX) && Number.isFinite(b.maxY)).toBe(true);
      for (const h of s.board.harbors) {
        // A port touches land and the sea (or frame).
        expect(isRoadEdge(s, h.edge) && isShipEdge(s, h.edge)).toBe(true);
      }
      expect(s.ships).toEqual({});
      expect(s.players.every((p) => p.shipsBuilt === 0 && p.vpTokens === 0)).toBe(true);
    }
  });

  it('test map: hexes, regions and the port come out as written', () => {
    const s = sfGame();
    expect(s.board.hexes.length).toBe(TEST_MAP.hexes.length);
    expect(s.board.hexes[hexAt(s, 2, 0)]).toMatchObject({ terrain: 'gold', number: 10, region: 'isle' });
    expect(s.board.hexes[hexAt(s, 0, 0)].region).toBeUndefined();
    expect(s.board.harbors).toEqual([{ edge: side(s, -2, 0, 3), type: 'generic' }]);
    expect(s.board.pirateHex).toBe(hexAt(s, -4, 2));
  });
});

describe('seafarers: board shape', () => {
  it('only vertices touching land are buildable', () => {
    const s = sfGame(2, 'INITIAL_PLACEMENT');
    const { V3, V1 } = spots(s);
    expect(legalSetupSettlements(s)).toContain(V1);
    expect(legalSetupSettlements(s)).not.toContain(V3);
    expect(expectFail(s, 0, { type: 'placeSetupSettlement', vertex: V3 })).toMatch(/empty spot/);
  });

  it('starting settlements only on the main island', () => {
    const s = sfGame(2, 'INITIAL_PLACEMENT');
    const { V4 } = spots(s);
    expect(legalSetupSettlements(s)).not.toContain(V4);
    expect(expectFail(s, 0, { type: 'placeSetupSettlement', vertex: V4 })).toBe('Starting settlements must be placed on the main island');
  });

  it('road edges touch land; ship edges touch the sea or the frame', () => {
    const s = sfGame();
    const { e1, e2 } = spots(s);
    const landLand = side(s, -1, 0, 5); // hills | pasture
    const landFrame = side(s, 2, 0, 1); // gold | outside
    const seaFrame = side(s, -3, 0, 3); // sea | outside
    expect([isRoadEdge(s, landLand), isShipEdge(s, landLand)]).toEqual([true, false]);
    expect([isRoadEdge(s, e1), isShipEdge(s, e1)]).toEqual([true, true]);
    expect([isRoadEdge(s, e2), isShipEdge(s, e2)]).toEqual([false, true]);
    expect([isRoadEdge(s, landFrame), isShipEdge(s, landFrame)]).toEqual([true, true]);
    expect([isRoadEdge(s, seaFrame), isShipEdge(s, seaFrame)]).toEqual([false, true]);
  });

  it('base boards are unchanged: every edge is a road edge, every vertex is on land', () => {
    const s = mainPhaseGame(3);
    const G = boardGraph(s.board);
    expect(G.edgeIds.every((e) => isRoadEdge(s, e))).toBe(true);
    expect(s.ships).toBeUndefined();
  });
});

describe('seafarers: building ships', () => {
  it('a ship from a coastal settlement costs lumber + wool', () => {
    let s = sfGame();
    const { V1, e1, e2 } = spots(s);
    placeBuilding(s, 0, V1);
    setResources(s, 0, { lumber: 2, wool: 2 });
    s = act(s, 0, { type: 'buildShip', edge: e1 });
    s = act(s, 0, { type: 'buildShip', edge: e2 });
    expect(s.ships).toEqual({ [e1]: 0, [e2]: 0 });
    expect(s.players[0].shipsBuilt).toBe(2);
    expect(s.players[0].resources).toMatchObject({ lumber: 0, wool: 0 });
    expect(s.newShips).toEqual([e1, e2]);
    expect(s.log.at(-1)!.key).toBe('builtShip');
    expect(expectFail(s, 0, { type: 'buildShip', edge: spots(s).e3 })).toBe('Not enough resources for a ship');
  });

  it('ships need a sea side, must connect to a ship or building (not a road)', () => {
    const s = sfGame();
    const { V1, V2, e1 } = spots(s);
    setResources(s, 0, { lumber: 5, wool: 5 });
    // Only a road at V1: not enough.
    placeRoadDirect(s, 0, edgeVV(s, V1, vertexOf(s, [[-1, 0], [0, -1], [0, 0]])));
    expect(expectFail(s, 0, { type: 'buildShip', edge: e1 })).toBe('Ship must connect to your ship or building');
    placeBuilding(s, 0, V1);
    expect(expectFail(s, 0, { type: 'buildShip', edge: side(s, -1, 0, 5) })).toBe('Ships must be placed next to the sea');
    expect(legalShips(s, 0)).toContain(e1);
    expect(legalShips(s, 0)).not.toContain(edgeVV(s, V2, spots(s).V3));
  });

  it('a road and a ship never share an edge', () => {
    let s = sfGame();
    const { V1, e1 } = spots(s);
    placeBuilding(s, 0, V1);
    setResources(s, 0, { lumber: 5, wool: 5, brick: 5 });
    s = act(s, 0, { type: 'buildShip', edge: e1 });
    expect(expectFail(s, 0, { type: 'buildRoad', edge: e1 })).toBe('That edge already has a ship');
    const coast = edgeVV(s, V1, vertexOf(s, [[-1, 0], [0, -1], [0, 0]]));
    s = act(s, 0, { type: 'buildRoad', edge: coast });
    expect(expectFail(s, 0, { type: 'buildShip', edge: coast })).toBe('That edge already has a road');
    // Roads never go on open sea.
    placeBuilding(s, 0, spots(s).V4);
    expect(expectFail(s, 0, { type: 'buildRoad', edge: spots(s).e3 })).toBe('Roads must be built next to land');
  });

  it('a road cannot continue from a ship', () => {
    const s = sfGame();
    const { V4, e1, e2, e3, V1 } = spots(s);
    placeBuilding(s, 0, V1);
    for (const e of [e1, e2, e3]) placeShipDirect(s, 0, e);
    setResources(s, 0, { lumber: 1, brick: 1 });
    const fieldsEdge = boardGraph(s.board).vertices[V4].edges.find((e) => e !== e3 && isRoadEdge(s, e))!;
    expect(expectFail(s, 0, { type: 'buildRoad', edge: fieldsEdge })).toBe('Road must connect to your network');
  });

  it('not past an opponent building', () => {
    const s = sfGame();
    const { V1, V2, e1, e2 } = spots(s);
    placeBuilding(s, 0, V1);
    placeShipDirect(s, 0, e1);
    placeBuilding(s, 1, V2);
    setResources(s, 0, { lumber: 1, wool: 1 });
    expect(expectFail(s, 0, { type: 'buildShip', edge: e2 })).toBe('Ship must connect to your ship or building');
  });

  it('not on an edge of the pirate hex', () => {
    const s = sfGame();
    const { V1, e1, e2 } = spots(s);
    placeBuilding(s, 0, V1);
    placeShipDirect(s, 0, e1);
    s.board.pirateHex = hexAt(s, 0, 1);
    setResources(s, 0, { lumber: 1, wool: 1 });
    expect(expectFail(s, 0, { type: 'buildShip', edge: e2 })).toBe('No ship may be placed next to the pirate');
  });

  it('15 ships per player', () => {
    const s = sfGame();
    const { V1, e1 } = spots(s);
    placeBuilding(s, 0, V1);
    s.players[0].shipsBuilt = 15;
    setResources(s, 0, { lumber: 1, wool: 1 });
    expect(expectFail(s, 0, { type: 'buildShip', edge: e1 })).toBe('No ships left');
  });

  it('base game has no ships', () => {
    const s = mainPhaseGame(2);
    expect(expectFail(s, 0, { type: 'buildShip', edge: 'e0' })).toBe('This game has no ships');
  });
});

describe('seafarers: settling islands', () => {
  it('a settlement at the end of a ship route; +2 VP once per island per player', () => {
    let s = sfGame();
    const { V1, V4, e1, e2, e3 } = spots(s);
    placeBuilding(s, 0, V1);
    for (const e of [e1, e2, e3]) placeShipDirect(s, 0, e);
    setResources(s, 0, { lumber: 2, brick: 2, wool: 2, grain: 2 });
    s = act(s, 0, { type: 'buildSettlement', vertex: V4 });
    expect(s.players[0].vpTokens).toBe(2);
    expect(s.players[0].bonusRegions).toEqual(['isle']);
    expect(s.log.at(-1)).toMatchObject({ key: 'regionBonus', params: { p: 0, n: 2 } });
    expect(victoryPoints(s, 0)).toBe(4);
    expect(getPlayerView(s, 1).players[0]).toMatchObject({ victoryPoints: 4, vpTokens: 2, bonusRegions: ['isle'] });
    // A second settlement on the same island: no bonus.
    placeShipDirect(s, 0, side(s, 2, 0, 2));
    s = act(s, 0, { type: 'buildSettlement', vertex: goldTop(s) });
    expect(s.players[0].vpTokens).toBe(2);
    expect(victoryPoints(s, 0)).toBe(5);
  });

  it('other players still get their own bonus on an island someone already settled', () => {
    let s = sfGame();
    const { V4 } = spots(s);
    placeBuilding(s, 0, V4);
    s.currentPlayer = 1;
    placeShipDirect(s, 1, side(s, 2, 0, 2));
    setResources(s, 1, { lumber: 1, brick: 1, wool: 1, grain: 1 });
    s = act(s, 1, { type: 'buildSettlement', vertex: goldTop(s) });
    expect(s.players[1].vpTokens).toBe(2);
  });

  it('home island settlements give no bonus; the scenario target (14) decides the win', () => {
    let s = sfGame();
    const { V1, V4, e1, e2, e3 } = spots(s);
    placeBuilding(s, 0, V1);
    for (const e of [e1, e2, e3]) placeShipDirect(s, 0, e);
    s.players[0].vpTokens = 8;
    setResources(s, 0, { lumber: 2, brick: 2, wool: 2, grain: 2 });
    s = act(s, 0, { type: 'buildSettlement', vertex: V4 });
    expect(victoryPoints(s, 0)).toBe(12);
    expect(s.winner).toBeNull();
    s.players[0].vpTokens = 12;
    const home = vertexOf(s, [[-2, 0], [-1, -1], [-2, -1]]);
    placeRoadDirect(s, 0, boardGraph(s.board).vertices[home].edges.find((e) => isRoadEdge(s, e))!);
    s = act(s, 0, { type: 'buildSettlement', vertex: home });
    expect(s.players[0].vpTokens).toBe(12);
    expect(s.winner).toBe(0);
    expect(victoryPoints(s, 0)).toBe(15);
  });
});

describe('seafarers: moving ships', () => {
  function route() {
    const s = sfGame();
    const p = spots(s);
    placeBuilding(s, 0, p.V1);
    for (const e of [p.e1, p.e2, p.e3]) placeShipDirect(s, 0, e);
    return { s, ...p };
  }

  it('moves a ship with an open end, once per turn; the piece count stays', () => {
    const { s, e3, V3, V5 } = route();
    const to = edgeVV(s, V3, V5);
    const next = act(s, 0, { type: 'moveShip', from: e3, to });
    expect(next.ships![e3]).toBeUndefined();
    expect(next.ships![to]).toBe(0);
    expect(next.players[0].shipsBuilt).toBe(3);
    expect(next.shipMoved).toBe(true);
    expect(next.log.at(-1)!.key).toBe('movedShip');
    expect(expectFail(next, 0, { type: 'moveShip', from: to, to: e3 })).toBe('You already moved a ship this turn');
  });

  it('a new turn allows another move', () => {
    const { s, e3, V3, V5 } = route();
    let next = act(s, 0, { type: 'moveShip', from: e3, to: edgeVV(s, V3, V5) });
    next = act(next, 0, { type: 'endTurn' });
    expect(next.shipMoved).toBe(false);
  });

  it('not a ship built this turn', () => {
    const { s, V3, V5, e3 } = route();
    delete s.ships![e3];
    s.players[0].shipsBuilt!--;
    setResources(s, 0, { lumber: 1, wool: 1 });
    const built = act(s, 0, { type: 'buildShip', edge: e3 });
    expect(expectFail(built, 0, { type: 'moveShip', from: e3, to: edgeVV(s, V3, V5) })).toBe('A ship built this turn cannot move');
  });

  it('only a ship with an open end (not touching own ships/buildings at both ends)', () => {
    const { s, e1, e2, V3, V5 } = route();
    const to = edgeVV(s, V3, V5);
    expect(expectFail(s, 0, { type: 'moveShip', from: e2, to })).toBe('Only a ship with an open end can move');
    expect(expectFail(s, 0, { type: 'moveShip', from: e1, to })).toBe('Only a ship with an open end can move');
    expect(expectFail(s, 1, { type: 'moveShip', from: e1, to })).toBe('It is not your turn');
  });

  it('not a ship in a line linking two own buildings, even if an opponent building interrupts it', () => {
    const { s, e1, e2, e3, V2, V4 } = route();
    placeBuilding(s, 0, V4);
    expect(shipLinksBuildings(s, 0, e3)).toBe(true);
    expect(expectFail(s, 0, { type: 'moveShip', from: e3, to: side(s, 0, 0, 1) })).toMatch(/open end|links two/);
    placeBuilding(s, 1, V2);
    expect(shipLinksBuildings(s, 0, e1)).toBe(true);
    expect(shipLinksBuildings(s, 0, e2)).toBe(true);
    // Without the far building, the line ends in open sea.
    delete s.buildings[V4];
    expect(shipLinksBuildings(s, 0, e3)).toBe(false);
  });

  it('the moved ship cannot connect through its own old spot', () => {
    const { s, e3, V4 } = route();
    const beyond = boardGraph(s.board).vertices[V4].edges.find((e) => e !== e3 && isShipEdge(s, e))!;
    expect(expectFail(s, 0, { type: 'moveShip', from: e3, to: beyond })).toBe('Ship must connect to your ship or building');
    expect(expectFail(s, 0, { type: 'moveShip', from: e3, to: e3 })).toBe('Move the ship to a different edge');
  });

  it('not to or from an edge of the pirate hex', () => {
    const { s, e3, V3, V5 } = route();
    s.board.pirateHex = hexAt(s, 0, 1); // e2 and e3 border it
    expect(expectFail(s, 0, { type: 'moveShip', from: e3, to: edgeVV(s, V3, V5) })).toBe('Ships next to the pirate cannot move');
    s.board.pirateHex = hexAt(s, 1, 0); // V3–V5 borders (0,0) and (1,0)
    expect(expectFail(s, 0, { type: 'moveShip', from: e3, to: edgeVV(s, V3, V5) })).toMatch(/pirate/);
  });

  it('not someone else\'s ship', () => {
    const { s, e3, V3, V5 } = route();
    s.ships![e3] = 1;
    expect(expectFail(s, 0, { type: 'moveShip', from: e3, to: edgeVV(s, V3, V5) })).toBe('That is not your ship');
  });
});

describe('seafarers: Longest Route', () => {
  /** 3 roads inland from V1 and 2 ships out to sea from V1. */
  function mixed(withBuilding: 0 | 1 | null) {
    const s = sfGame();
    const { V1, e1, e2 } = spots(s);
    const Vx = vertexOf(s, [[-1, 0], [-1, 1], [-2, 1]]);
    const Vy = vertexOf(s, [[-1, 0], [-2, 1], [-2, 0]]);
    const Vz = vertexOf(s, [[-1, 0], [-2, 0], [-1, -1]]);
    for (const e of [edgeVV(s, V1, Vx), edgeVV(s, Vx, Vy), edgeVV(s, Vy, Vz)]) placeRoadDirect(s, 0, e);
    placeShipDirect(s, 0, e1);
    placeShipDirect(s, 0, e2);
    if (withBuilding !== null) placeBuilding(s, withBuilding, V1);
    return s;
  }

  it('roads and ships join at an own building', () => {
    expect(longestRoadLength(mixed(0), 0)).toBe(5);
  });

  it('roads and ships do not join without a building', () => {
    expect(longestRoadLength(mixed(null), 0)).toBe(3);
  });

  it('an opponent building breaks the route', () => {
    expect(longestRoadLength(mixed(1), 0)).toBe(3);
  });

  it('building a ship can take Longest Route', () => {
    let s = mixed(0);
    s.ships = {};
    s.players[0].shipsBuilt = 0;
    placeShipDirect(s, 0, spots(s).e1);
    setResources(s, 0, { lumber: 1, wool: 1 });
    s = act(s, 0, { type: 'buildShip', edge: spots(s).e2 });
    expect(s.longestRoad.holder).toBe(0);
    expect(s.longestRoad.lengths[0]).toBe(5);
  });
});

describe('seafarers: the pirate', () => {
  function seven(): GameState {
    const s = sfGame(3, 'PRE_ROLL');
    const { V1, e1, e2 } = spots(s);
    placeBuilding(s, 1, V1);
    placeShipDirect(s, 1, e1);
    placeShipDirect(s, 1, e2);
    setResources(s, 1, { ore: 1 });
    return rollTo(s, 7);
  }

  it('on a 7 the pirate moves to a sea hex and steals from a ship owner there', () => {
    const s = seven();
    expect(s.phase).toBe('ROBBER_MOVE');
    const robber = s.board.robberHex;
    const next = act(s, 0, { type: 'movePirate', hex: hexAt(s, 0, 1) });
    expect(next.board.pirateHex).toBe(hexAt(s, 0, 1));
    expect(next.board.robberHex).toBe(robber);
    expect(next.players[0].resources.ore).toBe(1);
    expect(next.players[1].resources.ore).toBe(0);
    expect(next.phase).toBe('MAIN_ACTIONS');
    expect(next.log.some((l) => l.key === 'pirateMoved')).toBe(true);
  });

  it('no ships there: nothing to steal', () => {
    const s = seven();
    const next = act(s, 0, { type: 'movePirate', hex: hexAt(s, 3, 0) });
    expect(next.phase).toBe('MAIN_ACTIONS');
    expect(next.players[1].resources.ore).toBe(1);
  });

  it('several ship owners: choose the victim', () => {
    const s = seven();
    placeShipDirect(s, 2, spots(s).e3);
    setResources(s, 2, { wool: 1 });
    const next = act(s, 0, { type: 'movePirate', hex: hexAt(s, 0, 1) });
    expect(next.phase).toBe('ROBBER_STEAL');
    expect(next.stealCandidates).toEqual([1, 2]);
  });

  it('pirate only on the sea, to a new hex; robber only on land', () => {
    const s = seven();
    expect(expectFail(s, 0, { type: 'movePirate', hex: hexAt(s, -1, 0) })).toBe('The pirate must move to a sea hex');
    expect(expectFail(s, 0, { type: 'movePirate', hex: s.board.pirateHex! })).toBe('The pirate must move to a different hex');
    expect(expectFail(s, 0, { type: 'moveRobber', hex: hexAt(s, 0, 0) })).toBe('The robber must stay on land');
    expect(expectFail(s, 1, { type: 'movePirate', hex: hexAt(s, 0, 1) })).toBe('It is not your turn');
  });

  it('a Knight may move the pirate', () => {
    let s = sfGame(3);
    s.players[0].devCards.push({ type: 'knight', boughtTurn: 0 });
    s = act(s, 0, { type: 'playKnight' });
    s = act(s, 0, { type: 'movePirate', hex: hexAt(s, 0, 1) });
    expect(s.phase).toBe('MAIN_ACTIONS');
    expect(s.players[0].knightsPlayed).toBe(1);
  });

  it('the base game has no pirate', () => {
    let s = mainPhaseGame(2);
    s.players[0].devCards.push({ type: 'knight', boughtTurn: 0 });
    s = act(s, 0, { type: 'playKnight' });
    expect(expectFail(s, 0, { type: 'movePirate', hex: 0 })).toBe('There is no pirate in this game');
  });
});

describe('seafarers: gold fields', () => {
  /** P0 settlement on the gold hex (top corner), P1 city on its bottom corner. Gold = 10. */
  function goldGame(): GameState {
    const s = sfGame(2, 'PRE_ROLL');
    const G = boardGraph(s.board);
    const gold = G.hexes[hexAt(s, 2, 0)];
    placeBuilding(s, 0, gold.vertices[0]);
    placeBuilding(s, 1, gold.vertices[3], 'city');
    return s;
  }

  it('production: 1 of choice per settlement, 2 per city; everyone chooses (not only the active player)', () => {
    let s = rollTo(goldGame(), 10);
    expect(s.phase).toBe('GOLD_CHOICE');
    expect(s.pendingGold).toEqual({ 0: 1, 1: 2 });
    expect(s.log.filter((l) => l.key === 'goldOwed').length).toBe(2);
    expect(expectFail(s, 0, { type: 'endTurn' })).toMatch(/GOLD_CHOICE/);
    expect(expectFail(s, 1, { type: 'chooseGold', resources: { lumber: 1, brick: 0, wool: 0, grain: 0, ore: 0 } })).toBe('Choose exactly 2 resources');
    s = act(s, 1, { type: 'chooseGold', resources: { lumber: 0, brick: 0, wool: 0, grain: 1, ore: 1 } });
    expect(s.phase).toBe('GOLD_CHOICE');
    expect(expectFail(s, 1, { type: 'chooseGold', resources: { lumber: 1, brick: 0, wool: 0, grain: 0, ore: 0 } })).toBe('You have no gold to choose');
    s = act(s, 0, { type: 'chooseGold', resources: { lumber: 0, brick: 1, wool: 0, grain: 0, ore: 0 } });
    expect(s.phase).toBe('MAIN_ACTIONS');
    expect(s.players[0].resources.brick).toBe(1);
    expect(s.players[1].resources).toMatchObject({ grain: 1, ore: 1 });
    expect(s.lastRoll!.gains[1]).toMatchObject({ grain: 1, ore: 1 });
    expect(s.log.at(-1)).toMatchObject({ key: 'goldChosen', params: { p: 0 } });
  });

  it('bank shortage: take only what the bank has; an empty bank ends the choice', () => {
    let s = goldGame();
    for (const r of ['lumber', 'brick', 'wool', 'grain'] as const) s.bank[r] = 0;
    s.bank.ore = 1;
    s = rollTo(s, 10);
    expect(expectFail(s, 1, { type: 'chooseGold', resources: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 2 } })).toBe('Choose exactly 1 resources');
    expect(expectFail(s, 1, { type: 'chooseGold', resources: { lumber: 1, brick: 0, wool: 0, grain: 0, ore: 0 } })).toBe('The bank does not have those resources');
    s = act(s, 1, { type: 'chooseGold', resources: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 1 } });
    expect(s.phase).toBe('MAIN_ACTIONS');
    expect(s.pendingGold).toEqual({});
  });

  it('an empty bank skips the gold choice', () => {
    let s = goldGame();
    for (const r of ['lumber', 'brick', 'wool', 'grain', 'ore'] as const) s.bank[r] = 0;
    s = rollTo(s, 10);
    expect(s.phase).toBe('MAIN_ACTIONS');
  });

  it('the robber blocks a gold field', () => {
    const s0 = goldGame();
    s0.board.robberHex = hexAt(s0, 2, 0);
    expect(rollTo(s0, 10).phase).toBe('MAIN_ACTIONS');
  });

  it('setup: a second settlement next to gold gives 1 resource of choice before the road', () => {
    let s = sfGame(2, 'INITIAL_PLACEMENT');
    s.board.startRegions = undefined;
    const { V1 } = spots(s);
    s = act(s, 0, { type: 'placeSetupSettlement', vertex: V1 });
    s = act(s, 0, { type: 'placeSetupRoad', edge: spots(s).e1, ship: true });
    s = act(s, 1, { type: 'placeSetupSettlement', vertex: vertexOf(s, [[-2, 0], [-1, -1], [-2, -1]]) });
    s = act(s, 1, { type: 'placeSetupRoad', edge: side(s, -2, 0, 1) });
    // P1's second settlement, on the gold hex's top corner.
    s = act(s, 1, { type: 'placeSetupSettlement', vertex: goldTop(s) });
    expect(s.phase).toBe('GOLD_CHOICE');
    expect(s.pendingGold).toEqual({ 1: 1 });
    expect(expectFail(s, 1, { type: 'placeSetupRoad', edge: side(s, 2, 0, 1) })).toMatch(/GOLD_CHOICE/);
    s = act(s, 1, { type: 'chooseGold', resources: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 1 } });
    expect(s.phase).toBe('INITIAL_PLACEMENT');
    expect(s.players[1].resources.ore).toBe(1);
    s = act(s, 1, { type: 'placeSetupRoad', edge: side(s, 2, 0, 1), ship: true });
    expect(s.ships![side(s, 2, 0, 1)]).toBe(1);
    expect(s.currentPlayer).toBe(0);
  });
});

describe('seafarers: setup ships and Road Building', () => {
  it('a coastal starting settlement may take a ship instead of the road', () => {
    let s = sfGame(2, 'INITIAL_PLACEMENT');
    const { V1, e1, e2 } = spots(s);
    s = act(s, 0, { type: 'placeSetupSettlement', vertex: V1 });
    expect(expectFail(s, 0, { type: 'placeSetupRoad', edge: side(s, -1, 0, 5), ship: true })).toBe('The ship must touch the settlement you just placed, on a sea edge');
    expect(expectFail(s, 0, { type: 'placeSetupRoad', edge: e2, ship: true })).toBe('The ship must touch the settlement you just placed, on a sea edge');
    s = act(s, 0, { type: 'placeSetupRoad', edge: e1, ship: true });
    expect(s.ships).toEqual({ [e1]: 0 });
    expect(s.players[0].shipsBuilt).toBe(1);
    expect(s.players[0].roadsBuilt).toBe(0);
    expect(s.currentPlayer).toBe(1);
  });

  it('Road Building: 1 road + 1 ship, or 2 ships', () => {
    let s = sfGame();
    const { V1, e1, e2 } = spots(s);
    placeBuilding(s, 0, V1);
    s.players[0].devCards.push({ type: 'roadBuilding', boughtTurn: 0 }, { type: 'roadBuilding', boughtTurn: 0 });
    s = act(s, 0, { type: 'playRoadBuilding' });
    expect(s.freeRoads).toBe(2);
    s = act(s, 0, { type: 'placeFreeRoad', edge: e1, ship: true });
    expect(s.log.at(-1)!.key).toBe('placedFreeShip');
    s = act(s, 0, { type: 'placeFreeRoad', edge: side(s, -1, 0, 5) });
    expect(s.freeRoads).toBe(0);
    expect([s.players[0].roadsBuilt, s.players[0].shipsBuilt]).toEqual([1, 1]);
    s = act(s, 0, { type: 'endTurn' });
    s.phase = 'MAIN_ACTIONS';
    s = act(s, 1, { type: 'endTurn' });
    s.phase = 'MAIN_ACTIONS';
    s = act(s, 0, { type: 'playRoadBuilding' });
    s = act(s, 0, { type: 'placeFreeRoad', edge: e2, ship: true });
    s = act(s, 0, { type: 'placeFreeRoad', edge: spots(s).e3, ship: true });
    expect(s.players[0].shipsBuilt).toBe(3);
    expect(s.newShips).toContain(spots(s).e3);
  });

  it('Road Building with only ships possible still gives 2 free pieces', () => {
    let s = sfGame();
    const { V1 } = spots(s);
    placeBuilding(s, 0, V1);
    s.players[0].roadsBuilt = 15;
    s.players[0].devCards.push({ type: 'roadBuilding', boughtTurn: 0 });
    s = act(s, 0, { type: 'playRoadBuilding' });
    expect(s.freeRoads).toBe(2);
  });
});

describe('seafarers: views and old saves', () => {
  it('ships, pirate and gold are public', () => {
    const s = sfGame();
    const { e1, V1 } = spots(s);
    placeBuilding(s, 0, V1);
    placeShipDirect(s, 0, e1);
    const v = getPlayerView(s, 1);
    expect(v.ships).toEqual({ [e1]: 0 });
    expect(v.board.pirateHex).toBe(s.board.pirateHex);
    expect(v.players[0].shipsBuilt).toBe(1);
  });

  it('a base save without the new fields still plays', () => {
    let s = mainPhaseGame(2);
    expect(s.ships).toBeUndefined();
    expect(getPlayerView(s, 0).players[0]).toMatchObject({ shipsBuilt: 0, vpTokens: 0, bonusRegions: [] });
    s = act(s, 0, { type: 'endTurn' });
    expect(s.shipMoved).toBeUndefined();
  });
});
