import { describe, expect, it } from 'vitest';
import {
  applyAction,
  boardGraph,
  createGame,
  fortressOf,
  getPlayerView,
  legalSettlements,
  legalSetupSettlements,
  legalSetupShips,
  legalShips,
  pirateRoute,
  shipMoveBlock,
  victoryPoints,
  wonderBlock,
  type GameState,
} from '../src';
import { act, completeOrderRoll, expectFail, give, placeBuilding, playBotGame } from './helpers';
import { hexAt, vertexOf } from './seafarers-helpers';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const }));

function game(scenario: string, n = 4, seed = 7): GameState {
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

/** Rolls with a seed chosen so the dice match `want` (searches seeds; keeps everything else). */
function rollDice(s: GameState, want: (d: [number, number]) => boolean): GameState {
  for (let seed = 1; seed < 100_000; seed++) {
    const res = applyAction({ ...s, rng: seed }, s.currentPlayer, { type: 'rollDice' });
    if (res.ok && want(res.state.lastRoll!.dice)) return res.state;
  }
  throw new Error('no seed');
}

/** Builds `n` ships along `player`'s route (free of charge). */
function sail(s: GameState, player: number, n: number): GameState {
  for (let i = 0; i < n; i++) {
    const next = legalShips(s, player)[0];
    if (!next) throw new Error('route blocked');
    give(s, player, { lumber: 1, wool: 1 });
    s = act(s, player, { type: 'buildShip', edge: next });
  }
  return s;
}

describe('The Pirate Islands: setup', () => {
  it('4 players: 4 fortresses with 3 lairs, a printed settlement and ship each, Knights instead of VP cards', () => {
    const s = game('pirateIslands', 4);
    expect(s.board.fortresses).toHaveLength(4);
    for (const f of s.board.fortresses!) {
      expect(f.lairs).toBe(3);
      expect(s.buildings[f.start]).toEqual({ owner: f.owner, type: 'settlement' });
      expect(s.ships![f.startShip]).toBe(f.owner);
      expect(boardGraph(s.board).edges[f.startShip].vertices).toContain(f.start);
      expect(s.players[f.owner].settlementsBuilt).toBe(1);
      expect(s.players[f.owner].shipsBuilt).toBe(1);
    }
    expect(s.devDeck.filter((c) => c === 'knight')).toHaveLength(19);
    expect(s.devDeck).not.toContain('victoryPoint');
    expect(s.devDeck).toHaveLength(25);
    expect(s.board.noRobber).toBe(true);
    expect(s.board.pirateHex).toBe(hexAt(s, 2, 6));
    expect(s.board.pirateFleet).toHaveLength(14);
  });

  it('3 players: no white slot, Victory Point cards removed', () => {
    const s = game('pirateIslands', 3);
    expect(s.board.fortresses).toHaveLength(3);
    // slots red, blue, orange: the third player's fortress is at the bottom of the gold field (-1,6)
    expect(s.board.fortresses![2].vertex).toBe(boardGraph(s.board).hexes[hexAt(s, -1, 6)].vertices[3]);
    expect(s.devDeck).toHaveLength(20);
    expect(s.devDeck).not.toContain('victoryPoint');
  });

  it('starting settlements on the main island only; roads, never ships', () => {
    const s = game('pirateIslands', 4);
    const G = boardGraph(s.board);
    for (const v of legalSetupSettlements(s)) {
      expect(G.vertices[v].hexes.some((h) => s.board.hexes[h].region === 'main')).toBe(true);
      expect(G.vertices[v].hexes.every((h) => s.board.hexes[h].region === 'main' || s.board.hexes[h].terrain === 'sea')).toBe(true);
    }
    const v = legalSetupSettlements(s).find((x) => G.vertices[x].hexes.some((h) => s.board.hexes[h].terrain === 'sea'))!;
    expect(legalSetupShips(s, v)).toEqual([]);
  });
});

describe('The Pirate Islands: the line of ships', () => {
  it('only extends the end of the line, one step closer to the beachhead, then to the fortress', () => {
    let s = actionPhase(game('pirateIslands', 4));
    const f = fortressOf(s, 0)!;
    const G = boardGraph(s.board);
    const start = pirateRoute(s, 0)!;
    expect(start.edges).toEqual([f.startShip]);
    const next = legalShips(s, 0);
    expect(next.length).toBeGreaterThan(0);
    for (const e of next) expect(G.edges[e].vertices).toContain(start.end);
    // a ship elsewhere (next to the printed settlement, not at the line's end) is refused
    const elsewhere = G.vertices[f.start].edges.find((e) => e !== f.startShip && !next.includes(e) && G.edges[e].hexes.some((h) => s.board.hexes[h].terrain === 'sea'));
    if (elsewhere) {
      give(s, 0, { lumber: 1, wool: 1 });
      expect(expectFail(s, 0, { type: 'buildShip', edge: elsewhere })).toMatch(/one line/);
    }
    // sail until the fortress: the line passes the beachhead and ends on the fortress
    for (let i = 0; i < 30 && !pirateRoute(s, 0)!.complete; i++) {
      s.board.pirateHex = undefined; // keep the pirate out of the way for this walk
      s = sail(s, 0, 1);
    }
    const route = pirateRoute(s, 0)!;
    expect(route.complete).toBe(true);
    expect(route.beachhead).toBe(true);
    expect(legalShips(s, 0)).toEqual([]);
  });

  it('ships cannot move; settlements only on the main island or the own beachhead', () => {
    let s = actionPhase(game('pirateIslands', 4));
    s.board.pirateHex = undefined;
    const f = fortressOf(s, 0)!;
    expect(shipMoveBlock(s, 0, f.startShip)).toMatch(/cannot move/);
    while (!pirateRoute(s, 0)!.beachhead) s = sail(s, 0, 1);
    expect(legalSettlements(s, 0)).toContain(f.beachhead);
    // another player's beachhead is not a place to settle
    expect(legalSettlements(s, 1)).not.toContain(f.beachhead);
    give(s, 0, { lumber: 1, brick: 1, wool: 1, grain: 1 });
    s = act(s, 0, { type: 'buildSettlement', vertex: f.beachhead });
    expect(s.buildings[f.beachhead]).toEqual({ owner: 0, type: 'settlement' });
  });

  it('a Knight turns the normal ship nearest the start into a warship (no robber, no army)', () => {
    let s = actionPhase(game('pirateIslands', 4));
    s.board.pirateHex = undefined;
    s = sail(s, 0, 2);
    s.players[0].devCards = [{ type: 'knight', boughtTurn: 0 }, { type: 'knight', boughtTurn: 0 }];
    s = act(s, 0, { type: 'playKnight' });
    expect(s.phase).toBe('MAIN_ACTIONS');
    expect(s.warships).toEqual([pirateRoute(s, 0)!.edges[0]]);
    expect(s.players[0].knightsPlayed).toBe(0);
    s.players[0].playedDevThisTurn = false;
    s = act(s, 0, { type: 'playKnight' });
    expect(s.warships).toEqual(pirateRoute(s, 0)!.edges.slice(0, 2));
  });
});

describe('The Pirate Islands: the pirate fleet', () => {
  /** Player 0 has a city next to the hex the fleet reaches with `low` steps. */
  function fleetGame(low: number, warships: number): GameState {
    const s = actionPhase(game('pirateIslands', 4));
    s.phase = 'PRE_ROLL';
    s.hasRolled = false;
    // start the fleet so `low` steps end next to the main island (path index 10 = hex (4,2))
    const path = s.board.pirateFleet!;
    s.board.pirateHex = path[10 - low];
    const target = path[10];
    const G = boardGraph(s.board);
    const v = G.hexes[target].vertices.find((x) => G.vertices[x].hexes.some((h) => s.board.hexes[h].region === 'main') && !s.buildings[x])!;
    // clear printed buildings next to the target so only player 0 is attacked
    for (const x of G.hexes[target].vertices) if (s.buildings[x]) delete s.buildings[x];
    placeBuilding(s, 0, v, 'city');
    s.warships = Object.keys(s.ships!).filter((e) => s.ships![e] === 0).slice(0, warships);
    while (s.warships.length < warships) {
      const e = `fake${s.warships.length}`;
      s.ships![e] = 0;
      s.warships.push(e);
    }
    s.players[0].resources = { lumber: 3, brick: 3, wool: 3, grain: 0, ore: 0 };
    return s;
  }

  it('sails the lower die and robs a weaker player of 1 card + 1 per city', () => {
    const s = rollDice(fleetGame(2, 0), (d) => Math.min(...d) === 2 && d[0] + d[1] !== 7);
    expect(s.board.pirateHex).toBe(s.board.pirateFleet![10]);
    expect(s.log.some((l) => l.key === 'fleetRaid' && l.params.p === 0 && l.params.n === 2)).toBe(true);
  });

  it('a stronger player takes 1 resource of their choice', () => {
    let s = rollDice(fleetGame(1, 2), (d) => Math.min(...d) === 1 && d[0] + d[1] !== 7);
    expect(s.phase).toBe('GOLD_CHOICE');
    expect(s.pendingGold?.[0]).toBeGreaterThanOrEqual(1);
    expect(s.log.some((l) => l.key === 'fleetRepelled' && l.params.p === 0)).toBe(true);
    s = act(s, 0, { type: 'chooseGold', resources: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: s.pendingGold![0] } });
    expect(s.phase).toBe('MAIN_ACTIONS');
  });

  it('a tie does nothing', () => {
    const s = rollDice(fleetGame(3, 3), (d) => Math.min(...d) === 3 && d[0] + d[1] !== 7);
    expect(s.log.some((l) => l.key === 'fleetTie' && l.params.p === 0)).toBe(true);
  });

  it('a 7 lets the roller steal from any player (no robber)', () => {
    const s0 = actionPhase(game('pirateIslands', 4));
    s0.phase = 'PRE_ROLL';
    s0.hasRolled = false;
    s0.players[3].resources.ore = 2;
    const s = rollDice(s0, (d) => d[0] + d[1] === 7);
    expect(['ROBBER_STEAL', 'GOLD_CHOICE', 'ROBBER_DISCARD']).toContain(s.phase);
    if (s.phase === 'ROBBER_STEAL') {
      expect(s.stealCandidates).toContain(3);
      const after = act(s, 0, { type: 'steal', victim: 3 });
      expect(after.players[0].resources.ore).toBeGreaterThanOrEqual(1);
    }
    expect(expectFail(s, 0, { type: 'movePirate', hex: s.board.pirateFleet![5] })).toBeTruthy();
  });
});

