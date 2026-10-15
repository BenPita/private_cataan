export const RESOURCES = ['lumber', 'brick', 'wool', 'grain', 'ore'] as const;
export type Resource = (typeof RESOURCES)[number];
export type ResMap = Record<Resource, number>;

export type Terrain = 'forest' | 'hills' | 'pasture' | 'fields' | 'mountains' | 'desert';

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
  | 'MAIN_ACTIONS'
  | 'GAME_OVER';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface HexTile {
  id: number;
  terrain: Terrain;
  /** Dice number token; null for the desert. */
  number: number | null;
}

export interface Harbor {
  /** Coastal edge the harbor sits on; both of its vertices grant access. */
  edge: string;
  type: HarborType;
}

export interface Board {
  hexes: HexTile[];
  harbors: Harbor[];
  robberHex: number;
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
  msg: string;
  /** Private variant of the message for specific players (e.g. which resource was stolen). */
  secret?: { to: number[]; msg: string };
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

export interface GameConfig {
  victoryTarget: number;
  boardType: 'random' | 'beginner';
}

export interface GameState {
  config: GameConfig;
  ruleset: 'classic' | 'twoPlayerSimple';
  board: Board;
  buildings: Record<string, Building>;
  roads: Record<string, number>;
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
  freeRoads: number;
  trade: TradeOffer | null;
  nextTradeId: number;
  longestRoad: { holder: number | null; lengths: number[] };
  largestArmy: number | null;
  winner: number | null;
  log: LogEntry[];
  rng: number;
}

export type Action =
  | { type: 'rollForOrder' }
  | { type: 'placeSetupSettlement'; vertex: string }
  | { type: 'placeSetupRoad'; edge: string }
  | { type: 'rollDice' }
  | { type: 'discard'; resources: ResMap }
  | { type: 'moveRobber'; hex: number }
  | { type: 'steal'; victim: number }
  | { type: 'buildRoad'; edge: string }
  | { type: 'buildSettlement'; vertex: string }
  | { type: 'buildCity'; vertex: string }
  | { type: 'buyDevCard' }
  | { type: 'playKnight' }
  | { type: 'playRoadBuilding' }
  | { type: 'placeFreeRoad'; edge: string }
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
