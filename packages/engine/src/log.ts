import { RESOURCES, type ResMap, type Resource, type WonderId } from './types';

/**
 * Game log entries are stored as a key plus parameters so each client can
 * show them in its own language. Parameters:
 *   p, q     player index        n        number
 *   r, r2    resource            res, give, get  resource counts
 *   players  list of players (joined with "and")
 *   order    list of players (joined with "→")
 */
export const LOG_EN = {
  start: 'Everyone rolls the dice — the highest roll goes first.',
  orderRolled: '{p} rolled {n} for turn order.',
  orderTie: '{players} tied — roll again.',
  orderDone: 'Turn order: {order}. {p} places first.',
  setupSettlement: '{p} placed a settlement.',
  setupSettlementRes: '{p} placed a settlement and received {res}.',
  setupDone: 'Setup complete. Let the game begin!',
  rolled: '{p} rolled {n}.',
  received: '{p} received {res}.',
  discarded: '{p} discarded {n} cards.',
  robberMoved: '{p} moved the robber.',
  steal: '{p} stole a card from {q}.',
  stealSecret: '{p} stole 1 {r} from {q}.',
  stealNothing: '{p} found nothing to steal from {q}.',
  builtRoad: '{p} built a road.',
  builtSettlement: '{p} built a settlement.',
  builtCity: '{p} upgraded a settlement to a city.',
  boughtDev: '{p} bought a development card.',
  playedKnight: '{p} played a Knight.',
  playedRoadBuilding: '{p} played Road Building.',
  placedFreeRoad: '{p} placed a free road.',
  playedYearOfPlenty: '{p} played Invention and took {res}.',
  playedMonopoly: '{p} played Monopoly on {r} and took {n}.',
  bankTrade: '{p} traded {n} {r} with the bank for 1 {r2}.',
  offer: '{p} offers {give} for {get}.',
  declined: '{p} declined the trade.',
  accepts: '{p} accepts the trade.',
  counters: '{p} counters: {give} for {get}.',
  withdrew: '{p} withdrew the trade offer.',
  traded: '{p} traded {give} to {q} for {get}.',
  longestRoad: '{p} takes Longest Road ({n}).',
  longestRoadLost: 'Longest Road is no longer held by anyone.',
  largestArmy: '{p} takes Largest Army ({n}).',
  pairedTurn: '{p} — Player 2: build & bank trade',
  builtShip: '{p} built a ship.',
  movedShip: '{p} moved a ship.',
  placedFreeShip: '{p} placed a free ship.',
  pirateMoved: '{p} moved the pirate.',
  goldOwed: '{p} may take {n} resources of their choice from a gold field.',
  goldChosen: '{p} took {res} from a gold field.',
  regionBonus: '{p} settled a new island: +{n} VP.',
  discoveredSea: '{p} discovered open sea.',
  discoveredLand: '{p} discovered land ({n}) and took {res}.',
  discoveredGold: '{p} discovered a gold field ({n}).',
  tookVpToken: '{p} picked up a victory point token.',
  tookDevCard: '{p} picked up a development card.',
  tookPort: '{p} picked up a 2:1 {r} port.',
  tookPortGeneric: '{p} picked up a 3:1 port.',
  placedPort: '{p} placed a port.',
  villageTrade: '{p} opened trade with village {n}.',
  clothReceived: '{p} received {n} cloth.',
  stoleCloth: '{p} took a cloth token from {q}.',
  villagesEmpty: '{n} villages have run out of cloth: the game ends.',
  pirateFleet: 'The pirate fleet sails {n} with strength {n}.',
  fleetRaid: 'The pirates raid {p}: {p} loses {n} cards.',
  fleetRepelled: '{p} beats off the pirates and takes a resource of their choice.',
  fleetTie: '{p} holds off the pirates.',
  warship: '{p} turned a ship into a warship.',
  fortressAttack: '{p} attacks their pirate fortress; the pirates roll {n}.',
  fortressHit: '{p} wins the battle: {n} pirate lairs left.',
  fortressCaptured: '{p} captured their pirate fortress!',
  fortressRepelled: '{p} loses the battle and {n} ships.',
  pirateGone: 'Every fortress is captured: the pirate fleet is gone.',
  claimedWonder: '{p} claimed the {w}.',
  builtWonder: '{p} built level {n} of the {w}.',
  win: '{p} wins with {n} points!',
} as const;

export type LogKey = keyof typeof LOG_EN;
export type LogParams = Partial<{
  p: number;
  q: number;
  n: number;
  r: Resource;
  r2: Resource;
  res: Partial<ResMap>;
  give: Partial<ResMap>;
  get: Partial<ResMap>;
  players: number[];
  order: number[];
  /** The Wonders of Catan: wonder id. */
  w: WonderId;
}>;

export interface LogFormatter {
  name(player: number): string;
  resource(r: Resource): string;
  /** "nothing" when empty. */
  resources(res: Partial<ResMap>): string;
  and(items: string[]): string;
}

export function formatLog(template: string, params: LogParams, f: LogFormatter): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = (params as Record<string, unknown>)[k];
    switch (k) {
      case 'p':
      case 'q':
        return f.name(v as number);
      case 'r':
      case 'r2':
        return f.resource(v as Resource);
      case 'res':
      case 'give':
      case 'get':
        return f.resources(v as Partial<ResMap>);
      case 'players':
        return f.and((v as number[]).map(f.name));
      case 'order':
        return (v as number[]).map(f.name).join(' → ');
      default:
        return String(v);
    }
  });
}

export function englishFormatter(names: string[]): LogFormatter {
  return {
    name: (p) => names[p] ?? '?',
    resource: (r) => r,
    resources: (res) => {
      const parts = RESOURCES.filter((k) => (res[k] ?? 0) > 0).map((k) => `${res[k]} ${k}`);
      return parts.length ? parts.join(', ') : 'nothing';
    },
    and: (items) => items.join(' and '),
  };
}
