import { boardGraph } from './geometry';
import { RESOURCES, type Board, type Building, type Resource } from './types';

/** The public part of the board, shared by the full state and player views. */
export interface BoardState {
  board: Board;
  buildings: Record<string, Building>;
  roads: Record<string, number>;
  /** Seafarers ships (edge → owner); missing on boards without ships. */
  ships?: Record<string, number>;
}

const isSeaHex = (board: Board, hex: number) => board.hexes[hex].terrain === 'sea';

/** Does the vertex touch at least one land hex? (Always true on base boards.) */
export function vertexOnLand(s: BoardState, vertex: string): boolean {
  const v = boardGraph(s.board).vertices[vertex];
  return !!v && v.hexes.some((h) => !isSeaHex(s.board, h));
}

/** Roads need at least one adjacent land hex. */
export function isRoadEdge(s: BoardState, edge: string): boolean {
  const e = boardGraph(s.board).edges[edge];
  return !!e && e.hexes.some((h) => !isSeaHex(s.board, h));
}

/** Ships need a sea hex on at least one side; outside the map (the frame) counts as sea. */
export function isShipEdge(s: BoardState, edge: string): boolean {
  const e = boardGraph(s.board).edges[edge];
  return !!e && (e.hexes.length < 2 || e.hexes.some((h) => isSeaHex(s.board, h)));
}

/** Edges of the hex holding the pirate (no ship may be placed on or moved from them). */
export function pirateEdges(s: BoardState): string[] {
  const hex = s.board.pirateHex;
  return hex === undefined ? [] : boardGraph(s.board).hexes[hex].edges;
}

/** Land region of a vertex (Seafarers), or null on boards without regions / pure sea. */
export function vertexRegion(s: BoardState, vertex: string): string | null {
  const v = boardGraph(s.board).vertices[vertex];
  if (!v) return null;
  for (const h of v.hexes) {
    const region = s.board.hexes[h].region;
    if (region && !isSeaHex(s.board, h)) return region;
  }
  return null;
}

/** Distance rule: vertex is on land, empty, and no adjacent vertex holds a building. */
export function satisfiesDistanceRule(s: BoardState, vertex: string): boolean {
  const G = boardGraph(s.board);
  const v = G.vertices[vertex];
  if (!v || s.buildings[vertex]) return false;
  if (!v.hexes.some((h) => !isSeaHex(s.board, h))) return false;
  return v.neighbors.every((n) => !s.buildings[n]);
}

/** Scenario limit on starting settlements: every land hex at the vertex is in an allowed region. */
export function inStartRegion(s: BoardState, vertex: string): boolean {
  const allowed = s.board.startRegions;
  if (!allowed) return true;
  const v = boardGraph(s.board).vertices[vertex];
  if (!v) return false;
  const land = v.hexes.filter((h) => !isSeaHex(s.board, h));
  return land.length > 0 && land.every((h) => allowed.includes(s.board.hexes[h].region ?? ''));
}

export function legalSetupSettlements(s: BoardState): string[] {
  const G = boardGraph(s.board);
  return G.vertexIds.filter((v) => satisfiesDistanceRule(s, v) && inStartRegion(s, v));
}

export function legalSetupRoads(s: BoardState, settlementVertex: string): string[] {
  const G = boardGraph(s.board);
  const v = G.vertices[settlementVertex];
  if (!v) return [];
  return v.edges.filter((e) => s.roads[e] === undefined && s.ships?.[e] === undefined && isRoadEdge(s, e));
}

/** Seafarers: edges where a coastal starting settlement may take a ship instead of a road. */
export function legalSetupShips(s: BoardState, settlementVertex: string): string[] {
  const G = boardGraph(s.board);
  const v = G.vertices[settlementVertex];
  if (!v) return [];
  const pirate = pirateEdges(s);
  return v.edges.filter(
    (e) => s.roads[e] === undefined && s.ships?.[e] === undefined && isShipEdge(s, e) && !pirate.includes(e),
  );
}

/** Can `player`'s road network continue through `vertex`? */
function canPassThrough(s: BoardState, vertex: string, player: number): boolean {
  const b = s.buildings[vertex];
  return !b || b.owner === player;
}

