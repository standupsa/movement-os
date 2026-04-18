/**
 * Question — a discrete question a case is trying to answer.
 *
 * A case is `active` while at least one question has an untried method or
 * a scheduled retry. Status refinement: `answered` requires `answerClaimId`;
 * non-answered states must not carry one.
 */

import { z } from 'zod';
import { CaseIdSchema, ClaimIdSchema, QuestionIdSchema } from './ids.js';
import { IsoTimestampSchema } from './common.js';

export const QuestionStatusSchema = z.enum([
  'open',
  'answered',
  'no-further-method-available',
]);
export type QuestionStatus = z.infer<typeof QuestionStatusSchema>;

const QuestionBaseSchema = z
  .object({
    questionId: QuestionIdSchema,
    caseId: CaseIdSchema,
    text: z.string().min(1).max(1000),
    status: QuestionStatusSchema,
    answerClaimId: ClaimIdSchema.optional(),
    createdAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
  })
  .strict();

/**
 * Refinement enforces the status/answerClaimId invariant at parse time:
 *   - status === 'answered'       → answerClaimId MUST be set
 *   - status !== 'answered'       → answerClaimId MUST be absent
 */
export const QuestionSchema = QuestionBaseSchema.superRefine((v, ctx) => {
  if (v.status === 'answered' && v.answerClaimId === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "answerClaimId is required when status is 'answered'",
      path: ['answerClaimId'],
    });
  }
  if (v.status !== 'answered' && v.answerClaimId !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "answerClaimId must be absent unless status is 'answered'",
      path: ['answerClaimId'],
    });
  }
});
export type Question = z.infer<typeof QuestionSchema>;
