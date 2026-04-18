/**
 * Canonical JSON serialization for hashing.
 *
 * Two events that differ only in key insertion order or in the presence
 * of `undefined` fields must produce the same hash. `JSON.stringify`
 * alone does not guarantee this: object key order is preserved from
 * insertion, and `undefined` values are dropped from objects but
 * retained (as `null`) inside arrays. Both inconsistencies would let a
 * malicious or buggy serializer produce envelopes with the same logical
 * content but different hashes — a direct attack on the chain's
 * tamper-evidence property.
 *
 * Rules enforced here:
 *
 *   - Object keys are sorted lexicographically at every depth.
 *   - `undefined` object values are OMITTED (not serialised as null).
 *     Arrays, however, keep their length: `undefined` inside an array
 *     is serialised as `null` (the JSON default) because removing it
 *     would change index semantics. Callers with optional values in
 *     arrays should filter before passing in.
 *   - Non-finite numbers (`NaN`, `Infinity`, `-Infinity`) are REJECTED
 *     with a thrown error. JSON has no representation for them and
 *     `JSON.stringify` silently emits `null`, which would collide with
 *     actual `null` values.
 *   - Functions, symbols, and bigints are REJECTED. An event payload
 *     that carries one of these is a programming error at the caller.
 *
 * The output is a standard JSON string — any JSON parser will
 * round-trip it. What it is NOT is the input's `JSON.stringify` output:
 * re-serialising the parsed value through `canonicalize` may reorder
 * keys, which is the point.
 */

export function canonicalize(value: unknown): string {
  return JSON.stringify(toCanonical(value));
}

function toCanonical(value: unknown): unknown {
  if (value === null) {
    return null;
  }
  const t = typeof value;
  if (t === 'string' || t === 'boolean') {
    return value;
  }
  if (t === 'number') {
    const n = value as number;
    if (!Number.isFinite(n)) {
      throw new Error(
        `canonicalize: non-finite number (${String(n)}) cannot be serialised`,
      );
    }
    return n;
  }
  if (Array.isArray(value)) {
    return value.map((v) => (v === undefined ? null : toCanonical(v)));
  }
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const v = obj[k];
      if (v === undefined) {
        continue;
      }
      out[k] = toCanonical(v);
    }
    return out;
  }
  throw new Error(`canonicalize: unsupported value of type ${t}`);
}
