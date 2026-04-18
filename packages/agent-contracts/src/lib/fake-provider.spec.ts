import { z } from 'zod';
import { createFakeProvider } from './fake-provider.js';
import type { ModelProvider } from './model-provider.js';

describe('createFakeProvider', () => {
  it('returns a value narrowed to the caller schema', async () => {
    const ExtractionSchema = z.object({
      claims: z.array(z.string()).min(1),
    });

    const provider: ModelProvider = createFakeProvider({
      produce: (schema) =>
        schema.parse({ claims: ['equal law applies to all'] }),
    });

    const response = await provider.complete({
      schema: ExtractionSchema,
      messages: [{ role: 'user', content: 'extract' }],
      taskKind: 'analysis',
    });

    // Type-level assertion: response.value should be inferred as
    // { claims: string[] }. Exercise the narrowing by indexing.
    expect(response.value.claims).toEqual(['equal law applies to all']);
  });

  it('fills metadata defaults when the config omits them', async () => {
    const Schema = z.object({ ok: z.boolean() });
    const provider = createFakeProvider({
      produce: () => ({ ok: true }),
    });

    const response = await provider.complete({
      schema: Schema,
      messages: [{ role: 'user', content: '?' }],
      taskKind: 'analysis',
    });

    expect(response.provider).toBe('openai');
    expect(response.model).toBe('fake-model-0');
    expect(response.status).toBe('completed');
    expect(response.rawFinishReason).toBe('stop');
    expect(response.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
    expect(provider.id).toBe('openai');
  });

  it('honours explicit overrides for id, model, status and usage', async () => {
    const Schema = z.object({ ok: z.boolean() });
    const provider = createFakeProvider({
      id: 'xai',
      model: 'grok-4-fast',
      status: 'incomplete',
      rawFinishReason: 'length',
      responseId: 'resp_abc',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      produce: () => ({ ok: false }),
    });

    const response = await provider.complete({
      schema: Schema,
      messages: [{ role: 'user', content: '?' }],
      taskKind: 'challenge',
    });

    expect(provider.id).toBe('xai');
    expect(response.provider).toBe('xai');
    expect(response.model).toBe('grok-4-fast');
    expect(response.status).toBe('incomplete');
    expect(response.rawFinishReason).toBe('length');
    expect(response.responseId).toBe('resp_abc');
    expect(response.usage.totalTokens).toBe(15);
  });

  it("throws when `produce` returns a value the caller schema can't parse", async () => {
    const Schema = z.object({ claims: z.array(z.string()).min(1) });

    // Deliberately produce an invalid value — typed as unknown via the
    // caller's schema binding. The cast reaches into the generic to
    // fake a mis-specified producer, and then the fake's schema guard
    // catches it. No `any`.
    const provider = createFakeProvider({
      produce: (_schema) =>
        ({ claims: [] } as unknown as z.infer<typeof Schema>),
    });

    await expect(
      provider.complete({
        schema: Schema,
        messages: [{ role: 'user', content: '?' }],
        taskKind: 'analysis',
      }),
    ).rejects.toThrow();
  });

  it('narrows independently across different schemas', async () => {
    const StringSchema = z.string();
    const NumberObjSchema = z.object({ n: z.number() });

    const stringProvider = createFakeProvider({
      produce: (schema) => schema.parse('ok'),
    });
    const numberProvider = createFakeProvider({
      produce: (schema) => schema.parse({ n: 42 }),
    });

    const strResponse = await stringProvider.complete({
      schema: StringSchema,
      messages: [{ role: 'user', content: '?' }],
      taskKind: 'analysis',
    });
    // Type-level check: strResponse.value is `string`, not `unknown`.
    expect(strResponse.value.toUpperCase()).toBe('OK');

    const numResponse = await numberProvider.complete({
      schema: NumberObjSchema,
      messages: [{ role: 'user', content: '?' }],
      taskKind: 'analysis',
    });
    // Type-level check: numResponse.value is `{ n: number }`.
    expect(numResponse.value.n).toBe(42);
  });
});
