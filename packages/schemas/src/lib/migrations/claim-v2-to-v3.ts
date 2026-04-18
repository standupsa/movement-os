/**
 * Claim shape migration: V2 → V3 (ADR-0004).
 *
 * V2 shape (pre-ADR-0004):
 *   {
 *     id, intakeId, text, extractedAt, extractedBy, status
 *   }
 *
 * V3 shape (ADR-0004):
 *   {
 *     id, text, extractedBy, status,
 *     sourceRef: { kind: 'intake' | 'artefact', id },
 *     supersededBy?,
 *     assertedAt,                // renamed from extractedAt
 *     validFrom: null,           // unknown at migration time
 *     validTo:   null,           // unknown at migration time
 *   }
 *
 * This is a pure shape lift. It does NOT invent valid-time ranges — those
 * are genuinely unknown for legacy records and `null` is the correct
 * honest answer. Upstream code that knows the valid-time window can patch
 * it in with a separate write, which becomes a superseding V3 record,
 * not a mutation of this one.
 *
 * Reverse migration is intentionally lossy: V3 → V2 drops `validFrom`,
 * `validTo`, `supersededBy`, and requires `sourceRef.kind === 'intake'`
 * (artefact-backed claims have no V2 representation).
 */

import { z } from 'zod';
import {
  ClaimIdSchema,
  IntakeIdSchema,
} from '../ids.js';
import { IsoTimestampSchema } from '../common.js';
import {
  ClaimExtractorSchema,
  ClaimSchema,
  ClaimStatusSchema,
  type Claim,
} from '../claim.js';

/** Pre-ADR-0004 Claim shape. Kept here for migration callers only. */
export const ClaimV2Schema = z
  .object({
    id: ClaimIdSchema,
    intakeId: IntakeIdSchema,
    text: z.string().min(10).max(600),
    extractedAt: IsoTimestampSchema,
    extractedBy: ClaimExtractorSchema,
    status: ClaimStatusSchema,
  })
  .strict();
export type ClaimV2 = z.infer<typeof ClaimV2Schema>;

/**
 * Forward shape migration: V2 → V3. Pure. Total.
 *
 * Validates the input against V2, lifts into V3, then validates the
 * result against V3. Either validation failure throws.
 */
export function migrateClaimV2ToV3(input: ClaimV2): Claim {
  const v2 = ClaimV2Schema.parse(input);
  const v3Candidate = {
    id: v2.id,
    text: v2.text,
    extractedBy: v2.extractedBy,
    status: v2.status,
    sourceRef: { kind: 'intake' as const, id: v2.intakeId },
    assertedAt: v2.extractedAt,
    validFrom: null,
    validTo: null,
  };
  return ClaimSchema.parse(v3Candidate);
}

/**
 * Reverse shape migration: V3 → V2. Pure. Partial — throws when the V3
 * record cannot be represented in V2.
 *
 * Drops: validFrom, validTo, supersededBy.
 * Rejects: claims whose sourceRef.kind !== 'intake' (artefact-backed
 * claims have no V2 form).
 */
export function reverseClaimV3ToV2(input: Claim): ClaimV2 {
  const v3 = ClaimSchema.parse(input);
  if (v3.sourceRef.kind !== 'intake') {
    throw new Error(
      `claim ${v3.id} has sourceRef.kind="${v3.sourceRef.kind}" — no V2 representation`,
    );
  }
  const v2Candidate = {
    id: v3.id,
    intakeId: v3.sourceRef.id,
    text: v3.text,
    extractedAt: v3.assertedAt,
    extractedBy: v3.extractedBy,
    status: v3.status,
  };
  return ClaimV2Schema.parse(v2Candidate);
}
