import { chooseBotAction, getPlayerView, type Action, type BotMemory } from '@hex/engine';
import type { Room, RoomManager } from './rooms';

/** How long a bot leaves its own trade offer open for humans to answer. */
const OFFER_TIMEOUT_MS = 20_000;

/**
 * Drives bot seats on the server. After every committed change it looks for
 * a bot that has something to do and schedules exactly one action per room,
 * with a short pause so humans can follow along. Bot actions go through the
 * same RoomManager.act path as human actions (same validation, persistence
 * and dedupe), using a request id derived from the room revision so a retry
 * can never apply twice.
 */
export class BotRunner {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private memory = new Map<string, BotMemory[]>();
  private offerSeen = new Map<string, { tradeId: number; at: number }>();
  private failures = new Map<string, number>();

  constructor(
    private manager: RoomManager,
    private delayMs: number,
  ) {}

  private mem(room: Room): BotMemory[] {
    let m = this.memory.get(room.id);
    if (!m) {
      m = room.seats.map(() => ({}));
      this.memory.set(room.id, m);
    }
    return m;
  }

  /** The next bot action in this room, if any (active player first). */
  private next(room: Room): { seat: number; action: Action } | null {
    const game = room.game;
    if (room.status !== 'playing' || !game) return null;
    const seats = room.seats.map((_, i) => i).filter((i) => room.seats[i].kind === 'bot');
    seats.sort((a, b) => Number(b === game.currentPlayer) - Number(a === game.currentPlayer));
    for (const seat of seats) {
      const view = getPlayerView(game, seat);
      const action = chooseBotAction(view, room.seats[seat].difficulty ?? 'medium', Math.random, this.mem(room)[seat]);
      if (action) return { seat, action };
    }
    return null;
  }

  schedule(room: Room): void {
    if (this.timers.has(room.id)) return;
    if (room.status !== 'playing' || !room.game) {
      this.memory.delete(room.id);
      this.offerSeen.delete(room.id);
      return;
    }
    const game = room.game;
    let wait = this.next(room) ? this.delayFor(room) : null;

    // A bot's own offer that humans have not answered yet: withdraw it after a while.
    const trade = game.trade;
    if (wait === null && trade && room.seats[trade.from]?.kind === 'bot') {
      const seen = this.offerSeen.get(room.id);
      const at = seen?.tradeId === trade.id ? seen.at : Date.now();
      this.offerSeen.set(room.id, { tradeId: trade.id, at });
      wait = Math.max(0, at + OFFER_TIMEOUT_MS - Date.now());
    }
    if (wait === null) return;
    this.timers.set(
      room.id,
      setTimeout(() => {
        this.timers.delete(room.id);
        void this.run(room);
      }, wait),
    );
  }

  private delayFor(room: Room): number {
    const phase = room.game?.phase;
    if (this.delayMs === 0) return 0;
    // Quicker for bookkeeping steps, slower for things worth watching.
    if (phase === 'ORDER_ROLL' || phase === 'ROBBER_DISCARD') return this.delayMs / 2;
    return this.delayMs;
  }

  private async run(room: Room): Promise<void> {
    const game = room.game;
    if (room.status !== 'playing' || !game) return;
    let step = this.next(room);
    if (!step && game.trade && room.seats[game.trade.from]?.kind === 'bot') {
      step = { seat: game.trade.from, action: { type: 'cancelTrade' } };
    }
    if (!step) return;
    const mem = this.mem(room)[step.seat];
    const res = await this.manager.act(room, step.seat, {
      requestId: `bot-${room.revision}-${step.seat}`,
      expectedRevision: room.revision,
      action: step.action,
    });
    if (res.ok) {
      this.failures.delete(room.id);
      const turn = room.game?.turn ?? 0;
      if (mem.actionsOnTurn && mem.actionsOnTurn.turn === turn) mem.actionsOnTurn.count++;
      else mem.actionsOnTurn = { turn, count: 1 };
      return; // the commit reschedules
    }
    // Fallback so a bot can never stall the game.
    console.warn(`bot ${step.seat} in ${room.id}: ${step.action.type} rejected: ${res.error}`);
    const g = room.game!;
    const fallback: Action | null =
      g.currentPlayer !== step.seat
        ? null
        : g.freeRoads > 0
          ? { type: 'finishRoadBuilding' }
          : g.trade?.from === step.seat
            ? { type: 'cancelTrade' }
            : g.phase === 'MAIN_ACTIONS'
              ? { type: 'endTurn' }
              : null;
    if (fallback) {
      const r = await this.manager.act(room, step.seat, {
        requestId: `bot-fallback-${room.revision}-${step.seat}`,
        expectedRevision: room.revision,
        action: fallback,
      });
      if (r.ok) return;
    }
    // Nothing committed: try again later, but give up after repeated failures.
    const failures = (this.failures.get(room.id) ?? 0) + 1;
    this.failures.set(room.id, failures);
    if (failures < 5) this.schedule(room);
  }

  /** True while a bot action is scheduled for this room. */
  pending(roomId: string): boolean {
    return this.timers.has(roomId);
  }

  stop(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }
}
