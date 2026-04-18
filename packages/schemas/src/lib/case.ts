/**
 * Case — the top-level container for persistent pursuit, per ADR-0002.
 *
 * The lifecycle deliberately has NO `abandoned` state. A case is either
 * active, paused on an external actor, resolved with a finding, resolved
 * with insufficient evidence (preserved, not closed), or carries a
 * `destroyed-or-missing-record-suspected` finding which is itself a
 * publishable claim.
 */

import { z } from 'zod';
import { CaseIdSchema } from './ids.js';
import { IsoTimestampSchema, Sha256HexSchema } from './common.js';

/**
 * Lifecycle states. `abandoned` is never a valid value here; that is a
 * load-bearing regression check in the spec.
 */
export const CaseStatusSchema = z.enum([
  'active',
  'paused-awaiting',
  'resolved-with-finding',
  'resolved-insufficient-evidence',
  'destroyed-or-missing-record-suspected',
]);
export type CaseStatus = z.infer<typeof CaseStatusSchema>;

export const CaseSchema = z
  .object({
    caseId: CaseIdSchema,
    title: z.string().min(1).max(200),
    summary: z.string().min(1).max(4000),
    status: CaseStatusSchema,
    // SHA-256 of @sasa/principles at case creation; re-verified at mutation.
    principlesHash: Sha256HexSchema,
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
    // Only meaningful when status === 'paused-awaiting'; parser does not
    // enforce this cross-field invariant — do so in the case-engine layer.
    pausedUntil: IsoTimestampSchema.optional(),
  })
  .strict();
export type Case = z.infer<typeof CaseSchema>;
