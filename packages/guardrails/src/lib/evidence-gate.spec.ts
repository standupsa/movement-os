import {
  ClaimSchema,
  EvidenceSchema,
  type Claim,
  type ClaimStatus,
  type Evidence,
  ulid,
} from '@wsa/schemas';
import {
  GROKIPEDIA_ALLOWED_EVIDENCE_KIND_SET,
  PRIMARY_SOURCE_EVIDENCE_KINDS,
  checkEvidencePromotion,
  summarisePromotionResult,
  type EvidencePromotionInput,
  type EvidenceWithProvenance,
  type ProviderRun,
} from './evidence-gate.js';

const NOW = '2026-04-18T12:00:00+02:00';

function makeClaim(status: ClaimStatus): Claim {
  return ClaimSchema.parse({
    id: ulid('CLAIM0'),
    text: 'The official record was withheld from the family.',
    extractedBy: 'human',
    status,
    sourceRef: { kind: 'artefact', id: ulid('ARTF0') },
    assertedAt: NOW,
    validFrom: null,
    validTo: null,
  });
}

function makeEvidence(id: string, overrides: Partial<Evidence> = {}): Evidence {
  return EvidenceSchema.parse({
    id: ulid(id),
    claimId: ulid('CLAIM0'),
    kind: 'other',
    url: `https://example.org/${id}`,
    fetchedAt: NOW,
    sha256: 'a'.repeat(64),
    supports: 'supports',
    assertedAt: NOW,
    validFrom: null,
    validTo: null,
    ...overrides,
  });
}

function makeEntry(
  id: string,
  overrides?: Partial<Evidence>,
  provenance?: Partial<EvidenceWithProvenance['provenance']>,
): EvidenceWithProvenance {
  return {
    evidence: makeEvidence(id, overrides),
    provenance: {
      providerIds: [],
      modelGenerated: false,
      ...provenance,
    },
  };
}

function makePromotionInput(
  status: ClaimStatus,
  evidence: ReadonlyArray<EvidenceWithProvenance>,
  overrides: Partial<
    Pick<EvidencePromotionInput, 'claimProducerProvider' | 'providerRuns'>
  > = {},
): EvidencePromotionInput {
  const claim = makeClaim(status);
  return {
    claim,
    claimProducerProvider: overrides.claimProducerProvider ?? 'xai',
    evidence,
    providerRuns:
      overrides.providerRuns ??
      makeProviderRunsForClaim(claim.id, {
        analysis: 'xai',
        challenge: 'openai',
      }),
    now: NOW,
  };
}

function makeProviderRunsForClaim(
  claimId: Claim['id'],
  providers: {
    analysis: ProviderRun['provider'];
    challenge: ProviderRun['provider'];
  },
): ReadonlyArray<ProviderRun> {
  return [
    {
      claimId,
      provider: providers.analysis,
      taskKind: 'analysis',
    },
    {
      claimId,
      provider: providers.challenge,
      taskKind: 'challenge',
    },
  ];
}

