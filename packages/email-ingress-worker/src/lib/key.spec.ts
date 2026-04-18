import { generateKey } from './key.js';

describe('generateKey', () => {
  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

  it('returns the expected YYYY-MM-DD/HHMMSS-<uuid>-<alias>.eml shape', () => {
    const when = new Date('2026-04-18T14:23:45.000Z');
    const key = generateKey(when, 'hello@witnesssouthafrica.org');
    const pattern = new RegExp(
      `^2026-04-18/142345-${UUID_RE.source}-hello\\.eml$`,
    );
    expect(key).toMatch(pattern);
  });

  it('extracts the alias from the local-part of the recipient', () => {
    const key = generateKey(
      new Date('2026-04-18T00:00:00Z'),
      'support@example.org',
    );
    expect(key.endsWith('-support.eml')).toBe(true);
  });

  it('falls back to "unknown" when the recipient has no local-part', () => {
    const key = generateKey(new Date('2026-04-18T00:00:00Z'), '@example.org');
    expect(key.endsWith('-unknown.eml')).toBe(true);
  });

  it('falls back to "unknown" when the recipient has no @ at all', () => {
    const key = generateKey(new Date('2026-04-18T00:00:00Z'), '');
    expect(key.endsWith('-unknown.eml')).toBe(true);
  });

  it('produces unique keys on repeat calls with identical inputs', () => {
    const when = new Date('2026-04-18T00:00:00Z');
    const a = generateKey(when, 'hello@witnesssouthafrica.org');
    const b = generateKey(when, 'hello@witnesssouthafrica.org');
    expect(a).not.toBe(b);
  });

  it('uses the UTC components of the provided Date', () => {
    const when = new Date('2026-04-18T23:59:59.500Z');
    const key = generateKey(when, 'hello@x');
    expect(key.startsWith('2026-04-18/235959-')).toBe(true);
  });
});
