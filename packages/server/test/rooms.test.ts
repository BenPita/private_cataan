import { describe, expect, it } from 'vitest';
import { legalSetupRoads, legalSetupSettlements } from '@hex/engine';
import { RoomManager, type Room } from '../src/rooms';
import { MemoryStore } from '../src/store';

async function twoPlayerRoom(store = new MemoryStore()) {
  const broadcasts: Room[] = [];
  const m = new RoomManager(store, (r) => broadcasts.push(r), () => 12345);
  const created = await m.create('Roy', { humans: 2, bots: 0 });
  if (!created.ok) throw new Error(created.error);
  const joined = await m.join(created.roomId, 'Noa');
  if (!joined.ok) throw new Error(joined.error);
  const room = (await m.get(created.roomId))!;
  return { m, room, store, broadcasts, hostToken: created.token, guestToken: joined.token };
}

describe('room lifecycle', () => {
  it('creates, joins, readies and starts', async () => {
    const { m, room } = await twoPlayerRoom();
    expect(room.seats.map((s) => s.name)).toEqual(['Roy', 'Noa']);
    expect(await m.start(room, 0)).toMatchObject({ ok: false });
    expect(await m.start(room, 1)).toMatchObject({ ok: false, error: /host/ });
    await m.setReady(room, 1, true);
    expect(await m.start(room, 0)).toEqual({ ok: true });
    expect(room.status).toBe('playing');
    expect(room.game!.players.map((p) => p.name)).toEqual(['Roy', 'Noa']);
  });

  it('rejects a third person and joins after start', async () => {
    const { m, room } = await twoPlayerRoom();
    expect(await m.join(room.id, 'Eve')).toMatchObject({ ok: false, error: /full/ });
    await m.setReady(room, 1, true);
    await m.start(room, 0);
    expect(await m.join(room.id, 'Eve')).toMatchObject({ ok: false });
  });

  it('identifies seats by token only', async () => {
    const { m, room, hostToken, guestToken } = await twoPlayerRoom();
    expect(m.seatForToken(room, hostToken)).toBe(0);
    expect(m.seatForToken(room, guestToken)).toBe(1);
    expect(m.seatForToken(room, 'not-a-real-token-at-all')).toBe(-1);
    expect(m.seatForToken(room, undefined)).toBe(-1);
    expect(JSON.stringify(room)).not.toContain(hostToken);
  });

  it('validates configurations', async () => {
    const m = new RoomManager(new MemoryStore());
    expect(await m.create('A', { humans: 1, bots: 0 })).toMatchObject({ ok: false });
    expect(await m.create('A', { humans: 4, bots: 1 } as never)).toMatchObject({ ok: false });
    expect(await m.create('', { humans: 2, bots: 0 })).toMatchObject({ ok: false });
    expect(await m.create('A', { humans: 3, bots: 0 })).toMatchObject({ ok: true });
    expect(await m.create('A', { humans: 4, bots: 0 })).toMatchObject({ ok: true });
  });
});

describe('authoritative actions', () => {
  async function started() {
    const ctx = await twoPlayerRoom();
    await ctx.m.setReady(ctx.room, 1, true);
    await ctx.m.start(ctx.room, 0);
    return ctx;
  }

  it('applies a valid action, bumps the revision and persists', async () => {
    const { m, room, store } = await started();
    const v = legalSetupSettlements(room.game!)[0];
    const rev = room.revision;
    const res = await m.act(room, 0, { requestId: 'r1', expectedRevision: rev, action: { type: 'placeSetupSettlement', vertex: v } });
    expect(res).toEqual({ ok: true });
    expect(room.revision).toBe(rev + 1);
    const saved = await store.load(room.id);
    expect(saved!.game!.buildings[v]).toEqual({ owner: 0, type: 'settlement' });
  });

  it('does not apply duplicate requests twice', async () => {
    const { m, room } = await started();
    const v = legalSetupSettlements(room.game!)[0];
    const payload = { requestId: 'dup', expectedRevision: room.revision, action: { type: 'placeSetupSettlement', vertex: v } };
    await m.act(room, 0, payload);
    const rev = room.revision;
    expect(await m.act(room, 0, payload)).toEqual({ ok: true, duplicate: true });
    expect(room.revision).toBe(rev);
  });

  it('rejects stale revisions, out-of-turn actions and garbage', async () => {
    const { m, room } = await started();
    const v = legalSetupSettlements(room.game!)[0];
    expect(await m.act(room, 0, { requestId: 'a', expectedRevision: room.revision - 1, action: { type: 'placeSetupSettlement', vertex: v } }))
      .toMatchObject({ ok: false, error: /out of date/ });
    expect(await m.act(room, 1, { requestId: 'b', expectedRevision: room.revision, action: { type: 'placeSetupSettlement', vertex: v } }))
      .toMatchObject({ ok: false, error: /not your turn/ });
    expect(await m.act(room, 0, { requestId: 'c', expectedRevision: room.revision, action: 'hack' }))
      .toMatchObject({ ok: false });
    expect(await m.act(room, 0, { expectedRevision: room.revision, action: { type: 'rollDice' } }))
      .toMatchObject({ ok: false, error: /request id/ });
  });

  it('restores the full game from storage after a restart', async () => {
    const { m, room, store } = await started();
    const v = legalSetupSettlements(room.game!)[0];
    await m.act(room, 0, { requestId: 'x', expectedRevision: room.revision, action: { type: 'placeSetupSettlement', vertex: v } });
    const restarted = new RoomManager(store);
    const restored = (await restarted.get(room.id))!;
    expect(restored.game).toEqual(room.game);
    const edge = legalSetupRoads(restored.game!, v)[0];
    expect(await restarted.act(restored, 0, { requestId: 'y', expectedRevision: restored.revision, action: { type: 'placeSetupRoad', edge } }))
      .toEqual({ ok: true });
  });

  it('snapshots hide the opponent hand, dev cards and RNG seed', async () => {
    const { m, room } = await started();
    room.game!.players[1].resources.ore = 3;
    room.game!.players[1].devCards.push({ type: 'victoryPoint', boughtTurn: 0 });
    const snap = m.snapshot(room, 0, () => true);
    expect(snap.game!.players[1].resources).toBeNull();
    expect(snap.game!.players[1].devCards).toBeNull();
    expect(snap.game!.players[1].resourceCount).toBe(3);
    expect(snap.game!.players[1].victoryPoints).toBe(0);
    const json = JSON.stringify(snap);
    expect(json).not.toContain('tokenHash');
    expect(json).not.toContain('devDeck"');
    expect(json).not.toContain('"rng"');
  });
});
