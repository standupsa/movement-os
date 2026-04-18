/**
 * In-memory fake `ModelProvider` for tests.
 *
 * Crucially, `produce` is a schema-parameterised factory, not a constant
 * value. That lets a single fake exercise the generic narrowing of
 * `ModelProvider.complete<TSchema>` against arbitrary caller schemas
 * without any `as` casts or `any`.
 *
 * The fake validates its own output through the caller-supplied schema
 * so a mis-specified `produce` fails loudly inside the fake rather than
 * producing a typed lie.
 */

import type { z } from 'zod';
import type { ModelProvider } from './model-provider.js';
import type { LlmProviderId } from './provider-id.js';
import type { ResponseStatus } from './response.js';
import type { TokenUsage } from './usage.js';

export interface FakeProviderConfig {
  readonly id?: LlmProviderId;
  readonly model?: string;
  readonly usage?: TokenUsage;
  readonly status?: ResponseStatus;
  readonly responseId?: string;
  readonly rawFinishReason?: string;
  /**
   * Produces the value the fake will return. Called with the caller's
   * schema so tests can synthesise a value that happens to satisfy it
   * — or return something invalid to exercise the schema guard.
   */
  readonly produce: <TSchema extends z.ZodType>(
    schema: TSchema,
  ) => z.infer<TSchema>;
}

const DEFAULT_USAGE: TokenUsage = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

export function createFakeProvider(config: FakeProviderConfig): ModelProvider {
  const id: LlmProviderId = config.id ?? 'openai';
  const model = config.model ?? 'fake-model-0';
  const usage: TokenUsage = config.usage ?? DEFAULT_USAGE;
  const status: ResponseStatus = config.status ?? 'completed';
  const rawFinishReason = config.rawFinishReason ?? 'stop';

  return {
    id,
    complete: async (args) => {
      const rawValue = config.produce(args.schema);
      // Schema guard. A mis-specified `produce` throws here instead of
      // sneaking a shape-wrong value back to the caller.
      const value = args.schema.parse(rawValue) as z.infer<typeof args.schema>;
      return Promise.resolve({
        value,
        usage,
        provider: id,
        model,
        responseId: config.responseId,
        rawFinishReason,
        status,
      });
    },
  };
}
