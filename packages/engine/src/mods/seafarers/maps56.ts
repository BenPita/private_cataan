import { MAP_DIRS, type MapHex, type MapTerrain, type ScenarioMap } from './mapTypes';

/*
 * Seafarers 5-6 player maps (CATAN - Seafarers 5-6 Player rulebook 2025, pp. 4-12),
 * transcribed hex by hex. Frames: 56 spaces (rows 7-8-9-8-9-8-7) or 63 spaces
 * (rows 8-9-10-9-10-9-8). Every scenario uses one map for 5 and 6 players.
 *
 * Rows are written as tokens: S sea, X face-down (fog) space, D desert, and a terrain
 * letter with its disc — G gold, H hills, F forest, P pasture, W fields (wheat),
 * M mountains — e.g. "G9", or the letter alone for a hex without a disc.
 */

const TERRAIN: Record<string, MapTerrain> = {
  S: 'sea',
  // New Shores' main island: a placeholder (land) dealt at random, see fillMain
  Q: 'desert',
  X: 'fog',
  D: 'desert',
  G: 'gold',
  H: 'hills',
  F: 'forest',
  P: 'pasture',
  W: 'fields',
  M: 'mountains',
};

/**
 * Builds the hex list from rows ([r, first q, tokens]). Land regions are the
 * connected islands: the one holding a `named` hex gets that name, the others
 * isle1.. in row order. `fixed` regions are set first and cut islands apart (the
 * deserts of Through the Desert belong to 'main').
 */
function build(
  rows: Array<[number, number, string]>,
  named: Record<string, [number, number]>,
  fixed: Record<string, string> = {},
): MapHex[] {
  const hexes: MapHex[] = rows.flatMap(([r, q0, line]) =>
    line
      .trim()
      .split(/\s+/)
      .map((tok, i): MapHex => {
        const t = TERRAIN[tok[0]];
        if (!t) throw new Error(`Bad map token ${tok}`);
        return { q: q0 + i, r, t, n: tok.length > 1 ? Number(tok.slice(1)) : null };
      }),
  );
  const key = (q: number, r: number) => `${q},${r}`;
  const byKey = new Map(hexes.map((h) => [key(h.q, h.r), h]));
  const land = (h: MapHex | undefined) => !!h && h.t !== 'sea' && h.t !== 'fog';
  for (const [k, region] of Object.entries(fixed)) byKey.get(k)!.region = region;
  const names = new Map(Object.entries(named).map(([name, [q, r]]) => [key(q, r), name]));
  let isle = 0;
  for (const start of hexes) {
    if (!land(start) || start.region) continue;
    const group = [start];
    start.region = '?';
    for (let i = 0; i < group.length; i++) {
      for (const [dq, dr] of MAP_DIRS) {
        const n = byKey.get(key(group[i].q + dq, group[i].r + dr));
        if (land(n) && !n!.region) {
          n!.region = '?';
          group.push(n!);
        }
      }
    }
    const name = group.map((h) => names.get(key(h.q, h.r))).find((x) => x) ?? `isle${++isle}`;
    group.forEach((h) => (h.region = name));
  }
  return hexes;
}

/**
 * New Shores' main island ("Q" spaces) is dealt at random in every game with the CATAN 5-6
 * hexes and discs; these placeholders only give the right counts.
 */
function fillMain(hexes: MapHex[]): MapHex[] {
  const terrains: MapTerrain[] = ['hills', 'forest', 'pasture', 'fields', 'mountains', 'desert'].flatMap((t, i) =>
    Array<MapTerrain>([5, 6, 6, 6, 5, 2][i]).fill(t as MapTerrain),
  );
  const numbers = [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12];
  let t = 0;
  let n = 0;
  for (const h of hexes) {
    if (h.region !== 'main') continue;
    h.t = terrains[t++];
    h.n = h.t === 'desert' ? null : numbers[n++];
  }
  return hexes;
}

