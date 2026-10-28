import { generateBeginnerBoard, generateRandomBoard } from './board';
import { hasShips, isModId, modFor, modPlayerRange, scenarioBoard, scenarioFor } from './mods';
import { boardGraph } from './geometry';
import {
  canPlaceShip,
  inStartRegion,
  isRoadConnected,
  isRoadEdge,
  isShipConnected,
  isShipEdge,
  legalRoads,
  legalSetupRoads,
  legalSetupShips,
  legalShips,
  longestRoadLength,
  pirateEdges,
  playersOnHex,
  satisfiesDistanceRule,
  shipMoveBlock,
  shipOwnersOnHex,
  tradeRates,
  vertexRegion,
} from './queries';
import { addRes, emptyRes, hasRes, isResource, isValidResMap, resOf, totalRes } from './resources';
import { LOG_EN, englishFormatter, formatLog, type LogKey, type LogParams } from './log';
import { Rng } from './rng';
import {
  DISCARD_THRESHOLD,
  LARGEST_ARMY_MIN,
  LONGEST_ROAD_MIN,
  TERRAIN_RESOURCE,
  rulesetFor,
  devCardReady,
} from './rulesets';
import {
  RESOURCES,
  type Action,
  type ActionResult,
  type DevCardType,
  type GameConfig,
  type GameState,
  type LogEntry,
  type PlayerSetup,
  type PlayerState,
  type ResMap,
  type Resource,
} from './types';

export class GameError extends Error {}

type Secret = { to: number[]; key: LogKey; params: LogParams };

function makeLog(names: string[], key: LogKey, params: LogParams, secret?: Secret): LogEntry {
  const f = englishFormatter(names);
  return {
    msg: formatLog(LOG_EN[key], params, f),
    key,
    params,
    secret: secret && { ...secret, msg: formatLog(LOG_EN[secret.key], secret.params, f) },
  };
}

function say(state: GameState, key: LogKey, params: LogParams = {}, secret?: Secret): void {
  const entry = makeLog(state.players.map((p) => p.name), key, params, secret);
  state.logSeq = (state.logSeq ?? state.log.length) + 1;
  entry.seq = state.logSeq;
  state.log.push(entry);
}

function fail(msg: string): never {
  throw new GameError(msg);
}

