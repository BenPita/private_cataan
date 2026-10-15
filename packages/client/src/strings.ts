import type { DevCardType, Resource, Terrain } from '@hex/engine';

/**
 * All user-facing labels live here so another language (Hebrew) can be added
 * by providing a second dictionary.
 */
export const t = {
  appName: 'Hex Islands',
  tagline: 'Build, trade and settle the islands with your friends.',
  nickname: 'Your nickname',
  createGame: 'Create game',
  joinGame: 'Join game',
  humans: 'Human players',
  bots: 'AI bots',
  botsSoon: 'AI bots arrive in the next update',
  victoryTarget: 'Points to win',
  board: 'Board',
  randomBoard: 'Random (balanced)',
  beginnerBoard: 'Beginner (fixed)',
  invite: 'Invite link',
  copy: 'Copy',
  copied: 'Copied!',
  share: 'Share',
  ready: 'Ready',
  notReady: 'Not ready',
  start: 'Start game',
  waitingFor: 'Waiting for players…',
  emptySeat: 'Waiting for player…',
  host: 'Host',
  you: 'You',
  roll: 'Roll dice',
  endTurn: 'End turn',
  build: 'Build',
  trade: 'Trade',
  cards: 'Cards',
  cancel: 'Cancel',
  confirm: 'Confirm',
  close: 'Close',
  rematch: 'Rematch',
  home: 'Home',
  rules: 'How to play',
  settings: 'Settings',
  sound: 'Sound effects',
  rejoin: 'Rejoin link (use it to continue on another phone — keep it private)',
  offline: 'Reconnecting…',
  disconnected: 'offline',
};

export const RESOURCE_LABEL: Record<Resource, string> = {
  lumber: 'Lumber',
  brick: 'Brick',
  wool: 'Wool',
  grain: 'Grain',
  ore: 'Ore',
};

export const RESOURCE_ICON: Record<Resource, string> = {
  lumber: '🪵',
  brick: '🧱',
  wool: '🐑',
  grain: '🌾',
  ore: '🪨',
};

export const RESOURCE_COLOR: Record<Resource, string> = {
  lumber: '#2f7d3a',
  brick: '#c4572d',
  wool: '#8fcf5a',
  grain: '#e9b934',
  ore: '#7d8794',
};

export const TERRAIN_LABEL: Record<Terrain, string> = {
  forest: 'Forest',
  hills: 'Hills',
  pasture: 'Pasture',
  fields: 'Fields',
  mountains: 'Mountains',
  desert: 'Desert',
};

export const DEV_LABEL: Record<DevCardType, { name: string; text: string; icon: string }> = {
  knight: { name: 'Knight', text: 'Move the robber and steal a card. Counts toward Largest Army.', icon: '⚔️' },
  victoryPoint: { name: 'Victory Point', text: 'Worth 1 hidden point. Kept secret until the end.', icon: '🏆' },
  roadBuilding: { name: 'Road Building', text: 'Place up to 2 roads for free.', icon: '🛤️' },
  yearOfPlenty: { name: 'Year of Plenty', text: 'Take any 2 resources from the bank.', icon: '🎁' },
  monopoly: { name: 'Monopoly', text: 'Name a resource; every opponent gives you all of theirs.', icon: '💰' },
};
