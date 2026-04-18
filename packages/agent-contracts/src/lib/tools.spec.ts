import { z } from 'zod';
import { defineTool } from './tools.js';

describe('defineTool', () => {
  it('returns the spec unchanged for a valid definition', () => {
    const spec = defineTool({
      name: 'fetch_record',
      description: 'Fetch a record from the archive by ID.',
      parameters: z.object({ recordId: z.string() }),
    });
    expect(spec.name).toBe('fetch_record');
    expect(spec.description.length).toBeGreaterThan(0);
  });

  it.each([
    ['1bad', 'starts with digit'],
    ['-lead', 'starts with hyphen'],
    ['', 'empty'],
    ['has space', 'contains space'],
    ['has.dot', 'contains dot'],
  ])('rejects invalid name %p (%s)', (name, _reason) => {
    expect(() =>
      defineTool({
        name,
        description: 'x',
        parameters: z.object({}),
      }),
    ).toThrow(/invalid tool name/);
  });

  it('rejects empty or whitespace-only descriptions', () => {
    expect(() =>
      defineTool({
        name: 'ok',
        description: '   ',
        parameters: z.object({}),
      }),
    ).toThrow(/non-empty description/);
  });
});
