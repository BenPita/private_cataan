import { describe, expect, it } from 'vitest';
import { legalSetupRoads, legalSetupSettlements, orderRollGroup } from '@hex/engine';
import { RoomManager, validateConfig, type Room } from '../src/rooms';
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
    expect(await m.create('A', { humans: 4, bots: 3 } as never)).toMatchObject({ ok: false });
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
    // Decide turn order deterministically: roll until the ORDER_ROLL phase ends.
    let n = 0;
    while (ctx.room.game!.phase === 'ORDER_ROLL') {
      const group = orderRollGroup(ctx.room.game!)!;
      const seat = group.find((p) => !ctx.room.game!.orderRoll!.rolls[p])!;
      await ctx.m.act(ctx.room, seat, { requestId: `order-${n++}`, expectedRevision: ctx.room.revision, action: { type: 'rollForOrder' } });
    }
    return ctx;
  }

  it('applies a valid action, bumps the revision and persists', async () => {
    const { m, room, store } = await started();
    const first = room.game!.currentPlayer;
    const other = 1 - first;
    const v = legalSetupSettlements(room.game!)[0];
    const rev = room.revision;
    const res = await m.act(room, first, { requestId: 'r1', expectedRevision: rev, action: { type: 'placeSetupSettlement', vertex: v } });
    expect(res).toEqual({ ok: true });
    expect(room.revision).toBe(rev + 1);
    await m.flush(room.id);
    const saved = await store.load(room.id);
    expect(saved!.game!.buildings[v]).toEqual({ owner: first, type: 'settlement' });
  });

  it('does not apply duplicate requests twice', async () => {
    const { m, room } = await started();
    const first = room.game!.currentPlayer;
    const other = 1 - first;
    const v = legalSetupSettlements(room.game!)[0];
    const payload = { requestId: 'dup', expectedRevision: room.revision, action: { type: 'placeSetupSettlement', vertex: v } };
    await m.act(room, first, payload);
    const rev = room.revision;
    expect(await m.act(room, first, payload)).toEqual({ ok: true, duplicate: true });
    expect(room.revision).toBe(rev);
  });

  it('rejects stale revisions, out-of-turn actions and garbage', async () => {
    const { m, room } = await started();
    const first = room.game!.currentPlayer;
    const other = 1 - first;
    const v = legalSetupSettlements(room.game!)[0];
    expect(await m.act(room, first, { requestId: 'a', expectedRevision: room.revision - 1, action: { type: 'placeSetupSettlement', vertex: v } }))
      .toMatchObject({ ok: false, error: /out of date/ });
    expect(await m.act(room, other, { requestId: 'b', expectedRevision: room.revision, action: { type: 'placeSetupSettlement', vertex: v } }))
      .toMatchObject({ ok: false, error: /not your turn/ });
    expect(await m.act(room, first, { requestId: 'c', expectedRevision: room.revision, action: 'hack' }))
      .toMatchObject({ ok: false });
    expect(await m.act(room, first, { expectedRevision: room.revision, action: { type: 'rollDice' } }))
      .toMatchObject({ ok: false, error: /request id/ });
  });

  it('restores the full game from storage after a restart', async () => {
    const { m, room, store } = await started();
    const first = room.game!.currentPlayer;
    const other = 1 - first;
    const v = legalSetupSettlements(room.game!)[0];
    await m.act(room, first, { requestId: 'x', expectedRevision: room.revision, action: { type: 'placeSetupSettlement', vertex: v } });
    await m.flush(room.id);
    const restarted = new RoomManager(store);
    const restored = (await restarted.get(room.id))!;
    expect(restored.game).toEqual(room.game);
    const edge = legalSetupRoads(restored.game!, v)[0];
    expect(await restarted.act(restored, first, { requestId: 'y', expectedRevision: restored.revision, action: { type: 'placeSetupRoad', edge } }))
      .toEqual({ ok: true });
  });

  it('snapshots hide the opponent hand, dev cards and RNG seed', async () => {
    const { m, room } = await started();
    const first = room.game!.currentPlayer;
    const other = 1 - first;
    void other;
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

describe('migration', () => {
  it('upgrades games saved before the opening roll existed', async () => {
    const store = new MemoryStore();
    const ctx = await twoPlayerRoom(store);
    await ctx.m.setReady(ctx.room, 1, true);
    await ctx.m.start(ctx.room, 0);
    const old = JSON.parse(JSON.stringify(ctx.room));
    delete old.game.turnOrder;
    delete old.game.orderRoll;
    await store.save(old);
    const restored = (await new RoomManager(store).get(ctx.room.id))!;
    expect(restored.game!.turnOrder).toEqual([0, 1]);
  });
});

describe('secret victory points', () => {
  it('other players never see a hidden victory point card or its point, until the game ends', async () => {
    const { m, room } = await twoPlayerRoom();
    await m.setReady(room, 1, true);
    await m.start(room, 0);
    const g = room.game!;
    g.phase = 'MAIN_ACTIONS';
    g.buildings = { v20: { owner: 1, type: 'settlement' } };
    g.players[1].settlementsBuilt = 1;
    g.players[1].devCards = [{ type: 'victoryPoint', boughtTurn: 0 }, { type: 'knight', boughtTurn: 0 }];

    const connected = () => true;
    const owner = m.snapshot(room, 1, connected);
    const other = m.snapshot(room, 0, connected);
    // The owner sees their real score and their cards.
    expect(owner.game!.players[1].victoryPoints).toBe(2);
    expect(owner.game!.players[1].devCards).toHaveLength(2);
    // Everyone else sees only the public score and how many cards they hold — nothing about which cards.
    expect(other.game!.players[1].victoryPoints).toBe(1);
    expect(other.game!.players[1].devCards).toBeNull();
    expect(other.game!.players[1].devCardCount).toBe(2);
    expect(JSON.stringify(other)).not.toMatch(/victoryPoint"|knight"/);

    // When the game is over the cards are revealed to everyone.
    g.phase = 'GAME_OVER';
    expect(m.snapshot(room, 0, connected).game!.players[1].victoryPoints).toBe(2);
  });
});

describe('mods in rooms', () => {
  it('rooms default to the base mod and the game records it', async () => {
    const { m, room } = await twoPlayerRoom();
    expect(room.config.mod).toBe('base');
    await m.setReady(room, 1, true);
    await m.start(room, 0);
    expect(room.game!.config.mod).toBe('base');
    expect(room.game!.config.modVersion).toBe(1);
  });

  it('participant limits include the 5–6 player rules', () => {
    expect(validateConfig({ humans: 6, bots: 0 }).ok).toBe(true);
    expect(validateConfig({ humans: 1, bots: 5 }).ok).toBe(true);
    expect(validateConfig({ humans: 7, bots: 0 })).toMatchObject({ ok: false, error: 'Humans must be 1-6' });
    expect(validateConfig({ humans: 1, bots: 6 })).toMatchObject({ ok: false, error: 'Bots must be 0-5' });
    expect(validateConfig({ humans: 4, bots: 3 })).toMatchObject({ ok: false, error: 'A game needs 2-6 participants' });
    expect(validateConfig({ humans: 1, bots: 0 })).toMatchObject({ ok: false, error: 'A game needs 2-6 participants' });
  });

  it('rejects an unknown mod', async () => {
    const m = new RoomManager(new MemoryStore());
    expect(await m.create('Roy', { humans: 2, bots: 0, mod: 'nope' as never })).toMatchObject({ ok: false, error: /mod/i });
  });

  it('an old saved game without a mod loads as base', async () => {
    const store = new MemoryStore();
    const { m, room } = await twoPlayerRoom(store);
    await m.setReady(room, 1, true);
    await m.start(room, 0);
    await m.flush(room.id);
    const saved = (await store.load(room.id))!;
    delete (saved.config as { mod?: string }).mod;
    delete saved.game!.config.mod;
    delete saved.game!.config.modVersion;
    delete saved.game!.board.layout;
    await store.save(saved);
    const fresh = new RoomManager(store);
    const loaded = (await fresh.get(room.id))!;
    expect(loaded.config.mod).toBe('base');
    expect(loaded.game!.config).toMatchObject({ mod: 'base', modVersion: 1 });
    expect(loaded.game!.board.layout).toBe('classic');
  });

  it('an old saved game without the paired-players field loads with none', async () => {
    const store = new MemoryStore();
    const { m, room } = await twoPlayerRoom(store);
    await m.setReady(room, 1, true);
    await m.start(room, 0);
    await m.flush(room.id);
    const saved = (await store.load(room.id))!;
    delete (saved.game as { paired?: unknown }).paired;
    await store.save(saved);
    const loaded = (await new RoomManager(store).get(room.id))!;
    expect(loaded.game!.paired).toBeNull();
  });
});
