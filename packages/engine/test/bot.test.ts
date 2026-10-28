import { describe, expect, it } from 'vitest';
import { applyAction, chooseBotAction, createGame, getPlayerView, type BotDifficulty } from '../src';
import { playBotGame } from './helpers';

describe('bots', () => {
  for (const level of ['easy', 'medium', 'hard'] as const) {
    for (const n of [2, 3, 4]) {
      it(`${level} bots finish ${n}-player games`, () => {
        for (let g = 0; g < 3; g++) {
          const r = playBotGame(Array(n).fill(level), 100 + g);
          expect(r.state.phase).toBe('GAME_OVER');
          expect(r.state.winner).not.toBeNull();
          // Bots should almost never propose illegal moves.
          expect(r.rejected).toBeLessThan(r.steps * 0.02 + 3);
        }
      });
    }
  }

  it('higher difficulty wins more often', () => {
    const wins: Record<BotDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
    const lineup: BotDifficulty[] = ['easy', 'medium', 'hard'];
    for (let g = 0; g < 24; g++) {
      // Rotate seats so seat order does not bias the result.
      const levels = lineup.map((_, i) => lineup[(i + g) % 3]);
      const r = playBotGame(levels, 500 + g);
      if (r.state.winner !== null) wins[levels[r.state.winner]]++;
    }
    expect(wins.medium + wins.hard).toBeGreaterThan(wins.easy * 2);
  });

  it('answers a human trade offer and decides from its own view only', () => {
    let s = createGame(
      [
        { name: 'Human', kind: 'human' },
        { name: 'Bot', kind: 'bot', difficulty: 'medium' },
      ],
      3,
    );
    s.phase = 'MAIN_ACTIONS';
    s.turnOrder = [0, 1];
    s.currentPlayer = 0;
    s.turn = 1;
    s.players[0].resources.ore = 2;
    s.players[1].resources.wool = 3;
    const res = applyAction(s, 0, {
      type: 'proposeTrade',
      give: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 1 },
      get: { lumber: 0, brick: 0, wool: 1, grain: 0, ore: 0 },
      to: [1],
    });
    if (!res.ok) throw new Error(res.error);
    s = res.state;
    const view = getPlayerView(s, 1);
    expect(view.players[0].resources).toBeNull();
    const action = chooseBotAction(view, 'medium', () => 0.3);
    expect(action?.type).toMatch(/respondTrade|counterTrade/);
  });
});
