/**
 * Config Proxy - Intercepts Riot Client configuration requests
 * and rewrites chat server addresses to point to localhost
 *
 * Uses Bun's native HTTP server for better performance
 */

import { EventEmitter } from 'events';
import { ChatServerConfig } from '../types.js';
import { logger } from '../utils/logger.js';

const CONFIG_URL = 'https://clientconfig.rpg.riotgames.com';
const GEO_PAS_URL = 'https://riot-geo.pas.si.riotgames.com/pas/v1/service/chat';

interface ConfigProxyEvents {
  patchedChatServer: (config: ChatServerConfig) => void;
}

export class ConfigProxy extends EventEmitter {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private _port: number = 0;
  private chatPort: number;

  constructor(chatPort: number) {
    super();
    this.chatPort = chatPort;
  }

  get port(): number {
    return this._port;
  }

  start(): void {
    // Use port 0 to get a random available port
    this.server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      fetch: async (req) => {
        return this.handleRequest(req);
      },
    });

    this._port = this.server.port!;
    logger.debug(`Config proxy started on port ${this._port}`);
  }

  stop(): void {
    if (this.server) {
      void this.server.stop().then(() => {
        this.server = null;
      });
    }
  }

  private async handleRequest(req: Request): Promise<Response> {
    const reqUrl = new URL(req.url);
    const url = `${CONFIG_URL}${reqUrl.pathname}${reqUrl.search}`;
    logger.debug(`Proxying request: ${url}`);

    try {
      // Forward request to Riot's config server
      const headers: Record<string, string> = {
        'User-Agent': req.headers.get('user-agent') ?? 'LeagueDeceiver',
      };

      // Copy authorization headers
      const entitlementsJwt = req.headers.get('x-riot-entitlements-jwt');
      if (entitlementsJwt) {
        headers['X-Riot-Entitlements-JWT'] = entitlementsJwt;
      }
      const authorization = req.headers.get('authorization');
      if (authorization) {
        headers['Authorization'] = authorization;
      }

      const response = await fetch(url, { headers });
      const content = await response.text();

      logger.debug(`Response status: ${response.status}`);

      if (!response.ok) {
        // Forward error response as-is
        return new Response(content, {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
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
            authorization
          ) {
            try {
              const pasResponse = await fetch(GEO_PAS_URL, {
                headers: { Authorization: authorization },
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

      return new Response(modifiedContent, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      logger.error('Proxy request failed:', err);
      return new Response('Bad Gateway', { status: 502 });
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
