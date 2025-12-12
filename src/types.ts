/**
 * Which game to automatically launch when Deceive is started.
 */
export enum LaunchGame {
  /** Attempt to start League of Legends */
  LoL = 'lol',
  /** Attempt to start Legends of Runeterra */
  LoR = 'lor',
  /** Attempt to start VALORANT */
  VALORANT = 'valorant',
  /** Attempt to launch Lion (2XKO) */
  Lion = 'lion',
  /** Attempt to launch the Riot Client */
  RiotClient = 'riot-client',
  /** Display a dialog asking which game to launch */
  Prompt = 'prompt',
  /** Automatically pick which game to launch */
  Auto = 'auto',
}

/**
 * Presence status options
 */
export enum PresenceStatus {
  Online = 'chat',
  Offline = 'offline',
  Mobile = 'mobile',
}

/**
 * Chat server configuration from Riot
 */
export interface ChatServerConfig {
  chatHost: string;
  chatPort: number;
}

/**
 * Application configuration stored on disk
 */
export interface AppConfig {
  defaultGame: LaunchGame;
  defaultStatus: PresenceStatus;
  lastPromptedVersion: string;
  connectToMuc: boolean;
}

/**
 * Product names used by Riot Client
 */
export const PRODUCT_NAMES: Record<LaunchGame, string | null> = {
  [LaunchGame.LoL]: 'league_of_legends',
  [LaunchGame.LoR]: 'bacon',
  [LaunchGame.VALORANT]: 'valorant',
  [LaunchGame.Lion]: 'lion',
  [LaunchGame.RiotClient]: null,
  [LaunchGame.Prompt]: null,
  [LaunchGame.Auto]: null,
};
