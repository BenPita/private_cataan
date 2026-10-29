import type { ScenarioMap } from './mapTypes';

/*
 * Scenarios 5 and 6 (CATAN - Seafarers rulebook 2025, pp. 12-15), same conventions
 * as maps.ts. Each has one map for 3 and 4 players. Both print their middle row
 * flanked by frame sea spaces.
 */

/**
 * "The Forgotten Tribe" (pp. 12-13): a 49-space frame (rows of 6-7-8-7-8-7-6).
 * Only the large island carries number discs; the small islands hold the tribe's
 * gifts on their sea edges: 8 VP tokens, 4 face-down development cards and 6
 * ports ("?", shuffled), taken by the first ship built or moved onto that edge.
 */
export const FORGOTTEN_TRIBE: ScenarioMap = {
  hexes: [
    // row 0
    { q: 2, r: 0, t: 'gold', n: null, region: 'isle1' },
    { q: 3, r: 0, t: 'mountains', n: null, region: 'isle1' },
    { q: 4, r: 0, t: 'sea', n: null },
    { q: 5, r: 0, t: 'desert', n: null, region: 'isle2' },
    { q: 6, r: 0, t: 'mountains', n: null, region: 'isle2' },
    { q: 7, r: 0, t: 'fields', n: null, region: 'isle2' },
    // row 1
    { q: 1, r: 1, t: 'sea', n: null },
    { q: 2, r: 1, t: 'sea', n: null },
    { q: 3, r: 1, t: 'sea', n: null },
    { q: 4, r: 1, t: 'sea', n: null },
    { q: 5, r: 1, t: 'sea', n: null },
    { q: 6, r: 1, t: 'sea', n: null },
    { q: 7, r: 1, t: 'sea', n: null },
    // row 2
    { q: 0, r: 2, t: 'fields', n: 6, region: 'main' },
    { q: 1, r: 2, t: 'forest', n: 9, region: 'main' },
    { q: 2, r: 2, t: 'mountains', n: 11, region: 'main' },
    { q: 3, r: 2, t: 'hills', n: 5, region: 'main' },
    { q: 4, r: 2, t: 'forest', n: 6, region: 'main' },
    { q: 5, r: 2, t: 'mountains', n: 4, region: 'main' },
    { q: 6, r: 2, t: 'sea', n: null },
    { q: 7, r: 2, t: 'pasture', n: null, region: 'isle3' },
    // row 3
    { q: 0, r: 3, t: 'pasture', n: 10, region: 'main' },
    { q: 1, r: 3, t: 'hills', n: 8, region: 'main' },
    { q: 2, r: 3, t: 'pasture', n: 4, region: 'main' },
    { q: 3, r: 3, t: 'fields', n: 12, region: 'main' },
    { q: 4, r: 3, t: 'forest', n: 5, region: 'main' },
    { q: 5, r: 3, t: 'pasture', n: 2, region: 'main' },
    { q: 6, r: 3, t: 'sea', n: null },
    // row 4
    { q: -1, r: 4, t: 'forest', n: 11, region: 'main' },
    { q: 0, r: 4, t: 'fields', n: 9, region: 'main' },
    { q: 1, r: 4, t: 'mountains', n: 3, region: 'main' },
    { q: 2, r: 4, t: 'pasture', n: 8, region: 'main' },
    { q: 3, r: 4, t: 'hills', n: 10, region: 'main' },
    { q: 4, r: 4, t: 'fields', n: 3, region: 'main' },
    { q: 5, r: 4, t: 'sea', n: null },
    { q: 6, r: 4, t: 'forest', n: null, region: 'isle4' },
    // row 5
    { q: -1, r: 5, t: 'sea', n: null },
    { q: 0, r: 5, t: 'sea', n: null },
    { q: 1, r: 5, t: 'sea', n: null },
    { q: 2, r: 5, t: 'sea', n: null },
    { q: 3, r: 5, t: 'sea', n: null },
    { q: 4, r: 5, t: 'sea', n: null },
    { q: 5, r: 5, t: 'sea', n: null },
    // row 6
    { q: -1, r: 6, t: 'desert', n: null, region: 'isle5' },
    { q: 0, r: 6, t: 'hills', n: null, region: 'isle5' },
    { q: 1, r: 6, t: 'sea', n: null },
    { q: 2, r: 6, t: 'hills', n: null, region: 'isle6' },
    { q: 3, r: 6, t: 'desert', n: null, region: 'isle6' },
    { q: 4, r: 6, t: 'gold', n: null, region: 'isle6' },
  ],
  ports: [],
  edgeItems: [
    { q: 2, r: 0, dir: 2, item: 'port' },
    { q: 5, r: 0, dir: 2, item: 'port' },
    { q: 7, r: 2, dir: 1, item: 'port' },
    { q: 6, r: 4, dir: 5, item: 'port' },
    { q: -1, r: 6, dir: 4, item: 'port' },
    { q: 2, r: 6, dir: 5, item: 'port' },
    { q: 2, r: 0, dir: 1, item: 'vp' },
    { q: 5, r: 0, dir: 1, item: 'vp' },
    { q: 7, r: 0, dir: 1, item: 'vp' },
    { q: 7, r: 2, dir: 0, item: 'vp' },
    { q: 6, r: 4, dir: 0, item: 'vp' },
    { q: -1, r: 6, dir: 5, item: 'vp' },
    { q: 2, r: 6, dir: 4, item: 'vp' },
    { q: 4, r: 6, dir: 5, item: 'vp' },
    { q: 2, r: 0, dir: 3, item: 'dev' },
    { q: 7, r: 0, dir: 0, item: 'dev' },
    { q: -1, r: 6, dir: 3, item: 'dev' },
    { q: 4, r: 6, dir: 0, item: 'dev' },
  ],
  robber: [3, 6],
  pirate: [4, 0],
  frameSea: [[-1, 3], [7, 3]],
};

