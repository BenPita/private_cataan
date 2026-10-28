import type { LogKey, LogParams } from './log';

export const RESOURCES = ['lumber', 'brick', 'wool', 'grain', 'ore'] as const;
export type Resource = (typeof RESOURCES)[number];
export type ResMap = Record<Resource, number>;

/** Land terrains of the base game. */
export type BaseTerrain = 'forest' | 'hills' | 'pasture' | 'fields' | 'mountains' | 'desert';
/** Every hex terrain. Seafarers adds sea hexes and gold fields (1 resource of choice). */
export type Terrain = BaseTerrain | 'sea' | 'gold';

export type DevCardType = 'knight' | 'victoryPoint' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly';

export type HarborType = Resource | 'generic';

export type Phase =
  | 'ORDER_ROLL'
  | 'INITIAL_PLACEMENT'
  | 'PRE_ROLL'
  | 'ROLL_RESOLUTION'
  | 'ROBBER_DISCARD'
  | 'ROBBER_MOVE'
  | 'ROBBER_STEAL'
  | 'GOLD_CHOICE'
  | 'MAIN_ACTIONS'
  | 'GAME_OVER';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface HexTile {
  id: number;
  terrain: Terrain;
  /** Dice number token; null for the desert and sea. */
  number: number | null;
  /** Seafarers: land region (island) of the hex, e.g. 'main'. Missing on base boards and sea. */
  region?: string;
}

export interface Harbor {
  /** Coastal edge the harbor sits on; both of its vertices grant access. */
  edge: string;
  type: HarborType;
}

/**
 * Shape of the island; each layout has its own vertex/edge graph (geometry.ts).
 * Seafarers scenario maps register layouts named `sf-<scenario>-<n>p`.
 */
export type LayoutId = 'classic' | 'classic56' | `sf-${string}`;

export interface Board {
  /** Missing on games saved before mods existed → 'classic'. */
  layout?: LayoutId;
  hexes: HexTile[];
  harbors: Harbor[];
  robberHex: number;
  /** Seafarers: sea hex holding the pirate. Missing on boards without a pirate. */
  pirateHex?: number;
  /** Seafarers: regions where starting settlements may go (missing = anywhere). */
  startRegions?: string[];
}

export interface Building {
  owner: number;
  type: 'settlement' | 'city';
}

export interface DevCard {
  type: DevCardType;
  /** Turn number on which the card was bought; it cannot be played that turn. */
  boughtTurn: number;
}

export interface PlayerSetup {
  name: string;
  kind: 'human' | 'bot';
  difficulty?: BotDifficulty;
}

export interface PlayerState extends PlayerSetup {
  color: string;
  resources: ResMap;
  devCards: DevCard[];
  knightsPlayed: number;
  roadsBuilt: number;
  settlementsBuilt: number;
  citiesBuilt: number;
  playedDevThisTurn: boolean;
  /** Seafarers: ships placed (pieces on the board). Missing on older saves → 0. */
  shipsBuilt?: number;
  /** Seafarers: victory point tokens (public VP), e.g. +2 for a first settlement on an island. */
  vpTokens?: number;
  /** Seafarers: regions in which this player already received the first-settlement bonus. */
  bonusRegions?: string[];
}

export interface TradeOffer {
  id: number;
  from: number;
  /** What the proposer gives. */
  give: ResMap;
  /** What the proposer wants in return. */
  get: ResMap;
  /** Players the offer was sent to. */
  to: number[];
  responses: Record<number, 'pending' | 'accepted' | 'rejected' | 'countered'>;
  /** Counteroffers, expressed from the original proposer's point of view (give/get of the proposer). */
  counters: Record<number, { give: ResMap; get: ResMap }>;
}

export interface LogEntry {
  /** English rendering, for debugging and tests. */
  msg: string;
  /** Increasing event number, so clients can animate each new event exactly once. */
  seq?: number;
  /** Translatable form (see log.ts). */
  key: LogKey;
  params: LogParams;
  /** Private variant for specific players (e.g. which resource was stolen). */
  secret?: { to: number[]; msg: string; key: LogKey; params: LogParams };
}

export interface LastRoll {
  id: number;
  dice: [number, number];
  player: number;
  /** Hexes that produced (unblocked, number matched). */
  producingHexes: number[];
  /** Resources each player received. Production is public information. */
  gains: ResMap[];
}

/** Installed mods (engine/src/mods). 'base' = the classic base game. */
export type ModId = 'base' | 'seafarers';

