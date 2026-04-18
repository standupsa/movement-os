import {
  ClaimSchema,
  ClaimSourceRefSchema,
  ClaimStatusSchema,
  type ClaimStatus,
} from './claim.js';
import { ulid } from './test-fixtures.js';

const baseClaimV3 = {
  id: ulid('CLAIM1'),
  text: 'SAPS took >12 weeks to act on case 123/04/2026.',
  extractedBy: 'agent:evidence-intake' as const,
  sourceRef: { kind: 'intake' as const, id: ulid('INTAKE1') },
  assertedAt: '2026-04-18T09:00:00+02:00',
  validFrom: null,
  validTo: null,
} as const;

describe('ClaimSchema (V3, ADR-0004)', () => {
  it('accepts a well-formed claim at each V2 status', () => {
    const statuses: readonly ClaimStatus[] = [
      'conclusive',
      'high-confidence',
      'contested',
      'insufficient-record',
      'destroyed-or-missing-record-suspected',
    ];
    for (const status of statuses) {
      const result = ClaimSchema.safeParse({ ...baseClaimV3, status });
      expect(result.success).toBe(true);
    }
  });

  it('accepts agent:evidence-engine as a claim extractor', () => {
    const result = ClaimSchema.safeParse({
      ...baseClaimV3,
      extractedBy: 'agent:evidence-engine' as const,
      status: 'contested' as const,
    });
    expect(result.success).toBe(true);
  });

  it('accepts an artefact-backed sourceRef', () => {
    const result = ClaimSchema.safeParse({
      ...baseClaimV3,
      status: 'insufficient-record' as const,
      sourceRef: { kind: 'artefact' as const, id: ulid('ARTEFACT1') },
    });
    expect(result.success).toBe(true);
  });

  it('accepts bounded valid-time windows', () => {
    const result = ClaimSchema.safeParse({
      ...baseClaimV3,
      status: 'contested' as const,
      validFrom: '2026-01-01T00:00:00+02:00',
      validTo: '2026-03-25T00:00:00+02:00',
    });
    expect(result.success).toBe(true);
  });

  it('rejects validTo earlier than validFrom', () => {
    const result = ClaimSchema.safeParse({
      ...baseClaimV3,
      status: 'contested' as const,
      validFrom: '2026-03-25T00:00:00+02:00',
      validTo: '2026-01-01T00:00:00+02:00',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a self-superseding claim', () => {
    const result = ClaimSchema.safeParse({
      ...baseClaimV3,
      status: 'contested' as const,
      supersededBy: baseClaimV3.id,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a different-id supersession pointer', () => {
    const result = ClaimSchema.safeParse({
      ...baseClaimV3,
      status: 'contested' as const,
      supersededBy: ulid('CLAIM2'),
    });
    expect(result.success).toBe(true);
  });

  it('rejects text shorter than 10 chars', () => {
    const result = ClaimSchema.safeParse({
      ...baseClaimV3,
      text: 'short',
      status: 'insufficient-record' as const,
    });
    expect(result.success).toBe(false);
  });

  it('rejects V1 legacy status values', () => {
    for (const legacy of [
      'unverified',
      'verified',
      'contradicted',
      'unverifiable',
    ]) {
      const result = ClaimStatusSchema.safeParse(legacy);
      expect(result.success).toBe(false);
    }
  });

  it('rejects the V2 shape with bare intakeId (no sourceRef)', () => {
    const v2Shape = {
      id: ulid('CLAIM1'),
      intakeId: ulid('INTAKE1'),
      text: baseClaimV3.text,
      extractedAt: '2026-04-18T09:00:00+02:00',
      extractedBy: 'agent:evidence-intake',
      status: 'insufficient-record',
    };
    const result = ClaimSchema.safeParse(v2Shape);
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields under strict()', () => {
    const result = ClaimSchema.safeParse({
      ...baseClaimV3,
      status: 'insufficient-record' as const,
      rogue: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe('ClaimSourceRefSchema', () => {
  it('accepts intake and artefact discriminants', () => {
    expect(
      ClaimSourceRefSchema.safeParse({
        kind: 'intake',
        id: ulid('INTAKE1'),
      }).success,
    ).toBe(true);
    expect(
      ClaimSourceRefSchema.safeParse({
        kind: 'artefact',
        id: ulid('ARTEFACT1'),
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown discriminant', () => {
    const result = ClaimSourceRefSchema.safeParse({
      kind: 'event',
      id: ulid('EVENT1'),
    });
    expect(result.success).toBe(false);
  });
});
