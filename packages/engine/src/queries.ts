import { GRAPH } from './geometry';
import { RESOURCES, type Board, type Building, type Resource } from './types';

/** The public part of the board, shared by the full state and player views. */
export interface BoardState {
  board: Board;
  buildings: Record<string, Building>;
  roads: Record<string, number>;
}

/** Distance rule: vertex is empty and no adjacent vertex holds a building. */
export function satisfiesDistanceRule(s: BoardState, vertex: string): boolean {
  const v = GRAPH.vertices[vertex];
  if (!v || s.buildings[vertex]) return false;
  return v.neighbors.every((n) => !s.buildings[n]);
}

export function legalSetupSettlements(s: BoardState): string[] {
  return GRAPH.vertexIds.filter((v) => satisfiesDistanceRule(s, v));
}

export function legalSetupRoads(s: BoardState, settlementVertex: string): string[] {
  const v = GRAPH.vertices[settlementVertex];
  if (!v) return [];
  return v.edges.filter((e) => s.roads[e] === undefined);
}

/** Can `player`'s road network continue through `vertex`? */
function canPassThrough(s: BoardState, vertex: string, player: number): boolean {
  const b = s.buildings[vertex];
  return !b || b.owner === player;
}

export function isRoadConnected(s: BoardState, player: number, edge: string): boolean {
  const e = GRAPH.edges[edge];
  if (!e) return false;
  return e.vertices.some((v) => {
    const b = s.buildings[v];
    if (b && b.owner === player) return true;
    if (!canPassThrough(s, v, player)) return false;
    return GRAPH.vertices[v].edges.some((other) => other !== edge && s.roads[other] === player);
  });
}

export function legalRoads(s: BoardState, player: number): string[] {
  return GRAPH.edgeIds.filter((e) => s.roads[e] === undefined && isRoadConnected(s, player, e));
}

export function legalSettlements(s: BoardState, player: number): string[] {
  return GRAPH.vertexIds.filter(
    (v) => satisfiesDistanceRule(s, v) && GRAPH.vertices[v].edges.some((e) => s.roads[e] === player),
  );
}

export function legalCities(s: BoardState, player: number): string[] {
  return GRAPH.vertexIds.filter((v) => {
    const b = s.buildings[v];
    return b && b.owner === player && b.type === 'settlement';
  });
}

/** Best bank exchange rate per resource (4, 3 with a generic harbor, 2 with a matching harbor). */
export function tradeRates(s: BoardState, player: number): Record<Resource, number> {
  const rates = { lumber: 4, brick: 4, wool: 4, grain: 4, ore: 4 };
  for (const h of s.board.harbors) {
    const owned = GRAPH.edges[h.edge].vertices.some((v) => s.buildings[v]?.owner === player);
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
 * Longest continuous road for a player: the longest trail (each edge used at
 * most once, branches allowed, loops allowed) that does not pass through a
 * vertex holding an opponent's building.
 */
export function longestRoadLength(s: BoardState, player: number): number {
  const myEdges = GRAPH.edgeIds.filter((e) => s.roads[e] === player);
  if (myEdges.length === 0) return 0;
  const used = new Set<string>();
  let best = 0;

  const dfs = (vertex: string, length: number) => {
    if (length > best) best = length;
    if (length > 0 && !canPassThrough(s, vertex, player)) return;
    for (const e of GRAPH.vertices[vertex].edges) {
      if (s.roads[e] !== player || used.has(e)) continue;
      used.add(e);
      const [a, b] = GRAPH.edges[e].vertices;
      dfs(a === vertex ? b : a, length + 1);
      used.delete(e);
    }
  };

  const startVertices = new Set(myEdges.flatMap((e) => GRAPH.edges[e].vertices));
  for (const v of startVertices) dfs(v, 0);
  return best;
}

/** Players (other than `player`) with a building on `hex`. */
export function playersOnHex(s: BoardState, hex: number): number[] {
  const owners = new Set<number>();
  for (const v of GRAPH.hexes[hex].vertices) {
    const b = s.buildings[v];
    if (b) owners.add(b.owner);
  }
  return [...owners].sort((a, b) => a - b);
}
