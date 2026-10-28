import {
  addScenario,
  applyAction,
  boardGraph,
  createGame,
  hexSideEdge,
  type GameState,
  type MapHex,
  type ScenarioMap,
} from '../src';

/**
 * Small test map (pointy-top axial q, r):
 *
 *   r=-1:        sea  sea  sea  sea                 (q -2..1)
 *   r=0 :   sea FOR6 HIL8 sea  sea  GOLD10 sea      (q -3..3)  main: FOR, HIL; isle: GOLD
 *   r=1 :   sea MTN4 PAS5 sea  FLD3 sea             (q -3..2)  main: MTN, PAS; isle: FLD
 *   r=2 :  sea  sea  sea  sea  sea  sea             (q -4..1)
 *
 * The gold hex (2,0) has nothing above it: its top edges face the frame.
 * Robber on the mountains, pirate far away at (-4,2), a 3:1 port on the forest's west side.
 */
const row = (r: number, from: number, items: Array<Partial<MapHex> | null>): MapHex[] =>
  items.map((h, i) => (h ? { q: from + i, r, n: null, t: 'sea', ...h } as MapHex : { q: from + i, r, t: 'sea', n: null }));

export const TEST_MAP: ScenarioMap = {
  hexes: [
    ...row(-1, -2, [null, null, null, null]),
    ...row(0, -3, [
      null,
      { t: 'forest', n: 6, region: 'main' },
      { t: 'hills', n: 8, region: 'main' },
      null,
      null,
      { t: 'gold', n: 10, region: 'isle' },
      null,
    ]),
    ...row(1, -3, [null, { t: 'mountains', n: 4, region: 'main' }, { t: 'pasture', n: 5, region: 'main' }, null, { t: 'fields', n: 3, region: 'isle' }, null]),
    ...row(2, -4, [null, null, null, null, null, null]),
  ],
  ports: [{ q: -2, r: 0, dir: 3, type: 'generic' }],
  robber: [-2, 1],
  pirate: [-4, 2],
};

addScenario({
  id: 'test',
  victoryTarget: 14,
  maps: { 3: TEST_MAP, 4: TEST_MAP },
  startRegions: ['main'],
  homeRegions: ['main'],
  regionBonus: 2,
});

/** A Seafarers test game on TEST_MAP in MAIN_ACTIONS for player 0 (turn 1, already rolled). */
export function sfGame(n = 2, phase: GameState['phase'] = 'MAIN_ACTIONS'): GameState {
  const s = createGame(
    Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const })),
    42,
    { mod: 'seafarers', scenario: 'test' },
  );
  s.orderRoll = null;
  if (phase === 'INITIAL_PLACEMENT') {
    s.phase = phase;
    s.setup = { order: [...s.turnOrder, ...s.turnOrder.slice().reverse()], step: 0, lastSettlement: null };
    return s;
  }
  s.phase = phase;
  s.setup = null;
  s.turn = 1;
  s.hasRolled = phase === 'MAIN_ACTIONS';
  return s;
}

/** Hex id at axial (q, r). */
export function hexAt(s: GameState, q: number, r: number): number {
  const h = boardGraph(s.board).hexes.find((x) => x.q === q && x.r === r);
  if (!h) throw new Error(`No hex at ${q},${r}`);
  return h.id;
}

/** The vertex shared by all the given hexes (2 hexes → the edge's two vertices, use `pick`). */
export function vertexOf(s: GameState, hexes: Array<[number, number]>, pick = 0): string {
  const G = boardGraph(s.board);
  const ids = hexes.map(([q, r]) => hexAt(s, q, r));
  const shared = G.hexes[ids[0]].vertices.filter((v) => ids.every((id) => G.hexes[id].vertices.includes(v)));
  if (!shared[pick]) throw new Error('No shared vertex');
  return shared[pick];
}

/** Edge on side `dir` (0 E, 1 NE, 2 NW, 3 W, 4 SW, 5 SE) of hex (q, r). */
export function side(s: GameState, q: number, r: number, dir: number): string {
  return hexSideEdge(boardGraph(s.board), hexAt(s, q, r), dir);
}

/** Edge between two vertices. */
export function edgeVV(s: GameState, a: string, b: string): string {
  const G = boardGraph(s.board);
  const e = G.vertices[a].edges.find((id) => G.edges[id].vertices.includes(b));
  if (!e) throw new Error(`No edge between ${a} and ${b}`);
  return e;
}

/** The other vertex of an edge. */
export function across(s: GameState, edge: string, from: string): string {
  const [a, b] = boardGraph(s.board).edges[edge].vertices;
  return a === from ? b : a;
}

/** Rolls with a seed chosen so the dice show `sum` (searches seeds; keeps everything else). */
export function rollTo(s: GameState, sum: number): GameState {
  for (let seed = 1; seed < 100_000; seed++) {
    const trial = { ...s, rng: seed };
    const res = applyAction(trial, s.currentPlayer, { type: 'rollDice' });
    if (res.ok && res.state.lastRoll && res.state.lastRoll.dice[0] + res.state.lastRoll.dice[1] === sum) return res.state;
  }
  throw new Error('no seed');
}
