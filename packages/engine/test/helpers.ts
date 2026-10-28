import {
  GRAPH,
  Rng,
  applyAction,
  chooseBotAction,
  createGame,
  emptyRes,
  getPlayerView,
  legalSetupRoads,
  legalSetupSettlements,
  orderRollGroup,
  type Action,
  type BotDifficulty,
  type BotMemory,
  type GameConfig,
  type GameState,
  type ResMap,
} from '../src';

/** A new game with the opening roll skipped: seats play in order 0, 1, 2, ... */
export function newGame(n = 2, seed = 42): GameState {
  const s = createGame(
    Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const })),
    seed,
  );
  s.phase = 'INITIAL_PLACEMENT';
  s.orderRoll = null;
  s.setup = { order: [...s.turnOrder, ...s.turnOrder.slice().reverse()], step: 0, lastSettlement: null };
  return s;
}

/** Everyone rolls for turn order until it is decided. */
export function completeOrderRoll(state: GameState): GameState {
  let s = state;
  while (s.phase === 'ORDER_ROLL') {
    const group = orderRollGroup(s)!;
    const p = group.find((x) => !s.orderRoll!.rolls[x])!;
    s = act(s, p, { type: 'rollForOrder' });
  }
  return s;
}

export function act(state: GameState, player: number, action: Action): GameState {
  const res = applyAction(state, player, action);
  if (!res.ok) throw new Error(`Action ${action.type} failed: ${res.error}`);
  return res.state;
}

export function expectFail(state: GameState, player: number, action: Action): string {
  const res = applyAction(state, player, action);
  if (res.ok) throw new Error(`Expected ${action.type} to fail`);
  return res.error;
}

/** Plays the whole initial placement using the first legal spots. */
export function completeSetup(state: GameState): GameState {
  let s = state;
  while (s.phase === 'INITIAL_PLACEMENT') {
    const p = s.currentPlayer;
    const v = legalSetupSettlements(s)[0];
    s = act(s, p, { type: 'placeSetupSettlement', vertex: v });
    s = act(s, p, { type: 'placeSetupRoad', edge: legalSetupRoads(s, v)[0] });
  }
  return s;
}

/** An empty board in MAIN_ACTIONS for player 0, for building-focused tests. */
export function mainPhaseGame(n = 2): GameState {
  const s = newGame(n);
  s.phase = 'MAIN_ACTIONS';
  s.setup = null;
  s.turn = 1;
  s.hasRolled = true;
  return s;
}

export function give(state: GameState, player: number, res: Partial<ResMap>): void {
  for (const [k, v] of Object.entries(res)) {
    state.players[player].resources[k as keyof ResMap] += v!;
    state.bank[k as keyof ResMap] -= v!;
  }
}

export function setResources(state: GameState, player: number, res: Partial<ResMap>): void {
  const p = state.players[player];
  for (const k of Object.keys(p.resources) as (keyof ResMap)[]) {
    state.bank[k] += p.resources[k];
    p.resources[k] = 0;
  }
  give(state, player, { ...emptyRes(), ...res });
}

export function placeBuilding(state: GameState, player: number, vertex: string, type: 'settlement' | 'city' = 'settlement') {
  state.buildings[vertex] = { owner: player, type };
  state.players[player].settlementsBuilt++;
  if (type === 'city') state.players[player].citiesBuilt++;
}

export function placeRoadDirect(state: GameState, player: number, edge: string) {
  state.roads[edge] = player;
  state.players[player].roadsBuilt++;
}

/** Edge id connecting two vertices. */
export function edgeBetween(a: string, b: string): string {
  const e = GRAPH.vertices[a].edges.find((id) => GRAPH.edges[id].vertices.includes(b));
  if (!e) throw new Error(`No edge between ${a} and ${b}`);
  return e;
}

/** A simple path of `length` edges starting at `start`, never revisiting a vertex. */
export function pathFrom(start: string, length: number): { vertices: string[]; edges: string[] } {
  const vertices = [start];
  const edges: string[] = [];
  const dfs = (): boolean => {
    if (edges.length === length) return true;
    const cur = vertices[vertices.length - 1];
    for (const n of GRAPH.vertices[cur].neighbors) {
      if (vertices.includes(n)) continue;
      vertices.push(n);
      edges.push(edgeBetween(cur, n));
      if (dfs()) return true;
      vertices.pop();
      edges.pop();
    }
    return false;
  };
  if (!dfs()) throw new Error('no path');
  return { vertices, edges };
}

interface Result {
  state: GameState;
  steps: number;
  rejected: number;
}

/** Runs a game where every seat is a bot. Bots only ever see their own view. */
export function playBotGame(levels: BotDifficulty[], seed: number, maxSteps = 8000, config: Partial<GameConfig> = {}): Result {
  let s = createGame(
    levels.map((difficulty, i) => ({ name: `Bot${i}`, kind: 'bot' as const, difficulty })),
    seed,
    config,
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

/**
 * Everything that decides how a game played out, without fields that later
 * refactors add (board.layout, config.mod). Used by the regression snapshot.
 */
export function fingerprint(s: GameState) {
  return {
    winner: s.winner,
    turn: s.turn,
    phase: s.phase,
    logSeq: s.logSeq,
    rng: s.rng,
    turnOrder: s.turnOrder,
    hexes: s.board.hexes,
    harbors: s.board.harbors,
    robberHex: s.board.robberHex,
    buildings: s.buildings,
    roads: s.roads,
    bank: s.bank,
    devDeck: s.devDeck,
    players: s.players.map((p) => ({
      color: p.color,
      resources: p.resources,
      devCards: p.devCards,
      knightsPlayed: p.knightsPlayed,
      roadsBuilt: p.roadsBuilt,
      settlementsBuilt: p.settlementsBuilt,
      citiesBuilt: p.citiesBuilt,
    })),
    lastLog: s.log.slice(-5).map((e) => e.msg),
  };
}
