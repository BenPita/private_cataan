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

/** The mod a game (state or view) is played with; old saves without one are base. */
export function modFor(s: { config: Pick<GameConfig, 'mod'> }): ModDef {
  return MODS[s.config.mod ?? 'base'];
}
