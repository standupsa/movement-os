/**
 * Narrow view of the xAI Chat Completions API surface.
 *
 * xAI's public API is OpenAI Chat Completions-compatible
 * (`https://api.x.ai/v1/chat/completions`). The request/response shape
 * below is the subset this adapter touches — declared here, not imported
 * from either the `openai` SDK or the `xai` SDK, so:
 *
 *   1. The adapter has no compile-time dependency on a vendor SDK;
 *      callers wire their real client, tests inject a fake implementing
 *      only what we use.
 *   2. The contract between the adapter and whatever transport it uses
 *      is visible and reviewable in one file, independent of the
 *      sibling `@wsa/agent-openai` adapter.
 *
 * Keeping these shapes duplicated rather than extracted into a shared
 * `@wsa/agent-chat-completions` helper is deliberate: v1 ships two
 * adapters, which is one below the threshold at which deduplication
 * pays for the coupling. The third adapter (Anthropic) will not share
 * this shape anyway.
 */

export interface XaiChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface XaiJsonSchemaResponseFormat {
  readonly type: 'json_schema';
  readonly json_schema: {
    readonly name: string;
    readonly schema: Record<string, unknown>;
    readonly strict: boolean;
  };
}

export interface XaiToolFunction {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

export interface XaiChatCompletionRequest {
  readonly model: string;
  readonly messages: ReadonlyArray<XaiChatMessage>;
  readonly response_format?: XaiJsonSchemaResponseFormat;
  readonly tools?: ReadonlyArray<XaiToolFunction>;
  readonly max_completion_tokens?: number;
  readonly user?: string;
}

export interface XaiChatCompletionChoice {
  readonly index: number;
  readonly message: {
    readonly role: 'assistant';
    readonly content: string | null;
  };
  readonly finish_reason: string;
}

export interface XaiChatCompletionUsage {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly total_tokens: number;
  readonly prompt_tokens_details?: {
    readonly cached_tokens?: number;
  };
  readonly cost_in_usd_ticks?: number;
}

export interface XaiChatCompletion {
  readonly id: string;
  readonly model: string;
  readonly choices: ReadonlyArray<XaiChatCompletionChoice>;
  readonly usage?: XaiChatCompletionUsage;
}

export interface XaiRequestOptions {
  readonly signal?: AbortSignal;
}

export interface XaiClient {
  readonly chat: {
    readonly completions: {
      create(
        request: XaiChatCompletionRequest,
        options?: XaiRequestOptions,
      ): Promise<XaiChatCompletion>;
    };
  };
}
