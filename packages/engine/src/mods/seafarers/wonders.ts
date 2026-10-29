import type { ResMap, WonderId } from '../../types';

/**
 * The Wonders of Catan tiles (rulebook p. 1 components, p. 18 rules): each of the
 * 4 levels costs the 5 resources printed on the tile; the requirement to claim it
 * is checked by `wonderBlock` (queries.ts).
 */
export const WONDERS: Record<WonderId, { cost: Partial<ResMap> }> = {
  // 1 city and 6+ VP
  castle: { cost: { brick: 1, grain: 1, ore: 3 } },
  // 1 city at a port and a trade route of 5+ roads/ships
  monument: { cost: { grain: 3, ore: 2 } },
  // a building at a Great Bridge marker
  bridge: { cost: { lumber: 3, wool: 1, grain: 1 } },
  // 2 cities
  theater: { cost: { brick: 1, lumber: 1, wool: 3 } },
  // a building at a Great Wall marker
  wall: { cost: { brick: 3, lumber: 1, grain: 1 } },
  // Seafarers 5-6: a building at a lighthouse marker
  lighthouse: { cost: { lumber: 3, wool: 1, grain: 1 } },
  // Seafarers 5-6: 2 cities
  library: { cost: { brick: 1, lumber: 1, wool: 3 } },
};

export const WONDER_IDS = Object.keys(WONDERS) as WonderId[];

/** Levels of a wonder; reaching the last one finishes it. */
export const WONDER_LEVELS = 4;
