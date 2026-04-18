import { AgentTaskKindSchema } from './task-kind.js';

describe('AgentTaskKindSchema', () => {
  it.each(['sensitive-intake', 'analysis', 'challenge'])(
    'accepts %s',
    (kind) => {
      expect(AgentTaskKindSchema.safeParse(kind).success).toBe(true);
    },
  );

  it.each(['intake', 'sensitive', 'default', 'SENSITIVE_INTAKE'])(
    'rejects %p',
    (bad) => {
      expect(AgentTaskKindSchema.safeParse(bad).success).toBe(false);
    },
  );

  it('preserves ADR-0003 lane ordering via enum .options', () => {
    expect(AgentTaskKindSchema.options).toEqual([
      'sensitive-intake',
      'analysis',
      'challenge',
    ]);
  });
});
