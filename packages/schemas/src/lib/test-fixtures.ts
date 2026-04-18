/**
 * Test fixtures shared across spec files. Built into the library output so
 * downstream packages can reuse `ulid(tag)` when wiring integration tests;
 * intentionally kept free of production domain logic.
 */

/**
 * Generate a syntactically valid, deterministic ULID from a tag string.
 * Crockford Base32 alphabet excludes I, L, O, U. Not a real ULID — do NOT
 * use in production code paths.
 */
export function ulid(tag: string): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const cleaned = tag
    .toUpperCase()
    .split('')
    .map((c) => (alphabet.includes(c) ? c : '0'))
    .join('');
  return ('0'.repeat(26 - cleaned.length) + cleaned).slice(-26);
}

export const ULID_REGEX: RegExp = /^[0-9A-HJKMNP-TV-Z]{26}$/;
