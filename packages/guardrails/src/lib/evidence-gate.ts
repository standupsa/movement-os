import type { AgentTaskKind, LlmProviderId } from '@wsa/agent-contracts';
import {
  GROKIPEDIA_ALLOWED_EVIDENCE_KINDS,
  GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS,
} from '@wsa/agent-xai';
import {
  EvidenceKindSchema,
  type Claim,
  type ClaimStatus,
  type Evidence,
  type EvidenceKind,
} from '@wsa/schemas';

export interface EvidenceProvenance {
  readonly providerIds: ReadonlyArray<LlmProviderId>;
  readonly modelGenerated: boolean;
}

export interface EvidenceWithProvenance {
  readonly evidence: Evidence;
  readonly provenance: EvidenceProvenance;
}

export interface AnalysisProviderRun {
  readonly provider: LlmProviderId;
  readonly taskKind: Extract<AgentTaskKind, 'analysis'>;
  readonly claimId: Claim['id'];
}

export interface ChallengeProviderRun {
  readonly provider: LlmProviderId;
  readonly taskKind: Extract<AgentTaskKind, 'challenge'>;
  readonly claimId: Claim['id'];
}

export type ProviderRun = AnalysisProviderRun | ChallengeProviderRun;

export interface EvidencePromotionInput {
  readonly claim: Claim;
  readonly claimProducerProvider: LlmProviderId;
  readonly evidence: ReadonlyArray<EvidenceWithProvenance>;
  readonly providerRuns: ReadonlyArray<ProviderRun>;
  readonly now: string;
}

export type PromotionRuleCode = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7';

export interface PromotionReason {
  readonly code: PromotionRuleCode;
  readonly severity: 'block' | 'warn';
  readonly message: string;
  readonly evidenceId?: Evidence['id'];
}

export interface PromotionDecision {
  readonly ok: boolean;
  readonly reasons: ReadonlyArray<PromotionReason>;
  readonly activeEvidence: ReadonlyArray<EvidenceWithProvenance>;
}

const PROMOTABLE_STATUSES: ReadonlySet<ClaimStatus> = new Set<ClaimStatus>([
  'conclusive',
  'high-confidence',
]);

export const PRIMARY_SOURCE_EVIDENCE_KINDS: ReadonlyArray<EvidenceKind> =
  GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS.map((kind) =>
    EvidenceKindSchema.parse(kind),
  );

const PRIMARY_SOURCE_EVIDENCE_KIND_SET: ReadonlySet<EvidenceKind> = new Set(
  PRIMARY_SOURCE_EVIDENCE_KINDS,
);

export const GROKIPEDIA_ALLOWED_EVIDENCE_KIND_SET: ReadonlySet<EvidenceKind> =
  new Set(
    GROKIPEDIA_ALLOWED_EVIDENCE_KINDS.map((kind) =>
      EvidenceKindSchema.parse(kind),
    ),
  );

export const GROKIPEDIA_PROHIBITED_EVIDENCE_KIND_SET: ReadonlySet<EvidenceKind> =
  new Set(
    GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS.map((kind) =>
      EvidenceKindSchema.parse(kind),
    ),
  );

