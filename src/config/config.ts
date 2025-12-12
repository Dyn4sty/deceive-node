/**
 * Configuration management using conf
 */

import Conf from 'conf';
import { LaunchGame, PresenceStatus, AppConfig } from '../types.js';

const schema = {
  defaultGame: {
    type: 'string' as const,
    default: LaunchGame.Prompt,
  },
  defaultStatus: {
    type: 'string' as const,
    default: PresenceStatus.Offline,
  },
  lastPromptedVersion: {
    type: 'string' as const,
    default: '',
  },
  connectToMuc: {
    type: 'boolean' as const,
    default: true,
  },
};

export const config = new Conf<AppConfig>({
  projectName: 'league-deceiver',
  schema,
});

/**
 * Get the data directory path
 */
export function getDataDir(): string {
  return config.path.replace(/config\.json$/, '');
}
