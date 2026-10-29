import { graphFor, hexSideEdge, registerLayout, type BoardGraph } from './geometry';
import { boardHexes, type MapCorner, type ScenarioMap } from './mods/seafarers/mapTypes';
import type { ModDef } from './mods/types';
import { Rng } from './rng';
import type { Board, Harbor, HexTile, LayoutId, Terrain } from './types';

const isRed = (n: number | null) => n === 6 || n === 8;

export function hasAdjacentRedNumbers(hexes: HexTile[], graph: BoardGraph): boolean {
  return graph.hexes.some(
    (h) => isRed(hexes[h.id].number) && h.neighbors.some((n) => isRed(hexes[n].number)),
  );
}

function generateHarbors(rng: Rng, mod: ModDef): Harbor[] {
  const coast = graphFor(mod.layout).coastalEdges;
  const types = rng.shuffle(mod.harborTypes);
  const offset = rng.int(coast.length);
  const harbors: Harbor[] = [];
  let index = offset;
  mod.harborGaps.forEach((gap, i) => {
    harbors.push({ edge: coast[index % coast.length], type: types[i] });
    index += gap;
  });
  return harbors;
}

export function generateRandomBoard(rng: Rng, mod: ModDef): Board {
  const graph = graphFor(mod.layout);
  const terrains: Terrain[] = [];
  (Object.keys(mod.terrainCounts) as Terrain[]).forEach((t) => {
    for (let i = 0; i < (mod.terrainCounts[t] ?? 0); i++) terrains.push(t);
  });

  // Balanced generation: reshuffle until no two 6/8 tokens touch.
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const shuffledTerrain = rng.shuffle(terrains);
    const numbers = rng.shuffle(mod.numberTokens);
    let n = 0;
    const hexes: HexTile[] = shuffledTerrain.map((terrain, id) => ({
      id,
      terrain,
      number: terrain === 'desert' ? null : numbers[n++],
    }));
    if (hasAdjacentRedNumbers(hexes, graph)) continue;
    const robberHex = hexes.find((h) => h.terrain === 'desert')!.id;
    const board: Board = { layout: mod.layout, hexes, harbors: generateHarbors(rng, mod), robberHex };
    validateBoard(board, mod);
    return board;
  }
  throw new Error('Could not generate a balanced board');
}

export function generateBeginnerBoard(mod: ModDef): Board {
  const coast = graphFor(mod.layout).coastalEdges;
  const hexes = mod.beginner.hexes.map(([terrain, number], id) => ({ id, terrain, number }));
  let index = 0;
  const harbors = mod.harborGaps.map((gap, i) => {
    const h = { edge: coast[index], type: mod.beginner.harbors[i] };
    index += gap;
    return h;
  });
  const board: Board = { layout: mod.layout, hexes, harbors, robberHex: hexes.find((h) => h.terrain === 'desert')!.id };
  validateBoard(board, mod);
  return board;
}

export function validateBoard(board: Board, mod: ModDef): void {
  const size = graphFor(mod.layout).hexes.length;
  if (board.hexes.length !== size) throw new Error(`Board must have ${size} hexes`);
  const counts: Record<string, number> = {};
  for (const h of board.hexes) counts[h.terrain] = (counts[h.terrain] ?? 0) + 1;
  for (const [t, c] of Object.entries(mod.terrainCounts)) {
    if ((counts[t] ?? 0) !== c) throw new Error(`Wrong count for ${t}`);
  }
  const nums = board.hexes.filter((h) => h.number !== null).map((h) => h.number!).sort((a, b) => a - b);
  if (nums.join(',') !== [...mod.numberTokens].sort((a, b) => a - b).join(',')) {
    throw new Error('Wrong number tokens');
  }
  if (board.hexes.some((h) => (h.terrain === 'desert') !== (h.number === null))) {
    throw new Error('Desert must be the only hex without a number');
  }
  if (board.harbors.length !== mod.harborGaps.length) throw new Error(`Board must have ${mod.harborGaps.length} harbors`);
  if (board.hexes[board.robberHex].terrain !== 'desert') throw new Error('Robber must start on the desert');
}

