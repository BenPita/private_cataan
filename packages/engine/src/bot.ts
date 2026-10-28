/**
 * AI players. A bot decides from its own PlayerView only (never the full
 * state), so it sees exactly what a human in its seat would see. Every
 * decision is returned as a normal Action and validated by the engine.
 *
 * Difficulty changes how well the bot evaluates options, not what it may do:
 *  - easy:   noisy placement, simple priorities, little trading
 *  - medium: production-based placement, resource-goal planning, bank trades,
 *            robber aimed at the strongest opponent, sensible trade responses
 *  - hard:   medium plus scarcity/harbor-aware placement, road planning
 *            several steps ahead, dev-card army race, leader-aware trading
 */
import { TERRAIN_RESOURCE, devCardReady } from './rulesets';
import { boardGraph, type BoardGraph } from './geometry';
import { modFor, type ModDef } from './mods';
import {
  legalCities,
  legalRoads,
  legalSettlements,
  legalSetupRoads,
  legalSetupSettlements,
  playersOnHex,
  satisfiesDistanceRule,
  tradeRates,
} from './queries';
import { emptyRes, hasRes, totalRes } from './resources';
import { RESOURCES, type Action, type BotDifficulty, type ResMap, type Resource } from './types';
import type { PlayerView } from './view';

export type Random = () => number;

type Goal = 'city' | 'settlement' | 'road' | 'devCard';

const pips = (n: number | null) => (n === null ? 0 : 6 - Math.abs(7 - n));

interface Ctx {
  v: PlayerView;
  me: number;
  res: ResMap;
  level: BotDifficulty;
  rand: Random;
  /** The board's graph and the game's mod. */
  g: BoardGraph;
  mod: ModDef;
}

// ---------------------------------------------------------------------------
// Evaluation helpers
// ---------------------------------------------------------------------------

/** Total pips per resource the player currently produces. */
function production(v: PlayerView, player: number): ResMap {
  const G = boardGraph(v.board);
  const out = emptyRes();
  for (const [vertex, b] of Object.entries(v.buildings)) {
    if (b.owner !== player) continue;
    for (const h of G.vertices[vertex].hexes) {
      const tile = v.board.hexes[h];
      const r = TERRAIN_RESOURCE[tile.terrain];
      if (r && h !== v.board.robberHex) out[r] += pips(tile.number) * (b.type === 'city' ? 2 : 1);
    }
  }
  return out;
}

/** How rare each resource is on this board (more pips = less scarce). */
function scarcity(v: PlayerView): ResMap {
  const total = emptyRes();
  for (const h of v.board.hexes) {
    const r = TERRAIN_RESOURCE[h.terrain];
    if (r) total[r] += pips(h.number);
  }
  const out = emptyRes();
  for (const r of RESOURCES) out[r] = 1 + 6 / Math.max(total[r], 1);
  return out;
}

function harborAt(v: PlayerView, vertex: string) {
  const G = boardGraph(v.board);
  return v.board.harbors.find((h) => G.edges[h.edge].vertices.includes(vertex));
}

/** Value of owning a settlement at `vertex`. */
function vertexValue(c: Ctx, vertex: string, owned = production(c.v, c.me)): number {
  const { v, level } = c;
  const scarce = level === 'hard' ? scarcity(v) : null;
  let value = 0;
  const gained = new Set<Resource>();
  for (const h of c.g.vertices[vertex].hexes) {
    const tile = v.board.hexes[h];
    const r = TERRAIN_RESOURCE[tile.terrain];
    if (!r) continue;
    let p = pips(tile.number);
    if (h === v.board.robberHex) p *= 0.4;
    // Early game values brick/lumber, later ore/grain; medium+ also likes balance.
    const weight = scarce ? scarce[r] : 1;
    value += p * weight;
    if (owned[r] === 0) gained.add(r);
  }
  if (level !== 'easy') value += gained.size * 1.6;
  const harbor = harborAt(v, vertex);
  if (harbor && level !== 'easy') {
    if (harbor.type === 'generic') value += 1;
    else value += Math.min(owned[harbor.type] / 3, 2.5) + (level === 'hard' ? 0.5 : 0);
  }
  return value;
}

