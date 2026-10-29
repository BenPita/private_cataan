import type { ScenarioMap } from './mapTypes';

/*
 * Scenarios 7 and 8 (CATAN - Seafarers rulebook 2025, pp. 16-19), same conventions
 * as maps.ts, on the 49-space frame (rows of 6-7-8-7-8-7-6). One map for 3 and 4
 * players each. Corners: 0 top, 1 north-east, 2 south-east, 3 bottom, 4 south-west,
 * 5 north-west.
 */

/**
 * "The Pirate Islands" (pp. 16-17): the main island in the east, pirate islands
 * (isle1-5) in the west and middle. The pirate fleet sails clockwise around the middle along `path`
 * (it starts on the first hex). Each colour has a settlement and a ship printed on
 * the main island's coast, a beachhead and a pirate fortress; slots are red, blue,
 * white, orange, and a 3-player game leaves out white.
 */
export const PIRATE_ISLANDS: ScenarioMap = {
  hexes: [
    // row 0
    { q: 2, r: 0, t: 'gold', n: 11, region: 'isle1' },
    { q: 3, r: 0, t: 'mountains', n: 6, region: 'isle1' },
    { q: 4, r: 0, t: 'sea', n: null },
    { q: 5, r: 0, t: 'sea', n: null },
    { q: 6, r: 0, t: 'fields', n: 4, region: 'main' },
    { q: 7, r: 0, t: 'hills', n: 5, region: 'main' },
    // row 1
    { q: 1, r: 1, t: 'hills', n: null, region: 'isle1' },
    { q: 2, r: 1, t: 'sea', n: null },
    { q: 3, r: 1, t: 'sea', n: null },
    { q: 4, r: 1, t: 'desert', n: null, region: 'isle2' },
    { q: 5, r: 1, t: 'sea', n: null },
    { q: 6, r: 1, t: 'mountains', n: 9, region: 'main' },
    { q: 7, r: 1, t: 'forest', n: 10, region: 'main' },
    // row 2
    { q: 0, r: 2, t: 'fields', n: 4, region: 'isle1' },
    { q: 1, r: 2, t: 'sea', n: null },
    { q: 2, r: 2, t: 'sea', n: null },
    { q: 3, r: 2, t: 'desert', n: null, region: 'isle2' },
    { q: 4, r: 2, t: 'sea', n: null },
    { q: 5, r: 2, t: 'forest', n: 3, region: 'main' },
    { q: 6, r: 2, t: 'pasture', n: 8, region: 'main' },
    { q: 7, r: 2, t: 'forest', n: 5, region: 'main' },
    // row 3
    { q: 0, r: 3, t: 'sea', n: null },
    { q: 1, r: 3, t: 'mountains', n: 8, region: 'isle3' },
    { q: 2, r: 3, t: 'sea', n: null },
    { q: 3, r: 3, t: 'sea', n: null },
    { q: 4, r: 3, t: 'fields', n: 6, region: 'main' },
    { q: 5, r: 3, t: 'hills', n: 9, region: 'main' },
    { q: 6, r: 3, t: 'pasture', n: 12, region: 'main' },
    // row 4
    { q: -1, r: 4, t: 'fields', n: 10, region: 'isle4' },
    { q: 0, r: 4, t: 'sea', n: null },
    { q: 1, r: 4, t: 'sea', n: null },
    { q: 2, r: 4, t: 'desert', n: null, region: 'isle5' },
    { q: 3, r: 4, t: 'sea', n: null },
    { q: 4, r: 4, t: 'pasture', n: 11, region: 'main' },
    { q: 5, r: 4, t: 'forest', n: 8, region: 'main' },
    { q: 6, r: 4, t: 'pasture', n: 9, region: 'main' },
    // row 5
    { q: -1, r: 5, t: 'hills', n: null, region: 'isle4' },
    { q: 0, r: 5, t: 'sea', n: null },
    { q: 1, r: 5, t: 'sea', n: null },
    { q: 2, r: 5, t: 'pasture', n: null, region: 'isle5' },
    { q: 3, r: 5, t: 'sea', n: null },
    { q: 4, r: 5, t: 'mountains', n: 5, region: 'main' },
    { q: 5, r: 5, t: 'forest', n: 2, region: 'main' },
    // row 6
    { q: -1, r: 6, t: 'gold', n: 3, region: 'isle4' },
    { q: 0, r: 6, t: 'mountains', n: 6, region: 'isle4' },
    { q: 1, r: 6, t: 'sea', n: null },
    { q: 2, r: 6, t: 'sea', n: null },
    { q: 3, r: 6, t: 'fields', n: 10, region: 'main' },
    { q: 4, r: 6, t: 'hills', n: 4, region: 'main' },
  ],
  // "?" ports: 5 x 2:1 (one per resource) and 3 x 3:1, shuffled at the start.
  ports: [
    { q: 6, r: 0, dir: 2, type: 'lumber' },
    { q: 7, r: 0, dir: 2, type: 'brick' },
    { q: 7, r: 0, dir: 0, type: 'wool' },
    { q: 7, r: 1, dir: 0, type: 'grain' },
    { q: 6, r: 3, dir: 0, type: 'ore' },
    { q: 6, r: 4, dir: 5, type: 'generic' },
    { q: 5, r: 5, dir: 5, type: 'generic' },
    { q: 3, r: 6, dir: 5, type: 'generic' },
  ],
  robber: null,
  pirate: [2, 6],
  pirateIslands: {
    path: [[2, 6], [1, 6], [1, 5], [1, 4], [2, 3], [2, 2], [3, 1], [4, 0], [5, 0], [5, 1], [4, 2], [3, 3], [3, 4], [3, 5]],
    slots: [
      // red
      { start: { q: 6, r: 0, c: 3 }, ship: { q: 6, r: 0, dir: 4 }, beachhead: { q: 3, r: 0, c: 1 }, fortress: { q: 2, r: 0, c: 0 } },
      // blue
      { start: { q: 4, r: 3, c: 3 }, ship: { q: 4, r: 3, dir: 4 }, beachhead: { q: 1, r: 3, c: 3 }, fortress: { q: -1, r: 4, c: 2 } },
      // white
      { start: { q: 5, r: 2, c: 4 }, ship: { q: 4, r: 3, dir: 2 }, beachhead: { q: 1, r: 3, c: 0 }, fortress: { q: 0, r: 2, c: 1 } },
      // orange
      { start: { q: 3, r: 6, c: 0 }, ship: { q: 3, r: 6, dir: 2 }, beachhead: { q: 0, r: 6, c: 2 }, fortress: { q: -1, r: 6, c: 3 } },
    ],
    slots3: [0, 1, 3],
  },
};