/**
 * A fixed (printed) scenario board: hexes in map order with their printed
 * numbers, ports on the given hex sides, robber and pirate where shown.
 * Registers the map's layout under `layout` so its graph can be built.
 */
export function boardFromMap(
  map: ScenarioMap,
  layout: LayoutId,
  opts: { startRegions?: string[]; numberedOnly?: boolean; clothPerVillage?: number; buildRegions?: string[]; participants?: number } = {},
): Board {
  const { startRegions } = opts;
  const all = boardHexes(map);
  registerLayout(layout, all.map((h): [number, number] => [h.q, h.r]));
  const graph = graphFor(layout);
  const index = (q: number, r: number, what: string): number => {
    const i = all.findIndex((h) => h.q === q && h.r === r);
    if (i < 0) throw new Error(`${what} at (${q},${r}) is not on the map`);
    return i;
  };
  const hexes: HexTile[] = all.map((h, id) => ({
    id,
    terrain: h.t,
    number: h.n,
    ...(h.region && h.t !== 'sea' ? { region: h.region } : {}),
  }));
  const harbors: Harbor[] = map.ports.map((p) => ({ edge: hexSideEdge(graph, index(p.q, p.r, 'Port'), p.dir), type: p.type }));
  // Without a robber, `robberHex` points at a desert so production code needs no special case.
  const robberHex = map.robber ? index(map.robber[0], map.robber[1], 'Robber') : hexes.findIndex((h) => h.terrain === 'desert');
  if (hexes[robberHex].terrain === 'sea') throw new Error('The robber must start on land');
  const board: Board = { layout, hexes, harbors, robberHex, ...(startRegions ? { startRegions: [...startRegions] } : {}) };
  if (!map.robber) board.noRobber = true;
  if (map.pirate) {
    board.pirateHex = index(map.pirate[0], map.pirate[1], 'Pirate');
    if (hexes[board.pirateHex].terrain !== 'sea') throw new Error('The pirate must start on the sea');
  }
  if (opts.numberedOnly) board.numberedOnly = true;
  if (opts.buildRegions) board.buildRegions = [...opts.buildRegions];
  const corner = (c: MapCorner) => graph.hexes[index(c.q, c.r, 'Corner')].vertices[c.c];
  if (map.pirateIslands) {
    const pi = map.pirateIslands;
    board.pirateFleet = pi.path.map(([q, r]) => index(q, r, 'Pirate path'));
    const players = opts.participants ?? 4;
    const slots = players <= 3 ? pi.slots3.slice(0, players) : pi.slots.map((_, i) => i);
    board.fortresses = slots.map((slot, owner) => {
      const s = pi.slots[slot];
      return {
        owner,
        start: corner(s.start),
        startShip: hexSideEdge(graph, index(s.ship.q, s.ship.r, 'Ship'), s.ship.dir),
        beachhead: corner(s.beachhead),
        vertex: corner(s.fortress),
        lairs: 3,
      };
    });
  }
  if (map.wonderSpots) {
    board.wonderSpots = {
      wall: map.wonderSpots.wall.map(corner),
      bridge: map.wonderSpots.bridge.map(corner),
      blocked: map.wonderSpots.blocked.map(corner),
    };
  }
  if (map.edgeItems) {
    // Port types are dealt by createGame (shuffled); 'generic' is a placeholder.
    board.edgeItems = {};
    for (const it of map.edgeItems) {
      const edge = hexSideEdge(graph, index(it.q, it.r, 'Item'), it.dir);
      board.edgeItems[edge] = it.item === 'port' ? { kind: 'port', type: 'generic' } : { kind: it.item };
    }
  }
  if (map.villages) {
    board.villages = map.villages.map((vl) => {
      const h = graph.hexes[index(vl.q, vl.r, 'Village')];
      const ys = h.vertices.map((id) => graph.vertices[id].y);
      const y = vl.corner === 'top' ? Math.min(...ys) : Math.max(...ys);
      return { vertex: h.vertices.find((id) => graph.vertices[id].y === y)!, number: vl.n, cloth: opts.clothPerVillage ?? 0 };
    });
  }
  return board;
}
