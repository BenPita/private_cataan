/**
 * Bot benchmark: seeded bot-vs-bot games per game mode, printing how strong
 * and how active each difficulty plays.
 *
 *   npx tsx packages/engine/scripts/bot-bench.ts [games] [filter]
 *
 * Per mode: same-level games (turns to win, best VP at turn 30, hand size at
 * the end of the bot's own turns, cards lost to 7s, bank trades, ships) and
 * mixed easy/medium/hard games (wins per level, seats rotated).
 */
import {
  Rng,
  applyAction,
  chooseBotAction,
  createGame,
  getPlayerView,
  totalRes,
  victoryPoints,
  type Action,
  type BotDifficulty,
  type BotMemory,
  type GameConfig,
  type GameState,
} from '../src';

interface Stats {
  games: number;
  finished: number;
  turns: number;
  vp30: number;
  handEnd: number;
  handEndN: number;
  bigHands: number;
  discarded: number;
  bankTrades: number;
  playerTrades: number;
  ships: number;
  devBought: number;
}

const blank = (): Stats => ({
  games: 0, finished: 0, turns: 0, vp30: 0, handEnd: 0, handEndN: 0, bigHands: 0,
  discarded: 0, bankTrades: 0, playerTrades: 0, ships: 0, devBought: 0,
});

export function benchGame(levels: BotDifficulty[], seed: number, config: Partial<GameConfig>, stats?: Stats[]): GameState {
  let s = createGame(levels.map((difficulty, i) => ({ name: `Bot${i}`, kind: 'bot' as const, difficulty })), seed, config);
  const rng = new Rng(seed * 7 + 1);
  const memory: BotMemory[] = levels.map(() => ({}));
  let vp30Done = false;
  for (let steps = 0; steps < 30000 && s.phase !== 'GAME_OVER'; steps++) {
    if (!vp30Done && s.turn >= 30) {
      vp30Done = true;
      if (stats) for (let i = 0; i < levels.length; i++) stats[i].vp30 += victoryPoints(s, i);
    }
    let acted = false;
    const order = [...levels.keys()].sort((a, b) => Number(b !== s.currentPlayer) - Number(a !== s.currentPlayer));
    for (const seat of order) {
      const m = memory[seat];
      const action: Action | null = chooseBotAction(getPlayerView(s, seat), levels[seat], () => rng.next(), m);
      if (!action) continue;
      const before = s;
      const res = applyAction(s, seat, action);
      if (res.ok) {
        if (m.actionsOnTurn?.turn === s.turn) m.actionsOnTurn.count++;
        else m.actionsOnTurn = { turn: s.turn, count: 1 };
        s = res.state;
        const st = stats?.[seat];
        if (st) {
          if (action.type === 'endTurn') {
            const n = totalRes(before.players[seat].resources);
            st.handEnd += n;
            st.handEndN++;
            if (n >= 8) st.bigHands++;
          }
          if (action.type === 'discard') st.discarded += totalRes(action.resources);
          if (action.type === 'bankTrade') st.bankTrades++;
          if (action.type === 'confirmTrade') st.playerTrades++;
          if (action.type === 'buyDevCard') st.devBought++;
        }
      } else {
        const fallback = applyAction(s, seat, s.trade?.from === seat ? { type: 'cancelTrade' } : { type: 'endTurn' });
        if (fallback.ok) s = fallback.state;
      }
      acted = true;
      break;
    }
    if (!acted) {
      const res = applyAction(s, s.currentPlayer, { type: 'cancelTrade' });
      if (!res.ok) throw new Error(`Stuck in ${s.phase}`);
      s = res.state;
    }
  }
  if (stats) {
    for (let i = 0; i < levels.length; i++) {
      stats[i].games++;
      stats[i].ships += s.players[i].shipsBuilt ?? 0;
      if (s.phase === 'GAME_OVER') {
        stats[i].finished++;
        stats[i].turns += s.turn;
      }
    }
  }
  return s;
}