/** "Heading for New Shores" (p. 4): the 30-hex main island is dealt like a CATAN 5-6 board. */
export const NEW_SHORES_56: ScenarioMap = {
  hexes: fillMain(
    build(
      [
        [0, -2, 'G9 S Q Q Q S M6'],
        [1, -3, 'M11 S Q Q Q Q S S'],
        [2, -4, 'P8 S Q Q Q Q Q S H12'],
        [3, -4, 'S Q Q Q Q Q Q S'],
        [4, -5, 'H4 S Q Q Q Q Q S W3'],
        [5, -5, 'F2 S Q Q Q Q S S'],
        [6, -5, 'G5 S Q Q Q S G10'],
      ],
      { main: [0, 0] },
    ),
  ),
  ports: [
    { q: 1, r: 0, dir: 1, type: 'lumber' },
    { q: -1, r: 1, dir: 2, type: 'brick' },
    { q: 2, r: 1, dir: 1, type: 'wool' },
    { q: -2, r: 2, dir: 3, type: 'wool' },
    { q: 2, r: 2, dir: 0, type: 'grain' },
    { q: -3, r: 3, dir: 4, type: 'ore' },
    { q: 2, r: 3, dir: 5, type: 'generic' },
    { q: 0, r: 5, dir: 0, type: 'generic' },
    { q: -3, r: 5, dir: 4, type: 'generic' },
    { q: -2, r: 6, dir: 4, type: 'generic' },
    { q: -1, r: 6, dir: 5, type: 'generic' },
  ],
  // placeholder: the deal puts the robber on a desert
  robber: [-3, 6],
  pirate: [4, 3],
  frameSea: [[4, 3]],
  shufflePorts: true,
  deal: { groups: [['main']], noAdjacentRed: true, robber: 'desert' },
};

/** "The Six Islands" (p. 5): the scenario's 5-6 name for The Four Islands. */
export const SIX_ISLANDS_56: ScenarioMap = {
  hexes: build(
    [
      [0, -2, 'P12 M4 S F6 S M9 P6'],
      [1, -3, 'F8 M10 S M11 H10 S W3 H10'],
      [2, -4, 'H11 W9 S P3 F4 S S F4 S'],
      [3, -4, 'S S S S S S S S'],
      [4, -5, 'S H4 S S P8 F10 S F5 W6'],
      [5, -5, 'F9 W12 S W5 M3 S H8 P9'],
      [6, -5, 'P5 M6 S P2 S H5 W2'],
    ],
    {},
  ),
  ports: [
    { q: -1, r: 0, dir: 2, type: 'lumber' },
    { q: 1, r: 0, dir: 1, type: 'brick' },
    { q: 4, r: 0, dir: 1, type: 'wool' },
    { q: -2, r: 1, dir: 5, type: 'wool' },
    { q: 3, r: 1, dir: 4, type: 'grain' },
    { q: -3, r: 2, dir: 4, type: 'ore' },
    { q: -5, r: 5, dir: 3, type: 'generic' },
    { q: -4, r: 6, dir: 1, type: 'generic' },
    { q: -2, r: 5, dir: 4, type: 'generic' },
    { q: 0, r: 6, dir: 4, type: 'generic' },
    { q: 2, r: 5, dir: 0, type: 'generic' },
  ],
  robber: [-2, 0],
  pirate: [-5, 3],
  frameSea: [[-5, 3]],
  shufflePorts: true,
};

/** "The Fog Islands" (p. 6): 18 face-down spaces between two coasts; ports printed. */
export const FOG_ISLANDS_56: ScenarioMap = {
  hexes: build(
    [
      [0, -2, 'F10 S X X S F9 W2'],
      [1, -3, 'P6 S X X X S W5 M12'],
      [2, -4, 'W12 H4 S X X X S P4 H8'],
      [3, -4, 'M11 P5 S X X S F6 P3'],
      [4, -5, 'W6 F3 S X X X S M9 W4'],
      [5, -5, 'H9 P8 S X X X S H10'],
      [6, -5, 'H11 M10 S X X S F8'],
    ],
    { west: [-2, 0], east: [3, 0] },
  ),
  ports: [
    { q: 3, r: 0, dir: 1, type: 'lumber' },
    { q: -3, r: 1, dir: 2, type: 'generic' },
    { q: -3, r: 2, dir: 0, type: 'wool' },
    { q: -4, r: 3, dir: 3, type: 'ore' },
    { q: -5, r: 5, dir: 3, type: 'generic' },
    { q: -4, r: 6, dir: 1, type: 'generic' },
    { q: 4, r: 2, dir: 1, type: 'generic' },
    { q: 3, r: 1, dir: 4, type: 'wool' },
    { q: 3, r: 4, dir: 1, type: 'brick' },
    { q: 3, r: 4, dir: 5, type: 'grain' },
    { q: 2, r: 5, dir: 3, type: 'generic' },
  ],
  robber: [-4, 2],
  pirate: [-2, 7],
  frameSea: [[-2, 7]],
};

