import { IntakeSchema, type Intake } from './intake.js';
import { ulid } from './test-fixtures.js';

const valid: Intake = IntakeSchema.parse({
  id: ulid('INTAKE1'),
  receivedAt: '2026-04-18T08:00:00+02:00',
  channel: 'web-form',
  source: { kind: 'witness', label: 'Gauteng — SAPS delay, case 123/04/2026' },
  body: 'Case reference opened at SAPS station; no follow-up in 12 weeks.',
  sensitivity: 'redact-on-intake',
  lawfulBasis: 'public-interest',
  receivedBy: 'op.rudi',
});

describe('IntakeSchema', () => {
  it('accepts a well-formed intake', () => {
    // Arrange / Act done in setup; Assert here.
    expect(valid.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(valid.lawfulBasis).toBe('public-interest');
  });

  it('rejects a body longer than 20 000 chars', () => {
    const result = IntakeSchema.safeParse({
      ...valid,
      body: 'x'.repeat(20_001),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown channel', () => {
    const result = IntakeSchema.safeParse({ ...valid, channel: 'carrier-pigeon' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level fields under strict()', () => {
    const result = IntakeSchema.safeParse({ ...valid, rogue: true });
    expect(result.success).toBe(false);
  });

  it('rejects missing lawfulBasis', () => {
    const { lawfulBasis: _omit, ...rest } = valid;
    void _omit;
    const result = IntakeSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
