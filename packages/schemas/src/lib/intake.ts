/**
 * Intake — raw, unverified source material.
 *
 * A tip, a witness statement, a news article, a court filing. The intake
 * worker creates these; no public artefact may cite raw Intake without an
 * Evidence record attesting it.
 */

import { z } from 'zod';
import { ActorIdSchema, IntakeIdSchema } from './ids.js';
import { IsoTimestampSchema, LawfulBasisSchema } from './common.js';

export const IntakeChannelSchema = z.enum([
  'web-form',
  'email',
  'signal',
  'file-upload',
  'import',
]);
export type IntakeChannel = z.infer<typeof IntakeChannelSchema>;

export const IntakeSourceKindSchema = z.enum([
  'witness',
  'whistleblower',
  'public-record',
  'news',
  'other',
]);
export type IntakeSourceKind = z.infer<typeof IntakeSourceKindSchema>;

export const IntakeSensitivitySchema = z.enum([
  'public',
  'redact-on-intake',
  'never-persist',
]);
export type IntakeSensitivity = z.infer<typeof IntakeSensitivitySchema>;

export const IntakeSchema = z
  .object({
    id: IntakeIdSchema,
    receivedAt: IsoTimestampSchema,
    channel: IntakeChannelSchema,
    source: z
      .object({
        kind: IntakeSourceKindSchema,
        // Never the raw identity; a redacted label / opaque reference.
        label: z.string().min(1).max(120),
      })
      .strict(),
    body: z.string().min(1).max(20_000),
    sensitivity: IntakeSensitivitySchema,
    // POPIA: explicit, recorded lawful basis for processing.
    lawfulBasis: LawfulBasisSchema,
    receivedBy: ActorIdSchema,
  })
  .strict();
export type Intake = z.infer<typeof IntakeSchema>;
