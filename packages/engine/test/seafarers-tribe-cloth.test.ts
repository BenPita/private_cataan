import { describe, expect, it } from 'vitest';
import {
  RESOURCES,
  boardGraph,
  createGame,
  getPlayerView,
  isShipEdge,
  pirateEdges,
  legalPortEdges,
  legalSetupSettlements,
  scenarioFor,
  shipMoveBlock,
  tradeRates,
  victoryPoints,
  type GameState,
} from '../src';
import { act, completeOrderRoll, expectFail, give, playBotGame } from './helpers';
import { across, hexAt, rollTo, side } from './seafarers-helpers';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const }));

function game(scenario: string, n = 3, seed = 7): GameState {
  return completeOrderRoll(createGame(players(n), seed, { mod: 'seafarers', scenario }));
}

/** Skips the setup: `player` is in their Action phase. */
function actionPhase(s: GameState, player = 0): GameState {
  s.phase = 'MAIN_ACTIONS';
  s.setup = null;
  s.turn = 3;
  s.hasRolled = true;
  s.currentPlayer = player;
  return s;
}

/** A ship of `player` next to `edge`, so the next ship may go on `edge` (through vertex `via`). */
function shipNextTo(s: GameState, player: number, edge: string): string {
  const G = boardGraph(s.board);
  for (const via of G.edges[edge].vertices) {
    const other = G.vertices[via].edges.find(
      (e) => e !== edge && !s.board.edgeItems?.[e] && isShipEdge(s, e) && !pirateEdges(s).includes(e),
    );
    if (!other) continue;
    s.ships = { ...(s.ships ?? {}), [other]: player };
    s.players[player].shipsBuilt = (s.players[player].shipsBuilt ?? 0) + 1;
    return via;
  }
  throw new Error('no neighbour edge');
}

/** A coastal vertex of the large island for a test settlement. */
function coastalMainVertex(s: GameState, taken: string[] = []): string {
  const G = boardGraph(s.board);
  return G.vertexIds.find((v) => {
    const hs = G.vertices[v].hexes.map((h) => s.board.hexes[h]);
    return (
      hs.some((h) => h.region === 'main') &&
      hs.some((h) => h.terrain === 'sea') &&
      G.vertices[v].edges.every((e) => !s.board.harbors.some((x) => x.edge === e)) &&
      !taken.includes(v)
    );
  })!;
}

