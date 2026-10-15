import { RESOURCES, type ResMap, type Resource } from './types';

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
