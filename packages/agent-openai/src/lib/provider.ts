/**
 * `createOpenAiProvider` — constructs a `ModelProvider` backed by the
 * OpenAI Chat Completions API.
 *
 * Design choices:
 *
 *   - Structured output is MANDATORY. The caller's Zod schema is
 *     converted to JSON Schema and attached as `response_format:
 *     { type: 'json_schema', strict: true, ... }`. The adapter then
 *     JSON-parses the assistant message and runs the Zod schema
 *     against it. If either step fails, we throw with a clear message
 *     — an unparseable / shape-wrong response is a hard failure, not
 *     silent data corruption.
 *
 *   - The transport is injected as a narrow `OpenAiClient` interface.
 *     This keeps tests deterministic (no live API) and keeps the
 *     package free of a hard dependency on the `openai` SDK — callers
 *     pass whatever implements our narrow shape, including the real
 *     SDK client (structurally compatible for the subset we use).
 *
 *   - Provider id is hard-coded to `'openai'`. A sibling adapter at
 *     `@sasa/agent-xai` will wire the same client shape to xAI's
 *     OpenAI-compatible endpoint and report `'xai'`.
 *
 *   - `timeoutMs` is enforced with an `AbortController` at the
 *     adapter layer. Retries are NOT handled here — per ADR, retry
 *     policy lives above the `ModelProvider` contract.
 *
 *   - Tool declarations are passed through (Zod `parameters` converted
 *     to JSON Schema). v1 does not support multi-turn tool dialogs: if
 *     the model elects to call a tool instead of returning content
 *     (`content === null`), we throw. Callers that need tool-calling
 *     loops must layer that above this interface.
 */

import type {
  CompleteArgs,
  ModelProvider,
  ModelResponse,
  TokenUsage,
} from '@sasa/agent-contracts';
import type { z } from 'zod';
import { mapOpenAiFinishReason } from './finish-reason.js';
import { zodToOpenAiJsonSchema } from './json-schema.js';
import type {
  OpenAiChatCompletion,
  OpenAiChatCompletionChoice,
  OpenAiChatCompletionRequest,
  OpenAiChatMessage,
  OpenAiClient,
  OpenAiToolFunction,
} from './openai-client.js';

export interface OpenAiProviderConfig {
  readonly client: OpenAiClient;
  readonly model: string;
  /**
   * Name attached to the JSON schema sent as `response_format`. OpenAI
   * requires this and uses it in error messages. Default: `'output'`.
   */
  readonly responseSchemaName?: string;
}

const ZERO_USAGE: TokenUsage = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

export function createOpenAiProvider(
  config: OpenAiProviderConfig,
): ModelProvider {
  const { client, model } = config;
  const responseSchemaName = config.responseSchemaName ?? 'output';

  return {
    id: 'openai',
    complete: async <TSchema extends z.ZodType>(
      args: CompleteArgs<TSchema>,
    ): Promise<ModelResponse<z.infer<TSchema>>> => {
      const request = buildRequest(args, model, responseSchemaName);
      const controller = new AbortController();
      const timeoutHandle =
        args.timeoutMs !== undefined
          ? setTimeout(() => {
              controller.abort();
            }, args.timeoutMs)
          : undefined;

      let completion: OpenAiChatCompletion;
      try {
        completion = await client.chat.completions.create(request, {
          signal: controller.signal,
        });
      } finally {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
      }

      const choice = completion.choices[0];
      if (choice === undefined) {
        throw new Error('openai adapter: provider returned no choices');
      }

      const content = choice.message.content;
      if (content === null) {
        throw new Error(
          `openai adapter: assistant message had null content (finish_reason=${choice.finish_reason}); v1 does not support tool-call-only responses`,
        );
      }

      const parsedValue = parseAndValidate(args.schema, content, choice);
      const usage: TokenUsage = normaliseUsage(completion);
      const status = mapOpenAiFinishReason(choice.finish_reason);

      return {
        value: parsedValue,
        usage,
        provider: 'openai',
        model: completion.model,
        responseId: completion.id,
        rawFinishReason: choice.finish_reason,
        status,
      };
    },
  };
}

function buildRequest<TSchema extends z.ZodType>(
  args: CompleteArgs<TSchema>,
  model: string,
  responseSchemaName: string,
): OpenAiChatCompletionRequest {
  const messages: ReadonlyArray<OpenAiChatMessage> = args.messages.map(
    (m): OpenAiChatMessage => ({ role: m.role, content: m.content }),
  );

  const responseSchema = zodToOpenAiJsonSchema(args.schema);

  const tools: ReadonlyArray<OpenAiToolFunction> | undefined =
    args.tools === undefined
      ? undefined
      : args.tools.map(
          (t): OpenAiToolFunction => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: zodToOpenAiJsonSchema(t.parameters),
            },
          }),
        );

  // Build in two phases so optional fields stay truly absent under
  // `exactOptionalPropertyTypes` rather than becoming `undefined`.
  const base: OpenAiChatCompletionRequest = {
    model,
    messages,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: responseSchemaName,
        schema: responseSchema,
        strict: true,
      },
    },
  };

  return {
    ...base,
    ...(tools !== undefined ? { tools } : {}),
    ...(args.maxOutputTokens !== undefined
      ? { max_completion_tokens: args.maxOutputTokens }
      : {}),
    ...(args.requestId !== undefined ? { user: args.requestId } : {}),
  };
}

function parseAndValidate<TSchema extends z.ZodType>(
  schema: TSchema,
  content: string,
  choice: OpenAiChatCompletionChoice,
): z.infer<TSchema> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch (cause) {
    throw new Error(
      `openai adapter: assistant content was not valid JSON (finish_reason=${choice.finish_reason})`,
      { cause },
    );
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error(
      `openai adapter: response failed schema validation: ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result.data as z.infer<TSchema>;
}

function normaliseUsage(completion: OpenAiChatCompletion): TokenUsage {
  const usage = completion.usage;
  if (usage === undefined) {
    return ZERO_USAGE;
  }
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
}