describe('The Forgotten Tribe', () => {
  it('13 VP; starts on the large island; 8 VP tokens, 4 hidden development cards and 6 shuffled ports on the sea', () => {
    for (const n of [3, 4]) {
      const s = game('forgottenTribe', n);
      expect(scenarioFor(s)!.victoryTarget).toBe(13);
      const items = Object.values(s.board.edgeItems!);
      expect(items.filter((i) => i.kind === 'vp')).toHaveLength(8);
      expect(items.filter((i) => i.kind === 'dev')).toHaveLength(4);
      const ports = items.flatMap((i) => (i.kind === 'port' ? [i.type] : [])).sort();
      expect(ports).toEqual(['brick', 'generic', 'grain', 'lumber', 'ore', 'wool']);
      expect(Object.keys(s.edgeDevs!)).toHaveLength(4);
      expect(s.devDeck).toHaveLength(25 - 4);
      expect(s.board.harbors).toHaveLength(0);
      const view = getPlayerView(s, 0);
      expect('edgeDevs' in view).toBe(false);
      const G = boardGraph(s.board);
      for (const v of legalSetupSettlements(s)) {
        const hs = G.vertices[v].hexes.map((h) => s.board.hexes[h]);
        expect(hs.every((h) => h.terrain === 'sea' || h.region === 'main')).toBe(true);
      }
    }
  });

  it('settlements only at hexes with a number disc; the robber only on such hexes', () => {
    const s = actionPhase(game('forgottenTribe'));
    const G = boardGraph(s.board);
    // A spot on a small island, reached by the player's ship.
    const isle = G.vertexIds.find((v) => G.vertices[v].hexes.some((h) => s.board.hexes[h].region === 'isle1'))!;
    const e = G.vertices[isle].edges.find((x) => G.edges[x].hexes.some((h) => s.board.hexes[h].terrain === 'sea'))!;
    s.ships = { [e]: 0 };
    give(s, 0, { lumber: 1, brick: 1, wool: 1, grain: 1 });
    expect(expectFail(s, 0, { type: 'buildSettlement', vertex: isle })).toMatch(/empty spot/);
    s.phase = 'ROBBER_MOVE';
    const desert = s.board.hexes.find((h) => h.terrain === 'desert' && h.id !== s.board.robberHex)!.id;
    expect(expectFail(s, 0, { type: 'moveRobber', hex: desert })).toMatch(/number/);
    const isleHex = hexAt(s, 3, 0);
    expect(expectFail(s, 0, { type: 'moveRobber', hex: isleHex })).toMatch(/number/);
    expect(act(s, 0, { type: 'moveRobber', hex: hexAt(s, 2, 3) }).board.robberHex).toBe(hexAt(s, 2, 3));
  });

  it('a ship on a VP token takes it (+1 VP); on a development card takes it as bought this turn', () => {
    let s = actionPhase(game('forgottenTribe'));
    const vpEdge = Object.keys(s.board.edgeItems!).find((e) => s.board.edgeItems![e].kind === 'vp')!;
    shipNextTo(s, 0, vpEdge);
    give(s, 0, { lumber: 2, wool: 2 });
    const before = victoryPoints(s, 0);
    s = act(s, 0, { type: 'buildShip', edge: vpEdge });
    expect(s.players[0].vpTokens).toBe(1);
    expect(victoryPoints(s, 0)).toBe(before + 1);
    expect(s.board.edgeItems![vpEdge]).toBeUndefined();

    const devEdge = Object.keys(s.board.edgeItems!).find((e) => s.board.edgeItems![e].kind === 'dev')!;
    const card = s.edgeDevs![devEdge];
    shipNextTo(s, 0, devEdge);
    s = act(s, 0, { type: 'buildShip', edge: devEdge });
    expect(s.players[0].devCards).toEqual([{ type: card, boughtTurn: s.turn }]);
    expect(s.edgeDevs![devEdge]).toBeUndefined();
  });

  it('a moved ship also picks up an item', () => {
    let s = actionPhase(game('forgottenTribe'));
    const vpEdge = Object.keys(s.board.edgeItems!).find((e) => s.board.edgeItems![e].kind === 'vp')!;
    const G = boardGraph(s.board);
    const via = shipNextTo(s, 0, vpEdge);
    // A second, loose ship of the same line that can be moved onto the token.
    const first = Object.keys(s.ships!)[0];
    const far = across(s, first, via);
    const loose = G.vertices[far].edges.find(
      (e) => e !== first && isShipEdge(s, e) && !s.board.edgeItems?.[e],
    )!;
    s.ships = { ...s.ships, [loose]: 0 };
    s.players[0].shipsBuilt = 2;
    s.board.pirateHex = hexAt(s, 1, 5);
    s = act(s, 0, { type: 'moveShip', from: loose, to: vpEdge });
    expect(s.players[0].vpTokens).toBe(1);
  });

  it('a captured port waits for a coastal settlement, must be placed before ending the turn, one edge from other ports', () => {
    let s = actionPhase(game('forgottenTribe'));
    // A port whose neighbouring edges are free (not the pirate's, not another item).
    const portEdge = Object.keys(s.board.edgeItems!).find((e) => {
      if (s.board.edgeItems![e].kind !== 'port') return false;
      try {
        shipNextTo(s, 0, e);
        return true;
      } catch {
        return false;
      }
    })!;
    const type = (s.board.edgeItems![portEdge] as { type: string }).type;
    give(s, 0, { lumber: 1, wool: 1 });
    s = act(s, 0, { type: 'buildShip', edge: portEdge });
    expect(s.players[0].heldPorts).toEqual([type]);
    // No building of player 0 yet: nowhere to put it, the turn may end.
    expect(legalPortEdges(s, 0)).toEqual([]);
    expect(act(s, 0, { type: 'endTurn' }).phase).toBe('PRE_ROLL');

    const v = coastalMainVertex(s);
    s.buildings[v] = { owner: 0, type: 'settlement' };
    const spots = legalPortEdges(s, 0);
    expect(spots.length).toBeGreaterThan(0);
    expect(expectFail(s, 0, { type: 'endTurn' })).toMatch(/port/);
    expect(expectFail(s, 0, { type: 'placePort', edge: side(s, 2, 3, 0) })).toMatch(/coastal/);
    s = act(s, 0, { type: 'placePort', edge: spots[0] });
    expect(s.players[0].heldPorts).toEqual([]);
    expect(s.board.harbors).toEqual([{ edge: spots[0], type }]);
    expect(Object.values(tradeRates(s, 0)).some((r) => r < 4)).toBe(true);
    // The next port may not touch this one.
    const G = boardGraph(s.board);
    const used = new Set(G.edges[spots[0]].vertices);
    for (const e of legalPortEdges(s, 0)) expect(G.edges[e].vertices.some((x) => used.has(x))).toBe(false);
  });

  it('bots finish games; VP tokens and cards come off the board', () => {
    for (const n of [3, 4]) {
      const r = playBotGame(Array(n).fill('hard'), 2, 20000, { mod: 'seafarers', scenario: 'forgottenTribe' });
      expect(r.state.phase).toBe('GAME_OVER');
      expect(r.rejected).toBe(0);
      const s = r.state;
      const vpLeft = Object.values(s.board.edgeItems ?? {}).filter((i) => i.kind === 'vp').length;
      expect(vpLeft + s.players.reduce((t, p) => t + (p.vpTokens ?? 0), 0)).toBe(8);
    }
  }, 120_000);
});

