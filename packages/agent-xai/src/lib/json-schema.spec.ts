import { z } from 'zod';
import { zodToXaiJsonSchema } from './json-schema.js';

describe('zodToXaiJsonSchema', () => {
  it('emits an inlined JSON Schema (no $ref wrapper)', () => {
    const schema = z.object({ id: z.string(), count: z.number() });

    const result = zodToXaiJsonSchema(schema);

    expect(result.type).toBe('object');
    expect(result.$ref).toBeUndefined();
    expect(result.definitions).toBeUndefined();
  });

  it('strips the $schema key (xAI rejects it in json_schema.schema)', () => {
    const schema = z.object({ id: z.string() });

    const result = zodToXaiJsonSchema(schema);

    expect(result.$schema).toBeUndefined();
  });

  it('preserves property structure and required fields', () => {
    const schema = z.object({
      id: z.string(),
      count: z.number(),
      note: z.string().optional(),
    });

    const result = zodToXaiJsonSchema(schema);

    expect(result).toMatchObject({
      type: 'object',
      properties: {
        id: { type: 'string' },
        count: { type: 'number' },
        note: { type: 'string' },
      },
      required: ['id', 'count'],
    });
  });
});
