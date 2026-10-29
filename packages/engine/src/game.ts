import { generateBeginnerBoard, generateRandomBoard } from './board';
import {
  WONDERS,
  WONDER_LEVELS,
  hasShips,
  isModId,
  modFor,
  modPlayerRange,
  scenarioBoard,
  scenarioFor,
  scenarioMapSize,
  type ScenarioDef,
} from './mods';
import { boardGraph } from './geometry';
import {
  cityCount,
  fortressOf,
  inBuildRegion,
  inStartRegion,
  pirateRoute,
  pirateRouteNext,
  warshipCount,
  wonderBlock,
  isLandHex,
  isRoadConnected,
  legalPortEdges,
  robberAllowed,
  routeReaches,
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
  type HarborType,
  type GameState,
  type LogEntry,
  type PlayerSetup,
  type PlayerState,
  type ResMap,
  type Resource,
  type Terrain,
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
  const fog = scenario?.fog?.[scenarioMapSize(players.length)];

  const deck: DevCardType[] = [];
  const deckCounts = scenario?.devDeck?.[scenarioMapSize(players.length)] ?? mod.devDeck;
  (Object.keys(deckCounts) as DevCardType[]).forEach((t) => {
    for (let i = 0; i < deckCounts[t]; i++) deck.push(t);
  });

  const devDeck = rng.shuffle(deck);
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
        ...(scenario?.itemPorts ? { heldPorts: [] } : {}),
        ...(scenario?.cloth ? { cloth: 0, villages: [] } : {}),
      }),
    ),
    bank,
    devDeck,
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
    ...(fog ? { fogStack: { hexes: (Object.keys(fog.hexes) as Terrain[]).flatMap((t) => Array<Terrain>(fog.hexes[t]!).fill(t)), numbers: [...fog.numbers] } } : {}),
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
  if (scenario) setUpScenarioExtras(state, scenario, rng);
  state.rng = rng.seed;
  return state;
}

/**
 * Scenario pieces dealt at the start: shuffled port types ("?" ports and the
 * Forgotten Tribe's port items), the Tribe's face-down development cards (the
 * top cards of the deck) and Cloth for Catan's general cloth supply.
 */
function setUpScenarioExtras(state: GameState, scenario: ScenarioDef, rng: Rng): void {
  const board = state.board;
  if (scenario.shufflePorts) {
    const types = rng.shuffle(board.harbors.map((h) => h.type));
    board.harbors = board.harbors.map((h, i) => ({ ...h, type: types[i] }));
  }
  if (board.edgeItems) {
    const edges = Object.keys(board.edgeItems).sort();
    const ports: HarborType[] = rng.shuffle([...(scenario.itemPorts ?? [])]);
    let p = 0;
    state.edgeDevs = {};
    for (const e of edges) {
      const item = board.edgeItems[e];
      if (item.kind === 'port') board.edgeItems[e] = { kind: 'port', type: ports[p++] ?? 'generic' };
      else if (item.kind === 'dev' && state.devDeck.length > 0) state.edgeDevs[e] = state.devDeck.shift()!;
    }
  }
  if (scenario.cloth) state.clothSupply = scenario.cloth.supply;
  if (board.fortresses) {
    // The Pirate Islands: each colour's settlement and ship printed on the main island's coast.
    state.warships = [];
    for (const f of board.fortresses) {
      state.buildings[f.start] = { owner: f.owner, type: 'settlement' };
      state.ships = { ...(state.ships ?? {}), [f.startShip]: f.owner };
      state.players[f.owner].settlementsBuilt++;
      state.players[f.owner].shipsBuilt = (state.players[f.owner].shipsBuilt ?? 0) + 1;
    }
  }
}

/**
 * Settlement pieces a player still has. The Pirate Islands: the settlement under
 * a player's pirate fortress is theirs, so it is not available until captured.
 */
function settlementsLeft(state: GameState, player: number): number {
  const me = state.players[player];
  const f = fortressOf(state, player);
  const reserved = f && f.lairs > 0 ? 1 : 0;
  return modFor(state).pieceLimits.settlements - reserved - (me.settlementsBuilt - me.citiesBuilt);
}

/** Takes up to `n` random resource cards from `player` back to the bank; returns how many. */
function loseRandomCards(state: GameState, rng: Rng, player: number, n: number): number {
  const me = state.players[player];
  let lost = 0;
  for (; lost < n; lost++) {
    const pool: Resource[] = [];
    for (const r of RESOURCES) for (let i = 0; i < me.resources[r]; i++) pool.push(r);
    if (pool.length === 0) break;
    const r = pool[rng.int(pool.length)];
    me.resources[r]--;
    state.bank[r]++;
  }
  return lost;
}

