import { EventEnvelopeSchema } from './event-envelope.js';

const baseEnvelope = {
  id: '01K3EVENT00000000000000000',
  aggregateKind: 'claim',
  aggregateId: '01K3CLAIM00000000000000000',
  seq: 0,
  kind: 'claim.asserted',
  recordedAt: '2026-04-18T10:00:00+02:00',
  actor: 'agent:tone-gate-v1',
  payload: { claimText: 'the world is round' },
  prevHash: '0'.repeat(64),
  hash: 'a'.repeat(64),
};

describe('EventEnvelopeSchema', () => {
  it('accepts a well-formed envelope', () => {
    expect(() => EventEnvelopeSchema.parse(baseEnvelope)).not.toThrow();
  });

  it('rejects an unknown top-level field (strict mode)', () => {
    expect(() =>
      EventEnvelopeSchema.parse({ ...baseEnvelope, extra: 'nope' }),
    ).toThrow();
  });

  it('rejects a non-integer seq', () => {
    expect(() =>
      EventEnvelopeSchema.parse({ ...baseEnvelope, seq: 1.5 }),
    ).toThrow();
  });

  it('rejects a negative seq', () => {
    expect(() =>
      EventEnvelopeSchema.parse({ ...baseEnvelope, seq: -1 }),
    ).toThrow();
  });

  it('rejects an upper-case aggregateKind', () => {
    expect(() =>
      EventEnvelopeSchema.parse({ ...baseEnvelope, aggregateKind: 'Claim' }),
    ).toThrow();
  });

  it('rejects a malformed kind', () => {
    expect(() =>
      EventEnvelopeSchema.parse({ ...baseEnvelope, kind: 'claim' }),
    ).toThrow();
  });

  it('rejects a malformed actor', () => {
    expect(() =>
      EventEnvelopeSchema.parse({ ...baseEnvelope, actor: 'Rudi' }),
    ).toThrow();
  });

  it('rejects a malformed prevHash', () => {
    expect(() =>
      EventEnvelopeSchema.parse({ ...baseEnvelope, prevHash: 'not-a-hash' }),
    ).toThrow();
  });

  it('rejects a timestamp without a tz offset', () => {
    expect(() =>
      EventEnvelopeSchema.parse({
        ...baseEnvelope,
        recordedAt: '2026-04-18T10:00:00',
      }),
    ).toThrow();
  });

  it('accepts an empty payload object', () => {
    expect(() =>
      EventEnvelopeSchema.parse({ ...baseEnvelope, payload: {} }),
    ).not.toThrow();
  });
});