/** Best vertices the player could reach by extending roads, with path lengths. */
function expansionTargets(c: Ctx, maxDepth: number): Array<{ vertex: string; dist: number; firstEdge: string; value: number }> {
  const { v, me } = c;
  const owned = production(v, me);
  const start = new Set<string>();
  for (const [vertex, b] of Object.entries(v.buildings)) if (b.owner === me) start.add(vertex);
  for (const [edge, owner] of Object.entries(v.roads)) if (owner === me) c.g.edges[edge].vertices.forEach((x) => start.add(x));

  const seen = new Map<string, { dist: number; firstEdge: string }>();
  let frontier: Array<{ vertex: string; firstEdge: string }> = [...start]
    .filter((x) => !v.buildings[x] || v.buildings[x].owner === me)
    .map((x) => ({ vertex: x, firstEdge: '' }));
  for (const f of frontier) seen.set(f.vertex, { dist: 0, firstEdge: '' });

  for (let d = 1; d <= maxDepth; d++) {
    const next: typeof frontier = [];
    for (const { vertex, firstEdge } of frontier) {
      const b = v.buildings[vertex];
      if (b && b.owner !== me) continue;
      for (const e of c.g.vertices[vertex].edges) {
        if (v.roads[e] !== undefined && v.roads[e] !== me) continue;
        const [a, bb] = c.g.edges[e].vertices;
        const other = a === vertex ? bb : a;
        if (seen.has(other)) continue;
        const fe = firstEdge || (v.roads[e] === undefined ? e : '');
        seen.set(other, { dist: d, firstEdge: fe });
        next.push({ vertex: other, firstEdge: fe });
      }
    }
    frontier = next;
  }

  const out: Array<{ vertex: string; dist: number; firstEdge: string; value: number }> = [];
  for (const [vertex, { dist, firstEdge }] of seen) {
    if (dist === 0 || !firstEdge || !satisfiesDistanceRule(v, vertex)) continue;
    out.push({ vertex, dist, firstEdge, value: vertexValue(c, vertex, owned) / (1 + 0.45 * dist) });
  }
  return out.sort((a, b) => b.value - a.value);
}

function pick<T>(c: Ctx, sorted: T[], topFraction: number): T {
  // Easy bots choose among the better half; others take the best.
  const n = Math.max(1, Math.ceil(sorted.length * topFraction));
  return sorted[Math.floor(c.rand() * n)];
}

function opponents(c: Ctx): number[] {
  return c.v.players.map((_, i) => i).filter((i) => i !== c.me);
}

/** Strongest opponent by public points (ties: more cards). */
function leader(c: Ctx): number {
  return opponents(c).sort(
    (a, b) =>
      c.v.players[b].victoryPoints - c.v.players[a].victoryPoints || c.v.players[b].resourceCount - c.v.players[a].resourceCount,
  )[0];
}

// ---------------------------------------------------------------------------
// Goal planning
// ---------------------------------------------------------------------------

function piecesLeft(c: Ctx) {
  const p = c.v.players[c.me];
  return {
    roads: c.mod.pieceLimits.roads - p.roadsBuilt,
    settlements: c.mod.pieceLimits.settlements - (p.settlementsBuilt - p.citiesBuilt),
    cities: c.mod.pieceLimits.cities - p.citiesBuilt,
  };
}

function chooseGoal(c: Ctx): Goal | null {
  const left = piecesLeft(c);
  const canSettle = left.settlements > 0 && legalSettlements(c.v, c.me).length > 0;
  const canCity = left.cities > 0 && legalCities(c.v, c.me).length > 0;
  const prod = production(c.v, c.me);
  const oreGrain = prod.ore + prod.grain;

  if (canSettle && canCity && c.level !== 'easy') {
    // Prefer cities once ore/grain flow is decent, settlements otherwise.
    return oreGrain >= 8 || c.res.ore >= 2 ? 'city' : 'settlement';
  }
  if (canSettle) return 'settlement';
  if (canCity) return 'city';
  if (left.settlements > 0 && left.roads > 0 && expansionTargets(c, 3).length > 0) return 'road';
  if (c.v.devDeckCount > 0) return 'devCard';
  return null;
}

function goalCost(c: Ctx, goal: Goal): Partial<ResMap> {
  return c.mod.costs[goal];
}

function missingFor(res: ResMap, cost: Partial<ResMap>): ResMap {
  const m = emptyRes();
  for (const r of RESOURCES) m[r] = Math.max(0, (cost[r] ?? 0) - res[r]);
  return m;
}

/** Cards not needed for the current goal (what we are happy to give away). */
function surplus(res: ResMap, cost: Partial<ResMap>): ResMap {
  const s = emptyRes();
  for (const r of RESOURCES) s[r] = Math.max(0, res[r] - (cost[r] ?? 0));
  return s;
}

