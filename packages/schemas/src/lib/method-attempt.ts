/**
 * MethodAttempt — one attempt at one method for one question.
 *
 * Every attempt is logged — including the ones that returned nothing.
 * The method-effectiveness scoreboard depends on the nulls as much as the
 * hits.
 */

import { z } from 'zod';
import {
  AgentIdSchema,
  CaseIdSchema,
  EvidenceIdSchema,
  HumanIdSchema,
  MethodAttemptIdSchema,
  QuestionIdSchema,
} from './ids.js';
import { IsoTimestampSchema } from './common.js';

/** Exhaustion ladder L0 → L4, per ADR-0002. */
export const ExhaustionLevelSchema = z.enum(['L0', 'L1', 'L2', 'L3', 'L4']);
export type ExhaustionLevel = z.infer<typeof ExhaustionLevelSchema>;

export const AttemptOutcomeSchema = z.enum([
  'hit',
  'no-result',
  'blocked',
  'error',
]);
export type AttemptOutcome = z.infer<typeof AttemptOutcomeSchema>;

const MethodAttemptBaseSchema = z
  .object({
    attemptId: MethodAttemptIdSchema,
    caseId: CaseIdSchema,
    questionId: QuestionIdSchema,
    level: ExhaustionLevelSchema,
    methodKind: z.string().min(1).max(80), // e.g. 'paia-request', 'naairs-search'
    source: z.string().min(1).max(120), //     e.g. 'NARSSA', 'SAFLII'
    outcome: AttemptOutcomeSchema,
    timeToResultMs: z.number().int().nonnegative(),
    /** Cost in South African Rand, expressed as integer cents. Deterministic,
     *  no floats. See Locale & Conventions in the project preferences. */
    costZarCents: z.number().int().nonnegative(),
    attemptedByAgentId: AgentIdSchema.optional(),
    attemptedByHumanId: HumanIdSchema.optional(),
    attemptedAt: IsoTimestampSchema,
    nextRetryAt: IsoTimestampSchema.optional(),
    producedEvidenceIds: z.array(EvidenceIdSchema).default([]),
  })
  .strict();

/** Exactly one of agent / human must be the attempter — never both, never neither. */
export const MethodAttemptSchema = MethodAttemptBaseSchema.superRefine(
  (v, ctx) => {
    const hasAgent = v.attemptedByAgentId !== undefined;
    const hasHuman = v.attemptedByHumanId !== undefined;
    if (hasAgent === hasHuman) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'exactly one of attemptedByAgentId / attemptedByHumanId is required',
        path: ['attemptedByAgentId'],
      });
    }
  },
);
export type MethodAttempt = z.infer<typeof MethodAttemptSchema>;