export interface GameConfig {
  /** Missing on games saved before mods existed → 'base'. */
  mod?: ModId;
  /** Rules version of the mod this game started with. */
  modVersion?: number;
  victoryTarget: number;
  boardType: 'random' | 'beginner';
  /** House rule: the first settlement also gives starting resources (official: only the second). */
  startResBothSettlements?: boolean;
  /** House rule: development cards may be played on the turn they were bought (official: next turn). */
  devCardsSameTurn?: boolean;
  /** Seafarers: scenario id (default 'newShores'). Missing for mods without scenarios. */
  scenario?: string;
}

export interface GameState {
  config: GameConfig;
  ruleset: 'classic' | 'twoPlayerSimple';
  board: Board;
  buildings: Record<string, Building>;
  roads: Record<string, number>;
  /** Seafarers: ships by edge id → owner. Missing on older/base saves → {}. */
  ships?: Record<string, number>;
  players: PlayerState[];
  bank: ResMap;
  devDeck: DevCardType[];
  turn: number;
  currentPlayer: number;
  phase: Phase;
  /** Seats in playing order, decided by the opening dice roll. */
  turnOrder: number[];
  /**
   * Opening roll to decide who starts. `groups` is the ranking so far: each
   * inner array is a set of players still tied with each other. The first
   * group with more than one player rolls next; `rolls` holds this round's dice.
   */
  orderRoll: {
    groups: number[][];
    rolls: Record<number, [number, number]>;
    history: Array<{ player: number; dice: [number, number] }>;
  } | null;
  setup: { order: number[]; step: number; lastSettlement: string | null } | null;
  hasRolled: boolean;
  lastRoll: LastRoll | null;
  pendingDiscards: Record<number, number>;
  /** Phase to return to after the robber is resolved (PRE_ROLL when a Knight is played before rolling). */
  robberReturnPhase: 'PRE_ROLL' | 'MAIN_ACTIONS';
  stealCandidates: number[];
  /**
   * Seafarers gold fields: resources of their choice each player still has to
   * take (GOLD_CHOICE phase). Missing on older saves → {}.
   */
  pendingGold?: Record<number, number>;
  /** Phase to return to once every gold choice is made. */
  goldReturnPhase?: 'INITIAL_PLACEMENT' | 'MAIN_ACTIONS';
  /** Seafarers: the active player already moved a ship this turn. */
  shipMoved?: boolean;
  /** Seafarers: edges of ships built this turn (they may not be moved this turn). */
  newShips?: string[];
  freeRoads: number;
  trade: TradeOffer | null;
  /**
   * 5–6 players: set while Player 2 takes their Action phase after Player 1
   * (`first`). Missing on older saves → null.
   */
  paired: { first: number } | null;
  nextTradeId: number;
  longestRoad: { holder: number | null; lengths: number[] };
  largestArmy: number | null;
  winner: number | null;
  log: LogEntry[];
  /** Total number of log events so far (the log itself is trimmed). */
  logSeq?: number;
  rng: number;
}

export type Action =
  | { type: 'rollForOrder' }
  | { type: 'placeSetupSettlement'; vertex: string }
  /** `ship: true` places a ship instead (Seafarers, coastal starting settlement). */
  | { type: 'placeSetupRoad'; edge: string; ship?: boolean }
  | { type: 'rollDice' }
  | { type: 'discard'; resources: ResMap }
  | { type: 'moveRobber'; hex: number }
  | { type: 'movePirate'; hex: number }
  | { type: 'steal'; victim: number }
  | { type: 'buildRoad'; edge: string }
  | { type: 'buildShip'; edge: string }
  | { type: 'moveShip'; from: string; to: string }
  | { type: 'chooseGold'; resources: ResMap }
  | { type: 'buildSettlement'; vertex: string }
  | { type: 'buildCity'; vertex: string }
  | { type: 'buyDevCard' }
  | { type: 'playKnight' }
  | { type: 'playRoadBuilding' }
  /** `ship: true` places a free ship instead (Seafarers). */
  | { type: 'placeFreeRoad'; edge: string; ship?: boolean }
  | { type: 'finishRoadBuilding' }
  | { type: 'playYearOfPlenty'; resources: [Resource, Resource] }
  | { type: 'playMonopoly'; resource: Resource }
  | { type: 'bankTrade'; give: Resource; get: Resource }
  | { type: 'proposeTrade'; give: ResMap; get: ResMap; to: number[] }
  | { type: 'respondTrade'; tradeId: number; response: 'accept' | 'reject' }
  | { type: 'counterTrade'; tradeId: number; give: ResMap; get: ResMap }
  | { type: 'confirmTrade'; tradeId: number; with: number }
  | { type: 'cancelTrade' }
  | { type: 'endTurn' };

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };
