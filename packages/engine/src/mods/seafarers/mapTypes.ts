import type { HarborType, Terrain } from '../../types';

/**
 * A Seafarers scenario map as printed in the rulebook, in pointy-top axial
 * coordinates (same as geometry.ts: x = sqrt3 * (q + r / 2), y = 1.5 * r).
 * Every hex inside the frame is listed, sea hexes included.
 */
export type MapTerrain = Terrain | 'sea' | 'gold';

export interface MapHex {
  q: number;
  r: number;
  t: MapTerrain;
  /** Number disc; null for sea, desert and other hexes without one. */
  n: number | null;
  /**
   * Land region the hex belongs to, for "first settlement on an island/region"
   * bonuses and starting-placement limits (e.g. 'main', 'isle1'). Omit for sea.
   */
  region?: string;
}

/** Directions of the six neighbours of a pointy-top axial hex. */
export const MAP_DIRS: Array<[number, number]> = [
  [1, 0], // 0 east
  [1, -1], // 1 north-east
  [0, -1], // 2 north-west
  [-1, 0], // 3 west
  [-1, 1], // 4 south-west
  [0, 1], // 5 south-east
];

/** A port on the side `dir` of land hex (q, r) — the side facing the sea or the frame. */
export interface MapPort {
  q: number;
  r: number;
  dir: 0 | 1 | 2 | 3 | 4 | 5;
  type: HarborType;
}

export interface ScenarioMap {
  hexes: MapHex[];
  ports: MapPort[];
  /**
   * Starting hex of the robber (a land hex) and of the pirate (a sea hex), as [q, r].
   * `robber: null` = no robber in this scenario; no `pirate` = no pirate.
   */
  robber: [number, number] | null;
  pirate?: [number, number];
  /** Sea spaces printed on the frame; part of the board as sea hexes (ids after the listed hexes). */
  frameSea?: Array<[number, number]>;
  /** The Forgotten Tribe: items lying on side `dir` of hex (q, r). */
  edgeItems?: Array<{ q: number; r: number; dir: 0 | 1 | 2 | 3 | 4 | 5; item: 'vp' | 'dev' | 'port' }>;
  /** Cloth for Catan: a village at the top or bottom corner of hex (q, r), with its number disc. */
  villages?: Array<{ q: number; r: number; corner: 'top' | 'bottom'; n: number }>;
  /**
   * The Pirate Islands: the pirate fleet's path (sea hexes in sailing order) and one
   * slot per colour — printed settlement + ship, beachhead and pirate fortress.
   * `slots3` = the slots used with 2–3 participants.
   */
  pirateIslands?: { path: Array<[number, number]>; slots: PirateSlot[]; slots3: number[] };
  /** The Wonders of Catan: Great Wall and Great Bridge markers, and the "X" markers. */
  wonderSpots?: { wall: MapCorner[]; bridge: MapCorner[]; blocked: MapCorner[] };
}

/** Corner `c` of hex (q, r): 0 top, 1 north-east, 2 south-east, 3 bottom, 4 south-west, 5 north-west. */
export interface MapCorner {
  q: number;
  r: number;
  c: 0 | 1 | 2 | 3 | 4 | 5;
}

export interface PirateSlot {
  start: MapCorner;
  ship: { q: number; r: number; dir: 0 | 1 | 2 | 3 | 4 | 5 };
  beachhead: MapCorner;
  fortress: MapCorner;
}

/** Every hex of the board in id order: the listed hexes, then the frame-printed sea spaces. */
export function boardHexes(map: ScenarioMap): MapHex[] {
  return [...map.hexes, ...(map.frameSea ?? []).map(([q, r]): MapHex => ({ q, r, t: 'sea', n: null }))];
}