describe('Cloth for Catan', () => {
  it('14 VP; 3 starting settlements each, resources only from the third; no Longest Route', () => {
    let s = game('clothForCatan', 3);
    expect(scenarioFor(s)!.victoryTarget).toBe(14);
    expect(s.setup!.order).toEqual([...s.turnOrder, ...[...s.turnOrder].reverse(), ...s.turnOrder]);
    const G = boardGraph(s.board);
    while (s.phase === 'INITIAL_PLACEMENT') {
      const p = s.currentPlayer;
      const step = s.setup!.step;
      const v = legalSetupSettlements(s)[0];
      const before = RESOURCES.reduce((t, r) => t + s.players[p].resources[r], 0);
      s = act(s, p, { type: 'placeSetupSettlement', vertex: v });
      const after = RESOURCES.reduce((t, r) => t + s.players[p].resources[r], 0);
      const producing = G.vertices[v].hexes.filter((h) => s.board.hexes[h].number !== null).length;
      expect(after - before).toBe(step < 6 ? 0 : producing);
      const road = G.vertices[v].edges.find((e) => !s.roads[e] && G.edges[e].hexes.some((h) => s.board.hexes[h].region))!;
      s = act(s, p, { type: 'placeSetupRoad', edge: road });
    }
    expect(s.players.every((p) => p.settlementsBuilt === 3)).toBe(true);
    expect(s.longestRoad.holder).toBeNull();
    expect(s.longestRoad.lengths.every((l) => l === 0)).toBe(true);
  });

  it('no settlement and no robber on the small islands', () => {
    const s = actionPhase(game('clothForCatan'));
    const G = boardGraph(s.board);
    for (const v of legalSetupSettlements(game('clothForCatan'))) {
      expect(G.vertices[v].hexes.some((h) => s.board.hexes[h].region?.startsWith('isle'))).toBe(false);
    }
    s.phase = 'ROBBER_MOVE';
    expect(expectFail(s, 0, { type: 'moveRobber', hex: hexAt(s, 1, 3) })).toMatch(/number/);
  });

  /** Player 0 with a settlement on the coast and ships up to (not onto) the village's last edge. */
  function nearVillage(index: number): { s: GameState; lastEdge: string } {
    const s = actionPhase(game('clothForCatan'));
    const G = boardGraph(s.board);
    const village = s.board.villages![index].vertex;
    // Shortest sea path from a coastal settlement spot to the village.
    const prev = new Map<string, { from: string; edge: string } | null>([[village, null]]);
    const queue = [village];
    let start: string | null = null;
    while (queue.length && !start) {
      const v = queue.shift()!;
      for (const e of G.vertices[v].edges) {
        if (!G.edges[e].hexes.some((h) => s.board.hexes[h].terrain === 'sea')) continue;
        const next = across(s, e, v);
        if (prev.has(next)) continue;
        prev.set(next, { from: v, edge: e });
        if (G.vertices[next].hexes.some((h) => s.board.hexes[h].number !== null)) {
          start = next;
          break;
        }
        queue.push(next);
      }
    }
    s.buildings[start!] = { owner: 0, type: 'settlement' };
    s.players[0].settlementsBuilt = 1;
    let v = start!;
    let lastEdge = '';
    s.board.pirateHex = hexAt(s, 6, 3);
    while (prev.get(v)) {
      const { from, edge } = prev.get(v)!;
      if (from === village) lastEdge = edge;
      else {
        s.ships = { ...(s.ships ?? {}), [edge]: 0 };
        s.players[0].shipsBuilt = (s.players[0].shipsBuilt ?? 0) + 1;
      }
      v = from;
    }
    return { s, lastEdge };
  }

  it('a route to a village opens trade: 1 cloth at once, then 1 per roll of its number; 2 cloth = 1 VP', () => {
    let { s, lastEdge } = nearVillage(0);
    const village = s.board.villages![0];
    give(s, 0, { lumber: 1, wool: 1 });
    s = act(s, 0, { type: 'buildShip', edge: lastEdge });
    expect(s.players[0].villages).toEqual([0]);
    expect(s.players[0].cloth).toBe(1);
    expect(s.board.villages![0].cloth).toBe(4);
    const vp = victoryPoints(s, 0);
    // Next turn: the village's number is rolled.
    s.phase = 'PRE_ROLL';
    s.hasRolled = false;
    s = rollTo(s, village.number);
    expect(s.players[0].cloth).toBe(2);
    expect(s.board.villages![0].cloth).toBe(3);
    expect(victoryPoints(s, 0)).toBe(vp + 1);
  });

  it('an empty village no longer produces; a short one is topped up from the general supply', () => {
    let { s, lastEdge } = nearVillage(0);
    give(s, 0, { lumber: 1, wool: 1 });
    s = act(s, 0, { type: 'buildShip', edge: lastEdge });
    s.players[1].villages = [0];
    s.board.villages![0].cloth = 1;
    s.phase = 'PRE_ROLL';
    s.hasRolled = false;
    const n = s.board.villages![0].number;
    let t = rollTo(s, n);
    expect(t.players[0].cloth! + t.players[1].cloth!).toBe(1 + 2);
    expect(t.board.villages![0].cloth).toBe(0);
    expect(t.clothSupply).toBe(9);
    s.board.villages![0].cloth = 0;
    t = rollTo(s, n);
    expect(t.players[0].cloth).toBe(1);
    expect(t.clothSupply).toBe(10);
  });

  it('ships of a route to a village are closed and cannot move', () => {
    let { s, lastEdge } = nearVillage(0);
    give(s, 0, { lumber: 1, wool: 1 });
    s = act(s, 0, { type: 'buildShip', edge: lastEdge });
    s.newShips = [];
    expect(shipMoveBlock(s, 0, lastEdge)).toMatch(/closed route/);
  });

  it('the pirate moves only after a village route, and may take a cloth token', () => {
    let { s, lastEdge } = nearVillage(0);
    s.phase = 'ROBBER_MOVE';
    const sea = s.board.hexes.find((h) => h.terrain === 'sea' && h.id !== s.board.pirateHex)!.id;
    expect(expectFail(s, 0, { type: 'movePirate', hex: sea })).toMatch(/village/);
    s.phase = 'MAIN_ACTIONS';
    give(s, 0, { lumber: 1, wool: 1 });
    s = act(s, 0, { type: 'buildShip', edge: lastEdge });
    // Player 1 has a ship next to some sea hex and 3 cloth.
    const G = boardGraph(s.board);
    const target = s.board.hexes.find(
      (h) => h.terrain === 'sea' && h.id !== s.board.pirateHex && G.hexes[h.id].edges.every((e) => s.ships?.[e] === undefined),
    )!.id;
    s.ships = { ...s.ships, [G.hexes[target].edges[0]]: 1 };
    s.players[1].cloth = 3;
    s.phase = 'ROBBER_MOVE';
    s = act(s, 0, { type: 'movePirate', hex: target });
    expect(s.phase).toBe('ROBBER_STEAL');
    s = act(s, 0, { type: 'steal', victim: 1, cloth: true });
    expect(s.players[1].cloth).toBe(2);
    expect(s.players[0].cloth).toBe(2);
  });

  it('5 empty villages end the game at the end of the turn: most VP wins, then most cloth', () => {
    const s = actionPhase(game('clothForCatan'));
    s.board.villages!.forEach((v, i) => (v.cloth = i < 5 ? 0 : 3));
    s.players[1].cloth = 4;
    s.players[2].cloth = 5; // same 2 VP as player 1, but more cloth
    const t = act(s, 0, { type: 'endTurn' });
    expect(t.phase).toBe('GAME_OVER');
    expect(t.winner).toBe(2);
  });

  it('bots finish games; cloth is conserved', () => {
    for (const n of [3, 4]) {
      const r = playBotGame(Array(n).fill('hard'), 3, 20000, { mod: 'seafarers', scenario: 'clothForCatan' });
      expect(r.state.phase).toBe('GAME_OVER');
      expect(r.rejected).toBe(0);
      const s = r.state;
      const cloth = s.players.reduce((t, p) => t + (p.cloth ?? 0), 0) + s.board.villages!.reduce((t, v) => t + v.cloth, 0) + s.clothSupply!;
      expect(cloth).toBe(50);
    }
  }, 120_000);
});
