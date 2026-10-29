import type { ScenarioMap } from './mapTypes';

/*
 * Scenario 3 "The Fog Islands" (CATAN - Seafarers rulebook 2025, pp. 8-9), same
 * conventions as maps.ts. Both maps use the 4-player frame (42 spaces, the rows
 * of New Shores 4p). The white spaces are left empty (`fog`) and filled from the
 * face-down stack when discovered. The pirate is drawn on the frame: right of
 * the bottom row (3p) or below it (4p). Regions only name the two islands.
 */

/** 3-player map (rulebook p. 8): 14 land + 16 sea hexes face up, 12 empty spaces, 8 ports. */
export const FOG_ISLANDS_3P: ScenarioMap = {
  hexes: [
    // row 0
    { q: 2, r: 0, t: 'fog', n: null },
    { q: 3, r: 0, t: 'fog', n: null },
    { q: 4, r: 0, t: 'sea', n: null },
    { q: 5, r: 0, t: 'hills', n: 6, region: 'east' },
    { q: 6, r: 0, t: 'forest', n: 11, region: 'east' },
    // row 1
    { q: 1, r: 1, t: 'fog', n: null },
    { q: 2, r: 1, t: 'fog', n: null },
    { q: 3, r: 1, t: 'fog', n: null },
    { q: 4, r: 1, t: 'sea', n: null },
    { q: 5, r: 1, t: 'forest', n: 5, region: 'east' },
    { q: 6, r: 1, t: 'fields', n: 3, region: 'east' },
    // row 2
    { q: 0, r: 2, t: 'sea', n: null },
    { q: 1, r: 2, t: 'sea', n: null },
    { q: 2, r: 2, t: 'sea', n: null },
    { q: 3, r: 2, t: 'fog', n: null },
    { q: 4, r: 2, t: 'sea', n: null },
    { q: 5, r: 2, t: 'pasture', n: 8, region: 'east' },
    { q: 6, r: 2, t: 'pasture', n: 9, region: 'east' },
    // row 3
    { q: 0, r: 3, t: 'forest', n: 6, region: 'west' },
    { q: 1, r: 3, t: 'pasture', n: 5, region: 'west' },
    { q: 2, r: 3, t: 'sea', n: null },
    { q: 3, r: 3, t: 'fog', n: null },
    { q: 4, r: 3, t: 'sea', n: null },
    { q: 5, r: 3, t: 'mountains', n: 4, region: 'east' },
    // row 4
    { q: -1, r: 4, t: 'sea', n: null },
    { q: 0, r: 4, t: 'hills', n: 11, region: 'west' },
    { q: 1, r: 4, t: 'forest', n: 9, region: 'west' },
    { q: 2, r: 4, t: 'sea', n: null },
    { q: 3, r: 4, t: 'fog', n: null },
    { q: 4, r: 4, t: 'sea', n: null },
    { q: 5, r: 4, t: 'sea', n: null },
    // row 5
    { q: -1, r: 5, t: 'sea', n: null },
    { q: 0, r: 5, t: 'mountains', n: 8, region: 'west' },
    { q: 1, r: 5, t: 'fields', n: 10, region: 'west' },
    { q: 2, r: 5, t: 'sea', n: null },
    { q: 3, r: 5, t: 'fog', n: null },
    { q: 4, r: 5, t: 'fog', n: null },
    // row 6
    { q: -1, r: 6, t: 'sea', n: null },
    { q: 0, r: 6, t: 'pasture', n: 12, region: 'west' },
    { q: 1, r: 6, t: 'sea', n: null },
    { q: 2, r: 6, t: 'fog', n: null },
    { q: 3, r: 6, t: 'fog', n: null },
  ],
  ports: [
    { q: 5, r: 0, dir: 1, type: 'generic' },
    { q: 6, r: 0, dir: 0, type: 'wool' },
    { q: 6, r: 2, dir: 1, type: 'grain' },
    { q: 5, r: 3, dir: 0, type: 'generic' },
    { q: 0, r: 3, dir: 4, type: 'ore' },
    { q: 0, r: 4, dir: 4, type: 'lumber' },
    { q: 1, r: 5, dir: 5, type: 'brick' },
    { q: 0, r: 6, dir: 3, type: 'generic' },
  ],
  robber: [0, 6],
  pirate: [4, 6],
  frameSea: [[-1, 3], [6, 3], [4, 6]],
};

