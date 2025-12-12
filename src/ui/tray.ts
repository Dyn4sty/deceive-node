/**
 * System Tray Interface
 *
 * Implements system tray using systray2 library.
 */

import { PresenceStatus } from '../types.js';
import { logger } from '../utils/logger.js';
import { readFileSync, existsSync } from 'fs';
import SysTray from 'systray2';

// Import icon files for embedding in compiled executables
// @ts-expect-error - Icon files are embedded in the compiled executable
import offlineIconPath from '../../assets/icons/offline.ico' with { type: 'file' };
// @ts-expect-error - Icon files are embedded in the compiled executable
import mobileIconPath from '../../assets/icons/mobile.ico' with { type: 'file' };
// @ts-expect-error - Icon files are embedded in the compiled executable
import onlineIconPath from '../../assets/icons/online.ico' with { type: 'file' };

type StatusCallback = (status: PresenceStatus) => void;
type VoidCallback = () => void;

// Tray instance and state
let systrayInstance: unknown = null;
export let currentStatus: PresenceStatus = PresenceStatus.Offline;
let statusCallback: StatusCallback | null = null;
let quitCallback: VoidCallback | null = null;

// Menu item references for updating checked state
interface MenuItem {
  title: string;
  tooltip: string;
  checked: boolean;
  enabled: boolean;
  hidden?: boolean;
  click?: () => void;
}

let offlineItem: MenuItem;
let mobileItem: MenuItem;
let onlineItem: MenuItem;

/**
 * Get icon path for a given status
 * Returns embedded file paths when compiled, filesystem paths otherwise
 */
export function getIconPath(status: PresenceStatus): string {
  const iconMap: Record<PresenceStatus, string> = {
    [PresenceStatus.Offline]: offlineIconPath,
    [PresenceStatus.Mobile]: mobileIconPath,
    [PresenceStatus.Online]: onlineIconPath,
  };
  return iconMap[status] ?? iconMap[PresenceStatus.Offline];
}

/**
 * Get icon as base64 string for systray
 * Works with both embedded files (compiled) and filesystem paths (development)
 */
async function getIconBase64Async(status: PresenceStatus): Promise<string> {
  try {
    const iconPath = getIconPath(status);

    // Try Bun.file() first (works for both embedded and regular files)
    if (typeof Bun !== 'undefined' && Bun.file) {
      const file = Bun.file(iconPath);
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return buffer.toString('base64');
    }

    // Fallback to fs.readFileSync for compatibility
    if (existsSync(iconPath)) {
      const iconData = readFileSync(iconPath);
      return iconData.toString('base64');
    }
  } catch (err: unknown) {
    logger.debug(`Failed to load icon: ${err instanceof Error ? err.message : String(err)}`);
  }
  return '';
}

/**
 * Synchronous wrapper for getIconBase64Async
 * Note: Uses top-level await internally, only works in async contexts
 */
