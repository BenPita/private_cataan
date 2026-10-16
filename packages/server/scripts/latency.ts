/**
 * Dev tool: measures how long the server takes to acknowledge game actions.
 *   npx tsx scripts/latency.ts <url>
 */
import { io } from 'socket.io-client';
import { legalSetupRoads, legalSetupSettlements, type PlayerView } from '@hex/engine';

const url = process.argv[2];
const s = io(url, { transports: ['websocket'] });
let snap: { revision: number; game: PlayerView | null } | null = null;
s.on('room:state', (x) => (snap = x));
const call = <T>(e: string, p: unknown = {}) => new Promise<T>((r) => s.emit(e, p, r));
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 400 && !cond(); i++) await new Promise((r) => setTimeout(r, 25));
};

s.on('connect', async () => {
  const c = await call<{ ok: boolean; roomId: string }>('room:create', { name: 'Latency', config: { humans: 1, bots: 1 } });
  await call('room:start');
  const times: number[] = [];
  const act = async (action: unknown) => {
    const t0 = Date.now();
    const r = await call<{ ok: boolean; error?: string }>('game:action', { requestId: `${Math.random()}`, expectedRevision: snap!.revision, action });
    times.push(Date.now() - t0);
    if (!r.ok) console.log('rejected', r.error);
  };
  await until(() => !!snap?.game);
  await act({ type: 'rollForOrder' });
  for (let i = 0; i < 2; i++) {
    await until(() => snap!.game!.phase === 'INITIAL_PLACEMENT' && snap!.game!.currentPlayer === 0);
    const v = legalSetupSettlements(snap!.game!)[0];
    await act({ type: 'placeSetupSettlement', vertex: v });
    await until(() => !!snap!.game!.setup?.lastSettlement);
    await act({ type: 'placeSetupRoad', edge: legalSetupRoads(snap!.game!, v)[0] });
  }
  console.log('ack times (ms):', times.join(', '), '| avg', Math.round(times.reduce((a, b) => a + b, 0) / times.length));
  await call('room:leave');
  process.exit(0);
});
setTimeout(() => {
  console.log('timeout');
  process.exit(1);
}, 90_000);
