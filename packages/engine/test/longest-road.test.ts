import { describe, expect, it } from 'vitest';
import { GRAPH, longestRoadLength } from '../src';
import { act, mainPhaseGame, pathFrom, placeBuilding, placeRoadDirect, setResources } from './helpers';

describe('longest road length', () => {
  it('counts a simple path', () => {
    const s = mainPhaseGame();
    pathFrom('v20', 6).edges.forEach((e) => placeRoadDirect(s, 0, e));
    expect(longestRoadLength(s, 0)).toBe(6);
  });

  it('does not double count branches', () => {
    const s = mainPhaseGame();
    const { vertices, edges } = pathFrom('v20', 4);
    edges.forEach((e) => placeRoadDirect(s, 0, e));
    // A one-edge branch from the middle vertex.
    const mid = vertices[2];
    const branch = GRAPH.vertices[mid].edges.find((e) => !edges.includes(e))!;
    placeRoadDirect(s, 0, branch);
    expect(longestRoadLength(s, 0)).toBe(4);
  });

  it('counts a full hex loop as 6', () => {
    const s = mainPhaseGame();
    GRAPH.hexes[9].edges.forEach((e) => placeRoadDirect(s, 0, e));
    expect(longestRoadLength(s, 0)).toBe(6);
  });

  it('is interrupted by an opponent building but not by own buildings', () => {
    const s = mainPhaseGame();
    const { vertices, edges } = pathFrom('v20', 6);
    edges.forEach((e) => placeRoadDirect(s, 0, e));
    placeBuilding(s, 0, vertices[2]);
    expect(longestRoadLength(s, 0)).toBe(6);
    delete s.buildings[vertices[2]];
    placeBuilding(s, 1, vertices[3]);
    expect(longestRoadLength(s, 0)).toBe(3);
  });
});

describe('longest road ownership', () => {
  it('moves to a strictly longer road and is lost when broken', () => {
    let s = mainPhaseGame();
    const a = pathFrom('v0', 5);
    a.edges.forEach((e) => placeRoadDirect(s, 1, e));
    s.longestRoad = { holder: 1, lengths: [0, 5] };

    // Player 0 builds 5 elsewhere: tie keeps holder.
    const b = pathFrom('v53', 5);
    placeBuilding(s, 0, b.vertices[0]);
    b.edges.slice(0, 4).forEach((e) => placeRoadDirect(s, 0, e));
    setResources(s, 0, { lumber: 2, brick: 2, wool: 1, grain: 1 });
    s = act(s, 0, { type: 'buildRoad', edge: b.edges[4] });
    expect(s.longestRoad.holder).toBe(1);

    // Player 0 breaks player 1's road with a settlement in the middle of it.
    const breakAt = a.vertices[2];
    const spur = GRAPH.vertices[breakAt].edges.find((e) => !a.edges.includes(e))!;
    const spurOuter = GRAPH.edges[spur].vertices.find((v) => v !== breakAt)!;
    const feeder = GRAPH.vertices[spurOuter].edges.find((e) => e !== spur)!;
    placeRoadDirect(s, 0, feeder);
    placeRoadDirect(s, 0, spur);
    s = act(s, 0, { type: 'buildSettlement', vertex: breakAt });
    expect(s.longestRoad.lengths[1]).toBeLessThan(5);
    expect(s.longestRoad.holder).toBe(0);
  });

  it('transfers to the next-longest road when the holder is broken', () => {
    let s = mainPhaseGame(3);
    const a = pathFrom('v0', 7);
    a.edges.forEach((e) => placeRoadDirect(s, 1, e));
    const b = pathFrom('v53', 5);
    b.edges.forEach((e) => placeRoadDirect(s, 2, e));
    placeRoadDirect(s, 0, 'e40');
    s.longestRoad = { holder: 1, lengths: [0, 7, 5] };
    // Break player 1 at a vertex that splits it into 3 + 4... then into < 5.
    const breakAt = a.vertices[3];
    s.buildings[breakAt] = { owner: 0, type: 'settlement' };
    s.players[0].settlementsBuilt++;
    s.players[0].resources.lumber += 1;
    s.players[0].resources.brick += 1;
    // Trigger a recalculation via a legal road build next to player 0's settlement.
    const edge = GRAPH.vertices[breakAt].edges.find((e) => s.roads[e] === undefined);
    if (edge) {
      s = act(s, 0, { type: 'buildRoad', edge });
      expect(s.longestRoad.lengths[1]).toBe(4);
      expect(s.longestRoad.holder).toBe(2);
    }
  });
});
