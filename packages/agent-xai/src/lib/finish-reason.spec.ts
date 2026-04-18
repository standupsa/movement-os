import { mapXaiFinishReason } from './finish-reason.js';

describe('mapXaiFinishReason', () => {
  it.each(['stop', 'tool_calls', 'function_call'])(
    'maps %s to completed',
    (raw) => {
      expect(mapXaiFinishReason(raw)).toBe('completed');
    },
  );

  it.each(['length', 'content_filter'])(
    'maps %s to incomplete',
    (raw) => {
      expect(mapXaiFinishReason(raw)).toBe('incomplete');
    },
  );

  it('maps unknown terminators to incomplete (conservative)', () => {
    expect(mapXaiFinishReason('future_mystery_reason')).toBe('incomplete');
    expect(mapXaiFinishReason('')).toBe('incomplete');
  });
});
