import { ClaimSchema, ClaimStatusSchema, type ClaimStatus } from './claim.js';
import { ulid } from './test-fixtures.js';

const baseClaim = {
  id: ulid('CLAIM1'),
  intakeId: ulid('INTAKE1'),
  text: 'SAPS took >12 weeks to act on case 123/04/2026.',
  extractedAt: '2026-04-18T09:00:00+02:00',
  extractedBy: 'agent:evidence-intake' as const,
} as const;

describe('ClaimSchema', () => {
  it('accepts a well-formed claim at each V2 status', () => {
    const statuses: readonly ClaimStatus[] = [
      'conclusive',
      'high-confidence',
      'contested',
      'insufficient-record',
      'destroyed-or-missing-record-suspected',
    ];
    for (const status of statuses) {
      const result = ClaimSchema.safeParse({ ...baseClaim, status });
      expect(result.success).toBe(true);
    }
  });

  it('rejects text shorter than 10 chars', () => {
    const result = ClaimSchema.safeParse({
      ...baseClaim,
      text: 'short',
      status: 'insufficient-record',
    });
    expect(result.success).toBe(false);
  });

  it('rejects V1 legacy status values', () => {
    for (const legacy of ['unverified', 'verified', 'contradicted', 'unverifiable']) {
      const result = ClaimStatusSchema.safeParse(legacy);
      expect(result.success).toBe(false);
    }
  });

  it('rejects unknown fields under strict()', () => {
    const result = ClaimSchema.safeParse({
      ...baseClaim,
      status: 'insufficient-record',
      rogue: 1,
    });
    expect(result.success).toBe(false);
  });
});
