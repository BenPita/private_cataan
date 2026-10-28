import { describe, expect, it } from 'vitest';
import { RESOURCES, chooseBotAction, legalShips, getPlayerView, totalRes, victoryPoints, type BotDifficulty, type GameState } from '../src';
import { placeBuilding, playBotGame } from './helpers';
import { edgeVV, hexAt, sfGame, vertexOf } from './seafarers-helpers';

const LEVELS: BotDifficulty[] = ['easy', 'medium', 'hard'];

function checkInvariants(s: GameState) {
  // Cards are conserved: bank + hands = 19 per resource.
  for (const r of RESOURCES) {
    expect(s.bank[r] + s.players.reduce((n, p) => n + p.resources[r], 0)).toBe(19);
  }
  for (const [i, p] of s.players.entries()) {
    expect(p.shipsBuilt ?? 0).toBe(Object.values(s.ships ?? {}).filter((o) => o === i).length);
    expect(p.shipsBuilt ?? 0).toBeLessThanOrEqual(15);
  }
  // A road and a ship never share an edge.
  for (const e of Object.keys(s.ships ?? {})) expect(s.roads[e]).toBeUndefined();
}

describe('seafarers bots: Heading for New Shores', () => {
  for (const n of [2, 3, 4]) {
    for (const level of LEVELS) {
      it(`${n} ${level} bots finish a game`, () => {
        let ships = 0;
        let bonus = 0;
        for (const seed of [1, 2]) {
          const r = playBotGame(Array(n).fill(level), seed * 100 + n, 12000, { mod: 'seafarers' });
          expect(r.state.phase).toBe('GAME_OVER');
          expect(victoryPoints(r.state, r.state.winner!)).toBeGreaterThanOrEqual(14);
          expect(r.rejected).toBeLessThanOrEqual(3);
          checkInvariants(r.state);
          ships += Object.keys(r.state.ships ?? {}).length;
          bonus += r.state.players.reduce((t, p) => t + (p.vpTokens ?? 0), 0);
        }
        if (level !== 'easy') {
          // Medium and hard bots sail to the small islands for the +2 VP.
          expect(ships).toBeGreaterThan(0);
          expect(bonus).toBeGreaterThan(0);
        }
      }, 120_000);
    }
  }

  it('bots take gold when owed, choosing resources the bank has', () => {
    const s = sfGame(2);
    s.phase = 'GOLD_CHOICE';
    s.pendingGold = { 1: 2 };
    s.goldReturnPhase = 'MAIN_ACTIONS';
    for (const r of RESOURCES) s.bank[r] = 0;
    s.bank.ore = 1;
    for (const level of LEVELS) {
      const a = chooseBotAction(getPlayerView(s, 1), level, () => 0.5);
      expect(a).toEqual({ type: 'chooseGold', resources: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 1 } });
      expect(chooseBotAction(getPlayerView(s, 0), level, () => 0.5)).toBeNull();
    }
    s.bank.lumber = 5;
    s.bank.wool = 5;
    s.bank.ore = 5;
    const a = chooseBotAction(getPlayerView(s, 1), 'medium', () => 0.5);
    expect(a?.type).toBe('chooseGold');
    expect(totalRes((a as { resources: GameState['bank'] }).resources)).toBe(2);
  });

  const V1 = (s: GameState) => vertexOf(s, [[-1, 0], [0, 0], [-1, 1]]);
  const V2 = (s: GameState) => vertexOf(s, [[0, 0], [-1, 1], [0, 1]]);
  const V3 = (s: GameState) => vertexOf(s, [[0, 0], [1, 0], [0, 1]]);
  const V0 = (s: GameState) => vertexOf(s, [[-1, 0], [0, -1], [0, 0]]);
  const V4 = (s: GameState) => vertexOf(s, [[1, 0], [0, 1], [1, 1]]);

  it('build a ship when the sea is the way to the next settlement', () => {
    const s = sfGame(2);
    placeBuilding(s, 0, V1(s), 'city');
    s.ships![edgeVV(s, V1(s), V2(s))] = 0;
    s.players[0].shipsBuilt = 1;
    s.players[0].roadsBuilt = 15; // no roads left: the sea is the only way
    s.players[0].resources.lumber = 1;
    s.players[0].resources.wool = 1;
    s.bank.lumber--;
    s.bank.wool--;
    for (const level of ['medium', 'hard'] as const) {
      const a = chooseBotAction(getPlayerView(s, 0), level, () => 0.5);
      expect(a?.type).toBe('buildShip');
      expect(legalShips(s, 0)).toContain((a as { edge: string }).edge);
    }
  });

  it('move a stray ship to the front of the route', () => {
    const s = sfGame(2);
    placeBuilding(s, 0, V1(s), 'city');
    const stray = edgeVV(s, V1(s), V0(s));
    s.ships![edgeVV(s, V1(s), V2(s))] = 0;
    s.ships![edgeVV(s, V2(s), V3(s))] = 0;
    s.ships![stray] = 0;
    s.players[0].shipsBuilt = 3;
    s.players[0].roadsBuilt = 15;
    for (const level of ['medium', 'hard'] as const) {
      expect(chooseBotAction(getPlayerView(s, 0), level, () => 0.5, {})).toEqual({ type: 'moveShip', from: stray, to: edgeVV(s, V3(s), V4(s)) });
    }
    s.shipMoved = true;
    expect(chooseBotAction(getPlayerView(s, 0), 'hard', () => 0.5, {})).toEqual({ type: 'endTurn' });
  });

  it('send the pirate after the tip of an opponent route when the robber has little to gain', () => {
    const s = sfGame(2);
    s.phase = 'ROBBER_MOVE';
    placeBuilding(s, 1, V1(s));
    s.ships![edgeVV(s, V1(s), V2(s))] = 1;
    s.players[1].shipsBuilt = 1;
    s.players[1].resources.ore = 2;
    s.bank.ore -= 2;
    expect(chooseBotAction(getPlayerView(s, 0), 'hard', () => 0.5)).toEqual({ type: 'movePirate', hex: hexAt(s, 0, 0) });
    expect(chooseBotAction(getPlayerView(s, 0), 'easy', () => 0.5)?.type).toBe('moveRobber');
  });
});
