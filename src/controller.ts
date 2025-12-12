/**
 * Main Controller - Manages chat proxy connections and status
 */

import { Server, Socket } from 'net';
import tls from 'tls';
import { PresenceStatus } from './types.js';
import { ProxiedConnection } from './proxy/proxied-connection.js';
import { getCertificate } from './proxy/certificate.js';
import { logger } from './utils/logger.js';
import { createTray, updateTrayStatus, destroyTray } from './ui/tray.js';

export class MainController {
  private status: PresenceStatus;
  private enabled = true;
  private connectToMuc = true;
  private connections: ProxiedConnection[] = [];
  private showTray: boolean;
  private shutdownTimer: NodeJS.Timeout | null = null;

  constructor(initialStatus: PresenceStatus, showTray: boolean) {
    this.status = initialStatus;
    this.showTray = showTray;

    if (showTray) {
      this.initTray();
    }

    logger.info(`Initial status: ${this.status}`);
  }

  private initTray(): void {
    createTray(
      this.status,
      (newStatus) => {
        void this.setStatus(newStatus);
      },
      () => {
        void this.toggleEnabled();
      },
      () => {
        void this.quit();
      }
    );
  }

  /**
   * Start accepting and proxying client connections
   */
  startServingClients(server: Server, chatHost: string, chatPort: number): void {
    const cert = getCertificate();

    server.on('connection', (socket: Socket) => {
      void (async () => {
        try {
          // Cancel shutdown timer if we get a new connection
          if (this.shutdownTimer) {
            clearTimeout(this.shutdownTimer);
            this.shutdownTimer = null;
          }

          logger.debug('New incoming connection');

          // Wrap incoming connection with TLS
          const tlsOptions: tls.TLSSocketOptions = {
            key: cert.privateKey,
            cert: cert.certificate,
            isServer: true,
          };

          const tlsSocket = new tls.TLSSocket(socket, tlsOptions);

          // Connect to real chat server
          const outgoing = tls.connect(chatPort, chatHost, {
            rejectUnauthorized: false,
          });

          await new Promise<void>((resolve, reject) => {
            outgoing.once('secureConnect', resolve);
            outgoing.once('error', reject);
          });

          // Create proxied connection
          const proxiedConnection = new ProxiedConnection(this, tlsSocket, outgoing);
          proxiedConnection.start();

          proxiedConnection.on('error', () => {
            logger.debug('Connection closed');
            this.connections = this.connections.filter((c) => c !== proxiedConnection);

            if (this.connections.length === 0) {
              this.scheduleShutdown();
            }
          });

          this.connections.push(proxiedConnection);
        } catch (error) {
          logger.error('Failed to handle incoming connection:', error);
        }
      })();
    });
  }

  private scheduleShutdown(): void {
    // Shutdown after 60 seconds of no connections
    this.shutdownTimer = setTimeout(() => {
      logger.info('No connections for 60s, shutting down');
      this.quit();
    }, 60000);
  }

  getStatus(): PresenceStatus {
    return this.status;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  shouldConnectToMuc(): boolean {
    return this.connectToMuc;
  }

  setStatus(newStatus: PresenceStatus): void {
    this.status = newStatus;
    this.enabled = true;
    logger.info(`Status changed to: ${newStatus}`);

    if (this.showTray) {
      updateTrayStatus(newStatus);
    }

    // Update all connections
    for (const connection of this.connections) {
      connection.updateStatus(newStatus);
    }

    // Send message from fake player
    const statusText = newStatus === PresenceStatus.Online ? 'online' : newStatus;
    this.sendMessageFromFakePlayer(`You are now appearing ${statusText}.`);
  }

  toggleEnabled(): void {
    this.enabled = !this.enabled;
    const status = this.enabled ? this.status : PresenceStatus.Online;

    for (const connection of this.connections) {
      connection.updateStatus(status);
    }

    this.sendMessageFromFakePlayer(
      this.enabled ? 'Deceive is now enabled.' : 'Deceive is now disabled.'
    );
  }

  sendMessageFromFakePlayer(message: string): void {
    for (const connection of this.connections) {
      connection.sendMessageFromFakePlayer(message);
    }
  }

  handleChatMessage(content: string): void {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('offline')) {
      this.setStatus(PresenceStatus.Offline);
    } else if (lowerContent.includes('mobile')) {
      this.setStatus(PresenceStatus.Mobile);
    } else if (lowerContent.includes('online')) {
      this.setStatus(PresenceStatus.Online);
    } else if (lowerContent.includes('enable')) {
      if (!this.enabled) {
        this.toggleEnabled();
      } else {
        this.sendMessageFromFakePlayer('Deceive is already enabled.');
      }
    } else if (lowerContent.includes('disable')) {
      if (this.enabled) {
        this.toggleEnabled();
      } else {
        this.sendMessageFromFakePlayer('Deceive is already disabled.');
      }
    } else if (lowerContent.includes('status')) {
      const statusText = this.status === PresenceStatus.Online ? 'online' : this.status;
      this.sendMessageFromFakePlayer(`You are appearing ${statusText}.`);
    } else if (lowerContent.includes('help')) {
      this.sendMessageFromFakePlayer(
        'Commands: online, offline, mobile, enable, disable, status, help'
      );
    }
  }

  stop(): void {
    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
    }

    for (const connection of this.connections) {
      connection.close();
    }

    if (this.showTray) {
      destroyTray();
    }
  }

  quit(): void {
    this.stop();
    process.exit(0);
  }
}
