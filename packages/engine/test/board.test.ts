import { describe, expect, it } from 'vitest';
import { GRAPH, Rng, generateBeginnerBoard, generateRandomBoard, hasAdjacentRedNumbers, validateBoard } from '../src';

describe('board graph', () => {
  it('has the classic island dimensions', () => {
    expect(GRAPH.hexes).toHaveLength(19);
    expect(GRAPH.vertexIds).toHaveLength(54);
    expect(GRAPH.edgeIds).toHaveLength(72);
    expect(GRAPH.coastalEdges).toHaveLength(30);
  });

  it('has rows of 3-4-5-4-3', () => {
    const rows: Record<number, number> = {};
    for (const h of GRAPH.hexes) rows[h.r] = (rows[h.r] ?? 0) + 1;
    expect([rows[-2], rows[-1], rows[0], rows[1], rows[2]]).toEqual([3, 4, 5, 4, 3]);
  });

  it('links vertices, edges and hexes consistently', () => {
    for (const v of Object.values(GRAPH.vertices)) {
      expect(v.hexes.length).toBeGreaterThanOrEqual(1);
      expect(v.hexes.length).toBeLessThanOrEqual(3);
      expect(v.neighbors.length).toBe(v.edges.length);
      for (const e of v.edges) expect(GRAPH.edges[e].vertices).toContain(v.id);
    }
    for (const h of GRAPH.hexes) {
      expect(h.vertices).toHaveLength(6);
      expect(h.edges).toHaveLength(6);
    }
  });
});

describe('board generation', () => {
  it('generates valid balanced boards for many seeds', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const board = generateRandomBoard(new Rng(seed));
      expect(() => validateBoard(board)).not.toThrow();
      expect(hasAdjacentRedNumbers(board.hexes)).toBe(false);
      expect(board.hexes[board.robberHex].terrain).toBe('desert');
      const types = board.harbors.map((h) => h.type);
      expect(types.filter((t) => t === 'generic')).toHaveLength(4);
      expect(new Set(board.harbors.map((h) => h.edge)).size).toBe(9);
    }
  });

  it('is deterministic for the same seed', () => {
    expect(generateRandomBoard(new Rng(7))).toEqual(generateRandomBoard(new Rng(7)));
  });

  it('offers a valid fixed beginner board', () => {
    expect(() => validateBoard(generateBeginnerBoard())).not.toThrow();
  });
});
