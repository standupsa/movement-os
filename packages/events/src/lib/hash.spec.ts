import { GENESIS_HASH, sha256Hex } from './hash.js';

describe('sha256Hex', () => {
  it('returns a 64-char lower-case hex string', () => {
    const h = sha256Hex('anything');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for the same input', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'));
  });

  it('matches the published sha256 of the empty string', () => {
    // RFC 6234 test vector.
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('matches the published sha256 of "abc"', () => {
    // RFC 6234 test vector.
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('differs for inputs that differ by a single byte', () => {
    expect(sha256Hex('abc')).not.toBe(sha256Hex('abd'));
  });
});

describe('GENESIS_HASH', () => {
  it('is 64 zero hex digits', () => {
    expect(GENESIS_HASH).toBe('0'.repeat(64));
    expect(GENESIS_HASH).toMatch(/^[a-f0-9]{64}$/);
  });
});
