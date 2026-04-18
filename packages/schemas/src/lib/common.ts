/**
 * Shared primitives used across schemas: timestamps, hashes, lawful basis.
 */

import { z } from 'zod';

/**
 * ISO-8601 timestamp with an explicit offset. Deliberately requires an offset
 * so timestamps across agents and humans in different timezones are directly
 * comparable and the audit log is not ambiguous.
 */
export const IsoTimestampSchema = z.string().datetime({ offset: true });
export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;

export const Sha256HexSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, 'expected a 64-char lower-case hex sha256');
export type Sha256Hex = z.infer<typeof Sha256HexSchema>;

/**
 * POPIA: every persisted record carries an explicit lawful basis for
 * processing the personal information it touches.
 */
export const LawfulBasisSchema = z.enum([
  'consent',
  'public-interest',
  'legal-obligation',
]);
export type LawfulBasis = z.infer<typeof LawfulBasisSchema>;

/**
 * BCP-47-ish language code, restricted to the subset the platform actually
 * supports at v1: two- or three-letter primary code, optional two-letter
 * region (e.g. 'en', 'af', 'zu', 'xh', 'st', 'en-ZA'). Intentionally narrow;
 * widen via a follow-up ADR if a new language is added.
 */
export const LanguageCodeSchema = z
  .string()
  .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, 'expected a BCP-47 language code');
export type LanguageCode = z.infer<typeof LanguageCodeSchema>;