/**
 * The Pirate Islands: after a roll the pirate fleet sails `steps` hexes (the lower
 * die) along its path, with that strength, and attacks every player with a building
 * next to the hex it stops on: stronger than the player's warships → they lose 1
 * random card + 1 per city; weaker → they take 1 resource of their choice; a tie
 * does nothing. Returns the players owed a resource.
 */
function sailPirateFleet(state: GameState, rng: Rng, steps: number): Record<number, number> {
  const path = state.board.pirateFleet;
  const at = state.board.pirateHex;
  const rewards: Record<number, number> = {};
  if (!path || at === undefined) return rewards;
  const hex = path[(path.indexOf(at) + steps) % path.length];
  state.board.pirateHex = hex;
  say(state, 'pirateFleet', { n: steps });
  const G = boardGraph(state.board);
  const attacked = [...new Set(G.hexes[hex].vertices.map((v) => state.buildings[v]?.owner).filter((o) => o !== undefined))];
  for (const p of attacked.sort((a, b) => a - b)) {
    const warships = warshipCount(state, p);
    if (steps > warships) {
      const lost = loseRandomCards(state, rng, p, 1 + cityCount(state, p));
      say(state, 'fleetRaid', { p, n: lost });
    } else if (warships > steps) {
      rewards[p] = 1;
      say(state, 'fleetRepelled', { p });
    } else {
      say(state, 'fleetTie', { p });
    }
  }
  return rewards;
}

/**
 * The Pirate Islands, end of the Action phase: a line of ships that reaches the
 * player's fortress attacks it. A die gives the pirates' strength; more warships
 * than that removes a lair (the third one captures the fortress), fewer loses the
 * 2 ships nearest the fortress, a tie the nearest one.
 */
function attackFortress(state: GameState, rng: Rng, player: number): void {
  const f = fortressOf(state, player);
  const route = pirateRoute(state, player);
  if (!f || f.lairs === 0 || !route?.complete) return;
  const die = rng.int(6) + 1;
  const warships = route.edges.filter((e) => (state.warships ?? []).includes(e)).length;
  say(state, 'fortressAttack', { p: player, n: die });
  if (warships > die) {
    f.lairs--;
    if (f.lairs > 0) {
      say(state, 'fortressHit', { p: player, n: f.lairs });
      return;
    }
    state.buildings[f.vertex] = { owner: player, type: 'settlement' };
    state.players[player].settlementsBuilt++;
    say(state, 'fortressCaptured', { p: player });
    if (state.board.fortresses!.every((x) => x.lairs === 0)) {
      delete state.board.pirateHex;
      say(state, 'pirateGone');
    }
    return;
  }
  const remove = warships < die ? 2 : 1;
  const gone = route.edges.slice(-remove);
  const ships = { ...state.ships };
  for (const e of gone) delete ships[e];
  state.ships = ships;
  state.warships = (state.warships ?? []).filter((e) => !gone.includes(e));
  state.players[player].shipsBuilt = (state.players[player].shipsBuilt ?? 0) - gone.length;
  say(state, 'fortressRepelled', { p: player, n: gone.length });
}

/** A 7: players above the limit discard, then the robber (or, without one, the steal). */
function startSeven(state: GameState): void {
  state.pendingDiscards = {};
  state.players.forEach((p, i) => {
    const n = totalRes(p.resources);
    if (n > DISCARD_THRESHOLD) state.pendingDiscards[i] = Math.floor(n / 2);
  });
  state.robberReturnPhase = 'MAIN_ACTIONS';
  if (Object.keys(state.pendingDiscards).length > 0) state.phase = 'ROBBER_DISCARD';
  else afterDiscards(state);
}

/**
 * After the discards of a 7: move the robber, or — in a game without a robber (The
 * Pirate Islands) — steal 1 card from any other player.
 */
function afterDiscards(state: GameState): void {
  if (!state.board.noRobber) {
    state.phase = 'ROBBER_MOVE';
    return;
  }
  const p = state.currentPlayer;
  const candidates = state.players.map((_, i) => i).filter((i) => i !== p && totalRes(state.players[i].resources) > 0);
  if (candidates.length === 0) {
    finishRobber(state);
  } else {
    state.stealCandidates = candidates;
    state.phase = 'ROBBER_STEAL';
  }
}

