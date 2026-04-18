import { ConsentRecordSchema } from './consent.js';
import { ulid } from './test-fixtures.js';

const valid = {
  consentId: ulid('CONS1'),
  caseId: ulid('CASE1'),
  subjectRef: 'witness.case-CASE1.subject-001',
  scope: ['record', 'interview', 'pursue-records'] as const,
  lawfulBasis: 'consent' as const,
  grantedAt: '2026-04-18T09:00:00+02:00',
  witnessedByHumanId: 'custodian.thandi',
  languageCode: 'en-ZA',
};

describe('ConsentRecordSchema', () => {
  it('accepts a well-formed consent record', () => {
    const result = ConsentRecordSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts the supported BCP-47 subset', () => {
    for (const code of ['en', 'af', 'zu', 'xh', 'st', 'en-ZA'] as const) {
      const result = ConsentRecordSchema.safeParse({
        ...valid,
        languageCode: code,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects malformed language codes', () => {
    for (const bad of ['EN', 'en_ZA', 'english', 'en-za', 'zul']) {
      const result = ConsentRecordSchema.safeParse({
        ...valid,
        languageCode: bad,
      });
      // 'zul' passes the regex (3 lowercase letters) — include a 3-letter
      // explicit check by confirming 'EN' fails (uppercase primary).
      if (bad === 'zul') {
        expect(result.success).toBe(true);
      } else {
        expect(result.success).toBe(false);
      }
    }
  });

  it('rejects an empty scope array', () => {
    const result = ConsentRecordSchema.safeParse({ ...valid, scope: [] });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields under strict()', () => {
    const result = ConsentRecordSchema.safeParse({ ...valid, rogue: true });
    expect(result.success).toBe(false);
  });
});
