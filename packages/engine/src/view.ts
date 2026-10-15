import { cloneState, publicVictoryPoints, victoryPoints } from './game';
import type { LogKey, LogParams } from './log';
import { totalRes } from './resources';
import type { DevCard, GameState, LogEntry, PlayerState, ResMap } from './types';

export interface PublicPlayer {
  name: string;
  kind: PlayerState['kind'];
  difficulty?: PlayerState['difficulty'];
  color: string;
  resourceCount: number;
  devCardCount: number;
  knightsPlayed: number;
  roadsBuilt: number;
  settlementsBuilt: number;
  citiesBuilt: number;
  victoryPoints: number;
  /** Only present for the viewer themself (or for everyone once the game is over). */
  resources: ResMap | null;
  devCards: DevCard[] | null;
  playedDevThisTurn: boolean;
}

/**
 * What one participant is allowed to know. Contains no other player's
 * resources or dev cards, no deck order and no RNG seed.
 */
export interface PlayerView extends Omit<GameState, 'players' | 'devDeck' | 'rng' | 'log'> {
  me: number | null;
  players: PublicPlayer[];
  devDeckCount: number;
  log: LogItem[];
}

export interface LogItem {
  key: LogKey;
  params: LogParams;
  /** English text, handy for debugging. */
  msg: string;
}

export function getPlayerView(state: GameState, viewer: number | null): PlayerView {
  const reveal = state.phase === 'GAME_OVER';
  const { devDeck, rng, players, log, ...rest } = cloneState(state);
  void rng;
  return {
    ...rest,
    me: viewer,
    devDeckCount: devDeck.length,
    players: players.map((p, i): PublicPlayer => {
      const visible = reveal || i === viewer;
      return {
        name: p.name,
        kind: p.kind,
        difficulty: p.difficulty,
        color: p.color,
        resourceCount: totalRes(p.resources),
        devCardCount: p.devCards.length,
        knightsPlayed: p.knightsPlayed,
        roadsBuilt: p.roadsBuilt,
        settlementsBuilt: p.settlementsBuilt,
        citiesBuilt: p.citiesBuilt,
        victoryPoints: visible ? victoryPoints(state, i) : publicVictoryPoints(state, i),
        resources: visible ? p.resources : null,
        devCards: visible ? p.devCards : null,
        playedDevThisTurn: p.playedDevThisTurn,
      };
    }),
    log: log.map((entry: LogEntry): LogItem => {
      const e = entry.secret && viewer !== null && entry.secret.to.includes(viewer) ? entry.secret : entry;
      return { key: e.key, params: e.params, msg: e.msg };
    }),
  };
}
