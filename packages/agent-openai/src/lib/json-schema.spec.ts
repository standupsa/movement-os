import { z } from 'zod';
import { zodToOpenAiJsonSchema } from './json-schema.js';

describe('zodToOpenAiJsonSchema', () => {
  it('emits inlined object schema (no $ref wrapper)', () => {
    const schema = z.object({ name: z.string(), age: z.number() });

    const result = zodToOpenAiJsonSchema(schema);

    expect(result.type).toBe('object');
    expect(result.$ref).toBeUndefined();
    expect(result.definitions).toBeUndefined();
  });

  it('strips the $schema key (OpenAI rejects it)', () => {
    const schema = z.object({ x: z.string() });

    const result = zodToOpenAiJsonSchema(schema);

    expect(result.$schema).toBeUndefined();
  });

  it('serialises losslessly through JSON.stringify', () => {
    const schema = z.object({ items: z.array(z.string()) });

    const result = zodToOpenAiJsonSchema(schema);

    expect(() => JSON.stringify(result)).not.toThrow();
  });
});
