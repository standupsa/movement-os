/**
 * Evidence — a pointer to a primary source backing (or contradicting) a Claim.
 *
 * Preference order when ranking candidates:
 *   court-record > government-publication > statssa > commission > news.
 */

import { z } from 'zod';
import { ClaimIdSchema, EvidenceIdSchema } from './ids.js';
import { IsoTimestampSchema, Sha256HexSchema } from './common.js';

export const EvidenceKindSchema = z.enum([
  'court-record',
  'government-publication',
  'statssa',
  'commission',
  'news-article',
  'other',
]);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const EvidenceSupportSchema = z.enum([
  'supports',
  'contradicts',
  'inconclusive',
]);
export type EvidenceSupport = z.infer<typeof EvidenceSupportSchema>;

export const EvidenceSchema = z
  .object({
    id: EvidenceIdSchema,
    claimId: ClaimIdSchema,
    kind: EvidenceKindSchema,
    url: z.string().url(),
    fetchedAt: IsoTimestampSchema,
    sha256: Sha256HexSchema,
    supports: EvidenceSupportSchema,
    note: z.string().max(500).optional(),
  })
  .strict();
export type Evidence = z.infer<typeof EvidenceSchema>;
