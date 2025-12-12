/**
 * Config Proxy - Intercepts Riot Client configuration requests
 * and rewrites chat server addresses to point to localhost
 */

import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { EventEmitter } from 'events';
import { ChatServerConfig } from '../types.js';
import { logger } from '../utils/logger.js';

const CONFIG_URL = 'https://clientconfig.rpg.riotgames.com';
const GEO_PAS_URL = 'https://riot-geo.pas.si.riotgames.com/pas/v1/service/chat';

interface ConfigProxyEvents {
  patchedChatServer: (config: ChatServerConfig) => void;
}

export class ConfigProxy extends EventEmitter {
  private server: Server;
  private _port: number = 0;
  private chatPort: number;

  constructor(chatPort: number) {
    super();
    this.chatPort = chatPort;
    this.server = createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        logger.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      });
    });
  }

  get port(): number {
    return this._port;
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server.address();
        if (address && typeof address === 'object') {
          this._port = address.port;
        }
        resolve();
      });
    });
  }

  stop(): void {
    this.server.close();
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = `${CONFIG_URL}${req.url}`;
    logger.debug(`Proxying request: ${url}`);

    try {
      // Forward request to Riot's config server
      const headers: Record<string, string> = {
        'User-Agent': req.headers['user-agent'] ?? 'LeagueDeceiver',
      };

      // Copy authorization headers
      if (req.headers['x-riot-entitlements-jwt']) {
        headers['X-Riot-Entitlements-JWT'] = String(req.headers['x-riot-entitlements-jwt']);
      }
      if (req.headers['authorization']) {
        headers['Authorization'] = String(req.headers['authorization']);
      }

      const response = await fetch(url, { headers });
      const content = await response.text();

      logger.debug(`Response status: ${response.status}`);

      if (!response.ok) {
        // Forward error response as-is
        res.statusCode = response.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(content);
        return;
      }

      // Parse and modify the config
      let modifiedContent = content;
      try {
        const config = JSON.parse(content) as Record<string, unknown>;
        let riotChatHost: string | null = null;
        let riotChatPort = 0;

        // Rewrite chat.host to localhost
        if ('chat.host' in config && typeof config['chat.host'] === 'string') {
          riotChatHost = config['chat.host'];
          config['chat.host'] = '127.0.0.1';
        }

        // Rewrite chat.port to our proxy port
        if ('chat.port' in config && typeof config['chat.port'] === 'number') {
          riotChatPort = config['chat.port'];
          config['chat.port'] = this.chatPort;
        }

        // Rewrite all chat.affinities to localhost
        if ('chat.affinities' in config && typeof config['chat.affinities'] === 'object') {
          const affinities = config['chat.affinities'] as Record<string, string>;

          // Try to get player's affinity for the real chat host
          if (
            'chat.affinity.enabled' in config &&
            config['chat.affinity.enabled'] === true &&
            req.headers['authorization']
          ) {
            try {
              const pasResponse = await fetch(GEO_PAS_URL, {
                headers: { Authorization: String(req.headers['authorization']) },
              });
              const pasJwt = await pasResponse.text();
              const pasJwtParts = pasJwt.split('.');
              if (pasJwtParts.length >= 2) {
                const pasPayload = JSON.parse(
                  Buffer.from(pasJwtParts[1], 'base64').toString()
                ) as Record<string, unknown>;
                const affinity = pasPayload['affinity'] as string | undefined;
                if (affinity && affinities[affinity]) {
                  riotChatHost = affinities[affinity];
                  logger.debug(`Player affinity: ${affinity} -> ${riotChatHost}`);
                }
              }
            } catch {
              logger.debug('Failed to get player affinity, using default chat server');
            }
          }

          // Rewrite all affinities to localhost
          for (const key of Object.keys(affinities)) {
            affinities[key] = '127.0.0.1';
          }
        }

        // Allow bad certificates (for our self-signed cert)
        if ('chat.allow_bad_cert.enabled' in config) {
          config['chat.allow_bad_cert.enabled'] = true;
        }

        modifiedContent = JSON.stringify(config);
        logger.debug('Config modified successfully');

        // Emit event with original chat server details
        if (riotChatHost && riotChatPort) {
          this.emit('patchedChatServer', {
            chatHost: riotChatHost,
            chatPort: riotChatPort,
          } satisfies ChatServerConfig);
        }
      } catch (err) {
        logger.error('Failed to parse/modify config:', err);
        // Return original content on error
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(modifiedContent);
    } catch (err) {
      logger.error('Proxy request failed:', err);
      res.statusCode = 502;
      res.end('Bad Gateway');
    }
  }

  // Type-safe event emitter methods
  override on<K extends keyof ConfigProxyEvents>(event: K, listener: ConfigProxyEvents[K]): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof ConfigProxyEvents>(
    event: K,
    ...args: Parameters<ConfigProxyEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
