import type {
  AgentMessage,
  ModelProvider,
  ResponseStatus,
  TokenUsage,
} from '@wsa/agent-contracts';
import { createXaiProvider, type XaiProviderConfig } from '@wsa/agent-xai';
import {
  checkEvidencePromotion,
  type EvidenceWithProvenance,
  type PromotionDecision,
} from '@wsa/guardrails';
import {
  AgentIdSchema,
  ClaimIdSchema,
  ClaimSchema,
  ClaimSourceRefSchema,
  EvidenceIdSchema,
  EvidenceSchema,
  type AgentId,
  type Claim,
  type ClaimSourceRef,
  type ClaimStatus,
  type Evidence,
} from '@wsa/schemas';
import { z } from 'zod';
import { ClaimExtractionOutputSchema } from './extraction-schema.js';
import { generateUlid } from './ulid.js';

const DEFAULT_ACTOR_ID = AgentIdSchema.parse('agent:evidence-engine');
const DEFAULT_MAX_CLAIMS = 3;
const DEFAULT_MAX_OUTPUT_TOKENS = 900;
const DEFAULT_TIMEOUT_MS = 20_000;
const PROMOTABLE_STATUSES: ReadonlySet<ClaimStatus> = new Set([
  'high-confidence',
  'conclusive',
]);
const SAFE_FALLBACK_STATUS: ClaimStatus = 'contested';
const SYSTEM_PROMPT = [
  'You extract discrete, checkable civic-accountability claims from already-redacted or already-consented material.',
  'Return only JSON that matches the provided schema.',
  'Never invent names, dates, URLs, records, or legal conclusions that are not present in the source text.',
  'Prefer lower certainty over overstatement.',
  'A rationale must explain why the source text supports the requested status in one short sentence.',
].join('\n');

const ExtractionInputSchema = z
  .object({
    requestId: z.string().min(1).max(128),
    sourceRef: ClaimSourceRefSchema,
    sourceUrl: z.string().url(),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/i, 'expected a sha256 hex'),
    sourceFetchedAt: z.string().datetime({ offset: true }),
    sourceText: z.string().min(1).max(50_000),
    maxClaims: z.number().int().min(1).max(10).optional(),
    maxOutputTokens: z.number().int().positive().max(4_096).optional(),
    timeoutMs: z.number().int().positive().max(120_000).optional(),
  })
  .strict();

export interface ExtractionInput {
  readonly requestId: string;
  readonly sourceRef: ClaimSourceRef;
  readonly sourceUrl: string;
  readonly sourceSha256: string;
  readonly sourceFetchedAt: string;
  readonly sourceText: string;
  readonly maxClaims?: number;
  readonly maxOutputTokens?: number;
  readonly timeoutMs?: number;
}

export interface ExtractionAuditRecord {
  readonly action: 'claim.extracted' | 'evidence.linked';
  readonly actor: AgentId;
  readonly at: string;
  readonly detail: Readonly<Record<string, unknown>>;
}

export interface ExtractedClaimRecord {
  readonly requestedStatus: ClaimStatus;
  readonly claim: Claim;
  readonly evidence: EvidenceWithProvenance;
  readonly promotion: PromotionDecision;
  readonly auditTrail: ReadonlyArray<ExtractionAuditRecord>;
}

export interface ExtractionResult {
  readonly requestId: string;
  readonly summary: string;
  readonly provider: ModelProvider['id'];
  readonly model: string;
  readonly responseId?: string;
  readonly rawFinishReason?: string;
  readonly status: ResponseStatus;
  readonly usage: TokenUsage;
  readonly items: ReadonlyArray<ExtractedClaimRecord>;
}

export interface EvidenceEngine {
  extractClaims(input: ExtractionInput): Promise<ExtractionResult>;
}

export interface EvidenceEngineConfig {
  readonly provider: ModelProvider;
  readonly actorId?: AgentId;
  readonly now?: () => Date;
  readonly createId?: () => string;
}

export interface XaiEvidenceEngineConfig extends XaiProviderConfig {
  readonly actorId?: AgentId;
  readonly now?: () => Date;
  readonly createId?: () => string;
}

