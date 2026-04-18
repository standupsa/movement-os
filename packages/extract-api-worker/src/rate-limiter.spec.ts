import {
  OperatorRateLimiterDurableObject,
  RateLimitedError,
  acquireRateLimitLease,
} from './rate-limiter.js';

class MemoryStorage {
  #value: unknown;

  get<T>(_key: string): Promise<T | undefined> {
    return Promise.resolve(this.#value as T | undefined);
  }

  put(_key: string, value: unknown): Promise<void> {
    this.#value = value;
    return Promise.resolve();
  }
}

function makeDurableObject(): OperatorRateLimiterDurableObject {
  const storage = new MemoryStorage();
  return new OperatorRateLimiterDurableObject(
    { storage } as unknown as DurableObjectState,
    undefined,
  );
}

function makeNamespace(
  durableObject: OperatorRateLimiterDurableObject,
): DurableObjectNamespace {
  return {
    getByName: () => ({
      fetch: (input: Request | string | URL, init?: RequestInit) =>
        durableObject.fetch(
          typeof input === 'string' || input instanceof URL
            ? new Request(input, init)
            : input,
        ),
    }),
  } as unknown as DurableObjectNamespace;
}

describe('@wsa/extract-api-worker/rate-limiter', () => {
  it('allows up to 6 requests per minute and 2 inflight', async () => {
    const durableObject = makeDurableObject();

    const first = await durableObject.fetch(
      new Request('https://limiter/acquire', {
        method: 'POST',
        body: JSON.stringify({
          nowMs: 1_000,
          requestsPerMinute: 6,
          maxInflight: 2,
        }),
      }),
    );
    const second = await durableObject.fetch(
      new Request('https://limiter/acquire', {
        method: 'POST',
        body: JSON.stringify({
          nowMs: 2_000,
          requestsPerMinute: 6,
          maxInflight: 2,
        }),
      }),
    );
    const third = await durableObject.fetch(
      new Request('https://limiter/acquire', {
        method: 'POST',
        body: JSON.stringify({
          nowMs: 3_000,
          requestsPerMinute: 6,
          maxInflight: 2,
        }),
      }),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
  });

  it('releases inflight capacity after release', async () => {
    const durableObject = makeDurableObject();

    await durableObject.fetch(
      new Request('https://limiter/acquire', {
        method: 'POST',
        body: JSON.stringify({
          nowMs: 1_000,
          requestsPerMinute: 6,
          maxInflight: 1,
        }),
      }),
    );
    await durableObject.fetch(
      new Request('https://limiter/release', { method: 'POST' }),
    );
    const retry = await durableObject.fetch(
      new Request('https://limiter/acquire', {
        method: 'POST',
        body: JSON.stringify({
          nowMs: 2_000,
          requestsPerMinute: 6,
          maxInflight: 1,
        }),
      }),
    );

    expect(retry.status).toBe(200);
  });

  it('allows new requests after the one-minute window passes', async () => {
    const durableObject = makeDurableObject();

    for (let index = 0; index < 6; index += 1) {
      await durableObject.fetch(
        new Request('https://limiter/acquire', {
          method: 'POST',
          body: JSON.stringify({
            nowMs: index * 1_000,
            requestsPerMinute: 6,
            maxInflight: 10,
          }),
        }),
      );
      await durableObject.fetch(
        new Request('https://limiter/release', { method: 'POST' }),
      );
    }

    const retry = await durableObject.fetch(
      new Request('https://limiter/acquire', {
        method: 'POST',
        body: JSON.stringify({
          nowMs: 61_001,
          requestsPerMinute: 6,
          maxInflight: 10,
        }),
      }),
    );

    expect(retry.status).toBe(200);
  });

  it('acquires and releases a lease through the namespace helper', async () => {
    const durableObject = makeDurableObject();
    const env = {
      OPERATOR_RATE_LIMITER: makeNamespace(durableObject),
    };

    const lease = await acquireRateLimitLease(env, 'OP01', new Date(2_000));
    await lease.release();
    const secondLease = await acquireRateLimitLease(
      env,
      'OP01',
      new Date(3_000),
    );

    expect(secondLease).toEqual({ release: expect.any(Function) });
  });

  it('throws a rate-limited error when the namespace helper is denied', async () => {
    const durableObject = makeDurableObject();
    const env = {
      OPERATOR_RATE_LIMITER: makeNamespace(durableObject),
      RATE_LIMIT_MAX_INFLIGHT: '1',
    };

    await acquireRateLimitLease(env, 'OP01', new Date(2_000));

    await expect(
      acquireRateLimitLease(env, 'OP01', new Date(2_100)),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });
});
