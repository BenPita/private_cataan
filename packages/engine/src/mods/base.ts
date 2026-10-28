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

/** The classic base game, 2–4 participants. */
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
};