/** "Through the Desert" (p. 7): the desert row cuts two strips off the main island. */
export const THROUGH_DESERT_56: ScenarioMap = {
  hexes: build(
    [
      [0, 0, 'G4 M6 H11 S F12 W5 M3 H6'],
      [1, -1, 'F5 P2 D D D D D S S'],
      [2, -2, 'S S S W2 F8 P9 F10 S S G10'],
      [3, -2, 'M4 F5 W10 H5 P10 F4 H8 S S'],
      [4, -3, 'P12 W3 H12 M6 H11 M3 W9 S S M8'],
      [5, -3, 'H9 M11 S S S S S P11 F3'],
      [6, -3, 'P6 S P8 W2 S G4 S W9'],
    ],
    { main: [1, 2], strip: [0, 0], strip2: [4, 0] },
    { '1,1': 'main', '2,1': 'main', '3,1': 'main', '4,1': 'main', '5,1': 'main' },
  ),
  ports: [
    { q: 4, r: 2, dir: 0, type: 'lumber' },
    { q: -2, r: 3, dir: 2, type: 'brick' },
    { q: 0, r: 3, dir: 2, type: 'wool' },
    { q: -3, r: 4, dir: 2, type: 'wool' },
    { q: 4, r: 3, dir: 5, type: 'grain' },
    { q: -1, r: 4, dir: 5, type: 'ore' },
    { q: 1, r: 4, dir: 4, type: 'generic' },
    { q: 3, r: 4, dir: 4, type: 'generic' },
    { q: -3, r: 5, dir: 3, type: 'generic' },
    { q: -2, r: 5, dir: 5, type: 'generic' },
    { q: -3, r: 6, dir: 4, type: 'generic' },
  ],
  robber: [3, 1],
  pirate: [3, 6],
  shufflePorts: true,
};

/** "The Forgotten Tribe" (p. 8): gifts with printed ports (5 x 2:1, 3 x 3:1), 10 VP, 6 cards. */
export const FORGOTTEN_TRIBE_56: ScenarioMap = {
  hexes: build(
    [
      [0, 0, 'D D S G G S P P'],
      [1, -1, 'S S S S S S S S S'],
      [2, -2, 'W3 H5 M11 P8 H4 F10 W4 H3 F8 M5'],
      [3, -2, 'F11 P12 F5 W10 P5 H9 W2 P9 H10'],
      [4, -3, 'F6 M4 W9 H8 F11 M3 P4 W6 F3 M6'],
      [5, -3, 'S S S S S S S S S'],
      [6, -3, 'D D S M H S W G'],
    ],
    { main: [-2, 2] },
  ),
  ports: [],
  edgeItems: [
    { q: 0, r: 0, dir: 2, item: 'vp' },
    { q: 0, r: 0, dir: 3, item: 'dev' },
    { q: 1, r: 0, dir: 2, item: 'vp' },
    { q: 1, r: 0, dir: 1, item: 'port', port: 'grain' },
    { q: 3, r: 0, dir: 2, item: 'port', port: 'generic' },
    { q: 3, r: 0, dir: 1, item: 'vp' },
    { q: 4, r: 0, dir: 2, item: 'vp' },
    { q: 4, r: 0, dir: 1, item: 'dev' },
    { q: 6, r: 0, dir: 2, item: 'vp' },
    { q: 6, r: 0, dir: 1, item: 'port', port: 'lumber' },
    { q: 7, r: 0, dir: 1, item: 'port', port: 'generic' },
    { q: 7, r: 0, dir: 0, item: 'dev' },
    { q: -3, r: 6, dir: 3, item: 'dev' },
    { q: -3, r: 6, dir: 4, item: 'port', port: 'brick' },
    { q: -2, r: 6, dir: 4, item: 'vp' },
    { q: -2, r: 6, dir: 5, item: 'port', port: 'wool' },
    { q: 0, r: 6, dir: 4, item: 'dev' },
    { q: 0, r: 6, dir: 5, item: 'vp' },
    { q: 1, r: 6, dir: 4, item: 'vp' },
    { q: 1, r: 6, dir: 5, item: 'port', port: 'ore' },
    { q: 3, r: 6, dir: 4, item: 'port', port: 'generic' },
    { q: 3, r: 6, dir: 5, item: 'vp' },
    { q: 4, r: 6, dir: 5, item: 'vp' },
    { q: 4, r: 6, dir: 0, item: 'dev' },
  ],
  robber: [0, 0],
  pirate: [-1, 6],
};