/** 4-player map (rulebook p. 9): 17 land + 13 sea hexes face up, 12 empty spaces, 9 ports. */
export const FOG_ISLANDS_4P: ScenarioMap = {
  hexes: [
    // row 0
    { q: 2, r: 0, t: 'fog', n: null },
    { q: 3, r: 0, t: 'sea', n: null },
    { q: 4, r: 0, t: 'hills', n: 4, region: 'east' },
    { q: 5, r: 0, t: 'fields', n: 10, region: 'east' },
    { q: 6, r: 0, t: 'mountains', n: 3, region: 'east' },
    // row 1
    { q: 1, r: 1, t: 'fog', n: null },
    { q: 2, r: 1, t: 'fog', n: null },
    { q: 3, r: 1, t: 'sea', n: null },
    { q: 4, r: 1, t: 'pasture', n: 9, region: 'east' },
    { q: 5, r: 1, t: 'forest', n: 6, region: 'east' },
    { q: 6, r: 1, t: 'hills', n: 12, region: 'east' },
    // row 2
    { q: 0, r: 2, t: 'sea', n: null },
    { q: 1, r: 2, t: 'sea', n: null },
    { q: 2, r: 2, t: 'fog', n: null },
    { q: 3, r: 2, t: 'sea', n: null },
    { q: 4, r: 2, t: 'sea', n: null },
    { q: 5, r: 2, t: 'pasture', n: 10, region: 'east' },
    { q: 6, r: 2, t: 'mountains', n: 8, region: 'east' },
    // row 3
    { q: 0, r: 3, t: 'mountains', n: 3, region: 'west' },
    { q: 1, r: 3, t: 'sea', n: null },
    { q: 2, r: 3, t: 'fog', n: null },
    { q: 3, r: 3, t: 'fog', n: null },
    { q: 4, r: 3, t: 'sea', n: null },
    { q: 5, r: 3, t: 'fields', n: 11, region: 'east' },
    // row 4
    { q: -1, r: 4, t: 'fields', n: 6, region: 'west' },
    { q: 0, r: 4, t: 'forest', n: 4, region: 'west' },
    { q: 1, r: 4, t: 'sea', n: null },
    { q: 2, r: 4, t: 'fog', n: null },
    { q: 3, r: 4, t: 'fog', n: null },
    { q: 4, r: 4, t: 'sea', n: null },
    { q: 5, r: 4, t: 'forest', n: 5, region: 'east' },
    // row 5
    { q: -1, r: 5, t: 'hills', n: 9, region: 'west' },
    { q: 0, r: 5, t: 'pasture', n: 8, region: 'west' },
    { q: 1, r: 5, t: 'sea', n: null },
    { q: 2, r: 5, t: 'fog', n: null },
    { q: 3, r: 5, t: 'fog', n: null },
    { q: 4, r: 5, t: 'sea', n: null },
    // row 6
    { q: -1, r: 6, t: 'pasture', n: 2, region: 'west' },
    { q: 0, r: 6, t: 'forest', n: 5, region: 'west' },
    { q: 1, r: 6, t: 'sea', n: null },
    { q: 2, r: 6, t: 'fog', n: null },
    { q: 3, r: 6, t: 'fog', n: null },
  ],
  ports: [
    { q: 4, r: 0, dir: 1, type: 'wool' },
    { q: 6, r: 0, dir: 2, type: 'grain' },
    { q: 6, r: 0, dir: 0, type: 'generic' },
    { q: 6, r: 2, dir: 1, type: 'brick' },
    { q: 5, r: 4, dir: 1, type: 'generic' },
    { q: 0, r: 3, dir: 3, type: 'lumber' },
    { q: -1, r: 4, dir: 4, type: 'ore' },
    { q: -1, r: 6, dir: 3, type: 'generic' },
    { q: -1, r: 6, dir: 5, type: 'generic' },
  ],
  robber: [6, 1],
  pirate: [2, 7],
  frameSea: [[-1, 3], [6, 3], [2, 7]],
};
