/**
 * Claim — a discrete, checkable assertion extracted from a canonical source.
 *
 * V3 shape (ADR-0004): bi-temporal provenance on every claim.
 *   - `assertedAt` replaces V2's `extractedAt` (same meaning, canonical
 *     name from ADR-0004 vocabulary).
 *   - `validFrom` / `validTo` carry the valid-time window (nullable).
 *   - `supersededBy` points to the claim that replaces this one, if any.
 *   - `sourceRef` replaces V2's bare `intakeId`: a discriminated union
 *     naming the canonical source this claim is grounded in. `intake`
 *     and `artefact` are supported in phase 1; `event` will be added
 *     once `@wsa/events` ships.
 *
 * Status vocabulary (V2 per ADR-0002) is unchanged. The V2 → V3 shape
 * migration lives in `./migrations/claim-v2-to-v3.ts`.
 */

import { z } from 'zod';
import { ArtefactIdSchema, ClaimIdSchema, IntakeIdSchema } from './ids.js';
import { BiTemporalFieldsObjectSchema, refineBiTemporal } from './common.js';

/**
 * Evidential-completeness status, per ADR-0002.
 *
 * The platform promises maximum evidential completeness, NOT conclusive
 * truth. `destroyed-or-missing-record-suspected` is a publishable finding in
 * its own right and must be assigned deliberately — never as a fallback.
 */
export const ClaimStatusSchema = z.enum([
  'conclusive',
  'high-confidence',
  'contested',
  'insufficient-record',
  'destroyed-or-missing-record-suspected',
]);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

export const ClaimExtractorSchema = z.enum([
  'agent:evidence-engine',
  'agent:evidence-intake',
  'agent:source-verifier',
  'human',
]);
export type ClaimExtractor = z.infer<typeof ClaimExtractorSchema>;

/**
 * Discriminated reference to the canonical source that grounds the claim.
 * Required on every claim (ADR-0004 — no claim without a source).
 */
export const ClaimSourceRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('intake'), id: IntakeIdSchema }).strict(),
  z.object({ kind: z.literal('artefact'), id: ArtefactIdSchema }).strict(),
]);
export type ClaimSourceRef = z.infer<typeof ClaimSourceRefSchema>;

const ClaimCoreSchema = z.object({
  id: ClaimIdSchema,
  text: z.string().min(10).max(600),
  extractedBy: ClaimExtractorSchema,
  status: ClaimStatusSchema,
  sourceRef: ClaimSourceRefSchema,
  supersededBy: ClaimIdSchema.optional(),
});

export const ClaimSchema = ClaimCoreSchema.merge(BiTemporalFieldsObjectSchema)
  .strict()
  .refine(refineBiTemporal, {
    message: 'validFrom must be <= validTo',
    path: ['validTo'],
  })
  .refine((c) => c.supersededBy === undefined || c.supersededBy !== c.id, {
    message: 'a claim cannot supersede itself',
    path: ['supersededBy'],
  });
export type Claim = z.infer<typeof ClaimSchema>;
