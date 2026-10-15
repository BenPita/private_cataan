import { GRAPH, type PlayerView } from '@hex/engine';

/** Ways to roll each total with two dice (out of 36). */
export const WAYS: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

/** Chance (percent) that a single roll produces this number. */
export const numberOdds = (n: number) => Math.round(((WAYS[n] ?? 0) / 36) * 100);

/**
 * Chance (percent) that a roll gives something to a settlement on this spot:
 * the different numbers around it are mutually exclusive outcomes, so their
 * chances add up. Lands under the robber are left out.
 */
export function spotOdds(view: PlayerView, vertex: string): number {
  const numbers = new Set<number>();
  for (const h of GRAPH.vertices[vertex].hexes) {
    const tile = view.board.hexes[h];
    if (tile.number !== null && h !== view.board.robberHex) numbers.add(tile.number);
  }
  let ways = 0;
  for (const n of numbers) ways += WAYS[n];
  return Math.round((ways / 36) * 100);
}

export function oddsFor(view: PlayerView, vertices: string[]): Record<string, number> {
  return Object.fromEntries(vertices.map((v) => [v, spotOdds(view, v)]));
}