/** Game state is plain JSON, so a JSON round-trip is a safe deep copy. */
export const cloneState = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createGame(
  players: PlayerSetup[],
  seed: number,
  config: Partial<GameConfig> = {},
): GameState {
  if (config.mod !== undefined && !isModId(config.mod)) throw new GameError('Unknown mod');
  const range = modPlayerRange(modFor({ config, players: [] }));
  if (players.length < range.min || players.length > range.max) {
    throw new GameError(`A game needs ${range.min}-${range.max} participants`);
  }
  const mod = modFor({ config, players });
  let scenarioId: string | undefined;
  if (mod.scenarios) {
    scenarioId = config.scenario ?? mod.defaultScenario;
    if (!scenarioId || !Object.prototype.hasOwnProperty.call(mod.scenarios, scenarioId)) throw new GameError('Unknown scenario');
  }
  const scenario = scenarioId ? mod.scenarios![scenarioId] : null;
  const fullConfig: GameConfig = scenario
    ? { boardType: 'beginner', ...config, victoryTarget: scenario.victoryTarget, scenario: scenario.id, mod: mod.id, modVersion: mod.version }
    : { victoryTarget: 10, boardType: 'random', ...config, mod: mod.id, modVersion: mod.version };
  const rng = new Rng(seed);
  const board = scenario
    ? scenarioBoard(scenario, players.length)
    : fullConfig.boardType === 'beginner'
      ? generateBeginnerBoard(mod)
      : generateRandomBoard(rng, mod);
  const ships = hasShips(mod);

  const deck: DevCardType[] = [];
  (Object.keys(mod.devDeck) as DevCardType[]).forEach((t) => {
    for (let i = 0; i < mod.devDeck[t]; i++) deck.push(t);
  });

  const ruleset = rulesetFor(players.length);
  const bank = emptyRes();
  for (const r of RESOURCES) bank[r] = mod.bankPerResource;

  const state: GameState = {
    config: fullConfig,
    ruleset: ruleset.id,
    board,
    buildings: {},
    roads: {},
    ...(ships ? { ships: {} } : {}),
    players: players.map(
      (p, i): PlayerState => ({
        ...p,
        color: mod.colors[i],
        resources: emptyRes(),
        devCards: [],
        knightsPlayed: 0,
        roadsBuilt: 0,
        settlementsBuilt: 0,
        citiesBuilt: 0,
        playedDevThisTurn: false,
        ...(ships ? { shipsBuilt: 0, vpTokens: 0, bonusRegions: [] } : {}),
      }),
    ),
    bank,
    devDeck: rng.shuffle(deck),
    turn: 0,
    currentPlayer: 0,
    phase: 'ORDER_ROLL',
    turnOrder: players.map((_, i) => i),
    orderRoll: { groups: [players.map((_, i) => i)], rolls: {}, history: [] },
    setup: null,
    hasRolled: false,
    lastRoll: null,
    pendingDiscards: {},
    robberReturnPhase: 'MAIN_ACTIONS',
    stealCandidates: [],
    ...(ships ? { pendingGold: {}, shipMoved: false, newShips: [] } : {}),
    freeRoads: 0,
    trade: null,
    paired: null,
    nextTradeId: 1,
    longestRoad: { holder: null, lengths: players.map(() => 0) },
    largestArmy: null,
    winner: null,
    log: [{ ...makeLog(players.map((p) => p.name), 'start', {}), seq: 1 }],
    logSeq: 1,
    rng: rng.seed,
  };
  return state;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function publicVictoryPoints(state: GameState, player: number): number {
  const p = state.players[player];
  let vp = p.settlementsBuilt - p.citiesBuilt + p.citiesBuilt * 2 + (p.vpTokens ?? 0);
  if (state.longestRoad.holder === player) vp += 2;
  if (state.largestArmy === player) vp += 2;
  return vp;
}

export function victoryPoints(state: GameState, player: number): number {
  const hidden = state.players[player].devCards.filter((c) => c.type === 'victoryPoint').length;
  return publicVictoryPoints(state, player) + hidden;
}

function updateLongestRoad(state: GameState): void {
  const lengths = state.players.map((_, i) => longestRoadLength(state, i));
  const previous = state.longestRoad.holder;
  const max = Math.max(...lengths);
  let holder: number | null;
  if (max < LONGEST_ROAD_MIN) {
    holder = null;
  } else {
    const leaders = lengths.map((l, i) => (l === max ? i : -1)).filter((i) => i >= 0);
    if (previous !== null && leaders.includes(previous)) holder = previous;
    else if (leaders.length === 1) holder = leaders[0];
    else holder = null; // tie among non-holders after a broken road: nobody holds it
  }
  if (holder !== previous) {
    if (holder === null) say(state, 'longestRoadLost');
    else say(state, 'longestRoad', { p: holder, n: lengths[holder] });
  }
  state.longestRoad = { holder, lengths };
}

function updateLargestArmy(state: GameState, player: number): void {
  const knights = state.players[player].knightsPlayed;
  if (knights < LARGEST_ARMY_MIN || state.largestArmy === player) return;
  const holder = state.largestArmy;
  if (holder === null || knights > state.players[holder].knightsPlayed) {
    state.largestArmy = player;
    say(state, 'largestArmy', { p: player, n: knights });
  }
}

function checkVictory(state: GameState): void {
  if (state.phase === 'ORDER_ROLL' || state.phase === 'INITIAL_PLACEMENT' || state.winner !== null) return;
  const p = state.currentPlayer;
  if (victoryPoints(state, p) >= state.config.victoryTarget) {
    state.winner = p;
    state.phase = 'GAME_OVER';
    state.trade = null;
    say(state, 'win', { p, n: victoryPoints(state, p) });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pay(state: GameState, player: number, cost: Partial<ResMap>, what: string): void {
  const p = state.players[player];
  if (!hasRes(p.resources, cost)) fail(`Not enough resources for ${what}`);
  addRes(p.resources, cost, -1);
  addRes(state.bank, cost, 1);
}

function requirePhase(state: GameState, ...phases: GameState['phase'][]): void {
  if (!phases.includes(state.phase)) fail(`Not allowed during ${state.phase}`);
}

function requireActive(state: GameState, player: number): void {
  if (player !== state.currentPlayer) fail('It is not your turn');
}

function requireNoFreeRoads(state: GameState): void {
  if (state.freeRoads > 0) fail('Finish placing your free roads first');
}

function placeRoad(state: GameState, player: number, edge: string): void {
  if (!boardGraph(state.board).edges[edge]) fail('Unknown edge');
  if (state.roads[edge] !== undefined) fail('That edge already has a road');
  if (state.ships?.[edge] !== undefined) fail('That edge already has a ship');
  if (!isRoadEdge(state, edge)) fail('Roads must be built next to land');
  if (state.players[player].roadsBuilt >= modFor(state).pieceLimits.roads) fail('No roads left');
  if (!isRoadConnected(state, player, edge)) fail('Road must connect to your network');
  state.roads[edge] = player;
  state.players[player].roadsBuilt++;
}

/** Seafarers: puts a ship on `edge` after checking every placement rule. */
function placeShip(state: GameState, player: number, edge: string): void {
  const mod = modFor(state);
  if (!hasShips(mod)) fail('This game has no ships');
  if (!boardGraph(state.board).edges[edge]) fail('Unknown edge');
  if (state.roads[edge] !== undefined) fail('That edge already has a road');
  if (state.ships?.[edge] !== undefined) fail('That edge already has a ship');
  if (!isShipEdge(state, edge)) fail('Ships must be placed next to the sea');
  if (pirateEdges(state).includes(edge)) fail('No ship may be placed next to the pirate');
  if ((state.players[player].shipsBuilt ?? 0) >= (mod.pieceLimits.ships ?? 0)) fail('No ships left');
  if (!isShipConnected(state, player, edge)) fail('Ship must connect to your ship or building');
  state.ships = { ...(state.ships ?? {}), [edge]: player };
  state.players[player].shipsBuilt = (state.players[player].shipsBuilt ?? 0) + 1;
}

/** Can the player place any free road or ship (Road Building)? */
function canPlaceFreePiece(state: GameState, player: number): boolean {
  const mod = modFor(state);
  const me = state.players[player];
  if (me.roadsBuilt < mod.pieceLimits.roads && legalRoads(state, player).length > 0) return true;
  return hasShips(mod) && (me.shipsBuilt ?? 0) < (mod.pieceLimits.ships ?? 0) && legalShips(state, player).length > 0;
}

/** Scenario bonus: VP tokens for a player's first settlement in a region other than their home. */
function awardRegionBonus(state: GameState, player: number, vertex: string): void {
  const scenario = scenarioFor(state);
  if (!scenario?.regionBonus) return;
  const region = vertexRegion(state, vertex);
  const me = state.players[player];
  if (!region || (scenario.homeRegions ?? []).includes(region) || (me.bonusRegions ?? []).includes(region)) return;
  me.bonusRegions = [...(me.bonusRegions ?? []), region];
  me.vpTokens = (me.vpTokens ?? 0) + scenario.regionBonus;
  say(state, 'regionBonus', { p: player, n: scenario.regionBonus });
}

/**
 * Gold fields: players still owed resources of their choice. Players drop out
 * when the bank is empty (they may only take what the bank still has).
 */
function settleGold(state: GameState): void {
  const pending = state.pendingGold ?? {};
  if (totalRes(state.bank) === 0) {
    for (const p of Object.keys(pending)) delete pending[Number(p)];
  }
  state.pendingGold = pending;
  if (Object.keys(pending).length === 0) {
    state.phase = state.goldReturnPhase ?? 'MAIN_ACTIONS';
    delete state.goldReturnPhase;
  } else {
    state.phase = 'GOLD_CHOICE';
  }
}

function produce(state: GameState, roll: number): { producing: number[]; gains: ResMap[] } {
  const producing = state.board.hexes
    .filter((h) => h.number === roll && h.id !== state.board.robberHex)
    .map((h) => h.id);
  const entitled = state.players.map(() => emptyRes());
  for (const hexId of producing) {
    const resource = TERRAIN_RESOURCE[state.board.hexes[hexId].terrain];
    if (!resource) continue;
    for (const v of boardGraph(state.board).hexes[hexId].vertices) {
      const b = state.buildings[v];
      if (b) entitled[b.owner][resource] += b.type === 'city' ? 2 : 1;
    }
  }
  const gains = state.players.map(() => emptyRes());
  for (const r of RESOURCES) {
    const claimants = entitled.map((e, i) => (e[r] > 0 ? i : -1)).filter((i) => i >= 0);
    const total = claimants.reduce((s, i) => s + entitled[i][r], 0);
    if (total === 0) continue;
    if (total <= state.bank[r]) {
      for (const i of claimants) gains[i][r] = entitled[i][r];
    } else if (claimants.length === 1) {
      gains[claimants[0]][r] = state.bank[r];
    } // several claimants and not enough: nobody receives this resource
  }
  gains.forEach((g, i) => {
    addRes(state.players[i].resources, g, 1);
    addRes(state.bank, g, -1);
  });
  // Gold fields: 1 resource of choice per settlement, 2 per city, chosen after normal production.
  const gold: Record<number, number> = {};
  for (const hexId of producing) {
    if (state.board.hexes[hexId].terrain !== 'gold') continue;
    for (const v of boardGraph(state.board).hexes[hexId].vertices) {
      const b = state.buildings[v];
      if (b) gold[b.owner] = (gold[b.owner] ?? 0) + (b.type === 'city' ? 2 : 1);
    }
  }
  if (Object.keys(gold).length > 0) state.pendingGold = gold;
  return { producing, gains };
}


/** Robber or pirate placed: steal automatically from a single candidate, else let the player choose. */
function afterRobberMove(state: GameState, rng: Rng, player: number, owners: number[]): void {
  const candidates = owners.filter((p) => p !== player && totalRes(state.players[p].resources) > 0);
  if (candidates.length === 0) {
    finishRobber(state);
  } else if (candidates.length === 1) {
    stealFrom(state, rng, player, candidates[0]);
    finishRobber(state);
  } else {
    state.stealCandidates = candidates;
    state.phase = 'ROBBER_STEAL';
  }
}

function finishRobber(state: GameState): void {
  state.stealCandidates = [];
  state.phase = state.robberReturnPhase;
}

function stealFrom(state: GameState, rng: Rng, thief: number, victim: number): void {
  const v = state.players[victim];
  const pool: Resource[] = [];
  for (const r of RESOURCES) for (let i = 0; i < v.resources[r]; i++) pool.push(r);
  if (pool.length === 0) {
    say(state, 'stealNothing', { p: thief, q: victim });
    return;
  }
  const r = pool[rng.int(pool.length)];
  v.resources[r]--;
  state.players[thief].resources[r]++;
  say(state, 'steal', { p: thief, q: victim }, { to: [thief, victim], key: 'stealSecret', params: { p: thief, q: victim, r } });
}

export function nextInTurnOrder(state: GameState, player: number): number {
  const idx = state.turnOrder.indexOf(player);
  return state.turnOrder[(idx + 1) % state.turnOrder.length];
}

/** The tied group that must roll next in the opening roll, or null when the order is decided. */
export function orderRollGroup(state: GameState): number[] | null {
  return state.orderRoll?.groups.find((g) => g.length > 1) ?? null;
}

function resolveOrderRound(state: GameState): void {
  const order = state.orderRoll!;
  const group = orderRollGroup(state)!;
  if (!group.every((p) => order.rolls[p])) return;
  const sum = (p: number) => order.rolls[p][0] + order.rolls[p][1];
  // Split the tied group by this round's rolls, highest first; equal rolls stay tied.
  const sorted = [...group].sort((a, b) => sum(b) - sum(a));
  const split: number[][] = [];
  for (const p of sorted) {
    const last = split[split.length - 1];
    if (last && sum(last[0]) === sum(p)) last.push(p);
    else split.push([p]);
  }
  const idx = order.groups.indexOf(group);
  order.groups.splice(idx, 1, ...split);
  order.rolls = {};
  const stillTied = split.filter((g) => g.length > 1);
  for (const g of stillTied) {
    say(state, 'orderTie', { players: g });
  }
  if (orderRollGroup(state)) return;

  state.turnOrder = order.groups.flat();
  state.phase = 'INITIAL_PLACEMENT';
  state.setup = { order: rulesetFor(state.players.length).setupOrder(state.turnOrder), step: 0, lastSettlement: null };
  state.currentPlayer = state.turnOrder[0];
  say(state, 'orderDone', { order: state.turnOrder, p: state.turnOrder[0] });
}

function startTurn(state: GameState, player: number): void {
  state.currentPlayer = player;
  state.turn++;
  state.phase = 'PRE_ROLL';
  state.hasRolled = false;
  state.freeRoads = 0;
  state.trade = null;
  for (const p of state.players) p.playedDevThisTurn = false;
  resetShipTurn(state);
  checkVictory(state);
}

/** Seafarers: a new turn may move a ship again, and no ship counts as built this turn. */
function resetShipTurn(state: GameState): void {
  if (state.ships === undefined) return;
  state.shipMoved = false;
  state.newShips = [];
}

/**
 * 5–6 players: Player 1's turn is followed by an Action phase of Player 2,
 * the third player after them. Player 2 builds, trades with the bank and may
 * play one development card, without rolling and without player trades.
 */
function startPairedPhase(state: GameState, first: number): void {
  const idx = state.turnOrder.indexOf(first);
  const second = state.turnOrder[(idx + 3) % state.turnOrder.length];
  state.paired = { first };
  state.currentPlayer = second;
  state.turn++;
  state.phase = 'MAIN_ACTIONS';
  state.freeRoads = 0;
  state.trade = null;
  state.players[second].playedDevThisTurn = false;
  resetShipTurn(state);
  say(state, 'pairedTurn', { p: second });
  checkVictory(state);
}

function requireNotPaired(state: GameState): void {
  if (state.paired) fail('Player 2 may not trade with other players');
}

function playableCard(state: GameState, player: number, type: DevCardType): number {
  const p = state.players[player];
  if (p.playedDevThisTurn) fail('You already played a development card this turn');
  const idx = p.devCards.findIndex((c) => c.type === type && devCardReady(state, c));
  if (idx < 0) {
    fail(p.devCards.some((c) => c.type === type) ? 'Cards cannot be played on the turn they were bought' : 'You do not have that card');
  }
  return idx;
}

function useCard(state: GameState, player: number, idx: number): void {
  const p = state.players[player];
  p.devCards.splice(idx, 1);
  p.playedDevThisTurn = true;
}

function validateTradeSides(give: unknown, get: unknown): void {
  if (!isValidResMap(give) || !isValidResMap(get)) fail('Invalid trade');
  if (totalRes(give as ResMap) === 0 || totalRes(get as ResMap) === 0) {
    fail('Both sides of a trade must include at least one card');
  }
  // Rulebook: trading matching resources (e.g. 3 ore for 1 ore) is giving cards away.
  if (RESOURCES.some((r) => (give as ResMap)[r] > 0 && (get as ResMap)[r] > 0)) {
    fail('You cannot trade a resource for the same resource');
  }
}

function executePlayerTrade(state: GameState, from: number, to: number, give: ResMap, get: ResMap): void {
  if (!hasRes(state.players[from].resources, give)) fail(`${state.players[from].name} no longer has those resources`);
  if (!hasRes(state.players[to].resources, get)) fail(`${state.players[to].name} no longer has those resources`);
  addRes(state.players[from].resources, give, -1);
  addRes(state.players[to].resources, give, 1);
  addRes(state.players[to].resources, get, -1);
  addRes(state.players[from].resources, get, 1);
  state.trade = null;
  say(state, 'traded', { p: from, q: to, give, get });
}

// ---------------------------------------------------------------------------
// Action application
// ---------------------------------------------------------------------------

/**
 * Applies an action for `player`. Pure: the input state is never modified,
 * and a failed action returns an error without any partial changes.
 */
export function applyAction(state: GameState, player: number, action: Action): ActionResult {
  try {
    const next = cloneState(state);
    const rng = new Rng(next.rng);
    reduce(next, rng, player, action);
    next.rng = rng.seed;
    if (next.log.length > 200) next.log = next.log.slice(-200);
    return { ok: true, state: next };
  } catch (err) {
    if (err instanceof GameError) return { ok: false, error: err.message };
    throw err;
  }
}

function reduce(state: GameState, rng: Rng, player: number, action: Action): void {
  if (!action || typeof action !== 'object') fail('Invalid action');
  if (!Number.isInteger(player) || player < 0 || player >= state.players.length) fail('Unknown player');
  if (state.phase === 'GAME_OVER') fail('The game is over');
  const me = state.players[player];
  const mod = modFor(state);
  const G = boardGraph(state.board);

  switch (action.type) {
    case 'rollForOrder': {
      requirePhase(state, 'ORDER_ROLL');
      const group = orderRollGroup(state);
      if (!group || !group.includes(player)) fail('You do not need to roll now');
      if (state.orderRoll!.rolls[player]) fail('You already rolled');
      const dice: [number, number] = [rng.int(6) + 1, rng.int(6) + 1];
      state.orderRoll!.rolls[player] = dice;
      state.orderRoll!.history.push({ player, dice });
      say(state, 'orderRolled', { p: player, n: dice[0] + dice[1] });
      resolveOrderRound(state);
      return;
    }

    case 'placeSetupSettlement': {
      requirePhase(state, 'INITIAL_PLACEMENT');
      requireActive(state, player);
      const setup = state.setup!;
      if (setup.lastSettlement) fail('Place your road first');
      if (!satisfiesDistanceRule(state, action.vertex)) fail('Settlement must be on an empty spot at least two roads from others');
      if (!inStartRegion(state, action.vertex)) fail('Starting settlements must be placed on the main island');
      state.buildings[action.vertex] = { owner: player, type: 'settlement' };
      me.settlementsBuilt++;
      setup.lastSettlement = action.vertex;
      const isSecond = setup.step >= state.players.length;
      let gold = 0;
      if (isSecond || state.config.startResBothSettlements) {
        const gained = emptyRes();
        for (const h of G.vertices[action.vertex].hexes) {
          const r = TERRAIN_RESOURCE[state.board.hexes[h].terrain];
          if (r && state.bank[r] > 0) gained[r]++;
          if (state.board.hexes[h].terrain === 'gold') gold++;
        }
        addRes(me.resources, gained, 1);
        addRes(state.bank, gained, -1);
        say(state, 'setupSettlementRes', { p: player, res: gained });
      } else {
        say(state, 'setupSettlement', { p: player });
      }
      awardRegionBonus(state, player, action.vertex);
      if (gold > 0) {
        // A gold field next to the settlement: 1 resource of choice each, chosen before the road.
        state.pendingGold = { [player]: gold };
        state.goldReturnPhase = 'INITIAL_PLACEMENT';
        settleGold(state);
        if (state.phase === 'GOLD_CHOICE') say(state, 'goldOwed', { p: player, n: gold });
      }
      return;
    }

    case 'placeSetupRoad': {
      requirePhase(state, 'INITIAL_PLACEMENT');
      requireActive(state, player);
      const setup = state.setup!;
      if (!setup.lastSettlement) fail('Place your settlement first');
      if (action.ship) {
        if (!hasShips(mod)) fail('This game has no ships');
        if (!legalSetupShips(state, setup.lastSettlement).includes(action.edge)) {
          fail('The ship must touch the settlement you just placed, on a sea edge');
        }
        state.ships = { ...(state.ships ?? {}), [action.edge]: player };
        me.shipsBuilt = (me.shipsBuilt ?? 0) + 1;
      } else {
        if (!legalSetupRoads(state, setup.lastSettlement).includes(action.edge)) {
          fail('The road must touch the settlement you just placed');
        }
        state.roads[action.edge] = player;
        me.roadsBuilt++;
      }
      setup.lastSettlement = null;
      setup.step++;
      if (setup.step >= setup.order.length) {
        state.setup = null;
        say(state, 'setupDone');
        updateLongestRoad(state);
        startTurn(state, state.turnOrder[0]);
      } else {
        state.currentPlayer = setup.order[setup.step];
      }
      return;
    }

    case 'rollDice': {
      requirePhase(state, 'PRE_ROLL');
      requireActive(state, player);
      requireNoFreeRoads(state);
      const dice: [number, number] = [rng.int(6) + 1, rng.int(6) + 1];
      const sum = dice[0] + dice[1];
      state.hasRolled = true;
      const rollId = (state.lastRoll?.id ?? 0) + 1;
      say(state, 'rolled', { p: player, n: sum });
      if (sum === 7) {
        state.lastRoll = { id: rollId, dice, player, producingHexes: [], gains: state.players.map(() => emptyRes()) };
        state.pendingDiscards = {};
        state.players.forEach((p, i) => {
          const n = totalRes(p.resources);
          if (n > DISCARD_THRESHOLD) state.pendingDiscards[i] = Math.floor(n / 2);
        });
        state.robberReturnPhase = 'MAIN_ACTIONS';
        state.phase = Object.keys(state.pendingDiscards).length > 0 ? 'ROBBER_DISCARD' : 'ROBBER_MOVE';
      } else {
        const { producing, gains } = produce(state, sum);
        state.lastRoll = { id: rollId, dice, player, producingHexes: producing, gains };
        gains.forEach((g, i) => {
          if (totalRes(g) > 0) say(state, 'received', { p: i, res: g });
        });
        state.phase = 'MAIN_ACTIONS';
        if (state.pendingGold && Object.keys(state.pendingGold).length > 0) {
          state.goldReturnPhase = 'MAIN_ACTIONS';
          settleGold(state);
          for (const [p, n] of Object.entries(state.pendingGold)) say(state, 'goldOwed', { p: Number(p), n });
        }
      }
      return;
    }

    case 'chooseGold': {
      requirePhase(state, 'GOLD_CHOICE');
      const owed = state.pendingGold?.[player];
      if (owed === undefined) fail('You have no gold to choose');
      if (!isValidResMap(action.resources)) fail('Invalid choice');
      // When the bank runs short, a player may only take what is left.
      const required = Math.min(owed!, totalRes(state.bank));
      if (totalRes(action.resources) !== required) fail(`Choose exactly ${required} resources`);
      if (!hasRes(state.bank, action.resources)) fail('The bank does not have those resources');
      addRes(state.bank, action.resources, -1);
      addRes(me.resources, action.resources, 1);
      if (state.goldReturnPhase === 'MAIN_ACTIONS' && state.lastRoll) addRes(state.lastRoll.gains[player], action.resources, 1);
      delete state.pendingGold![player];
      say(state, 'goldChosen', { p: player, res: resOf(action.resources) });
      settleGold(state);
      return;
    }

    case 'discard': {
      requirePhase(state, 'ROBBER_DISCARD');
      const required = state.pendingDiscards[player];
      if (required === undefined) fail('You do not need to discard');
      if (!isValidResMap(action.resources)) fail('Invalid discard');
      if (totalRes(action.resources) !== required) fail(`You must discard exactly ${required} cards`);
      if (!hasRes(me.resources, action.resources)) fail('You do not have those cards');
      addRes(me.resources, action.resources, -1);
      addRes(state.bank, action.resources, 1);
      delete state.pendingDiscards[player];
      say(state, 'discarded', { p: player, n: required });
      if (Object.keys(state.pendingDiscards).length === 0) state.phase = 'ROBBER_MOVE';
      return;
    }

    case 'moveRobber': {
      requirePhase(state, 'ROBBER_MOVE');
      requireActive(state, player);
      if (!Number.isInteger(action.hex) || !state.board.hexes[action.hex]) fail('Unknown hex');
      if (action.hex === state.board.robberHex) fail('The robber must move to a different hex');
      if (state.board.hexes[action.hex].terrain === 'sea') fail('The robber must stay on land');
      state.board.robberHex = action.hex;
      say(state, 'robberMoved', { p: player });
      afterRobberMove(state, rng, player, playersOnHex(state, action.hex));
      return;
    }

    case 'movePirate': {
      requirePhase(state, 'ROBBER_MOVE');
      requireActive(state, player);
      if (state.board.pirateHex === undefined) fail('There is no pirate in this game');
      if (!Number.isInteger(action.hex) || !state.board.hexes[action.hex]) fail('Unknown hex');
      if (state.board.hexes[action.hex].terrain !== 'sea') fail('The pirate must move to a sea hex');
      if (action.hex === state.board.pirateHex) fail('The pirate must move to a different hex');
      state.board.pirateHex = action.hex;
      say(state, 'pirateMoved', { p: player });
      afterRobberMove(state, rng, player, shipOwnersOnHex(state, action.hex));
      return;
    }

    case 'steal': {
      requirePhase(state, 'ROBBER_STEAL');
      requireActive(state, player);
      if (!state.stealCandidates.includes(action.victim)) fail('You cannot steal from that player');
      stealFrom(state, rng, player, action.victim);
      finishRobber(state);
      return;
    }

    case 'buildRoad': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      if (me.roadsBuilt >= mod.pieceLimits.roads) fail('No roads left');
      if (!hasRes(me.resources, mod.costs.road)) fail('Not enough resources for a road');
      placeRoad(state, player, action.edge);
      pay(state, player, mod.costs.road, 'a road');
      say(state, 'builtRoad', { p: player });
      updateLongestRoad(state);
      checkVictory(state);
      return;
    }

    case 'buildShip': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      if (!hasShips(mod)) fail('This game has no ships');
      if ((me.shipsBuilt ?? 0) >= (mod.pieceLimits.ships ?? 0)) fail('No ships left');
      if (!hasRes(me.resources, mod.costs.ship!)) fail('Not enough resources for a ship');
      placeShip(state, player, action.edge);
      pay(state, player, mod.costs.ship!, 'a ship');
      state.newShips = [...(state.newShips ?? []), action.edge];
      say(state, 'builtShip', { p: player });
      updateLongestRoad(state);
      checkVictory(state);
      return;
    }

    case 'moveShip': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      if (!hasShips(mod)) fail('This game has no ships');
      if (state.shipMoved) fail('You already moved a ship this turn');
      const block = shipMoveBlock(state, player, action.from);
      if (block) fail(block);
      if (action.to === action.from) fail('Move the ship to a different edge');
      // Lift the ship (it returns to the supply), then place it under the normal rules.
      const lifted = { ...state.ships };
      delete lifted[action.from];
      state.ships = lifted;
      me.shipsBuilt = (me.shipsBuilt ?? 1) - 1;
      placeShip(state, player, action.to);
      state.shipMoved = true;
      say(state, 'movedShip', { p: player });
      updateLongestRoad(state);
      checkVictory(state);
      return;
    }

    case 'buildSettlement': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      if (me.settlementsBuilt - me.citiesBuilt >= mod.pieceLimits.settlements) fail('No settlements left');
      if (!G.vertices[action.vertex]) fail('Unknown spot');
      if (!satisfiesDistanceRule(state, action.vertex)) fail('Settlement must be on an empty spot at least two roads from others');
      if (!G.vertices[action.vertex].edges.some((e) => state.roads[e] === player || state.ships?.[e] === player)) {
        fail(hasShips(mod) ? 'Settlement must connect to one of your roads or ships' : 'Settlement must connect to one of your roads');
      }
      pay(state, player, mod.costs.settlement, 'a settlement');
      state.buildings[action.vertex] = { owner: player, type: 'settlement' };
      me.settlementsBuilt++;
      say(state, 'builtSettlement', { p: player });
      awardRegionBonus(state, player, action.vertex);
      updateLongestRoad(state); // may break an opponent's road
      checkVictory(state);
      return;
    }

    case 'buildCity': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      const b = state.buildings[action.vertex];
      if (!b || b.type !== 'settlement' || b.owner !== player) fail('A city must replace one of your settlements');
      if (me.citiesBuilt >= mod.pieceLimits.cities) fail('No cities left');
      pay(state, player, mod.costs.city, 'a city');
      state.buildings[action.vertex] = { owner: player, type: 'city' };
      me.citiesBuilt++;
      say(state, 'builtCity', { p: player });
      checkVictory(state);
      return;
    }

    case 'buyDevCard': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      if (state.devDeck.length === 0) fail('The development deck is empty');
      pay(state, player, mod.costs.devCard, 'a development card');
      const card = state.devDeck.shift()!;
      me.devCards.push({ type: card, boughtTurn: state.turn });
      say(state, 'boughtDev', { p: player });
      checkVictory(state);
      return;
    }

    case 'playKnight': {
      requirePhase(state, 'PRE_ROLL', 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      const idx = playableCard(state, player, 'knight');
      useCard(state, player, idx);
      me.knightsPlayed++;
      state.robberReturnPhase = state.phase === 'PRE_ROLL' ? 'PRE_ROLL' : 'MAIN_ACTIONS';
      state.trade = null;
      state.phase = 'ROBBER_MOVE';
      say(state, 'playedKnight', { p: player });
      updateLargestArmy(state, player);
      checkVictory(state);
      return;
    }

    case 'playRoadBuilding': {
      requirePhase(state, 'PRE_ROLL', 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      const idx = playableCard(state, player, 'roadBuilding');
      useCard(state, player, idx);
      if (hasShips(mod)) {
        // Seafarers: 2 roads, 2 ships, or 1 of each.
        const left = mod.pieceLimits.roads - me.roadsBuilt + (mod.pieceLimits.ships ?? 0) - (me.shipsBuilt ?? 0);
        state.freeRoads = canPlaceFreePiece(state, player) ? Math.min(2, left) : 0;
      } else {
        state.freeRoads = Math.min(2, mod.pieceLimits.roads - me.roadsBuilt);
        if (legalRoads(state, player).length === 0) state.freeRoads = 0;
      }
      say(state, 'playedRoadBuilding', { p: player });
      return;
    }

    case 'placeFreeRoad': {
      requireActive(state, player);
      if (state.freeRoads <= 0) fail('You have no free roads to place');
      if (action.ship) {
        placeShip(state, player, action.edge);
        state.newShips = [...(state.newShips ?? []), action.edge];
      } else {
        placeRoad(state, player, action.edge);
      }
      state.freeRoads--;
      if (hasShips(mod)) {
        if (state.freeRoads > 0 && !canPlaceFreePiece(state, player)) state.freeRoads = 0;
      } else if (state.freeRoads > 0 && legalRoads(state, player).length === 0) state.freeRoads = 0;
      say(state, action.ship ? 'placedFreeShip' : 'placedFreeRoad', { p: player });
      updateLongestRoad(state);
      checkVictory(state);
      return;
    }

    case 'finishRoadBuilding': {
      requireActive(state, player);
      if (state.freeRoads <= 0) fail('You are not placing free roads');
      state.freeRoads = 0;
      return;
    }

    case 'playYearOfPlenty': {
      requirePhase(state, 'PRE_ROLL', 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      const picks = action.resources;
      if (!Array.isArray(picks) || picks.length !== 2 || !picks.every(isResource)) fail('Choose two resources');
      const want = emptyRes();
      for (const r of picks) want[r]++;
      if (!hasRes(state.bank, want)) fail('The bank does not have those resources');
      const idx = playableCard(state, player, 'yearOfPlenty');
      useCard(state, player, idx);
      addRes(state.bank, want, -1);
      addRes(me.resources, want, 1);
      say(state, 'playedYearOfPlenty', { p: player, res: want });
      return;
    }

    case 'playMonopoly': {
      requirePhase(state, 'PRE_ROLL', 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      if (!isResource(action.resource)) fail('Choose a resource');
      const idx = playableCard(state, player, 'monopoly');
      useCard(state, player, idx);
      let taken = 0;
      state.players.forEach((p, i) => {
        if (i === player) return;
        taken += p.resources[action.resource];
        p.resources[action.resource] = 0;
      });
      me.resources[action.resource] += taken;
      state.trade = null;
      say(state, 'playedMonopoly', { p: player, r: action.resource, n: taken });
      return;
    }

    case 'bankTrade': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      if (!isResource(action.give) || !isResource(action.get)) fail('Choose resources');
      if (action.give === action.get) fail('Choose two different resources');
      const rate = tradeRates(state, player)[action.give];
      if (state.bank[action.get] < 1) fail(`The bank has no ${action.get} left`);
      pay(state, player, { [action.give]: rate }, 'this trade');
      state.bank[action.get]--;
      me.resources[action.get]++;
      say(state, 'bankTrade', { p: player, n: rate, r: action.give, r2: action.get });
      return;
    }

    case 'proposeTrade': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNotPaired(state);
      requireNoFreeRoads(state);
      validateTradeSides(action.give, action.get);
      if (!hasRes(me.resources, action.give)) fail('You do not have the resources you are offering');
      const to = Array.isArray(action.to) ? [...new Set(action.to)] : [];
      if (to.length === 0 || to.some((t) => !Number.isInteger(t) || t === player || !state.players[t])) {
        fail('Choose who to trade with');
      }
      state.trade = {
        id: state.nextTradeId++,
        from: player,
        give: resOf(action.give),
        get: resOf(action.get),
        to,
        responses: Object.fromEntries(to.map((t) => [t, 'pending' as const])),
        counters: {},
      };
      say(state, 'offer', { p: player, give: resOf(action.give), get: resOf(action.get) });
      return;
    }

    case 'respondTrade': {
      requireNotPaired(state);
      const t = state.trade;
      if (!t || t.id !== action.tradeId) fail('That trade offer is no longer available');
      if (!t!.to.includes(player)) fail('That offer was not sent to you');
      if (action.response === 'reject') {
        t!.responses[player] = 'rejected';
        delete t!.counters[player];
        say(state, 'declined', { p: player });
        return;
      }
      if (action.response !== 'accept') fail('Invalid response');
      if (!hasRes(me.resources, t!.get)) fail('You do not have the requested resources');
      if (t!.to.length === 1) {
        executePlayerTrade(state, t!.from, player, t!.give, t!.get);
      } else {
        t!.responses[player] = 'accepted';
        delete t!.counters[player];
        say(state, 'accepts', { p: player });
      }
      return;
    }

    case 'counterTrade': {
      requireNotPaired(state);
      const t = state.trade;
      if (!t || t.id !== action.tradeId) fail('That trade offer is no longer available');
      if (!t!.to.includes(player)) fail('That offer was not sent to you');
      validateTradeSides(action.give, action.get);
      if (!hasRes(me.resources, action.give)) fail('You do not have the resources you are offering');
      // Stored from the proposer's point of view.
      t!.counters[player] = { give: resOf(action.get), get: resOf(action.give) };
      t!.responses[player] = 'countered';
      say(state, 'counters', { p: player, give: resOf(action.give), get: resOf(action.get) });
      return;
    }

    case 'confirmTrade': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNotPaired(state);
      const t = state.trade;
      if (!t || t.id !== action.tradeId) fail('That trade offer is no longer available');
      const response = t!.responses[action.with];
      if (response === 'accepted') {
        executePlayerTrade(state, player, action.with, t!.give, t!.get);
      } else if (response === 'countered') {
        const c = t!.counters[action.with];
        executePlayerTrade(state, player, action.with, c.give, c.get);
      } else {
        fail('That player has not accepted the trade');
      }
      return;
    }

    case 'cancelTrade': {
      requireActive(state, player);
      if (!state.trade) fail('There is no trade to cancel');
      state.trade = null;
      say(state, 'withdrew', { p: player });
      return;
    }

    case 'endTurn': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      if (state.paired) {
        // Player 2 is done: the dice pass to the player after Player 1.
        const first = state.paired.first;
        state.paired = null;
        startTurn(state, nextInTurnOrder(state, first));
      } else if (mod.pairedPlayers) {
        startPairedPhase(state, player);
      } else {
        startTurn(state, nextInTurnOrder(state, player));
      }
      return;
    }

    default:
      fail('Unknown action');
  }
}
