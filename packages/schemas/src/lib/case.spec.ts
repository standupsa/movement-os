import { CaseSchema, CaseStatusSchema, type CaseStatus } from './case.js';
import { ulid } from './test-fixtures.js';

const baseCase = {
  caseId: ulid('CASE1'),
  title: 'Leon Haarhoff — 1993 Phola Park inquiry',
  summary: 'Closing the gap between the public record and the family account.',
  principlesHash: 'a'.repeat(64),
  createdAt: '2026-04-18T08:00:00+02:00',
  updatedAt: '2026-04-18T08:00:00+02:00',
} as const;

describe('CaseSchema', () => {
  it('accepts every ADR-0002 status literal', () => {
    const statuses: readonly CaseStatus[] = [
      'active',
      'paused-awaiting',
      'resolved-with-finding',
      'resolved-insufficient-evidence',
      'destroyed-or-missing-record-suspected',
    ];
    for (const status of statuses) {
      const result = CaseSchema.safeParse({ ...baseCase, status });
      expect(result.success).toBe(true);
    }
  });

  // Load-bearing regression: ADR-0002 forbids an 'abandoned' state.
  it("rejects the forbidden 'abandoned' status", () => {
    const result = CaseStatusSchema.safeParse('abandoned');
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields under strict()', () => {
    const result = CaseSchema.safeParse({
      ...baseCase,
      status: 'active',
      rogue: true,
    });
    expect(result.success).toBe(false);
  });

  it('accepts an optional pausedUntil', () => {
    const result = CaseSchema.safeParse({
      ...baseCase,
      status: 'paused-awaiting',
      pausedUntil: '2026-05-18T08:00:00+02:00',
    });
    expect(result.success).toBe(true);
  });
});
