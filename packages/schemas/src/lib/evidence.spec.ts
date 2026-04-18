import { EvidenceSchema } from './evidence.js';
import { ulid } from './test-fixtures.js';

const valid = {
  id: ulid('EVID1'),
  claimId: ulid('CLAIM1'),
  kind: 'court-record' as const,
  url: 'https://www.saflii.org/za/cases/ZACC/2025/1.html',
  fetchedAt: '2026-04-18T10:00:00+02:00',
  sha256: 'a'.repeat(64),
  supports: 'supports' as const,
  assertedAt: '2026-04-18T10:00:00+02:00',
  validFrom: null,
  validTo: null,
};

describe('EvidenceSchema (ADR-0004 bi-temporal)', () => {
  it('accepts a well-formed evidence record', () => {
    const result = EvidenceSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts a bounded valid-time window', () => {
    const result = EvidenceSchema.safeParse({
      ...valid,
      validFrom: '2026-01-01T00:00:00+02:00',
      validTo: '2026-04-18T10:00:00+02:00',
    });
    expect(result.success).toBe(true);
  });

  it('rejects validTo earlier than validFrom', () => {
    const result = EvidenceSchema.safeParse({
      ...valid,
      validFrom: '2026-04-18T00:00:00+02:00',
      validTo: '2026-01-01T00:00:00+02:00',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a non-self supersededBy pointer', () => {
    const result = EvidenceSchema.safeParse({
      ...valid,
      supersededBy: ulid('EVID2'),
    });
    expect(result.success).toBe(true);
  });

  it('rejects self-supersession', () => {
    const result = EvidenceSchema.safeParse({
      ...valid,
      supersededBy: valid.id,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-URL url field', () => {
    const result = EvidenceSchema.safeParse({ ...valid, url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects a sha256 that is not 64 lower-case hex chars', () => {
    const result = EvidenceSchema.safeParse({
      ...valid,
      sha256: 'A'.repeat(64),
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields under strict()', () => {
    const result = EvidenceSchema.safeParse({ ...valid, rogue: true });
    expect(result.success).toBe(false);
  });

  it('rejects the pre-ADR-0004 shape (missing assertedAt)', () => {
    const { assertedAt: _drop, ...legacy } = valid;
    const result = EvidenceSchema.safeParse(legacy);
    expect(result.success).toBe(false);
  });
});
