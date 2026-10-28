import type { ScenarioMap } from './mapTypes';

/*
 * Scenario 1 "Heading for New Shores" (CATAN - Seafarers rulebook 2025, pp. 4-5),
 * transcribed hex by hex from the printed maps. Rows run top to bottom (r = 0 is
 * the top row); within a row hexes run left to right.
 *
 * Only the hex tiles placed inside the frame are listed; their per-terrain and
 * per-number counts match the component tables exactly. The widest (middle) row
 * of each map is flanked on both sides by a sea hex printed on the Seafarers
 * frame pieces (not a tile); the pirate is drawn on the right-hand one, so its
 * starting position lies on the frame, just outside `hexes`.
 */

/** 3-player map (rulebook p. 4): 22 land + 13 sea hexes, 8 ports. */
export const NEW_SHORES_3P: ScenarioMap = {
  hexes: [
    // row 0
    { q: 2, r: 0, t: 'hills', n: 12, region: 'isle1' },
    { q: 3, r: 0, t: 'gold', n: 5, region: 'isle1' },
    { q: 4, r: 0, t: 'sea', n: null },
    { q: 5, r: 0, t: 'sea', n: null },
    // row 1
    { q: 1, r: 1, t: 'sea', n: null },
    { q: 2, r: 1, t: 'sea', n: null },
    { q: 3, r: 1, t: 'sea', n: null },
    { q: 4, r: 1, t: 'pasture', n: 4, region: 'isle2' },
    { q: 5, r: 1, t: 'mountains', n: 9, region: 'isle2' },
    // row 2
    { q: 0, r: 2, t: 'sea', n: null },
    { q: 1, r: 2, t: 'fields', n: 4, region: 'main' },
    { q: 2, r: 2, t: 'pasture', n: 6, region: 'main' },
    { q: 3, r: 2, t: 'sea', n: null },
    { q: 4, r: 2, t: 'fields', n: 3, region: 'isle2' },
    { q: 5, r: 2, t: 'sea', n: null },
    // row 3
    { q: 0, r: 3, t: 'pasture', n: 2, region: 'main' },
    { q: 1, r: 3, t: 'mountains', n: 5, region: 'main' },
    { q: 2, r: 3, t: 'forest', n: 10, region: 'main' },
    { q: 3, r: 3, t: 'sea', n: null },
    { q: 4, r: 3, t: 'gold', n: 4, region: 'isle2' },
    // row 4
    { q: -1, r: 4, t: 'hills', n: 8, region: 'main' },
    { q: 0, r: 4, t: 'pasture', n: 10, region: 'main' },
    { q: 1, r: 4, t: 'pasture', n: 9, region: 'main' },
    { q: 2, r: 4, t: 'forest', n: 8, region: 'main' },
    { q: 3, r: 4, t: 'sea', n: null },
    { q: 4, r: 4, t: 'sea', n: null },
    // row 5
    { q: -1, r: 5, t: 'fields', n: 11, region: 'main' },
    { q: 0, r: 5, t: 'mountains', n: 3, region: 'main' },
    { q: 1, r: 5, t: 'hills', n: 11, region: 'main' },
    { q: 2, r: 5, t: 'sea', n: null },
    { q: 3, r: 5, t: 'mountains', n: 8, region: 'isle3' },
    // row 6
    { q: -1, r: 6, t: 'fields', n: 6, region: 'main' },
    { q: 0, r: 6, t: 'forest', n: 5, region: 'main' },
    { q: 1, r: 6, t: 'sea', n: null },
    { q: 2, r: 6, t: 'hills', n: 10, region: 'isle3' },
  ],
  ports: [
    { q: 1, r: 2, dir: 3, type: 'grain' },
    { q: 2, r: 2, dir: 0, type: 'generic' },
    { q: -1, r: 4, dir: 2, type: 'ore' },
    { q: -1, r: 4, dir: 4, type: 'generic' },
    { q: 2, r: 4, dir: 1, type: 'wool' },
    { q: -1, r: 6, dir: 3, type: 'brick' },
    { q: 0, r: 6, dir: 0, type: 'generic' },
    { q: 0, r: 6, dir: 4, type: 'lumber' },
  ],
  robber: [2, 0],
  pirate: [5, 3],
};

