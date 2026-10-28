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
  frameSea: [[-1, 3], [5, 3]],
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
  frameSea: [[-1, 3], [6, 3]],
};

/*
 * Scenario 2 "The Four Islands" (rulebook pp. 6-7), same conventions as above.
 * Both maps use the 3-player frame (the 4-player table also totals 35 tiles): the
 * middle row is flanked by frame-printed sea spaces, and the pirate is drawn on
 * the frame strip below the bottom row, between its 2nd and 3rd spaces.
 * Islands are 'isle1'..'isle4', numbered top to bottom, then left to right.
 */
/** 3-player map (rulebook p. 6): 20 land + 15 sea hexes, 9 ports. */
export const FOUR_ISLANDS_3P: ScenarioMap = {
  hexes: [
    // row 0
    { q: 2, r: 0, t: 'sea', n: null },
    { q: 3, r: 0, t: 'sea', n: null },
    { q: 4, r: 0, t: 'fields', n: 4, region: 'isle1' },
    { q: 5, r: 0, t: 'pasture', n: 3, region: 'isle1' },
    // row 1
    { q: 1, r: 1, t: 'mountains', n: 4, region: 'isle2' },
    { q: 2, r: 1, t: 'forest', n: 9, region: 'isle2' },
    { q: 3, r: 1, t: 'sea', n: null },
    { q: 4, r: 1, t: 'fields', n: 9, region: 'isle1' },
    { q: 5, r: 1, t: 'hills', n: 5, region: 'isle1' },
    // row 2
    { q: 0, r: 2, t: 'pasture', n: 6, region: 'isle2' },
    { q: 1, r: 2, t: 'mountains', n: 10, region: 'isle2' },
    { q: 2, r: 2, t: 'sea', n: null },
    { q: 3, r: 2, t: 'forest', n: 8, region: 'isle1' },
    { q: 4, r: 2, t: 'hills', n: 11, region: 'isle1' },
    { q: 5, r: 2, t: 'sea', n: null },
    // row 3
    { q: 0, r: 3, t: 'sea', n: null },
    { q: 1, r: 3, t: 'sea', n: null },
    { q: 2, r: 3, t: 'sea', n: null },
    { q: 3, r: 3, t: 'sea', n: null },
    { q: 4, r: 3, t: 'sea', n: null },
    // row 4
    { q: -1, r: 4, t: 'fields', n: 11, region: 'isle3' },
    { q: 0, r: 4, t: 'mountains', n: 8, region: 'isle3' },
    { q: 1, r: 4, t: 'forest', n: 3, region: 'isle3' },
    { q: 2, r: 4, t: 'sea', n: null },
    { q: 3, r: 4, t: 'hills', n: 10, region: 'isle4' },
    { q: 4, r: 4, t: 'hills', n: 6, region: 'isle4' },
    // row 5
    { q: -1, r: 5, t: 'forest', n: 5, region: 'isle3' },
    { q: 0, r: 5, t: 'pasture', n: 9, region: 'isle3' },
    { q: 1, r: 5, t: 'sea', n: null },
    { q: 2, r: 5, t: 'mountains', n: 2, region: 'isle4' },
    { q: 3, r: 5, t: 'fields', n: 5, region: 'isle4' },
    // row 6
    { q: -1, r: 6, t: 'pasture', n: 12, region: 'isle3' },
    { q: 0, r: 6, t: 'sea', n: null },
    { q: 1, r: 6, t: 'sea', n: null },
    { q: 2, r: 6, t: 'sea', n: null },
  ],
  ports: [
    { q: 2, r: 1, dir: 5, type: 'ore' },
    { q: 5, r: 1, dir: 1, type: 'generic' },
    { q: 0, r: 2, dir: 2, type: 'generic' },
    { q: 4, r: 2, dir: 4, type: 'brick' },
    { q: -1, r: 4, dir: 1, type: 'lumber' },
    { q: -1, r: 4, dir: 4, type: 'generic' },
    { q: 4, r: 4, dir: 5, type: 'grain' },
    { q: 0, r: 5, dir: 5, type: 'wool' },
    { q: 2, r: 5, dir: 2, type: 'generic' },
  ],
  robber: [-1, 6],
  pirate: [0, 7],
  frameSea: [[-1, 3], [5, 3], [0, 7]],
};

