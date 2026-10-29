/**
 * Dev tool: drives real seats of a running room over Socket.IO with simple
 * legal moves, to fast-forward a match while watching it in the browser.
 *
 *   npx tsx scripts/autoplay.ts <url> <roomId> <untilTurn> <token...>
 */
import { io } from 'socket.io-client';
import {
  chooseBotAction,
  hasShips,
  modFor,
  RESOURCES,
  emptyRes,
  hasRes,
  legalCities,
  legalRoads,
  legalSettlements,
  legalSetupRoads,
  legalSetupSettlements,
  tradeRates,
  type Action,
  type BotMemory,
  type PlayerView,
} from '@hex/engine';

const [url, roomId, untilTurnRaw, ...tokens] = process.argv.slice(2);
const untilTurn = Number(untilTurnRaw);

interface Snap {
  revision: number;
  you: number;
  game: PlayerView | null;
}

/** Bot memory kept across moves (e.g. trade offers already tried this turn). */
const botMemory: BotMemory = {};

function choose(v: PlayerView): Action | null {
  // Seafarers (ships, pirate, gold choices): let the medium bot pick the move.
  if (hasShips(modFor(v))) return chooseBotAction(v, 'medium', Math.random, botMemory);
  const me = v.me!;
  const costs = modFor(v).costs;
  const res = v.players[me].resources!;
  if (v.phase === 'ROBBER_DISCARD') {
    const need = v.pendingDiscards[me];
    if (need === undefined) return null;
    const d = emptyRes();
    let left = need;
    for (const r of RESOURCES) {
      const take = Math.min(res[r], left);
      d[r] = take;
      left -= take;
    }
    return { type: 'discard', resources: d };
  }
  if (v.trade && v.trade.to.includes(me) && v.trade.responses[me] === 'pending') {
    return { type: 'respondTrade', tradeId: v.trade.id, response: 'reject' };
  }
  if (v.phase === 'ORDER_ROLL') {
    const group = v.orderRoll!.groups.find((g) => g.length > 1);
    return group?.includes(me) && !v.orderRoll!.rolls[me] ? { type: 'rollForOrder' } : null;
  }
  if (v.currentPlayer !== me) return null;
  switch (v.phase) {
    case 'INITIAL_PLACEMENT': {
      const last = v.setup!.lastSettlement;
      if (last) return { type: 'placeSetupRoad', edge: legalSetupRoads(v, last)[0] };
      const spots = legalSetupSettlements(v);
      return { type: 'placeSetupSettlement', vertex: spots[Math.floor(Math.random() * spots.length)] };
    }
    case 'PRE_ROLL':
      return { type: 'rollDice' };
    case 'ROBBER_MOVE': {
      const hexes = v.board.hexes.filter((h) => h.id !== v.board.robberHex);
      return { type: 'moveRobber', hex: hexes[Math.floor(Math.random() * hexes.length)].id };
    }
    case 'ROBBER_STEAL':
      return { type: 'steal', victim: v.stealCandidates[0] };
    case 'MAIN_ACTIONS': {
      if (v.trade) return { type: 'cancelTrade' };
      if (v.freeRoads > 0) {
        const e = legalRoads(v, me);
        return e.length ? { type: 'placeFreeRoad', edge: e[0] } : { type: 'finishRoadBuilding' };
      }
      const city = legalCities(v, me);
      if (city.length && hasRes(res, costs.city)) return { type: 'buildCity', vertex: city[0] };
      const sett = legalSettlements(v, me);
      if (sett.length && hasRes(res, costs.settlement)) return { type: 'buildSettlement', vertex: sett[0] };
      const roads = legalRoads(v, me);
      if (roads.length && hasRes(res, costs.road) && (sett.length === 0 || v.players[me].roadsBuilt < 6)) {
        return { type: 'buildRoad', edge: roads[Math.floor(Math.random() * roads.length)] };
      }
      // Trade surplus with the bank toward whatever the next build is missing.
      const target = city.length ? costs.city : costs.settlement;
      const rates = tradeRates(v, me);
      const missing = RESOURCES.find((r) => res[r] < (target[r] ?? 0) && v.bank[r] > 0);
      const surplus = RESOURCES.find((r) => r !== missing && res[r] - (target[r] ?? 0) >= rates[r]);
      if (missing && surplus) return { type: 'bankTrade', give: surplus, get: missing };
      return { type: 'endTurn' };
    }
    default:
      return null;
  }
}

let done = 0;
for (const token of tokens) {
  const socket = io(url, { transports: ['websocket'] });
  let busy = false;
  let lastSnap: Snap | null = null;
  const step = async () => {
    const snap = lastSnap;
    if (busy || !snap?.game) return;
    const v = snap.game;
    if (v.phase === 'GAME_OVER' || (v.turn >= untilTurn && v.phase === 'PRE_ROLL')) {
      socket.close();
      if (++done === tokens.length) {
        console.log(`stopped at turn ${v.turn}, phase ${v.phase}`);
        process.exit(0);
      }
      return;
    }
    const action = choose(v);
    if (!action) return;
    busy = true;
    const res = await new Promise<{ ok: boolean; error?: string }>((resolve) =>
      socket.emit('game:action', { requestId: `${Date.now()}-${Math.random()}`, expectedRevision: snap.revision, action }, resolve),
    );
    busy = false;
    if (!res.ok) console.log(`seat ${snap.you} ${action.type}: ${res.error}`);
    setTimeout(step, 60);
  };
  socket.on('room:state', (s: Snap) => {
    lastSnap = s;
    setTimeout(step, 60);
  });
  socket.on('connect', () => socket.emit('room:resume', { roomId, token }, (r: unknown) => console.log('resume', r)));
}
setTimeout(() => {
  console.log('timeout');
  process.exit(1);
}, 900_000);