/**
 * The Forgotten Tribe: a ship built or moved onto an edge with an item takes it —
 * a VP token (+1 VP), a development card (as if bought this turn) or a port
 * (placed at a coastal settlement now or later, see `placePort`).
 */
function collectItem(state: GameState, player: number, edge: string): void {
  const item = state.board.edgeItems?.[edge];
  if (!item) return;
  const me = state.players[player];
  const items = { ...state.board.edgeItems };
  delete items[edge];
  state.board.edgeItems = items;
  if (item.kind === 'vp') {
    me.vpTokens = (me.vpTokens ?? 0) + 1;
    say(state, 'tookVpToken', { p: player });
  } else if (item.kind === 'dev') {
    const card = state.edgeDevs?.[edge];
    if (state.edgeDevs) delete state.edgeDevs[edge];
    if (card) me.devCards.push({ type: card, boughtTurn: state.turn });
    say(state, 'tookDevCard', { p: player });
  } else {
    me.heldPorts = [...(me.heldPorts ?? []), item.type];
    if (item.type === 'generic') say(state, 'tookPortGeneric', { p: player });
    else say(state, 'tookPort', { p: player, r: item.type });
  }
}

/**
 * Cloth for Catan: a route from one of the player's buildings to a village opens
 * trade with it — 1 cloth from that village right away.
 */
function checkVillages(state: GameState, player: number): void {
  const villages = state.board.villages;
  if (!villages) return;
  const me = state.players[player];
  villages.forEach((village, i) => {
    if ((me.villages ?? []).includes(i) || !routeReaches(state, player, village.vertex)) return;
    me.villages = [...(me.villages ?? []), i];
    const got = village.cloth > 0 ? 1 : 0;
    village.cloth -= got;
    me.cloth = (me.cloth ?? 0) + got;
    say(state, 'villageTrade', { p: player, n: village.number });
  });
}

/** Cloth for Catan: villages with the rolled number give 1 cloth to each trading partner. */
function produceCloth(state: GameState, roll: number): void {
  for (const [i, village] of (state.board.villages ?? []).entries()) {
    if (village.number !== roll || village.cloth === 0) continue;
    state.players.forEach((p, seat) => {
      if (!(p.villages ?? []).includes(i)) return;
      // A village that runs out mid-roll is topped up from the general supply.
      if (village.cloth > 0) village.cloth--;
      else if ((state.clothSupply ?? 0) > 0) state.clothSupply!--;
      else return;
      p.cloth = (p.cloth ?? 0) + 1;
      say(state, 'clothReceived', { p: seat, n: 1 });
    });
  }
}

