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
  /**
   * 5–6 player game (official "paired players" rule): after Player 1's turn,
   * the third player after them takes a build-only Action phase as Player 2.
   */
  pairedPlayers?: boolean;
  /** The 5–6 player rules of this mod, used when more than `maxPlayers` take part. */
  large?: ModDef;
}
