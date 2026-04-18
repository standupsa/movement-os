import { mapOpenAiFinishReason } from './finish-reason.js';

describe('mapOpenAiFinishReason', () => {
  it.each([
    ['stop', 'completed'],
    ['tool_calls', 'completed'],
    ['function_call', 'completed'],
  ] as const)('%p → %p', (raw, expected) => {
    expect(mapOpenAiFinishReason(raw)).toBe(expected);
  });

  it.each([
    ['length', 'incomplete'],
    ['content_filter', 'incomplete'],
  ] as const)('%p → %p', (raw, expected) => {
    expect(mapOpenAiFinishReason(raw)).toBe(expected);
  });

  it('maps unknown values conservatively to incomplete', () => {
    expect(mapOpenAiFinishReason('some_future_reason')).toBe('incomplete');
    expect(mapOpenAiFinishReason('')).toBe('incomplete');
  });
});