describe('The Pirate Islands: conquering the fortress', () => {
  function atFortress(warships: number): GameState {
    let s = actionPhase(game('pirateIslands', 4));
    s.board.pirateHex = undefined;
    while (!pirateRoute(s, 0)!.complete) s = sail(s, 0, 1);
    s.warships = pirateRoute(s, 0)!.edges.slice(0, warships);
    return s;
  }

  function endTurnWithDie(s: GameState, die: (n: number) => boolean): GameState {
    for (let seed = 1; seed < 100_000; seed++) {
      const res = applyAction({ ...s, rng: seed }, 0, { type: 'endTurn' });
      if (!res.ok) throw new Error(res.error);
      const entry = res.state.log.find((l) => l.key === 'fortressAttack');
      if (entry && die(entry.params.n!)) return res.state;
    }
    throw new Error('no seed');
  }

  it('more warships than the die removes a lair, and the turn ends', () => {
    const s = endTurnWithDie(atFortress(6), () => true);
    expect(fortressOf(s, 0)!.lairs).toBe(2);
    expect(s.currentPlayer).not.toBe(0);
  });

  it('fewer warships than the die: the 2 ships nearest the fortress are lost; a tie loses 1', () => {
    const base = atFortress(0);
    const len = pirateRoute(base, 0)!.edges.length;
    const lost = endTurnWithDie(base, (n) => n > 0);
    expect(pirateRoute(lost, 0)!.edges).toHaveLength(len - 2);
    expect(lost.players[0].shipsBuilt).toBe(len - 2);
    const tie = endTurnWithDie(atFortress(2), (n) => n === 2);
    expect(pirateRoute(tie, 0)!.edges).toHaveLength(len - 1);
  });

  it('the third win captures the fortress; 10 VP then win', () => {
    let s = atFortress(6);
    fortressOf(s, 0)!.lairs = 1;
    s = endTurnWithDie(s, () => true);
    const f = fortressOf(s, 0)!;
    expect(f.lairs).toBe(0);
    expect(s.buildings[f.vertex]).toEqual({ owner: 0, type: 'settlement' });
    // 10 VP without the fortress does not win; with it, it does
    const t = actionPhase(game('pirateIslands', 4));
    t.players[0].vpTokens = 9;
    t.board.pirateHex = undefined;
    give(t, 0, { grain: 2, ore: 3 });
    const noFortress = act(t, 0, { type: 'buildCity', vertex: fortressOf(t, 0)!.start });
    expect(noFortress.winner).toBeNull();
    fortressOf(t, 0)!.lairs = 0;
    give(t, 0, { grain: 2, ore: 3 });
    const won = act(t, 0, { type: 'buildCity', vertex: fortressOf(t, 0)!.start });
    expect(won.winner).toBe(0);
  });
});

