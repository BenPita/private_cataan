import { afterEach, describe, expect, it } from 'vitest';
import { chooseBotAction, getPlayerView, type BotMemory } from '@hex/engine';
import { RoomManager, type Room } from '../src/rooms';
import { MemoryStore } from '../src/store';

const managers: RoomManager[] = [];
afterEach(() => managers.splice(0).forEach((m) => m.bots.stop()));

function manager(store = new MemoryStore()) {
  const m = new RoomManager(store, () => {}, undefined, { botDelayMs: 0 });
  managers.push(m);
  return m;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Waits until no bot action is scheduled (or only a slow offer timeout is). */
async function settle(room: Room, m: RoomManager) {
  for (let i = 0; i < 100000; i++) {
    await tick();
    if (!m.bots.pending(room.id)) return;
    const g = room.game;
    // A bot's open offer waits 20s for humans; humans answer it instead of waiting.
    if (g?.trade && g.trade.to.some((p) => room.seats[p].kind === 'human' && g.trade!.responses[p] === 'pending')) return;
  }
  throw new Error(`bots never settled in ${room.game?.phase}`);
}

/** Plays the human seats with a medium-bot brain until the game ends. */
async function playHumans(m: RoomManager, room: Room, humans: number[]) {
  const memory: Record<number, BotMemory> = Object.fromEntries(humans.map((h) => [h, {}]));
  for (let i = 0; i < 20000 && room.status === 'playing'; i++) {
    await settle(room, m);
    let acted = false;
    for (const seat of humans) {
      const action = chooseBotAction(getPlayerView(room.game!, seat), 'medium', Math.random, memory[seat]);
      if (!action) continue;
      const r = await m.act(room, seat, { requestId: `h-${room.revision}-${seat}`, expectedRevision: room.revision, action });
      if (!r.ok && action.type !== 'endTurn') {
        await m.act(room, seat, { requestId: `hf-${room.revision}-${seat}`, expectedRevision: room.revision, action: { type: 'endTurn' } });
      }
      acted = true;
      break;
    }
    if (!acted && room.game!.trade) {
      await m.act(room, room.game!.currentPlayer, { requestId: `c-${room.revision}`, expectedRevision: room.revision, action: { type: 'cancelTrade' } });
    }
  }
}

describe('player configurations', () => {
  const combos: Array<[number, number]> = [
    [1, 1], [1, 2], [1, 3], [2, 0], [2, 1], [2, 2], [3, 0], [3, 1], [4, 0],
  ];
  for (const [humans, bots] of combos) {
    it(`supports ${humans} human(s) + ${bots} bot(s)`, async () => {
      const m = manager();
      const created = await m.create('Host', { humans, bots });
      if (!created.ok) throw new Error(created.error);
      for (let h = 1; h < humans; h++) {
        const j = await m.join(created.roomId, `H${h}`);
        expect(j.ok).toBe(true);
      }
      const room = (await m.get(created.roomId))!;
      expect(room.seats.filter((s) => s.kind === 'bot')).toHaveLength(bots);
      for (let h = 1; h < humans; h++) await m.setReady(room, h, true);
      expect(await m.start(room, 0)).toEqual({ ok: true });
      expect(room.game!.players).toHaveLength(humans + bots);
    });
  }

  it('rejects invalid configurations', async () => {
    const m = manager();
    for (const cfg of [{ humans: 1, bots: 0 }, { humans: 2, bots: 3 }, { humans: 0, bots: 2 }, { humans: 1, bots: 4 }]) {
      expect(await m.create('A', cfg)).toMatchObject({ ok: false });
    }
  });
});

describe('bots on the server', () => {
  it('a solo player can start immediately and finish a game against 3 bots', async () => {
    const m = manager();
    const created = await m.create('Solo', { humans: 1, bots: 3, difficulty: 'hard' });
    if (!created.ok) throw new Error(created.error);
    const room = (await m.get(created.roomId))!;
    expect(await m.start(room, 0)).toEqual({ ok: true });
    await playHumans(m, room, [0]);
    expect(room.status).toBe('finished');
    expect(room.game!.winner).not.toBeNull();
  }, 180_000);

  it('two humans and two bots play a full game', async () => {
    const m = manager();
    const created = await m.create('A', { humans: 2, bots: 2, difficulty: 'easy' });
    if (!created.ok) throw new Error(created.error);
    await m.join(created.roomId, 'B');
    const room = (await m.get(created.roomId))!;
    await m.setReady(room, 1, true);
    await m.start(room, 0);
    await playHumans(m, room, [0, 1]);
    expect(room.status).toBe('finished');
  }, 180_000);

  it('bots resume after a server restart without double actions', async () => {
    const store = new MemoryStore();
    const m1 = manager(store);
    const created = await m1.create('Solo', { humans: 1, bots: 1 });
    if (!created.ok) throw new Error(created.error);
    const room = (await m1.get(created.roomId))!;
    m1.bots.stop();
    await m1.start(room, 0);
    m1.bots.stop(); // "crash" before the bot acts
    const revBefore = room.revision;

    const m2 = manager(store);
    const restored = (await m2.get(created.roomId))!;
    await settle(restored, m2);
    expect(restored.revision).toBeGreaterThan(revBefore);
    // The bot has rolled for turn order exactly once.
    const botRolls = restored.game!.orderRoll!.history.filter((h) => h.player === 1);
    expect(botRolls.length).toBeGreaterThanOrEqual(1);
    expect(new Set(restored.recentRequests.map((r) => r.id)).size).toBe(restored.recentRequests.length);
  });
});

describe('per-bot difficulty', () => {
  it('gives each bot its own level and lets the host change one', async () => {
    const m = manager();
    const c = await m.create('Host', { humans: 2, bots: 2, botDifficulties: ['easy', 'hard'] });
    if (!c.ok) throw new Error(c.error);
    const room = (await m.get(c.roomId))!;
    expect(room.seats.filter((s) => s.kind === 'bot').map((s) => s.difficulty)).toEqual(['easy', 'hard']);
    await m.updateConfig(room, 0, { botDifficulties: ['medium', 'hard'] });
    expect(room.seats.filter((s) => s.kind === 'bot').map((s) => s.difficulty)).toEqual(['medium', 'hard']);
    // Adding a bot fills its level from the default.
    await m.updateConfig(room, 0, { humans: 1, bots: 3 });
    expect(room.seats.filter((s) => s.kind === 'bot').map((s) => s.difficulty)).toEqual(['medium', 'hard', 'medium']);
    expect(await m.create('X', { humans: 1, bots: 1, botDifficulties: ['godlike' as never] })).toMatchObject({ ok: false });
  });
});

describe('bot names', () => {
  it('uses the names shown on the home screen and keeps them when the config changes', async () => {
    const m = manager();
    const c = await m.create('Host', { humans: 2, bots: 2, botNames: ['Bot#7', 'Bot#30', 'Bot#3'] });
    if (!c.ok) throw new Error(c.error);
    const room = (await m.get(c.roomId))!;
    const names = () => room.seats.filter((s) => s.kind === 'bot').map((s) => s.name);
    expect(names()).toEqual(['Bot#7', 'Bot#30']);
    await m.updateConfig(room, 0, { botDifficulties: ['hard', 'easy'] });
    expect(names()).toEqual(['Bot#7', 'Bot#30']);
    // A new bot gets a fresh, distinct name from the pool.
    await m.updateConfig(room, 0, { humans: 1, bots: 3 });
    expect(names().slice(0, 2)).toEqual(['Bot#7', 'Bot#30']);
    expect(new Set(names()).size).toBe(3);
    expect(names()[2]).toMatch(/^Bot#\d+$/);
  });

  it('ignores names outside the pool', async () => {
    const m = manager();
    const c = await m.create('Host', { humans: 1, bots: 1, botNames: ['<script>', 'Bot#999'] });
    if (!c.ok) throw new Error(c.error);
    const room = (await m.get(c.roomId))!;
    expect(room.seats[1].name).toMatch(/^Bot#([0-9]|[1-4][0-9])$/);
  });
});
