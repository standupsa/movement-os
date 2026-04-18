import { TokenUsageSchema } from './usage.js';

describe('TokenUsageSchema', () => {
  it('accepts a well-formed usage record', () => {
    expect(
      TokenUsageSchema.safeParse({
        inputTokens: 100,
        outputTokens: 25,
        totalTokens: 125,
        cachedInputTokens: 80,
        costInUsdTicks: 107500,
      }).success,
    ).toBe(true);
  });

  it('rejects negative counters', () => {
    expect(
      TokenUsageSchema.safeParse({
        inputTokens: -1,
        outputTokens: 0,
        totalTokens: 0,
      }).success,
    ).toBe(false);
  });

  it('rejects non-integer counters', () => {
    expect(
      TokenUsageSchema.safeParse({
        inputTokens: 10.5,
        outputTokens: 0,
        totalTokens: 10.5,
      }).success,
    ).toBe(false);
  });

  it('rejects unknown fields under strict()', () => {
    expect(
      TokenUsageSchema.safeParse({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedTokens: 10,
      }).success,
    ).toBe(false);
  });
});