// ---------------------------------------------------------------------------
// Decisions per phase
// ---------------------------------------------------------------------------

function setupSettlement(c: Ctx): Action {
  const spots = legalSetupSettlements(c.v)
    .map((vertex) => ({ vertex, value: vertexValue(c, vertex) }))
    .sort((a, b) => b.value - a.value);
  const choice = pick(c, spots, c.level === 'easy' ? 0.35 : c.level === 'medium' ? 0.04 : 0.01);
  return { type: 'placeSetupSettlement', vertex: choice.vertex };
}

function setupRoad(c: Ctx, settlement: string): Action {
  const edges = legalSetupRoads(c.v, settlement);
  if (c.level === 'easy') return { type: 'placeSetupRoad', edge: edges[Math.floor(c.rand() * edges.length)] };
  // Point the road at the best open spot two steps away.
  let best = edges[0];
  let bestValue = -1;
  for (const e of edges) {
    const far = c.g.edges[e].vertices.find((x) => x !== settlement)!;
    for (const n of c.g.vertices[far].neighbors) {
      if (n === settlement || !satisfiesDistanceRule(c.v, n)) continue;
      const val = vertexValue(c, n);
      if (val > bestValue) {
        bestValue = val;
        best = e;
      }
    }
  }
  return { type: 'placeSetupRoad', edge: best };
}

function discard(c: Ctx, count: number): Action {
  const goal = chooseGoal(c) ?? 'devCard';
  const keep = goalCost(c, goal);
  const out = emptyRes();
  const pool = { ...c.res };
  for (let i = 0; i < count; i++) {
    // Drop from the largest pile beyond what the goal needs.
    const r = [...RESOURCES].sort(
      (a, b) => pool[b] - (keep[b] ?? 0) - (pool[a] - (keep[a] ?? 0)) || pool[b] - pool[a],
    )[0];
    out[r]++;
    pool[r]--;
  }
  return { type: 'discard', resources: out };
}

function robberHex(c: Ctx): number {
  const { v, me } = c;
  const lead = leader(c);
  const candidates = v.board.hexes
    .filter((h) => h.id !== v.board.robberHex)
    .map((h) => {
      const owners = playersOnHex(v, h.id);
      if (owners.includes(me)) return { id: h.id, score: -100 };
      let score = 0;
      for (const vert of c.g.hexes[h.id].vertices) {
        const b = v.buildings[vert];
        if (!b || b.owner === me) continue;
        const weight = c.level === 'hard' && b.owner === lead ? 1.8 : 1;
        score += pips(h.number) * (b.type === 'city' ? 2 : 1) * weight;
      }
      if (owners.some((o) => o !== me && v.players[o].resourceCount > 0)) score += 2;
      return { id: h.id, score };
    })
    .sort((a, b) => b.score - a.score);
  if (c.level === 'easy') {
    const safe = candidates.filter((x) => x.score >= 0);
    return safe[Math.floor(c.rand() * safe.length)]?.id ?? candidates[0].id;
  }
  return candidates[0].id;
}

function stealVictim(c: Ctx): number {
  const cands = [...c.v.stealCandidates];
  if (c.level === 'easy') return cands[Math.floor(c.rand() * cands.length)];
  return cands.sort(
    (a, b) =>
      c.v.players[b].victoryPoints * 2 + c.v.players[b].resourceCount -
      (c.v.players[a].victoryPoints * 2 + c.v.players[a].resourceCount),
  )[0];
}

function robberOnMe(c: Ctx): boolean {
  return playersOnHex(c.v, c.v.board.robberHex).includes(c.me);
}

function playableDev(c: Ctx, type: string): boolean {
  const p = c.v.players[c.me];
  return !p.playedDevThisTurn && (p.devCards ?? []).some((d) => d.type === type && devCardReady(c.v, d));
}

function shouldPlayKnight(c: Ctx): boolean {
  if (!playableDev(c, 'knight')) return false;
  if (robberOnMe(c)) return true;
  if (c.level === 'easy') return false;
  const mine = c.v.players[c.me].knightsPlayed;
  const holder = c.v.largestArmy;
  const best = holder === null ? 2 : c.v.players[holder].knightsPlayed;
  // Race for Largest Army when one more knight would take it.
  if (holder !== c.me && mine + 1 > best && mine + 1 >= 3) return true;
  return c.level === 'hard' && c.v.players[leader(c)].victoryPoints >= 7;
}

