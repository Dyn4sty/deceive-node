/**
 * Proxied Connection - Handles bidirectional TLS proxy between
 * Riot Client and chat server, rewriting presence stanzas.
 *
 * Uses Bun's native socket types for better performance.
 */

import type { Socket } from 'bun';
import { EventEmitter } from 'events';
import { PresenceStatus } from '../types.js';
import { logger } from '../utils/logger.js';
import type { MainController } from '../controller.js';

// Fake player JID for in-app messaging
const FAKE_PLAYER_JID = '41c322a1-b328-495b-a004-5ccd3e45eae8@eu1.pvp.net';

interface ProxiedConnectionEvents {
  error: (err: Error) => void;
}

type SocketData = { proxiedConnection?: ProxiedConnection };

export class ProxiedConnection extends EventEmitter {
  private controller: MainController;
  private incoming: Socket<SocketData>;
  private outgoing: Socket<SocketData>;
  private connected = true;
  private lastPresence: string | null = null;
  private insertedFakePlayer = false;
  private sentFakePlayerPresence = false;
  private valorantVersion: string | null = null;

  constructor(
    controller: MainController,
    incoming: Socket<SocketData>,
    outgoing: Socket<SocketData>
  ) {
    super();
    this.controller = controller;
    this.incoming = incoming;
    this.outgoing = outgoing;
  }

  /**
   * Handle data from the Riot Client (incoming socket).
   * Called by the controller when data is received.
   */
  handleIncomingData(data: Buffer | Uint8Array): void {
    if (!this.connected) return;

    try {
      const content = Buffer.from(data).toString('utf-8');

      if (content.includes('<presence') && this.controller.isEnabled()) {
        logger.debug('Intercepting presence stanza');
        this.rewriteAndSendPresence(content, this.controller.getStatus());
      } else if (content.includes(FAKE_PLAYER_JID)) {
        void this.controller.handleChatMessage(content);
        logger.debug('Intercepted message to fake player');
      } else {
        this.outgoing.write(data);
      }

      // Send fake player presence after roster is received
      if (this.insertedFakePlayer && !this.sentFakePlayerPresence) {
        this.sendFakePlayerPresence();
      }
    } catch (err) {
      logger.error('Error handling incoming data:', err);
    }
  }

  /**
   * Handle data from the real chat server (outgoing socket).
   * Called by the controller when data is received.
   */
  handleOutgoingData(data: Buffer | Uint8Array): void {
    if (!this.connected) return;

    try {
      let content = Buffer.from(data).toString('utf-8');

      // Inject fake player into roster
      const roster = "<query xmlns='jabber:iq:riotgames:roster'>";
      if (!this.insertedFakePlayer && content.includes(roster)) {
        this.insertedFakePlayer = true;
        logger.debug('Injecting fake player into roster');

        const fakePlayer =
          `<item jid='${FAKE_PLAYER_JID}' name='&#9;Deceive Active!' subscription='both' puuid='41c322a1-b328-495b-a004-5ccd3e45eae8'>` +
          "<group priority='9999'>Deceive</group>" +
          '<state>online</state>' +
          "<id name='&#9;Deceive Active!' tagline='...'/>" +
          "<lol name='&#9;Deceive Active!'/>" +
          "<platforms><riot name='&#9;Deceive Active' tagline='...'/></platforms>" +
          '</item>';

        content = content.replace(roster, roster + fakePlayer);
        this.incoming.write(Buffer.from(content, 'utf-8'));
        return;
      }

      this.incoming.write(data);
    } catch (err) {
      logger.error('Error handling outgoing data:', err);
    }
  }

  /**
   * Handle connection close.
   * Called by the controller when either socket closes.
   */
  handleClose(): void {
    if (!this.connected) return;
    this.close();
  }

