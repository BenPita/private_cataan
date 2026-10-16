import { describe, expect, it } from 'vitest';
import { GRAPH, resOf, totalRes, tradeRates, victoryPoints, type GameState } from '../src';
import { act, expectFail, mainPhaseGame, placeBuilding, placeRoadDirect, setResources } from './helpers';

const R = resOf;

describe('bank and harbor trading', () => {
  it('trades 4:1 by default', () => {
    const s = mainPhaseGame();
    setResources(s, 0, { lumber: 4 });
    const next = act(s, 0, { type: 'bankTrade', give: 'lumber', get: 'ore' });
    expect(next.players[0].resources).toEqual(R({ ore: 1 }));
    expect(next.bank.lumber).toBe(19);
    expect(next.bank.ore).toBe(18);
    setResources(s, 0, { lumber: 3 });
    expect(expectFail(s, 0, { type: 'bankTrade', give: 'lumber', get: 'ore' })).toMatch(/Not enough/);
  });

  it('uses 3:1 and 2:1 harbor rates', () => {
    const s = mainPhaseGame();
    const generic = s.board.harbors.find((h) => h.type === 'generic')!;
    const special = s.board.harbors.find((h) => h.type !== 'generic')!;
    placeBuilding(s, 0, GRAPH.edges[generic.edge].vertices[0]);
    let rates = tradeRates(s, 0);
    expect(Object.values(rates).every((r) => r === 3)).toBe(true);
    placeBuilding(s, 0, GRAPH.edges[special.edge].vertices[1]);
    rates = tradeRates(s, 0);
    expect(rates[special.type as 'ore']).toBe(2);
  });

  it('fails when the bank lacks the requested resource', () => {
    const s = mainPhaseGame();
    setResources(s, 0, { lumber: 4 });
    s.bank.ore = 0;
    expect(expectFail(s, 0, { type: 'bankTrade', give: 'lumber', get: 'ore' })).toMatch(/no ore/);
  });
});

describe('player trading', () => {
  function withCards(n = 2): GameState {
    const s = mainPhaseGame(n);
    setResources(s, 0, { lumber: 2 });
    setResources(s, 1, { ore: 2 });
    if (n > 2) setResources(s, 2, { ore: 1 });
    return s;
  }

  it('executes immediately when the single recipient accepts', () => {
    let s = withCards();
    s = act(s, 0, { type: 'proposeTrade', give: R({ lumber: 1 }), get: R({ ore: 1 }), to: [1] });
    s = act(s, 1, { type: 'respondTrade', tradeId: s.trade!.id, response: 'accept' });
    expect(s.players[0].resources).toEqual(R({ lumber: 1, ore: 1 }));
    expect(s.players[1].resources).toEqual(R({ lumber: 1, ore: 1 }));
    expect(s.trade).toBeNull();
  });

  it('rejects gifts, over-offers and non-active proposers', () => {
    const s = withCards();
    expect(expectFail(s, 0, { type: 'proposeTrade', give: R({ lumber: 1 }), get: R({}), to: [1] })).toMatch(/at least one/);
    expect(expectFail(s, 0, { type: 'proposeTrade', give: R({ lumber: 3 }), get: R({ ore: 1 }), to: [1] })).toMatch(/do not have/);
    expect(expectFail(s, 1, { type: 'proposeTrade', give: R({ ore: 1 }), get: R({ lumber: 1 }), to: [0] })).toMatch(/not your turn/);
    expect(expectFail(s, 0, { type: 'proposeTrade', give: R({ lumber: 2 }), get: R({ lumber: 1, ore: 1 }), to: [1] })).toMatch(/same resource/);
  });

  it('revalidates when accepting an offer that became invalid', () => {
    let s = withCards();
    s = act(s, 0, { type: 'proposeTrade', give: R({ lumber: 2 }), get: R({ ore: 1 }), to: [1] });
    s.players[0].resources.lumber = 1; // e.g. spent elsewhere
    expect(expectFail(s, 1, { type: 'respondTrade', tradeId: s.trade!.id, response: 'accept' })).toMatch(/no longer/);
  });

  it('supports reject, counteroffer and confirmation with multiple recipients', () => {
    let s = withCards(3);
    s = act(s, 0, { type: 'proposeTrade', give: R({ lumber: 1 }), get: R({ ore: 2 }), to: [1, 2] });
    const id = s.trade!.id;
    s = act(s, 2, { type: 'counterTrade', tradeId: id, give: R({ ore: 1 }), get: R({ lumber: 1 }) });
    s = act(s, 1, { type: 'respondTrade', tradeId: id, response: 'reject' });
    expect(s.trade!.responses).toEqual({ 1: 'rejected', 2: 'countered' });
    expect(expectFail(s, 0, { type: 'confirmTrade', tradeId: id, with: 1 })).toMatch(/not accepted/);
    s = act(s, 0, { type: 'confirmTrade', tradeId: id, with: 2 });
    expect(s.players[0].resources).toEqual(R({ lumber: 1, ore: 1 }));
    expect(s.players[2].resources).toEqual(R({ lumber: 1 }));
  });

  it('cancels pending trades at end of turn and rejects stale trade ids', () => {
    let s = withCards();
    s = act(s, 0, { type: 'proposeTrade', give: R({ lumber: 1 }), get: R({ ore: 1 }), to: [1] });
    const id = s.trade!.id;
    s = act(s, 0, { type: 'endTurn' });
    expect(s.trade).toBeNull();
    expect(expectFail(s, 1, { type: 'respondTrade', tradeId: id, response: 'accept' })).toMatch(/no longer/);
  });
});