const MODES: Array<{ name: string; config: Partial<GameConfig>; players?: number }> = [
  { name: 'base', config: {} },
  { name: 'base-6p', config: {}, players: 6 },
  ...['newShores', 'fourIslands', 'fogIslands', 'throughDesert', 'forgottenTribe', 'clothForCatan', 'pirateIslands', 'wondersOfCatan', 'newWorld'].map(
    (scenario) => ({ name: scenario, config: { mod: 'seafarers' as const, scenario } }),
  ),
];

const LEVELS: BotDifficulty[] = ['easy', 'medium', 'hard'];
const f = (n: number, d = 1) => n.toFixed(d).padStart(6);

/** Head-to-head: two seats of `a` against two of `b`, seats rotated. Prints a's share of wins. */
function duel(a: BotDifficulty, b: BotDifficulty, games: number, filter?: string) {
  for (const mode of MODES) {
    if (filter && !filter.split(',').includes(mode.name)) continue;
    let wins = 0;
    let done = 0;
    for (let g = 0; g < games; g++) {
      const n = mode.players ?? 4;
      const levels = Array.from({ length: n }, (_, i) => ((i + g) % 2 ? a : b));
      const s = benchGame(levels, 9000 + Number(process.env.SEED ?? 0) + g, mode.config);
      if (s.winner === null) continue;
      done++;
      if (levels[s.winner] === a) wins++;
    }
    console.log(`${mode.name.padEnd(14)} ${a} vs ${b}: ${wins}/${done} (${((100 * wins) / Math.max(done, 1)).toFixed(0)}%)`);
  }
}

function main() {
  if (process.argv[2] === 'duel') {
    duel(process.argv[3] as BotDifficulty, process.argv[4] as BotDifficulty, Number(process.argv[5] ?? 20), process.argv[6]);
    return;
  }
  const games = Number(process.argv[2] ?? 6);
  const filter = process.argv[3];
  console.log(`mode           level  turns  vp@30  hand  hand8+%  lost7  bank  ptrade  dev  ships | mixed wins e/m/h`);
  for (const mode of MODES) {
    if (filter && !filter.split(',').includes(mode.name)) continue;
    const n = mode.players ?? 4;
    const rows: string[] = [];
    for (const level of LEVELS) {
      const stats = Array.from({ length: n }, blank);
      for (let g = 0; g < games; g++) benchGame(Array(n).fill(level), 1000 + g, mode.config, stats);
      const sum = stats.reduce((a, b) => {
        for (const k of Object.keys(a) as (keyof Stats)[]) a[k] += b[k];
        return a;
      }, blank());
      const per = sum.games;
      rows.push(
        `${mode.name.padEnd(14)} ${level.padEnd(6)}${f(sum.finished ? sum.turns / sum.finished : NaN)}${f(sum.vp30 / per)}${f(sum.handEnd / sum.handEndN)}${f((100 * sum.bigHands) / sum.handEndN, 0)}   ${f(sum.discarded / per)}${f(sum.bankTrades / per)}${f(sum.playerTrades / per)}${f(sum.devBought / per)}${f(sum.ships / per)}` +
          (sum.finished < games * n ? `  (${games - sum.finished / n} unfinished)` : ''),
      );
    }
    // Mixed: one bot of each level (plus extra mediums for 4+ seats), seats rotated.
    const wins: Record<BotDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
    const mixedGames = games * 2;
    for (let g = 0; g < mixedGames; g++) {
      const base: BotDifficulty[] = n >= 6 ? ['easy', 'medium', 'hard', 'easy', 'medium', 'hard'] : ['easy', 'medium', 'hard', 'medium'];
      const levels = base.map((_, i) => base[(i + g) % base.length]);
      const s = benchGame(levels, 5000 + g, mode.config);
      if (s.winner !== null) wins[levels[s.winner]]++;
    }
    rows[0] += `   | ${wins.easy}/${wins.medium}/${wins.hard} of ${mixedGames}`;
    console.log(rows.join('\n'));
  }
}

if (process.argv[1]?.includes("bot-bench")) main();
