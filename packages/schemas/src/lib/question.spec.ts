import { QuestionSchema, type QuestionStatus } from './question.js';
import { ulid } from './test-fixtures.js';

const base = {
  questionId: ulid('QUEST1'),
  caseId: ulid('CASE1'),
  text: 'What was the precise unit deployment at Phola Park on 1993-05-25?',
  createdAt: '2026-04-18T08:00:00+02:00',
  updatedAt: '2026-04-18T08:00:00+02:00',
} as const;

describe('QuestionSchema — status/answerClaimId refinement', () => {
  it("requires answerClaimId when status === 'answered'", () => {
    const bad = QuestionSchema.safeParse({ ...base, status: 'answered' });
    expect(bad.success).toBe(false);

    const ok = QuestionSchema.safeParse({
      ...base,
      status: 'answered',
      answerClaimId: ulid('CLAIM1'),
    });
    expect(ok.success).toBe(true);
  });

  it("forbids answerClaimId when status !== 'answered'", () => {
    const nonAnswered: readonly QuestionStatus[] = [
      'open',
      'no-further-method-available',
    ];
    for (const status of nonAnswered) {
      const result = QuestionSchema.safeParse({
        ...base,
        status,
        answerClaimId: ulid('CLAIM1'),
      });
      expect(result.success).toBe(false);
    }
  });

  it("accepts non-answered statuses without answerClaimId", () => {
    for (const status of ['open', 'no-further-method-available'] as const) {
      const result = QuestionSchema.safeParse({ ...base, status });
      expect(result.success).toBe(true);
    }
  });

  it('rejects unknown fields under strict()', () => {
    const result = QuestionSchema.safeParse({
      ...base,
      status: 'open',
      rogue: true,
    });
    expect(result.success).toBe(false);
  });
});
