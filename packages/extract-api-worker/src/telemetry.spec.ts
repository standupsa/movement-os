import { ArtefactIdSchema, ulid } from '@wsa/schemas';
import {
  buildBudgetExhaustedTelemetryRecord,
  buildErrorTelemetryRecord,
  buildSuccessTelemetryRecord,
  telemetryObjectKey,
  writeTelemetryRecord,
} from './telemetry.js';

class FakeBucket {
  readonly writes: Array<{ key: string; body: string }> = [];

  put(key: string, body: string): Promise<void> {
    this.writes.push({ key, body });
    return Promise.resolve();
  }
}

const input = {
  requestId: 'req-001',
  sourceRef: {
    kind: 'artefact',
    id: ArtefactIdSchema.parse(ulid('ARTF1')),
  },
  sourceUrl: 'https://example.org/source',
  sourceSha256: 'a'.repeat(64),
  sourceFetchedAt: '2026-04-18T19:00:00.000Z',
  sourceText: 'already-redacted source text',
} as const;

describe('@wsa/extract-api-worker/telemetry', () => {
  it('builds the R2 object key under the monthly prefix', () => {
    expect(telemetryObjectKey('2026-04', 'req-001')).toBe(
      'xai/2026-04/req-001.json',
    );
  });

  it('writes minimal success telemetry without source text', async () => {
    const bucket = new FakeBucket();
    const record = buildSuccessTelemetryRecord({
      keyId: 'OP01',
      input,
      sourceByteLength: 27,
      result: {
        requestId: 'req-001',
        summary: 'summary',
        provider: 'xai',
        model: 'grok-4-fast-reasoning',
        status: 'completed',
        usage: {
          inputTokens: 10,
          cachedInputTokens: 2,
          outputTokens: 4,
          totalTokens: 14,
          costInUsdTicks: 9,
        },
        items: [],
      },
    });

    await writeTelemetryRecord(
      bucket as unknown as R2Bucket,
      '2026-04',
      record,
    );

    expect(bucket.writes).toHaveLength(1);
    const firstWrite = bucket.writes[0];
    if (firstWrite === undefined) {
      throw new Error('expected telemetry write');
    }
    const written = JSON.parse(firstWrite.body) as Record<string, unknown>;
    expect(written.requestId).toBe('req-001');
    expect(written.sourceSha256).toBe('a'.repeat(64));
    expect(written.sourceText).toBeUndefined();
    expect(written.costInUsdTicks).toBe(9);
  });

  it('builds a budget-exhausted telemetry record with zero usage', () => {
    expect(
      buildBudgetExhaustedTelemetryRecord({
        keyId: 'OP01',
        input,
        sourceByteLength: 27,
        model: 'grok-4-fast-reasoning',
      }),
    ).toMatchObject({
      outcome: 'budget_exhausted',
      totalTokens: 0,
    });
  });

  it('builds an error telemetry record with zero usage', () => {
    expect(
      buildErrorTelemetryRecord({
        keyId: 'OP01',
        input,
        sourceByteLength: 27,
        model: 'grok-4-fast-reasoning',
      }),
    ).toMatchObject({
      outcome: 'error',
      inputTokens: 0,
      totalTokens: 0,
    });
  });
});
