/**
 * HumanLead — an L3 (human field layer) lead, first-class per ADR-0002.
 *
 * Archive runners, witness documenters, records officers, case custodians
 * all carry HumanLead records. Each lead has its own safety assessment.
 */

import { z } from 'zod';
import {
  CaseIdSchema,
  HumanIdSchema,
  HumanLeadIdSchema,
  QuestionIdSchema,
} from './ids.js';
import { IsoTimestampSchema } from './common.js';

export const HumanLeadKindSchema = z.enum([
  'archive-run',
  'witness-interview',
  'records-request',
  'case-custody',
  'affidavit',
  'other',
]);
export type HumanLeadKind = z.infer<typeof HumanLeadKindSchema>;

export const HumanLeadStatusSchema = z.enum([
  'planned',
  'in-progress',
  'complete',
  'declined',
  'cancelled',
]);
export type HumanLeadStatus = z.infer<typeof HumanLeadStatusSchema>;

/** Per-lead safety assessment; escalates to NPA witness-protection triage. */
export const SafetyAssessmentSchema = z.enum([
  'low',
  'elevated',
  'high',
  'critical',
]);
export type SafetyAssessment = z.infer<typeof SafetyAssessmentSchema>;

export const HumanLeadSchema = z
  .object({
    leadId: HumanLeadIdSchema,
    caseId: CaseIdSchema,
    questionId: QuestionIdSchema.optional(),
    kind: HumanLeadKindSchema,
    assignedToHumanId: HumanIdSchema,
    status: HumanLeadStatusSchema,
    safetyAssessment: SafetyAssessmentSchema,
    briefingNotes: z.string().max(8000),
    scheduledFor: IsoTimestampSchema.optional(),
    completedAt: IsoTimestampSchema.optional(),
  })
  .strict();
export type HumanLead = z.infer<typeof HumanLeadSchema>;
