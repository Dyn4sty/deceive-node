/**
 * Process Manager - Detect and manage game processes
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { isWindows, isMacOS } from '../utils/platform.js';
import { logger } from '../utils/logger.js';

const PROCESS_NAMES = ['RiotClientServices', 'LeagueClient', 'LoR', 'VALORANT-Win64-Shipping'];

/**
 * Check if any Riot client processes are running
 */
export function isClientRunning(): boolean {
  const processes = getRunningProcesses();
  return PROCESS_NAMES.some((name) =>
    processes.some((p) => p.toLowerCase().includes(name.toLowerCase()))
  );
}

/**
 * Get list of running processes
 */
function getRunningProcesses(): string[] {
  try {
    if (isWindows()) {
      const result = execSync('tasklist /fo csv /nh', { encoding: 'utf-8' });
      return result
        .split('\n')
        .map((line) => line.split(',')[0]?.replace(/"/g, '') ?? '')
        .filter(Boolean);
    } else {
      const result = execSync('ps -A -o comm=', { encoding: 'utf-8' });
      return result.split('\n').filter(Boolean);
    }
  } catch {
    return [];
  }
}

/**
 * Kill all Riot-related processes
 */
export function killProcesses(): void {
  logger.info('Stopping Riot processes...');

  for (const name of PROCESS_NAMES) {
    try {
      if (isWindows()) {
        spawnSync('taskkill', ['/f', '/im', `${name}.exe`], { stdio: 'ignore' });
      } else {
        spawnSync('pkill', ['-9', name], { stdio: 'ignore' });
      }
    } catch {
      // Ignore errors - process may not be running
    }
  }
}

/**
 * Get the path to the Riot Client executable
 */
export function getRiotClientPath(): string | null {
  if (isWindows()) {
    return getWindowsRiotClientPath();
  } else if (isMacOS()) {
    return getMacOSRiotClientPath();
  } else {
    return getLinuxRiotClientPath();
  }
}

function getWindowsRiotClientPath(): string | null {
  // Check RiotClientInstalls.json
  const installPath = join(
    process.env.PROGRAMDATA ?? 'C:\\ProgramData',
    'Riot Games',
    'RiotClientInstalls.json'
  );

  if (!existsSync(installPath)) {
    logger.debug(`RiotClientInstalls.json not found at ${installPath}`);
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(installPath, 'utf-8')) as Record<string, unknown>;
    const candidates = [data['rc_default'], data['rc_live'], data['rc_beta']].filter(
      (p): p is string => typeof p === 'string' && existsSync(p)
    );

    if (candidates.length > 0) {
      return candidates[0];
    }
  } catch (err) {
    logger.error('Failed to parse RiotClientInstalls.json:', err);
  }

  return null;
}

function getMacOSRiotClientPath(): string | null {
  const paths = [
    '/Applications/Riot Client.app/Contents/MacOS/RiotClientServices',
    join(process.env.HOME ?? '', 'Applications/Riot Client.app/Contents/MacOS/RiotClientServices'),
  ];

  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

function getLinuxRiotClientPath(): string | null {
  // Linux typically uses Wine/Lutris - check common locations
  // const home = process.env.HOME ?? '';
  // const paths = [join(home, '.local/share/lutris/runners/wine'), join(home, 'Games/riot-games')];

  // For Linux, we'd need to find the Wine prefix and executable
  // This is complex and varies by setup - return null for now
  logger.warn('Linux support is limited. Please ensure Riot Client is accessible.');
  return null;
}

/**
 * Get the currently running Riot Client process
 */
export function getRiotClientProcess(): string | null {
  const processes = getRunningProcesses();
  return processes.find((p) => p.toLowerCase().includes('riotclientservices')) ?? null;
}