export function createEvidenceEngine(
  config: EvidenceEngineConfig,
): EvidenceEngine {
  return {
    extractClaims: async (input: ExtractionInput): Promise<ExtractionResult> =>
      extractClaimsWithProvider({
        provider: config.provider,
        input,
        ...(config.actorId === undefined ? {} : { actorId: config.actorId }),
        ...(config.now === undefined ? {} : { now: config.now }),
        ...(config.createId === undefined ? {} : { createId: config.createId }),
      }),
  };
}

export function createXaiEvidenceEngine(
  config: XaiEvidenceEngineConfig,
): EvidenceEngine {
  const { actorId, now, createId, ...providerConfig } = config;
  return createEvidenceEngine({
    provider: createXaiProvider(providerConfig),
    ...(actorId === undefined ? {} : { actorId }),
    ...(now === undefined ? {} : { now }),
    ...(createId === undefined ? {} : { createId }),
  });
}

export async function extractClaimsWithProvider(args: {
  readonly provider: ModelProvider;
  readonly input: ExtractionInput;
  readonly actorId?: AgentId;
  readonly now?: () => Date;
  readonly createId?: () => string;
}): Promise<ExtractionResult> {
  const input = ExtractionInputSchema.parse(args.input);
  const actorId = args.actorId ?? DEFAULT_ACTOR_ID;
  const now = args.now ?? (() => new Date());
  const createId = args.createId ?? (() => generateUlid(now()));
  const schema = ClaimExtractionOutputSchema({
    maxClaims: input.maxClaims ?? DEFAULT_MAX_CLAIMS,
  });
  const response = await args.provider.complete({
    schema,
    messages: buildMessages(input),
    taskKind: 'analysis',
    requestId: input.requestId,
    maxOutputTokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  const occurredAt = now().toISOString();
  const items = response.value.claims.map((candidate) =>
    buildExtractedClaimRecord({
      requestId: input.requestId,
      sourceRef: input.sourceRef,
      sourceUrl: input.sourceUrl,
      sourceSha256: input.sourceSha256,
      sourceFetchedAt: input.sourceFetchedAt,
      candidate,
      actorId,
      occurredAt,
      providerId: response.provider,
      model: response.model,
      createId,
      ...(response.responseId === undefined
        ? {}
        : { responseId: response.responseId }),
    }),
  );

  return {
    requestId: input.requestId,
    summary: response.value.summary,
    provider: response.provider,
    model: response.model,
    ...(response.responseId === undefined
      ? {}
      : { responseId: response.responseId }),
    rawFinishReason: response.rawFinishReason,
    status: response.status,
    usage: response.usage,
    items,
  };
}

function buildMessages(
  input: z.infer<typeof ExtractionInputSchema>,
): readonly AgentMessage[] {
  const payload = {
    sourceRef: input.sourceRef,
    sourceUrl: input.sourceUrl,
    sourceSha256: input.sourceSha256,
    sourceFetchedAt: input.sourceFetchedAt,
    maxClaims: input.maxClaims ?? DEFAULT_MAX_CLAIMS,
    instructions: [
      'Extract only claims stated or strongly implied by the source text.',
      'Use `supports` relative to the claim you emit.',
      'Use `contested` or `insufficient-record` when the text does not justify a promotable status.',
    ],
    sourceText: input.sourceText,
  };

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify(payload, null, 2),
    },
  ];
}

