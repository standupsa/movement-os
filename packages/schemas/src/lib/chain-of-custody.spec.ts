import { ChainOfCustodyEntrySchema } from './chain-of-custody.js';
import { ulid } from './test-fixtures.js';

const valid = {
  custodyId: ulid('CUST1'),
  caseId: ulid('CASE1'),
  artifactId: ulid('ART1'),
  kind: 'affidavit-scan' as const,
  sha256: 'c'.repeat(64),
  collectedAt: '2026-04-18T10:00:00+02:00',
  collectedByHumanId: 'custodian.thandi',
  collectedFromRef: 'witness.case-CASE1.subject-001',
  collectedWhere: 'Pretoria — SAPS Sunnyside',
  consentId: ulid('CONS1'),
  lawfulBasis: 'consent' as const,
  condition: 'intact' as const,
};

describe('ChainOfCustodyEntrySchema', () => {
  it('accepts a well-formed entry and defaults transfers/derivedFrom to []', () => {
    const parsed = ChainOfCustodyEntrySchema.parse(valid);
    expect(parsed.transfers).toEqual([]);
    expect(parsed.derivedFromSha256).toEqual([]);
  });

  it('accepts a valid transfer', () => {
    const result = ChainOfCustodyEntrySchema.safeParse({
      ...valid,
      transfers: [
        {
          transferredAt: '2026-04-19T08:00:00+02:00',
          transferredFromHumanId: 'custodian.thandi',
          transferredToHumanId: 'records.officer',
          reason: 'to records officer for lodgement',
          sha256Verified: true,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a bad sha256', () => {
    const result = ChainOfCustodyEntrySchema.safeParse({
      ...valid,
      sha256: 'zz',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields under strict()', () => {
    const result = ChainOfCustodyEntrySchema.safeParse({
      ...valid,
      rogue: true,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a derivation with derivedFromSha256', () => {
    const result = ChainOfCustodyEntrySchema.safeParse({
      ...valid,
      kind: 'derivation',
      derivedFromSha256: ['d'.repeat(64), 'e'.repeat(64)],
    });
    expect(result.success).toBe(true);
  });
});
