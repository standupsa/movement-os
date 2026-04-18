import { createWorker } from './index.js';

async function dispatch(
  request: Request,
  env: {
    readonly WSA_TELEMETRY: R2Bucket;
    readonly OPERATOR_RATE_LIMITER: DurableObjectNamespace;
  } = {} as never,
) {
  const worker = createWorker();
  const fetchHandler = worker.fetch;
  if (fetchHandler === undefined) {
    throw new Error('worker fetch handler is missing');
  }

  return fetchHandler(request as never, env as never, {} as ExecutionContext);
}

describe('@wsa/extract-api-worker/index', () => {
  it('returns 404 for paths outside /v1/extract', async () => {
    const response = await dispatch(
      new Request('https://extract-api.witnesssouthafrica.org/nope', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(404);
  });

  it('returns 405 for non-POST requests', async () => {
    const response = await dispatch(
      new Request('https://extract-api.witnesssouthafrica.org/v1/extract', {
        method: 'GET',
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
  });

  it('delegates valid POST requests to the extract handler', async () => {
    const fetchHandler = createWorker({
      verifySignature: () =>
        Promise.resolve({
          keyId: 'OP01',
          timestamp: '1713466800',
          contentSha256: 'a'.repeat(64),
          rawPathAndQuery: '/v1/extract',
        }),
      acquireLease: () =>
        Promise.resolve({
          release: () => Promise.resolve(),
        }),
      assertBudget: () =>
        Promise.resolve({
          monthKey: '2026-04',
          monthToDateCostUsdTicks: 0,
          monthlyCapUsdTicks: 100,
        }),
      createXaiClient: () => ({
        chat: {
          completions: {
            create: () =>
              Promise.resolve({
                id: 'chat-001',
                model: 'grok-4-fast-reasoning',
                choices: [
                  {
                    index: 0,
                    message: {
                      role: 'assistant',
                      content: JSON.stringify({
                        summary: 'One claim extracted.',
                        claims: [
                          {
                            text: 'Claim text',
                            status: 'contested',
                            supports: 'supports',
                            rationale:
                              'The source supports a contestable claim.',
                          },
                        ],
                      }),
                    },
                    finish_reason: 'stop',
                  },
                ],
                usage: {
                  prompt_tokens: 10,
                  completion_tokens: 3,
                  total_tokens: 13,
                },
              }),
          },
        },
      }),
      writeTelemetry: () => Promise.resolve(),
    });
    const workerFetch = fetchHandler.fetch;
    if (workerFetch === undefined) {
      throw new Error('worker fetch handler is missing');
    }

    const response = await workerFetch(
      new Request('https://extract-api.witnesssouthafrica.org/v1/extract', {
        method: 'POST',
        body: JSON.stringify({
          operatorAttestation: {
            classification: 'lane2-redacted-or-consented',
          },
          extract: {
            requestId: 'req-001',
            sourceRef: { kind: 'artefact', id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' },
            sourceUrl: 'https://example.org/source',
            sourceSha256: 'a'.repeat(64),
            sourceFetchedAt: '2026-04-18T19:00:00.000Z',
            sourceText: 'already-redacted source text',
          },
        }),
      }),
      {
        WSA_TELEMETRY: {} as R2Bucket,
        OPERATOR_RATE_LIMITER: {} as DurableObjectNamespace,
      } as never,
      {} as ExecutionContext,
    );

    expect(response.status).toBe(200);
  });
});
