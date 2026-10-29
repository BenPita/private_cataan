import { graphFor } from '../../geometry';
import type { Rng } from '../../rng';
import type { Board, HarborType, HexTile, LayoutId, Terrain } from '../../types';
import type { ScenarioDef } from '../types';
import type { MapHex, ScenarioMap } from './mapTypes';

/*
 * Boards that are dealt at random: "New World" (rulebook p. 20) and the
 * "variable setup" of scenarios 1-4 and 8.
 */

const isRed = (n: number | null) => n === 6 || n === 8;
const isLand = (t: Terrain) => t !== 'sea' && t !== 'fog';

/**
 * The New World frame (p. 20): 42 spaces in rows of 5-6-7-6-7-6-5, all sea here;
 * the hexes are dealt by `newWorldBoard`.
 */
export const NEW_WORLD_FRAME: ScenarioMap = {
  hexes: [
    [0, 2, 5],
    [1, 1, 6],
    [2, 0, 7],
    [3, 0, 6],
    [4, -1, 7],
    [5, -1, 6],
    [6, -1, 5],
  ].flatMap(([r, q0, n]) => Array.from({ length: n }, (_, i): MapHex => ({ q: q0 + i, r, t: 'sea', n: null }))),
  ports: [],
  robber: null,
};

/** What New World deals (p. 20 component table). */
export interface NewWorldSpec {
  hexes: Partial<Record<Terrain, number>>;
  numbers: number[];
  /** Port types; each is placed on a random coastal edge, one edge apart from the others. */
  ports: HarborType[];
}

/** Islands = connected land hexes, named isle1.. in hex-id order (top to bottom, left to right). */
function nameIslands(hexes: HexTile[], layout: LayoutId): void {
  const G = graphFor(layout);
  let k = 0;
  for (const start of hexes) {
    if (!isLand(start.terrain) || start.region) continue;
    const region = `isle${++k}`;
    const stack = [start.id];
    start.region = region;
    while (stack.length) {
      for (const n of G.hexes[stack.pop()!].neighbors) {
        if (isLand(hexes[n].terrain) && !hexes[n].region) {
          hexes[n].region = region;
          stack.push(n);
        }
      }
    }
  }
}

/**
 * Ports on random coastal edges (land on one side, sea or the frame on the other),
 * never sharing a corner with another port. Null when they do not fit.
 */
function placePorts(hexes: HexTile[], layout: LayoutId, types: HarborType[], rng: Rng): Board['harbors'] | null {
  const G = graphFor(layout);
  const coast = G.edgeIds.filter((e) => {
    const hs = G.edges[e].hexes;
    const land = hs.filter((h) => isLand(hexes[h].terrain)).length;
    return land === 1 && (hs.length === 1 || hs.some((h) => hexes[h].terrain === 'sea'));
  });
  const used = new Set<string>();
  const out: Board['harbors'] = [];
  for (const type of types) {
    const free = coast.filter((e) => G.edges[e].vertices.every((v) => !used.has(v)));
    if (free.length === 0) return null;
    const edge = free[rng.int(free.length)];
    G.edges[edge].vertices.forEach((v) => used.add(v));
    out.push({ edge, type });
  }
  return out;
}

/**
 * New World: the hexes face up at random in the frame, number discs at random on
 * the land with no two red discs side by side (the rulebook swaps them; redealing
 * gives the same result), ports one by one at random. The robber and the pirate
 * start on the frame, off the board (`robberHex` / `pirateHex` -1).
 */
