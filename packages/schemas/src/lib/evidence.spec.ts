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
};

describe('EvidenceSchema', () => {
  it('accepts a well-formed evidence record', () => {
    const result = EvidenceSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects a non-URL url field', () => {
    const result = EvidenceSchema.safeParse({ ...valid, url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects a sha256 that is not 64 lower-case hex chars', () => {
    const result = EvidenceSchema.safeParse({ ...valid, sha256: 'A'.repeat(64) });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields under strict()', () => {
    const result = EvidenceSchema.safeParse({ ...valid, rogue: true });
    expect(result.success).toBe(false);
  });
});