/** 4-player map (rulebook p. 7): 23 land + 12 sea hexes, 9 ports. */
export const FOUR_ISLANDS_4P: ScenarioMap = {
  hexes: [
    // row 0
    { q: 2, r: 0, t: 'pasture', n: 8, region: 'isle1' },
    { q: 3, r: 0, t: 'sea', n: null },
    { q: 4, r: 0, t: 'forest', n: 9, region: 'isle2' },
    { q: 5, r: 0, t: 'forest', n: 11, region: 'isle2' },
    // row 1
    { q: 1, r: 1, t: 'hills', n: 10, region: 'isle1' },
    { q: 2, r: 1, t: 'sea', n: null },
    { q: 3, r: 1, t: 'mountains', n: 3, region: 'isle2' },
    { q: 4, r: 1, t: 'fields', n: 12, region: 'isle2' },
    { q: 5, r: 1, t: 'pasture', n: 5, region: 'isle2' },
    // row 2
    { q: 0, r: 2, t: 'fields', n: 5, region: 'isle1' },
    { q: 1, r: 2, t: 'forest', n: 3, region: 'isle1' },
    { q: 2, r: 2, t: 'sea', n: null },
    { q: 3, r: 2, t: 'hills', n: 5, region: 'isle2' },
    { q: 4, r: 2, t: 'mountains', n: 10, region: 'isle2' },
    { q: 5, r: 2, t: 'sea', n: null },
    // row 3
    { q: 0, r: 3, t: 'sea', n: null },
    { q: 1, r: 3, t: 'sea', n: null },
    { q: 2, r: 3, t: 'forest', n: 6, region: 'isle2' },
    { q: 3, r: 3, t: 'sea', n: null },
    { q: 4, r: 3, t: 'sea', n: null },
    // row 4
    { q: -1, r: 4, t: 'hills', n: 4, region: 'isle3' },
    { q: 0, r: 4, t: 'pasture', n: 9, region: 'isle3' },
    { q: 1, r: 4, t: 'sea', n: null },
    { q: 2, r: 4, t: 'sea', n: null },
    { q: 3, r: 4, t: 'forest', n: 9, region: 'isle4' },
    { q: 4, r: 4, t: 'pasture', n: 11, region: 'isle4' },
    // row 5
    { q: -1, r: 5, t: 'fields', n: 6, region: 'isle3' },
    { q: 0, r: 5, t: 'mountains', n: 4, region: 'isle3' },
    { q: 1, r: 5, t: 'hills', n: 2, region: 'isle3' },
    { q: 2, r: 5, t: 'sea', n: null },
    { q: 3, r: 5, t: 'mountains', n: 8, region: 'isle4' },
    // row 6
    { q: -1, r: 6, t: 'pasture', n: 10, region: 'isle3' },
    { q: 0, r: 6, t: 'fields', n: 11, region: 'isle3' },
    { q: 1, r: 6, t: 'sea', n: null },
    { q: 2, r: 6, t: 'fields', n: 4, region: 'isle4' },
  ],
  ports: [
    { q: 1, r: 1, dir: 3, type: 'grain' },
    { q: 5, r: 1, dir: 5, type: 'lumber' },
    { q: 0, r: 2, dir: 5, type: 'generic' },
    { q: 2, r: 3, dir: 2, type: 'generic' },
    { q: -1, r: 4, dir: 4, type: 'brick' },
    { q: 4, r: 4, dir: 2, type: 'ore' },
    { q: 4, r: 4, dir: 5, type: 'generic' },
    { q: 0, r: 5, dir: 1, type: 'generic' },
    { q: -1, r: 6, dir: 3, type: 'wool' },
  ],
  robber: [4, 1],
  pirate: [0, 7],
  frameSea: [[-1, 3], [5, 3], [0, 7]],
};

