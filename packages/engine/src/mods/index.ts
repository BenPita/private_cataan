import type { GameConfig, ModId } from '../types';
import { BASE_MOD } from './base';
import { SEAFARERS_MOD } from './seafarers';
import type { ModDef, ScenarioDef } from './types';

export type { ModDef, ScenarioDef } from './types';
export { BASE_MOD } from './base';
export { SEAFARERS_MOD, WONDERS, WONDER_IDS, WONDER_LEVELS, addScenario, scenarioBoard, scenarioLayoutId, scenarioMapSize } from './seafarers';
export type { ScenarioMap, MapHex, MapPort, MapTerrain } from './seafarers';

/** Every installed mod. Server validation and the client's mod cards both read this. */
export const MODS: Record<ModId, ModDef> = {
  base: BASE_MOD,
  seafarers: SEAFARERS_MOD,
};

export function isModId(id: unknown): id is ModId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(MODS, id);
}

/**
 * The rules a game (state or view) is played with; old saves without a mod
 * are base. More participants than the mod's normal range → its 5–6 rules.
 */
export function modFor(s: { config: Pick<GameConfig, 'mod'>; players: { length: number } }): ModDef {
  const id = s.config.mod ?? 'base';
  if (!isModId(id)) throw new Error(`Unknown mod: ${String(id)}`);
  const def = MODS[id];
  return def.large && s.players.length > def.maxPlayers ? def.large : def;
}

/** Overall participant range of a mod, including its 5–6 rules. */
export function modPlayerRange(def: ModDef): { min: number; max: number } {
  return { min: def.minPlayers, max: def.large?.maxPlayers ?? def.maxPlayers };
}

/** Does this mod have ships (and the pirate)? */
export function hasShips(def: ModDef): boolean {
  return def.pieceLimits.ships !== undefined;
}

/** The scenario a game (state or view) is played with, or null for mods without scenarios. */
export function scenarioFor(s: { config: Pick<GameConfig, 'mod' | 'scenario'>; players: { length: number } }): ScenarioDef | null {
  const def = modFor(s);
  if (!def.scenarios) return null;
  return def.scenarios[s.config.scenario ?? def.defaultScenario ?? ''] ?? null;
}
