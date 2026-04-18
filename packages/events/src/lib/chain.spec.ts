import type { EventCandidate, EventEnvelope } from './event-envelope.js';
import {
  appendEvent,
  computeEventHash,
  sortByAggregateSeq,
  verifyChain,
} from './chain.js';
import { EventActorSchema } from './event-actor.js';
import { EventKindSchema } from './event-kind.js';
import { GENESIS_HASH } from './hash.js';

// Deterministic fixtures — keeps tests readable and round-trip safe.
const AGG_KIND = 'claim';
const AGG_ID = '01K3CLAIM00000000000000000';
const ACTOR = EventActorSchema.parse('agent:tone-gate-v1');

function candidate(
  id: string,
  kind: string,
  recordedAt: string,
  payload: Record<string, unknown>,
): EventCandidate {
  return {
    id,
    aggregateKind: AGG_KIND,
    aggregateId: AGG_ID,
    kind: EventKindSchema.parse(kind),
    recordedAt,
    actor: ACTOR,
    payload,
  };
}

function threeEventChain(): ReadonlyArray<EventEnvelope> {
  const a = appendEvent({
    prev: null,
    candidate: candidate(
      '01K3EVT000000000000000000A',
      'claim.asserted',
      '2026-04-18T10:00:00+02:00',
      { text: 'the world is round' },
    ),
  }).event;
  const b = appendEvent({
    prev: a,
    candidate: candidate(
      '01K3EVT000000000000000000B',
      'claim.evidence-attached',
      '2026-04-18T11:00:00+02:00',
      { evidenceId: '01K3EVD00000000000000000X' },
    ),
  }).event;
  const c = appendEvent({
    prev: b,
    candidate: candidate(
      '01K3EVT000000000000000000C',
      'claim.superseded',
      '2026-04-18T12:00:00+02:00',
      { replacementClaimId: '01K3CLM000000000000000000X' },
    ),
  }).event;
  return [a, b, c];
}

