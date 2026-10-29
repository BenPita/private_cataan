import { boardFromMap } from '../../board';
import { registerLayout } from '../../geometry';
import { BANK_SUPPLY_PER_RESOURCE, COSTS, DEV_DECK, NUMBER_TOKENS, PIECE_LIMITS, PLAYER_COLORS, TERRAIN_COUNTS } from '../../rulesets';
import type { Board, LayoutId } from '../../types';
import type { ModDef, ScenarioDef } from '../types';

export type { ScenarioMap, MapHex, MapPort, MapTerrain } from './mapTypes';
export { MAP_DIRS, boardHexes } from './mapTypes';
import { boardHexes } from './mapTypes';
import { FOG_ISLANDS_3P, FOG_ISLANDS_4P } from './fogMaps';
import { CLOTH_FOR_CATAN, FORGOTTEN_TRIBE } from './tribeClothMaps';
import { FOUR_ISLANDS_3P, FOUR_ISLANDS_4P, NEW_SHORES_3P, NEW_SHORES_4P, THROUGH_DESERT_3P, THROUGH_DESERT_4P } from './maps';
export { FOG_ISLANDS_3P, FOG_ISLANDS_4P } from './fogMaps';
export { CLOTH_FOR_CATAN, FORGOTTEN_TRIBE } from './tribeClothMaps';
export { FOUR_ISLANDS_3P, FOUR_ISLANDS_4P, NEW_SHORES_3P, NEW_SHORES_4P, THROUGH_DESERT_3P, THROUGH_DESERT_4P } from './maps';

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
  return boardFromMap(def.maps[size], scenarioLayoutId(def.id, size), {
    startRegions: def.startRegions,
    numberedOnly: def.numberedOnly,
    clothPerVillage: def.cloth?.perVillage,
  });
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

/**
 * Scenario 2, The Four Islands (rulebook p. 6): starting settlements on one or
 * two islands, which become that player's home islands; +2 VP for the first
 * settlement on each other island; 13 VP wins.
 */
addScenario({
  id: 'fourIslands',
  victoryTarget: 13,
  maps: { 3: FOUR_ISLANDS_3P, 4: FOUR_ISLANDS_4P },
  homeRegions: 'starting',
  regionBonus: 2,
});

/**
 * Scenario 3, The Fog Islands (rulebook p. 8): starting settlements anywhere;
 * a road or ship touching an empty space discovers it from the face-down stack
 * (land: random number disc + 1 resource of its type); 12 VP wins.
 */
addScenario({
  id: 'fogIslands',
  victoryTarget: 12,
  maps: { 3: FOG_ISLANDS_3P, 4: FOG_ISLANDS_4P },
  fog: {
    3: {
      hexes: { sea: 2, gold: 2, hills: 2, forest: 1, pasture: 1, fields: 2, mountains: 2 },
      numbers: [3, 3, 4, 5, 6, 8, 9, 10, 11, 12],
    },
    4: {
      hexes: { sea: 2, gold: 2, hills: 2, forest: 1, pasture: 1, fields: 2, mountains: 2 },
      numbers: [3, 4, 5, 6, 8, 9, 10, 11, 11, 12],
    },
  },
});

/**
 * Scenario 4, Through the Desert (rulebook p. 10): starting settlements on the
 * main island; the land strip beyond the desert and the small islands are
 * unexplored regions, +2 VP for the first settlement in each; 14 VP wins.
 */
addScenario({
  id: 'throughDesert',
  victoryTarget: 14,
  maps: { 3: THROUGH_DESERT_3P, 4: THROUGH_DESERT_4P },
  startRegions: ['main'],
  homeRegions: ['main'],
  regionBonus: 2,
});

/**
 * Scenario 5, The Forgotten Tribe (rulebook p. 12): starting settlements on the
 * large island; settlements and the robber only at/on hexes with a number disc;
 * ships pick up the tribe's VP tokens, development cards and ports; 13 VP wins.
 */
addScenario({
  id: 'forgottenTribe',
  victoryTarget: 13,
  maps: { 3: FORGOTTEN_TRIBE, 4: FORGOTTEN_TRIBE },
  startRegions: ['main'],
  numberedOnly: true,
  itemPorts: ['lumber', 'brick', 'wool', 'grain', 'ore', 'generic'],
});

/**
 * Scenario 6, Cloth for Catan (rulebook p. 14): 3 starting settlements (resources
 * from the third); no settlements or robber on the small islands (their hexes have
 * no disc); a route to a village opens cloth trade; 2 cloth = 1 VP; no Longest
 * Route; 14 VP wins, or the game ends when 5 villages are empty.
 */
addScenario({
  id: 'clothForCatan',
  victoryTarget: 14,
  maps: { 3: CLOTH_FOR_CATAN, 4: CLOTH_FOR_CATAN },
  numberedOnly: true,
  shufflePorts: true,
  setupRounds: 3,
  noLongestRoute: true,
  cloth: { perVillage: 5, supply: 10, endWhenEmpty: 5 },
});