/*
 * Scenario 4 "Through the Desert" (rulebook pp. 10-11), same conventions as above.
 * 3 players: 3-player frame; 4 players: 4-player frame. The pirate is drawn on the
 * frame strip above the top row, over the gap between its 1st and 2nd spaces.
 * Regions: 'strip' is the small land strip outlined in green (3 hexes, top left),
 * 'main' the rest of the large island including the 3 deserts (the green outline
 * runs between the strip and the deserts, so the deserts lie on the main side),
 * 'isle1'.. the small islands outlined in dark blue. 'main' and 'strip' touch only
 * through those deserts.
 */
/** 3-player map (rulebook p. 10): 25 land (3 deserts) + 10 sea hexes, 8 ports. */
export const THROUGH_DESERT_3P: ScenarioMap = {
  hexes: [
    // row 0
    { q: 2, r: 0, t: 'gold', n: 4, region: 'strip' },
    { q: 3, r: 0, t: 'desert', n: null, region: 'main' },
    { q: 4, r: 0, t: 'sea', n: null },
    { q: 5, r: 0, t: 'mountains', n: 8, region: 'isle1' },
    // row 1
    { q: 1, r: 1, t: 'forest', n: 3, region: 'strip' },
    { q: 2, r: 1, t: 'desert', n: null, region: 'main' },
    { q: 3, r: 1, t: 'forest', n: 4, region: 'main' },
    { q: 4, r: 1, t: 'sea', n: null },
    { q: 5, r: 1, t: 'pasture', n: 12, region: 'isle1' },
    // row 2
    { q: 0, r: 2, t: 'fields', n: 6, region: 'strip' },
    { q: 1, r: 2, t: 'desert', n: null, region: 'main' },
    { q: 2, r: 2, t: 'hills', n: 5, region: 'main' },
    { q: 3, r: 2, t: 'pasture', n: 6, region: 'main' },
    { q: 4, r: 2, t: 'sea', n: null },
    { q: 5, r: 2, t: 'sea', n: null },
    // row 3
    { q: 0, r: 3, t: 'sea', n: null },
    { q: 1, r: 3, t: 'mountains', n: 3, region: 'main' },
    { q: 2, r: 3, t: 'forest', n: 10, region: 'main' },
    { q: 3, r: 3, t: 'sea', n: null },
    { q: 4, r: 3, t: 'gold', n: 5, region: 'isle2' },
    // row 4
    { q: -1, r: 4, t: 'forest', n: 11, region: 'main' },
    { q: 0, r: 4, t: 'hills', n: 6, region: 'main' },
    { q: 1, r: 4, t: 'fields', n: 2, region: 'main' },
    { q: 2, r: 4, t: 'hills', n: 9, region: 'main' },
    { q: 3, r: 4, t: 'sea', n: null },
    { q: 4, r: 4, t: 'sea', n: null },
    // row 5
    { q: -1, r: 5, t: 'mountains', n: 10, region: 'main' },
    { q: 0, r: 5, t: 'fields', n: 9, region: 'main' },
    { q: 1, r: 5, t: 'forest', n: 8, region: 'main' },
    { q: 2, r: 5, t: 'sea', n: null },
    { q: 3, r: 5, t: 'fields', n: 9, region: 'isle3' },
    // row 6
    { q: -1, r: 6, t: 'pasture', n: 8, region: 'main' },
    { q: 0, r: 6, t: 'pasture', n: 4, region: 'main' },
    { q: 1, r: 6, t: 'sea', n: null },
    { q: 2, r: 6, t: 'mountains', n: 5, region: 'isle3' },
  ],
  ports: [
    { q: 3, r: 1, dir: 1, type: 'lumber' },
    { q: -1, r: 4, dir: 4, type: 'wool' },
    { q: 0, r: 4, dir: 2, type: 'grain' },
    { q: 2, r: 4, dir: 1, type: 'generic' },
    { q: 2, r: 4, dir: 5, type: 'generic' },
    { q: -1, r: 6, dir: 3, type: 'ore' },
    { q: -1, r: 6, dir: 5, type: 'brick' },
    { q: 0, r: 6, dir: 0, type: 'generic' },
  ],
  robber: [2, 1],
  pirate: [3, -1],
  frameSea: [[3, -1], [-1, 3], [5, 3]],
};