describe('development cards', () => {
  function withCard(type: GameState['devDeck'][number], boughtTurn = 0): GameState {
    const s = mainPhaseGame();
    s.players[0].devCards.push({ type, boughtTurn });
    return s;
  }

  it('buys a card, which cannot be played the same turn', () => {
    let s = mainPhaseGame();
    setResources(s, 0, { wool: 1, grain: 1, ore: 1 });
    s.devDeck[0] = 'monopoly';
    s = act(s, 0, { type: 'buyDevCard' });
    expect(s.players[0].devCards).toEqual([{ type: 'monopoly', boughtTurn: s.turn }]);
    expect(s.devDeck).toHaveLength(24);
    expect(expectFail(s, 0, { type: 'playMonopoly', resource: 'ore' })).toMatch(/bought/);
  });

  it('house rule: a card bought this turn can be played right away (still one per turn)', () => {
    let s = mainPhaseGame();
    s.config.devCardsSameTurn = true;
    setResources(s, 0, { wool: 2, grain: 2, ore: 2 });
    s.devDeck[0] = 'monopoly';
    s.devDeck[1] = 'monopoly';
    s = act(s, 0, { type: 'buyDevCard' });
    s = act(s, 0, { type: 'playMonopoly', resource: 'ore' });
    expect(s.players[0].devCards).toHaveLength(0);
    s = act(s, 0, { type: 'buyDevCard' });
    expect(expectFail(s, 0, { type: 'playMonopoly', resource: 'ore' })).toMatch(/already played/);
  });

  it('fails to buy from an empty deck', () => {
    const s = mainPhaseGame();
    setResources(s, 0, { wool: 1, grain: 1, ore: 1 });
    s.devDeck = [];
    expect(expectFail(s, 0, { type: 'buyDevCard' })).toMatch(/empty/);
  });

  it('allows only one development card per turn', () => {
    let s = withCard('yearOfPlenty');
    s.players[0].devCards.push({ type: 'monopoly', boughtTurn: 0 });
    s = act(s, 0, { type: 'playYearOfPlenty', resources: ['ore', 'ore'] });
    expect(s.players[0].resources.ore).toBe(2);
    expect(expectFail(s, 0, { type: 'playMonopoly', resource: 'ore' })).toMatch(/already played/);
  });

  it('Year of Plenty respects bank supply', () => {
    const s = withCard('yearOfPlenty');
    s.bank.brick = 1;
    expect(expectFail(s, 0, { type: 'playYearOfPlenty', resources: ['brick', 'brick'] })).toMatch(/bank/);
    expect(s.players[0].devCards).toHaveLength(1);
  });

  it('Monopoly takes the resource from every opponent, even if they have none', () => {
    let s = mainPhaseGame(3);
    s.players[0].devCards.push({ type: 'monopoly', boughtTurn: 0 });
    setResources(s, 1, { grain: 3, ore: 1 });
    setResources(s, 2, { grain: 2 });
    s = act(s, 0, { type: 'playMonopoly', resource: 'grain' });
    expect(s.players[0].resources.grain).toBe(5);
    expect(s.players[1].resources).toEqual(R({ ore: 1 }));
    const again = mainPhaseGame();
    again.players[0].devCards.push({ type: 'monopoly', boughtTurn: 0 });
    const after = act(again, 0, { type: 'playMonopoly', resource: 'wool' });
    expect(totalRes(after.players[0].resources)).toBe(0);
  });

  it('Knight before rolling moves the robber and returns to PRE_ROLL', () => {
    let s = withCard('knight');
    s.phase = 'PRE_ROLL';
    s.hasRolled = false;
    s = act(s, 0, { type: 'playKnight' });
    expect(s.phase).toBe('ROBBER_MOVE');
    const hex = s.board.hexes.find((h) => h.id !== s.board.robberHex)!.id;
    s = act(s, 0, { type: 'moveRobber', hex });
    expect(s.phase).toBe('PRE_ROLL');
    expect(s.players[0].knightsPlayed).toBe(1);
    s = act(s, 0, { type: 'rollDice' });
    expect(s.hasRolled).toBe(true);
  });

  it('Road Building places up to two free roads', () => {
    let s = withCard('roadBuilding');
    placeBuilding(s, 0, 'v20');
    s = act(s, 0, { type: 'playRoadBuilding' });
    expect(s.freeRoads).toBe(2);
    expect(expectFail(s, 0, { type: 'endTurn' })).toMatch(/free roads/);
    const e1 = GRAPH.vertices.v20.edges[0];
    s = act(s, 0, { type: 'placeFreeRoad', edge: e1 });
    s = act(s, 0, { type: 'finishRoadBuilding' });
    expect(s.freeRoads).toBe(0);
    expect(s.players[0].roadsBuilt).toBe(1);
    expect(totalRes(s.players[0].resources)).toBe(0);
  });

  it('Road Building resolves with no roads when none can be placed', () => {
    let s = withCard('roadBuilding');
    s = act(s, 0, { type: 'playRoadBuilding' });
    expect(s.freeRoads).toBe(0);
  });

  it('a Victory Point card bought on your turn can win the game', () => {
    let s = mainPhaseGame();
    s.players[0].settlementsBuilt = 5;
    s.players[0].citiesBuilt = 4; // 1 + 8 = 9 VP
    setResources(s, 0, { wool: 1, grain: 1, ore: 1 });
    s.devDeck[0] = 'victoryPoint';
    expect(victoryPoints(s, 0)).toBe(9);
    s = act(s, 0, { type: 'buyDevCard' });
    expect(s.phase).toBe('GAME_OVER');
    expect(s.winner).toBe(0);
    expect(expectFail(s, 0, { type: 'endTurn' })).toMatch(/over/);
  });
});

