import { AuditEventSchema } from './audit.js';
import { ulid } from './test-fixtures.js';

const baseEvent = {
  id: ulid('AUD1'),
  at: '2026-04-18T12:00:00+02:00',
  actor: 'op.rudi',
  detail: { artefactId: ulid('ART1') },
  prevHash: '0'.repeat(64),
};

describe('AuditEventSchema', () => {
  it('accepts a known action', () => {
    const result = AuditEventSchema.safeParse({
      ...baseEvent,
      action: 'artefact.approved',
    });
    expect(result.success).toBe(true);
  });

  it('accepts new persistent-pursuit actions', () => {
    for (const action of [
      'case.created',
      'case.status.changed',
      'question.opened',
      'question.answered',
      'method.attempted',
      'humanlead.scheduled',
      'humanlead.completed',
      'consent.granted',
      'consent.withdrawn',
      'custody.collected',
      'custody.transferred',
      'custody.incident',
    ] as const) {
      const result = AuditEventSchema.safeParse({ ...baseEvent, action });
      expect(result.success).toBe(true);
    }
  });

  it('rejects an unknown action', () => {
    const result = AuditEventSchema.safeParse({ ...baseEvent, action: 'artefact.hexed' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-hex prevHash', () => {
    const result = AuditEventSchema.safeParse({
      ...baseEvent,
      action: 'intake.received',
      prevHash: 'Z'.repeat(64),
    });
    expect(result.success).toBe(false);
  });
});