/** 4-player map (rulebook p. 5): 28 land + 14 sea hexes, 9 ports. */
export const NEW_SHORES_4P: ScenarioMap = {
  hexes: [
    // row 0
    { q: 2, r: 0, t: 'mountains', n: 8, region: 'isle1' },
    { q: 3, r: 0, t: 'pasture', n: 11, region: 'isle1' },
    { q: 4, r: 0, t: 'sea', n: null },
    { q: 5, r: 0, t: 'gold', n: 4, region: 'isle2' },
    { q: 6, r: 0, t: 'sea', n: null },
    // row 1
    { q: 1, r: 1, t: 'sea', n: null },
    { q: 2, r: 1, t: 'sea', n: null },
    { q: 3, r: 1, t: 'sea', n: null },
    { q: 4, r: 1, t: 'sea', n: null },
    { q: 5, r: 1, t: 'hills', n: 5, region: 'isle2' },
    { q: 6, r: 1, t: 'mountains', n: 2, region: 'isle2' },
    // row 2
    { q: 0, r: 2, t: 'sea', n: null },
    { q: 1, r: 2, t: 'pasture', n: 5, region: 'main' },
    { q: 2, r: 2, t: 'forest', n: 6, region: 'main' },
    { q: 3, r: 2, t: 'mountains', n: 4, region: 'main' },
    { q: 4, r: 2, t: 'sea', n: null },
    { q: 5, r: 2, t: 'forest', n: 9, region: 'isle2' },
    { q: 6, r: 2, t: 'sea', n: null },
    // row 3
    { q: 0, r: 3, t: 'fields', n: 12, region: 'main' },
    { q: 1, r: 3, t: 'hills', n: 11, region: 'main' },
    { q: 2, r: 3, t: 'fields', n: 3, region: 'main' },
    { q: 3, r: 3, t: 'pasture', n: 9, region: 'main' },
    { q: 4, r: 3, t: 'sea', n: null },
    { q: 5, r: 3, t: 'gold', n: 10, region: 'isle2' },
    // row 4
    { q: -1, r: 4, t: 'hills', n: 6, region: 'main' },
    { q: 0, r: 4, t: 'forest', n: 10, region: 'main' },
    { q: 1, r: 4, t: 'desert', n: null, region: 'main' },
    { q: 2, r: 4, t: 'fields', n: 11, region: 'main' },
    { q: 3, r: 4, t: 'forest', n: 5, region: 'main' },
    { q: 4, r: 4, t: 'sea', n: null },
    { q: 5, r: 4, t: 'sea', n: null },
    // row 5
    { q: -1, r: 5, t: 'mountains', n: 3, region: 'main' },
    { q: 0, r: 5, t: 'pasture', n: 4, region: 'main' },
    { q: 1, r: 5, t: 'hills', n: 9, region: 'main' },
    { q: 2, r: 5, t: 'pasture', n: 8, region: 'main' },
    { q: 3, r: 5, t: 'sea', n: null },
    { q: 4, r: 5, t: 'hills', n: 3, region: 'isle3' },
    // row 6
    { q: -1, r: 6, t: 'fields', n: 8, region: 'main' },
    { q: 0, r: 6, t: 'forest', n: 2, region: 'main' },
    { q: 1, r: 6, t: 'mountains', n: 10, region: 'main' },
    { q: 2, r: 6, t: 'sea', n: null },
    { q: 3, r: 6, t: 'fields', n: 6, region: 'isle3' },
  ],
  ports: [
    { q: 1, r: 2, dir: 3, type: 'generic' },
    { q: 3, r: 2, dir: 2, type: 'ore' },
    { q: 3, r: 3, dir: 1, type: 'generic' },
    { q: -1, r: 4, dir: 2, type: 'wool' },
    { q: -1, r: 4, dir: 4, type: 'brick' },
    { q: 3, r: 4, dir: 5, type: 'grain' },
    { q: -1, r: 6, dir: 3, type: 'generic' },
    { q: 0, r: 6, dir: 4, type: 'lumber' },
    { q: 1, r: 6, dir: 0, type: 'generic' },
  ],
  robber: [1, 4],
  pirate: [6, 3],
};
