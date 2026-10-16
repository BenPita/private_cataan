import { createHash, randomBytes, randomInt } from 'node:crypto';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  applyAction,
  createGame,
  getPlayerView,
  type Action,
  type BotDifficulty,
  type GameState,
  type PlayerView,
} from '@hex/engine';
import { BotRunner } from './bots';
import type { RoomStore } from './store';

export interface RoomConfig {
  humans: number;
  bots: number;
  /** Default level for bots without their own setting. */
  difficulty: BotDifficulty;
  /** Level of each bot, in seat order (length = bots). */
  botDifficulties: BotDifficulty[];
  victoryTarget: number;
  boardType: 'random' | 'beginner';
  /** House rule: starting resources for both settlements. */
  startResBoth?: boolean;
}

export interface Seat {
  kind: 'human' | 'bot';
  name: string | null;
  /** sha256 of the seat's secret player token; null while unclaimed. */
  tokenHash: string | null;
  ready: boolean;
  difficulty?: BotDifficulty;
  /** Last time this human was seen (connected or acting), ms since epoch. */
  lastSeen?: number;
}

export type CloseReason = 'left' | 'inactive';

export interface Room {
  id: string;
  createdAt: number;
  config: RoomConfig;
  seats: Seat[];
  status: 'lobby' | 'playing' | 'finished';
  game: GameState | null;
  revision: number;
  /** Recently processed request ids, so a retried request is not applied twice. */
  recentRequests: Array<{ id: string; seat: number; ok: boolean; error?: string }>;
  /** Set (in memory only) once the room is closed, so nothing saves it again. */
  closed?: boolean;
}

export interface PublicSeat {
  kind: Seat['kind'];
  name: string | null;
  claimed: boolean;
  ready: boolean;
  connected: boolean;
  difficulty?: BotDifficulty;
}

export interface RoomSnapshot {
  id: string;
  status: Room['status'];
  config: RoomConfig;
  seats: PublicSeat[];
  revision: number;
  you: number;
  game: PlayerView | null;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const DEFAULT_CONFIG: RoomConfig = {
  humans: 2,
  bots: 2,
  difficulty: 'medium',
  botDifficulties: [],
  victoryTarget: 10,
  boardType: 'random',
};

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const ROOM_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newRoomId = () => Array.from({ length: 10 }, () => ROOM_ID_ALPHABET[randomInt(ROOM_ID_ALPHABET.length)]).join('');

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
  return name.length ? name : null;
}

export function validateConfig(raw: Partial<RoomConfig> | undefined): Result<{ config: RoomConfig }> {
  const c = { ...DEFAULT_CONFIG, ...(raw ?? {}) };
  if (!Number.isInteger(c.humans) || c.humans < 1 || c.humans > MAX_PLAYERS) return { ok: false, error: 'Humans must be 1-4' };
  if (!Number.isInteger(c.bots) || c.bots < 0 || c.bots > 3) return { ok: false, error: 'Bots must be 0-3' };
  const total = c.humans + c.bots;
  if (total < MIN_PLAYERS || total > MAX_PLAYERS) return { ok: false, error: 'A game needs 2-4 participants' };
  const LEVELS = ['easy', 'medium', 'hard'];
  if (!LEVELS.includes(c.difficulty)) return { ok: false, error: 'Invalid difficulty' };
  const given = Array.isArray(c.botDifficulties) ? c.botDifficulties : [];
  if (given.some((d) => !LEVELS.includes(d))) return { ok: false, error: 'Invalid difficulty' };
  const botDifficulties = Array.from({ length: c.bots }, (_, i) => given[i] ?? c.difficulty);
  if (![10, 12].includes(c.victoryTarget)) return { ok: false, error: 'Target must be 10 or 12' };
  if (!['random', 'beginner'].includes(c.boardType)) return { ok: false, error: 'Invalid board type' };
  if (c.startResBoth !== undefined && typeof c.startResBoth !== 'boolean') return { ok: false, error: 'Invalid settings' };
  return {
    ok: true,
    config: {
      humans: c.humans,
      bots: c.bots,
      difficulty: c.difficulty,
      botDifficulties,
      victoryTarget: c.victoryTarget,
      boardType: c.boardType,
      startResBoth: c.startResBoth === true,
    },
  };
}

