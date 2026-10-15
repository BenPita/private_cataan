import { describe, expect, it } from 'vitest';
import { newDb } from 'pg-mem';
import type pg from 'pg';
import { RoomManager } from '../src/rooms';
import { PostgresStore } from '../src/store';

describe('PostgresStore', () => {
  it('creates the table, saves, overwrites and reloads rooms', async () => {
    const { Pool } = newDb().adapters.createPg();
    const store = new PostgresStore(new Pool() as unknown as pg.Pool);
    const m = new RoomManager(store);
    const created = await m.create('Roy', { humans: 2, bots: 0 });
    if (!created.ok) throw new Error(created.error);
    await m.join(created.roomId, 'Noa');
    const reloaded = await new RoomManager(store).get(created.roomId);
    expect(reloaded!.seats.map((s) => s.name)).toEqual(['Roy', 'Noa']);
    expect(await store.load('missing')).toBeNull();
  });
});
