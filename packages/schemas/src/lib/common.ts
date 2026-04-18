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

/**
 * Bi-temporal provenance per ADR-0004.
 *
 * Every factual edge in the evidence graph (Claim, Evidence, and any future
 * Attribution/Relationship entity) carries three time anchors:
 *
 *   assertedAt — wall-clock moment the platform committed this assertion
 *                to the record. System (transaction) time. Immutable; the
 *                only way it "changes" is via `supersededBy` on a *new*
 *                record.
 *   validFrom  — moment the claim is believed to become true in the
 *                world. Valid time. `null` means "unknown start".
 *   validTo    — moment the claim ceases to be true. `null` means
 *                "ongoing or unknown end".
 *
 * Cross-field rule: when both `validFrom` and `validTo` are set,
 * `validFrom <= validTo`.
 *
 * This primitive is merged into entity schemas via `.merge()`. The
 * supersession pointer (`supersededBy`) is entity-typed and stays on the
 * owning schema — bi-temporal is a shared shape, supersession is not.
 */
export const BiTemporalFieldsSchema = z
  .object({
    assertedAt: IsoTimestampSchema,
    validFrom: IsoTimestampSchema.nullable(),
    validTo: IsoTimestampSchema.nullable(),
  })
  .refine(
    (v) => {
      if (v.validFrom === null || v.validTo === null) {
        return true;
      }
      return v.validFrom <= v.validTo;
    },
    { message: 'validFrom must be <= validTo', path: ['validTo'] },
  );
export type BiTemporalFields = z.infer<typeof BiTemporalFieldsSchema>;

/**
 * Plain-object form of the bi-temporal fields for use with `.merge()`.
 * Refinement is applied at the entity level after the merge so per-entity
 * cross-field rules compose with the bi-temporal rule.
 */
export const BiTemporalFieldsObjectSchema = z.object({
  assertedAt: IsoTimestampSchema,
  validFrom: IsoTimestampSchema.nullable(),
  validTo: IsoTimestampSchema.nullable(),
});

/** Shared refinement: validFrom <= validTo when both are set. */
export function refineBiTemporal(v: BiTemporalFields): boolean {
  if (v.validFrom === null || v.validTo === null) {
    return true;
  }
  return v.validFrom <= v.validTo;
}
