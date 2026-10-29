import { describe, expect, it } from 'vitest';
import {
  FOUR_ISLANDS_3P,
  FOUR_ISLANDS_4P,
  NEW_SHORES_3P,
  NEW_SHORES_4P,
  THROUGH_DESERT_3P,
  THROUGH_DESERT_4P,
} from '../src/mods/seafarers/maps';
import { FOG_ISLANDS_3P, FOG_ISLANDS_4P } from '../src/mods/seafarers/fogMaps';
import { CLOTH_FOR_CATAN, FORGOTTEN_TRIBE } from '../src/mods/seafarers/tribeClothMaps';
import { PIRATE_ISLANDS, WONDERS_OF_CATAN } from '../src/mods/seafarers/pirateWonderMaps';
import {
  CLOTH_FOR_CATAN_56,
  FOG_ISLANDS_56,
  FORGOTTEN_TRIBE_56,
  NEW_SHORES_56,
  PIRATE_ISLANDS_56,
  SIX_ISLANDS_56,
  THROUGH_DESERT_56,
  WONDERS_OF_CATAN_56,
} from '../src/mods/seafarers/maps56';
import { MAP_DIRS, type MapHex, type ScenarioMap } from '../src/mods/seafarers/mapTypes';

/** Component tables printed next to each map (rulebook pp. 4-7, 10-11). */
interface Table {
  terrain: Record<string, number>;
  discs: Record<number, number>;
  ports2to1: number;
  ports3to1: number;
  /** Small islands without number discs (The Forgotten Tribe, Cloth for Catan). */
  unnumbered?: boolean;
  /** The ports lie on sea edges as items (The Forgotten Tribe), not on the map's coast. */
  itemPorts?: boolean;
  /** Seafarers 5–6 adds a second 2:1 wool port. */
  extraWool?: boolean;
}

const TABLE_3P: Table = {
  terrain: { sea: 13, gold: 2, hills: 4, forest: 3, pasture: 5, fields: 4, mountains: 4, desert: 0 },
  discs: { 2: 1, 3: 2, 4: 3, 5: 3, 6: 2, 8: 3, 9: 2, 10: 3, 11: 2, 12: 1 },
  ports2to1: 5,
  ports3to1: 3,
};

const TABLE_4P: Table = {
  terrain: { sea: 14, gold: 2, hills: 5, forest: 5, pasture: 5, fields: 5, mountains: 5, desert: 1 },
  discs: { 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 1 },
  ports2to1: 5,
  ports3to1: 4,
};

const TABLE_FOUR_ISLANDS_3P: Table = {
  terrain: { sea: 15, gold: 0, hills: 4, forest: 4, pasture: 4, fields: 4, mountains: 4, desert: 0 },
  discs: { 2: 1, 3: 2, 4: 2, 5: 3, 6: 2, 8: 2, 9: 3, 10: 2, 11: 2, 12: 1 },
  ports2to1: 5,
  ports3to1: 4,
};

const TABLE_FOUR_ISLANDS_4P: Table = {
  terrain: { sea: 12, gold: 0, hills: 4, forest: 5, pasture: 5, fields: 5, mountains: 4, desert: 0 },
  discs: { 2: 1, 3: 2, 4: 3, 5: 3, 6: 2, 8: 2, 9: 3, 10: 3, 11: 3, 12: 1 },
  ports2to1: 5,
  ports3to1: 4,
};

const TABLE_DESERT_3P: Table = {
  terrain: { sea: 10, gold: 2, hills: 3, forest: 5, pasture: 4, fields: 4, mountains: 4, desert: 3 },
  discs: { 2: 1, 3: 2, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 2, 11: 1, 12: 1 },
  ports2to1: 5,
  ports3to1: 3,
};

const TABLE_DESERT_4P: Table = {
  terrain: { sea: 12, gold: 2, hills: 5, forest: 5, pasture: 5, fields: 5, mountains: 5, desert: 3 },
  discs: { 2: 1, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 },
  ports2to1: 5,
  ports3to1: 4,
};

/** The Fog Islands (pp. 8-9): face-up hexes and discs; the 12 empty spaces are `fog`. */
const TABLE_FOG_3P: Table = {
  terrain: { sea: 16, gold: 0, hills: 2, forest: 4, pasture: 4, fields: 2, mountains: 2, desert: 0, fog: 12 },
  discs: { 3: 1, 4: 1, 5: 2, 6: 2, 8: 2, 9: 2, 10: 1, 11: 2, 12: 1 },
  ports2to1: 5,
  ports3to1: 3,
};

