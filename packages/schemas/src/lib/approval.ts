/**
 * Approval — the signed, named, timestamped human consent to publish an
 * Artefact. No approval, no publish. Ever.
 */

import { z } from 'zod';
import { ActorIdSchema, ApprovalIdSchema, ArtefactIdSchema } from './ids.js';
import { IsoTimestampSchema } from './common.js';

export const APPROVAL_ATTESTATION =
  'I have read this artefact in full and approve its publication under my name.' as const;

export const ApprovalSchema = z
  .object({
    id: ApprovalIdSchema,
    artefactId: ArtefactIdSchema,
    approvedBy: ActorIdSchema,
    approvedAt: IsoTimestampSchema,
    // Operator attests they have read the artefact in full.
    attestation: z.literal(APPROVAL_ATTESTATION),
  })
  .strict();
export type Approval = z.infer<typeof ApprovalSchema>;
