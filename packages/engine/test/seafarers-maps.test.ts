import { describe, expect, it } from 'vitest';
import { NEW_SHORES_3P, NEW_SHORES_4P } from '../src/mods/seafarers/maps';
import { MAP_DIRS, type MapHex, type ScenarioMap } from '../src/mods/seafarers/mapTypes';

/** Component tables printed next to each map (rulebook pp. 4-5). */
interface Table {
  terrain: Record<string, number>;
  discs: Record<number, number>;
  ports2to1: number;
  ports3to1: number;
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

const key = (q: number, r: number) => `${q},${r}`;
const isLand = (h: MapHex | undefined) => h !== undefined && h.t !== 'sea';

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

function check(name: string, map: ScenarioMap, table: Table) {
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
        if (h.t === 'sea' || h.t === 'desert') expect(h.n).toBeNull();
        else expect(h.n).not.toBeNull();
        if (h.n !== null) counts[h.n] = (counts[h.n] ?? 0) + 1;
      }
      expect(counts).toEqual(table.discs);
    });

    it('ports: count and 2:1 / 3:1 split match the table', () => {
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

    it('robber starts on land; pirate starts on sea (here: the frame-printed sea hex)', () => {
      expect(isLand(byKey.get(key(...map.robber)))).toBe(true);
      const [pq, pr] = map.pirate;
      const at = byKey.get(key(pq, pr));
      if (at) {
        expect(at.t).toBe('sea');
      } else {
        // On the frame (a sea hex printed on a frame piece): must touch the map.
        const nbrs = MAP_DIRS.map(([dq, dr]) => byKey.get(key(pq + dq, pr + dr))).filter((h) => h);
        expect(nbrs.length).toBeGreaterThan(0);
        expect(nbrs.some((h) => h!.t === 'sea')).toBe(true);
      }
    });

    it('every land hex has a region, sea has none, and each region is connected', () => {
      const regions = new Map<string, MapHex[]>();
      for (const h of map.hexes) {
        if (h.t === 'sea') {
          expect(h.region).toBeUndefined();
          continue;
        }
        expect(h.region, `${h.q},${h.r}`).toBeDefined();
        regions.set(h.region!, [...(regions.get(h.region!) ?? []), h]);
      }
      expect(regions.has('main')).toBe(true);
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
        // distinct regions never touch (otherwise they would be one island)
        for (const h of hs)
          for (const [dq, dr] of MAP_DIRS) {
            const n = byKey.get(key(h.q + dq, h.r + dr));
            if (isLand(n)) expect(n!.region).toBe(id);
          }
      }
      // small islands are numbered isle1.. top to bottom, then left to right
      const firsts = [...regions.entries()]
        .filter(([id]) => id !== 'main')
        .map(([id, hs]) => ({ id, h: hs[0] }));
      const ordered = [...firsts].sort((a, b) => a.h.r - b.h.r || a.h.q + a.h.r / 2 - (b.h.q + b.h.r / 2));
      expect(ordered.map((o) => o.id)).toEqual(ordered.map((_, i) => `isle${i + 1}`));
    });
  });
}

check('Heading for New Shores, 3 players', NEW_SHORES_3P, TABLE_3P);
check('Heading for New Shores, 4 players', NEW_SHORES_4P, TABLE_4P);