describe('@wsa/guardrails / checkEvidencePromotion', () => {
  describe('active evidence filtering', () => {
    it('ignores superseded evidence', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('high-confidence', [
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8K0', {
            kind: 'other',
            supersededBy: ulid('EVID1') as Evidence['id'],
          }),
        ]),
      );

      expect(result.activeEvidence).toEqual([]);
    });

    it('ignores evidence whose validTo is in the past', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('high-confidence', [
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8K2', {
            validTo: '2026-04-17T12:00:00+02:00',
          }),
        ]),
      );

      expect(result.activeEvidence).toEqual([]);
    });

    it('ignores evidence whose validFrom is in the future', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('high-confidence', [
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8K3', {
            validFrom: '2026-04-19T12:00:00+02:00',
          }),
        ]),
      );

      expect(result.activeEvidence).toEqual([]);
    });
  });

  describe('R1 — Grokipedia prohibited kind', () => {
    it.each(PRIMARY_SOURCE_EVIDENCE_KINDS)(
      'blocks xAI-only model output claiming primary-source kind %s',
      (kind) => {
        const result = checkEvidencePromotion(
          makePromotionInput('high-confidence', [
            makeEntry(
              '01JSA7M1C4B6Y8D0E2F4G6H8K4',
              { kind },
              { providerIds: ['xai'], modelGenerated: true },
            ),
          ]),
        );

        expect(result.ok).toBe(false);
        expect(result.reasons).toContainEqual(
          expect.objectContaining({ code: 'R1', severity: 'block' }),
        );
      },
    );

    it.each([...GROKIPEDIA_ALLOWED_EVIDENCE_KIND_SET])(
      'allows xAI-only model output kind %s through the kind check',
      (kind) => {
        const result = checkEvidencePromotion(
          makePromotionInput('contested', [
            makeEntry(
              '01JSA7M1C4B6Y8D0E2F4G6H8K5',
              { kind },
              { providerIds: ['xai'], modelGenerated: true },
            ),
          ]),
        );

        expect(result.reasons.some((reason) => reason.code === 'R1')).toBe(
          false,
        );
      },
    );

    it('does not treat non-model xAI provenance as a Grokipedia violation', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('contested', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8K6',
            { kind: 'court-record' },
            { providerIds: ['xai'], modelGenerated: false },
          ),
        ]),
      );

      expect(result.reasons.some((reason) => reason.code === 'R1')).toBe(false);
    });
  });

  describe('R2 — xAI-only evidence requires primary-source corroboration', () => {
    it('blocks promotable status when only xAI-only support exists', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('high-confidence', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8K7',
            { kind: 'news-article' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8K8',
            { kind: 'other' },
            { providerIds: ['openai'], modelGenerated: true },
          ),
        ]),
      );

      expect(result.reasons).toContainEqual(
        expect.objectContaining({ code: 'R2', severity: 'block' }),
      );
    });

    it('passes R2 when a non-xai primary source corroborates the xAI-only support', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('high-confidence', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8K9',
            { kind: 'news-article' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8KA', {
            kind: 'court-record',
          }),
        ]),
      );

      expect(result.reasons.some((reason) => reason.code === 'R2')).toBe(false);
    });

    it('does not apply R2 to non-promotable statuses', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('contested', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KB',
            { kind: 'news-article' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
        ]),
      );

      expect(result.reasons.some((reason) => reason.code === 'R2')).toBe(false);
    });
  });

  describe('R3 — two-provider independence', () => {
    it('blocks promotable status when fewer than two providers appear in supporting provenance', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('high-confidence', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KC',
            { kind: 'news-article' },
            { providerIds: ['openai'], modelGenerated: true },
          ),
        ]),
      );

      expect(result.reasons).toContainEqual(
        expect.objectContaining({ code: 'R3', severity: 'block' }),
      );
    });

    it('passes when two distinct providers appear across supporting evidence', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('high-confidence', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KD',
            { kind: 'news-article' },
            { providerIds: ['openai'], modelGenerated: true },
          ),
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KE',
            { kind: 'other' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
        ]),
      );

      expect(result.reasons.some((reason) => reason.code === 'R3')).toBe(false);
    });

    it('ignores contradicting evidence when counting provider independence', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('contested', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KF',
            { kind: 'other' },
            { providerIds: ['openai'], modelGenerated: true },
          ),
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KG',
            { supports: 'contradicts', kind: 'other' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
        ]),
      );

      expect(result.reasons.some((reason) => reason.code === 'R3')).toBe(false);
    });
  });

  describe('R7 — challenge-lane enforcement', () => {
    it('blocks conclusive when no challenge run is supplied', () => {
      const result = checkEvidencePromotion(
        makePromotionInput(
          'conclusive',
          [
            makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8M1', {
              kind: 'court-record',
            }),
            makeEntry(
              '01JSA7M1C4B6Y8D0E2F4G6H8M2',
              { kind: 'other' },
              { providerIds: ['xai'], modelGenerated: true },
            ),
          ],
          { providerRuns: [] },
        ),
      );

      expect(result.reasons).toContainEqual(
        expect.objectContaining({ code: 'R7', severity: 'block' }),
      );
    });

    it('blocks conclusive when the challenge run uses the same provider as analysis', () => {
      const result = checkEvidencePromotion(
        makePromotionInput(
          'conclusive',
          [
            makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8M3', {
              kind: 'court-record',
            }),
            makeEntry(
              '01JSA7M1C4B6Y8D0E2F4G6H8M4',
              { kind: 'other' },
              { providerIds: ['xai'], modelGenerated: true },
            ),
          ],
          {
            providerRuns: makeProviderRunsForClaim(makeClaim('conclusive').id, {
              analysis: 'xai',
              challenge: 'xai',
            }),
          },
        ),
      );

      expect(result.reasons).toContainEqual(
        expect.objectContaining({ code: 'R7', severity: 'block' }),
      );
    });

    it('passes conclusive when a different-provider challenge run exists', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('conclusive', [
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8M5', {
            kind: 'court-record',
          }, { providerIds: ['openai'], modelGenerated: false }),
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8M6',
            { kind: 'other' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
        ]),
      );

      expect(result.ok).toBe(true);
      expect(result.reasons.some((reason) => reason.code === 'R7')).toBe(false);
    });

    it('blocks high-confidence when the challenge run uses the same provider as analysis', () => {
      const result = checkEvidencePromotion(
        makePromotionInput(
          'high-confidence',
          [
            makeEntry(
              '01JSA7M1C4B6Y8D0E2F4G6H8M7',
              { kind: 'news-article' },
              { providerIds: ['openai'], modelGenerated: true },
            ),
            makeEntry(
              '01JSA7M1C4B6Y8D0E2F4G6H8M8',
              { kind: 'other' },
              { providerIds: ['xai'], modelGenerated: true },
            ),
          ],
          {
            claimProducerProvider: 'openai',
            providerRuns: makeProviderRunsForClaim(
              makeClaim('high-confidence').id,
              {
                analysis: 'openai',
                challenge: 'openai',
              },
            ),
          },
        ),
      );

      expect(result.reasons).toContainEqual(
        expect.objectContaining({ code: 'R7', severity: 'block' }),
      );
    });

    it('passes high-confidence when a different-provider challenge run exists', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('high-confidence', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8M9',
            { kind: 'court-record' },
            { providerIds: ['openai'], modelGenerated: false },
          ),
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8MA',
            { kind: 'other' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
        ]),
      );

      expect(result.ok).toBe(true);
      expect(result.reasons.some((reason) => reason.code === 'R7')).toBe(false);
    });

    it('blocks when mixed analysis history exists but the challenge only matches a different analysis provider', () => {
      const claim = makeClaim('conclusive');
      const result = checkEvidencePromotion({
        claim,
        claimProducerProvider: 'openai',
        evidence: [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8MC',
            { claimId: claim.id, kind: 'court-record' },
            { providerIds: ['openai'], modelGenerated: false },
          ),
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8MD',
            { claimId: claim.id, kind: 'other' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
        ],
        providerRuns: [
          { claimId: claim.id, provider: 'openai', taskKind: 'analysis' },
          { claimId: claim.id, provider: 'xai', taskKind: 'analysis' },
          {
            claimId: claim.id,
            provider: 'openai',
            taskKind: 'challenge',
          },
        ],
        now: NOW,
      });

      expect(result.ok).toBe(false);
      expect(result.reasons).toContainEqual(
        expect.objectContaining({ code: 'R7', severity: 'block' }),
      );
    });

    it('passes when the claim-producing analysis provider is openai and challenge uses anthropic despite other analysis history', () => {
      const claim = makeClaim('conclusive');
      const result = checkEvidencePromotion({
        claim,
        claimProducerProvider: 'openai',
        evidence: [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8ME',
            { claimId: claim.id, kind: 'court-record' },
            { providerIds: ['openai'], modelGenerated: false },
          ),
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8MF',
            { claimId: claim.id, kind: 'other' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
        ],
        providerRuns: [
          { claimId: claim.id, provider: 'openai', taskKind: 'analysis' },
          { claimId: claim.id, provider: 'xai', taskKind: 'analysis' },
          {
            claimId: claim.id,
            provider: 'anthropic',
            taskKind: 'challenge',
          },
        ],
        now: NOW,
      });

      expect(result.ok).toBe(true);
      expect(result.reasons.some((reason) => reason.code === 'R7')).toBe(false);
    });

    it('passes when the claim-producing analysis provider is xai and challenge uses openai despite other analysis history', () => {
      const claim = makeClaim('conclusive');
      const result = checkEvidencePromotion({
        claim,
        claimProducerProvider: 'xai',
        evidence: [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8MG',
            { claimId: claim.id, kind: 'court-record' },
            { providerIds: ['openai'], modelGenerated: false },
          ),
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8MH',
            { claimId: claim.id, kind: 'other' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
        ],
        providerRuns: [
          { claimId: claim.id, provider: 'xai', taskKind: 'analysis' },
          { claimId: claim.id, provider: 'openai', taskKind: 'analysis' },
          {
            claimId: claim.id,
            provider: 'openai',
            taskKind: 'challenge',
          },
        ],
        now: NOW,
      });

      expect(result.ok).toBe(true);
      expect(result.reasons.some((reason) => reason.code === 'R7')).toBe(false);
    });

    it('blocks when the claim-producing analysis provider is xai and challenge also uses xai despite other analysis history', () => {
      const claim = makeClaim('conclusive');
      const result = checkEvidencePromotion({
        claim,
        claimProducerProvider: 'xai',
        evidence: [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8MJ',
            { claimId: claim.id, kind: 'court-record' },
            { providerIds: ['openai'], modelGenerated: false },
          ),
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8MK',
            { claimId: claim.id, kind: 'other' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
        ],
        providerRuns: [
          { claimId: claim.id, provider: 'xai', taskKind: 'analysis' },
          { claimId: claim.id, provider: 'openai', taskKind: 'analysis' },
          {
            claimId: claim.id,
            provider: 'xai',
            taskKind: 'challenge',
          },
        ],
        now: NOW,
      });

      expect(result.ok).toBe(false);
      expect(result.reasons).toContainEqual(
        expect.objectContaining({ code: 'R7', severity: 'block' }),
      );
    });

    it('does not apply R7 to analysis-tier statuses', () => {
      const result = checkEvidencePromotion(
        makePromotionInput(
          'contested',
          [
            makeEntry(
              '01JSA7M1C4B6Y8D0E2F4G6H8MB',
              { kind: 'other' },
              { providerIds: ['xai'], modelGenerated: true },
            ),
          ],
          { providerRuns: [] },
        ),
      );

      expect(result.reasons.some((reason) => reason.code === 'R7')).toBe(false);
    });
  });

  describe('R4 — conclusive requires primary source', () => {
    it('blocks conclusive when only non-primary-source support exists', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('conclusive', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KH',
            { kind: 'news-article' },
            { providerIds: ['openai', 'xai'], modelGenerated: true },
          ),
        ]),
      );

      expect(result.reasons).toContainEqual(
        expect.objectContaining({ code: 'R4', severity: 'block' }),
      );
    });

    it('passes conclusive when a primary-source record supports it', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('conclusive', [
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8KJ', {
            kind: 'commission',
          }),
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KK',
            { kind: 'other' },
            { providerIds: ['openai', 'xai'], modelGenerated: true },
          ),
        ]),
      );

      expect(result.reasons.some((reason) => reason.code === 'R4')).toBe(false);
    });

    it('does not require a primary source for high-confidence', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('high-confidence', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KL',
            { kind: 'news-article' },
            { providerIds: ['openai'], modelGenerated: true },
          ),
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KM',
            { kind: 'other' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
        ]),
      );

      expect(result.reasons.some((reason) => reason.code === 'R4')).toBe(false);
    });
  });

  describe('R5 — contradiction block', () => {
    it('blocks high-confidence when active contradicting evidence exists', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('high-confidence', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KN',
            { kind: 'other' },
            { providerIds: ['openai'], modelGenerated: true },
          ),
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8KP', {
            supports: 'contradicts',
            kind: 'court-record',
          }),
        ]),
      );

      expect(result.reasons).toContainEqual(
        expect.objectContaining({ code: 'R5', severity: 'block' }),
      );
    });

    it('ignores contradicting evidence that is expired', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('high-confidence', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KQ',
            { kind: 'other' },
            { providerIds: ['openai'], modelGenerated: true },
          ),
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8KR', {
            supports: 'contradicts',
            kind: 'court-record',
            validTo: '2026-04-17T12:00:00+02:00',
          }),
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KS',
            { kind: 'other' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
        ]),
      );

      expect(result.reasons.some((reason) => reason.code === 'R5')).toBe(false);
    });

    it('does not apply R5 to contested claims', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('contested', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8KT',
            { kind: 'other' },
            { providerIds: ['openai'], modelGenerated: true },
          ),
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8KV', {
            supports: 'contradicts',
            kind: 'court-record',
          }),
        ]),
      );

      expect(result.reasons.some((reason) => reason.code === 'R5')).toBe(false);
    });
  });

  describe('R6 — destroyed-or-missing-record note', () => {
    it('warns when destroyed-or-missing-record-suspected lacks a supporting note', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('destroyed-or-missing-record-suspected', [
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8KW', { kind: 'other' }),
        ]),
      );

      expect(result.ok).toBe(true);
      expect(result.reasons).toContainEqual(
        expect.objectContaining({ code: 'R6', severity: 'warn' }),
      );
    });

    it('passes when a supporting evidence note explains the missing-record basis', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('destroyed-or-missing-record-suspected', [
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8KX', {
            kind: 'other',
            note: 'Archive register lists a docket, but the file was missing on retrieval.',
          }),
        ]),
      );

      expect(result.reasons.some((reason) => reason.code === 'R6')).toBe(false);
    });

    it('does not count contradicting notes toward R6', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('destroyed-or-missing-record-suspected', [
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8KY', {
            supports: 'contradicts',
            note: 'A contrary source exists.',
          }),
        ]),
      );

      expect(result.reasons).toContainEqual(
        expect.objectContaining({ code: 'R6', severity: 'warn' }),
      );
    });
  });

  describe('summarisePromotionResult', () => {
    it('returns clean when no reasons were emitted', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('contested', [
          makeEntry('01JSA7M1C4B6Y8D0E2F4G6H8KZ', { kind: 'other' }),
        ]),
      );

      expect(summarisePromotionResult(result)).toBe('clean');
    });

    it('formats reason lines with code and evidence id', () => {
      const result = checkEvidencePromotion(
        makePromotionInput('high-confidence', [
          makeEntry(
            '01JSA7M1C4B6Y8D0E2F4G6H8M0',
            { kind: 'court-record' },
            { providerIds: ['xai'], modelGenerated: true },
          ),
        ]),
      );

      const summary = summarisePromotionResult(result);
      expect(summary).toContain('[BLOCK] R1');
      expect(summary).toContain(
        `evidence=${ulid('01JSA7M1C4B6Y8D0E2F4G6H8M0')}`,
      );
    });
  });
});