/** A dev card worth playing in the main phase, or null. */
function mainPhaseDev(c: Ctx, goal: Goal | null): Action | null {
  if (shouldPlayKnight(c)) return { type: 'playKnight' };
  if (playableDev(c, 'roadBuilding') && piecesLeft(c).roads > 0 && legalRoads(c.v, c.me).length > 0 && (goal === 'road' || goal === 'settlement' || c.level === 'easy')) {
    return { type: 'playRoadBuilding' };
  }
  if (playableDev(c, 'yearOfPlenty') && goal) {
    const miss = missingFor(c.res, goalCost(c, goal));
    const wanted = RESOURCES.flatMap((r) => Array(miss[r]).fill(r) as Resource[]).filter((r) => c.v.bank[r] > 0);
    if (wanted.length > 0) {
      const a = wanted[0];
      const b = wanted[1] ?? wanted[0];
      if (a !== b || c.v.bank[a] >= 2) return { type: 'playYearOfPlenty', resources: [a, b] };
    }
  }
  if (playableDev(c, 'monopoly') && goal && c.level !== 'easy') {
    // Pick the resource we lack most; opponents' hands are hidden, so guess from what the board produces for them.
    const miss = missingFor(c.res, goalCost(c, goal));
    const theirProd = emptyRes();
    for (const o of opponents(c)) {
      const p = production(c.v, o);
      for (const r of RESOURCES) theirProd[r] += p[r];
    }
    const best = [...RESOURCES].sort((a, b) => miss[b] * 3 + theirProd[b] - (miss[a] * 3 + theirProd[a]))[0];
    const cardsOut = opponents(c).reduce((s, o) => s + c.v.players[o].resourceCount, 0);
    if (miss[best] > 0 && cardsOut >= 4) return { type: 'playMonopoly', resource: best };
  }
  return null;
}

function bestSettlement(c: Ctx): string | null {
  const spots = legalSettlements(c.v, c.me).map((vertex) => ({ vertex, value: vertexValue(c, vertex) }));
  if (!spots.length) return null;
  spots.sort((a, b) => b.value - a.value);
  return pick(c, spots, c.level === 'easy' ? 0.5 : 0.01).vertex;
}

function bestCity(c: Ctx): string | null {
  const spots = legalCities(c.v, c.me).map((vertex) => ({ vertex, value: vertexValue(c, vertex) }));
  if (!spots.length) return null;
  return spots.sort((a, b) => b.value - a.value)[0].vertex;
}

function bestRoad(c: Ctx): string | null {
  const legal = new Set(legalRoads(c.v, c.me));
  if (!legal.size) return null;
  if (c.level === 'easy') {
    const all = [...legal];
    return all[Math.floor(c.rand() * all.length)];
  }
  const targets = expansionTargets(c, c.level === 'hard' ? 4 : 3).filter((t) => legal.has(t.firstEdge));
  if (targets.length) return targets[0].firstEdge;
  // No good spot: extend toward Longest Road if competitive (hard), otherwise any legal road.
  return [...legal][0];
}

/** Bank/harbor trade toward the goal. */
function bankTrade(c: Ctx, goal: Goal): Action | null {
  const cost = goalCost(c, goal);
  const miss = missingFor(c.res, cost);
  const need = RESOURCES.filter((r) => miss[r] > 0 && c.v.bank[r] > 0).sort((a, b) => miss[b] - miss[a]);
  if (!need.length) return null;
  const rates = tradeRates(c.v, c.me);
  const spare = surplus(c.res, cost);
  const give = RESOURCES.filter((r) => r !== need[0] && spare[r] >= rates[r]).sort(
    (a, b) => rates[a] - rates[b] || spare[b] - spare[a],
  )[0];
  if (!give) return null;
  // Only trade when it actually gets us close to building (avoid trading away everything).
  const stillMissing = totalRes(miss) - 1;
  if (c.level === 'easy' && stillMissing > 1) return null;
  if (stillMissing > 2) return null;
  return { type: 'bankTrade', give, get: need[0] };
}

