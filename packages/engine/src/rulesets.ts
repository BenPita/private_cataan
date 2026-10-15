import type { DevCardType, GameState, ResMap, Resource, Terrain } from './types';

/**
 * Classic base-game constants. Anything that differs between player counts
 * lives in a Ruleset so two-player balancing rules can be added later without
 * touching the engine.
 */
export const COSTS: Record<'road' | 'settlement' | 'city' | 'devCard', Partial<ResMap>> = {
  road: { lumber: 1, brick: 1 },
  settlement: { lumber: 1, brick: 1, wool: 1, grain: 1 },
  city: { grain: 2, ore: 3 },
  devCard: { wool: 1, grain: 1, ore: 1 },
};

export const PIECE_LIMITS = { roads: 15, settlements: 5, cities: 4 };

export const BANK_SUPPLY_PER_RESOURCE = 19;

export const TERRAIN_COUNTS: Record<Terrain, number> = {
  forest: 4,
  hills: 3,
  pasture: 4,
  fields: 4,
  mountains: 3,
  desert: 1,
};

export const TERRAIN_RESOURCE: Record<Terrain, Resource | null> = {
  forest: 'lumber',
  hills: 'brick',
  pasture: 'wool',
  fields: 'grain',
  mountains: 'ore',
  desert: null,
};

export const NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

export const DEV_DECK: Record<DevCardType, number> = {
  knight: 14,
  victoryPoint: 5,
  roadBuilding: 2,
  yearOfPlenty: 2,
  monopoly: 2,
};

export const PLAYER_COLORS = ['#e2483d', '#2f7de1', '#f2a516', '#8a4fd8'];

export const LONGEST_ROAD_MIN = 5;
export const LARGEST_ARMY_MIN = 3;
export const DISCARD_THRESHOLD = 7;

export interface Ruleset {
  id: GameState['ruleset'];
  /** Seat order for initial placement (snake order over the turn order). */
  setupOrder(turnOrder: number[]): number[];
}

const snakeOrder = (turnOrder: number[]): number[] => [...turnOrder, ...turnOrder.slice().reverse()];

/** Standard base-game rules, used for 3-4 participants. */
export const CLASSIC: Ruleset = {
  id: 'classic',
  setupOrder: snakeOrder,
};

/**
 * Simplified two-player adaptation (house adaptation, not an official
 * variant): identical to classic rules with A → B → B → A setup. No neutral
 * players or trade tokens. Optional balance rules belong here.
 */
export const TWO_PLAYER_SIMPLE: Ruleset = {
  id: 'twoPlayerSimple',
  setupOrder: snakeOrder,
};

export function rulesetFor(playerCount: number): Ruleset {
  return playerCount === 2 ? TWO_PLAYER_SIMPLE : CLASSIC;
}
