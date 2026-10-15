import { describe, expect, it } from 'vitest';
import { RoomManager, type CloseReason, type Room } from '../src/rooms';
import { MemoryStore } from '../src/store';

const MIN = 60_000;

function setup() {
  let now = 1_000_000;
  const store = new MemoryStore();
  const closed: Array<{ id: string; reason: CloseReason; by: number | null }> = [];
  const make = () =>
    new RoomManager(store, () => {}, () => 7, {
      botDelayMs: 0,
      absenceLimitMs: 10 * MIN,
      now: () => now,
      onClosed: (room: Room, reason, by) => closed.push({ id: room.id, reason, by }),
    });
  const m = make();
  return {
    m,
    make,
    store,
    closed,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

async function startedTwoPlayer(m: RoomManager) {
  const c = await m.create('Roy', { humans: 2, bots: 0 });
  if (!c.ok) throw new Error(c.error);
  await m.join(c.roomId, 'Noa');
  const room = (await m.get(c.roomId))!;
  await m.setReady(room, 1, true);
  await m.start(room, 0);
  return room;
}

describe('leaving a game', () => {
  it('closes the game for everyone and deletes it', async () => {
    const { m, store, closed } = setup();
    const room = await startedTwoPlayer(m);
    expect(await store.load(room.id)).not.toBeNull();
    expect(await m.leave(room, 1)).toEqual({ ok: true });
    expect(closed).toEqual([{ id: room.id, reason: 'left', by: 1 }]);
    expect(await store.load(room.id)).toBeNull();
    expect(await m.get(room.id)).toBeNull();
    // Nothing can act on it any more, and it is never saved again.
    await m.act(room, 0, { requestId: 'x', expectedRevision: room.revision, action: { type: 'rollForOrder' } });
    expect(await store.load(room.id)).toBeNull();
  });

  it('can be left from the lobby too', async () => {
    const { m, store } = setup();
    const c = await m.create('Roy', { humans: 2, bots: 0 });
    if (!c.ok) throw new Error(c.error);
    const room = (await m.get(c.roomId))!;
    await m.leave(room, 0);
    expect(await store.load(room.id)).toBeNull();
  });

  it('stops the bots of a closed solo game', async () => {
    const { m, store } = setup();
    const c = await m.create('Solo', { humans: 1, bots: 3 });
    if (!c.ok) throw new Error(c.error);
    const room = (await m.get(c.roomId))!;
    await m.start(room, 0);
    await m.leave(room, 0);
    await new Promise((r) => setTimeout(r, 30));
    expect(m.bots.pending(room.id)).toBe(false);
    expect(await store.load(room.id)).toBeNull();
  });
});

describe('10-minute absence', () => {
  it('keeps the game while players are connected or briefly away', async () => {
    const { m, advance } = setup();
    const room = await startedTwoPlayer(m);
    advance(9 * MIN);
    expect(m.staleSeat(room, () => false)).toBe(-1);
    advance(5 * MIN);
    // Both connected: never stale.
    expect(m.staleSeat(room, () => true)).toBe(-1);
  });

  it('flags a player who has been away more than 10 minutes', async () => {
    const { m, advance } = setup();
    const room = await startedTwoPlayer(m);
    m.touch(room, 0);
    advance(11 * MIN);
    m.touch(room, 0); // player 0 still here
    expect(m.staleSeat(room, (s) => s === 0)).toBe(1);
  });

  it('deletes a stale game when it is loaded after a restart', async () => {
    const { m, make, store, closed, advance } = setup();
    const room = await startedTwoPlayer(m);
    await m.persist(room);
    advance(11 * MIN);
    const restarted = make();
    expect(await restarted.get(room.id)).toBeNull();
    expect(await store.load(room.id)).toBeNull();
    expect(closed.at(-1)).toMatchObject({ id: room.id, reason: 'inactive' });
  });

  it('keeps a recently played game after a restart', async () => {
    const { m, make, advance } = setup();
    const room = await startedTwoPlayer(m);
    await m.persist(room);
    advance(3 * MIN);
    expect(await make().get(room.id)).not.toBeNull();
  });
});
