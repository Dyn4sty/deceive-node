/**
 * Types tests
 */

import { describe, it, expect } from 'bun:test';
import { LaunchGame, PresenceStatus, PRODUCT_NAMES } from '../src/types.js';

describe('Types', () => {
  describe('LaunchGame', () => {
    it('should have correct enum values', () => {
      expect(LaunchGame.LoL).toBe('lol');
      expect(LaunchGame.VALORANT).toBe('valorant');
      expect(LaunchGame.LoR).toBe('lor');
      expect(LaunchGame.Lion).toBe('lion');
      expect(LaunchGame.RiotClient).toBe('riot-client');
      expect(LaunchGame.Prompt).toBe('prompt');
      expect(LaunchGame.Auto).toBe('auto');
    });
  });

  describe('PresenceStatus', () => {
    it('should have correct enum values', () => {
      expect(PresenceStatus.Online).toBe('chat');
      expect(PresenceStatus.Offline).toBe('offline');
      expect(PresenceStatus.Mobile).toBe('mobile');
    });
  });

  describe('PRODUCT_NAMES', () => {
    it('should map games to Riot product names', () => {
      expect(PRODUCT_NAMES[LaunchGame.LoL]).toBe('league_of_legends');
      expect(PRODUCT_NAMES[LaunchGame.VALORANT]).toBe('valorant');
      expect(PRODUCT_NAMES[LaunchGame.LoR]).toBe('bacon');
      expect(PRODUCT_NAMES[LaunchGame.Lion]).toBe('lion');
      expect(PRODUCT_NAMES[LaunchGame.RiotClient]).toBeNull();
    });
  });
});
