/**
 * `ModelProvider` — the one-function abstraction every LLM adapter must
 * satisfy. A single, typed, schema-validated request/response pair.
 *
 * Implementations live in sibling packages (`@wsa/agent-openai`,
 * `@wsa/agent-xai`, ...). Orchestration picks a provider per ADR-0003
 * lane and calls `complete()`; everything else — retries, circuit
 * breaking, caching, audit logging — layers above this interface.
 */

import type { z } from 'zod';
import type { CompleteArgs } from './complete-args.js';
import type { LlmProviderId } from './provider-id.js';
import type { ModelResponse } from './response.js';

export interface ModelProvider {
  readonly id: LlmProviderId;
  complete<TSchema extends z.ZodType>(
    args: CompleteArgs<TSchema>,
  ): Promise<ModelResponse<z.infer<TSchema>>>;
}
