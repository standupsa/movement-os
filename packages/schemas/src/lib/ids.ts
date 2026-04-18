/**
 * Branded ULID factories and actor id schema.
 *
 * Branded IDs prevent accidentally passing a ClaimId where a WitnessId is
 * expected — they are the same string at runtime, distinct at compile time.
 */

import { z } from 'zod';

const ULID_REGEX: RegExp = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const brandedUlid = <B extends string>(): z.ZodBranded<
  z.ZodString,
  B
> => z.string().regex(ULID_REGEX, 'expected a ULID').brand<B>();

// --- Existing IDs ---------------------------------------------------------

export const WitnessIdSchema = brandedUlid<'WitnessId'>();
export type WitnessId = z.infer<typeof WitnessIdSchema>;

export const IntakeIdSchema = brandedUlid<'IntakeId'>();
export type IntakeId = z.infer<typeof IntakeIdSchema>;

export const ClaimIdSchema = brandedUlid<'ClaimId'>();
export type ClaimId = z.infer<typeof ClaimIdSchema>;

export const EvidenceIdSchema = brandedUlid<'EvidenceId'>();
export type EvidenceId = z.infer<typeof EvidenceIdSchema>;

export const ArtefactIdSchema = brandedUlid<'ArtefactId'>();
export type ArtefactId = z.infer<typeof ArtefactIdSchema>;

export const ApprovalIdSchema = brandedUlid<'ApprovalId'>();
export type ApprovalId = z.infer<typeof ApprovalIdSchema>;

// --- Persistent-pursuit IDs (ADR-0002) -----------------------------------

export const CaseIdSchema = brandedUlid<'CaseId'>();
export type CaseId = z.infer<typeof CaseIdSchema>;

export const QuestionIdSchema = brandedUlid<'QuestionId'>();
export type QuestionId = z.infer<typeof QuestionIdSchema>;

export const MethodAttemptIdSchema = brandedUlid<'MethodAttemptId'>();
export type MethodAttemptId = z.infer<typeof MethodAttemptIdSchema>;

export const HumanLeadIdSchema = brandedUlid<'HumanLeadId'>();
export type HumanLeadId = z.infer<typeof HumanLeadIdSchema>;

export const ConsentRecordIdSchema = brandedUlid<'ConsentRecordId'>();
export type ConsentRecordId = z.infer<typeof ConsentRecordIdSchema>;

export const CustodyEntryIdSchema = brandedUlid<'CustodyEntryId'>();
export type CustodyEntryId = z.infer<typeof CustodyEntryIdSchema>;

// --- Actor id ------------------------------------------------------------

export const ActorIdSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'actor ids are slug-like')
  .brand<'ActorId'>();
export type ActorId = z.infer<typeof ActorIdSchema>;

/**
 * Stable identity for a human working in the field layer. Slug form so it is
 * greppable in audit logs; the mapping to a real identity is held privately.
 */
export const HumanIdSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'human ids are slug-like')
  .brand<'HumanId'>();
export type HumanId = z.infer<typeof HumanIdSchema>;

/**
 * Stable identity for an agent. Conventionally `agent:<role>-<variant>`.
 */
export const AgentIdSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^agent:[a-z0-9][a-z0-9.-]*$/, 'agent ids are agent:<slug>')
  .brand<'AgentId'>();
export type AgentId = z.infer<typeof AgentIdSchema>;
