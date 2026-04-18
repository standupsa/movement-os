import {
  ClaimStatusSchema,
  EvidenceSupportSchema,
  type ClaimStatus,
  type EvidenceSupport,
} from '@wsa/schemas';
import { z } from 'zod';

export const ClaimExtractionCandidateSchema = z
  .object({
    text: z.string().min(10).max(600),
    status: ClaimStatusSchema,
    supports: EvidenceSupportSchema,
    rationale: z.string().min(1).max(500),
  })
  .strict();
export type ClaimExtractionCandidate = z.infer<
  typeof ClaimExtractionCandidateSchema
>;

export interface ClaimExtractionOutputSchemaOptions {
  readonly maxClaims: number;
}

export function ClaimExtractionOutputSchema(
  options: ClaimExtractionOutputSchemaOptions,
) {
  return z
    .object({
      summary: z.string().min(1).max(400),
      claims: z
        .array(ClaimExtractionCandidateSchema)
        .min(1)
        .max(options.maxClaims),
    })
    .strict();
}

export interface ClaimExtractionOutput {
  readonly summary: string;
  readonly claims: ReadonlyArray<{
    readonly text: string;
    readonly status: ClaimStatus;
    readonly supports: EvidenceSupport;
    readonly rationale: string;
  }>;
}