export function checkEvidencePromotion(
  input: EvidencePromotionInput,
): PromotionDecision {
  const activeEvidence = input.evidence.filter((entry) =>
    isEvidenceActive(entry.evidence, input.now),
  );
  const reasons: PromotionReason[] = [];

  for (const entry of activeEvidence) {
    if (violatesGrokipediaKindRule(entry)) {
      reasons.push({
        code: 'R1',
        severity: 'block',
        message: `xAI-only model output must not claim primary-source evidence kind "${entry.evidence.kind}"`,
        evidenceId: entry.evidence.id,
      });
    }
  }

  if (PROMOTABLE_STATUSES.has(input.claim.status)) {
    const providerRuns = input.providerRuns.filter(
      (run) => run.claimId === input.claim.id,
    );
    const supportingEvidence = activeEvidence.filter(
      (entry) => entry.evidence.supports === 'supports',
    );
    const contradictingEvidence = activeEvidence.filter(
      (entry) => entry.evidence.supports === 'contradicts',
    );
    const distinctProviders = collectDistinctProviders(supportingEvidence);
    const hasPrimarySourceSupport = supportingEvidence.some((entry) =>
      PRIMARY_SOURCE_EVIDENCE_KIND_SET.has(entry.evidence.kind),
    );
    const hasNonXaiPrimarySourceSupport = supportingEvidence.some(
      (entry) =>
        PRIMARY_SOURCE_EVIDENCE_KIND_SET.has(entry.evidence.kind) &&
        !isXaiOnlyModelOutput(entry),
    );
    const hasSupportingXaiOnlyModelOutput = supportingEvidence.some((entry) =>
      isXaiOnlyModelOutput(entry),
    );

    if (hasSupportingXaiOnlyModelOutput && !hasNonXaiPrimarySourceSupport) {
      reasons.push({
        code: 'R2',
        severity: 'block',
        message:
          'xAI-only model-output evidence requires non-xai primary-source corroboration before high-confidence or conclusive promotion',
      });
    }

    if (distinctProviders.size < 2) {
      reasons.push({
        code: 'R3',
        severity: 'block',
        message:
          'high-confidence and conclusive promotion require supporting evidence provenance from at least two distinct providers',
      });
    }

    if (!hasDistinctChallengeLane(input.claimProducerProvider, providerRuns)) {
      reasons.push({
        code: 'R7',
        severity: 'block',
        message:
          'high-confidence and conclusive promotion require at least one challenge-lane run from a provider different from the claim-producing analysis run',
      });
    }

    if (input.claim.status === 'conclusive' && !hasPrimarySourceSupport) {
      reasons.push({
        code: 'R4',
        severity: 'block',
        message:
          'conclusive promotion requires at least one active supporting primary-source evidence record',
      });
    }

    if (contradictingEvidence.length > 0) {
      const firstContradiction = contradictingEvidence[0];
      reasons.push({
        code: 'R5',
        severity: 'block',
        message:
          'high-confidence and conclusive promotion are blocked while active contradicting evidence exists',
        ...(firstContradiction === undefined
          ? {}
          : { evidenceId: firstContradiction.evidence.id }),
      });
    }
  }

  if (
    input.claim.status === 'destroyed-or-missing-record-suspected' &&
    !hasDestroyedRecordNote(activeEvidence)
  ) {
    reasons.push({
      code: 'R6',
      severity: 'warn',
      message:
        'destroyed-or-missing-record-suspected should carry at least one active supporting evidence note explaining the missing-record basis',
    });
  }

  const blocked = reasons.some((reason) => reason.severity === 'block');
  return {
    ok: !blocked,
    reasons,
    activeEvidence,
  };
}

export function summarisePromotionResult(result: PromotionDecision): string {
  if (result.reasons.length === 0) {
    return 'clean';
  }

  return result.reasons
    .map((reason) => {
      const evidenceSuffix =
        reason.evidenceId === undefined
          ? ''
          : ` (evidence=${reason.evidenceId})`;
      return `[${reason.severity.toUpperCase()}] ${reason.code}: ${reason.message}${evidenceSuffix}`;
    })
    .join('\n');
}

export function violatesGrokipediaKindRule(
  entry: EvidenceWithProvenance,
): boolean {
  return (
    isXaiOnlyModelOutput(entry) &&
    GROKIPEDIA_PROHIBITED_EVIDENCE_KIND_SET.has(entry.evidence.kind)
  );
}

function isEvidenceActive(evidence: Evidence, now: string): boolean {
  if (evidence.supersededBy !== undefined) {
    return false;
  }

  const nowMs = toMillis(now);
  const validFromMs =
    evidence.validFrom === null ? null : toMillis(evidence.validFrom);
  const validToMs =
    evidence.validTo === null ? null : toMillis(evidence.validTo);

  if (validFromMs !== null && validFromMs > nowMs) {
    return false;
  }

  if (validToMs !== null && validToMs < nowMs) {
    return false;
  }

  return true;
}

function isXaiOnlyModelOutput(entry: EvidenceWithProvenance): boolean {
  return (
    entry.provenance.modelGenerated &&
    entry.provenance.providerIds.length > 0 &&
    entry.provenance.providerIds.every((providerId) => providerId === 'xai')
  );
}

function collectDistinctProviders(
  evidence: ReadonlyArray<EvidenceWithProvenance>,
): ReadonlySet<LlmProviderId> {
  const providers = new Set<LlmProviderId>();
  for (const entry of evidence) {
    for (const providerId of entry.provenance.providerIds) {
      providers.add(providerId);
    }
  }
  return providers;
}

function hasDistinctChallengeLane(
  claimProducerProvider: LlmProviderId,
  providerRuns: ReadonlyArray<ProviderRun>,
): boolean {
  for (const run of providerRuns) {
    if (
      run.taskKind === 'challenge' &&
      run.provider !== claimProducerProvider
    ) {
      return true;
    }
  }

  return false;
}

function hasDestroyedRecordNote(
  evidence: ReadonlyArray<EvidenceWithProvenance>,
): boolean {
  return evidence.some(
    (entry) =>
      entry.evidence.supports === 'supports' &&
      entry.evidence.note !== undefined &&
      entry.evidence.note.trim().length > 0,
  );
}

function toMillis(timestamp: string): number {
  return Date.parse(timestamp);
}
