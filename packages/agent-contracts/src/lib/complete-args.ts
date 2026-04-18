/**
 * `complete()` call arguments. Deliberately narrow:
 *
 *   schema          — Zod schema the provider output MUST satisfy.
 *   messages        — conversation prefix, system-first by convention.
 *   tools           — optional tool definitions the provider may invoke.
 *   taskKind        — routing lane per ADR-0003. Recorded in audit logs.
 *   maxOutputTokens — hard ceiling on response tokens; adapters MUST
 *                     forward this as the provider's equivalent field.
 *   timeoutMs       — per-request timeout enforced at the adapter layer.
 *   requestId       — caller-supplied idempotency / tracing key.
 *
 * Intentionally NOT here: retry policy, temperature, top_p, streaming,
 * background mode. Retries belong above this layer; sampling knobs stay
 * out until we have a real need that both OpenAI and xAI honour.
 */

import type { z } from 'zod';
import type { AgentMessage } from './messages.js';
import type { AgentTaskKind } from './task-kind.js';
import type { ToolSpec } from './tools.js';

export interface CompleteArgs<TSchema extends z.ZodType> {
  readonly schema: TSchema;
  readonly messages: ReadonlyArray<AgentMessage>;
  readonly tools?: ReadonlyArray<ToolSpec>;
  readonly taskKind: AgentTaskKind;
  readonly maxOutputTokens?: number;
  readonly timeoutMs?: number;
  readonly requestId?: string;
}