/** Cloth for Catan: enough empty villages end the game; most VP wins, ties go to more cloth. */
function checkClothEnd(state: GameState): void {
  const rule = scenarioFor(state)?.cloth;
  if (!rule || state.phase === 'GAME_OVER') return;
  const empty = (state.board.villages ?? []).filter((v) => v.cloth === 0).length;
  if (empty < rule.endWhenEmpty) return;
  const ranked = state.players
    .map((p, i) => ({ i, vp: victoryPoints(state, i), cloth: p.cloth ?? 0 }))
    .sort((a, b) => b.vp - a.vp || b.cloth - a.cloth || a.i - b.i);
  state.winner = ranked[0].i;
  state.phase = 'GAME_OVER';
  state.trade = null;
  say(state, 'villagesEmpty', { n: empty });
  say(state, 'win', { p: ranked[0].i, n: ranked[0].vp });
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export function publicVictoryPoints(state: GameState, player: number): number {
  const p = state.players[player];
  let vp = p.settlementsBuilt - p.citiesBuilt + p.citiesBuilt * 2 + (p.vpTokens ?? 0) + Math.floor((p.cloth ?? 0) / 2);
  if (state.longestRoad.holder === player) vp += 2;
  if (state.largestArmy === player) vp += 2;
  return vp;
}

export function victoryPoints(state: GameState, player: number): number {
  const hidden = state.players[player].devCards.filter((c) => c.type === 'victoryPoint').length;
  return publicVictoryPoints(state, player) + hidden;
}

function updateLongestRoad(state: GameState): void {
  if (scenarioFor(state)?.noLongestRoute) return;
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
  if (scenarioFor(state)?.noLargestArmy) return;
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
  const vp = victoryPoints(state, p);
  let won = vp >= state.config.victoryTarget;
  // The Pirate Islands: the player's fortress must be captured too.
  const fortress = fortressOf(state, p);
  if (fortress && fortress.lairs > 0) won = false;
  if (scenarioFor(state)?.wonders) {
    // The Wonders of Catan: a finished wonder, or 10 VP and the highest wonder level.
    const level = state.players[p].wonder?.level ?? 0;
    const highest = level > 0 && state.players.every((o, i) => i === p || (o.wonder?.level ?? 0) < level);
    won = level >= WONDER_LEVELS || (won && highest);
  }
  if (won) {
    state.winner = p;
    state.phase = 'GAME_OVER';
    state.trade = null;
    say(state, 'win', { p, n: vp });
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
  if (state.board.fortresses) {
    if (!pirateRouteNext(state, player).includes(edge)) fail('Ships must extend your one line to your fortress by the shortest way');
  } else if (!isShipConnected(state, player, edge)) fail('Ship must connect to your ship or building');
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

/**
 * Scenario bonus: VP tokens for a player's first settlement in a region other
 * than their home. With `homeRegions: 'starting'` (The Four Islands) the
 * regions of a player's starting settlements are that player's home.
 */
function awardRegionBonus(state: GameState, player: number, vertex: string, setup = false): void {
  const scenario = scenarioFor(state);
  if (!scenario?.regionBonus) return;
  const region = vertexRegion(state, vertex);
  const me = state.players[player];
  if (!region) return;
  if (scenario.homeRegions === 'starting') {
    if (setup) {
      if (!(me.homeRegions ?? []).includes(region)) me.homeRegions = [...(me.homeRegions ?? []), region];
      return;
    }
    if ((me.homeRegions ?? []).includes(region)) return;
  } else if ((scenario.homeRegions ?? []).includes(region)) return;
  if ((me.bonusRegions ?? []).includes(region)) return;
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
    const back = state.goldReturnPhase ?? 'MAIN_ACTIONS';
    delete state.goldReturnPhase;
    delete state.goldDiscovered;
    if (back === 'ROLLED_SEVEN') startSeven(state);
    else state.phase = back;
  } else {
    state.phase = 'GOLD_CHOICE';
  }
}

/**
 * The Fog Islands: a road or ship next to an intersection that touches an empty
 * space discovers it. A random face-down hex is turned up there; on land it also
 * gets a random number disc and the player takes 1 resource of its type (a gold
 * field: 1 of their choice). Every empty space at both ends of `edge` is discovered.
 */
function discover(state: GameState, rng: Rng, player: number, edge: string): void {
  const stack = state.fogStack;
  if (!stack) return;
  const G = boardGraph(state.board);
  const spaces = new Set<number>();
  for (const v of G.edges[edge].vertices) {
    for (const h of G.vertices[v].hexes) if (state.board.hexes[h].terrain === 'fog') spaces.add(h);
  }
  for (const h of [...spaces].sort((a, b) => a - b)) {
    if (stack.hexes.length === 0) return;
    const tile = state.board.hexes[h];
    const terrain = stack.hexes.splice(rng.int(stack.hexes.length), 1)[0];
    tile.terrain = terrain;
    if (terrain === 'sea') {
      say(state, 'discoveredSea', { p: player });
      continue;
    }
    if (terrain !== 'desert' && stack.numbers.length > 0) tile.number = stack.numbers.splice(rng.int(stack.numbers.length), 1)[0];
    if (terrain === 'gold') {
      state.pendingGold = { ...(state.pendingGold ?? {}), [player]: (state.pendingGold?.[player] ?? 0) + 1 };
      state.goldDiscovered = true;
      say(state, 'discoveredGold', { p: player, n: tile.number ?? 0 });
      continue;
    }
    const r = TERRAIN_RESOURCE[terrain];
    const gained = emptyRes();
    if (r && state.bank[r] > 0) gained[r] = 1;
    addRes(state.players[player].resources, gained, 1);
    addRes(state.bank, gained, -1);
    say(state, 'discoveredLand', { p: player, n: tile.number ?? 0, res: gained });
  }
}

/** A discovered gold field: the player chooses the resource now, then play returns to the current phase. */
function settleDiscoveredGold(state: GameState): void {
  if (!state.goldDiscovered || state.phase === 'GOLD_CHOICE' || state.phase === 'GAME_OVER') return;
  state.goldReturnPhase = state.phase as 'INITIAL_PLACEMENT' | 'PRE_ROLL' | 'MAIN_ACTIONS';
  settleGold(state);
  for (const [p, n] of Object.entries(state.pendingGold ?? {})) say(state, 'goldOwed', { p: Number(p), n });
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
  for (const [p, n] of Object.entries(gold)) {
    state.pendingGold = { ...(state.pendingGold ?? {}), [p]: (state.pendingGold?.[Number(p)] ?? 0) + n };
  }
  produceCloth(state, roll);
  return { producing, gains };
}


/** Robber or pirate placed: steal automatically from a single candidate, else let the player choose. */
function afterRobberMove(state: GameState, rng: Rng, player: number, owners: number[], cloth = false): void {
  // Cloth for Catan: the pirate may take a cloth token instead, so the thief always chooses.
  const has = (p: number) => totalRes(state.players[p].resources) > 0 || (cloth && (state.players[p].cloth ?? 0) > 0);
  const candidates = owners.filter((p) => p !== player && has(p));
  state.stealCloth = cloth || undefined;
  if (candidates.length === 0) {
    finishRobber(state);
  } else if (candidates.length === 1 && !cloth) {
    stealFrom(state, rng, player, candidates[0]);
    finishRobber(state);
  } else {
    state.stealCandidates = candidates;
    state.phase = 'ROBBER_STEAL';
  }
}

function finishRobber(state: GameState): void {
  state.stealCandidates = [];
  delete state.stealCloth;
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
  const setupOrder = rulesetFor(state.players.length).setupOrder(state.turnOrder);
  // Cloth for Catan: a third starting settlement each, in turn order.
  for (let round = 2; round < (scenarioFor(state)?.setupRounds ?? 2); round++) setupOrder.push(...state.turnOrder);
  state.setup = { order: setupOrder, step: 0, lastSettlement: null };
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
      // Starting resources come from the last round of starting settlements.
      const isSecond = setup.step >= setup.order.length - state.players.length;
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
      awardRegionBonus(state, player, action.vertex, true);
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
      discover(state, rng, player, action.edge);
      if (action.ship) collectItem(state, player, action.edge);
      checkVillages(state, player);
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
      settleDiscoveredGold(state);
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
      // The Pirate Islands: the fleet sails and attacks before production or the 7.
      const rewards = sailPirateFleet(state, rng, Math.min(dice[0], dice[1]));
      if (Object.keys(rewards).length > 0) state.pendingGold = { ...rewards };
      if (sum === 7) {
        state.lastRoll = { id: rollId, dice, player, producingHexes: [], gains: state.players.map(() => emptyRes()) };
        if (Object.keys(rewards).length > 0) {
          state.goldReturnPhase = 'ROLLED_SEVEN';
          settleGold(state);
        } else {
          startSeven(state);
        }
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
          for (const [p, n] of Object.entries(state.pendingGold)) {
            const gold = n - (rewards[Number(p)] ?? 0);
            if (gold > 0) say(state, 'goldOwed', { p: Number(p), n: gold });
          }
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
      if (state.goldReturnPhase === 'MAIN_ACTIONS' && !state.goldDiscovered && state.lastRoll) addRes(state.lastRoll.gains[player], action.resources, 1);
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
      if (Object.keys(state.pendingDiscards).length === 0) afterDiscards(state);
      return;
    }

    case 'moveRobber': {
      requirePhase(state, 'ROBBER_MOVE');
      requireActive(state, player);
      if (state.board.noRobber) fail('There is no robber in this game');
      if (!Number.isInteger(action.hex) || !state.board.hexes[action.hex]) fail('Unknown hex');
      if (action.hex === state.board.robberHex) fail('The robber must move to a different hex');
      if (!isLandHex(state.board, action.hex)) fail('The robber must stay on land');
      if (!robberAllowed(state.board, action.hex)) fail('The robber may only move to a hex with a number');
      state.board.robberHex = action.hex;
      say(state, 'robberMoved', { p: player });
      afterRobberMove(state, rng, player, playersOnHex(state, action.hex));
      return;
    }

    case 'movePirate': {
      requirePhase(state, 'ROBBER_MOVE');
      requireActive(state, player);
      if (state.board.pirateHex === undefined) fail('There is no pirate in this game');
      if (state.board.pirateFleet) fail('The pirate fleet sails on its own');
      if (!Number.isInteger(action.hex) || !state.board.hexes[action.hex]) fail('Unknown hex');
      if (state.board.hexes[action.hex].terrain !== 'sea') fail('The pirate must move to a sea hex');
      if (action.hex === state.board.pirateHex) fail('The pirate must move to a different hex');
      if (state.board.villages && (me.villages ?? []).length === 0) fail('You may move the pirate once you trade with a village');
      state.board.pirateHex = action.hex;
      say(state, 'pirateMoved', { p: player });
      afterRobberMove(state, rng, player, shipOwnersOnHex(state, action.hex), !!state.board.villages);
      return;
    }

    case 'steal': {
      requirePhase(state, 'ROBBER_STEAL');
      requireActive(state, player);
      if (!state.stealCandidates.includes(action.victim)) fail('You cannot steal from that player');
      if (action.cloth) {
        if (!state.stealCloth) fail('Only the pirate can take cloth');
        const victim = state.players[action.victim];
        if ((victim.cloth ?? 0) === 0) fail('That player has no cloth');
        victim.cloth!--;
        me.cloth = (me.cloth ?? 0) + 1;
        say(state, 'stoleCloth', { p: player, q: action.victim });
        finishRobber(state);
        checkVictory(state);
        return;
      }
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
      discover(state, rng, player, action.edge);
      checkVillages(state, player);
      updateLongestRoad(state);
      checkVictory(state);
      settleDiscoveredGold(state);
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
      discover(state, rng, player, action.edge);
      collectItem(state, player, action.edge);
      checkVillages(state, player);
      updateLongestRoad(state);
      checkVictory(state);
      settleDiscoveredGold(state);
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
      discover(state, rng, player, action.to);
      collectItem(state, player, action.to);
      checkVillages(state, player);
      updateLongestRoad(state);
      checkVictory(state);
      settleDiscoveredGold(state);
      return;
    }

    case 'buildSettlement': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      if (settlementsLeft(state, player) <= 0) fail('No settlements left');
      if (!G.vertices[action.vertex]) fail('Unknown spot');
      if (!satisfiesDistanceRule(state, action.vertex)) fail('Settlement must be on an empty spot at least two roads from others');
      if (!inBuildRegion(state, player, action.vertex)) fail('Settlements only on the main island or your beachhead');
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
      if (state.board.fortresses) {
        // The Pirate Islands: a Knight only turns the normal ship nearest the start into a warship.
        const ship = pirateRoute(state, player)?.edges.find((e) => !(state.warships ?? []).includes(e));
        if (!ship) fail('You have no ship to turn into a warship');
        useCard(state, player, idx);
        state.warships = [...(state.warships ?? []), ship!];
        say(state, 'warship', { p: player });
        return;
      }
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
      discover(state, rng, player, action.edge);
      if (action.ship) collectItem(state, player, action.edge);
      checkVillages(state, player);
      updateLongestRoad(state);
      checkVictory(state);
      settleDiscoveredGold(state);
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

    case 'placePort': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      const held = me.heldPorts ?? [];
      if (held.length === 0) fail('You have no port to place');
      const type: HarborType = action.port ?? held[0];
      const idx = held.indexOf(type);
      if (idx < 0) fail('You do not hold that port');
      if (!legalPortEdges(state, player).includes(action.edge)) {
        fail('A port goes on a coastal edge of your settlement, one edge away from other ports');
      }
      me.heldPorts = held.filter((_, i) => i !== idx);
      state.board.harbors = [...state.board.harbors, { edge: action.edge, type }];
      say(state, 'placedPort', { p: player });
      return;
    }

    case 'claimWonder': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      if (!scenarioFor(state)?.wonders || !Object.prototype.hasOwnProperty.call(WONDERS, action.wonder)) fail('Unknown wonder');
      const block = wonderBlock(state, player, action.wonder, victoryPoints(state, player));
      if (block) fail(block);
      me.wonder = { id: action.wonder, level: 0 };
      say(state, 'claimedWonder', { p: player, w: action.wonder });
      return;
    }

    case 'buildWonder': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      if (!me.wonder) fail('Claim a wonder first');
      if (me.wonder!.level >= WONDER_LEVELS) fail('Your wonder is finished');
      pay(state, player, WONDERS[me.wonder!.id].cost, 'this level');
      me.wonder!.level++;
      say(state, 'builtWonder', { p: player, w: me.wonder!.id, n: me.wonder!.level });
      checkVictory(state);
      return;
    }

    case 'endTurn': {
      requirePhase(state, 'MAIN_ACTIONS');
      requireActive(state, player);
      requireNoFreeRoads(state);
      if ((me.heldPorts ?? []).length > 0 && legalPortEdges(state, player).length > 0) fail('Place your port first');
      attackFortress(state, rng, player);
      checkVictory(state);
      if (state.winner !== null) return;
      checkClothEnd(state);
      if (state.winner !== null) return;
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