describe('appendEvent — first event', () => {
  it('assigns seq 0 and prevHash GENESIS_HASH', () => {
    const { event } = appendEvent({
      prev: null,
      candidate: candidate(
        '01K3EVT000000000000000000A',
        'claim.asserted',
        '2026-04-18T10:00:00+02:00',
        { text: 'x' },
      ),
    });
    expect(event.seq).toBe(0);
    expect(event.prevHash).toBe(GENESIS_HASH);
  });

  it('computes a valid 64-char hex hash', () => {
    const { event } = appendEvent({
      prev: null,
      candidate: candidate(
        '01K3EVT000000000000000000A',
        'claim.asserted',
        '2026-04-18T10:00:00+02:00',
        { text: 'x' },
      ),
    });
    expect(event.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('appendEvent — subsequent events', () => {
  it('increments seq and links prevHash to the previous hash', () => {
    const [a, b] = threeEventChain();
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    if (!a || !b) throw new Error('fixture');
    expect(b.seq).toBe(a.seq + 1);
    expect(b.prevHash).toBe(a.hash);
  });

  it('rejects aggregateKind mismatch', () => {
    const [a] = threeEventChain();
    if (!a) throw new Error('fixture');
    expect(() =>
      appendEvent({
        prev: a,
        candidate: {
          ...candidate(
            '01K3EVT000000000000000000D',
            'case.opened',
            '2026-04-18T13:00:00+02:00',
            {},
          ),
          aggregateKind: 'case',
        },
      }),
    ).toThrow(/aggregateKind mismatch/);
  });

  it('rejects aggregateId mismatch', () => {
    const [a] = threeEventChain();
    if (!a) throw new Error('fixture');
    expect(() =>
      appendEvent({
        prev: a,
        candidate: {
          ...candidate(
            '01K3EVT000000000000000000D',
            'claim.asserted',
            '2026-04-18T13:00:00+02:00',
            {},
          ),
          aggregateId: '01K3CLAIM00000000000000ZZZ',
        },
      }),
    ).toThrow(/aggregateId mismatch/);
  });
});

describe('appendEvent — determinism', () => {
  it('produces identical hashes for identical inputs', () => {
    const c = candidate(
      '01K3EVT000000000000000000A',
      'claim.asserted',
      '2026-04-18T10:00:00+02:00',
      { text: 'the world is round', tags: ['a', 'b'] },
    );
    const run1 = appendEvent({ prev: null, candidate: c }).event;
    const run2 = appendEvent({ prev: null, candidate: c }).event;
    expect(run1.hash).toBe(run2.hash);
  });

  it('hash is invariant to payload key order', () => {
    const c1 = candidate(
      '01K3EVT000000000000000000A',
      'claim.asserted',
      '2026-04-18T10:00:00+02:00',
      { a: 1, b: 2, c: 3 },
    );
    const c2 = candidate(
      '01K3EVT000000000000000000A',
      'claim.asserted',
      '2026-04-18T10:00:00+02:00',
      { c: 3, a: 1, b: 2 },
    );
    expect(appendEvent({ prev: null, candidate: c1 }).event.hash).toBe(
      appendEvent({ prev: null, candidate: c2 }).event.hash,
    );
  });

  it('hash changes if payload value changes', () => {
    const c1 = candidate(
      '01K3EVT000000000000000000A',
      'claim.asserted',
      '2026-04-18T10:00:00+02:00',
      { text: 'A' },
    );
    const c2 = candidate(
      '01K3EVT000000000000000000A',
      'claim.asserted',
      '2026-04-18T10:00:00+02:00',
      { text: 'B' },
    );
    expect(appendEvent({ prev: null, candidate: c1 }).event.hash).not.toBe(
      appendEvent({ prev: null, candidate: c2 }).event.hash,
    );
  });
});

describe('verifyChain', () => {
  it('is ok on an empty batch', () => {
    expect(verifyChain([])).toEqual({ ok: true });
  });

  it('is ok on a full three-event chain', () => {
    expect(verifyChain(threeEventChain())).toEqual({ ok: true });
  });

  it('is ok regardless of input order (groups and sorts internally)', () => {
    const chain = threeEventChain();
    const reversed = [...chain].reverse();
    expect(verifyChain(reversed)).toEqual({ ok: true });
  });

  it('detects a seq gap (missing middle event)', () => {
    const [a, _b, c] = threeEventChain();
    if (!a || !c) throw new Error('fixture');
    const result = verifyChain([a, c]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('seq-gap');
    expect(result.atSeq).toBe(2);
  });

  it('detects a prevHash mismatch (tampered payload upstream)', () => {
    const [a, b, c] = threeEventChain();
    if (!a || !b || !c) throw new Error('fixture');
    const tamperedA: EventEnvelope = {
      ...a,
      payload: { text: 'swapped by attacker' },
    };
    const result = verifyChain([tamperedA, b, c]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Either hash-mismatch on `a` (hit first) or prev-hash-mismatch on `b`
    // is a valid failure mode; the first-failure contract makes it the former.
    expect(result.reason).toBe('hash-mismatch');
    expect(result.atSeq).toBe(0);
  });

  it('detects a hash-field tamper without other changes', () => {
    const [a] = threeEventChain();
    if (!a) throw new Error('fixture');
    const tampered: EventEnvelope = { ...a, hash: 'f'.repeat(64) };
    const result = verifyChain([tampered]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('hash-mismatch');
  });

  it('detects a forged prevHash on the head event', () => {
    const [a] = threeEventChain();
    if (!a) throw new Error('fixture');
    // The head event's prevHash MUST be GENESIS_HASH. Reparenting to a
    // different chain is the first check that fires — the verifier does
    // not need to recompute the event hash to catch it.
    const forged: EventEnvelope = { ...a, prevHash: 'e'.repeat(64) };
    const result = verifyChain([forged]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('prev-hash-mismatch');
  });

  it('verifies two interleaved aggregate chains independently', () => {
    // Chain one on claim aggregate, one on case aggregate.
    const claimHead = appendEvent({
      prev: null,
      candidate: candidate(
        '01K3EVT00000000000000CLAIM',
        'claim.asserted',
        '2026-04-18T10:00:00+02:00',
        { text: 'x' },
      ),
    }).event;
    const caseHead = appendEvent({
      prev: null,
      candidate: {
        id: '01K3EVT0000000000000000CASE',
        aggregateKind: 'case',
        aggregateId: '01K3CASE00000000000000000',
        kind: EventKindSchema.parse('case.opened'),
        recordedAt: '2026-04-18T10:05:00+02:00',
        actor: ACTOR,
        payload: { title: 'test case' },
      },
    }).event;
    expect(verifyChain([caseHead, claimHead])).toEqual({ ok: true });
  });
});

describe('supersession (no-mutation retraction)', () => {
  it('extends the chain rather than mutating a prior event', () => {
    const chain = threeEventChain();
    const [a, b, c] = chain;
    if (!a || !b || !c) throw new Error('fixture');

    // The prior events must be bit-exact — retracting a claim does not
    // edit the original `claim.asserted` event.
    expect(a.kind).toBe('claim.asserted');
    expect(a.seq).toBe(0);
    expect(b.kind).toBe('claim.evidence-attached');
    expect(c.kind).toBe('claim.superseded');
    expect(c.seq).toBe(2);

    // The chain still verifies — supersession is a regular append.
    expect(verifyChain(chain)).toEqual({ ok: true });
  });

  it('still verifies after further appends on the superseded chain', () => {
    // Demonstrates that supersession does not close the chain; a
    // domain may emit follow-up events (e.g. a correction-note)
    // against a superseded aggregate.
    const chain = threeEventChain();
    const [, , c] = chain;
    if (!c) throw new Error('fixture');
    const { event: d } = appendEvent({
      prev: c,
      candidate: candidate(
        '01K3EVT000000000000000000D',
        'claim.note-attached',
        '2026-04-18T13:00:00+02:00',
        { note: 'retained for audit' },
      ),
    });
    expect(verifyChain([...chain, d])).toEqual({ ok: true });
  });
});

describe('sortByAggregateSeq', () => {
  it('groups by (aggregateKind, aggregateId) then sorts by seq', () => {
    const chain = threeEventChain();
    const [a, b, c] = chain;
    if (!a || !b || !c) throw new Error('fixture');
    const shuffled = [c, a, b];
    const sorted = sortByAggregateSeq(shuffled);
    expect(sorted.map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  it('returns a new array (does not mutate input)', () => {
    const input: EventEnvelope[] = [...threeEventChain()].reverse();
    const snapshot = input.map((e) => e.seq);
    sortByAggregateSeq(input);
    expect(input.map((e) => e.seq)).toEqual(snapshot);
  });
});

describe('computeEventHash — standalone verification', () => {
  it('matches the hash produced by appendEvent', () => {
    const { event } = appendEvent({
      prev: null,
      candidate: candidate(
        '01K3EVT000000000000000000A',
        'claim.asserted',
        '2026-04-18T10:00:00+02:00',
        { text: 'x' },
      ),
    });
    const { hash, ...unhashed } = event;
    expect(computeEventHash(unhashed)).toBe(hash);
  });
});
