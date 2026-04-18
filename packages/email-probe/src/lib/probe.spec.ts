import { runProbe } from './probe.js';

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('runProbe', () => {
  it('passes end-to-end when Resend accepts and R2 surfaces a matching object', async () => {
    const fixedNow = new Date('2026-04-18T10:00:00.000Z');
    let calls = 0;
    const fakeFetch = ((input: string | URL | Request): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : 'href' in input
            ? input.href
            : input.url;
      calls++;
      if (url.includes('api.resend.com/emails')) {
        return Promise.resolve(jsonResp({ id: 'res-id-1' }));
      }
      if (url.endsWith('objects?prefix=2026-04-18&per_page=200')) {
        return Promise.resolve(
          jsonResp({
            result: {
              objects: [{ key: '2026-04-18/100100-zzz-hello.eml' }],
            },
          }),
        );
      }
      if (url.includes('objects/2026-04-18')) {
        return Promise.resolve(
          jsonResp({
            result: {
              customMetadata: {
                subject: 'wsa-probe-20260418-100000-deadbeef',
                spamVerdict: 'clean',
                authVerdict: 'pass',
              },
              size: 500,
              uploaded: '2026-04-18T10:01:00Z',
            },
          }),
        );
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    }) as typeof fetch;

    const result = await runProbe({
      resendApiKey: 'r',
      cloudflareApiToken: 'c',
      cloudflareAccountId: 'a',
      r2Bucket: 'wsa-inbox',
      from: 'probe@mail.witnesssouthafrica.org',
      to: 'hello@witnesssouthafrica.org',
      now: (): Date => fixedNow,
      generateRunId: (): string => 'wsa-probe-20260418-100000-deadbeef',
      pollTimeoutMs: 10_000,
      pollIntervalMs: 1,
      fetch: fakeFetch,
    });

    if (result.status !== 'pass') {
      throw new Error(`expected pass, got ${JSON.stringify(result)}`);
    }
    expect(result.runId).toBe('wsa-probe-20260418-100000-deadbeef');
    expect(result.match.customMetadata.spamVerdict).toBe('clean');
    expect(result.match.customMetadata.authVerdict).toBe('pass');
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('fails with timeout when Resend accepts but R2 never surfaces a match', async () => {
    const fakeFetch = ((input: string | URL | Request): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : 'href' in input
            ? input.href
            : input.url;
      if (url.includes('api.resend.com/emails')) {
        return Promise.resolve(jsonResp({ id: 'res-id-2' }));
      }
      if (url.endsWith('per_page=200')) {
        return Promise.resolve(jsonResp({ result: { objects: [] } }));
      }
      return Promise.reject(new Error(`unexpected url: ${url}`));
    }) as typeof fetch;

    let tick = 0;
    const result = await runProbe({
      resendApiKey: 'r',
      cloudflareApiToken: 'c',
      cloudflareAccountId: 'a',
      r2Bucket: 'wsa-inbox',
      from: 'probe@mail.witnesssouthafrica.org',
      to: 'hello@witnesssouthafrica.org',
      now: (): Date => new Date(1_700_000_000_000 + tick++ * 1000),
      generateRunId: (): string => 'wsa-probe-never-lands',
      pollTimeoutMs: 2_000,
      pollIntervalMs: 1,
      fetch: fakeFetch,
    });

    if (result.status !== 'fail') {
      throw new Error(`expected fail, got ${JSON.stringify(result)}`);
    }
    expect(result.timeout.reason).toBe('timeout');
    expect(result.send.id).toBe('res-id-2');
  });
});
