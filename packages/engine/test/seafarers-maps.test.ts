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
  touchVia?: { a: string; b: string; terrain: string };
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
      // the 2:1 ports are one of each resource
      expect(map.ports.filter((p) => p.type !== 'generic').map((p) => p.type).sort()).toEqual(
        ['brick', 'grain', 'lumber', 'ore', 'wool'],
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
      expect(isLand(byKey.get(key(...map.robber)))).toBe(true);
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
        const tv = spec.touchVia;
        for (const h of hs)
          for (const [dq, dr] of MAP_DIRS) {
            const n = byKey.get(key(h.q + dq, h.r + dr));
            if (!isLand(n) || n!.region === id) continue;
            const pair = new Set(tv ? [tv.a, tv.b] : []);
            const allowed =
              !!tv && pair.has(id) && pair.has(n!.region!) && (h.t === tv.terrain || n!.t === tv.terrain);
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
