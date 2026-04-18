import {
  checkTone,
  summariseViolations,
  enforcedPrinciples,
  type ToneCheckResult,
} from './guardrails.js';

const expectBlocked = (result: ToneCheckResult): void => {
  expect(result.ok).toBe(false);
  expect(result.violations.some((v) => v.severity === 'block')).toBe(true);
};

const expectWarnedOnly = (result: ToneCheckResult): void => {
  expect(result.ok).toBe(true);
  expect(result.violations.length).toBeGreaterThan(0);
  expect(result.violations.every((v) => v.severity === 'warn')).toBe(true);
};

describe('@wsa/guardrails / checkTone', () => {
  describe('clean text', () => {
    it('passes the mission sentence itself', () => {
      const result = checkTone(
        'We stand for equal protection, equal dignity, and accountable government for every South African.',
      );
      expect(result.ok).toBe(true);
      expect(result.violations).toEqual([]);
    });
  });

  describe('incitement (blocks)', () => {
    it.each([
      'They should hang them from the rafters.',
      'We will burn it down if we have to.',
      'Time to take up arms.',
      'By any means necessary.',
    ])('blocks incitement phrase: %s', (text) => {
      expectBlocked(checkTone(text));
    });
  });

  describe('dehumanising language (blocks)', () => {
    it('blocks "they are animals"', () => {
      expectBlocked(
        checkTone('Those people are animals and should be dealt with.'),
      );
    });

    it('blocks "sub-human"', () => {
      expectBlocked(checkTone('This treatment of sub-human beings must stop.'));
    });
  });

  describe('race-essentialist framing (warns)', () => {
    it('warns on "all X are" patterns', () => {
      expectWarnedOnly(checkTone('All white South Africans are complicit.'));
    });

    it('warns on "X always" patterns', () => {
      expectWarnedOnly(checkTone('Black south africans always bear the cost.'));
    });
  });

  describe('martyr framing (warns)', () => {
    it('warns on "live or die, our children"', () => {
      expectWarnedOnly(checkTone('Live or die, our children will be free.'));
    });

    it('warns on "willing to die"', () => {
      expectWarnedOnly(checkTone('I am willing to die for this cause.'));
    });
  });

  describe('unsourced universal claims (warns)', () => {
    it('warns on "every single"', () => {
      expectWarnedOnly(
        checkTone('Every single public official is on the take.'),
      );
    });
  });

  describe('summariseViolations', () => {
    it('returns "clean" when there are no violations', () => {
      expect(summariseViolations({ ok: true, violations: [] })).toBe('clean');
    });

    it('lists each violation on a separate line', () => {
      const result = checkTone('Kill them all. Every single one.');
      const summary = summariseViolations(result);
      expect(summary).toContain('[BLOCK]');
      expect(summary).toContain('non-violent/');
    });
  });

  describe('enforcedPrinciples', () => {
    it('returns the 8 principle ids', () => {
      const ids = enforcedPrinciples();
      expect(ids).toHaveLength(8);
      expect(ids).toContain('non-racial');
      expect(ids).toContain('family-first');
    });
  });
});
