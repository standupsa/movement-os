/**
 * Artefact — any outbound content produced by the platform.
 *
 * Post, letter, brief, video script. Every Artefact requires a matching
 * Approval before it may be published.
 */

import { z } from 'zod';
import { ArtefactIdSchema, ClaimIdSchema } from './ids.js';
import { IsoTimestampSchema, Sha256HexSchema } from './common.js';

export const ArtefactKindSchema = z.enum([
  'post',
  'statement',
  'letter',
  'brief',
  'video-script',
]);
export type ArtefactKind = z.infer<typeof ArtefactKindSchema>;

export const ArtefactCreatorSchema = z.enum([
  'human',
  'agent:media-drafter',
  'agent:campaign-brief',
  'agent:translator',
]);
export type ArtefactCreator = z.infer<typeof ArtefactCreatorSchema>;

export const ArtefactSchema = z
  .object({
    id: ArtefactIdSchema,
    kind: ArtefactKindSchema,
    text: z.string().min(1).max(20_000),
    createdAt: IsoTimestampSchema,
    createdBy: ArtefactCreatorSchema,
    citedClaims: z.array(ClaimIdSchema).min(0),
    // Hash of @sasa/principles at time of creation. Verified at publish time.
    principlesHash: Sha256HexSchema,
  })
  .strict();
export type Artefact = z.infer<typeof ArtefactSchema>;