  private rewriteAndSendPresence(content: string, targetStatus: PresenceStatus): void {
    try {
      this.lastPresence = content;
      let modified = content;

      // Presence with 'to' is for MUC (lobby chat), leave those alone if connectToMuc is true
      if (this.controller.shouldConnectToMuc() && content.includes(' to=')) {
        this.outgoing.write(Buffer.from(content, 'utf-8'));
        return;
      }

      // Rewrite <show> element
      modified = modified.replace(/<show>[^<]*<\/show>/g, `<show>${targetStatus}</show>`);

      // Rewrite League of Legends status
      modified = modified.replace(
        /(<games>.*?<league_of_legends>.*?)<st>[^<]*<\/st>/gs,
        `$1<st>${targetStatus}</st>`
      );

      if (targetStatus !== PresenceStatus.Online) {
        // Remove <status> element
        modified = modified.replace(/<status>[^<]*<\/status>/g, '');

        if (targetStatus === PresenceStatus.Mobile) {
          modified = modified.replace(/<league_of_legends>.*?<p>[^<]*<\/p>/gs, (match) =>
            match.replace(/<p>[^<]*<\/p>/g, '')
          );
          modified = modified.replace(/<league_of_legends>.*?<m>[^<]*<\/m>/gs, (match) =>
            match.replace(/<m>[^<]*<\/m>/g, '')
          );
        } else {
          modified = modified.replace(/<league_of_legends>.*?<\/league_of_legends>/gs, '');
        }

        // Remove other game presences
        modified = modified.replace(/<bacon>.*?<\/bacon>/gs, '');
        modified = modified.replace(/<lion>.*?<\/lion>/gs, '');
        modified = modified.replace(/<keystone>.*?<\/keystone>/gs, '');
        modified = modified.replace(/<riot_client>.*?<\/riot_client>/gs, '');

        // Extract VALORANT version before removing
        if (!this.valorantVersion) {
          const valorantMatch = /<valorant>.*?<p>([^<]+)<\/p>/s.exec(modified);
          if (valorantMatch?.[1]) {
            try {
              const decoded = Buffer.from(valorantMatch[1], 'base64').toString('utf-8');
              const valorantData = JSON.parse(decoded) as Record<string, unknown>;
              const partyData = valorantData['partyPresenceData'] as
                | Record<string, unknown>
                | undefined;
              if (partyData?.['partyClientVersion']) {
                this.valorantVersion = partyData['partyClientVersion'] as string;
                logger.debug(`Found VALORANT version: ${this.valorantVersion}`);
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }

        modified = modified.replace(/<valorant>.*?<\/valorant>/gs, '');
      }

      this.outgoing.write(Buffer.from(modified, 'utf-8'));
      logger.debug('Sent modified presence');
    } catch (err) {
      logger.error('Error rewriting presence:', err);
      this.outgoing.write(Buffer.from(content, 'utf-8'));
    }
  }

  private sendFakePlayerPresence(): void {
    this.sentFakePlayerPresence = true;

    const valorantPresence = Buffer.from(
      JSON.stringify({
        isValid: true,
        partyId: '00000000-0000-0000-0000-000000000000',
        partyClientVersion: this.valorantVersion ?? 'unknown',
        accountLevel: 1000,
      })
    ).toString('base64');

    const randomStanzaId = crypto.randomUUID();
    const timestamp = Date.now();

    const presenceMessage =
      `<presence from='${FAKE_PLAYER_JID}/RC-Deceive' id='b-${randomStanzaId}'>` +
      '<games>' +
      `<keystone><st>chat</st><s.t>${timestamp}</s.t><s.p>keystone</s.p><pty/></keystone>` +
      `<league_of_legends><st>chat</st><s.t>${timestamp}</s.t><s.p>league_of_legends</s.p><s.c>live</s.c><p>{"pty":true}</p></league_of_legends>` +
      `<valorant><st>chat</st><s.t>${timestamp}</s.t><s.p>valorant</s.p><s.r>PC</s.r><p>${valorantPresence}</p><pty/></valorant>` +
      `<bacon><st>chat</st><s.t>${timestamp}</s.t><s.l>bacon_availability_online</s.l><s.p>bacon</s.p></bacon>` +
      '</games>' +
      '<show>chat</show>' +
      '<platform>riot</platform>' +
      '<status/>' +
      '</presence>';

    this.incoming.write(Buffer.from(presenceMessage, 'utf-8'));
    logger.debug('Sent fake player presence');
  }

  sendMessageFromFakePlayer(message: string): void {
    if (!this.insertedFakePlayer || !this.connected) {
      return;
    }

    const stamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const chatMessage =
      `<message from='${FAKE_PLAYER_JID}/RC-Deceive' stamp='${stamp}' id='fake-${stamp}' type='chat'>` +
      `<body>${message}</body>` +
      '</message>';

    this.incoming.write(Buffer.from(chatMessage, 'utf-8'));
    logger.debug(`Sent message from fake player: ${message}`);
  }

  updateStatus(newStatus: PresenceStatus): void {
    if (!this.lastPresence || !this.connected) {
      return;
    }
    this.rewriteAndSendPresence(this.lastPresence, newStatus);
  }

  close(): void {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    try {
      this.incoming.end();
    } catch {
      // Ignore errors on close
    }
    try {
      this.outgoing.end();
    } catch {
      // Ignore errors on close
    }
    this.emit('error', new Error('Connection closed'));
  }

  override on<K extends keyof ProxiedConnectionEvents>(
    event: K,
    listener: ProxiedConnectionEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof ProxiedConnectionEvents>(
    event: K,
    ...args: Parameters<ProxiedConnectionEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
