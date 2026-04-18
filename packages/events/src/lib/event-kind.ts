/**
 * EventKind — the verb-on-aggregate label carried by every event in the
 * canonical log.
 *
 * Shape is `<aggregate>.<verb>` where both halves are lowercase
 * slug-form (letters, digits, hyphen; must start with a letter). The
 * format is deliberately narrow so the event log is greppable and
 * reviewers can read a feed of kinds without ambiguity — e.g.
 * `claim.asserted`, `claim.superseded`, `evidence.attached`,
 * `case.opened`, `approval.granted`.
 *
 * The `<aggregate>` half should match the `aggregateKind` field of the
 * envelope for the same event; that invariant is NOT enforced at the
 * schema layer (schemas can't cross-reference fields cheaply here) but
 * IS enforced by `appendEvent` and `verifyChain` downstream.
 *
 * Branded so a raw string can't be passed where an `EventKind` is
 * expected — callers must run the schema's `.parse()` once at the
 * construction boundary, after which the type is self-vouching.
 */

import { z } from 'zod';

export const EVENT_KIND_REGEX = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/;

export const EventKindSchema = z
  .string()
  .regex(
    EVENT_KIND_REGEX,
    'expected <aggregate>.<verb> lowercase slug form (e.g. claim.asserted)',
  )
  .brand<'EventKind'>();
export type EventKind = z.infer<typeof EventKindSchema>;

/**
 * Splits an `EventKind` into its `<aggregate>` and `<verb>` halves. The
 * split is the only way to read the parts programmatically — callers
 * that need them should go through this helper rather than re-running
 * the regex ad hoc.
 */
export function splitEventKind(kind: EventKind): {
  readonly aggregate: string;
  readonly verb: string;
} {
  const idx = kind.indexOf('.');
  // The schema guarantees exactly one '.' in the valid form; this
  // branch is defensive against callers that cast a raw string into
  // EventKind to bypass the schema.
  if (idx === -1) {
    throw new Error(`splitEventKind: missing "." in ${kind}`);
  }
  return {
    aggregate: kind.slice(0, idx),
    verb: kind.slice(idx + 1),
  };
}
