/**
 * CLI Interface - Command-line prompts and interactions
 */

import { createInterface } from 'readline';
import chalk from 'chalk';
import { LaunchGame, PresenceStatus } from '../types.js';

/**
 * Prompt user to select a game
 */
export async function promptForGame(): Promise<LaunchGame> {
  console.log('');
  console.log(chalk.bold('Select a game to launch:'));
  console.log('');
  console.log('  1. League of Legends');
  console.log('  2. VALORANT');
  console.log('  3. Legends of Runeterra');
  console.log('  4. 2XKO (Lion)');
  console.log('  5. Riot Client only');
  console.log('  0. Cancel');
  console.log('');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.cyan('Enter your choice (0-5): '), (answer) => {
      rl.close();

      switch (answer.trim()) {
        case '1':
          resolve(LaunchGame.LoL);
          break;
        case '2':
          resolve(LaunchGame.VALORANT);
          break;
        case '3':
          resolve(LaunchGame.LoR);
          break;
        case '4':
          resolve(LaunchGame.Lion);
          break;
        case '5':
          resolve(LaunchGame.RiotClient);
          break;
        default:
          resolve(LaunchGame.Prompt);
          break;
      }
    });
  });
}

/**
 * Prompt user to select a status
 */
export async function promptForStatus(): Promise<PresenceStatus> {
  console.log('');
  console.log(chalk.bold('Select your status:'));
  console.log('');
  console.log('  1. Offline (appear offline to friends)');
  console.log('  2. Mobile (appear on mobile app)');
  console.log('  3. Online (normal status)');
  console.log('');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(chalk.cyan('Enter your choice (1-3) [1]: '), (answer) => {
      rl.close();

      switch (answer.trim()) {
        case '2':
          resolve(PresenceStatus.Mobile);
          break;
        case '3':
          resolve(PresenceStatus.Online);
          break;
        case '1':
        default:
          resolve(PresenceStatus.Offline);
          break;
      }
    });
  });
}

/**
 * Display status message
 */
export function displayStatus(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Display error message
 */
export function displayError(message: string): void {
  console.log(chalk.red(`✗ ${message}`));
}

/**
 * Display warning message
 */
export function displayWarning(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}
