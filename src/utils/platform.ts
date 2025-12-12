/**
 * Platform detection utilities
 */

import { platform } from 'os';

export type Platform = 'windows' | 'macos' | 'linux';

/**
 * Get the current platform
 */
export function getPlatform(): Platform {
  switch (platform()) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    default:
      return 'linux';
  }
}

/**
 * Check if running on Windows
 */
export function isWindows(): boolean {
  return platform() === 'win32';
}

/**
 * Check if running on macOS
 */
export function isMacOS(): boolean {
  return platform() === 'darwin';
}

/**
 * Check if running on Linux
 */
export function isLinux(): boolean {
  return platform() === 'linux';
}