function buildSeats(config: RoomConfig, existing: Seat[] = []): Seat[] {
  const humans: Seat[] = existing.filter((s) => s.kind === 'human').slice(0, config.humans);
  while (humans.length < config.humans) humans.push({ kind: 'human', name: null, tokenHash: null, ready: false });
  const bots: Seat[] = Array.from({ length: config.bots }, (_, i) => ({
    kind: 'bot',
    name: `Bot ${i + 1}`,
    tokenHash: null,
    ready: true,
    difficulty: config.botDifficulties?.[i] ?? config.difficulty,
  }));
  return [...humans, ...bots];
}

/** Upgrades rooms saved by older versions so running games survive a deploy. */
function migrate(room: Room): Room {
  const g = room.game as (GameState & { turnOrder?: number[]; orderRoll?: GameState['orderRoll'] }) | null;
  if (g && !g.turnOrder) {
    g.turnOrder = g.players.map((_, i) => i);
    g.orderRoll = null;
  }
  return room;
}

/**
 * Owns all rooms: lobby flow, seat ownership, and authoritative action
 * processing. Socket-agnostic so it can be tested directly.
 */
export class RoomManager {
  private rooms = new Map<string, Room>();
  private saving = new Map<string, Promise<void>>();

  readonly bots: BotRunner;
  private absenceLimitMs: number;
  private now: () => number;
  private onClosed: (room: Room, reason: CloseReason, by: number | null) => void;

  constructor(
    private store: RoomStore,
    private onChange: (room: Room) => void = () => {},
    private seedSource: () => number = () => randomInt(1, 2 ** 31 - 1),
    options: {
      botDelayMs?: number;
      /** A game is deleted when a player has been away this long (default 10 minutes). */
      absenceLimitMs?: number;
      now?: () => number;
      onClosed?: (room: Room, reason: CloseReason, by: number | null) => void;
    } = {},
  ) {
    this.bots = new BotRunner(this, options.botDelayMs ?? 900);
    this.absenceLimitMs = options.absenceLimitMs ?? 10 * 60_000;
    this.now = options.now ?? Date.now;
    this.onClosed = options.onClosed ?? (() => {});
  }

  /** Rooms currently held in memory. */
  loaded(): Room[] {
    return [...this.rooms.values()];
  }

  /** Records that a human seat is present right now. */
  touch(room: Room, seat: number): void {
    const s = room.seats[seat];
    if (s && s.kind === 'human') s.lastSeen = this.now();
  }

  /** The first claimed human seat that has been away longer than the limit, or -1. */
  staleSeat(room: Room, connected: (seat: number) => boolean): number {
    const limit = this.now() - this.absenceLimitMs;
    return room.seats.findIndex(
      (s, i) => s.kind === 'human' && !!s.tokenHash && !connected(i) && (s.lastSeen ?? room.createdAt) < limit,
    );
  }

  /** Saves presence info without broadcasting. */
  async persist(room: Room): Promise<void> {
    if (room.closed) return;
    const previous = this.saving.get(room.id) ?? Promise.resolve();
    const snapshot = structuredClone(room);
    const next = previous.then(() => this.store.save(snapshot)).catch((err) => console.error('save failed', err));
    this.saving.set(room.id, next);
    await next;
  }

  /** Ends the game for everyone and deletes it completely. */
  async close(room: Room, reason: CloseReason, by: number | null): Promise<void> {
    if (room.closed) return;
    room.closed = true;
    this.bots.forget(room.id);
    this.onClosed(room, reason, by);
    this.rooms.delete(room.id);
    await (this.saving.get(room.id) ?? Promise.resolve());
    this.saving.delete(room.id);
    await this.store.delete(room.id);
  }

  async leave(room: Room, seat: number): Promise<Result> {
    await this.close(room, 'left', seat);
    return { ok: true };
  }

