import { LlmProviderIdSchema } from './provider-id.js';

describe('LlmProviderIdSchema', () => {
  it.each(['openai', 'xai', 'anthropic', 'local'])(
    'accepts %s',
    (id) => {
      expect(LlmProviderIdSchema.safeParse(id).success).toBe(true);
    },
  );

  it.each(['OpenAI', 'grok', 'azure', 'gpt-4', ''])('rejects %p', (bad) => {
    expect(LlmProviderIdSchema.safeParse(bad).success).toBe(false);
  });
});
