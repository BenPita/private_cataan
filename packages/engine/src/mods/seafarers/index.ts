import { boardFromMap } from '../../board';
import { registerLayout } from '../../geometry';
import { BANK_SUPPLY_PER_RESOURCE, COSTS, DEV_DECK, NUMBER_TOKENS, PIECE_LIMITS, PLAYER_COLORS, TERRAIN_COUNTS } from '../../rulesets';
import { BASE_MOD } from '../base';
import type { Rng } from '../../rng';
import type { Board, LayoutId } from '../../types';
import type { ModDef, ScenarioDef } from '../types';

export type { ScenarioMap, MapHex, MapPort, MapTerrain } from './mapTypes';
export { MAP_DIRS, boardHexes } from './mapTypes';
import { boardHexes } from './mapTypes';
import { FOG_ISLANDS_3P, FOG_ISLANDS_4P } from './fogMaps';
import { CLOTH_FOR_CATAN, FORGOTTEN_TRIBE } from './tribeClothMaps';
import { PIRATE_ISLANDS, WONDERS_OF_CATAN } from './pirateWonderMaps';
import { NEW_WORLD_FRAME, applyVariableSetup, dealArea, newWorldBoard } from './random';
import {
  CLOTH_FOR_CATAN_56,
  FOG_ISLANDS_56,
  FORGOTTEN_TRIBE_56,
  NEW_SHORES_56,
  NEW_WORLD_56_FRAME,
  PIRATE_ISLANDS_56,
  SIX_ISLANDS_56,
  THROUGH_DESERT_56,
  WONDERS_OF_CATAN_56,
} from './maps56';
import { FOUR_ISLANDS_3P, FOUR_ISLANDS_4P, NEW_SHORES_3P, NEW_SHORES_4P, THROUGH_DESERT_3P, THROUGH_DESERT_4P } from './maps';
export { FOG_ISLANDS_3P, FOG_ISLANDS_4P } from './fogMaps';
export { CLOTH_FOR_CATAN, FORGOTTEN_TRIBE } from './tribeClothMaps';
export { PIRATE_ISLANDS, WONDERS_OF_CATAN } from './pirateWonderMaps';
export { WONDERS, WONDER_IDS, WONDER_LEVELS } from './wonders';
export { NEW_WORLD_FRAME } from './random';
export { FOUR_ISLANDS_3P, FOUR_ISLANDS_4P, NEW_SHORES_3P, NEW_SHORES_4P, THROUGH_DESERT_3P, THROUGH_DESERT_4P } from './maps';

/** Map size a game uses: 2–3 participants play the 3-player map, 4 the 4-player map, 5–6 the 5–6 map. */
export function scenarioMapSize(participants: number): 3 | 4 | 6 {
  return participants <= 3 ? 3 : participants === 4 ? 4 : 6;
}

