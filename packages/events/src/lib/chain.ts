/**
 * Aggregate-scoped hash chain utilities for the append-only event log.
 *
 * Invariants this module maintains:
 *
 *   - Per-aggregate `seq` is 0-based, contiguous, and monotonic.
 *   - Per-aggregate `prevHash` chains back to `GENESIS_HASH` for the
 *     first event and to the previous event's `hash` thereafter.
 *   - `hash` is SHA-256 over the canonicalized envelope with the
 *     `hash` field itself removed. Recomputation must match exactly.
 *
 * Cross-aggregate ordering is NOT chained. Global order is a
 * replay-layer concern (a later indexer may merge chains by
 * `recordedAt`) and conflating the two would force a global lock on
 * every write — a pointless bottleneck for an evidence platform where
 * different cases proceed independently.
 *
 * Supersession is NOT a mutation: to retract or replace a prior
 * assertion, the domain emits a new event (e.g. `claim.superseded`)
 * pointing at the prior event/record via its payload. The chain
 * records the supersession; it does not rewrite history. This is why
 * the module exposes no `replaceEvent` / `deleteEvent`.
 */

import type { EventCandidate, EventEnvelope } from './event-envelope.js';
import { EventEnvelopeSchema } from './event-envelope.js';
import { canonicalize } from './canonicalize.js';
import { GENESIS_HASH, sha256Hex } from './hash.js';

/**
 * SHA-256 of the canonicalized envelope minus the `hash` field.
 * Exposed so advanced callers can verify a single event without
 * invoking the full `verifyChain` sweep.
 */
export function computeEventHash(
  envelope: Omit<EventEnvelope, 'hash'>,
): string {
  return sha256Hex(canonicalize(envelope));
}

export interface AppendArgs {
  readonly prev: EventEnvelope | null;
  readonly candidate: EventCandidate;
}

export interface AppendResult {
  readonly event: EventEnvelope;
}

/**
 * Produce the next event in an aggregate's chain. The returned event
 * has `seq`, `prevHash`, and `hash` filled in and has been re-parsed
 * through `EventEnvelopeSchema` — so the caller receives a value
 * already known to satisfy the envelope contract.
 *
 * Errors:
 *   - aggregateKind or aggregateId mismatch with `prev` → throws. The
 *     chain is aggregate-scoped; mixing aggregates would corrupt both
 *     chains and hide the mixing from `verifyChain`.
 *   - envelope schema fails (any field) → throws via `.parse()`.
 */
export function appendEvent(args: AppendArgs): AppendResult {
  const { prev, candidate } = args;

  if (prev !== null) {
    if (prev.aggregateKind !== candidate.aggregateKind) {
      throw new Error(
        `appendEvent: aggregateKind mismatch (prev=${prev.aggregateKind}, candidate=${candidate.aggregateKind})`,
      );
    }
    if (prev.aggregateId !== candidate.aggregateId) {
      throw new Error(
        `appendEvent: aggregateId mismatch (prev=${prev.aggregateId}, candidate=${candidate.aggregateId})`,
      );
    }
  }

  const seq = prev === null ? 0 : prev.seq + 1;
  const prevHash = prev === null ? GENESIS_HASH : prev.hash;

  const unhashed: Omit<EventEnvelope, 'hash'> = {
    ...candidate,
    seq,
    prevHash,
  };
  const hash = computeEventHash(unhashed);

  const event = EventEnvelopeSchema.parse({ ...unhashed, hash });
  return { event };
}

/**
 * Sort an arbitrary batch of events into canonical replay order:
 * grouped by `(aggregateKind, aggregateId)` and then ascending `seq`
 * within each group. The cross-group order is lexicographic on
 * `(aggregateKind, aggregateId)` — deterministic but not semantically
 * meaningful; cross-aggregate ordering is a replayer concern.
 *
 * Returns a new array; the input is not mutated.
 */
export function sortByAggregateSeq(
  events: ReadonlyArray<EventEnvelope>,
): ReadonlyArray<EventEnvelope> {
  return [...events].sort((a, b) => {
    if (a.aggregateKind !== b.aggregateKind) {
      return a.aggregateKind < b.aggregateKind ? -1 : 1;
    }
    if (a.aggregateId !== b.aggregateId) {
      return a.aggregateId < b.aggregateId ? -1 : 1;
    }
    return a.seq - b.seq;
  });
}

export interface ChainVerificationOk {
  readonly ok: true;
}

export interface ChainVerificationError {
  readonly ok: false;
  readonly reason:
    | 'seq-gap'
    | 'prev-hash-mismatch'
    | 'hash-mismatch'
    | 'duplicate-seq';
  readonly aggregate: string;
  readonly atSeq: number;
  readonly detail: string;
}

export type ChainVerification = ChainVerificationOk | ChainVerificationError;

/**
 * Verify every aggregate chain present in `events`. Returns `{ ok:
 * true }` on full-chain integrity; on any violation returns the first
 * discovered failure with enough context (aggregate identity + seq +
 * detail) to point an operator at the offending record.
 *
 * The events may be supplied in any order — the verifier groups and
 * sorts internally. This matches the persistence boundary: storage
 * layers (Postgres, S3, etc.) make no ordering promise on read.
 *
 * An empty batch is trivially ok — there is no chain to falsify.
 */
export function verifyChain(
  events: ReadonlyArray<EventEnvelope>,
): ChainVerification {
  if (events.length === 0) {
    return { ok: true };
  }

  const byAggregate = new Map<string, EventEnvelope[]>();
  for (const e of events) {
    const key = `${e.aggregateKind}:${e.aggregateId}`;
    const bucket = byAggregate.get(key);
    if (bucket === undefined) {
      byAggregate.set(key, [e]);
    } else {
      bucket.push(e);
    }
  }

  for (const [aggregate, bucket] of byAggregate) {
    bucket.sort((a, b) => a.seq - b.seq);

    let expectedSeq = 0;
    let expectedPrevHash = GENESIS_HASH;

    for (const e of bucket) {
      if (e.seq < expectedSeq) {
        return {
          ok: false,
          reason: 'duplicate-seq',
          aggregate,
          atSeq: e.seq,
          detail: `seq ${String(e.seq)} appears more than once`,
        };
      }
      if (e.seq !== expectedSeq) {
        return {
          ok: false,
          reason: 'seq-gap',
          aggregate,
          atSeq: e.seq,
          detail: `expected seq ${String(expectedSeq)}, found ${String(e.seq)}`,
        };
      }
      if (e.prevHash !== expectedPrevHash) {
        return {
          ok: false,
          reason: 'prev-hash-mismatch',
          aggregate,
          atSeq: e.seq,
          detail: `prevHash does not match previous event hash`,
        };
      }

      const { hash, ...unhashed } = e;
      const recomputed = computeEventHash(unhashed);
      if (recomputed !== hash) {
        return {
          ok: false,
          reason: 'hash-mismatch',
          aggregate,
          atSeq: e.seq,
          detail: `recomputed hash does not match stored hash`,
        };
      }

      expectedSeq += 1;
      expectedPrevHash = e.hash;
    }
  }

  return { ok: true };
}
