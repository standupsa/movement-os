import { ResponseStatusSchema } from './response.js';

describe('ResponseStatusSchema', () => {
  it.each(['completed', 'in_progress', 'incomplete'])(
    'accepts %s',
    (status) => {
      expect(ResponseStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it.each(['done', 'pending', 'failed', 'cancelled', ''])(
    'rejects %p',
    (bad) => {
      expect(ResponseStatusSchema.safeParse(bad).success).toBe(false);
    },
  );

  it('matches the xAI Responses API status vocabulary', () => {
    // Load-bearing: adapters for non-xAI providers MUST map onto this
    // exact set. If this list grows, every adapter's mapping must be
    // revisited — which is why this assertion exists.
    expect(ResponseStatusSchema.options).toEqual([
      'completed',
      'in_progress',
      'incomplete',
    ]);
  });
});