function buildExtractedClaimRecord(args: {
  readonly requestId: string;
  readonly sourceRef: ClaimSourceRef;
  readonly sourceUrl: string;
  readonly sourceSha256: string;
  readonly sourceFetchedAt: string;
  readonly candidate: z.infer<
    ReturnType<typeof ClaimExtractionOutputSchema>
  >['claims'][number];
  readonly actorId: AgentId;
  readonly occurredAt: string;
  readonly providerId: ModelProvider['id'];
  readonly model: string;
  readonly responseId?: string;
  readonly createId: () => string;
}): ExtractedClaimRecord {
  const claimId = ClaimIdSchema.parse(args.createId());
  const requestedStatus = args.candidate.status;
  const provisionalClaim = ClaimSchema.parse({
    id: claimId,
    text: args.candidate.text,
    extractedBy: 'agent:evidence-intake',
    status: requestedStatus,
    sourceRef: args.sourceRef,
    assertedAt: args.occurredAt,
    validFrom: null,
    validTo: null,
  });

  const evidence = EvidenceSchema.parse({
    id: EvidenceIdSchema.parse(args.createId()),
    claimId,
    kind: 'other',
    url: args.sourceUrl,
    fetchedAt: args.sourceFetchedAt,
    sha256: args.sourceSha256.toLowerCase(),
    supports: args.candidate.supports,
    note: buildEvidenceNote(args),
    assertedAt: args.occurredAt,
    validFrom: null,
    validTo: null,
  });

  const evidenceWithProvenance: EvidenceWithProvenance = {
    evidence,
    provenance: {
      providerIds: [args.providerId],
      modelGenerated: true,
    },
  };

  const promotion = checkEvidencePromotion({
    claim: provisionalClaim,
    evidence: [evidenceWithProvenance],
    now: args.occurredAt,
  });
  const effectiveStatus = shouldDowngradeStatus(requestedStatus, promotion)
    ? SAFE_FALLBACK_STATUS
    : requestedStatus;

  const claim =
    effectiveStatus === requestedStatus
      ? provisionalClaim
      : ClaimSchema.parse({
          ...provisionalClaim,
          status: effectiveStatus,
        });

  return {
    requestedStatus,
    claim,
    evidence: evidenceWithProvenance,
    promotion,
    auditTrail: buildAuditTrail({
      actorId: args.actorId,
      occurredAt: args.occurredAt,
      requestId: args.requestId,
      sourceRef: args.sourceRef,
      requestedStatus,
      effectiveStatus,
      claim,
      evidence,
      promotion,
      providerId: args.providerId,
      model: args.model,
      ...(args.responseId === undefined ? {} : { responseId: args.responseId }),
    }),
  };
}

function buildEvidenceNote(args: {
  readonly candidate: { readonly rationale: string };
  readonly providerId: ModelProvider['id'];
  readonly model: string;
  readonly requestId: string;
}): string {
  return [
    `Model-generated extraction candidate from ${args.providerId}/${args.model}.`,
    `requestId=${args.requestId}.`,
    args.candidate.rationale.trim(),
  ].join(' ');
}

function shouldDowngradeStatus(
  requestedStatus: ClaimStatus,
  promotion: PromotionDecision,
): boolean {
  return PROMOTABLE_STATUSES.has(requestedStatus) && !promotion.ok;
}

function buildAuditTrail(args: {
  readonly actorId: AgentId;
  readonly occurredAt: string;
  readonly requestId: string;
  readonly sourceRef: ClaimSourceRef;
  readonly requestedStatus: ClaimStatus;
  readonly effectiveStatus: ClaimStatus;
  readonly claim: Claim;
  readonly evidence: Evidence;
  readonly promotion: PromotionDecision;
  readonly providerId: ModelProvider['id'];
  readonly model: string;
  readonly responseId?: string;
}): readonly ExtractionAuditRecord[] {
  return [
    {
      action: 'claim.extracted',
      actor: args.actorId,
      at: args.occurredAt,
      detail: {
        requestId: args.requestId,
        sourceRef: args.sourceRef,
        claimId: args.claim.id,
        requestedStatus: args.requestedStatus,
        effectiveStatus: args.effectiveStatus,
        provider: args.providerId,
        model: args.model,
        promotionOk: args.promotion.ok,
        promotionRuleCodes: args.promotion.reasons.map((reason) => reason.code),
        ...(args.responseId === undefined
          ? {}
          : { responseId: args.responseId }),
      },
    },
    {
      action: 'evidence.linked',
      actor: args.actorId,
      at: args.occurredAt,
      detail: {
        requestId: args.requestId,
        claimId: args.claim.id,
        evidenceId: args.evidence.id,
        supports: args.evidence.supports,
        kind: args.evidence.kind,
        providerIds: [args.providerId],
        modelGenerated: true,
      },
    },
  ];
}