/** 4-player map (rulebook p. 11): 30 land (3 deserts) + 12 sea hexes, 9 ports. */
export const THROUGH_DESERT_4P: ScenarioMap = {
  hexes: [
    // row 0
    { q: 2, r: 0, t: 'gold', n: 10, region: 'strip' },
    { q: 3, r: 0, t: 'desert', n: null, region: 'main' },
    { q: 4, r: 0, t: 'forest', n: 5, region: 'main' },
    { q: 5, r: 0, t: 'sea', n: null },
    { q: 6, r: 0, t: 'mountains', n: 9, region: 'isle1' },
    // row 1
    { q: 1, r: 1, t: 'mountains', n: 11, region: 'strip' },
    { q: 2, r: 1, t: 'desert', n: null, region: 'main' },
    { q: 3, r: 1, t: 'hills', n: 3, region: 'main' },
    { q: 4, r: 1, t: 'pasture', n: 6, region: 'main' },
    { q: 5, r: 1, t: 'sea', n: null },
    { q: 6, r: 1, t: 'fields', n: 4, region: 'isle1' },
    // row 2
    { q: 0, r: 2, t: 'fields', n: 8, region: 'strip' },
    { q: 1, r: 2, t: 'desert', n: null, region: 'main' },
    { q: 2, r: 2, t: 'mountains', n: 8, region: 'main' },
    { q: 3, r: 2, t: 'fields', n: 10, region: 'main' },
    { q: 4, r: 2, t: 'forest', n: 4, region: 'main' },
    { q: 5, r: 2, t: 'sea', n: null },
    { q: 6, r: 2, t: 'hills', n: 2, region: 'isle1' },
    // row 3
    { q: 0, r: 3, t: 'sea', n: null },
    { q: 1, r: 3, t: 'forest', n: 10, region: 'main' },
    { q: 2, r: 3, t: 'hills', n: 11, region: 'main' },
    { q: 3, r: 3, t: 'pasture', n: 9, region: 'main' },
    { q: 4, r: 3, t: 'sea', n: null },
    { q: 5, r: 3, t: 'sea', n: null },
    // row 4
    { q: -1, r: 4, t: 'hills', n: 12, region: 'main' },
    { q: 0, r: 4, t: 'hills', n: 6, region: 'main' },
    { q: 1, r: 4, t: 'fields', n: 5, region: 'main' },
    { q: 2, r: 4, t: 'forest', n: 8, region: 'main' },
    { q: 3, r: 4, t: 'sea', n: null },
    { q: 4, r: 4, t: 'gold', n: 5, region: 'isle2' },
    { q: 5, r: 4, t: 'pasture', n: 3, region: 'isle2' },
    // row 5
    { q: -1, r: 5, t: 'pasture', n: 3, region: 'main' },
    { q: 0, r: 5, t: 'pasture', n: 11, region: 'main' },
    { q: 1, r: 5, t: 'mountains', n: 4, region: 'main' },
    { q: 2, r: 5, t: 'sea', n: null },
    { q: 3, r: 5, t: 'sea', n: null },
    { q: 4, r: 5, t: 'sea', n: null },
    // row 6
    { q: -1, r: 6, t: 'sea', n: null },
    { q: 0, r: 6, t: 'forest', n: 9, region: 'main' },
    { q: 1, r: 6, t: 'sea', n: null },
    { q: 2, r: 6, t: 'mountains', n: 6, region: 'isle3' },
    { q: 3, r: 6, t: 'fields', n: 12, region: 'isle3' },
  ],
  ports: [
    { q: 4, r: 0, dir: 0, type: 'brick' },
    { q: 4, r: 2, dir: 1, type: 'generic' },
    { q: 4, r: 2, dir: 5, type: 'generic' },
    { q: 1, r: 3, dir: 3, type: 'wool' },
    { q: 2, r: 4, dir: 5, type: 'generic' },
    { q: -1, r: 5, dir: 3, type: 'grain' },
    { q: -1, r: 5, dir: 5, type: 'ore' },
    { q: 0, r: 6, dir: 0, type: 'lumber' },
    { q: 0, r: 6, dir: 4, type: 'generic' },
  ],
  robber: [2, 1],
  pirate: [3, -1],
  frameSea: [[3, -1], [-1, 3], [6, 3]],
};