/**
 * "The Wonders of Catan" (pp. 18-19): a large island ('main', its 3 deserts included)
 * and two small islands (+1 VP for a first settlement on each). Great Wall markers
 * line the deserts, the two Great Bridge markers face each other across a strait,
 * and "X" markers next to the bridge keep starting settlements away. No pirate.
 */
export const WONDERS_OF_CATAN: ScenarioMap = {
  hexes: [
    // row 0
    { q: 2, r: 0, t: 'gold', n: 8, region: 'isle1' },
    { q: 3, r: 0, t: 'hills', n: 2, region: 'isle1' },
    { q: 4, r: 0, t: 'sea', n: null },
    { q: 5, r: 0, t: 'mountains', n: 10, region: 'main' },
    { q: 6, r: 0, t: 'sea', n: null },
    { q: 7, r: 0, t: 'sea', n: null },
    // row 1
    { q: 1, r: 1, t: 'sea', n: null },
    { q: 2, r: 1, t: 'sea', n: null },
    { q: 3, r: 1, t: 'sea', n: null },
    { q: 4, r: 1, t: 'forest', n: 11, region: 'main' },
    { q: 5, r: 1, t: 'sea', n: null },
    { q: 6, r: 1, t: 'desert', n: null, region: 'main' },
    { q: 7, r: 1, t: 'sea', n: null },
    // row 2
    { q: 0, r: 2, t: 'mountains', n: 12, region: 'main' },
    { q: 1, r: 2, t: 'fields', n: 6, region: 'main' },
    { q: 2, r: 2, t: 'hills', n: 11, region: 'main' },
    { q: 3, r: 2, t: 'fields', n: 10, region: 'main' },
    { q: 4, r: 2, t: 'pasture', n: 3, region: 'main' },
    { q: 5, r: 2, t: 'forest', n: 9, region: 'main' },
    { q: 6, r: 2, t: 'desert', n: null, region: 'main' },
    { q: 7, r: 2, t: 'sea', n: null },
    // row 3
    { q: 0, r: 3, t: 'mountains', n: 3, region: 'main' },
    { q: 1, r: 3, t: 'fields', n: 4, region: 'main' },
    { q: 2, r: 3, t: 'mountains', n: 6, region: 'main' },
    { q: 3, r: 3, t: 'pasture', n: 5, region: 'main' },
    { q: 4, r: 3, t: 'hills', n: 4, region: 'main' },
    { q: 5, r: 3, t: 'desert', n: null, region: 'main' },
    { q: 6, r: 3, t: 'sea', n: null },
    // row 4
    { q: -1, r: 4, t: 'hills', n: 8, region: 'main' },
    { q: 0, r: 4, t: 'pasture', n: 9, region: 'main' },
    { q: 1, r: 4, t: 'sea', n: null },
    { q: 2, r: 4, t: 'sea', n: null },
    { q: 3, r: 4, t: 'hills', n: 10, region: 'main' },
    { q: 4, r: 4, t: 'sea', n: null },
    { q: 5, r: 4, t: 'sea', n: null },
    { q: 6, r: 4, t: 'gold', n: 6, region: 'isle2' },
    // row 5
    { q: -1, r: 5, t: 'sea', n: null },
    { q: 0, r: 5, t: 'forest', n: 3, region: 'main' },
    { q: 1, r: 5, t: 'sea', n: null },
    { q: 2, r: 5, t: 'forest', n: 8, region: 'main' },
    { q: 3, r: 5, t: 'fields', n: 9, region: 'main' },
    { q: 4, r: 5, t: 'sea', n: null },
    { q: 5, r: 5, t: 'forest', n: 4, region: 'isle2' },
    // row 6
    { q: -1, r: 6, t: 'mountains', n: 5, region: 'main' },
    { q: 0, r: 6, t: 'sea', n: null },
    { q: 1, r: 6, t: 'pasture', n: 11, region: 'main' },
    { q: 2, r: 6, t: 'pasture', n: 2, region: 'main' },
    { q: 3, r: 6, t: 'sea', n: null },
    { q: 4, r: 6, t: 'fields', n: 5, region: 'isle2' },
  ],
  // "?" ports: 5 x 2:1 (one per resource) and 4 x 3:1, shuffled at the start.
  ports: [
    { q: 1, r: 2, dir: 2, type: 'lumber' },
    { q: 3, r: 2, dir: 2, type: 'brick' },
    { q: 4, r: 2, dir: 1, type: 'wool' },
    { q: 0, r: 3, dir: 3, type: 'grain' },
    { q: 1, r: 3, dir: 5, type: 'ore' },
    { q: 0, r: 5, dir: 3, type: 'generic' },
    { q: 3, r: 5, dir: 1, type: 'generic' },
    { q: 3, r: 5, dir: 5, type: 'generic' },
    { q: 1, r: 6, dir: 5, type: 'generic' },
  ],
  robber: [6, 2],
  wonderSpots: {
    wall: [
      { q: 5, r: 2, c: 0 },
      { q: 5, r: 2, c: 1 },
      { q: 5, r: 2, c: 2 },
      { q: 5, r: 2, c: 3 },
      { q: 4, r: 3, c: 2 },
    ],
    bridge: [
      { q: 0, r: 5, c: 2 },
      { q: 1, r: 6, c: 5 },
    ],
    blocked: [
      { q: 0, r: 5, c: 1 },
      { q: 0, r: 5, c: 3 },
      { q: 1, r: 6, c: 0 },
      { q: 1, r: 6, c: 4 },
    ],
  },
};
