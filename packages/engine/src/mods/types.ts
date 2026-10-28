import type { DevCardType, HarborType, LayoutId, ModId, ResMap, Terrain } from '../types';
import type { ScenarioMap } from './seafarers/mapTypes';

/** A scenario of a scenario-based mod (Seafarers): fixed maps plus its own rules. */
export interface ScenarioDef {
  id: string;
  /** Victory points needed to win; overrides the room's target. */
  victoryTarget: number;
  /** Printed maps: 2–3 participants play `3`, 4 play `4`. */
  maps: { 3: ScenarioMap; 4: ScenarioMap };
  /** Starting settlements only on hexes of these regions (missing = anywhere). */
  startRegions?: string[];
  /** Regions where a first settlement earns no bonus (home islands). */
  homeRegions?: string[];
  /** VP tokens for a player's first settlement in each other region (0/missing = none). */
  regionBonus?: number;
}

/**
 * Everything that makes one mod (expansion) different from another. The
 * engine, bots, server and client read these instead of hard-coded numbers.
 * Bump `version` when a rule changes; running games keep their version.
 */
export interface ModDef {
  id: ModId;
  version: number;
  minPlayers: number;
  maxPlayers: number;
  layout: LayoutId;
  terrainCounts: Partial<Record<Terrain, number>>;
  numberTokens: number[];
  /** Harbor types to shuffle, and gaps between consecutive harbors along the coast. */
  harborTypes: HarborType[];
  harborGaps: number[];
  /** Fixed beginner board: terrain + number per hex id, harbor type per harbor slot. */
  beginner: { hexes: Array<[Terrain, number | null]>; harbors: HarborType[] };
  bankPerResource: number;
  devDeck: Record<DevCardType, number>;
  /** `ship` only in mods with ships (Seafarers). */
  costs: Record<'road' | 'settlement' | 'city' | 'devCard', Partial<ResMap>> & { ship?: Partial<ResMap> };
  /** `ships` only in mods with ships (Seafarers); its presence enables ships and the pirate. */
  pieceLimits: { roads: number; settlements: number; cities: number; ships?: number };
  /** Piece colour per seat. */
  colors: string[];
  /**
   * 5–6 player game (official "paired players" rule): after Player 1's turn,
   * the third player after them takes a build-only Action phase as Player 2.
   */
  pairedPlayers?: boolean;
  /** Scenario-based mods: scenarios by id, and the one used when none is chosen. */
  scenarios?: Record<string, ScenarioDef>;
  defaultScenario?: string;
  /** The 5–6 player rules of this mod, used when more than `maxPlayers` take part. */
  large?: ModDef;
}
