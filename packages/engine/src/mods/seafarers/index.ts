import { boardFromMap } from '../../board';
import { registerLayout } from '../../geometry';
import { BANK_SUPPLY_PER_RESOURCE, COSTS, DEV_DECK, NUMBER_TOKENS, PIECE_LIMITS, PLAYER_COLORS, TERRAIN_COUNTS } from '../../rulesets';
import type { Board, LayoutId } from '../../types';
import type { ModDef, ScenarioDef } from '../types';

export type { ScenarioMap, MapHex, MapPort, MapTerrain } from './mapTypes';
export { MAP_DIRS, boardHexes } from './mapTypes';
import { boardHexes } from './mapTypes';
import { NEW_SHORES_3P, NEW_SHORES_4P } from './maps';
export { NEW_SHORES_3P, NEW_SHORES_4P } from './maps';

/** Map size a game uses: 2–3 participants play the 3-player map, 4 the 4-player map. */
export function scenarioMapSize(participants: number): 3 | 4 {
  return participants <= 3 ? 3 : 4;
}

/** Layout id of a scenario map, e.g. 'sf-newShores-3p'. */
export function scenarioLayoutId(scenario: string, size: 3 | 4): LayoutId {
  return `sf-${scenario}-${size}p`;
}

/**
 * CATAN – Seafarers. Boards come from the scenario maps (fixed setup), so the
 * random/beginner board fields below are the base game's and unused.
 * Ships: lumber + wool, 15 per player. Scenarios are added with addScenario().
 */
export const SEAFARERS_MOD: ModDef = {
  id: 'seafarers',
  version: 1,
  minPlayers: 2,
  maxPlayers: 4,
  layout: 'sf-newShores-4p',
  terrainCounts: TERRAIN_COUNTS,
  numberTokens: NUMBER_TOKENS,
  harborTypes: [],
  harborGaps: [],
  beginner: { hexes: [], harbors: [] },
  bankPerResource: BANK_SUPPLY_PER_RESOURCE,
  devDeck: DEV_DECK,
  costs: { ...COSTS, ship: { lumber: 1, wool: 1 } },
  pieceLimits: { ...PIECE_LIMITS, ships: 15 },
  colors: PLAYER_COLORS,
  scenarios: {},
  defaultScenario: 'newShores',
};

/** Adds (or replaces) a scenario of the Seafarers mod and registers its map layouts. */
export function addScenario(def: ScenarioDef): void {
  for (const size of [3, 4] as const) {
    registerLayout(
      scenarioLayoutId(def.id, size),
      boardHexes(def.maps[size]).map((h): [number, number] => [h.q, h.r]),
    );
  }
  SEAFARERS_MOD.scenarios![def.id] = def;
}

/** The fixed board of a scenario for this many participants. */
export function scenarioBoard(def: ScenarioDef, participants: number): Board {
  const size = scenarioMapSize(participants);
  return boardFromMap(def.maps[size], scenarioLayoutId(def.id, size), def.startRegions);
}

/**
 * Scenario 1, Heading for New Shores (rulebook p. 4): starting settlements on
 * the main island; +2 VP for a player's first settlement on each small island;
 * 14 VP wins.
 */
addScenario({
  id: 'newShores',
  victoryTarget: 14,
  maps: { 3: NEW_SHORES_3P, 4: NEW_SHORES_4P },
  startRegions: ['main'],
  homeRegions: ['main'],
  regionBonus: 2,
});
