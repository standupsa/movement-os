/**
 * ChainOfCustodyEntry — hash-on-entry, verify-on-receipt.
 *
 * Every physical or digital artefact gathered in the field carries a chain-
 * of-custody record. Derivations (timelines, contradiction reports, draft
 * dossiers) are themselves artefacts and carry their own entries, citing
 * the source hashes they were built from.
 */

import { z } from 'zod';
import {
  ArtefactIdSchema,
  CaseIdSchema,
  ConsentRecordIdSchema,
  CustodyEntryIdSchema,
  HumanIdSchema,
} from './ids.js';
import {
  IsoTimestampSchema,
  LawfulBasisSchema,
  Sha256HexSchema,
} from './common.js';

export const CustodyKindSchema = z.enum([
  'audio-recording',
  'video-recording',
  'affidavit-scan',
  'archive-photo',
  'certified-copy',
  'letter',
  'digital-file',
  'derivation',
]);
export type CustodyKind = z.infer<typeof CustodyKindSchema>;

export const CustodyConditionSchema = z.enum([
  'intact',
  'damaged',
  'redacted-at-source',
  'partial',
]);
export type CustodyCondition = z.infer<typeof CustodyConditionSchema>;

export const CustodyTransferSchema = z
  .object({
    transferredAt: IsoTimestampSchema,
    transferredFromHumanId: HumanIdSchema,
    transferredToHumanId: HumanIdSchema,
    reason: z.string().min(1).max(500),
    /** Receiving custodian re-hashes; mismatch is an integrity incident. */
    sha256Verified: z.boolean(),
  })
  .strict();
export type CustodyTransfer = z.infer<typeof CustodyTransferSchema>;

export const ChainOfCustodyEntrySchema = z
  .object({
    custodyId: CustodyEntryIdSchema,
    caseId: CaseIdSchema,
    artifactId: ArtefactIdSchema,
    kind: CustodyKindSchema,
    sha256: Sha256HexSchema,
    collectedAt: IsoTimestampSchema,
    collectedByHumanId: HumanIdSchema,
    /** Source id or opaque case-reference pointer. */
    collectedFromRef: z.string().min(1).max(120),
    collectedWhere: z.string().min(1).max(200),
    consentId: ConsentRecordIdSchema,
    lawfulBasis: LawfulBasisSchema,
    condition: CustodyConditionSchema,
    transfers: z.array(CustodyTransferSchema).default([]),
    /** For kind === 'derivation', the sha256s of the source artefacts used. */
    derivedFromSha256: z.array(Sha256HexSchema).default([]),
  })
  .strict();
export type ChainOfCustodyEntry = z.infer<typeof ChainOfCustodyEntrySchema>;