/** "Cloth for Catan" (p. 9): two large islands around six small ones with 12 villages. */
export const CLOTH_FOR_CATAN_56: ScenarioMap = {
  hexes: build(
    [
      [0, 0, 'F4 P6 H5 W12 H3 P11 W8'],
      [1, -1, 'W3 F12 S S S S F3 M9'],
      [2, -2, 'W11 S S D S D S S P3'],
      [3, -2, 'S G S S S S G S'],
      [4, -3, 'M8 S S D S D S S M2'],
      [5, -3, 'H9 W2 S S S S P11 M4'],
      [6, -3, 'P10 F6 M5 F11 F8 W10 H6'],
    ],
    { north: [0, 0], south: [-3, 4] },
  ),
  ports: [
    { q: 0, r: 0, dir: 1, type: 'lumber' },
    { q: 3, r: 0, dir: 2, type: 'brick' },
    { q: 5, r: 0, dir: 2, type: 'wool' },
    { q: -1, r: 1, dir: 3, type: 'wool' },
    { q: 6, r: 1, dir: 0, type: 'grain' },
    { q: 5, r: 4, dir: 0, type: 'ore' },
    { q: -3, r: 5, dir: 3, type: 'generic' },
    { q: 4, r: 5, dir: 5, type: 'generic' },
    { q: -2, r: 6, dir: 4, type: 'generic' },
    { q: -1, r: 6, dir: 5, type: 'generic' },
    { q: 2, r: 6, dir: 5, type: 'generic' },
  ],
  villages: [
    { q: 1, r: 2, corner: 'top', n: 2 },
    { q: 1, r: 2, corner: 'bottom', n: 5 },
    { q: 3, r: 2, corner: 'top', n: 10 },
    { q: 3, r: 2, corner: 'bottom', n: 8 },
    { q: -1, r: 3, corner: 'top', n: 4 },
    { q: -1, r: 3, corner: 'bottom', n: 9 },
    { q: 4, r: 3, corner: 'top', n: 4 },
    { q: 4, r: 3, corner: 'bottom', n: 5 },
    { q: 0, r: 4, corner: 'top', n: 6 },
    { q: 0, r: 4, corner: 'bottom', n: 12 },
    { q: 2, r: 4, corner: 'top', n: 9 },
    { q: 2, r: 4, corner: 'bottom', n: 10 },
  ],
  robber: [-2, 2],
  pirate: [6, 3],
  frameSea: [[6, 3]],
  shufflePorts: true,
};

/**
 * "The Pirate Islands" (p. 10): main island in the east; 6 colour slots (red, blue,
 * white, orange, green, purple — 5 players leave out purple). The fleet skips its
 * attack on the "!" hex.
 */
export const PIRATE_ISLANDS_56: ScenarioMap = {
  hexes: build(
    [
      [0, 0, 'G3 S M6 S S P5 W4 H9'],
      [1, -1, 'S S S S D S M3 H10 F11'],
      [2, -2, 'G11 D M8 S S S F12 F6 P4 F10'],
      [3, -2, 'S S S D S W6 W4 M5 P8'],
      [4, -3, 'G11 D M6 S S S P2 P10 H3 P5'],
      [5, -3, 'S S S S D S W11 M9 H8'],
      [6, -3, 'G3 S M8 S S F9 W5 F4'],
    ],
    { main: [5, 0] },
  ),
  ports: [
    { q: 6, r: 0, dir: 2, type: 'lumber' },
    { q: 7, r: 0, dir: 2, type: 'brick' },
    { q: 7, r: 0, dir: 0, type: 'wool' },
    { q: 7, r: 1, dir: 0, type: 'grain' },
    { q: 6, r: 3, dir: 0, type: 'ore' },
    { q: 5, r: 5, dir: 0, type: 'generic' },
    { q: 4, r: 6, dir: 0, type: 'generic' },
    { q: 3, r: 6, dir: 4, type: 'generic' },
    { q: 4, r: 6, dir: 4, type: 'generic' },
  ],
  robber: null,
  pirate: [0, 6],
  pirateIslands: {
    path: [[0, 6], [0, 5], [0, 4], [0, 3], [1, 2], [2, 1], [3, 0], [4, 0], [4, 1], [3, 2], [2, 3], [2, 4], [2, 5], [1, 6]],
    safe: [0, 3],
    slots: [
      // red
      { start: { q: 5, r: 0, c: 5 }, ship: { q: 4, r: 0, dir: 1 }, beachhead: { q: 2, r: 0, c: 1 }, fortress: { q: 0, r: 0, c: 5 } },
      // blue
      { start: { q: 4, r: 2, c: 4 }, ship: { q: 3, r: 3, dir: 2 }, beachhead: { q: 0, r: 2, c: 2 }, fortress: { q: -2, r: 2, c: 2 } },
      // white
      { start: { q: 5, r: 1, c: 5 }, ship: { q: 4, r: 1, dir: 1 }, beachhead: { q: 2, r: 0, c: 3 }, fortress: { q: 0, r: 0, c: 3 } },
      // orange
      { start: { q: 3, r: 3, c: 3 }, ship: { q: 3, r: 3, dir: 4 }, beachhead: { q: -1, r: 4, c: 1 }, fortress: { q: -3, r: 4, c: 1 } },
      // green
      { start: { q: 2, r: 6, c: 0 }, ship: { q: 2, r: 6, dir: 2 }, beachhead: { q: -1, r: 6, c: 0 }, fortress: { q: -3, r: 6, c: 0 } },
      // purple
      { start: { q: 2, r: 6, c: 4 }, ship: { q: 1, r: 6, dir: 5 }, beachhead: { q: -1, r: 6, c: 2 }, fortress: { q: -3, r: 6, c: 4 } },
    ],
    slots3: [0, 1, 2, 3, 4],
  },
};

