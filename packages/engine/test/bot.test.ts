import { describe, expect, it } from 'vitest';
import {
  Rng,
  applyAction,
  chooseBotAction,
  createGame,
  getPlayerView,
  type Action,
  type BotDifficulty,
  type BotMemory,
  type GameState,
} from '../src';

interface Result {
  state: GameState;
  steps: number;
  rejected: number;
}

/** Runs a game where every seat is a bot. Bots only ever see their own view. */
export function playBotGame(levels: BotDifficulty[], seed: number, maxSteps = 8000): Result {
  let s = createGame(
    levels.map((difficulty, i) => ({ name: `Bot${i}`, kind: 'bot' as const, difficulty })),
    seed,
  );
  const rng = new Rng(seed * 7 + 1);
  const memory: BotMemory[] = levels.map(() => ({}));
  let rejected = 0;
  let steps = 0;
  for (; steps < maxSteps && s.phase !== 'GAME_OVER'; steps++) {
    let acted = false;
    // Any seat may need to act (discards, trade answers); otherwise the active player.
    const order = [...levels.keys()].sort((a, b) => Number(b !== s.currentPlayer) - Number(a !== s.currentPlayer));
    for (const seat of order) {
      const view = getPlayerView(s, seat);
      const m = memory[seat];
      const action: Action | null = chooseBotAction(view, levels[seat], () => rng.next(), m);
      if (!action) continue;
      const res = applyAction(s, seat, action);
      if (res.ok) {
        if (m.actionsOnTurn?.turn === s.turn) m.actionsOnTurn.count++;
        else m.actionsOnTurn = { turn: s.turn, count: 1 };
        s = res.state;
      } else {
        rejected++;
        // Fallback the server also uses: end the turn when allowed.
        const fallback = applyAction(s, seat, s.trade?.from === seat ? { type: 'cancelTrade' } : { type: 'endTurn' });
        if (fallback.ok) s = fallback.state;
      }
      acted = true;
      break;
    }
    if (!acted) {
      // Only a pending bot trade offer can leave everyone idle: withdraw it.
      const res = applyAction(s, s.currentPlayer, { type: 'cancelTrade' });
      if (!res.ok) throw new Error(`Stuck in ${s.phase}`);
      s = res.state;
    }
  }
  return { state: s, steps, rejected };
}

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
