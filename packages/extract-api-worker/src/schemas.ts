import type {
  ExtractionInput,
  ExtractionResult,
  ExtractedClaimRecord,
} from '@wsa/evidence-engine';
import {
  ClaimSourceRefSchema,
  type Claim,
  type ClaimSourceRef,
  type ClaimStatus,
  type Evidence,
} from '@wsa/schemas';

export interface ExtractRequestEnvelope {
  readonly operatorAttestation: {
    readonly classification: 'lane2-redacted-or-consented';
  };
  readonly extract: ExtractionInput;
}

export interface ExtractResponseClaim {
  readonly requestedStatus: ClaimStatus;
  readonly effectiveStatus: ClaimStatus;
  readonly promotionDecision: PublicPromotionDecision;
  readonly claim: Claim;
  readonly evidencePreview: EvidencePreview;
}

export interface PublicPromotionDecision {
  readonly ok: boolean;
  readonly reasons: ReadonlyArray<{
    readonly code: ExtractedClaimRecord['promotion']['reasons'][number]['code'];
    readonly severity: ExtractedClaimRecord['promotion']['reasons'][number]['severity'];
  }>;
}

export interface EvidencePreview {
  readonly id: Evidence['id'];
  readonly kind: Evidence['kind'];
  readonly url: string;
  readonly fetchedAt: string;
  readonly sha256: string;
  readonly supports: Evidence['supports'];
}

export interface ExtractResponseEnvelope {
  readonly requestId: string;
  readonly summary: string;
  readonly claims: ReadonlyArray<ExtractResponseClaim>;
}

export class ExtractRequestValidationError extends Error {
  readonly status = 400;
  readonly reason = 'invalid_request';

  constructor(message: string) {
    super(message);
    this.name = 'ExtractRequestValidationError';
  }
}

export function parseExtractRequestEnvelope(
  value: unknown,
): ExtractRequestEnvelope {
  const root = readRecord(value, 'request');
  const operatorAttestation = readRecord(
    root.operatorAttestation,
    'operatorAttestation',
  );
  const classification = readString(
    operatorAttestation.classification,
    'operatorAttestation.classification',
  );

  if (classification !== 'lane2-redacted-or-consented') {
    throw new ExtractRequestValidationError(
      'operatorAttestation.classification must be lane2-redacted-or-consented',
    );
  }

  const extractRecord = readRecord(root.extract, 'extract');
  return {
    operatorAttestation: { classification },
    extract: {
      requestId: readString(extractRecord.requestId, 'extract.requestId'),
      sourceRef: parseSourceRef(extractRecord.sourceRef),
      sourceUrl: readString(extractRecord.sourceUrl, 'extract.sourceUrl'),
      sourceSha256: readString(
        extractRecord.sourceSha256,
        'extract.sourceSha256',
      ),
      sourceFetchedAt: readString(
        extractRecord.sourceFetchedAt,
        'extract.sourceFetchedAt',
      ),
      sourceText: readString(extractRecord.sourceText, 'extract.sourceText'),
      ...readOptionalPositiveInteger(
        extractRecord.maxClaims,
        'extract.maxClaims',
        'maxClaims',
      ),
      ...readOptionalPositiveInteger(
        extractRecord.maxOutputTokens,
        'extract.maxOutputTokens',
        'maxOutputTokens',
      ),
      ...readOptionalPositiveInteger(
        extractRecord.timeoutMs,
        'extract.timeoutMs',
        'timeoutMs',
      ),
    },
  };
}

export function mapExtractionResultToResponse(
  result: ExtractionResult,
): ExtractResponseEnvelope {
  return {
    requestId: result.requestId,
    summary: result.summary,
    claims: result.items.map((item) => ({
      requestedStatus: item.requestedStatus,
      effectiveStatus: item.claim.status,
      promotionDecision: {
        ok: item.promotion.ok,
        reasons: item.promotion.reasons.map((reason) => ({
          code: reason.code,
          severity: reason.severity,
        })),
      },
      claim: item.claim,
      evidencePreview: toEvidencePreview(item.evidence.evidence),
    })),
  };
}

function toEvidencePreview(evidence: Evidence): EvidencePreview {
  return {
    id: evidence.id,
    kind: evidence.kind,
    url: evidence.url,
    fetchedAt: evidence.fetchedAt,
    sha256: evidence.sha256,
    supports: evidence.supports,
  };
}

function parseSourceRef(value: unknown): ClaimSourceRef {
  const parsed = ClaimSourceRefSchema.safeParse(value);
  if (!parsed.success) {
    throw new ExtractRequestValidationError('extract.sourceRef is invalid');
  }
  return parsed.data;
}

function readOptionalPositiveInteger(
  value: unknown,
  field: string,
  outputField: 'maxClaims' | 'maxOutputTokens' | 'timeoutMs',
): Partial<
  Pick<ExtractionInput, 'maxClaims' | 'maxOutputTokens' | 'timeoutMs'>
> {
  if (value === undefined) {
    return {};
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ExtractRequestValidationError(
      `${field} must be a positive integer`,
    );
  }
  return { [outputField]: value } as Partial<
    Pick<ExtractionInput, 'maxClaims' | 'maxOutputTokens' | 'timeoutMs'>
  >;
}

function readRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ExtractRequestValidationError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ExtractRequestValidationError(
      `${field} must be a non-empty string`,
    );
  }
  return value;
}
