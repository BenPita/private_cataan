import { describe, expect, it } from 'vitest';
import {
  SEAFARERS_MOD,
  applyAction,
  availableWonders,
  boardGraph,
  createGame,
  modFor,
  wonderBlock,
  type GameState,
} from '../src';
import { act, completeOrderRoll, playBotGame } from './helpers';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const }));
const isRed = (n: number | null) => n === 6 || n === 8;

function game(scenario: string, n = 6, seed = 7): GameState {
  return completeOrderRoll(createGame(players(n), seed, { mod: 'seafarers', scenario }));
}

const SCENARIOS = Object.keys(SEAFARERS_MOD.scenarios!);

describe('Seafarers 5–6: every scenario', () => {
  for (const id of SCENARIOS) {
    for (const n of [5, 6]) {
      it(`${id}, ${n} players: 5–6 map, bank 24, paired players, 6 colours`, () => {
        const s = game(id, n);
        const mod = modFor(s);
        expect(mod.pairedPlayers).toBe(true);
        expect(s.board.layout).toBe(`sf-${id}-6p`);
        expect(s.bank.ore).toBe(24);
        expect(new Set(s.players.map((p) => p.color)).size).toBe(n);
        expect(s.config.victoryTarget).toBe(SEAFARERS_MOD.scenarios![id].victoryTarget);
      });
    }
  }
});

describe('Seafarers 5–6: scenario details', () => {
  it('New Shores: the main island is dealt (CATAN 5–6 hexes, no red neighbours, robber on a desert)', () => {
    const boards = [1, 2, 3].map((seed) => game('newShores', 6, seed).board);
    const main = (b: GameState['board']) => b.hexes.filter((h) => h.region === 'main');
    expect(main(boards[0]).map((h) => h.terrain).join()).not.toBe(main(boards[1]).map((h) => h.terrain).join());
    for (const b of boards) {
      const G = boardGraph(b);
      expect(main(b)).toHaveLength(30);
      expect(main(b).filter((h) => h.terrain === 'desert')).toHaveLength(2);
      expect(b.hexes[b.robberHex].terrain).toBe('desert');
      for (const h of b.hexes) if (isRed(h.number)) expect(G.hexes[h.id].neighbors.some((x) => isRed(b.hexes[x].number))).toBe(false);
    }
  });

  it('Fog Islands: 18 face-down hexes and 14 discs', () => {
    const s = game('fogIslands', 5);
    expect(s.fogStack!.hexes).toHaveLength(18);
    expect(s.fogStack!.numbers).toHaveLength(14);
  });

  it('Forgotten Tribe: printed port types stay; 6 face-down cards', () => {
    const s = game('forgottenTribe', 6);
    const ports = Object.values(s.board.edgeItems!).filter((i) => i.kind === 'port');
    expect(ports).toHaveLength(8);
    expect(Object.keys(s.edgeDevs!)).toHaveLength(6);
  });

  it('Pirate Islands: 6 fortresses (5 without purple), 25 Knights, no attack on the "!" hex', () => {
    const six = game('pirateIslands', 6);
    expect(six.board.fortresses).toHaveLength(6);
    expect(six.devDeck.filter((c) => c === 'knight')).toHaveLength(25);
    const five = game('pirateIslands', 5);
    expect(five.board.fortresses).toHaveLength(5);
    // the purple slot's fortress is not on the board with 5 players
    expect(five.board.fortresses!.map((f) => f.vertex)).not.toContain(six.board.fortresses![5].vertex);
    // fleet stops on the "!" hex: no attack even with buildings around it
    const s = six;
    s.phase = 'PRE_ROLL';
    s.setup = null;
    s.turn = 3;
    const path = s.board.pirateFleet!;
    const safe = path.indexOf(s.board.pirateSafe!);
    for (let seed = 1; seed < 5000; seed++) {
      const start = { ...s, rng: seed, board: { ...s.board, pirateHex: path[(safe - 1 + path.length) % path.length] } };
      const res = applyAction(start, s.currentPlayer, { type: 'rollDice' });
      if (!res.ok || Math.min(...res.state.lastRoll!.dice) !== 1) continue;
      expect(res.state.board.pirateHex).toBe(s.board.pirateSafe);
      expect(res.state.log.some((l) => ['fleetRaid', 'fleetRepelled', 'fleetTie'].includes(l.key))).toBe(false);
      return;
    }
    throw new Error('no seed');
  });

  it('Wonders: 7 wonders incl. Lighthouse and Great Library; 3–4 player games keep 5', () => {
    const s = game('wondersOfCatan', 6);
    expect(availableWonders(s.board)).toEqual(['castle', 'monument', 'bridge', 'theater', 'wall', 'lighthouse', 'library']);
    expect(availableWonders(game('wondersOfCatan', 4).board)).not.toContain('lighthouse');
    expect(wonderBlock(s, 0, 'lighthouse', 0)).toMatch(/Lighthouse/);
    s.buildings[s.board.wonderSpots!.lighthouse![0]] = { owner: 0, type: 'settlement' };
    expect(wonderBlock(s, 0, 'lighthouse', 0)).toBeNull();
    expect(wonderBlock(s, 0, 'library', 0)).toMatch(/2 cities/);
  });

  it('New World: 63 hexes, 39 discs, no red disc on gold, 11 ports', () => {
    for (const seed of [1, 2, 3]) {
      const b = game('newWorld', 6, seed).board;
      expect(b.hexes).toHaveLength(63);
      expect(b.hexes.filter((h) => h.number !== null)).toHaveLength(39);
      expect(b.hexes.filter((h) => h.terrain === 'gold' && isRed(h.number))).toHaveLength(0);
      expect(b.harbors).toHaveLength(11);
    }
  });

  it('Player 2 of the paired turn may build ships but not trade with players', () => {
    let s = game('newShores', 5);
    s.phase = 'MAIN_ACTIONS';
    s.setup = null;
    s.turn = 3;
    s.hasRolled = true;
    s = act(s, s.currentPlayer, { type: 'endTurn' });
    expect(s.paired).not.toBeNull();
    const p2 = s.currentPlayer;
    s.players[p2].resources = { lumber: 2, brick: 0, wool: 2, grain: 0, ore: 0 };
    const res = applyAction(s, p2, { type: 'proposeTrade', give: { lumber: 1, brick: 0, wool: 0, grain: 0, ore: 0 }, get: { lumber: 0, brick: 1, wool: 0, grain: 0, ore: 0 }, to: [s.paired!.first] });
    expect(res.ok).toBe(false);
  });
});

describe('Seafarers 5–6: bot games finish', () => {
  for (const id of SCENARIOS) {
    it(`${id}, 6 bots`, () => {
      const { state } = playBotGame(['easy', 'medium', 'hard', 'medium', 'hard', 'easy'], 31, 40000, { mod: 'seafarers', scenario: id });
      expect(state.phase).toBe('GAME_OVER');
    }, 180_000);
  }
  it('pirateIslands, 5 bots', () => {
    const { state } = playBotGame(['easy', 'medium', 'hard', 'medium', 'hard'], 32, 40000, { mod: 'seafarers', scenario: 'pirateIslands' });
    expect(state.phase).toBe('GAME_OVER');
  }, 180_000);
});