describe('The Wonders of Catan', () => {
  it('no pirate; starting settlements not on wonder or "X" markers', () => {
    const s = game('wondersOfCatan', 4);
    expect(s.board.pirateHex).toBeUndefined();
    const spots = s.board.wonderSpots!;
    const legal = legalSetupSettlements(s);
    for (const v of [...spots.wall, ...spots.bridge, ...spots.blocked]) expect(legal).not.toContain(v);
    expect(s.board.hexes[s.board.robberHex].terrain).toBe('desert');
  });

  it('claim requirements, one wonder each, 4 levels; finishing wins', () => {
    let s = actionPhase(game('wondersOfCatan', 4));
    const wall = s.board.wonderSpots!.wall[0];
    expect(wonderBlock(s, 0, 'wall', 0)).toMatch(/Great Wall/);
    expect(expectFail(s, 0, { type: 'claimWonder', wonder: 'wall' })).toMatch(/Great Wall/);
    placeBuilding(s, 0, wall);
    s = act(s, 0, { type: 'claimWonder', wonder: 'wall' });
    expect(s.players[0].wonder).toEqual({ id: 'wall', level: 0 });
    expect(expectFail(s, 0, { type: 'claimWonder', wonder: 'theater' })).toMatch(/one wonder/);
    s.currentPlayer = 1;
    placeBuilding(s, 1, s.board.wonderSpots!.wall[2]);
    expect(expectFail(s, 1, { type: 'claimWonder', wonder: 'wall' })).toMatch(/already claimed/);
    s.currentPlayer = 0;
    for (let level = 1; level <= 4; level++) {
      give(s, 0, { brick: 3, lumber: 1, grain: 1 });
      s = act(s, 0, { type: 'buildWonder' });
      expect(s.players[0].wonder!.level).toBe(level);
    }
    expect(s.winner).toBe(0);
    expect(getPlayerView(s, 1).players[0].wonder).toEqual({ id: 'wall', level: 4 });
  });

  it('10 VP alone does not win; 10 VP and the highest wonder level does', () => {
    let s = actionPhase(game('wondersOfCatan', 4));
    s.players[0].vpTokens = 8;
    const G = boardGraph(s.board);
    const v = legalSetupSettlements(s)[0];
    placeBuilding(s, 0, v);
    // a road so a second settlement could connect is not needed: build a city instead
    give(s, 0, { grain: 2, ore: 3 });
    s = act(s, 0, { type: 'buildCity', vertex: v });
    expect(victoryPoints(s, 0)).toBe(10);
    expect(s.winner).toBeNull();
    s.players[0].wonder = { id: 'theater', level: 0 };
    s.players[1].wonder = { id: 'castle', level: 1 };
    give(s, 0, { brick: 1, lumber: 1, wool: 3 });
    s = act(s, 0, { type: 'buildWonder' });
    expect(s.winner).toBeNull(); // tied at level 1
    give(s, 0, { brick: 1, lumber: 1, wool: 3 });
    s = act(s, 0, { type: 'buildWonder' });
    expect(s.winner).toBe(0);
    void G;
  });

  it('Grand Castle needs a city and 6 VP; Grand Theater 2 cities; the bridge a building at a bridge marker', () => {
    const s = actionPhase(game('wondersOfCatan', 4));
    const [a, b] = legalSetupSettlements(s).filter((v, i, all) => i === 0 || !boardGraph(s.board).vertices[all[0]].neighbors.includes(v));
    placeBuilding(s, 0, a, 'city');
    expect(wonderBlock(s, 0, 'castle', 5)).toMatch(/Castle/);
    expect(wonderBlock(s, 0, 'castle', 6)).toBeNull();
    expect(wonderBlock(s, 0, 'theater', 6)).toMatch(/2 cities/);
    placeBuilding(s, 0, b, 'city');
    expect(wonderBlock(s, 0, 'theater', 6)).toBeNull();
    expect(wonderBlock(s, 0, 'bridge', 6)).toMatch(/Bridge/);
    placeBuilding(s, 0, s.board.wonderSpots!.bridge[1]);
    expect(wonderBlock(s, 0, 'bridge', 6)).toBeNull();
  });

  it('+1 VP for the first settlement on each small island', () => {
    const s = actionPhase(game('wondersOfCatan', 4));
    const v = vertexOf(s, [[2, 0], [3, 0]]);
    s.ships = { ...s.ships, [boardGraph(s.board).vertices[v].edges[0]]: 0 };
    give(s, 0, { lumber: 1, brick: 1, wool: 1, grain: 1 });
    const after = act(s, 0, { type: 'buildSettlement', vertex: v });
    expect(after.players[0].vpTokens).toBe(1);
  });
});

describe('Seafarers scenarios 7 and 8: bot games finish', () => {
  for (const scenario of ['pirateIslands', 'wondersOfCatan']) {
    for (const n of [3, 4]) {
      it(`${scenario}, ${n} bots`, () => {
        const levels = (['easy', 'medium', 'hard', 'medium'] as const).slice(0, n);
        const { state } = playBotGame([...levels], 11 + n, 30000, { mod: 'seafarers', scenario });
        expect(state.phase).toBe('GAME_OVER');
      }, 120_000);
    }
  }
});