const TABLE_FOG_4P: Table = {
  terrain: { sea: 13, gold: 0, hills: 3, forest: 4, pasture: 4, fields: 3, mountains: 3, desert: 0, fog: 12 },
  discs: { 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 1, 12: 1 },
  ports2to1: 5,
  ports3to1: 4,
};

/** The Forgotten Tribe (p. 12), one map for 3 and 4 players. */
const TABLE_TRIBE: Table = {
  terrain: { sea: 19, gold: 2, hills: 5, forest: 5, pasture: 5, fields: 5, mountains: 5, desert: 3 },
  discs: { 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 1 },
  ports2to1: 5,
  ports3to1: 1,
  unnumbered: true,
  itemPorts: true,
};

/** Cloth for Catan (p. 14), one map for 3 and 4 players; 8 of the 28 discs are villages. */
const TABLE_CLOTH: Table = {
  terrain: { sea: 18, gold: 2, hills: 3, forest: 4, pasture: 4, fields: 5, mountains: 4, desert: 2 },
  discs: { 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 2 },
  ports2to1: 5,
  ports3to1: 4,
  unnumbered: true,
};

/** The Pirate Islands (p. 17): 6 land hexes without a disc (3 deserts, 2 hills, 1 pasture). */
const TABLE_PIRATE: Table = {
  terrain: { sea: 19, gold: 2, hills: 5, forest: 5, pasture: 5, fields: 5, mountains: 5, desert: 3 },
  discs: { 2: 1, 3: 2, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 2, 12: 1 },
  ports2to1: 5,
  ports3to1: 3,
  unnumbered: true,
};

/** The Wonders of Catan (p. 19). */
const TABLE_WONDERS: Table = {
  terrain: { sea: 19, gold: 2, hills: 5, forest: 5, pasture: 5, fields: 5, mountains: 5, desert: 3 },
  discs: { 2: 2, 3: 3, 4: 3, 5: 3, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 1 },
  ports2to1: 5,
  ports3to1: 4,
};

/** Per-scenario region expectations. */
interface RegionSpec {
  /** Non-island regions that must exist (islands 'isle1'.. are counted separately). */
  named: string[];
  /** Number of 'isleN' regions. */
  isles: number;
  /**
   * A pair of regions allowed to touch, and only through hexes of this terrain
   * (Through the Desert: the deserts, counted as 'main', border the 'strip').
   */
  touchVia?: { a: string; b: string; terrain: string } | Array<{ a: string; b: string; terrain: string }>;
}

const key = (q: number, r: number) => `${q},${r}`;
const isLand = (h: MapHex | undefined) => h !== undefined && h.t !== 'sea' && h.t !== 'fog';

/** The 6 corners of hex (q, r) as integer keys (pointy-top, hex 4 units wide, rows 6 units apart). */
function corners(q: number, r: number): string[] {
  const cx = 2 * (2 * q + r);
  const cy = 6 * r;
  const offs: Array<[number, number]> = [
    [2, -2], // 0 upper-right
    [0, -4], // 1 top
    [-2, -2], // 2 upper-left
    [-2, 2], // 3 lower-left
    [0, 4], // 4 bottom
    [2, 2], // 5 lower-right
  ];
  return offs.map(([dx, dy]) => `${cx + dx},${cy + dy}`);
}

/** The two corners bounding side `dir` of hex (q, r). */
function sideCorners(q: number, r: number, dir: number): [string, string] {
  const c = corners(q, r);
  const map: Array<[number, number]> = [
    [5, 0], // east: lower-right, upper-right
    [0, 1], // north-east: upper-right, top
    [1, 2], // north-west: top, upper-left
    [2, 3], // west
    [3, 4], // south-west
    [4, 5], // south-east
  ];
  const [a, b] = map[dir];
  return [c[a], c[b]];
}

