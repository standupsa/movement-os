import { HumanLeadSchema } from './human-lead.js';
import { ulid } from './test-fixtures.js';

const valid = {
  leadId: ulid('LEAD1'),
  caseId: ulid('CASE1'),
  kind: 'archive-run' as const,
  assignedToHumanId: 'runner.nandi',
  status: 'planned' as const,
  safetyAssessment: 'low' as const,
  briefingNotes: 'NARSSA Pretoria — pull 1993 ISU unit records for Phola Park.',
};

describe('HumanLeadSchema', () => {
  it('accepts a well-formed lead', () => {
    const result = HumanLeadSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts every defined safetyAssessment level', () => {
    for (const level of ['low', 'elevated', 'high', 'critical'] as const) {
      const result = HumanLeadSchema.safeParse({
        ...valid,
        safetyAssessment: level,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects an unknown kind', () => {
    const result = HumanLeadSchema.safeParse({ ...valid, kind: 'drone-run' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields under strict()', () => {
    const result = HumanLeadSchema.safeParse({ ...valid, rogue: true });
    expect(result.success).toBe(false);
  });
});
