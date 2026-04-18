/**
 * EventEnvelope — the canonical record stored in the append-only event
 * log.
 *
 * Every event carries three overlapping identities:
 *
 *   - `id`           — a globally unique id for THIS event record.
 *                      Caller-supplied (typically a ULID). Stable
 *                      across replay and the natural join key into
 *                      sidecar indexes.
 *   - `aggregateKind` + `aggregateId` — the entity (Claim, Case,
 *                      Evidence, …) the event is a fact about. Two
 *                      events with the same (kind, id) pair share a
 *                      hash chain. The two-field form (rather than a
 *                      composite id) is deliberate: `aggregateKind` is
 *                      greppable and lets the replayer partition by
 *                      entity class without consulting a second schema.
 *   - `seq`          — the 0-based position of this event within the
 *                      per-aggregate chain. Contiguous; the first
 *                      event for an aggregate has `seq === 0`.
 *
 * `prevHash` is the `hash` of the previous event in the same aggregate
 * chain, or `GENESIS_HASH` for `seq === 0`. `hash` is the SHA-256 of
 * the canonicalized envelope MINUS the `hash` field itself; see
 * `./chain.ts` for the `computeEventHash` helper.
 *
 * `payload` is intentionally an open record: each aggregate kind
 * defines its own payload shape in the relevant domain package. The
 * event log stores shapes opaquely so new aggregate kinds can ship
 * without the log changing.
 *
 * `.strict()` is applied so unknown fields in a persisted envelope are
 * a loud parse error rather than a silent drop — critical for a log
 * that must round-trip bit-exact for hash verification.
 */

import { z } from 'zod';
import { IsoTimestampSchema, Sha256HexSchema } from '@wsa/schemas';
import { EventKindSchema } from './event-kind.js';
import { EventActorSchema } from './event-actor.js';

/**
 * Slug-form aggregate class label. The lowercase, short form is
 * deliberate: it flows into `EventKind` ({aggregate}.{verb}) and into
 * human-readable feeds.
 */
export const AggregateKindSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, 'aggregateKind is a lowercase slug');
export type AggregateKind = z.infer<typeof AggregateKindSchema>;

/**
 * Opaque aggregate id. Kept as a free string (bounded length) rather
 * than branded per kind, because the event log is pan-domain and a
 * branded id would force this package to take a dependency on every
 * aggregate's schema module. ULIDs are the convention but not a
 * runtime constraint here.
 */
export const AggregateIdSchema = z.string().min(1).max(128);
export type AggregateId = z.infer<typeof AggregateIdSchema>;

/** Per-record event id. Same looseness rationale as AggregateIdSchema. */
export const EventIdSchema = z.string().min(1).max(128);
export type EventId = z.infer<typeof EventIdSchema>;

export const EventEnvelopeSchema = z
  .object({
    id: EventIdSchema,
    aggregateKind: AggregateKindSchema,
    aggregateId: AggregateIdSchema,
    seq: z.number().int().nonnegative(),
    kind: EventKindSchema,
    recordedAt: IsoTimestampSchema,
    actor: EventActorSchema,
    payload: z.record(z.string(), z.unknown()),
    prevHash: Sha256HexSchema,
    hash: Sha256HexSchema,
  })
  .strict();
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

/**
 * The subset of fields a caller supplies when appending — the chain
 * utility derives `seq`, `prevHash`, and `hash` itself.
 */
export type EventCandidate = Omit<EventEnvelope, 'seq' | 'prevHash' | 'hash'>;