export function getIconBase64(status: PresenceStatus): string {
  try {
    const iconPath = getIconPath(status);

    // Try Bun.file() with sync methods
    if (typeof Bun !== 'undefined' && Bun.file) {
      // Bun.file() returns a Blob-like object, but we need sync access
      // For compiled executables, try reading directly
      const file = Bun.file(iconPath);
      // Use arrayBuffer which should work synchronously for embedded files
      return Buffer.from(file as unknown as ArrayBuffer).toString('base64');
    }

    // Fallback to fs.readFileSync
    if (existsSync(iconPath)) {
      const iconData = readFileSync(iconPath);
      return iconData.toString('base64');
    }
  } catch (err: unknown) {
    // If sync fails, we need async
    logger.debug(
      `Failed to load icon synchronously: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  return '';
}

/**
 * Update menu item checked states
 */
function updateMenuCheckedStates(newStatus: PresenceStatus): void {
  if (!systrayInstance) return;

  offlineItem.checked = newStatus === PresenceStatus.Offline;
  mobileItem.checked = newStatus === PresenceStatus.Mobile;
  onlineItem.checked = newStatus === PresenceStatus.Online;

  const systray = systrayInstance as {
    sendAction: (action: { type: string; item: MenuItem }) => void;
  };

  systray.sendAction({ type: 'update-item', item: offlineItem });
  systray.sendAction({ type: 'update-item', item: mobileItem });
  systray.sendAction({ type: 'update-item', item: onlineItem });
}

/**
 * Create system tray icon
 */
export async function createTray(
  initialStatus: PresenceStatus,
  onStatusChange: StatusCallback,
  _toggleCallback: VoidCallback,
  onQuit: VoidCallback
): Promise<void> {
  currentStatus = initialStatus;
  statusCallback = onStatusChange;
  quitCallback = onQuit;

  // Try to initialize systray
  try {
    // Dynamic import for systray2
    // Create menu items with click handlers
    offlineItem = {
      title: 'Offline',
      tooltip: 'Appear offline to friends',
      checked: initialStatus === PresenceStatus.Offline,
      enabled: true,
      click: () => {
        if (statusCallback) {
          statusCallback(PresenceStatus.Offline);
        }
      },
    };

    mobileItem = {
      title: 'Mobile',
      tooltip: 'Appear on mobile app',
      checked: initialStatus === PresenceStatus.Mobile,
      enabled: true,
      click: () => {
        if (statusCallback) {
          statusCallback(PresenceStatus.Mobile);
        }
      },
    };

    onlineItem = {
      title: 'Online',
      tooltip: 'Appear online',
      checked: initialStatus === PresenceStatus.Online,
      enabled: true,
      click: () => {
        if (statusCallback) {
          statusCallback(PresenceStatus.Online);
        }
      },
    };

    const separatorItem = {
      title: '<SEPARATOR>',
      tooltip: '',
      checked: false,
      enabled: true,
    };

    const quitItem = {
      title: 'Quit',
      tooltip: 'Exit League Deceiver',
      checked: false,
      enabled: true,
      click: () => {
        if (quitCallback) {
          quitCallback();
        }
      },
    };

    const iconBase64 = await getIconBase64Async(initialStatus);

    systrayInstance = new SysTray.default({
      menu: {
        icon: iconBase64,
        title: 'Deceive',
        tooltip: 'Deceive - Appear Offline',
        items: [offlineItem, mobileItem, onlineItem, separatorItem, quitItem],
      },
      debug: false,
      copyDir: true, // Important for bundled executables
    });

    const systray = systrayInstance as {
      onClick: (handler: (action: { item: MenuItem }) => void) => void;
      ready: () => Promise<void>;
    };

    systray.onClick((action) => {
      if (action.item.click) {
        action.item.click();
      }
    });

    systray
      .ready()
      .then(() => {
        logger.info('System tray initialized');
      })
      .catch((err: Error) => {
        logger.warn(`System tray failed to start: ${err.message}`);
        logger.info('Running in CLI mode. Use chat commands to change status.');
      });
  } catch (err) {
    logger.warn(
      `System tray initialization failed: ${err instanceof Error ? err.message : String(err)}`
    );
    logger.info(
      'Running in CLI mode. Commands: offline, online, mobile, enable, disable, status, help'
    );
  }
}

/**
 * Update tray status and icon
 */
export function updateTrayStatus(status: PresenceStatus): void {
  currentStatus = status;

  if (systrayInstance) {
    updateMenuCheckedStates(status);
    // Note: Updating the tray icon dynamically is complex with systray2
    // The checked states on menu items are the primary visual feedback
  }

  logger.debug(`Status updated: ${status}`);
}

/**
 * Destroy tray icon
 */
export function destroyTray(): void {
  if (systrayInstance) {
    try {
      const systray = systrayInstance as { kill: (exitNode: boolean) => void };
      systray.kill(false);
      systrayInstance = null;
    } catch (err) {
      logger.debug(`Error destroying tray: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  logger.debug('Tray destroyed');
}
