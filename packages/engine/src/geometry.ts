/**
 * Board graphs. Each layout (list of axial hex coordinates) has its own graph;
 * the classic one is the 3-4-5-4-3 island, classic56 the 3-4-5-6-5-4-3 island
 * of the 5–6 player game. Every graph is centred on the centroid of its hexes.
 *
 * Hexes use pointy-top axial coordinates. Vertices and edges are derived once
 * from hex corner positions and given stable, sorted ids ("v0".."v53",
 * "e0".."e71"). Rules code works only with this graph, never with pixels;
 * the pixel positions are exported for rendering.
 */

import type { Board, LayoutId } from './types';

export interface HexGeo {
  id: number;
  q: number;
  r: number;
  x: number;
  y: number;
  vertices: string[];
  edges: string[];
  neighbors: number[];
}

export interface VertexGeo {
  id: string;
  x: number;
  y: number;
  hexes: number[];
  edges: string[];
  neighbors: string[];
}

export interface EdgeGeo {
  id: string;
  vertices: [string, string];
  hexes: number[];
  x: number;
  y: number;
}

export interface BoardGraph {
  hexes: HexGeo[];
  vertices: Record<string, VertexGeo>;
  edges: Record<string, EdgeGeo>;
  vertexIds: string[];
  edgeIds: string[];
  /** Coastal edges (touching exactly one land hex) in clockwise order around the island. */
  coastalEdges: string[];
}

const SQRT3 = Math.sqrt(3);

function classicCoords(): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  for (let r = -2; r <= 2; r++) {
    for (let q = -2; q <= 2; q++) {
      const s = -q - r;
      if (Math.abs(s) <= 2) coords.push([q, r]);
    }
  }
  return coords;
}

/** The 5–6 player island: rows 3-4-5-6-5-4-3 (row r has 6-|r| hexes). */
function classic56Coords(): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  for (let r = -3; r <= 3; r++) {
    const start = r <= 0 ? -3 - r : -3;
    for (let q = start; q < start + 6 - Math.abs(r); q++) coords.push([q, r]);
  }
  return coords;
}

