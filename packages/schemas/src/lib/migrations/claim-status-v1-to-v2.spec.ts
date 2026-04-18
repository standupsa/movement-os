import {
  CLAIM_STATUS_FORWARD_MAP,
  CLAIM_STATUS_REVERSE_MAP,
  ClaimStatusV1Schema,
  ClaimStatusV2Schema,
  migrateClaimStatusV1ToV2,
  reverseClaimStatusV2ToV1,
  type ClaimStatusV1,
  type ClaimStatusV2,
} from './claim-status-v1-to-v2.js';

const FORWARD_TABLE: ReadonlyArray<readonly [ClaimStatusV1, ClaimStatusV2]> = [
  ['unverified', 'insufficient-record'],
  ['verified', 'high-confidence'],
  ['contradicted', 'contested'],
  ['unverifiable', 'insufficient-record'],
];

const REVERSE_TABLE: ReadonlyArray<readonly [ClaimStatusV2, ClaimStatusV1]> = [
  ['conclusive', 'verified'],
  ['high-confidence', 'verified'],
  ['contested', 'contradicted'],
  ['insufficient-record', 'unverified'],
  ['destroyed-or-missing-record-suspected', 'unverifiable'],
];

describe('migrateClaimStatusV1ToV2 (forward)', () => {
  it.each(FORWARD_TABLE)('maps %s → %s', (v1, expected) => {
    expect(migrateClaimStatusV1ToV2(v1)).toBe(expected);
  });

  it('is total across the V1 enum', () => {
    for (const v1 of ClaimStatusV1Schema.options) {
      expect(() => migrateClaimStatusV1ToV2(v1)).not.toThrow();
    }
  });

  // Load-bearing invariant: destroyed-or-missing-record-suspected is
  // deliberate, not a fallback.
  it('never returns destroyed-or-missing-record-suspected', () => {
    const values = Object.values(CLAIM_STATUS_FORWARD_MAP);
    expect(values).not.toContain('destroyed-or-missing-record-suspected');
  });
});

describe('reverseClaimStatusV2ToV1 (reverse, lossy by design)', () => {
  it.each(REVERSE_TABLE)('maps %s → %s', (v2, expected) => {
    expect(reverseClaimStatusV2ToV1(v2)).toBe(expected);
  });

  it('is total across the V2 enum', () => {
    for (const v2 of ClaimStatusV2Schema.options) {
      expect(() => reverseClaimStatusV2ToV1(v2)).not.toThrow();
    }
  });
});

describe('forward → reverse → forward idempotence (per lossy-equivalent bucket)', () => {
  it.each(FORWARD_TABLE)(
    'round-trips %s through V2 and lands in its bucket',
    (_v1, v2) => {
      const back = reverseClaimStatusV2ToV1(v2);
      const again = migrateClaimStatusV1ToV2(back);
      expect(again).toBe(v2);
    },
  );
});

describe('maps are frozen against mutation', () => {
  it('forward map is frozen', () => {
    expect(Object.isFrozen(CLAIM_STATUS_FORWARD_MAP)).toBe(true);
  });
  it('reverse map is frozen', () => {
    expect(Object.isFrozen(CLAIM_STATUS_REVERSE_MAP)).toBe(true);
  });
});