/** One player-trade proposal per turn: offer spare cards for a missing one. */
function proposeTrade(c: Ctx, goal: Goal): Action | null {
  const cost = goalCost(c, goal);
  const miss = missingFor(c.res, cost);
  const need = RESOURCES.find((r) => miss[r] > 0);
  if (!need) return null;
  const spare = surplus(c.res, cost);
  const give = RESOURCES.filter((r) => r !== need && spare[r] > 0).sort((a, b) => spare[b] - spare[a])[0];
  if (!give) return null;
  const to = opponents(c).filter(
    (o) => c.v.players[o].resourceCount > 0 && (c.level !== 'hard' || c.v.players[o].victoryPoints < 8),
  );
  if (!to.length) return null;
  const offer = emptyRes();
  offer[give] = 1;
  const want = emptyRes();
  want[need] = 1;
  return { type: 'proposeTrade', give: offer, get: want, to };
}

/** Value of a set of cards to this bot given its goal. */
function cardsValue(c: Ctx, cards: ResMap, goal: Goal | null): number {
  const cost = goal ? goalCost(c, goal) : {};
  const miss = missingFor(c.res, cost);
  let v = 0;
  for (const r of RESOURCES) {
    const useful = Math.min(cards[r], miss[r]);
    v += useful * 2 + (cards[r] - useful) * 0.8;
  }
  return v;
}

function respondToTrade(c: Ctx): Action {
  const t = c.v.trade!;
  const reject: Action = { type: 'respondTrade', tradeId: t.id, response: 'reject' };
  if (!hasRes(c.res, t.get)) return reject;
  if (c.level !== 'easy' && c.v.players[t.from].victoryPoints >= (c.level === 'hard' ? 7 : 8)) return reject;
  const goal = chooseGoal(c);
  // From our side: we receive t.give, we pay t.get.
  const gain = cardsValue(c, t.give, goal);
  const after = { ...c.res };
  for (const r of RESOURCES) after[r] -= t.get[r];
  const loss = cardsValue({ ...c, res: after }, t.get, goal) + (goal && !hasRes(after, goalCost(c, goal)) && hasRes(c.res, goalCost(c, goal)) ? 3 : 0);
  if (c.level === 'easy') return c.rand() < 0.5 ? { type: 'respondTrade', tradeId: t.id, response: 'accept' } : reject;
  if (gain > loss + (c.level === 'hard' ? 0.5 : 0)) return { type: 'respondTrade', tradeId: t.id, response: 'accept' };
  // Medium/hard: counter with a 1-for-1 using our spare card for what we need.
  if (goal) {
    const miss = missingFor(c.res, goalCost(c, goal));
    const need = RESOURCES.find((r) => miss[r] > 0 && t.give[r] > 0);
    const spare = surplus(c.res, goalCost(c, goal));
    const give = RESOURCES.find((r) => r !== need && spare[r] > 0);
    if (need && give && !(c.v.trade!.counters[c.me])) {
      const g = emptyRes();
      g[give] = 1;
      const w = emptyRes();
      w[need] = 1;
      return { type: 'counterTrade', tradeId: t.id, give: g, get: w };
    }
  }
  return reject;
}

export interface BotMemory {
  /** Trade proposals made this turn (one per turn keeps bots from spamming). */
  proposedOnTurn?: number;
  /** Actions taken on the current turn, to guarantee the turn ends. */
  actionsOnTurn?: { turn: number; count: number };
}

/**
 * The next action for the bot seated at `view.me`, or null when it has
 * nothing to do right now (e.g. waiting for another player).
 */
export function chooseBotAction(view: PlayerView, level: BotDifficulty, rand: Random = Math.random, memory: BotMemory = {}): Action | null {
  const me = view.me;
  if (me === null || view.phase === 'GAME_OVER') return null;
  const res = view.players[me].resources;
  if (!res) return null;
  const c: Ctx = { v: view, me, res, level, rand, g: boardGraph(view.board), mod: modFor(view) };

  if (view.phase === 'ORDER_ROLL') {
    const group = view.orderRoll?.groups.find((g) => g.length > 1);
    return group?.includes(me) && !view.orderRoll!.rolls[me] ? { type: 'rollForOrder' } : null;
  }
  if (view.phase === 'ROBBER_DISCARD') {
    const n = view.pendingDiscards[me];
    return n === undefined ? null : discard(c, n);
  }
  if (view.trade && view.trade.from !== me && view.trade.to.includes(me) && view.trade.responses[me] === 'pending' && view.phase === 'MAIN_ACTIONS') {
    return respondToTrade(c);
  }
  if (view.currentPlayer !== me) return null;

  switch (view.phase) {
    case 'INITIAL_PLACEMENT': {
      const last = view.setup?.lastSettlement;
      return last ? setupRoad(c, last) : setupSettlement(c);
    }
    case 'PRE_ROLL':
      if (shouldPlayKnight(c) && (robberOnMe(c) || level === 'hard')) return { type: 'playKnight' };
      return { type: 'rollDice' };
    case 'ROBBER_MOVE':
      return { type: 'moveRobber', hex: robberHex(c) };
    case 'ROBBER_STEAL':
      return { type: 'steal', victim: stealVictim(c) };
    case 'MAIN_ACTIONS':
      return mainPhase(c, memory);
    default:
      return null;
  }
}

