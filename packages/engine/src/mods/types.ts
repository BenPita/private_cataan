import type { DevCardType, HarborType, LayoutId, ModId, ResMap, Terrain } from '../types';

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
  terrainCounts: Record<Terrain, number>;
  numberTokens: number[];
  /** Harbor types to shuffle, and gaps between consecutive harbors along the coast. */
  harborTypes: HarborType[];
  harborGaps: number[];
  /** Fixed beginner board: terrain + number per hex id, harbor type per harbor slot. */
  beginner: { hexes: Array<[Terrain, number | null]>; harbors: HarborType[] };
  bankPerResource: number;
  devDeck: Record<DevCardType, number>;
  costs: Record<'road' | 'settlement' | 'city' | 'devCard', Partial<ResMap>>;
  pieceLimits: { roads: number; settlements: number; cities: number };
  /** Piece colour per seat. */
  colors: string[];
}