  async get(id: unknown): Promise<Room | null> {
    if (typeof id !== 'string' || !/^[A-Za-z0-9]{4,20}$/.test(id)) return null;
    const cached = this.rooms.get(id);
    if (cached) return cached;
    const loaded = await this.store.load(id);
    if (!loaded) return null;
    // Nobody is connected to a freshly loaded room; drop it if someone has been away too long.
    const stale = this.staleSeat(loaded, () => false);
    if (stale >= 0) {
      await this.close(loaded, 'inactive', stale);
      return null;
    }
    this.rooms.set(id, migrate(loaded));
    // Resume bot turns after a server restart.
    this.bots.schedule(loaded);
    return loaded;
  }

  /** Persists then broadcasts. Saves for one room are serialized. */
  private async commit(room: Room): Promise<void> {
    if (room.closed) return;
    const previous = this.saving.get(room.id) ?? Promise.resolve();
    const snapshot = structuredClone(room);
    const next = previous
      .then(async () => {
        const started = Date.now();
        await this.store.save(snapshot);
        const ms = Date.now() - started;
        if (ms > 800) console.warn(`slow save ${room.id}: ${ms} ms`);
      })
      .catch((err) => console.error('save failed', err));
    this.saving.set(room.id, next);
    this.onChange(room);
    this.bots.schedule(room);
    await next;
  }

  /** Resolves once every pending save for this room has reached the store. */
  async flush(roomId: string): Promise<void> {
    await (this.saving.get(roomId) ?? Promise.resolve());
  }

  seatForToken(room: Room, token: unknown): number {
    if (typeof token !== 'string' || token.length < 16) return -1;
    const h = hashToken(token);
    return room.seats.findIndex((s) => s.tokenHash === h);
  }

  async create(rawName: unknown, rawConfig?: Partial<RoomConfig>): Promise<Result<{ roomId: string; seat: number; token: string }>> {
    const name = cleanName(rawName);
    if (!name) return { ok: false, error: 'Enter a nickname' };
    const v = validateConfig(rawConfig);
    if (!v.ok) return v;
    const token = randomBytes(24).toString('base64url');
    const seats = buildSeats(v.config);
    seats[0] = { kind: 'human', name, tokenHash: hashToken(token), ready: true, lastSeen: this.now() };
    let id = newRoomId();
    while (this.rooms.has(id) || (await this.store.load(id))) id = newRoomId();
    const room: Room = {
      id,
      createdAt: this.now(),
      config: v.config,
      seats,
      status: 'lobby',
      game: null,
      revision: 0,
      recentRequests: [],
    };
    this.rooms.set(id, room);
    await this.commit(room);
    return { ok: true, roomId: id, seat: 0, token };
  }

  async join(roomId: unknown, rawName: unknown): Promise<Result<{ seat: number; token: string }>> {
    const room = await this.get(roomId);
    if (!room) return { ok: false, error: 'Game not found' };
    if (room.status !== 'lobby') return { ok: false, error: 'This game has already started' };
    const name = cleanName(rawName);
    if (!name) return { ok: false, error: 'Enter a nickname' };
    const seat = room.seats.findIndex((s) => s.kind === 'human' && !s.tokenHash);
    if (seat < 0) return { ok: false, error: 'This game is full' };
    const token = randomBytes(24).toString('base64url');
    room.seats[seat] = { kind: 'human', name, tokenHash: hashToken(token), ready: false, lastSeen: this.now() };
    room.revision++;
    await this.commit(room);
    return { ok: true, seat, token };
  }

  async setReady(room: Room, seat: number, ready: unknown): Promise<Result> {
    if (room.status !== 'lobby') return { ok: false, error: 'The game has already started' };
    room.seats[seat].ready = ready === true;
    room.revision++;
    await this.commit(room);
    return { ok: true };
  }