function mainPhase(c: Ctx, memory: BotMemory): Action | null {
  const { v, me } = c;
  const end: Action = { type: 'endTurn' };

  // Safety valve: never loop forever inside one turn.
  if (memory.actionsOnTurn?.turn === v.turn && memory.actionsOnTurn.count > 40) {
    if (v.freeRoads > 0) return { type: 'finishRoadBuilding' };
    if (v.trade) return { type: 'cancelTrade' };
    return end;
  }

  if (v.freeRoads > 0) {
    const road = bestRoad(c);
    return road ? { type: 'placeFreeRoad', edge: road } : { type: 'finishRoadBuilding' };
  }

  // Our own open trade offer: take an acceptable answer, else withdraw once everyone answered.
  if (v.trade && v.trade.from === me) {
    const t = v.trade;
    for (const p of t.to) {
      if (t.responses[p] === 'accepted') return { type: 'confirmTrade', tradeId: t.id, with: p };
      if (t.responses[p] === 'countered') {
        const counter = t.counters[p];
        const goal = chooseGoal(c);
        if (hasRes(c.res, counter.give) && cardsValue(c, counter.get, goal) >= cardsValue(c, counter.give, goal)) {
          return { type: 'confirmTrade', tradeId: t.id, with: p };
        }
      }
    }
    // Still waiting for answers: do nothing (the server withdraws stale offers).
    if (t.to.some((p) => t.responses[p] === 'pending')) return null;
    return { type: 'cancelTrade' };
  }

  const goal = chooseGoal(c);

  const dev = mainPhaseDev(c, goal);
  if (dev) return dev;

  // Build whatever we can afford, best first.
  const left = piecesLeft(c);
  if (left.cities > 0 && hasRes(c.res, c.mod.costs.city)) {
    const city = bestCity(c);
    if (city && (goal === 'city' || goal !== 'settlement' || !hasRes(c.res, c.mod.costs.settlement))) return { type: 'buildCity', vertex: city };
  }
  if (left.settlements > 0 && hasRes(c.res, c.mod.costs.settlement)) {
    const spot = bestSettlement(c);
    if (spot) return { type: 'buildSettlement', vertex: spot };
  }
  if (left.cities > 0 && hasRes(c.res, c.mod.costs.city)) {
    const city = bestCity(c);
    if (city) return { type: 'buildCity', vertex: city };
  }
  if (goal === 'road' && left.roads > 0 && hasRes(c.res, c.mod.costs.road)) {
    const road = bestRoad(c);
    if (road) return { type: 'buildRoad', edge: road };
  }
  // A spare road is fine when it does not eat into the settlement plan.
  if (goal === 'settlement' && left.roads > 0 && hasRes(c.res, { lumber: 2, brick: 2 }) && c.level !== 'easy') {
    const target = expansionTargets(c, 2)[0];
    if (target && legalSettlements(v, me).length < 2) return { type: 'buildRoad', edge: target.firstEdge };
  }
  if ((goal === 'devCard' || (c.level !== 'easy' && hasRes(c.res, { ...c.mod.costs.devCard, ore: 1 + (goal === 'city' ? 3 : 0) }))) && v.devDeckCount > 0 && hasRes(c.res, c.mod.costs.devCard)) {
    return { type: 'buyDevCard' };
  }
  if (c.level === 'easy' && v.devDeckCount > 0 && hasRes(c.res, c.mod.costs.devCard) && c.rand() < 0.5) return { type: 'buyDevCard' };

  if (goal) {
    const bank = bankTrade(c, goal);
    if (bank) return bank;
    const humansExist = v.players.some((p, i) => i !== me && p.kind === 'human');
    if (memory.proposedOnTurn !== v.turn && (c.level !== 'easy' || humansExist) && totalRes(c.res) >= 3) {
      const offer = proposeTrade(c, goal);
      if (offer) {
        memory.proposedOnTurn = v.turn;
        return offer;
      }
    }
  }
  return end;
}
