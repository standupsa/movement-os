import { generateUlid } from './ulid.js';

describe('generateUlid', () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
    });
  });

  it('returns a 26-character Crockford ULID string', () => {
    const values = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues<T extends ArrayBufferView | null>(buffer: T): T {
          if (buffer instanceof Uint8Array) {
            buffer.set(values);
          }
          return buffer;
        },
      },
      configurable: true,
    });

    const id = generateUlid(new Date('2026-04-18T16:40:00.000Z'));

    expect(id).toHaveLength(26);
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('changes when the random bytes change at the same timestamp', () => {
    const sequences = [
      Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
      Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 2]),
    ];
    let idx = 0;
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues<T extends ArrayBufferView | null>(buffer: T): T {
          if (buffer instanceof Uint8Array) {
            buffer.set(
              sequences[idx] ?? sequences.at(-1) ?? new Uint8Array(10),
            );
            idx += 1;
          }
          return buffer;
        },
      },
      configurable: true,
    });

    const now = new Date('2026-04-18T16:40:00.000Z');
    const first = generateUlid(now);
    const second = generateUlid(now);

    expect(first).not.toBe(second);
    expect(first.slice(0, 10)).toBe(second.slice(0, 10));
  });
});
