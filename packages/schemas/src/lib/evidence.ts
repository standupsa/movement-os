/**
 * Evidence — a pointer to a primary source backing (or contradicting) a Claim.
 *
 * Evidence is itself a claim-shaped edge (asserting "this source supports
 * this claim") and therefore carries bi-temporal provenance per ADR-0004.
 *
 * Preference order when ranking candidates:
 *   court-record > government-publication > statssa > commission > news.
 *
 * The source is pinned by (`url`, `sha256`) — `sourceRef` on Claim is not
 * duplicated here because the source binding IS the url+content-hash pair.
 */

import { z } from 'zod';
import { ClaimIdSchema, EvidenceIdSchema } from './ids.js';
import {
  BiTemporalFieldsObjectSchema,
  Sha256HexSchema,
  refineBiTemporal,
} from './common.js';

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

const EvidenceCoreSchema = z.object({
  id: EvidenceIdSchema,
  claimId: ClaimIdSchema,
  kind: EvidenceKindSchema,
  url: z.string().url(),
  fetchedAt: z.string().datetime({ offset: true }),
  sha256: Sha256HexSchema,
  supports: EvidenceSupportSchema,
  note: z.string().max(500).optional(),
  supersededBy: EvidenceIdSchema.optional(),
});

export const EvidenceSchema = EvidenceCoreSchema.merge(
  BiTemporalFieldsObjectSchema,
)
  .strict()
  .refine(refineBiTemporal, {
    message: 'validFrom must be <= validTo',
    path: ['validTo'],
  })
  .refine(
    (e) => e.supersededBy === undefined || e.supersededBy !== e.id,
    {
      message: 'evidence cannot supersede itself',
      path: ['supersededBy'],
    },
  );
export type Evidence = z.infer<typeof EvidenceSchema>;
