/**
 * ConsentRecord — the pointer every intake, interview, and custody entry
 * cites. Captures scope, lawful basis, language, and withdrawal state.
 */

import { z } from 'zod';
import {
  ArtefactIdSchema,
  CaseIdSchema,
  ConsentRecordIdSchema,
  HumanIdSchema,
} from './ids.js';
import {
  IsoTimestampSchema,
  LanguageCodeSchema,
  LawfulBasisSchema,
} from './common.js';

export const ConsentScopeSchema = z.enum([
  'record',
  'interview',
  'share-internal',
  'pursue-records',
  'publication',
]);
export type ConsentScope = z.infer<typeof ConsentScopeSchema>;

export const ConsentRecordSchema = z
  .object({
    consentId: ConsentRecordIdSchema,
    caseId: CaseIdSchema,
    /** Witness id or opaque case-reference pointer if identity is withheld. */
    subjectRef: z.string().min(1).max(120),
    scope: z.array(ConsentScopeSchema).min(1),
    lawfulBasis: LawfulBasisSchema,
    grantedAt: IsoTimestampSchema,
    withdrawnAt: IsoTimestampSchema.optional(),
    witnessedByHumanId: HumanIdSchema,
    /** Pointer to an Artefact holding the recorded / signed consent itself. */
    recordingArtifactId: ArtefactIdSchema.optional(),
    /** BCP-47 subset; see `common.ts`. */
    languageCode: LanguageCodeSchema,
  })
  .strict();
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;
