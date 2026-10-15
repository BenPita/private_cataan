import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import { RoomManager, type Room } from './rooms';
import { createStore } from './store';

const PORT = Number(process.env.PORT ?? 3001);
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

const app = express();
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});
if (existsSync(clientDist)) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: process.env.NODE_ENV === 'production' ? undefined : { origin: true },
  maxHttpBufferSize: 64 * 1024,
});

/** Which sockets currently hold which seat of which room. */
const presence = new Map<string, Map<number, Set<string>>>();

const isConnected = (roomId: string) => (seat: number) => (presence.get(roomId)?.get(seat)?.size ?? 0) > 0;

function broadcast(room: Room) {
  const seats = presence.get(room.id);
  if (!seats) return;
  for (const [seat, socketIds] of seats) {
    const snapshot = manager.snapshot(room, seat, isConnected(room.id));
    for (const id of socketIds) io.to(id).emit('room:state', snapshot);
  }
}

const manager = new RoomManager(createStore(), broadcast, undefined, {
  botDelayMs: Number(process.env.BOT_DELAY_MS ?? 900),
});

interface SocketSession {
  roomId?: string;
  seat?: number;
}

function attach(socket: Socket, room: Room, seat: number) {
  detach(socket);
  const session = socket.data as SocketSession;
  session.roomId = room.id;
  session.seat = seat;
  if (!presence.has(room.id)) presence.set(room.id, new Map());
  const seats = presence.get(room.id)!;
  if (!seats.has(seat)) seats.set(seat, new Set());
  seats.get(seat)!.add(socket.id);
  broadcast(room);
}

function detach(socket: Socket) {
  const session = socket.data as SocketSession;
  if (session.roomId === undefined || session.seat === undefined) return;
  const seats = presence.get(session.roomId);
  seats?.get(session.seat)?.delete(socket.id);
  const roomId = session.roomId;
  session.roomId = undefined;
  session.seat = undefined;
  manager.get(roomId).then((room) => room && broadcast(room));
}

type Ack = (response: unknown) => void;
const safeAck = (ack: unknown): Ack => (typeof ack === 'function' ? (ack as Ack) : () => {});

/** Resolves the caller's room and seat from their socket session. */
async function current(socket: Socket): Promise<{ room: Room; seat: number } | null> {
  const session = socket.data as SocketSession;
  if (session.roomId === undefined || session.seat === undefined) return null;
  const room = await manager.get(session.roomId);
  return room ? { room, seat: session.seat } : null;
}

function handler(fn: (socket: Socket, payload: any) => Promise<unknown>) {
  return (socket: Socket) => async (payload: unknown, ack: unknown) => {
    const reply = safeAck(ack);
    try {
      reply(await fn(socket, payload ?? {}));
    } catch (err) {
      console.error(err);
      reply({ ok: false, error: 'Server error' });
    }
  };
}

const handlers = {
  'room:create': handler(async (socket, p) => {
    const res = await manager.create(p.name, p.config);
    if (res.ok) attach(socket, (await manager.get(res.roomId))!, res.seat);
    return res;
  }),
  'room:join': handler(async (socket, p) => {
    const res = await manager.join(p.roomId, p.name);
    if (res.ok) attach(socket, (await manager.get(p.roomId))!, res.seat);
    return res;
  }),
  'room:resume': handler(async (socket, p) => {
    const room = await manager.get(p.roomId);
    if (!room) return { ok: false, error: 'Game not found' };
    const seat = manager.seatForToken(room, p.token);
    if (seat < 0) return { ok: false, error: 'Not a player in this game' };
    attach(socket, room, seat);
    return { ok: true, seat };
  }),
  'room:peek': handler(async (_socket, p) => {
    const room = await manager.get(p.roomId);
    if (!room) return { ok: false, error: 'Game not found' };
    return {
      ok: true,
      status: room.status,
      host: room.seats[0].name,
      openSeats: room.seats.filter((s) => s.kind === 'human' && !s.tokenHash).length,
    };
  }),
  'room:ready': handler(async (socket, p) => {
    const c = await current(socket);
    return c ? manager.setReady(c.room, c.seat, p.ready) : { ok: false, error: 'Not in a game' };
  }),
  'room:config': handler(async (socket, p) => {
    const c = await current(socket);
    return c ? manager.updateConfig(c.room, c.seat, p.config ?? {}) : { ok: false, error: 'Not in a game' };
  }),
  'room:start': handler(async (socket) => {
    const c = await current(socket);
    return c ? manager.start(c.room, c.seat) : { ok: false, error: 'Not in a game' };
  }),
  'room:rematch': handler(async (socket) => {
    const c = await current(socket);
    return c ? manager.rematch(c.room, c.seat) : { ok: false, error: 'Not in a game' };
  }),
  'game:action': handler(async (socket, p) => {
    const c = await current(socket);
    return c ? manager.act(c.room, c.seat, p) : { ok: false, error: 'Not in a game' };
  }),
};

io.on('connection', (socket) => {
  for (const [event, make] of Object.entries(handlers)) socket.on(event, make(socket));
  socket.on('disconnect', () => detach(socket));
});

httpServer.listen(PORT, () => {
  console.log(`Hex Islands server listening on http://localhost:${PORT}`);
});
