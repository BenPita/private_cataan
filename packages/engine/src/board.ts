import { GRAPH } from './geometry';
import { Rng } from './rng';
import { NUMBER_TOKENS, TERRAIN_COUNTS } from './rulesets';
import type { Board, Harbor, HarborType, HexTile, Terrain } from './types';

const HARBOR_TYPES: HarborType[] = [
  'generic', 'generic', 'generic', 'generic',
  'lumber', 'brick', 'wool', 'grain', 'ore',
];

/**
 * Gaps between consecutive harbors along the 30 coastal edges. Mirrors the
 * classic frame spacing so every harbor is reachable and none are adjacent.
 */
const HARBOR_GAPS = [3, 3, 4, 3, 3, 4, 3, 3, 4];

const isRed = (n: number | null) => n === 6 || n === 8;

export function hasAdjacentRedNumbers(hexes: HexTile[]): boolean {
  return GRAPH.hexes.some(
    (h) => isRed(hexes[h.id].number) && h.neighbors.some((n) => isRed(hexes[n].number)),
  );
}

function generateHarbors(rng: Rng): Harbor[] {
  const types = rng.shuffle(HARBOR_TYPES);
  const offset = rng.int(GRAPH.coastalEdges.length);
  const harbors: Harbor[] = [];
  let index = offset;
  HARBOR_GAPS.forEach((gap, i) => {
    harbors.push({ edge: GRAPH.coastalEdges[index % GRAPH.coastalEdges.length], type: types[i] });
    index += gap;
  });
  return harbors;
}

export function generateRandomBoard(rng: Rng): Board {
  const terrains: Terrain[] = [];
  (Object.keys(TERRAIN_COUNTS) as Terrain[]).forEach((t) => {
    for (let i = 0; i < TERRAIN_COUNTS[t]; i++) terrains.push(t);
  });

  // Balanced generation: reshuffle until no two 6/8 tokens touch.
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const shuffledTerrain = rng.shuffle(terrains);
    const numbers = rng.shuffle(NUMBER_TOKENS);
    let n = 0;
    const hexes: HexTile[] = shuffledTerrain.map((terrain, id) => ({
      id,
      terrain,
      number: terrain === 'desert' ? null : numbers[n++],
    }));
    if (hasAdjacentRedNumbers(hexes)) continue;
    const robberHex = hexes.find((h) => h.terrain === 'desert')!.id;
    const board: Board = { layout: 'classic', hexes, harbors: generateHarbors(rng), robberHex };
    validateBoard(board);
    return board;
  }
  throw new Error('Could not generate a balanced board');
}

/** Fixed beginner-friendly layout (original arrangement, rows 3-4-5-4-3). */
const BEGINNER_LAYOUT: Array<[Terrain, number | null]> = [
  ['mountains', 10], ['pasture', 2], ['forest', 9],
  ['fields', 12], ['hills', 6], ['pasture', 4], ['hills', 10],
  ['fields', 9], ['forest', 11], ['desert', null], ['forest', 3], ['mountains', 8],
  ['forest', 8], ['mountains', 3], ['fields', 4], ['pasture', 5],
  ['hills', 5], ['fields', 6], ['pasture', 11],
];

export function generateBeginnerBoard(): Board {
  const hexes = BEGINNER_LAYOUT.map(([terrain, number], id) => ({ id, terrain, number }));
  const types: HarborType[] = ['generic', 'wool', 'generic', 'ore', 'generic', 'grain', 'brick', 'generic', 'lumber'];
  let index = 0;
  const harbors = HARBOR_GAPS.map((gap, i) => {
    const h = { edge: GRAPH.coastalEdges[index], type: types[i] };
    index += gap;
    return h;
  });
  const board: Board = { layout: 'classic', hexes, harbors, robberHex: hexes.find((h) => h.terrain === 'desert')!.id };
  validateBoard(board);
  return board;
}

export function validateBoard(board: Board): void {
  if (board.hexes.length !== 19) throw new Error('Board must have 19 hexes');
  const counts: Record<string, number> = {};
  for (const h of board.hexes) counts[h.terrain] = (counts[h.terrain] ?? 0) + 1;
  for (const [t, c] of Object.entries(TERRAIN_COUNTS)) {
    if (counts[t] !== c) throw new Error(`Wrong count for ${t}`);
  }
  const nums = board.hexes.filter((h) => h.number !== null).map((h) => h.number!).sort((a, b) => a - b);
  if (nums.join(',') !== [...NUMBER_TOKENS].sort((a, b) => a - b).join(',')) {
    throw new Error('Wrong number tokens');
  }
  if (board.hexes.some((h) => (h.terrain === 'desert') !== (h.number === null))) {
    throw new Error('Desert must be the only hex without a number');
  }
  if (board.harbors.length !== 9) throw new Error('Board must have 9 harbors');
  if (board.hexes[board.robberHex].terrain !== 'desert') throw new Error('Robber must start on the desert');
}
