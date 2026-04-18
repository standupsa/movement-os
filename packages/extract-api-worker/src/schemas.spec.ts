import {
  ArtefactIdSchema,
  ClaimIdSchema,
  EvidenceIdSchema,
  ulid,
} from '@wsa/schemas';
import {
  ExtractRequestValidationError,
  mapExtractionResultToResponse,
  parseExtractRequestEnvelope,
} from './schemas.js';

describe('@wsa/extract-api-worker/schemas', () => {
  it('parses the ADR-0007 request envelope', () => {
    const parsed = parseExtractRequestEnvelope({
      operatorAttestation: {
        classification: 'lane2-redacted-or-consented',
      },
      extract: {
        requestId: 'req-001',
        sourceRef: {
          kind: 'artefact',
          id: ArtefactIdSchema.parse(ulid('ARTF1')),
        },
        sourceUrl: 'https://example.org/source',
        sourceSha256: 'a'.repeat(64),
        sourceFetchedAt: '2026-04-18T19:00:00.000Z',
        sourceText: 'already-redacted source text',
        maxClaims: 3,
      },
    });

    expect(parsed.operatorAttestation.classification).toBe(
      'lane2-redacted-or-consented',
    );
    expect(parsed.extract.requestId).toBe('req-001');
  });

  it('rejects invalid attestation classifications', () => {
    expect(() =>
      parseExtractRequestEnvelope({
        operatorAttestation: { classification: 'raw-witness-intake' },
        extract: {},
      }),
    ).toThrow(ExtractRequestValidationError);
  });

  it('maps extraction results to the public response shape without provider metadata', () => {
    const response = mapExtractionResultToResponse({
      requestId: 'req-001',
      summary: 'One claim extracted.',
      provider: 'xai',
      model: 'grok-4-fast-reasoning',
      status: 'completed',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      items: [
        {
          requestedStatus: 'contested',
          claim: {
            id: ClaimIdSchema.parse(ulid('CLM01')),
            text: 'Claim text',
            extractedBy: 'agent:evidence-engine',
            status: 'contested',
            sourceRef: {
              kind: 'artefact',
              id: ArtefactIdSchema.parse(ulid('ARTF1')),
            },
            assertedAt: '2026-04-18T19:00:00.000Z',
            validFrom: null,
            validTo: null,
          },
          evidence: {
            evidence: {
              id: EvidenceIdSchema.parse(ulid('EVID1')),
              claimId: ClaimIdSchema.parse(ulid('CLM01')),
              kind: 'other',
              url: 'https://example.org/source',
              fetchedAt: '2026-04-18T19:00:00.000Z',
              sha256: 'a'.repeat(64),
              supports: 'supports',
              note: 'Model-generated extraction candidate from xai/grok-4-fast-reasoning.',
              assertedAt: '2026-04-18T19:00:00.000Z',
              validFrom: null,
              validTo: null,
            },
            provenance: { providerIds: ['xai'], modelGenerated: true },
          },
          promotion: {
            ok: false,
            reasons: [
              {
                code: 'R2',
                severity: 'block',
                message:
                  'xAI-only model-output evidence requires corroboration.',
                evidenceId: EvidenceIdSchema.parse(ulid('EVID1')),
              },
            ],
            activeEvidence: [
              {
                evidence: {
                  id: EvidenceIdSchema.parse(ulid('EVID2')),
                  claimId: ClaimIdSchema.parse(ulid('CLM01')),
                  kind: 'other',
                  url: 'https://example.org/source',
                  fetchedAt: '2026-04-18T19:00:00.000Z',
                  sha256: 'b'.repeat(64),
                  supports: 'supports',
                  note: 'from xai',
                  assertedAt: '2026-04-18T19:00:00.000Z',
                  validFrom: null,
                  validTo: null,
                },
                provenance: { providerIds: ['xai'], modelGenerated: true },
              },
            ],
          },
          auditTrail: [],
        },
      ],
    });

    expect(response.claims[0]?.promotionDecision.ok).toBe(false);
    expect(
      (response as unknown as Record<string, unknown>).provider,
    ).toBeUndefined();
    expect(response.claims[0]?.effectiveStatus).toBe('contested');
    expect(response.claims[0]?.promotionDecision).toEqual({
      ok: false,
      reasons: [{ code: 'R2', severity: 'block' }],
    });
    expect(response.claims[0]?.evidencePreview).not.toHaveProperty('note');
    expect(JSON.stringify(response)).not.toContain('xai');
  });
});
