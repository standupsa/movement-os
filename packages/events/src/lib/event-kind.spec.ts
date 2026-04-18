import {
  EVENT_KIND_REGEX,
  EventKindSchema,
  splitEventKind,
} from './event-kind.js';

describe('EventKindSchema', () => {
  it.each([
    'claim.asserted',
    'claim.superseded',
    'evidence.attached',
    'case.opened',
    'approval.granted',
    'method-attempt.recorded',
    'claim.attributed-to',
    'claim.kind-2',
  ])('accepts %s', (kind) => {
    expect(() => EventKindSchema.parse(kind)).not.toThrow();
  });

  it.each([
    '',
    'claim',
    '.asserted',
    'claim.',
    'Claim.asserted',
    'claim.ASSERTED',
    'claim_asserted',
    'claim..asserted',
    'claim.asserted.twice',
    '1claim.asserted',
    'claim.1asserted',
    ' claim.asserted',
    'claim.asserted ',
  ])('rejects %s', (kind) => {
    expect(() => EventKindSchema.parse(kind)).toThrow();
  });
});

describe('EVENT_KIND_REGEX', () => {
  it('is the regex enforced by the schema', () => {
    expect(EVENT_KIND_REGEX.test('claim.asserted')).toBe(true);
    expect(EVENT_KIND_REGEX.test('claim.asserted.twice')).toBe(false);
  });
});

describe('splitEventKind', () => {
  it('splits into aggregate and verb halves', () => {
    const kind = EventKindSchema.parse('evidence.attached');
    expect(splitEventKind(kind)).toEqual({
      aggregate: 'evidence',
      verb: 'attached',
    });
  });

  it('preserves hyphens in either half', () => {
    const kind = EventKindSchema.parse('method-attempt.re-tried');
    expect(splitEventKind(kind)).toEqual({
      aggregate: 'method-attempt',
      verb: 're-tried',
    });
  });
});
