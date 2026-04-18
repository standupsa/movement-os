/**
 * Map xAI Chat Completions `finish_reason` values onto our normalized
 * `ResponseStatus` enum (see `@wsa/agent-contracts`).
 *
 * Policy (intentionally identical to the OpenAI adapter — xAI's API is
 * Chat-Completions-compatible and reports the same vocabulary):
 *
 *   stop            → completed   (natural end of generation)
 *   tool_calls      → completed   (model invoked a tool; not our concern)
 *   function_call   → completed   (legacy naming; same semantics)
 *   length          → incomplete  (hit max_completion_tokens; output
 *                                  almost certainly fails the schema)
 *   content_filter  → incomplete  (safety filter cut the response)
 *   <unknown>       → incomplete  (conservative — unknown terminators
 *                                  from future xAI versions should
 *                                  not silently pass as "completed")
 *
 * The raw string is preserved in `rawFinishReason` on `ModelResponse`
 * so audit logs keep provider-specific vocabulary.
 */

import type { ResponseStatus } from '@wsa/agent-contracts';

const COMPLETED_REASONS: ReadonlySet<string> = new Set([
  'stop',
  'tool_calls',
  'function_call',
]);

const INCOMPLETE_REASONS: ReadonlySet<string> = new Set([
  'length',
  'content_filter',
]);

export function mapXaiFinishReason(rawFinishReason: string): ResponseStatus {
  if (COMPLETED_REASONS.has(rawFinishReason)) {
    return 'completed';
  }
  if (INCOMPLETE_REASONS.has(rawFinishReason)) {
    return 'incomplete';
  }
  return 'incomplete';
}
