import type {
  CompleteArgs,
  ModelProvider,
  ModelResponse,
} from '@wsa/agent-contracts';
import { type XaiClient } from '@wsa/agent-xai';
import { ArtefactIdSchema, ulid } from '@wsa/schemas';
import type { z } from 'zod';
import {
  createEvidenceEngine,
  createXaiEvidenceEngine,
  type ExtractionInput,
} from './runtime.js';

const FIXED_NOW = new Date('2026-04-18T16:40:00.000Z');

function makeInput(overrides: Partial<ExtractionInput> = {}): ExtractionInput {
  return {
    requestId: 'req-001',
    sourceRef: { kind: 'artefact', id: ArtefactIdSchema.parse(ulid('ARTF0')) },
    sourceUrl: 'https://example.org/source.pdf',
    sourceSha256: 'a'.repeat(64),
    sourceFetchedAt: '2026-04-18T16:30:00+02:00',
    sourceText:
      'The family requested the official record on 14 April 2026 and the clerk refused to release it.',
    ...overrides,
  };
}

function fixedIds(...ids: readonly string[]): () => string {
  let idx = 0;
  return (): string => ids[idx++] ?? ulid(`EXTRA${String(idx)}`);
}

describe('@wsa/evidence-engine', () => {
  it('runs the analysis lane, emits audit-ready output, and keeps non-promotable status unchanged', async () => {
    let capturedTaskKind: string | undefined;
    let capturedRequestId: string | undefined;
    let capturedMessages:
      | ReadonlyArray<{ readonly role: string; readonly content: string }>
      | undefined;

    const provider: ModelProvider = {
      id: 'xai',
      complete: <TSchema extends z.ZodType>(
        args: CompleteArgs<TSchema>,
      ): Promise<ModelResponse<z.infer<TSchema>>> => {
        capturedTaskKind = args.taskKind;
        capturedRequestId = args.requestId;
        capturedMessages = args.messages;
        return Promise.resolve({
          value: args.schema.parse({
            summary: 'One contestable extraction.',
            claims: [
              {
                text: 'The family requested the record and was refused.',
                status: 'contested',
                supports: 'supports',
                rationale:
                  'The text describes a refusal but not a final adjudication.',
              },
            ],
          }),
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          provider: 'xai',
          model: 'grok-4-fast-reasoning',
          responseId: 'resp-001',
          rawFinishReason: 'stop',
          status: 'completed',
        });
      },
    };

    const engine = createEvidenceEngine({
      provider,
      now: (): Date => FIXED_NOW,
      createId: fixedIds(ulid('CLAIM1'), ulid('EVID1')),
    });

    const result = await engine.extractClaims(makeInput());

    expect(capturedTaskKind).toBe('analysis');
    expect(capturedRequestId).toBe('req-001');
    expect(capturedMessages?.[0]?.role).toBe('system');
    expect(capturedMessages?.[1]?.content).toContain('source.pdf');

    expect(result.provider).toBe('xai');
    expect(result.model).toBe('grok-4-fast-reasoning');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.requestedStatus).toBe('contested');
    expect(result.items[0]?.claim.status).toBe('contested');
    expect(result.items[0]?.promotion.ok).toBe(true);
    expect(result.items[0]?.auditTrail[0]?.action).toBe('claim.extracted');
    expect(result.items[0]?.auditTrail[1]?.action).toBe('evidence.linked');
  });

  it('downgrades xai-only promotable claims to contested when the promotion gate blocks them', async () => {
    const provider: ModelProvider = {
      id: 'xai',
      complete: <TSchema extends z.ZodType>(
        args: CompleteArgs<TSchema>,
      ): Promise<ModelResponse<z.infer<TSchema>>> =>
        Promise.resolve({
          value: args.schema.parse({
            summary: 'One overconfident extraction.',
            claims: [
              {
                text: 'The official record was definitively withheld unlawfully.',
                status: 'high-confidence',
                supports: 'supports',
                rationale: 'The source implies wrongdoing.',
              },
            ],
          }),
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
          provider: 'xai',
          model: 'grok-4-fast-reasoning',
          responseId: 'resp-002',
          rawFinishReason: 'stop',
          status: 'completed',
        }),
    };

    const engine = createEvidenceEngine({
      provider,
      now: (): Date => FIXED_NOW,
      createId: fixedIds(ulid('CLAIM2'), ulid('EVID2')),
    });

    const result = await engine.extractClaims(
      makeInput({ requestId: 'req-002' }),
    );
    const item = result.items[0];

    expect(item?.requestedStatus).toBe('high-confidence');
    expect(item?.claim.status).toBe('contested');
    expect(item?.promotion.ok).toBe(false);
    expect(item?.promotion.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(['R2', 'R3']),
    );
    expect(item?.auditTrail[0]?.detail).toMatchObject({
      requestedStatus: 'high-confidence',
      effectiveStatus: 'contested',
      promotionOk: false,
    });
  });

  it('creates the real xai runtime path through @wsa/agent-xai', async () => {
    const client: XaiClient = {
      chat: {
        completions: {
          create: () =>
            Promise.resolve({
              id: 'chatcmpl-001',
              model: 'grok-4-fast-reasoning',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: JSON.stringify({
                      summary: 'xAI completed an extraction.',
                      claims: [
                        {
                          text: 'The clerk refused to release the requested record.',
                          status: 'contested',
                          supports: 'supports',
                          rationale:
                            'The source text describes a refusal, not a final verified conclusion.',
                        },
                      ],
                    }),
                  },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: 120,
                completion_tokens: 44,
                total_tokens: 164,
                prompt_tokens_details: { cached_tokens: 90 },
                cost_in_usd_ticks: 12,
              },
            }),
        },
      },
    };

    const engine = createXaiEvidenceEngine({
      client,
      model: 'grok-4-fast-reasoning',
      now: (): Date => FIXED_NOW,
      createId: fixedIds(ulid('CLAIM3'), ulid('EVID3')),
    });

    const result = await engine.extractClaims(
      makeInput({ requestId: 'req-003' }),
    );

    expect(result.provider).toBe('xai');
    expect(result.responseId).toBe('chatcmpl-001');
    expect(result.usage.cachedInputTokens).toBe(90);
    expect(result.usage.costInUsdTicks).toBe(12);
    expect(result.items[0]?.evidence.provenance.providerIds).toEqual(['xai']);
    expect(result.items[0]?.evidence.provenance.modelGenerated).toBe(true);
  });
});
