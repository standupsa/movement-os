import { MethodAttemptSchema } from './method-attempt.js';
import { ulid } from './test-fixtures.js';

const base = {
  attemptId: ulid('MATT1'),
  caseId: ulid('CASE1'),
  questionId: ulid('QUEST1'),
  level: 'L1' as const,
  methodKind: 'paia-request',
  source: 'SAPS',
  outcome: 'no-result' as const,
  timeToResultMs: 2_592_000_000, // ~30 days in ms
  costZarCents: 3500,
  attemptedAt: '2026-03-18T08:00:00+02:00',
} as const;

describe('MethodAttemptSchema', () => {
  it('accepts exactly one of agent/human as the attempter', () => {
    const agentOk = MethodAttemptSchema.safeParse({
      ...base,
      attemptedByAgentId: 'agent:records',
    });
    expect(agentOk.success).toBe(true);

    const humanOk = MethodAttemptSchema.safeParse({
      ...base,
      attemptedByHumanId: 'runner.nandi',
    });
    expect(humanOk.success).toBe(true);
  });

  it('rejects neither agent nor human as the attempter', () => {
    const result = MethodAttemptSchema.safeParse({ ...base });
    expect(result.success).toBe(false);
  });

  it('rejects both agent and human as the attempter', () => {
    const result = MethodAttemptSchema.safeParse({
      ...base,
      attemptedByAgentId: 'agent:records',
      attemptedByHumanId: 'runner.nandi',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative or non-integer costs', () => {
    const neg = MethodAttemptSchema.safeParse({
      ...base,
      attemptedByAgentId: 'agent:records',
      costZarCents: -1,
    });
    expect(neg.success).toBe(false);

    const frac = MethodAttemptSchema.safeParse({
      ...base,
      attemptedByAgentId: 'agent:records',
      costZarCents: 3.5,
    });
    expect(frac.success).toBe(false);
  });

  it('defaults producedEvidenceIds to an empty array', () => {
    const parsed = MethodAttemptSchema.parse({
      ...base,
      attemptedByAgentId: 'agent:records',
    });
    expect(parsed.producedEvidenceIds).toEqual([]);
  });

  it('rejects unknown fields under strict()', () => {
    const result = MethodAttemptSchema.safeParse({
      ...base,
      attemptedByAgentId: 'agent:records',
      rogue: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid level', () => {
    const result = MethodAttemptSchema.safeParse({
      ...base,
      attemptedByAgentId: 'agent:records',
      level: 'L9',
    });
    expect(result.success).toBe(false);
  });
});
