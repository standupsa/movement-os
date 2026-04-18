import {
  ClaimV2Schema,
  migrateClaimV2ToV3,
  reverseClaimV3ToV2,
  type ClaimV2,
} from './claim-v2-to-v3.js';
import { ClaimSchema, type Claim } from '../claim.js';
import { ulid } from '../test-fixtures.js';

const v2: ClaimV2 = ClaimV2Schema.parse({
  id: ulid('CLAIM1'),
  intakeId: ulid('INTAKE1'),
  text: 'SAPS took >12 weeks to act on case 123/04/2026.',
  extractedAt: '2026-04-18T09:00:00+02:00',
  extractedBy: 'agent:evidence-intake',
  status: 'insufficient-record',
});

describe('migrateClaimV2ToV3 (forward)', () => {
  it('lifts a V2 record into a valid V3 record', () => {
    const v3 = migrateClaimV2ToV3(v2);
    expect(ClaimSchema.safeParse(v3).success).toBe(true);
  });

  it('preserves id, text, extractedBy, status', () => {
    const v3 = migrateClaimV2ToV3(v2);
    expect(v3.id).toBe(v2.id);
    expect(v3.text).toBe(v2.text);
    expect(v3.extractedBy).toBe(v2.extractedBy);
    expect(v3.status).toBe(v2.status);
  });

  it('renames extractedAt → assertedAt (exact value preserved)', () => {
    const v3 = migrateClaimV2ToV3(v2);
    expect(v3.assertedAt).toBe(v2.extractedAt);
  });

  it('wraps intakeId into sourceRef with kind="intake"', () => {
    const v3 = migrateClaimV2ToV3(v2);
    expect(v3.sourceRef).toEqual({ kind: 'intake', id: v2.intakeId });
  });

  it('sets validFrom and validTo to null (genuinely unknown for legacy records)', () => {
    const v3 = migrateClaimV2ToV3(v2);
    expect(v3.validFrom).toBeNull();
    expect(v3.validTo).toBeNull();
  });

  it('does not set supersededBy on forward migration', () => {
    const v3 = migrateClaimV2ToV3(v2);
    expect(v3.supersededBy).toBeUndefined();
  });

  it('is total across the V2 status enum', () => {
    const statuses = [
      'conclusive',
      'high-confidence',
      'contested',
      'insufficient-record',
      'destroyed-or-missing-record-suspected',
    ] as const;
    for (const status of statuses) {
      const result = migrateClaimV2ToV3({ ...v2, status });
      expect(result.status).toBe(status);
    }
  });

  it('rejects an input that is not a valid V2 record', () => {
    // text < 10 chars fails V2 parse at runtime without tripping the
    // branded-ID types at the TS level.
    expect(() => migrateClaimV2ToV3({ ...v2, text: 'short' })).toThrow();
  });
});

describe('reverseClaimV3ToV2 (reverse, partial by design)', () => {
  it('rebuilds the V2 shape when sourceRef.kind === "intake"', () => {
    const v3 = migrateClaimV2ToV3(v2);
    const back = reverseClaimV3ToV2(v3);
    expect(back).toEqual(v2);
  });

  it('throws when sourceRef.kind !== "intake" (artefact has no V2 form)', () => {
    const artefactBacked: Claim = ClaimSchema.parse({
      id: ulid('CLAIM1'),
      text: v2.text,
      extractedBy: v2.extractedBy,
      status: v2.status,
      sourceRef: { kind: 'artefact', id: ulid('ARTEFACT1') },
      assertedAt: v2.extractedAt,
      validFrom: null,
      validTo: null,
    });
    expect(() => reverseClaimV3ToV2(artefactBacked)).toThrow(
      /no V2 representation/,
    );
  });

  it('drops validFrom, validTo, and supersededBy on reverse', () => {
    const v3: Claim = ClaimSchema.parse({
      id: ulid('CLAIM1'),
      text: v2.text,
      extractedBy: v2.extractedBy,
      status: v2.status,
      sourceRef: { kind: 'intake', id: v2.intakeId },
      assertedAt: v2.extractedAt,
      validFrom: '2026-01-01T00:00:00+02:00',
      validTo: '2026-02-01T00:00:00+02:00',
      supersededBy: ulid('CLAIM2'),
    });
    const back = reverseClaimV3ToV2(v3);
    expect(back).not.toHaveProperty('validFrom');
    expect(back).not.toHaveProperty('validTo');
    expect(back).not.toHaveProperty('supersededBy');
  });
});

describe('round-trip identity (intake-backed V2 records only)', () => {
  it('V2 → V3 → V2 is identity for intake-backed records', () => {
    const round = reverseClaimV3ToV2(migrateClaimV2ToV3(v2));
    expect(round).toEqual(v2);
  });
});
