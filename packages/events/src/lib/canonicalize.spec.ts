import { canonicalize } from './canonicalize.js';

describe('canonicalize — determinism', () => {
  it('produces identical output for objects that differ only in key order', () => {
    const a = canonicalize({ b: 1, a: 2, c: 3 });
    const b = canonicalize({ c: 3, a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('sorts keys lexicographically at every depth', () => {
    const out = canonicalize({ z: { b: 1, a: 2 }, a: { y: 1, x: 2 } });
    expect(out).toBe('{"a":{"x":2,"y":1},"z":{"a":2,"b":1}}');
  });

  it('preserves array index order', () => {
    const out = canonicalize([3, 1, 2]);
    expect(out).toBe('[3,1,2]');
  });

  it('is stable across repeated calls on the same input', () => {
    const v = { payload: { id: 'x', list: [1, 2, { k: 'v', j: 'w' }] } };
    expect(canonicalize(v)).toBe(canonicalize(v));
  });
});

describe('canonicalize — undefined handling', () => {
  it('omits undefined object fields', () => {
    const a = canonicalize({ a: 1, b: undefined, c: 3 });
    const b = canonicalize({ a: 1, c: 3 });
    expect(a).toBe(b);
  });

  it('serialises undefined inside an array as null (index-preserving)', () => {
    const out = canonicalize([1, undefined, 3]);
    expect(out).toBe('[1,null,3]');
  });
});

describe('canonicalize — rejected values', () => {
  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('rejects %s', (_label, value) => {
    expect(() => canonicalize(value)).toThrow(/non-finite number/);
  });

  it('rejects a non-finite number nested inside an object', () => {
    expect(() => canonicalize({ k: Number.NaN })).toThrow(/non-finite number/);
  });

  it('rejects a function', () => {
    expect(() => canonicalize(() => 1)).toThrow(/unsupported value/);
  });

  it('rejects a bigint', () => {
    expect(() => canonicalize(BigInt(1))).toThrow(/unsupported value/);
  });

  it('rejects a symbol', () => {
    expect(() => canonicalize(Symbol('x'))).toThrow(/unsupported value/);
  });
});

describe('canonicalize — primitive pass-through', () => {
  it.each([
    ['null', null, 'null'],
    ['true', true, 'true'],
    ['false', false, 'false'],
    ['string', 'abc', '"abc"'],
    ['zero', 0, '0'],
    ['negative', -1.5, '-1.5'],
  ])('serialises %s correctly', (_label, input, expected) => {
    expect(canonicalize(input)).toBe(expected);
  });
});