function check(name: string, map: ScenarioMap, table: Table, spec: RegionSpec) {
  describe(name, () => {
    const byKey = new Map(map.hexes.map((h) => [key(h.q, h.r), h]));

    it('has unique coordinates, listed row by row, left to right', () => {
      expect(byKey.size).toBe(map.hexes.length);
      for (let i = 1; i < map.hexes.length; i++) {
        const a = map.hexes[i - 1];
        const b = map.hexes[i];
        expect(a.r < b.r || (a.r === b.r && a.q < b.q)).toBe(true);
      }
      expect(Math.min(...map.hexes.map((h) => h.r))).toBe(0);
    });

    it('terrain counts match the component table', () => {
      const counts: Record<string, number> = {};
      for (const h of map.hexes) counts[h.t] = (counts[h.t] ?? 0) + 1;
      for (const [t, n] of Object.entries(table.terrain)) expect(counts[t] ?? 0, t).toBe(n);
      const total = Object.values(table.terrain).reduce((a, b) => a + b, 0);
      expect(map.hexes.length).toBe(total);
    });

    it('number discs match the component table; only producing land carries one', () => {
      const counts: Record<number, number> = {};
      for (const h of map.hexes) {
        if (h.t === 'sea' || h.t === 'desert' || h.t === 'fog') expect(h.n).toBeNull();
        else if (!table.unnumbered) expect(h.n).not.toBeNull();
        if (h.n !== null) counts[h.n] = (counts[h.n] ?? 0) + 1;
      }
      for (const v of map.villages ?? []) counts[v.n] = (counts[v.n] ?? 0) + 1;
      expect(counts).toEqual(table.discs);
    });

    it('ports: count and 2:1 / 3:1 split match the table', () => {
      if (table.itemPorts) {
        expect(map.ports).toHaveLength(0);
        expect((map.edgeItems ?? []).filter((i) => i.item === 'port').length).toBe(table.ports2to1 + table.ports3to1);
        return;
      }
      const generic = map.ports.filter((p) => p.type === 'generic').length;
      expect(generic).toBe(table.ports3to1);
      expect(map.ports.length - generic).toBe(table.ports2to1);
      // the 2:1 ports are one of each resource (5–6: and a second wool port)
      expect(map.ports.filter((p) => p.type !== 'generic').map((p) => p.type).sort()).toEqual(
        table.extraWool ? ['brick', 'grain', 'lumber', 'ore', 'wool', 'wool'] : ['brick', 'grain', 'lumber', 'ore', 'wool'],
      );
    });

    it('every port sits on a land hex side facing sea or the frame', () => {
      for (const p of map.ports) {
        expect(isLand(byKey.get(key(p.q, p.r))), `port ${p.q},${p.r}`).toBe(true);
        const [dq, dr] = MAP_DIRS[p.dir];
        const n = byKey.get(key(p.q + dq, p.r + dr));
        expect(n === undefined || n.t === 'sea', `port ${p.q},${p.r} dir ${p.dir}`).toBe(true);
      }
    });

    it('no two ports share a corner', () => {
      const used = new Map<string, string>();
      for (const p of map.ports) {
        const id = `${p.q},${p.r}/${p.dir}`;
        for (const c of sideCorners(p.q, p.r, p.dir)) {
          expect(used.get(c), `${id} shares corner with ${used.get(c)}`).toBeUndefined();
          used.set(c, id);
        }
      }
    });

    it('frame-printed sea spaces lie outside the tiles and touch the map', () => {
      const frame = map.frameSea ?? [];
      expect(new Set(frame.map(([q, r]) => key(q, r))).size).toBe(frame.length);
      for (const [q, r] of frame) {
        expect(byKey.has(key(q, r)), `frame ${q},${r}`).toBe(false);
        const nbrs = MAP_DIRS.map(([dq, dr]) => byKey.get(key(q + dq, r + dr))).filter((h) => h);
        expect(nbrs.length, `frame ${q},${r}`).toBeGreaterThan(0);
      }
    });

    it('robber starts on land; pirate starts on a sea tile or a frame-printed sea space', () => {
      if (map.robber) expect(isLand(byKey.get(key(...map.robber)))).toBe(true);
      if (!map.pirate) return;
      const [pq, pr] = map.pirate;
      const at = byKey.get(key(pq, pr));
      if (at) expect(at.t).toBe('sea');
      else expect((map.frameSea ?? []).some(([q, r]) => q === pq && r === pr)).toBe(true);
    });

    it('every land hex has a region, sea has none, and each region is connected', () => {
      const regions = new Map<string, MapHex[]>();
      for (const h of map.hexes) {
        if (h.t === 'sea' || h.t === 'fog') {
          expect(h.region).toBeUndefined();
          continue;
        }
        expect(h.region, `${h.q},${h.r}`).toBeDefined();
        regions.set(h.region!, [...(regions.get(h.region!) ?? []), h]);
      }
      for (const id of spec.named) expect(regions.has(id), id).toBe(true);
      const isleIds = [...regions.keys()].filter((id) => id.startsWith('isle'));
      expect(isleIds.length).toBe(spec.isles);
      expect(regions.size).toBe(spec.named.length + spec.isles);
      for (const [id, hs] of regions) {
        const inRegion = new Set(hs.map((h) => key(h.q, h.r)));
        const seen = new Set([key(hs[0].q, hs[0].r)]);
        const stack = [hs[0]];
        while (stack.length) {
          const h = stack.pop()!;
          for (const [dq, dr] of MAP_DIRS) {
            const k = key(h.q + dq, h.r + dr);
            if (inRegion.has(k) && !seen.has(k)) {
              seen.add(k);
              stack.push(byKey.get(k)!);
            }
          }
        }
        expect(seen.size, `region ${id} connected`).toBe(hs.length);
        // distinct regions never touch (otherwise they would be one island),
        // except the declared pair, and then only through the declared terrain
        const tvs = spec.touchVia ? [spec.touchVia].flat() : [];
        for (const h of hs)
          for (const [dq, dr] of MAP_DIRS) {
            const n = byKey.get(key(h.q + dq, h.r + dr));
            if (!isLand(n) || n!.region === id) continue;
            const allowed = tvs.some(
              (tv) => [tv.a, tv.b].includes(id) && [tv.a, tv.b].includes(n!.region!) && (h.t === tv.terrain || n!.t === tv.terrain),
            );
            expect(allowed, `${id} ${h.q},${h.r} touches ${n!.region} ${n!.q},${n!.r}`).toBe(true);
          }
      }
      // small islands are numbered isle1.. top to bottom, then left to right
      const firsts = [...regions.entries()]
        .filter(([id]) => id.startsWith('isle'))
        .map(([id, hs]) => ({ id, h: hs[0] }));
      const ordered = [...firsts].sort((a, b) => a.h.r - b.h.r || a.h.q + a.h.r / 2 - (b.h.q + b.h.r / 2));
      expect(ordered.map((o) => o.id)).toEqual(ordered.map((_, i) => `isle${i + 1}`));
    });
  });
}