/** "The Wonders of Catan" (p. 11): 7 wonders; a lighthouse strait joins the north. */
export const WONDERS_OF_CATAN_56: ScenarioMap = {
  hexes: build(
    [
      [0, 0, 'G8 S P10 S W12 S S S'],
      [1, -1, 'S S H11 S F11 S S D D'],
      [2, -2, 'S H2 P5 W6 H5 W3 P8 F11 D S'],
      [3, -2, 'S W9 M3 F4 M6 W10 P9 H10 D'],
      [4, -3, 'S S H8 P5 S H4 F8 M12 S S'],
      [5, -3, 'G6 S F10 M3 S M9 W4 S F4'],
      [6, -3, 'S M5 F9 S P2 P11 S G6'],
    ],
    { main: [2, 0] },
  ),
  ports: [
    { q: 0, r: 2, dir: 2, type: 'lumber' },
    { q: -1, r: 2, dir: 3, type: 'brick' },
    { q: 1, r: 2, dir: 1, type: 'wool' },
    { q: 3, r: 2, dir: 1, type: 'wool' },
    { q: 1, r: 3, dir: 5, type: 'grain' },
    { q: -1, r: 4, dir: 3, type: 'ore' },
    { q: 4, r: 4, dir: 5, type: 'generic' },
    { q: -1, r: 5, dir: 3, type: 'generic' },
    { q: 3, r: 5, dir: 5, type: 'generic' },
    { q: -2, r: 6, dir: 5, type: 'generic' },
    { q: 1, r: 6, dir: 5, type: 'generic' },
  ],
  robber: [6, 2],
  shufflePorts: true,
  wonderSpots: {
    wall: [
      { q: 5, r: 2, c: 0 },
      { q: 5, r: 2, c: 1 },
      { q: 5, r: 2, c: 2 },
      { q: 5, r: 3, c: 1 },
      { q: 5, r: 3, c: 2 },
    ],
    bridge: [
      { q: 0, r: 5, c: 2 },
      { q: 1, r: 6, c: 5 },
    ],
    lighthouse: [
      { q: 2, r: 0, c: 2 },
      { q: 3, r: 1, c: 5 },
    ],
    blocked: [
      { q: 2, r: 0, c: 1 },
      { q: 4, r: 0, c: 4 },
      { q: 1, r: 1, c: 1 },
      { q: 3, r: 1, c: 4 },
      { q: 0, r: 5, c: 1 },
      { q: 0, r: 5, c: 3 },
      { q: 1, r: 6, c: 0 },
      { q: 1, r: 6, c: 4 },
    ],
  },
};

/** New World (p. 12): the 63-space frame, dealt at random. */
export const NEW_WORLD_56_FRAME: ScenarioMap = {
  hexes: [
    [0, 0, 8],
    [1, -1, 9],
    [2, -2, 10],
    [3, -2, 9],
    [4, -3, 10],
    [5, -3, 9],
    [6, -3, 8],
  ].flatMap(([r, q0, n]) => Array.from({ length: n }, (_, i): MapHex => ({ q: q0 + i, r, t: 'sea', n: null }))),
  ports: [],
  robber: null,
};
