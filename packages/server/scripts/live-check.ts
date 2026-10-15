/**
 * Dev tool: end-to-end check against a running server. Creates a room,
 * joins a second player, starts, then prints the room id and tokens so
 * autoplay.ts can drive it.
 *
 *   npx tsx scripts/live-check.ts <url>
 */
import { io, type Socket } from 'socket.io-client';

const url = process.argv[2];

const call = <T>(s: Socket, event: string, payload: unknown = {}) =>
  new Promise<T>((resolve) => s.emit(event, payload, resolve));

const connect = () =>
  new Promise<Socket>((resolve) => {
    const s = io(url, { transports: ['websocket'] });
    s.on('connect', () => resolve(s));
  });

const host = await connect();
const guest = await connect();
const created = await call<{ ok: boolean; roomId: string; token: string; error?: string }>(host, 'room:create', {
  name: 'TestRoy',
  config: { humans: 2, bots: 0 },
});
if (!created.ok) throw new Error(created.error);
const joined = await call<{ ok: boolean; token: string; error?: string }>(guest, 'room:join', {
  roomId: created.roomId,
  name: 'TestNoa',
});
if (!joined.ok) throw new Error(joined.error);
const third = await connect();
console.log('third person join:', JSON.stringify(await call(third, 'room:join', { roomId: created.roomId, name: 'Eve' })));
console.log('ready:', await call(guest, 'room:ready', { ready: true }));
console.log('start:', await call(host, 'room:start'));
console.log(`ROOM ${created.roomId} ${created.token} ${joined.token}`);
process.exit(0);
