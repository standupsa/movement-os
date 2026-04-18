import {
  GROKIPEDIA_ALLOWED_EVIDENCE_KINDS,
  GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS,
  XAI_NON_AUTHORITATIVE,
  isGrokipediaAllowedEvidenceKind,
  isGrokipediaProhibitedEvidenceKind,
} from './xai-policy.js';

// Independent of `@sasa/schemas` by design — if EvidenceKindSchema ever
// grows, this list must be updated deliberately, and the invariant
// check lives in `@sasa/guardrails` once that package depends on both.
const ALL_EVIDENCE_KINDS_SNAPSHOT: ReadonlyArray<string> = [
  'court-record',
  'government-publication',
  'statssa',
  'commission',
  'news-article',
  'other',
];

describe('Grokipedia policy constants', () => {
  it('declares xAI non-authoritative', () => {
    expect(XAI_NON_AUTHORITATIVE).toBe(true);
  });

  it('freezes both lists against mutation', () => {
    expect(Object.isFrozen(GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS)).toBe(true);
    expect(Object.isFrozen(GROKIPEDIA_ALLOWED_EVIDENCE_KINDS)).toBe(true);
  });

  it('prohibits primary-source kinds (court, government, statssa, commission)', () => {
    expect(GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS).toEqual([
      'court-record',
      'government-publication',
      'statssa',
      'commission',
    ]);
  });

  it('allows only news-article and other', () => {
    expect(GROKIPEDIA_ALLOWED_EVIDENCE_KINDS).toEqual([
      'news-article',
      'other',
    ]);
  });

  it('prohibited and allowed lists are disjoint', () => {
    const overlap = GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS.filter((k) =>
      GROKIPEDIA_ALLOWED_EVIDENCE_KINDS.includes(k),
    );
    expect(overlap).toEqual([]);
  });

  it('prohibited ∪ allowed covers the known EvidenceKind universe', () => {
    const union = new Set<string>([
      ...GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS,
      ...GROKIPEDIA_ALLOWED_EVIDENCE_KINDS,
    ]);
    for (const kind of ALL_EVIDENCE_KINDS_SNAPSHOT) {
      expect(union.has(kind)).toBe(true);
    }
    expect(union.size).toBe(ALL_EVIDENCE_KINDS_SNAPSHOT.length);
  });
});

describe('isGrokipediaProhibitedEvidenceKind', () => {
  it.each(GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS)(
    'returns true for prohibited kind %s',
    (kind) => {
      expect(isGrokipediaProhibitedEvidenceKind(kind)).toBe(true);
    },
  );

  it.each(GROKIPEDIA_ALLOWED_EVIDENCE_KINDS)(
    'returns false for allowed kind %s',
    (kind) => {
      expect(isGrokipediaProhibitedEvidenceKind(kind)).toBe(false);
    },
  );

  it('returns false for an unrecognised kind', () => {
    expect(isGrokipediaProhibitedEvidenceKind('rumor')).toBe(false);
  });
});

describe('isGrokipediaAllowedEvidenceKind', () => {
  it.each(GROKIPEDIA_ALLOWED_EVIDENCE_KINDS)(
    'returns true for allowed kind %s',
    (kind) => {
      expect(isGrokipediaAllowedEvidenceKind(kind)).toBe(true);
    },
  );

  it.each(GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS)(
    'returns false for prohibited kind %s',
    (kind) => {
      expect(isGrokipediaAllowedEvidenceKind(kind)).toBe(false);
    },
  );

  it('returns false for an unrecognised kind (no "maybe" bucket)', () => {
    expect(isGrokipediaAllowedEvidenceKind('rumor')).toBe(false);
  });
});
