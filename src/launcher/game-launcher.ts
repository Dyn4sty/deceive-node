/**
 * Game Launcher - Launch Riot games with proxy configuration
 */

import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

/**
 * Launch Riot Client with our config proxy
 */
export function launchRiotClient(
  riotClientPath: string,
  configProxyPort: number,
  product: string | null,
  patchline: string
) {
  const args: string[] = [`--client-config-url=http://127.0.0.1:${configProxyPort}`];

  if (product) {
    args.push(`--launch-product=${product}`);
    args.push(`--launch-patchline=${patchline}`);
  }

  logger.info(`Launching Riot Client with args: ${args.join(' ')}`);

  const process = spawn(riotClientPath, args, {
    detached: true,
    stdio: 'ignore',
  });

  process.unref();

  // Listen for process exit
  process.on('exit', (code) => {
    if (code !== null && code !== 0) {
      logger.warn(`Riot Client exited with code ${code}`);
    }
  });

  process.on('error', (err) => {
    logger.error('Failed to launch Riot Client:', err);
  });

  logger.info('Riot Client launched successfully');
}
