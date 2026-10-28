import type { GameConfig, ModId } from '../types';
import { BASE_MOD } from './base';
import type { ModDef } from './types';

export type { ModDef } from './types';
export { BASE_MOD } from './base';

/** Every installed mod. Server validation and the client's mod cards both read this. */
export const MODS: Record<ModId, ModDef> = {
  base: BASE_MOD,
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