export function newWorldBoard(layout: LayoutId, spec: NewWorldSpec, rng: Rng): Board {
  const G = graphFor(layout);
  const terrains = (Object.keys(spec.hexes) as Terrain[]).flatMap((t) => Array<Terrain>(spec.hexes[t]!).fill(t));
  if (terrains.length !== G.hexes.length) throw new Error('New World needs one hex per frame space');
  for (let attempt = 0; attempt < 1000; attempt++) {
    const dealt = rng.shuffle(terrains);
    const hexes: HexTile[] = dealt.map((terrain, id) => ({ id, terrain, number: null }));
    if (!dealNumbers(hexes, hexes.filter((h) => isLand(h.terrain) && h.terrain !== 'desert'), spec.numbers, rng, layout, { noAdjacentRed: true })) continue;
    nameIslands(hexes, layout);
    const harbors = placePorts(hexes, layout, rng.shuffle(spec.ports), rng);
    if (!harbors) continue;
    return { layout, hexes, harbors, robberHex: -1, pirateHex: -1 };
  }
  throw new Error('Could not deal a New World');
}

type NumberRules = NonNullable<ScenarioDef['variable']> | { noAdjacentRed?: boolean };

/** Deals `numbers` onto `targets` until the number rules hold (up to 200 tries); false if never. */
function dealNumbers(hexes: HexTile[], targets: HexTile[], numbers: number[], rng: Rng, layout: LayoutId, rules: NumberRules): boolean {
  const G = graphFor(layout);
  const r = rules as NonNullable<ScenarioDef['variable']>;
  for (let i = 0; i < 200; i++) {
    const dealt = rng.shuffle(numbers);
    targets.forEach((h, k) => (h.number = dealt[k]));
    const bad = hexes.some((h) => {
      if (!isRed(h.number)) return (r.lowNotOn ?? []).includes(h.terrain) && [2, 3, 11, 12].includes(h.number ?? 0);
      if (r.noRedOnGold && h.terrain === 'gold') return true;
      return G.hexes[h.id].neighbors.some(
        (n) => (r.noAdjacentRed && isRed(hexes[n].number)) || (r.noRedNextTo !== undefined && hexes[n].terrain === r.noRedNextTo),
      );
    });
    if (!bad) return true;
  }
  return false;
}

/**
 * Variable setup (scenarios 1-4 and 8): within each group of regions the land hexes
 * and their number discs are dealt again at random (fixed terrains stay where printed),
 * port types are shuffled over the printed port spots, and the robber is placed as
 * that scenario says. Sea, regions and spots stay as printed.
 */
export function applyVariableSetup(board: Board, def: ScenarioDef, participants: number, rng: Rng): void {
  const v = def.variable;
  if (!v) return;
  const layout = board.layout!;
  const fixed = new Set(v.fixed ?? []);
  const named = new Set(v.groups.flat().filter((g) => g !== '*'));
  const groupOf = (h: HexTile): number =>
    v.groups.findIndex((g) => g.includes(h.region ?? '') || (g.includes('*') && !named.has(h.region ?? '')));
  const movable = board.hexes.filter((h) => isLand(h.terrain) && !fixed.has(h.terrain) && groupOf(h) >= 0);
  const original = movable.map((h) => ({ terrain: h.terrain, number: h.number }));
  for (let attempt = 0; attempt < 1000; attempt++) {
    let ok = true;
    for (let g = 0; g < v.groups.length && ok; g++) {
      const group = movable.filter((h) => groupOf(h) === g);
      const terrains = rng.shuffle(group.map((h) => original[movable.indexOf(h)].terrain));
      const numbers = group.map((h) => original[movable.indexOf(h)].number).filter((n): n is number => n !== null);
      group.forEach((h, k) => {
        h.terrain = terrains[k];
        h.number = null;
      });
      ok = dealNumbers(board.hexes, group.filter((h) => h.terrain !== 'desert'), numbers, rng, layout, v);
    }
    if (ok) {
      const types = rng.shuffle(board.harbors.map((h) => h.type));
      board.harbors = board.harbors.map((h, i) => ({ ...h, type: types[i] }));
      const robber = typeof v.robber === 'object' ? v.robber[participants <= 3 ? 3 : 4] : v.robber;
      if (robber !== 'keep') {
        const at = board.hexes.find((h) => (robber === 'twelve' ? h.number === 12 : h.terrain === 'desert'));
        if (at) board.robberHex = at.id;
      }
      return;
    }
  }
  throw new Error('Could not deal the variable setup');
}
