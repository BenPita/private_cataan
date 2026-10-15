import { describe, expect, it } from 'vitest';
import {
  RESOURCES,
  Rng,
  applyAction,
  createGame,
  emptyRes,
  getPlayerView,
  legalCities,
  legalRoads,
  legalSettlements,
  legalSetupRoads,
  legalSetupSettlements,
  orderRollGroup,
  resOf,
  totalRes,
  type Action,
  type GameState,
} from '../src';

/** Plausible actions for the player who must act; the engine filters out illegal ones. */
function candidates(s: GameState, rng: Rng): Array<[number, Action]> {
  const p = s.currentPlayer;
  const me = s.players[p];
  const out: Array<[number, Action]> = [];
  switch (s.phase) {
    case 'ORDER_ROLL':
      return orderRollGroup(s)!.filter((pl) => !s.orderRoll!.rolls[pl]).map((pl) => [pl, { type: 'rollForOrder' }]);
    case 'INITIAL_PLACEMENT':
      if (s.setup!.lastSettlement) {
        for (const e of legalSetupRoads(s, s.setup!.lastSettlement)) out.push([p, { type: 'placeSetupRoad', edge: e }]);
      } else {
        for (const v of legalSetupSettlements(s)) out.push([p, { type: 'placeSetupSettlement', vertex: v }]);
      }
      return out;
    case 'ROBBER_DISCARD':
      for (const [k, n] of Object.entries(s.pendingDiscards)) {
        const pl = Number(k);
        const pool = RESOURCES.flatMap((r) => Array(s.players[pl].resources[r]).fill(r));
        const discard = emptyRes();
        for (const r of rng.shuffle(pool).slice(0, n)) discard[r as keyof typeof discard]++;
        out.push([pl, { type: 'discard', resources: discard }]);
      }
      return out;
    case 'ROBBER_MOVE':
      return [[p, { type: 'moveRobber', hex: rng.int(19) }]];
    case 'ROBBER_STEAL':
      return s.stealCandidates.map((v) => [p, { type: 'steal', victim: v }]);
    default:
      break;
  }
  if (s.freeRoads > 0) {
    const roads = legalRoads(s, p);
    return roads.length ? roads.map((e) => [p, { type: 'placeFreeRoad', edge: e }]) : [[p, { type: 'finishRoadBuilding' }]];
  }
  if (s.trade) {
    for (const t of s.trade.to) {
      out.push([t, { type: 'respondTrade', tradeId: s.trade.id, response: rng.next() < 0.5 ? 'accept' : 'reject' }]);
    }
    out.push([p, { type: 'cancelTrade' }]);
    return out;
  }
  for (const c of me.devCards) {
    if (c.type === 'knight') out.push([p, { type: 'playKnight' }]);
    if (c.type === 'roadBuilding') out.push([p, { type: 'playRoadBuilding' }]);
    if (c.type === 'monopoly') out.push([p, { type: 'playMonopoly', resource: RESOURCES[rng.int(5)] }]);
    if (c.type === 'yearOfPlenty') out.push([p, { type: 'playYearOfPlenty', resources: [RESOURCES[rng.int(5)], RESOURCES[rng.int(5)]] }]);
  }
  if (s.phase === 'PRE_ROLL') {
    out.push([p, { type: 'rollDice' }], [p, { type: 'rollDice' }], [p, { type: 'rollDice' }]);
    return out;
  }
  for (const v of legalCities(s, p)) out.push([p, { type: 'buildCity', vertex: v }]);
  for (const v of legalSettlements(s, p)) out.push([p, { type: 'buildSettlement', vertex: v }]);
  for (const e of legalRoads(s, p).slice(0, 4)) out.push([p, { type: 'buildRoad', edge: e }]);
  out.push([p, { type: 'buyDevCard' }]);
  out.push([p, { type: 'bankTrade', give: RESOURCES[rng.int(5)], get: RESOURCES[rng.int(5)] }]);
  const other = (p + 1 + rng.int(s.players.length - 1)) % s.players.length;
  out.push([p, { type: 'proposeTrade', give: resOf({ [RESOURCES[rng.int(5)]]: 1 }), get: resOf({ [RESOURCES[rng.int(5)]]: 1 }), to: [other] }]);
  out.push([p, { type: 'endTurn' }]);
  return out;
}

function checkInvariants(s: GameState) {
  for (const r of RESOURCES) {
    const total = s.bank[r] + s.players.reduce((sum, p) => sum + p.resources[r], 0);
    expect(total).toBe(19);
    expect(s.bank[r]).toBeGreaterThanOrEqual(0);
  }
  for (const p of s.players) {
    for (const r of RESOURCES) expect(p.resources[r]).toBeGreaterThanOrEqual(0);
    expect(p.roadsBuilt).toBeLessThanOrEqual(15);
    expect(p.settlementsBuilt - p.citiesBuilt).toBeLessThanOrEqual(5);
    expect(p.citiesBuilt).toBeLessThanOrEqual(4);
  }
  const devTotal = s.devDeck.length + s.players.reduce((sum, p) => sum + p.devCards.length, 0);
  expect(devTotal).toBeLessThanOrEqual(25);
}

describe('random full-game simulation', () => {
  for (const n of [2, 3, 4]) {
    it(`plays random ${n}-player games without breaking invariants`, () => {
      let finished = 0;
      for (let g = 0; g < 4; g++) {
        const rng = new Rng(1000 * n + g);
        let s = createGame(
          Array.from({ length: n }, (_, i) => ({ name: `P${i}`, kind: 'human' as const })),
          5000 + g,
        );
        for (let step = 0; step < 4000 && s.phase !== 'GAME_OVER'; step++) {
          const options = candidates(s, rng);
          // Greedy-ish: try a building action first, then anything random.
          const priority = ['buildCity', 'buildSettlement', 'buyDevCard', 'placeFreeRoad', 'buildRoad', 'bankTrade'];
          let res = null as ReturnType<typeof applyAction> | null;
          for (const type of priority) {
            const match = options.filter(([, a]) => a.type === type);
            if (!match.length || (type === 'buildRoad' && rng.next() < 0.5)) continue;
            const [pl, a] = match[rng.int(match.length)];
            const attempt = applyAction(s, pl, a);
            if (attempt.ok) {
              res = attempt;
              break;
            }
          }
          if (!res) {
            const [player, action] = options[rng.int(options.length)];
            res = applyAction(s, player, action);
          }
          if (res.ok) {
            s = res.state;
            checkInvariants(s);
            // Views never leak other players' hidden info.
            const view = getPlayerView(s, 0);
            view.players.forEach((pv, i) => {
              if (i !== 0 && s.phase !== 'GAME_OVER') {
                expect(pv.resources).toBeNull();
                expect(pv.devCards).toBeNull();
              }
              expect(pv.resourceCount).toBe(totalRes(s.players[i].resources));
            });
            expect(JSON.stringify(view)).not.toContain('"rng"');
          }
        }
        if (s.phase === 'GAME_OVER') finished++;
      }
      expect(finished).toBeGreaterThan(0);
    });
  }
});
