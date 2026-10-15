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
import type { RoomStore } from './store';

export interface RoomConfig {
  humans: number;
  bots: number;
  difficulty: BotDifficulty;
  victoryTarget: number;
  boardType: 'random' | 'beginner';
}

export interface Seat {
  kind: 'human' | 'bot';
  name: string | null;
  /** sha256 of the seat's secret player token; null while unclaimed. */
  tokenHash: string | null;
  ready: boolean;
  difficulty?: BotDifficulty;
}

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

/** Bots are a later milestone; until then rooms are human-only. */
export const BOTS_ENABLED = false;

const DEFAULT_CONFIG: RoomConfig = {
  humans: 2,
  bots: 0,
  difficulty: 'medium',
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
  if (!BOTS_ENABLED && c.bots > 0) return { ok: false, error: 'AI bots are coming soon' };
  if (!['easy', 'medium', 'hard'].includes(c.difficulty)) return { ok: false, error: 'Invalid difficulty' };
  if (![10, 12].includes(c.victoryTarget)) return { ok: false, error: 'Target must be 10 or 12' };
  if (!['random', 'beginner'].includes(c.boardType)) return { ok: false, error: 'Invalid board type' };
  return {
    ok: true,
    config: {
      humans: c.humans,
      bots: c.bots,
      difficulty: c.difficulty,
      victoryTarget: c.victoryTarget,
      boardType: c.boardType,
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
    difficulty: config.difficulty,
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

  constructor(
    private store: RoomStore,
    private onChange: (room: Room) => void = () => {},
    private seedSource: () => number = () => randomInt(1, 2 ** 31 - 1),
  ) {}

  async get(id: unknown): Promise<Room | null> {
    if (typeof id !== 'string' || !/^[A-Za-z0-9]{4,20}$/.test(id)) return null;
    const cached = this.rooms.get(id);
    if (cached) return cached;
    const loaded = await this.store.load(id);
    if (loaded) this.rooms.set(id, migrate(loaded));
    return loaded;
  }

  /** Persists then broadcasts. Saves for one room are serialized. */
  private async commit(room: Room): Promise<void> {
    const previous = this.saving.get(room.id) ?? Promise.resolve();
    const snapshot = structuredClone(room);
    const next = previous.then(() => this.store.save(snapshot)).catch((err) => console.error('save failed', err));
    this.saving.set(room.id, next);
    this.onChange(room);
    await next;
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
    seats[0] = { kind: 'human', name, tokenHash: hashToken(token), ready: true };
    let id = newRoomId();
    while (this.rooms.has(id) || (await this.store.load(id))) id = newRoomId();
    const room: Room = {
      id,
      createdAt: Date.now(),
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
    room.seats[seat] = { kind: 'human', name, tokenHash: hashToken(token), ready: false };
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
      { victoryTarget: room.config.victoryTarget, boardType: room.config.boardType },
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

    const result = applyAction(room.game, seat, action);
    room.recentRequests.push({ id: requestId, seat, ok: result.ok, error: result.ok ? undefined : result.error });
    if (room.recentRequests.length > 100) room.recentRequests.splice(0, room.recentRequests.length - 100);
    if (!result.ok) return { ok: false, error: result.error };

    room.game = result.state;
    if (room.game.phase === 'GAME_OVER') room.status = 'finished';
    room.revision++;
    await this.commit(room);
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