function key(x: number, y: number): string {
  return `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
}

function buildGraph(coords: Array<[number, number]>): BoardGraph {
  const rawVertices = new Map<string, { x: number; y: number; hexes: Set<number> }>();
  const hexCorners: string[][] = [];
  const centre = (q: number, r: number) => ({ x: SQRT3 * (q + r / 2), y: 1.5 * r });
  // Centroid offset, snapped to 0 for symmetric islands so classic stays bit-identical.
  const snap = (n: number) => (Math.abs(n) < 1e-9 ? 0 : n);
  const ox = snap(coords.reduce((s, [q, r]) => s + centre(q, r).x, 0) / coords.length);
  const oy = snap(coords.reduce((s, [q, r]) => s + centre(q, r).y, 0) / coords.length);

  coords.forEach(([q, r], hexId) => {
    const cx = centre(q, r).x - ox;
    const cy = centre(q, r).y - oy;
    const corners: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 90);
      const x = cx + Math.cos(angle);
      const y = cy + Math.sin(angle);
      const k = key(x, y);
      if (!rawVertices.has(k)) rawVertices.set(k, { x, y, hexes: new Set() });
      rawVertices.get(k)!.hexes.add(hexId);
      corners.push(k);
    }
    hexCorners.push(corners);
  });

  // Stable vertex ids: sorted top-to-bottom, then left-to-right.
  const sortedKeys = [...rawVertices.keys()].sort((a, b) => {
    const va = rawVertices.get(a)!;
    const vb = rawVertices.get(b)!;
    return Math.abs(va.y - vb.y) > 1e-6 ? va.y - vb.y : va.x - vb.x;
  });
  const vid = new Map<string, string>();
  sortedKeys.forEach((k, i) => vid.set(k, `v${i}`));

  const vertices: Record<string, VertexGeo> = {};
  for (const k of sortedKeys) {
    const raw = rawVertices.get(k)!;
    vertices[vid.get(k)!] = {
      id: vid.get(k)!,
      x: raw.x,
      y: raw.y,
      hexes: [...raw.hexes].sort((a, b) => a - b),
      edges: [],
      neighbors: [],
    };
  }

  // Edges between consecutive hex corners.
  const rawEdges = new Map<string, { a: string; b: string; hexes: Set<number> }>();
  hexCorners.forEach((corners, hexId) => {
    for (let i = 0; i < 6; i++) {
      const a = vid.get(corners[i])!;
      const b = vid.get(corners[(i + 1) % 6])!;
      const [lo, hi] = Number(a.slice(1)) < Number(b.slice(1)) ? [a, b] : [b, a];
      const k = `${lo}-${hi}`;
      if (!rawEdges.has(k)) rawEdges.set(k, { a: lo, b: hi, hexes: new Set() });
      rawEdges.get(k)!.hexes.add(hexId);
    }
  });
  const edgeKeys = [...rawEdges.keys()].sort((ka, kb) => {
    const ea = rawEdges.get(ka)!;
    const eb = rawEdges.get(kb)!;
    const ya = (vertices[ea.a].y + vertices[ea.b].y) / 2;
    const yb = (vertices[eb.a].y + vertices[eb.b].y) / 2;
    if (Math.abs(ya - yb) > 1e-6) return ya - yb;
    return (vertices[ea.a].x + vertices[ea.b].x) / 2 - (vertices[eb.a].x + vertices[eb.b].x) / 2;
  });

  const edges: Record<string, EdgeGeo> = {};
  const edgeIdByKey = new Map<string, string>();
  edgeKeys.forEach((k, i) => {
    const raw = rawEdges.get(k)!;
    const id = `e${i}`;
    edgeIdByKey.set(k, id);
    edges[id] = {
      id,
      vertices: [raw.a, raw.b],
      hexes: [...raw.hexes].sort((a, b) => a - b),
      x: (vertices[raw.a].x + vertices[raw.b].x) / 2,
      y: (vertices[raw.a].y + vertices[raw.b].y) / 2,
    };
    vertices[raw.a].edges.push(id);
    vertices[raw.b].edges.push(id);
    vertices[raw.a].neighbors.push(raw.b);
    vertices[raw.b].neighbors.push(raw.a);
  });

  const hexes: HexGeo[] = coords.map(([q, r], id) => {
    const vs = hexCorners[id].map((k) => vid.get(k)!);
    const es: string[] = [];
    for (let i = 0; i < 6; i++) {
      const a = vs[i];
      const b = vs[(i + 1) % 6];
      const [lo, hi] = Number(a.slice(1)) < Number(b.slice(1)) ? [a, b] : [b, a];
      es.push(edgeIdByKey.get(`${lo}-${hi}`)!);
    }
    return { id, q, r, x: centre(q, r).x - ox, y: centre(q, r).y - oy, vertices: vs, edges: es, neighbors: [] };
  });
  for (const h of hexes) {
    h.neighbors = hexes
      .filter((o) => o.id !== h.id && o.vertices.filter((v) => h.vertices.includes(v)).length === 2)
      .map((o) => o.id);
  }

  const coastalEdges = Object.values(edges)
    .filter((e) => e.hexes.length === 1)
    .sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x))
    .map((e) => e.id);

  return {
    hexes,
    vertices,
    edges,
    vertexIds: Object.keys(vertices),
    edgeIds: Object.keys(edges),
    coastalEdges,
  };
}

const LAYOUTS: Record<LayoutId, () => Array<[number, number]>> = {
  classic: classicCoords,
  classic56: classic56Coords,
};

const graphs = new Map<LayoutId, BoardGraph>();

/** The (cached) graph of a layout. Graphs are immutable; share freely. */
export function graphFor(layout: LayoutId): BoardGraph {
  let g = graphs.get(layout);
  if (!g) {
    g = buildGraph(LAYOUTS[layout]());
    graphs.set(layout, g);
  }
  return g;
}

/** The graph a board is played on. */
export function boardGraph(board: Pick<Board, 'layout'>): BoardGraph {
  return graphFor(board.layout ?? 'classic');
}

/** Half-width and half-height of a graph (max |x| and |y| of its vertices), for sizing renderers. */
export function graphBounds(graph: BoardGraph): { maxX: number; maxY: number } {
  const vs = Object.values(graph.vertices);
  return { maxX: Math.max(...vs.map((v) => Math.abs(v.x))), maxY: Math.max(...vs.map((v) => Math.abs(v.y))) };
}

/** The classic 19-hex graph. Kept for tests; game code uses boardGraph(). */
export const GRAPH: BoardGraph = graphFor('classic');
