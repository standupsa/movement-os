const DEFAULT_REQUESTS_PER_MINUTE = 6;
const DEFAULT_MAX_INFLIGHT = 2;
const STORAGE_KEY = 'operator-rate-state';
const WINDOW_MS = 60_000;

interface DurableLimiterState {
  readonly recentRequestTimestampsMs: ReadonlyArray<number>;
  readonly inflight: number;
}

interface AcquireRequestPayload {
  readonly nowMs: number;
  readonly requestsPerMinute: number;
  readonly maxInflight: number;
}

interface AcquireResponsePayload {
  readonly allowed: boolean;
  readonly reason?: 'rate_limited';
}

export interface RateLimiterEnv {
  readonly OPERATOR_RATE_LIMITER: DurableObjectNamespace;
  readonly RATE_LIMIT_REQUESTS_PER_MINUTE?: string;
  readonly RATE_LIMIT_MAX_INFLIGHT?: string;
}

export interface RateLimitLease {
  release(): Promise<void>;
}

export class RateLimitedError extends Error {
  readonly status = 429;
  readonly reason = 'rate_limited';

  constructor() {
    super('rate_limited');
    this.name = 'RateLimitedError';
  }
}

export class OperatorRateLimiterDurableObject {
  #cachedState: DurableLimiterState | null = null;

  constructor(
    private readonly state: DurableObjectState,
    env: unknown,
  ) {
    void env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST') {
      return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    }

    if (url.pathname === '/acquire') {
      const payload = parseAcquireRequest(await request.json());
      const nextState = pruneExpiredRequests(
        await this.loadState(),
        payload.nowMs,
      );
      const denied =
        nextState.inflight >= payload.maxInflight ||
        nextState.recentRequestTimestampsMs.length >= payload.requestsPerMinute;

      if (denied) {
        await this.saveState(nextState);
        return Response.json(
          {
            allowed: false,
            reason: 'rate_limited',
          } satisfies AcquireResponsePayload,
          { status: 429 },
        );
      }

      const allowedState: DurableLimiterState = {
        inflight: nextState.inflight + 1,
        recentRequestTimestampsMs: [
          ...nextState.recentRequestTimestampsMs,
          payload.nowMs,
        ],
      };
      await this.saveState(allowedState);
      return Response.json({ allowed: true } satisfies AcquireResponsePayload);
    }

    if (url.pathname === '/release') {
      const current = await this.loadState();
      await this.saveState({
        ...current,
        inflight: Math.max(0, current.inflight - 1),
      });
      return new Response(null, { status: 204 });
    }

    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  private async loadState(): Promise<DurableLimiterState> {
    if (this.#cachedState !== null) {
      return this.#cachedState;
    }

    const existing =
      await this.state.storage.get<DurableLimiterState>(STORAGE_KEY);
    this.#cachedState = existing ?? {
      recentRequestTimestampsMs: [],
      inflight: 0,
    };
    return this.#cachedState;
  }

  private async saveState(nextState: DurableLimiterState): Promise<void> {
    this.#cachedState = nextState;
    await this.state.storage.put(STORAGE_KEY, nextState);
  }
}

export async function acquireRateLimitLease(
  env: RateLimiterEnv,
  keyId: string,
  now: Date = new Date(),
): Promise<RateLimitLease> {
  const requestsPerMinute = readPositiveInteger(
    env.RATE_LIMIT_REQUESTS_PER_MINUTE,
    DEFAULT_REQUESTS_PER_MINUTE,
  );
  const maxInflight = readPositiveInteger(
    env.RATE_LIMIT_MAX_INFLIGHT,
    DEFAULT_MAX_INFLIGHT,
  );
  const stub = env.OPERATOR_RATE_LIMITER.getByName(keyId);

  const acquireResponse = await stub.fetch(
    'https://operator-rate-limiter/acquire',
    {
      method: 'POST',
      body: JSON.stringify({
        nowMs: now.getTime(),
        requestsPerMinute,
        maxInflight,
      } satisfies AcquireRequestPayload),
    },
  );

  if (acquireResponse.status === 429) {
    throw new RateLimitedError();
  }
  if (!acquireResponse.ok) {
    throw new Error(
      `rate limiter acquire failed with ${String(acquireResponse.status)}`,
    );
  }

  return {
    release: async (): Promise<void> => {
      await stub.fetch('https://operator-rate-limiter/release', {
        method: 'POST',
      });
    },
  };
}

function parseAcquireRequest(value: unknown): AcquireRequestPayload {
  if (!isRecord(value)) {
    throw new Error('expected acquire payload object');
  }

  return {
    nowMs: readFiniteNumber(value.nowMs, 'nowMs'),
    requestsPerMinute: readFiniteNumber(
      value.requestsPerMinute,
      'requestsPerMinute',
    ),
    maxInflight: readFiniteNumber(value.maxInflight, 'maxInflight'),
  };
}

function pruneExpiredRequests(
  state: DurableLimiterState,
  nowMs: number,
): DurableLimiterState {
  const cutoff = nowMs - WINDOW_MS;
  return {
    inflight: state.inflight,
    recentRequestTimestampsMs: state.recentRequestTimestampsMs.filter(
      (timestampMs) => timestampMs > cutoff,
    ),
  };
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`expected ${field} to be a finite number`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