export function isRoadConnected(s: BoardState, player: number, edge: string): boolean {
  const G = boardGraph(s.board);
  const e = G.edges[edge];
  if (!e) return false;
  return e.vertices.some((v) => {
    const b = s.buildings[v];
    if (b && b.owner === player) return true;
    if (!canPassThrough(s, v, player)) return false;
    return G.vertices[v].edges.some((other) => other !== edge && s.roads[other] === player);
  });
}

export function legalRoads(s: BoardState, player: number): string[] {
  const G = boardGraph(s.board);
  return G.edgeIds.filter(
    (e) => s.roads[e] === undefined && s.ships?.[e] === undefined && isRoadEdge(s, e) && isRoadConnected(s, player, e),
  );
}

/**
 * A ship connects to one of the player's buildings, or to one of their ships
 * through a vertex without an opponent's building (never to a road).
 * `ignore` is a ship edge treated as absent (the ship being moved).
 */
export function isShipConnected(s: BoardState, player: number, edge: string, ignore?: string): boolean {
  const G = boardGraph(s.board);
  const e = G.edges[edge];
  if (!e) return false;
  const ships = s.ships ?? {};
  return e.vertices.some((v) => {
    const b = s.buildings[v];
    if (b && b.owner === player) return true;
    if (!canPassThrough(s, v, player)) return false;
    return G.vertices[v].edges.some((other) => other !== edge && other !== ignore && ships[other] === player);
  });
}

/** Can `player` place a ship on `edge` (ignoring cost and piece count)? `ignore` = ship being moved. */
export function canPlaceShip(s: BoardState, player: number, edge: string, ignore?: string): boolean {
  return (
    !!boardGraph(s.board).edges[edge] &&
    s.roads[edge] === undefined &&
    (s.ships?.[edge] === undefined || edge === ignore) &&
    isShipEdge(s, edge) &&
    !pirateEdges(s).includes(edge) &&
    isShipConnected(s, player, edge, ignore)
  );
}

export function legalShips(s: BoardState, player: number): string[] {
  const G = boardGraph(s.board);
  return G.edgeIds.filter((e) => canPlaceShip(s, player, e));
}

/** A ship end is open when it touches neither another of the owner's ships nor one of their buildings. */
export function shipHasOpenEnd(s: BoardState, player: number, edge: string): boolean {
  const G = boardGraph(s.board);
  const ships = s.ships ?? {};
  return G.edges[edge].vertices.some(
    (v) => s.buildings[v]?.owner !== player && !G.vertices[v].edges.some((o) => o !== edge && ships[o] === player),
  );
}

/**
 * Is the ship part of a continuous line of the owner's ships linking two of
 * their buildings? Opponent buildings on the line do not interrupt it.
 */
