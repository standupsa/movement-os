/**
 * Narrow view of the OpenAI Chat Completions API surface.
 *
 * Declared here (rather than pulled in from the `openai` SDK) so:
 *   1. The adapter has no compile-time dependency on the SDK; callers
 *      wire their real client, tests inject a fake implementing only
 *      what we touch.
 *   2. The contract between the adapter and whatever transport it uses
 *      is visible and reviewable in one file.
 *
 * Fields mirror the OpenAI Chat Completions request/response JSON so a
 * real `OpenAI` SDK client can be passed through without translation —
 * structurally compatible for the subset we depend on.
 */

export interface OpenAiChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface OpenAiJsonSchemaResponseFormat {
  readonly type: 'json_schema';
  readonly json_schema: {
    readonly name: string;
    readonly schema: Record<string, unknown>;
    readonly strict: boolean;
  };
}

export interface OpenAiToolFunction {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  };
}

export interface OpenAiChatCompletionRequest {
  readonly model: string;
  readonly messages: ReadonlyArray<OpenAiChatMessage>;
  readonly response_format?: OpenAiJsonSchemaResponseFormat;
  readonly tools?: ReadonlyArray<OpenAiToolFunction>;
  readonly max_completion_tokens?: number;
  readonly user?: string;
}

export interface OpenAiChatCompletionChoice {
  readonly index: number;
  readonly message: {
    readonly role: 'assistant';
    readonly content: string | null;
  };
  readonly finish_reason: string;
}

export interface OpenAiChatCompletionUsage {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly total_tokens: number;
}

export interface OpenAiChatCompletion {
  readonly id: string;
  readonly model: string;
  readonly choices: ReadonlyArray<OpenAiChatCompletionChoice>;
  readonly usage?: OpenAiChatCompletionUsage;
}

export interface OpenAiRequestOptions {
  readonly signal?: AbortSignal;
}

export interface OpenAiClient {
  readonly chat: {
    readonly completions: {
      create(
        request: OpenAiChatCompletionRequest,
        options?: OpenAiRequestOptions,
      ): Promise<OpenAiChatCompletion>;
    };
  };
}