const NEW_SHORES_REGIONS: RegionSpec = { named: ['main'], isles: 3 };
const FOUR_ISLANDS_REGIONS: RegionSpec = { named: [], isles: 4 };
const DESERT_REGIONS: RegionSpec = {
  named: ['main', 'strip'],
  isles: 3,
  touchVia: { a: 'main', b: 'strip', terrain: 'desert' },
};

check('Heading for New Shores, 3 players', NEW_SHORES_3P, TABLE_3P, NEW_SHORES_REGIONS);
check('Heading for New Shores, 4 players', NEW_SHORES_4P, TABLE_4P, NEW_SHORES_REGIONS);
check('The Four Islands, 3 players', FOUR_ISLANDS_3P, TABLE_FOUR_ISLANDS_3P, FOUR_ISLANDS_REGIONS);
check('The Four Islands, 4 players', FOUR_ISLANDS_4P, TABLE_FOUR_ISLANDS_4P, FOUR_ISLANDS_REGIONS);
check('Through the Desert, 3 players', THROUGH_DESERT_3P, TABLE_DESERT_3P, DESERT_REGIONS);
check('Through the Desert, 4 players', THROUGH_DESERT_4P, TABLE_DESERT_4P, DESERT_REGIONS);
check('The Fog Islands, 3 players', FOG_ISLANDS_3P, TABLE_FOG_3P, { named: ['east', 'west'], isles: 0 });
check('The Fog Islands, 4 players', FOG_ISLANDS_4P, TABLE_FOG_4P, { named: ['east', 'west'], isles: 0 });
check('The Forgotten Tribe', FORGOTTEN_TRIBE, TABLE_TRIBE, { named: ['main'], isles: 6 });
check('Cloth for Catan', CLOTH_FOR_CATAN, TABLE_CLOTH, { named: ['north', 'south'], isles: 4 });
check('The Pirate Islands', PIRATE_ISLANDS, TABLE_PIRATE, { named: ['main'], isles: 5 });