export function shipLinksBuildings(s: BoardState, player: number, edge: string): boolean {
  const G = boardGraph(s.board);
  const ships = s.ships ?? {};
  const reach = (start: string): Set<string> => {
    const found = new Set<string>();
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const v = queue.shift()!;
      if (s.buildings[v]?.owner === player) {
        found.add(v);
        continue;
      }
      for (const o of G.vertices[v].edges) {
        if (o === edge || ships[o] !== player) continue;
        const [a, b] = G.edges[o].vertices;
        const next = a === v ? b : a;
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return found;
  };
  const [a, b] = G.edges[edge].vertices;
  const ra = reach(a);
  const rb = reach(b);
  for (const x of ra) for (const y of rb) if (x !== y) return true;
  return false;
}

/** Why `player` may not move the ship on `edge` (the once-per-turn limit aside), or null. */
export function shipMoveBlock(s: BoardState & { newShips?: string[] }, player: number, edge: string): string | null {
  if (s.ships?.[edge] !== player) return 'That is not your ship';
  if (s.newShips?.includes(edge)) return 'A ship built this turn cannot move';
  if (pirateEdges(s).includes(edge)) return 'Ships next to the pirate cannot move';
  if (!shipHasOpenEnd(s, player, edge)) return 'Only a ship with an open end can move';
  if (shipLinksBuildings(s, player, edge)) return 'This ship links two of your buildings';
  return null;
}

/** Ships the player could move (ignoring whether they already moved one this turn). */
export function movableShips(s: BoardState & { newShips?: string[] }, player: number): string[] {
  return Object.keys(s.ships ?? {}).filter((e) => shipMoveBlock(s, player, e) === null);
}

/** Where the ship on `from` may be moved to. */
export function legalShipMoves(s: BoardState, player: number, from: string): string[] {
  const G = boardGraph(s.board);
  return G.edgeIds.filter((e) => e !== from && canPlaceShip(s, player, e, from));
}

export function legalSettlements(s: BoardState, player: number): string[] {
  const G = boardGraph(s.board);
  const ships = s.ships ?? {};
  return G.vertexIds.filter(
    (v) => satisfiesDistanceRule(s, v) && G.vertices[v].edges.some((e) => s.roads[e] === player || ships[e] === player),
  );
}

export function legalCities(s: BoardState, player: number): string[] {
  const G = boardGraph(s.board);
  return G.vertexIds.filter((v) => {
    const b = s.buildings[v];
    return b && b.owner === player && b.type === 'settlement';
  });
}

/** Best bank exchange rate per resource (4, 3 with a generic harbor, 2 with a matching harbor). */
export function tradeRates(s: BoardState, player: number): Record<Resource, number> {
  const G = boardGraph(s.board);
  const rates = { lumber: 4, brick: 4, wool: 4, grain: 4, ore: 4 };
  for (const h of s.board.harbors) {
    const owned = G.edges[h.edge].vertices.some((v) => s.buildings[v]?.owner === player);
    if (!owned) continue;
    if (h.type === 'generic') {
      for (const r of RESOURCES) rates[r] = Math.min(rates[r], 3);
    } else {
      rates[h.type] = 2;
    }
  }
  return rates;
}

/**
 * Longest continuous road (Seafarers: route of roads and ships) for a player:
 * the longest trail (each edge used at most once, branches allowed, loops
 * allowed) that does not pass through a vertex holding an opponent's
 * building. A road and a ship only join at a vertex holding one of the
 * player's own buildings.
 */
export function longestRoadLength(s: BoardState, player: number): number {
  const G = boardGraph(s.board);
  const ships = s.ships ?? {};
  const kind = (e: string): 'road' | 'ship' | null =>
    s.roads[e] === player ? 'road' : ships[e] === player ? 'ship' : null;
  const myEdges = G.edgeIds.filter((e) => kind(e) !== null);
  if (myEdges.length === 0) return 0;
  const used = new Set<string>();
  let best = 0;

  const dfs = (vertex: string, length: number, last: 'road' | 'ship' | null) => {
    if (length > best) best = length;
    if (length > 0 && !canPassThrough(s, vertex, player)) return;
    const ownBuilding = s.buildings[vertex]?.owner === player;
    for (const e of G.vertices[vertex].edges) {
      const k = kind(e);
      if (k === null || used.has(e)) continue;
      if (last !== null && k !== last && !ownBuilding) continue;
      used.add(e);
      const [a, b] = G.edges[e].vertices;
      dfs(a === vertex ? b : a, length + 1, k);
      used.delete(e);
    }
  };

  const startVertices = new Set(myEdges.flatMap((e) => G.edges[e].vertices));
  for (const v of startVertices) dfs(v, 0, null);
  return best;
}

/** Players with a ship on an edge of `hex` — the pirate's possible victims there. */
export function shipOwnersOnHex(s: BoardState, hex: number): number[] {
  const G = boardGraph(s.board);
  const owners = new Set<number>();
  for (const e of G.hexes[hex].edges) {
    const o = s.ships?.[e];
    if (o !== undefined) owners.add(o);
  }
  return [...owners].sort((a, b) => a - b);
}

/** Players (other than `player`) with a building on `hex`. */
export function playersOnHex(s: BoardState, hex: number): number[] {
  const G = boardGraph(s.board);
  const owners = new Set<number>();
  for (const v of G.hexes[hex].vertices) {
    const b = s.buildings[v];
    if (b) owners.add(b.owner);
  }
  return [...owners].sort((a, b) => a - b);
}
