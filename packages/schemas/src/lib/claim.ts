/**
 * Claim — a discrete, checkable assertion extracted from Intake.
 *
 * Status vocabulary lives here (V2 per ADR-0002). V1 and its migration
 * helpers live in `./migrations/claim-status-v1-to-v2.ts`.
 */

import { z } from 'zod';
import { ClaimIdSchema, IntakeIdSchema } from './ids.js';
import { IsoTimestampSchema } from './common.js';

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
  'human',
  'agent:evidence-intake',
  'agent:source-verifier',
]);
export type ClaimExtractor = z.infer<typeof ClaimExtractorSchema>;

export const ClaimSchema = z
  .object({
    id: ClaimIdSchema,
    intakeId: IntakeIdSchema,
    text: z.string().min(10).max(600),
    extractedAt: IsoTimestampSchema,
    extractedBy: ClaimExtractorSchema,
    status: ClaimStatusSchema,
  })
  .strict();
export type Claim = z.infer<typeof ClaimSchema>;