// Seafarers 5–6 (CN3084 pp. 4–12)
const ALL_DISCS_56 = { 2: 3, 3: 4, 4: 4, 5: 4, 6: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 3 };
check(
  'Heading for New Shores, 5–6 players',
  NEW_SHORES_56,
  { terrain: { sea: 16, gold: 3, hills: 7, forest: 7, pasture: 7, fields: 7, mountains: 7, desert: 2 }, discs: ALL_DISCS_56, ports2to1: 6, ports3to1: 5, extraWool: true },
  { named: ['main'], isles: 6 },
);
check(
  'The Six Islands, 5–6 players',
  SIX_ISLANDS_56,
  {
    terrain: { sea: 24, gold: 0, hills: 6, forest: 7, pasture: 7, fields: 6, mountains: 6, desert: 0 },
    discs: { 2: 2, 3: 3, 4: 4, 5: 4, 6: 4, 8: 3, 9: 4, 10: 4, 11: 2, 12: 2 },
    ports2to1: 6,
    ports3to1: 5,
    extraWool: true,
  },
  { named: [], isles: 6 },
);
check(
  'The Fog Islands, 5–6 players',
  FOG_ISLANDS_56,
  {
    terrain: { sea: 14, gold: 0, hills: 5, forest: 5, pasture: 5, fields: 5, mountains: 4, desert: 0, fog: 18 },
    discs: { 2: 1, 3: 2, 4: 3, 5: 2, 6: 3, 8: 3, 9: 3, 10: 3, 11: 2, 12: 2 },
    ports2to1: 6,
    ports3to1: 5,
    extraWool: true,
  },
  { named: ['east', 'west'], isles: 0 },
);
check(
  'Through the Desert, 5–6 players',
  THROUGH_DESERT_56,
  { terrain: { sea: 20, gold: 3, hills: 7, forest: 7, pasture: 7, fields: 7, mountains: 7, desert: 5 }, discs: ALL_DISCS_56, ports2to1: 6, ports3to1: 5, extraWool: true },
  {
    named: ['main', 'strip', 'strip2'],
    isles: 4,
    touchVia: [
      { a: 'main', b: 'strip', terrain: 'desert' },
      { a: 'main', b: 'strip2', terrain: 'desert' },
    ],
  },
);
check(
  'The Forgotten Tribe, 5–6 players',
  FORGOTTEN_TRIBE_56,
  {
    terrain: { sea: 22, gold: 3, hills: 7, forest: 7, pasture: 7, fields: 7, mountains: 6, desert: 4 },
    discs: { 2: 1, 3: 4, 4: 4, 5: 4, 6: 3, 8: 3, 9: 3, 10: 3, 11: 3, 12: 1 },
    ports2to1: 5,
    ports3to1: 3,
    unnumbered: true,
    itemPorts: true,
  },
  { named: ['main'], isles: 6 },
);
check(
  'Cloth for Catan, 5–6 players',
  CLOTH_FOR_CATAN_56,
  { terrain: { sea: 24, gold: 2, hills: 4, forest: 6, pasture: 5, fields: 6, mountains: 5, desert: 4 }, discs: ALL_DISCS_56, ports2to1: 6, ports3to1: 5, unnumbered: true, extraWool: true },
  { named: ['north', 'south'], isles: 6 },
);
check(
  'The Pirate Islands, 5–6 players',
  PIRATE_ISLANDS_56,
  {
    terrain: { sea: 26, gold: 4, hills: 4, forest: 6, pasture: 6, fields: 5, mountains: 7, desert: 5 },
    discs: { 2: 1, 3: 4, 4: 4, 5: 4, 6: 4, 8: 4, 9: 3, 10: 3, 11: 4, 12: 1 },
    ports2to1: 5,
    ports3to1: 4,
  },
  { named: ['main'], isles: 9 },
);
check(
  'The Wonders of Catan, 5–6 players',
  WONDERS_OF_CATAN_56,
  {
    terrain: { sea: 24, gold: 3, hills: 6, forest: 7, pasture: 7, fields: 6, mountains: 6, desert: 4 },
    discs: { 2: 2, 3: 3, 4: 4, 5: 4, 6: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 2 },
    ports2to1: 6,
    ports3to1: 5,
    extraWool: true,
  },
  { named: ['main'], isles: 3 },
);

