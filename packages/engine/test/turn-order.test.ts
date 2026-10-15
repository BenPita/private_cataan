import { describe, expect, it } from 'vitest';
import { createGame, getPlayerView, type GameState } from '../src';
import { act, completeOrderRoll, completeSetup, expectFail } from './helpers';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const }));
const sum = (s: GameState, p: number) => {
  const rolls = s.orderRoll!.history.filter((h) => h.player === p);
  return rolls.map((r) => r.dice[0] + r.dice[1]);
};

describe('opening roll for turn order', () => {
  it('starts in ORDER_ROLL and blocks everything else', () => {
    const s = createGame(players(3), 1);
    expect(s.phase).toBe('ORDER_ROLL');
    expect(expectFail(s, 0, { type: 'placeSetupSettlement', vertex: 'v20' })).toMatch(/ORDER_ROLL/);
    expect(expectFail(s, 0, { type: 'rollDice' })).toBeTruthy();
  });

  it('lets each player roll once per round, in any order', () => {
    let s = createGame(players(3), 1);
    s = act(s, 2, { type: 'rollForOrder' });
    expect(expectFail(s, 2, { type: 'rollForOrder' })).toMatch(/already rolled|do not need/);
    expect(expectFail(s, 7, { type: 'rollForOrder' })).toBeTruthy();
  });

  it('orders players by their roll, highest first, for many seeds and sizes', () => {
    for (const n of [2, 3, 4]) {
      for (let seed = 1; seed <= 150; seed++) {
        const s = completeOrderRoll(createGame(players(n), seed));
        expect(s.phase).toBe('INITIAL_PLACEMENT');
        expect([...s.turnOrder].sort()).toEqual(players(n).map((_, i) => i));
        expect(s.currentPlayer).toBe(s.turnOrder[0]);
        // Everyone's first roll is non-increasing along the order, and ties were rerolled.
        const first = s.turnOrder.map((p) => sum(s, p)[0]);
        for (let i = 1; i < first.length; i++) expect(first[i - 1]).toBeGreaterThanOrEqual(first[i]);
        for (let i = 1; i < n; i++) {
          const a = s.turnOrder[i - 1];
          const b = s.turnOrder[i];
          if (sum(s, a)[0] === sum(s, b)[0]) {
            expect(sum(s, a).length).toBeGreaterThan(1);
            expect(sum(s, b).length).toBeGreaterThan(1);
          }
        }
        // Snake placement over the decided order.
        expect(s.setup!.order).toEqual([...s.turnOrder, ...[...s.turnOrder].reverse()]);
      }
    }
  });

  it('uses the decided order for setup and every turn after', () => {
    let s = createGame(players(3), 99);
    s = completeOrderRoll(s);
    const order = s.turnOrder;
    s = completeSetup(s);
    expect(s.phase).toBe('PRE_ROLL');
    expect(s.currentPlayer).toBe(order[0]);
    s = act(s, order[0], { type: 'rollDice' });
    while (s.phase !== 'MAIN_ACTIONS') {
      if (s.phase === 'ROBBER_DISCARD') {
        for (const [p, n] of Object.entries(s.pendingDiscards)) {
          const res = { ...s.players[Number(p)].resources };
          let left = n;
          for (const k of Object.keys(res) as (keyof typeof res)[]) {
            const take = Math.min(res[k], left);
            res[k] = take;
            left -= take;
          }
          s = act(s, Number(p), { type: 'discard', resources: res });
        }
      } else if (s.phase === 'ROBBER_MOVE') {
        s = act(s, order[0], { type: 'moveRobber', hex: s.board.robberHex === 0 ? 1 : 0 });
      } else if (s.phase === 'ROBBER_STEAL') {
        s = act(s, order[0], { type: 'steal', victim: s.stealCandidates[0] });
      }
    }
    s = act(s, order[0], { type: 'endTurn' });
    expect(s.currentPlayer).toBe(order[1]);
  });

  it('shows opening rolls to everyone', () => {
    const s = act(createGame(players(2), 5), 1, { type: 'rollForOrder' });
    expect(getPlayerView(s, 0).orderRoll!.rolls[1]).toBeDefined();
  });
});
