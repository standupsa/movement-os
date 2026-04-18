import { EVENT_ACTOR_REGEX, EventActorSchema } from './event-actor.js';

describe('EventActorSchema', () => {
  it.each([
    'human',
    'agent:tone-gate-v1',
    'agent:claim-extractor',
    'agent:a',
    'system:importer',
    'system:replayer-v2',
    'system:s',
  ])('accepts %s', (actor) => {
    expect(() => EventActorSchema.parse(actor)).not.toThrow();
  });

  it.each([
    '',
    'humans',
    'Human',
    'agent:',
    'agent:Tone',
    'agent:tone_gate',
    'agent: tone',
    'system:',
    'bot:tone-gate',
    'human:rudi',
    ' human',
    'human ',
  ])('rejects %s', (actor) => {
    expect(() => EventActorSchema.parse(actor)).toThrow();
  });
});

describe('EVENT_ACTOR_REGEX', () => {
  it('matches the three valid forms', () => {
    expect(EVENT_ACTOR_REGEX.test('human')).toBe(true);
    expect(EVENT_ACTOR_REGEX.test('agent:x')).toBe(true);
    expect(EVENT_ACTOR_REGEX.test('system:x')).toBe(true);
  });
});