describe('Seafarers 5–6 maps: scenario pieces', () => {
  it('The Forgotten Tribe: 10 VP tokens, 6 cards, 8 printed ports (5 x 2:1, one per resource)', () => {
    const items = FORGOTTEN_TRIBE_56.edgeItems ?? [];
    const n = (k: string) => items.filter((i) => i.item === k).length;
    expect([n('vp'), n('dev'), n('port')]).toEqual([10, 6, 8]);
    expect(items.filter((i) => i.port && i.port !== 'generic').map((i) => i.port).sort()).toEqual(['brick', 'grain', 'lumber', 'ore', 'wool']);
  });
  it('Cloth for Catan: 12 villages on the corners of the 6 small islands', () => {
    expect(CLOTH_FOR_CATAN_56.villages).toHaveLength(12);
  });
  it('The Pirate Islands: 6 slots, 5 for five players, a 14-hex loop with the "!" hex on it', () => {
    const pi = PIRATE_ISLANDS_56.pirateIslands!;
    expect(pi.slots).toHaveLength(6);
    expect(pi.slots3).toEqual([0, 1, 2, 3, 4]);
    expect(pi.path).toHaveLength(14);
    expect(pi.path.some(([q, r]) => q === pi.safe![0] && r === pi.safe![1])).toBe(true);
    const byKey = new Map(PIRATE_ISLANDS_56.hexes.map((h) => [key(h.q, h.r), h]));
    pi.path.forEach(([q, r], i) => {
      expect(byKey.get(key(q, r))?.t).toBe('sea');
      const [nq, nr] = pi.path[(i + 1) % pi.path.length];
      expect(MAP_DIRS.some(([dq, dr]) => q + dq === nq && r + dr === nr)).toBe(true);
    });
  });
  it('The Wonders of Catan: 5 wall, 2 bridge, 2 lighthouse and 8 "X" markers', () => {
    const w = WONDERS_OF_CATAN_56.wonderSpots!;
    expect([w.wall.length, w.bridge.length, w.lighthouse!.length, w.blocked.length]).toEqual([5, 2, 2, 8]);
  });
});
check('The Wonders of Catan', WONDERS_OF_CATAN, TABLE_WONDERS, { named: ['main'], isles: 2 });

describe('The Pirate Islands: path, slots and fortresses', () => {
  const byKey = new Map(PIRATE_ISLANDS.hexes.map((h) => [key(h.q, h.r), h]));
  const pi = PIRATE_ISLANDS.pirateIslands!;
  const cornerKey = (c: { q: number; r: number; c: number }) => {
    // corners() starts at upper-right; MapCorner starts at the top (0 top, 1 NE, ... 5 NW)
    const order = [1, 0, 5, 4, 3, 2];
    return corners(c.q, c.r)[order[c.c]];
  };
  it('6 land hexes carry no number disc', () => {
    expect(PIRATE_ISLANDS.hexes.filter((h) => h.t !== 'sea' && h.n === null)).toHaveLength(6);
  });
  it('the fleet sails a closed loop of 14 sea hexes, starting where the pirate is printed', () => {
    expect(pi.path).toHaveLength(14);
    expect(pi.path[0]).toEqual(PIRATE_ISLANDS.pirate);
    expect(new Set(pi.path.map(([q, r]) => key(q, r))).size).toBe(14);
    pi.path.forEach(([q, r], i) => {
      expect(byKey.get(key(q, r))?.t, `${q},${r}`).toBe('sea');
      const [nq, nr] = pi.path[(i + 1) % pi.path.length];
      expect(MAP_DIRS.some(([dq, dr]) => q + dq === nq && r + dr === nr), `${q},${r} -> ${nq},${nr}`).toBe(true);
    });
  });
  it('each slot: start on the main island, ship on its sea side, beachhead and fortress on pirate islands', () => {
    expect(pi.slots).toHaveLength(4);
    expect(pi.slots3).toEqual([0, 1, 3]);
    for (const slot of pi.slots) {
      expect(byKey.get(key(slot.start.q, slot.start.r))?.region).toBe('main');
      expect(sideCorners(slot.ship.q, slot.ship.r, slot.ship.dir)).toContain(cornerKey(slot.start));
      const [dq, dr] = MAP_DIRS[slot.ship.dir];
      const n = byKey.get(key(slot.ship.q + dq, slot.ship.r + dr));
      expect(n === undefined || n.t === 'sea').toBe(true);
      expect(byKey.get(key(slot.beachhead.q, slot.beachhead.r))?.region).toMatch(/^isle/);
      expect(byKey.get(key(slot.fortress.q, slot.fortress.r))?.region).toMatch(/^isle/);
    }
  });
});

