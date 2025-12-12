#!/usr/bin/env node
/**
 * League Deceiver - Appear offline in League of Legends, VALORANT, and Legends of Runeterra
 *
 * A TypeScript/Node.js port of the original Deceive application.
 * https://github.com/molenzwiebel/Deceive
 */

import { program } from 'commander';
import { startDeceive } from './startup.js';
import { LaunchGame } from './types.js';
import { VERSION } from './utils/version.js';
import { logger } from './utils/logger.js';

program
  .name('league-deceiver')
  .description('Appear offline in League of Legends, VALORANT, and Legends of Runeterra')
  .version(VERSION);

program
  .command('launch')
  .description('Launch a game with offline status')
  .argument('[game]', 'Game to launch: lol, valorant, lor, lion, riot-client, or prompt', 'prompt')
  .option('-s, --status <status>', 'Initial status: offline, online, or mobile', 'offline')
  .option('-t, --tray', 'Show system tray icon', true)
  .option('-p, --patchline <patchline>', 'Patchline to use', 'live')
  .action(async (game: string, options: { status: string; tray: boolean; patchline: string }) => {
    const gameMap: Record<string, LaunchGame> = {
      lol: LaunchGame.LoL,
      valorant: LaunchGame.VALORANT,
      lor: LaunchGame.LoR,
      lion: LaunchGame.Lion,
      'riot-client': LaunchGame.RiotClient,
      prompt: LaunchGame.Prompt,
    };

    const launchGame = gameMap[game.toLowerCase()] ?? LaunchGame.Prompt;
    await startDeceive(launchGame, options.status, options.patchline, options.tray);
  });

program
  .command('setup')
  .description('Set up League Deceiver (generate certificates)')
  .action(async () => {
    const { setupCertificates } = await import('./proxy/certificate.js');
    setupCertificates();
  });

// If no arguments provided (double-clicked), launch with interactive prompt
if (process.argv.length === 2) {
  // Pass null for status to trigger interactive prompt
  startDeceive(LaunchGame.RiotClient, 'online', 'live', true).catch((err: unknown) => {
    logger.error(`Error starting Deceive: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
} else {
  program.parse();
}
