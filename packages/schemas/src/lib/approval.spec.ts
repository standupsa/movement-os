import { APPROVAL_ATTESTATION, ApprovalSchema } from './approval.js';
import { ulid } from './test-fixtures.js';

const baseApproval = {
  id: ulid('APPR1'),
  artefactId: ulid('ART1'),
  approvedBy: 'op.rudi',
  approvedAt: '2026-04-18T11:05:00+02:00',
};

describe('ApprovalSchema', () => {
  it('requires the exact literal attestation string', () => {
    const bad = ApprovalSchema.safeParse({ ...baseApproval, attestation: 'lgtm' });
    expect(bad.success).toBe(false);

    const ok = ApprovalSchema.safeParse({
      ...baseApproval,
      attestation: APPROVAL_ATTESTATION,
    });
    expect(ok.success).toBe(true);
  });

  it('rejects unknown fields under strict()', () => {
    const result = ApprovalSchema.safeParse({
      ...baseApproval,
      attestation: APPROVAL_ATTESTATION,
      rogue: true,
    });
    expect(result.success).toBe(false);
  });
});
