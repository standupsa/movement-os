/**
 * @sasa/schemas — Zod contracts for every boundary.
 *
 * These schemas define the shape of data flowing between agents, workers,
 * the API, and the data store. All external input (CLI, HTTP, queue) MUST
 * be parsed through a schema before it is trusted.
 *
 * Branded IDs prevent accidentally passing a ClaimId where a WitnessId is
 * expected — they are the same string at runtime, distinct at compile time.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Branded ID helpers
// ---------------------------------------------------------------------------

const brandedUlid = <B extends string>() =>
  z
    .string()
    .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'expected a ULID')
    .brand<B>();

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

export const ActorIdSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'actor ids are slug-like')
  .brand<'ActorId'>();
export type ActorId = z.infer<typeof ActorIdSchema>;

// ---------------------------------------------------------------------------
// Core domain schemas
// ---------------------------------------------------------------------------

export const IsoTimestampSchema = z.string().datetime({ offset: true });

/**
 * An Intake is raw, unverified source material: a tip, a witness statement,
 * a news article, a court filing. The intake-worker creates these; no public
 * artefact may cite raw Intake without an Evidence record attesting it.
 */
export const IntakeSchema = z.object({
  id: IntakeIdSchema,
  receivedAt: IsoTimestampSchema,
  channel: z.enum(['web-form', 'email', 'signal', 'file-upload', 'import']),
  source: z.object({
    kind: z.enum(['witness', 'whistleblower', 'public-record', 'news', 'other']),
    // Never the raw identity; a redacted label / opaque reference.
    label: z.string().min(1).max(120),
  }),
  body: z.string().min(1).max(20_000),
  // Whether the intake may be persisted verbatim or must be redacted first.
  sensitivity: z.enum(['public', 'redact-on-intake', 'never-persist']),
  // POPIA: explicit, recorded lawful basis for processing.
  lawfulBasis: z.enum(['consent', 'public-interest', 'legal-obligation']),
  receivedBy: ActorIdSchema,
});
export type Intake = z.infer<typeof IntakeSchema>;

/**
 * A Claim is a discrete, checkable assertion extracted from Intake.
 * Every Claim must be reducible to a specific factual statement a
 * source-verifier agent can attempt to corroborate.
 */
export const ClaimSchema = z.object({
  id: ClaimIdSchema,
  intakeId: IntakeIdSchema,
  text: z.string().min(10).max(600),
  extractedAt: IsoTimestampSchema,
  extractedBy: z.enum(['human', 'agent:evidence-intake', 'agent:source-verifier']),
  status: z.enum(['unverified', 'verified', 'contradicted', 'unverifiable']),
});
export type Claim = z.infer<typeof ClaimSchema>;

/**
 * Evidence is a pointer to a primary source backing (or contradicting) a Claim.
 * Preference order: court record > gov publication > StatsSA > commission > news.
 */
export const EvidenceSchema = z.object({
  id: EvidenceIdSchema,
  claimId: ClaimIdSchema,
  kind: z.enum([
    'court-record',
    'government-publication',
    'statssa',
    'commission',
    'news-article',
    'other',
  ]),
  url: z.string().url(),
  fetchedAt: IsoTimestampSchema,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  supports: z.enum(['supports', 'contradicts', 'inconclusive']),
  note: z.string().max(500).optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * An Artefact is any outbound content produced by the platform:
 * a post, a letter, a brief, a video script. Every Artefact requires
 * a matching Approval before it may be published.
 */
export const ArtefactSchema = z.object({
  id: ArtefactIdSchema,
  kind: z.enum(['post', 'statement', 'letter', 'brief', 'video-script']),
  text: z.string().min(1).max(20_000),
  createdAt: IsoTimestampSchema,
  createdBy: z.enum([
    'human',
    'agent:media-drafter',
    'agent:campaign-brief',
    'agent:translator',
  ]),
  citedClaims: z.array(ClaimIdSchema).min(0),
  // Hash of @sasa/principles at time of creation. Verified at publish time.
  principlesHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type Artefact = z.infer<typeof ArtefactSchema>;

/**
 * An Approval is the signed, named, timestamped human consent to publish
 * an Artefact. No approval, no publish. Ever.
 */
export const ApprovalSchema = z.object({
  id: ApprovalIdSchema,
  artefactId: ArtefactIdSchema,
  approvedBy: ActorIdSchema,
  approvedAt: IsoTimestampSchema,
  // Operator attests they have read the artefact in full and accept responsibility.
  attestation: z.literal(
    'I have read this artefact in full and approve its publication under my name.',
  ),
});
export type Approval = z.infer<typeof ApprovalSchema>;

/**
 * Every mutation to the platform produces exactly one AuditEvent.
 * The audit log is append-only and signed; it is the source of truth
 * for "who did what, when, with what inputs".
 */
export const AuditEventSchema = z.object({
  id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'ULID'),
  at: IsoTimestampSchema,
  actor: ActorIdSchema,
  action: z.enum([
    'intake.received',
    'intake.redacted',
    'claim.extracted',
    'evidence.linked',
    'artefact.drafted',
    'artefact.approved',
    'artefact.published',
    'principles.hash.verified',
    'agent.aborted',
  ]),
  // JSON-serialisable detail — schema validated per-action at write time.
  detail: z.record(z.string(), z.unknown()),
  // Hash chain: sha256 of previous AuditEvent, forming a tamper-evident log.
  prevHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;