  async updateConfig(room: Room, seat: number, raw: Partial<RoomConfig>): Promise<Result> {
    if (seat !== 0) return { ok: false, error: 'Only the host can change settings' };
    if (room.status !== 'lobby') return { ok: false, error: 'Settings are locked once the game starts' };
    const v = validateConfig({ ...room.config, ...raw });
    if (!v.ok) return v;
    const claimedHumans = room.seats.filter((s) => s.kind === 'human' && s.tokenHash).length;
    if (v.config.humans < claimedHumans) return { ok: false, error: 'Players already joined those seats' };
    // Joins fill the first free human seat, so claimed seats are always first and are kept.
    room.config = v.config;
    room.seats = buildSeats(v.config, room.seats);
    room.revision++;
    await this.commit(room);
    return { ok: true };
  }

  async start(room: Room, seat: number): Promise<Result> {
    if (seat !== 0) return { ok: false, error: 'Only the host can start the game' };
    if (room.status !== 'lobby') return { ok: false, error: 'The game has already started' };
    const waiting = room.seats.filter((s) => s.kind === 'human' && (!s.tokenHash || !s.ready));
    if (waiting.length) return { ok: false, error: 'Waiting for all players to join and be ready' };
    this.newGame(room);
    await this.commit(room);
    return { ok: true };
  }

  async rematch(room: Room, seat: number): Promise<Result> {
    if (seat !== 0) return { ok: false, error: 'Only the host can start a rematch' };
    if (room.status !== 'finished') return { ok: false, error: 'The game is not finished' };
    this.newGame(room);
    await this.commit(room);
    return { ok: true };
  }

  private newGame(room: Room) {
    room.game = createGame(
      room.seats.map((s) => ({ name: s.name ?? 'Player', kind: s.kind, difficulty: s.difficulty })),
      this.seedSource(),
      { victoryTarget: room.config.victoryTarget, boardType: room.config.boardType, startResBothSettlements: room.config.startResBoth === true },
    );
    room.status = 'playing';
    room.revision++;
    room.recentRequests = [];
  }

  /**
   * Validates and applies a game action. Actions by the active player must
   * match the current revision; discards and trade responses (which other
   * players make in parallel) are fully revalidated by the engine instead.
   */
  async act(
    room: Room,
    seat: number,
    payload: { requestId?: unknown; expectedRevision?: unknown; action?: unknown },
  ): Promise<Result<{ duplicate?: boolean }>> {
    const requestId = typeof payload.requestId === 'string' ? payload.requestId.slice(0, 64) : null;
    if (!requestId) return { ok: false, error: 'Missing request id' };
    const seen = room.recentRequests.find((r) => r.id === requestId && r.seat === seat);
    if (seen) return seen.ok ? { ok: true, duplicate: true } : { ok: false, error: seen.error ?? 'Rejected' };

    if (room.status !== 'playing' || !room.game) return { ok: false, error: 'The game is not running' };
    const action = payload.action as Action;
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') return { ok: false, error: 'Invalid action' };

    const parallelSafe = action.type === 'discard' || action.type === 'respondTrade' || action.type === 'counterTrade';
    if (!parallelSafe && payload.expectedRevision !== room.revision) {
      return { ok: false, error: 'Your game was out of date — please try again' };
    }

    this.touch(room, seat);
    const result = applyAction(room.game, seat, action);
    room.recentRequests.push({ id: requestId, seat, ok: result.ok, error: result.ok ? undefined : result.error });
    if (room.recentRequests.length > 100) room.recentRequests.splice(0, room.recentRequests.length - 100);
    if (!result.ok) return { ok: false, error: result.error };

    room.game = result.state;
    if (room.game.phase === 'GAME_OVER') room.status = 'finished';
    room.revision++;
    // Reply right away; the save to the database continues in the background
    // (saves for a room stay in order, and the in-memory state is authoritative).
    void this.commit(room);
    return { ok: true };
  }

  snapshot(room: Room, seat: number, connected: (seat: number) => boolean): RoomSnapshot {
    return {
      id: room.id,
      status: room.status,
      config: room.config,
      revision: room.revision,
      you: seat,
      seats: room.seats.map((s, i) => ({
        kind: s.kind,
        name: s.name,
        claimed: s.kind === 'bot' || !!s.tokenHash,
        ready: s.ready,
        connected: s.kind === 'bot' || connected(i),
        difficulty: s.difficulty,
      })),
      game: room.game ? getPlayerView(room.game, seat) : null,
    };
  }
}