describe('largest army and victory timing', () => {
  it('awards Largest Army at 3 knights and transfers only when strictly exceeded', () => {
    let s = mainPhaseGame();
    s.players[1].knightsPlayed = 3;
    s.largestArmy = 1;
    s.players[0].knightsPlayed = 2;
    s.players[0].devCards.push({ type: 'knight', boughtTurn: 0 });
    s = act(s, 0, { type: 'playKnight' });
    expect(s.largestArmy).toBe(1); // tie keeps holder
    s.players[0].knightsPlayed = 3;
    s.players[0].playedDevThisTurn = false;
    s.phase = 'MAIN_ACTIONS';
    s.players[0].devCards.push({ type: 'knight', boughtTurn: 0 });
    s = act(s, 0, { type: 'playKnight' });
    expect(s.largestArmy).toBe(0);
    expect(victoryPoints(s, 0)).toBe(2);
  });

  it('an inactive player at 10 points wins only when their turn starts', () => {
    let s = mainPhaseGame();
    s.players[1].settlementsBuilt = 5;
    s.players[1].citiesBuilt = 4;
    s.players[1].devCards.push({ type: 'victoryPoint', boughtTurn: 0 });
    expect(victoryPoints(s, 1)).toBe(10);
    expect(s.winner).toBeNull();
    s = act(s, 0, { type: 'endTurn' });
    expect(s.winner).toBe(1);
  });
});

describe('roads count for longest road', () => {
  it('awards Longest Road for 5 connected roads', () => {
    let s = mainPhaseGame();
    placeBuilding(s, 0, 'v20');
    const edges: string[] = [];
    let cur = 'v20';
    const seen = new Set([cur]);
    for (let i = 0; i < 4; i++) {
      const n = GRAPH.vertices[cur].neighbors.find((x) => !seen.has(x))!;
      const e = GRAPH.vertices[cur].edges.find((id) => GRAPH.edges[id].vertices.includes(n))!;
      placeRoadDirect(s, 0, e);
      edges.push(e);
      seen.add(n);
      cur = n;
    }
    setResources(s, 0, { lumber: 1, brick: 1 });
    const n = GRAPH.vertices[cur].neighbors.find((x) => !seen.has(x))!;
    const last = GRAPH.vertices[cur].edges.find((id) => GRAPH.edges[id].vertices.includes(n))!;
    s = act(s, 0, { type: 'buildRoad', edge: last });
    expect(s.longestRoad.holder).toBe(0);
    expect(s.longestRoad.lengths[0]).toBe(5);
    expect(victoryPoints(s, 0)).toBe(3);
  });
});
