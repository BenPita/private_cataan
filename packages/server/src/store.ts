import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import type { Room } from './rooms';

/** Durable storage for rooms. The whole room is saved after every accepted change. */
export interface RoomStore {
  load(id: string): Promise<Room | null>;
  save(room: Room): Promise<void>;
  delete(id: string): Promise<void>;
}

export class MemoryStore implements RoomStore {
  private rooms = new Map<string, string>();
  async load(id: string) {
    const raw = this.rooms.get(id);
    return raw ? (JSON.parse(raw) as Room) : null;
  }
  async save(room: Room) {
    this.rooms.set(room.id, JSON.stringify(room));
  }
  async delete(id: string) {
    this.rooms.delete(id);
  }
}

export class FileStore implements RoomStore {
  constructor(private dir: string) {}

  private file(id: string) {
    if (!/^[A-Za-z0-9]+$/.test(id)) throw new Error('Invalid room id');
    return path.join(this.dir, `${id}.json`);
  }

  async load(id: string) {
    try {
      return JSON.parse(await readFile(this.file(id), 'utf8')) as Room;
    } catch {
      return null;
    }
  }

  async save(room: Room) {
    await mkdir(this.dir, { recursive: true });
    const target = this.file(room.id);
    const tmp = `${target}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(room));
    await rename(tmp, target); // atomic replace
  }

  async delete(id: string) {
    await rm(this.file(id), { force: true });
  }
}

export class PostgresStore implements RoomStore {
  private pool: pg.Pool;
  private ready: Promise<void>;

  constructor(connection: string | pg.Pool) {
    this.pool =
      typeof connection === 'string'
        ? new pg.Pool({
            connectionString: connection,
            ssl: connection.includes('localhost') ? undefined : { rejectUnauthorized: false },
            max: 5,
          })
        : connection;
    // Neon closes idle connections; without a listener that error would crash the process.
    this.pool.on('error', (err) => console.error('postgres pool error', err.message));
    this.ready = this.pool
      .query(
        `CREATE TABLE IF NOT EXISTS rooms (
           id TEXT PRIMARY KEY,
           data JSONB NOT NULL,
           updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`,
      )
      .then(() => undefined);
  }

  async load(id: string) {
    await this.ready;
    const res = await this.pool.query('SELECT data FROM rooms WHERE id = $1', [id]);
    return res.rows[0] ? (res.rows[0].data as Room) : null;
  }

  async save(room: Room) {
    await this.ready;
    await this.pool.query(
      `INSERT INTO rooms (id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [room.id, JSON.stringify(room)],
    );
  }

  async delete(id: string) {
    await this.ready;
    await this.pool.query('DELETE FROM rooms WHERE id = $1', [id]);
  }
}

export function createStore(): RoomStore {
  if (process.env.DATABASE_URL) return new PostgresStore(process.env.DATABASE_URL);
  return new FileStore(process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data', 'rooms'));
}
