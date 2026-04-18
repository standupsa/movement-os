import { pollForMatch } from './poll.js';

type FakeResponseSpec =
  | { kind: 'json'; body: unknown; status?: number }
  | { kind: 'error'; status: number };

function respond(spec: FakeResponseSpec): Response {
  if (spec.kind === 'error') {
    return new Response('err', { status: spec.status });
  }
  return new Response(JSON.stringify(spec.body), {
    status: spec.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

type FakeFetchStep = (url: string, init?: RequestInit) => FakeResponseSpec;

function createScriptedFetch(script: readonly FakeFetchStep[]): {
  fetchImpl: typeof fetch;
  callCount: () => number;
} {
  let i = 0;
  const fetchImpl = ((
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : 'href' in input
          ? input.href
          : input.url;
    const step = script[i++];
    if (!step) {
      throw new Error(`fetch script exhausted at call ${String(i)} for ${url}`);
    }
    return Promise.resolve(respond(step(url, init)));
  }) as typeof fetch;
  return { fetchImpl, callCount: (): number => i };
}

function mockClock(sequence?: readonly number[]): () => number {
  if (!sequence) {
    let t = 0;
    return (): number => {
      const v = t;
      t += 1;
      return v;
    };
  }
  let i = 0;
  return (): number => {
    const v = sequence[Math.min(i, sequence.length - 1)] ?? 0;
    i++;
    return v;
  };
}

describe('pollForMatch', () => {
  it('returns a match when an R2 object surface has a subject containing the run id', async () => {
    const { fetchImpl } = createScriptedFetch([
      // LIST call
      () => ({
        kind: 'json',
        body: {
          result: {
            objects: [
              { key: '2026-04-18/120000-aaa-hello.eml', size: 400 },
              { key: '2026-04-18/120100-bbb-hello.eml', size: 600 },
            ],
          },
        },
      }),
      // HEAD first candidate — no match
      () => ({
        kind: 'json',
        body: {
          result: {
            customMetadata: { subject: 'hello world' },
            size: 400,
            uploaded: '2026-04-18T12:00:00Z',
          },
        },
      }),
      // HEAD second candidate — match
      () => ({
        kind: 'json',
        body: {
          result: {
            customMetadata: {
              subject: 'wsa-probe-20260418-abc123',
              spamVerdict: 'clean',
            },
            size: 600,
            uploaded: '2026-04-18T12:01:00Z',
          },
        },
      }),
    ]);

    const result = await pollForMatch({
      apiToken: 't',
      accountId: 'a',
      bucket: 'wsa-inbox',
      runId: 'wsa-probe-20260418-abc123',
      datePrefix: '2026-04-18',
      timeoutMs: 10_000,
      intervalMs: 1,
      fetch: fetchImpl,
      now: mockClock(),
    });

    if (!('key' in result)) {
      throw new Error(`expected match, got timeout: ${JSON.stringify(result)}`);
    }
    expect(result.key).toBe('2026-04-18/120100-bbb-hello.eml');
    expect(result.customMetadata.subject).toContain(
      'wsa-probe-20260418-abc123',
    );
    expect(result.customMetadata.spamVerdict).toBe('clean');
  });

  it('returns timeout when no object has the matching subject within the window', async () => {
    const { fetchImpl } = createScriptedFetch([
      () => ({ kind: 'json', body: { result: { objects: [] } } }),
    ]);

    const clock = mockClock([0, 5_000, 10_000]);
    const result = await pollForMatch({
      apiToken: 't',
      accountId: 'a',
      bucket: 'wsa-inbox',
      runId: 'wsa-probe-never-lands',
      datePrefix: '2026-04-18',
      timeoutMs: 5_000,
      intervalMs: 1,
      fetch: fetchImpl,
      now: clock,
      sleep: (): Promise<void> => Promise.resolve(),
    });

    expect('reason' in result ? result.reason : 'match').toBe('timeout');
  });

  it('does not re-HEAD keys already seen in a prior iteration', async () => {
    // Clock ticks: [start, while-check-1, while-check-2, while-check-3 (exit)]
    const clock = mockClock([0, 1_000, 2_000, 5_000]);

    const { fetchImpl, callCount } = createScriptedFetch([
      // iteration 1: LIST returns one object
      () => ({
        kind: 'json',
        body: {
          result: { objects: [{ key: '2026-04-18/000000-xxx-hello.eml' }] },
        },
      }),
      // HEAD: no match
      () => ({
        kind: 'json',
        body: {
          result: { customMetadata: { subject: 'other' }, size: 100 },
        },
      }),
      // iteration 2: LIST returns same object again (no HEAD — already seen)
      () => ({
        kind: 'json',
        body: {
          result: { objects: [{ key: '2026-04-18/000000-xxx-hello.eml' }] },
        },
      }),
    ]);

    const result = await pollForMatch({
      apiToken: 't',
      accountId: 'a',
      bucket: 'wsa-inbox',
      runId: 'never-matches',
      datePrefix: '2026-04-18',
      timeoutMs: 4_000,
      intervalMs: 1,
      fetch: fetchImpl,
      now: clock,
      sleep: (): Promise<void> => Promise.resolve(),
    });

    expect('reason' in result ? result.reason : 'match').toBe('timeout');
    expect(callCount()).toBe(3);
  });
});
