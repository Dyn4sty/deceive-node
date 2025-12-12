/**
 * Startup handler - orchestrates the application startup sequence
 */

import { createServer } from 'node:net';
import { LaunchGame, PresenceStatus, PRODUCT_NAMES, ChatServerConfig } from './types.js';
import { ConfigProxy } from './proxy/config-proxy.js';
import { MainController } from './controller.js';
import { getRiotClientPath, isClientRunning, killProcesses } from './launcher/process-manager.js';
import { launchRiotClient } from './launcher/game-launcher.js';
import { config } from './config/config.js';
import { logger } from './utils/logger.js';
import { promptForGame, promptForStatus } from './ui/cli.js';
import { VERSION } from './utils/version.js';

/**
 * Main entry point for starting Deceive
 */
export async function startDeceive(
  game: LaunchGame,
  statusStr: string | null,
  patchline: string,
  showTray: boolean
): Promise<void> {
  logger.info(`League Deceiver ${VERSION}`);

  // Convert status string to enum, or null for interactive prompt
  let status: PresenceStatus;
  if (statusStr === null) {
    // Will prompt later after game selection
    status = PresenceStatus.Offline; // Temporary, will be overwritten
  } else {
    const statusMap: Record<string, PresenceStatus> = {
      offline: PresenceStatus.Offline,
      online: PresenceStatus.Online,
      mobile: PresenceStatus.Mobile,
      chat: PresenceStatus.Online,
    };
    status = statusMap[statusStr.toLowerCase()] ?? PresenceStatus.Offline;
  }

  // Check if Riot Client is already running
  if (isClientRunning()) {
    logger.warn('Riot Client is already running.');
    logger.info('Attempting to stop existing Riot processes...');
    killProcesses();
    // Wait for processes to fully exit
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Find Riot Client path
  const riotClientPath = getRiotClientPath();
  if (!riotClientPath) {
    logger.error(
      'Unable to find Riot Client installation. Please launch any Riot game once, then try again.'
    );
    process.exit(1);
  }

  logger.info(`Found Riot Client at: ${riotClientPath}`);

  // Handle game selection
  if (game === LaunchGame.Auto) {
    game = config.get('defaultGame') ?? LaunchGame.Prompt;
  }

  if (game === LaunchGame.Prompt) {
    game = await promptForGame();
    if (game === LaunchGame.Prompt) {
      logger.info('No game selected, exiting.');
      process.exit(0);
    }
  }

  // Prompt for status if not provided via CLI
  if (statusStr === null) {
    status = await promptForStatus();
  }

  logger.info(
    `Status: ${status === PresenceStatus.Offline ? 'Offline' : status === PresenceStatus.Mobile ? 'Mobile' : 'Online'}`
  );

  // Step 1: Open a port for our chat proxy
  const chatListener = createServer();
  await new Promise<void>((resolve) => {
    chatListener.listen(0, '127.0.0.1', () => resolve());
  });
  const chatPort = (chatListener.address() as { port: number }).port;
  logger.info(`Chat proxy listening on port ${chatPort}`);

  // Step 2: Start config proxy
  const configProxy = new ConfigProxy(chatPort);
  await configProxy.start();
  logger.info(`Config proxy listening on port ${configProxy.port}`);

  // Step 3: Create main controller
  const mainController = new MainController(status, showTray);

  // Step 4: Listen for chat server configuration
  let servingClients = false;
  configProxy.on('patchedChatServer', (serverConfig: ChatServerConfig) => {
    logger.info(`Original chat server: ${serverConfig.chatHost}:${serverConfig.chatPort}`);

    if (!servingClients) {
      servingClients = true;
      mainController.startServingClients(
        chatListener,
        serverConfig.chatHost,
        serverConfig.chatPort
      );
    }
  });

  // Step 5: Launch Riot Client with our config proxy
  const product = PRODUCT_NAMES[game];
  launchRiotClient(riotClientPath, configProxy.port, product, patchline);

  // Keep the process running
  logger.info('Deceive is running. Press Ctrl+C to exit.');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down...');
    mainController.stop();
    configProxy.stop();
    chatListener.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    mainController.stop();
    configProxy.stop();
    chatListener.close();
    process.exit(0);
  });
}