/**
 * "Cloth for Catan" (pp. 14-15): the 4-player frame. Two large islands ('north',
 * 'south') and four one-hex small islands whose top and bottom corners are the 8
 * villages (number discs on the corners, 5 cloth each). Ports are "?" (shuffled).
 */
export const CLOTH_FOR_CATAN: ScenarioMap = {
  hexes: [
    // row 0
    { q: 2, r: 0, t: 'forest', n: 4, region: 'north' },
    { q: 3, r: 0, t: 'pasture', n: 6, region: 'north' },
    { q: 4, r: 0, t: 'hills', n: 5, region: 'north' },
    { q: 5, r: 0, t: 'pasture', n: 11, region: 'north' },
    { q: 6, r: 0, t: 'fields', n: 8, region: 'north' },
    // row 1
    { q: 1, r: 1, t: 'fields', n: 3, region: 'north' },
    { q: 2, r: 1, t: 'forest', n: 12, region: 'north' },
    { q: 3, r: 1, t: 'sea', n: null },
    { q: 4, r: 1, t: 'sea', n: null },
    { q: 5, r: 1, t: 'forest', n: 3, region: 'north' },
    { q: 6, r: 1, t: 'mountains', n: 9, region: 'north' },
    // row 2
    { q: 0, r: 2, t: 'fields', n: 12, region: 'north' },
    { q: 1, r: 2, t: 'sea', n: null },
    { q: 2, r: 2, t: 'sea', n: null },
    { q: 3, r: 2, t: 'gold', n: null, region: 'isle1' },
    { q: 4, r: 2, t: 'sea', n: null },
    { q: 5, r: 2, t: 'sea', n: null },
    { q: 6, r: 2, t: 'sea', n: null },
    // row 3
    { q: 0, r: 3, t: 'sea', n: null },
    { q: 1, r: 3, t: 'desert', n: null, region: 'isle2' },
    { q: 2, r: 3, t: 'sea', n: null },
    { q: 3, r: 3, t: 'sea', n: null },
    { q: 4, r: 3, t: 'desert', n: null, region: 'isle3' },
    { q: 5, r: 3, t: 'sea', n: null },
    // row 4
    { q: -1, r: 4, t: 'sea', n: null },
    { q: 0, r: 4, t: 'sea', n: null },
    { q: 1, r: 4, t: 'sea', n: null },
    { q: 2, r: 4, t: 'gold', n: null, region: 'isle4' },
    { q: 3, r: 4, t: 'sea', n: null },
    { q: 4, r: 4, t: 'sea', n: null },
    { q: 5, r: 4, t: 'mountains', n: 2, region: 'south' },
    // row 5
    { q: -1, r: 5, t: 'hills', n: 9, region: 'south' },
    { q: 0, r: 5, t: 'fields', n: 2, region: 'south' },
    { q: 1, r: 5, t: 'sea', n: null },
    { q: 2, r: 5, t: 'sea', n: null },
    { q: 3, r: 5, t: 'pasture', n: 11, region: 'south' },
    { q: 4, r: 5, t: 'mountains', n: 4, region: 'south' },
    // row 6
    { q: -1, r: 6, t: 'pasture', n: 10, region: 'south' },
    { q: 0, r: 6, t: 'forest', n: 6, region: 'south' },
    { q: 1, r: 6, t: 'mountains', n: 5, region: 'south' },
    { q: 2, r: 6, t: 'fields', n: 10, region: 'south' },
    { q: 3, r: 6, t: 'hills', n: 8, region: 'south' },
  ],
  ports: [
    { q: 2, r: 0, dir: 1, type: 'lumber' },
    { q: 5, r: 0, dir: 2, type: 'generic' },
    { q: 6, r: 1, dir: 0, type: 'brick' },
    { q: 1, r: 1, dir: 3, type: 'generic' },
    { q: 5, r: 4, dir: 0, type: 'wool' },
    { q: -1, r: 5, dir: 3, type: 'generic' },
    { q: 4, r: 5, dir: 5, type: 'grain' },
    { q: 0, r: 6, dir: 4, type: 'generic' },
    { q: 2, r: 6, dir: 5, type: 'ore' },
  ],
  villages: [
    { q: 3, r: 2, corner: 'top', n: 11 },
    { q: 3, r: 2, corner: 'bottom', n: 8 },
    { q: 1, r: 3, corner: 'top', n: 10 },
    { q: 1, r: 3, corner: 'bottom', n: 9 },
    { q: 4, r: 3, corner: 'top', n: 4 },
    { q: 4, r: 3, corner: 'bottom', n: 5 },
    { q: 2, r: 4, corner: 'top', n: 6 },
    { q: 2, r: 4, corner: 'bottom', n: 3 },
  ],
  robber: [0, 2],
  pirate: [6, 3],
  frameSea: [[-1, 3], [6, 3]],
};
