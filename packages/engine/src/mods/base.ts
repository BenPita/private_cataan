import { BANK_SUPPLY_PER_RESOURCE, COSTS, DEV_DECK, NUMBER_TOKENS, PIECE_LIMITS, PLAYER_COLORS, TERRAIN_COUNTS } from '../rulesets';
import type { HarborType, Terrain } from '../types';
import type { ModDef } from './types';

const HARBOR_TYPES: HarborType[] = [
  'generic', 'generic', 'generic', 'generic',
  'lumber', 'brick', 'wool', 'grain', 'ore',
];

/**
 * Gaps between consecutive harbors along the 30 coastal edges. Mirrors the
 * classic frame spacing so every harbor is reachable and none are adjacent.
 */
const HARBOR_GAPS = [3, 3, 4, 3, 3, 4, 3, 3, 4];

/** Fixed beginner-friendly layout (original arrangement, rows 3-4-5-4-3). */
const BEGINNER_HEXES: Array<[Terrain, number | null]> = [
  ['mountains', 10], ['pasture', 2], ['forest', 9],
  ['fields', 12], ['hills', 6], ['pasture', 4], ['hills', 10],
  ['fields', 9], ['forest', 11], ['desert', null], ['forest', 3], ['mountains', 8],
  ['forest', 8], ['mountains', 3], ['fields', 4], ['pasture', 5],
  ['hills', 5], ['fields', 6], ['pasture', 11],
];

/**
 * Official 5–6 player game: 30 hexes (rows 3-4-5-6-5-4-3), two deserts, 28
 * number discs, 11 harbors (+1 generic, +1 wool), 24 cards per resource and a
 * 34-card development deck. Same costs and pieces; green and purple join.
 */
const LARGE_MOD: ModDef = {
  id: 'base',
  version: 1,
  minPlayers: 5,
  maxPlayers: 6,
  layout: 'classic56',
  terrainCounts: { forest: 6, hills: 5, pasture: 6, fields: 6, mountains: 5, desert: 2 },
  numberTokens: [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12],
  harborTypes: [...HARBOR_TYPES, 'generic', 'wool'],
  // 38 coastal edges: 3s and 4s alternate, so no two harbors touch.
  harborGaps: [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3],
  beginner: {
    // Rulebook setup map, rows top to bottom.
    hexes: [
      ['hills', 10], ['pasture', 6], ['desert', null],
      ['hills', 6], ['fields', 2], ['mountains', 9], ['hills', 11],
      ['forest', 3], ['mountains', 11], ['forest', 5], ['fields', 10], ['pasture', 4],
      ['desert', null], ['pasture', 5], ['fields', 4], ['mountains', 6], ['pasture', 3], ['fields', 8],
      ['forest', 12], ['mountains', 10], ['pasture', 2], ['hills', 4], ['forest', 11],
      ['forest', 8], ['fields', 3], ['forest', 9], ['fields', 5],
      ['hills', 9], ['pasture', 12], ['mountains', 8],
    ],
    harbors: ['generic', 'wool', 'generic', 'ore', 'generic', 'grain', 'brick', 'generic', 'lumber', 'generic', 'wool'],
  },
  bankPerResource: 24,
  devDeck: { knight: 20, victoryPoint: 5, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3 },
  costs: COSTS,
  pieceLimits: PIECE_LIMITS,
  colors: [...PLAYER_COLORS, '#3d9a3f', '#7d4fb8'], // + green, purple
  pairedPlayers: true,
};

/** The classic base game, 2–4 participants (5–6 with the large rules). */
export const BASE_MOD: ModDef = {
  id: 'base',
  version: 1,
  minPlayers: 2,
  maxPlayers: 4,
  layout: 'classic',
  terrainCounts: TERRAIN_COUNTS,
  numberTokens: NUMBER_TOKENS,
  harborTypes: HARBOR_TYPES,
  harborGaps: HARBOR_GAPS,
  beginner: {
    hexes: BEGINNER_HEXES,
    harbors: ['generic', 'wool', 'generic', 'ore', 'generic', 'grain', 'brick', 'generic', 'lumber'],
  },
  bankPerResource: BANK_SUPPLY_PER_RESOURCE,
  devDeck: DEV_DECK,
  costs: COSTS,
  pieceLimits: PIECE_LIMITS,
  colors: PLAYER_COLORS,
  large: LARGE_MOD,
};
