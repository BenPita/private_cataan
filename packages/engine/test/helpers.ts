import {
  GRAPH,
  applyAction,
  createGame,
  emptyRes,
  legalSetupRoads,
  legalSetupSettlements,
  orderRollGroup,
  type Action,
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
