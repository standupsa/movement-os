import { AgentMessageSchema } from './messages.js';

describe('AgentMessageSchema', () => {
  it('accepts a well-formed system message', () => {
    const parsed = AgentMessageSchema.safeParse({
      role: 'system',
      content: 'You are an archival clerk.',
    });
    expect(parsed.success).toBe(true);
  });

  it.each(['system', 'user', 'assistant'] as const)(
    'accepts role %s',
    (role) => {
      expect(
        AgentMessageSchema.safeParse({ role, content: 'ok' }).success,
      ).toBe(true);
    },
  );

  it('rejects empty content', () => {
    expect(
      AgentMessageSchema.safeParse({ role: 'user', content: '' }).success,
    ).toBe(false);
  });

  it('rejects unknown roles', () => {
    expect(
      AgentMessageSchema.safeParse({ role: 'tool', content: 'x' }).success,
    ).toBe(false);
  });

  it('rejects unknown fields under strict()', () => {
    expect(
      AgentMessageSchema.safeParse({
        role: 'user',
        content: 'x',
        rogue: 1,
      }).success,
    ).toBe(false);
  });
});
