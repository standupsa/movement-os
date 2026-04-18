import type { ExtractionInput } from '@wsa/evidence-engine';
import { ArtefactIdSchema, ulid } from '@wsa/schemas';
import { AuthError } from './auth.js';
import { BudgetExhaustedError } from './budget-guard.js';
import { handleExtractRequest, type Env } from './extract-handler.js';
import { RateLimitedError } from './rate-limiter.js';

function makeEnvelope(
  overrides: Partial<ExtractionInput> = {},
): ExtractionInput {
  return {
    requestId: 'req-001',
    sourceRef: {
      kind: 'artefact',
      id: ArtefactIdSchema.parse(ulid('ARTF1')),
    },
    sourceUrl: 'https://example.org/source',
    sourceSha256: 'a'.repeat(64),
    sourceFetchedAt: '2026-04-18T19:00:00.000Z',
    sourceText: 'already-redacted source text',
    ...overrides,
  };
}

describe('@wsa/extract-api-worker/extract-handler', () => {
  it('returns a 200 response with per-claim promotion data and telemetry', async () => {
    const telemetryWrites: Array<{
      monthKey: string;
      record: Record<string, unknown>;
    }> = [];
    const request = new Request(
      'https://extract-api.witnesssouthafrica.org/v1/extract',
      {
        method: 'POST',
        body: JSON.stringify({
          operatorAttestation: {
            classification: 'lane2-redacted-or-consented',
          },
          extract: makeEnvelope(),
        }),
      },
    );

    const response = await handleExtractRequest(
      request,
      {
        WSA_TELEMETRY: {} as R2Bucket,
        OPERATOR_RATE_LIMITER: {} as DurableObjectNamespace,
      } as Env,
      {
        now: () => new Date('2026-04-18T19:00:00.000Z'),
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
                    prompt_tokens_details: { cached_tokens: 2 },
                  },
                }),
            },
          },
        }),
        writeTelemetry: (_bucket, monthKey, record) => {
          telemetryWrites.push({
            monthKey,
            record: record as unknown as Record<string, unknown>,
          });
          return Promise.resolve();
        },
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      claims: Array<{ promotionDecision: { ok: boolean } }>;
    };
    expect(body.claims[0]?.promotionDecision.ok).toBe(true);
    expect(JSON.stringify(body)).not.toContain('xai');
    expect(telemetryWrites[0]?.monthKey).toBe('2026-04');
    expect(telemetryWrites[0]?.record.outcome).toBe('success');
  });

  it('returns 401 on auth failure', async () => {
    const response = await handleExtractRequest(
      new Request('https://extract-api.witnesssouthafrica.org/v1/extract', {
        method: 'POST',
        body: '{}',
      }),
      {
        WSA_TELEMETRY: {} as R2Bucket,
        OPERATOR_RATE_LIMITER: {} as DurableObjectNamespace,
      } as Env,
      {
        verifySignature: () => {
          throw new AuthError('signature_mismatch');
        },
      },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      reason: 'signature_mismatch',
    });
  });

  it('returns 429 when rate limited', async () => {
    const response = await handleExtractRequest(
      new Request('https://extract-api.witnesssouthafrica.org/v1/extract', {
        method: 'POST',
        body: JSON.stringify({
          operatorAttestation: {
            classification: 'lane2-redacted-or-consented',
          },
          extract: makeEnvelope(),
        }),
      }),
      {
        WSA_TELEMETRY: {} as R2Bucket,
        OPERATOR_RATE_LIMITER: {} as DurableObjectNamespace,
      } as Env,
      {
        verifySignature: () =>
          Promise.resolve({
            keyId: 'OP01',
            timestamp: '1713466800',
            contentSha256: 'a'.repeat(64),
            rawPathAndQuery: '/v1/extract',
          }),
        acquireLease: () => {
          throw new RateLimitedError();
        },
      },
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      reason: 'rate_limited',
    });
  });

  it('returns 429 and skips the provider when the budget is exhausted', async () => {
    let providerCalled = false;
    const response = await handleExtractRequest(
      new Request('https://extract-api.witnesssouthafrica.org/v1/extract', {
        method: 'POST',
        body: JSON.stringify({
          operatorAttestation: {
            classification: 'lane2-redacted-or-consented',
          },
          extract: makeEnvelope(),
        }),
      }),
      {
        WSA_TELEMETRY: {} as R2Bucket,
        OPERATOR_RATE_LIMITER: {} as DurableObjectNamespace,
        XAI_BUDGET_MONTHLY_CAP_USD_TICKS: '25',
      } as Env,
      {
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
        assertBudget: () => {
          throw new BudgetExhaustedError({
            monthKey: '2026-04',
            monthToDateCostUsdTicks: 25,
            monthlyCapUsdTicks: 25,
          });
        },
        createXaiClient: () => {
          providerCalled = true;
          return {
            chat: {
              completions: {
                create: () => {
                  throw new Error('should not be called');
                },
              },
            },
          };
        },
      },
    );

    expect(response.status).toBe(429);
    expect(providerCalled).toBe(false);
  });

  it('returns 500 for unexpected provider failures', async () => {
    const response = await handleExtractRequest(
      new Request('https://extract-api.witnesssouthafrica.org/v1/extract', {
        method: 'POST',
        body: JSON.stringify({
          operatorAttestation: {
            classification: 'lane2-redacted-or-consented',
          },
          extract: makeEnvelope(),
        }),
      }),
      {
        WSA_TELEMETRY: {} as R2Bucket,
        OPERATOR_RATE_LIMITER: {} as DurableObjectNamespace,
      } as Env,
      {
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
            monthlyCapUsdTicks: 25,
          }),
        createXaiClient: () => ({
          chat: {
            completions: {
              create: () => {
                throw new Error('boom');
              },
            },
          },
        }),
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      reason: 'internal_error',
    });
  });
});
