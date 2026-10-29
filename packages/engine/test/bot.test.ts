import { describe, expect, it } from 'vitest';
import { GRAPH, applyAction, chooseBotAction, createGame, getPlayerView, totalRes, type BotDifficulty, type ResMap } from '../src';
import { mainPhaseGame, placeBuilding, playBotGame, setResources } from './helpers';

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

  for (const level of ['easy', 'medium', 'hard'] as const) {
    for (const n of [5, 6]) {
      it(`${level} bots finish ${n}-player games (paired players)`, () => {
        const r = playBotGame(Array(n).fill(level), 200 + n, 20000);
        expect(r.state.phase).toBe('GAME_OVER');
        expect(r.state.winner).not.toBeNull();
        expect(r.state.board.layout).toBe('classic56');
        expect(r.rejected).toBeLessThan(r.steps * 0.02 + 3);
      });
    }
  }

  /** Player 0 in its main phase with one city spot, no roads left and `cards` in hand. */
  function cityOnlyGame(cards: Parameters<typeof setResources>[2]) {
    const s = mainPhaseGame(2);
    placeBuilding(s, 0, GRAPH.vertexIds[20]);
    s.players[0].roadsBuilt = 15;
    setResources(s, 0, cards);
    return s;
  }

  it('medium and hard trade with the bank to finish a city', () => {
    const s = cityOnlyGame({ ore: 1, grain: 2, lumber: 4, brick: 4 });
    for (const level of ['medium', 'hard'] as const) {
      const a = chooseBotAction(getPlayerView(s, 0), level, () => 0.5, {});
      expect(a).toMatchObject({ type: 'bankTrade', get: 'ore' });
    }
  });

  it('ask the other players before trading with the bank', () => {
    const s = cityOnlyGame({ ore: 1, grain: 2, lumber: 4, brick: 4 });
    s.players[1].kind = 'human';
    setResources(s, 1, { ore: 3 });
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const memory = {};
      const a = chooseBotAction(getPlayerView(s, 0), level, () => 0.5, memory);
      expect(a).toMatchObject({ type: 'proposeTrade', get: { ore: 1 }, to: [1] });
      if (level === 'easy') continue;
      // Turned down: a second, more generous offer, then the bank.
      const b = chooseBotAction(getPlayerView(s, 0), level, () => 0.5, memory);
      expect(b).toMatchObject({ type: 'proposeTrade', get: { ore: 1 } });
      expect(totalRes((b as { give: ResMap }).give)).toBe(2);
      expect(chooseBotAction(getPlayerView(s, 0), level, () => 0.5, memory)).toMatchObject({ type: 'bankTrade', get: 'ore' });
    }
  });

  it('spend a hand that a 7 would halve, keep a small one', () => {
    const big = cityOnlyGame({ wool: 9 });
    big.devDeck = [];
    expect(chooseBotAction(getPlayerView(big, 0), 'hard', () => 0.5, {})).toMatchObject({ type: 'bankTrade', give: 'wool' });
    const small = cityOnlyGame({ wool: 7 });
    small.devDeck = [];
    expect(chooseBotAction(getPlayerView(small, 0), 'hard', () => 0.5, {})).toEqual({ type: 'endTurn' });
  });

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

  it('hard beats medium head-to-head', () => {
    // Two of each, seats alternating. Over 80 seeded base games (bot-bench duel) hard wins ~85%.
    let hard = 0;
    for (let g = 0; g < 16; g++) {
      const levels: BotDifficulty[] = g % 2 ? ['hard', 'medium', 'hard', 'medium'] : ['medium', 'hard', 'medium', 'hard'];
      const r = playBotGame(levels, 948 + g);
      if (r.state.winner !== null && levels[r.state.winner] === 'hard') hard++;
    }
    expect(hard).toBeGreaterThanOrEqual(10);
  }, 120_000);

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