/** Layout id of a scenario map, e.g. 'sf-newShores-3p'. */
export function scenarioLayoutId(scenario: string, size: 3 | 4 | 6): LayoutId {
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

/**
 * Seafarers 5–6 (CN3084): the CATAN 5–6 bank, deck and colours with ships, paired
 * players, and each scenario's 5–6 map. Shares the scenario list with SEAFARERS_MOD.
 */
SEAFARERS_MOD.large = {
  ...BASE_MOD.large!,
  id: 'seafarers',
  version: 1,
  layout: 'sf-newShores-6p',
  harborTypes: [],
  harborGaps: [],
  beginner: { hexes: [], harbors: [] },
  costs: { ...BASE_MOD.large!.costs, ship: { lumber: 1, wool: 1 } },
  pieceLimits: { ...BASE_MOD.large!.pieceLimits, ships: 15 },
  scenarios: SEAFARERS_MOD.scenarios,
  defaultScenario: 'newShores',
};

/** Adds (or replaces) a scenario of the Seafarers mod and registers its map layouts. */
export function addScenario(def: ScenarioDef): void {
  for (const size of [3, 4, 6] as const) {
    if (!def.maps[size]) continue;
    registerLayout(
      scenarioLayoutId(def.id, size),
      boardHexes(def.maps[size]!).map((h): [number, number] => [h.q, h.r]),
    );
  }
  SEAFARERS_MOD.scenarios![def.id] = def;
}

/**
 * The board of a scenario for this many participants: the printed map, dealt again
 * with `variable` (variable setup), or dealt at random (New World).
 */
export function scenarioBoard(def: ScenarioDef, participants: number, rng?: Rng, variable = false): Board {
  const size = scenarioMapSize(participants);
  const map = def.maps[size];
  if (!map) throw new Error('This scenario has no map for this many players');
  if (def.newWorld) {
    if (!rng) throw new Error('New World needs a random generator');
    return newWorldBoard(scenarioLayoutId(def.id, size), (size === 6 && def.newWorld[6]) || def.newWorld, rng);
  }
  const board = boardFromMap(map, scenarioLayoutId(def.id, size), {
    startRegions: def.startRegions,
    numberedOnly: def.numberedOnly,
    clothPerVillage: def.cloth?.perVillage,
    buildRegions: def.buildRegions,
    participants,
  });
  if (map.deal) {
    if (!rng) throw new Error('This map is dealt at random');
    dealArea(board, map.deal, participants, rng);
  }
  // Variable setup: only the 3–4 player maps have one.
  if (variable && def.variable && rng && size !== 6) applyVariableSetup(board, def, participants, rng);
  return board;
}

/**
 * Scenario 1, Heading for New Shores (rulebook p. 4): starting settlements on
 * the main island; +2 VP for a player's first settlement on each small island;
 * 14 VP wins.
 */
addScenario({
  id: 'newShores',
  victoryTarget: 14,
  maps: { 3: NEW_SHORES_3P, 4: NEW_SHORES_4P, 6: NEW_SHORES_56 },
  startRegions: ['main'],
  homeRegions: ['main'],
  regionBonus: 2,
  // p. 5: main island and small islands dealt apart; robber on the 12 (3p) or the desert (4p).
  variable: { groups: [['main'], ['*']], noAdjacentRed: true, robber: { 3: 'twelve', 4: 'desert' } },
});

/**
 * Scenario 2, The Four Islands (rulebook p. 6): starting settlements on one or
 * two islands, which become that player's home islands; +2 VP for the first
 * settlement on each other island; 13 VP wins.
 */
addScenario({
  id: 'fourIslands',
  victoryTarget: 13,
  // 5–6: "The Six Islands"
  maps: { 3: FOUR_ISLANDS_3P, 4: FOUR_ISLANDS_4P, 6: SIX_ISLANDS_56 },
  homeRegions: 'starting',
  regionBonus: 2,
  // p. 7: all land over the four islands; no 2, 3, 11 or 12 on forests and pastures; robber on the 12.
  variable: { groups: [['*']], lowNotOn: ['forest', 'pasture'], robber: 'twelve' },
});

/**
 * Scenario 3, The Fog Islands (rulebook p. 8): starting settlements anywhere;
 * a road or ship touching an empty space discovers it from the face-down stack
 * (land: random number disc + 1 resource of its type); 12 VP wins.
 */
addScenario({
  id: 'fogIslands',
  victoryTarget: 12,
  maps: { 3: FOG_ISLANDS_3P, 4: FOG_ISLANDS_4P, 6: FOG_ISLANDS_56 },
  fog: {
    3: {
      hexes: { sea: 2, gold: 2, hills: 2, forest: 1, pasture: 1, fields: 2, mountains: 2 },
      numbers: [3, 3, 4, 5, 6, 8, 9, 10, 11, 12],
    },
    4: {
      hexes: { sea: 2, gold: 2, hills: 2, forest: 1, pasture: 1, fields: 2, mountains: 2 },
      numbers: [3, 4, 5, 6, 8, 9, 10, 11, 11, 12],
    },
    // 5–6 (p. 6): 18 face-down hexes, 14 discs
    6: {
      hexes: { sea: 3, gold: 3, hills: 2, forest: 2, pasture: 2, fields: 2, mountains: 3, desert: 1 },
      numbers: [2, 2, 3, 3, 4, 5, 5, 6, 8, 9, 10, 11, 11, 12],
    },
  },
  // p. 9: face-up land over the two islands; red discs may touch; robber on the 12.
  variable: { groups: [['*']], robber: 'twelve' },
});

/**
 * Scenario 4, Through the Desert (rulebook p. 10): starting settlements on the
 * main island; the land strip beyond the desert and the small islands are
 * unexplored regions, +2 VP for the first settlement in each; 14 VP wins.
 */
addScenario({
  id: 'throughDesert',
  victoryTarget: 14,
  maps: { 3: THROUGH_DESERT_3P, 4: THROUGH_DESERT_4P, 6: THROUGH_DESERT_56 },
  startRegions: ['main'],
  homeRegions: ['main'],
  regionBonus: 2,
  // p. 11: deserts stay; the main island and the unexplored regions dealt apart; robber as printed.
  variable: { groups: [['main'], ['*']], fixed: ['desert'], noAdjacentRed: true, noRedOnGold: true, robber: 'keep' },
});

/**
 * Scenario 5, The Forgotten Tribe (rulebook p. 12): starting settlements on the
 * large island; settlements and the robber only at/on hexes with a number disc;
 * ships pick up the tribe's VP tokens, development cards and ports; 13 VP wins.
 */
addScenario({
  id: 'forgottenTribe',
  victoryTarget: 13,
  maps: { 3: FORGOTTEN_TRIBE, 4: FORGOTTEN_TRIBE, 6: FORGOTTEN_TRIBE_56 },
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
  maps: { 3: CLOTH_FOR_CATAN, 4: CLOTH_FOR_CATAN, 6: CLOTH_FOR_CATAN_56 },
  numberedOnly: true,
  shufflePorts: true,
  setupRounds: 3,
  noLongestRoute: true,
  cloth: { perVillage: 5, supply: 10, endWhenEmpty: 5 },
});

/**
 * Scenario 7, The Pirate Islands (rulebook p. 16): build one line of ships from the
 * main island to your beachhead and your pirate fortress; Knights only turn ships into
 * warships; the pirate fleet sails around the middle after each roll and attacks
 * buildings next to it; a 7 steals from anyone (no robber); no Longest Route or
 * Largest Army. Win with your fortress captured and 10 VP.
 */
addScenario({
  id: 'pirateIslands',
  victoryTarget: 10,
  maps: { 3: PIRATE_ISLANDS, 4: PIRATE_ISLANDS, 6: PIRATE_ISLANDS_56 },
  startRegions: ['main'],
  buildRegions: ['main'],
  shufflePorts: true,
  noLongestRoute: true,
  noLargestArmy: true,
  devDeck: {
    // 3 players: the Victory Point cards go back in the box.
    3: { knight: 14, victoryPoint: 0, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2 },
    // 4 players: the Victory Point cards count as Knights.
    4: { knight: 19, victoryPoint: 0, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2 },
    // 5–6: the CATAN 5–6 deck, Victory Point cards counting as Knights as with 4 players.
    6: { knight: 25, victoryPoint: 0, roadBuilding: 3, yearOfPlenty: 3, monopoly: 3 },
  },
});

/**
 * Scenario 8, The Wonders of Catan (rulebook p. 18): starting settlements on the
 * large island, not on a Great Wall / Great Bridge / "X" marker; +1 VP for the first
 * settlement on each small island; claim one wonder and build its 4 levels. Win by
 * finishing it, or with 10 VP and the highest wonder level. No pirate.
 */
addScenario({
  id: 'wondersOfCatan',
  victoryTarget: 10,
  maps: { 3: WONDERS_OF_CATAN, 4: WONDERS_OF_CATAN, 6: WONDERS_OF_CATAN_56 },
  startRegions: ['main'],
  homeRegions: ['main'],
  regionBonus: 1,
  shufflePorts: true,
  wonders: true,
  // p. 18: deserts and small islands stay; the main island is dealt; no red next to a desert.
  variable: { groups: [['main']], fixed: ['desert'], noRedNextTo: 'desert', robber: 'keep' },
});

/**
 * Scenario 9, New World (rulebook p. 20): the 42 hexes, 23 discs and 10 ports are dealt
 * at random; starting settlements on one or two islands, which become home; +1 VP for
 * the first settlement on each other island; 12 VP wins.
 */
addScenario({
  id: 'newWorld',
  victoryTarget: 12,
  maps: { 3: NEW_WORLD_FRAME, 4: NEW_WORLD_FRAME, 6: NEW_WORLD_56_FRAME },
  homeRegions: 'starting',
  regionBonus: 1,
  newWorld: {
    hexes: { sea: 19, hills: 4, forest: 5, pasture: 5, fields: 5, mountains: 4 },
    numbers: [2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 12],
    ports: ['lumber', 'brick', 'wool', 'grain', 'ore', 'generic', 'generic', 'generic', 'generic', 'generic'],
    // 5–6 (p. 12): 63 hexes, 39 discs, 11 ports; no red disc on gold
    6: {
      hexes: { sea: 21, gold: 4, hills: 7, forest: 7, pasture: 7, fields: 7, mountains: 7, desert: 3 },
      numbers: [2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12],
      ports: ['lumber', 'brick', 'wool', 'wool', 'grain', 'ore', 'generic', 'generic', 'generic', 'generic', 'generic'],
      noRedOnGold: true,
    },
  },
});
