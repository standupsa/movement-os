import { createHash } from 'node:crypto';
import {
  MISSION,
  PRINCIPLES,
  VERSION,
  CONTENT_SHA256,
  assertPinnedHash,
  type PrincipleId,
} from './principles.js';

describe('@sasa/principles', () => {
  describe('MISSION', () => {
    // AAA: Arrange / Act / Assert
    it('is the exact v0.1 locked sentence', () => {
      // Arrange / Act
      const expected =
        'We stand for equal protection, equal dignity, and accountable government for every South African — regardless of race, class, or politics.';

      // Assert
      expect(MISSION).toBe(expected);
    });
  });

  describe('PRINCIPLES', () => {
    it('contains all 8 principles in canonical order', () => {
      const expectedIds: readonly PrincipleId[] = [
        'non-racial',
        'constitutional',
        'non-violent',
        'truth-first',
        'disciplined',
        'endurance',
        'protection',
        'family-first',
      ];

      const actualIds = PRINCIPLES.map((p) => p.id);

      expect(actualIds).toEqual(expectedIds);
    });

    it('is frozen (cannot be mutated at runtime)', () => {
      expect(Object.isFrozen(PRINCIPLES)).toBe(true);
    });
  });

  describe('VERSION', () => {
    it('matches semver major.minor.patch', () => {
      expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('CONTENT_SHA256', () => {
    it('is a lowercase 64-char hex string', () => {
      expect(CONTENT_SHA256).toMatch(/^[0-9a-f]{64}$/);
    });

    it('matches the canonical JSON hash computed from the same inputs', () => {
      const canonical = JSON.stringify({
        mission: MISSION,
        principles: PRINCIPLES.map((p) => ({ id: p.id, text: p.text })),
        version: VERSION,
      });
      const expected = createHash('sha256').update(canonical, 'utf8').digest('hex');

      expect(CONTENT_SHA256).toBe(expected);
    });
  });

  describe('assertPinnedHash', () => {
    it('does not throw when the pinned hash matches the current hash', () => {
      expect(() => assertPinnedHash(CONTENT_SHA256)).not.toThrow();
    });

    it('throws a drift error when the pinned hash does not match', () => {
      const bogus = 'f'.repeat(64);

      expect(() => assertPinnedHash(bogus)).toThrow(/content hash mismatch/);
    });
  });
});