describe('The Wonders of Catan: markers', () => {
  it('5 Great Wall, 2 Great Bridge and 4 "X" markers, all on the large island', () => {
    const spots = WONDERS_OF_CATAN.wonderSpots!;
    expect([spots.wall.length, spots.bridge.length, spots.blocked.length]).toEqual([5, 2, 4]);
    const byKey = new Map(WONDERS_OF_CATAN.hexes.map((h) => [key(h.q, h.r), h]));
    for (const c of [...spots.wall, ...spots.bridge, ...spots.blocked]) expect(byKey.get(key(c.q, c.r))?.region).toBe('main');
  });
});

describe('The Forgotten Tribe: gifts on the small islands', () => {
  const byKey = new Map(FORGOTTEN_TRIBE.hexes.map((h) => [key(h.q, h.r), h]));
  const items = FORGOTTEN_TRIBE.edgeItems ?? [];
  it('8 VP tokens, 4 development cards and 6 ports', () => {
    const n = (k: string) => items.filter((i) => i.item === k).length;
    expect([n('vp'), n('dev'), n('port')]).toEqual([8, 4, 6]);
  });
  it('every item lies on a small-island side facing sea or the frame, one item per side', () => {
    const sides = new Set<string>();
    for (const it of items) {
      const h = byKey.get(key(it.q, it.r));
      expect(isLand(h) && h!.region !== 'main', `${it.q},${it.r}`).toBe(true);
      const [dq, dr] = MAP_DIRS[it.dir];
      const n = byKey.get(key(it.q + dq, it.r + dr));
      expect(n === undefined || n.t === 'sea', `${it.q},${it.r}/${it.dir}`).toBe(true);
      const corners = sideCorners(it.q, it.r, it.dir).sort().join('|');
      expect(sides.has(corners)).toBe(false);
      sides.add(corners);
    }
  });
});

describe('Cloth for Catan: villages', () => {
  it('8 villages on the top and bottom corners of the 4 one-hex small islands', () => {
    const vs = CLOTH_FOR_CATAN.villages ?? [];
    expect(vs).toHaveLength(8);
    const isles = CLOTH_FOR_CATAN.hexes.filter((h) => h.region?.startsWith('isle'));
    expect(isles).toHaveLength(4);
    for (const h of isles) {
      expect(h.n).toBeNull();
      expect(vs.filter((v) => v.q === h.q && v.r === h.r).map((v) => v.corner).sort()).toEqual(['bottom', 'top']);
    }
  });
});

describe('Through the Desert: the deserts split the large island', () => {
  for (const [name, map] of [
    ['3 players', THROUGH_DESERT_3P],
    ['4 players', THROUGH_DESERT_4P],
  ] as const) {
    it(`${name}: the strip borders only the deserts, which border both sides`, () => {
      const byKey = new Map(map.hexes.map((h) => [key(h.q, h.r), h]));
      const landNbrs = (h: MapHex) =>
        MAP_DIRS.map(([dq, dr]) => byKey.get(key(h.q + dq, h.r + dr))).filter((n): n is MapHex => isLand(n));
      const deserts = map.hexes.filter((h) => h.t === 'desert');
      expect(deserts.length).toBe(3);
      for (const d of deserts) expect(d.region).toBe('main');
      for (const s of map.hexes.filter((h) => h.region === 'strip'))
        for (const n of landNbrs(s)) if (n.region !== 'strip') expect(n.t).toBe('desert');
      expect(deserts.some((d) => landNbrs(d).some((n) => n.region === 'strip'))).toBe(true);
      expect(deserts.some((d) => landNbrs(d).some((n) => n.region === 'main' && n.t !== 'desert'))).toBe(true);
    });
  }
});
