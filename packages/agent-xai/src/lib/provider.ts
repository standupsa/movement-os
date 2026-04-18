/**
 * `createXaiProvider` — constructs a `ModelProvider` backed by xAI's
 * OpenAI-compatible Chat Completions API
 * (`https://api.x.ai/v1/chat/completions`).
 *
 * Design choices:
 *
 *   - Structured output is MANDATORY. The caller's Zod schema is
 *     converted to JSON Schema and attached as `response_format:
 *     { type: 'json_schema', strict: true, ... }`. The adapter then
 *     JSON-parses the assistant message and runs the Zod schema
 *     against it. Either step failing is a hard throw — an
 *     unparseable / shape-wrong response must never silently
 *     corrupt downstream data.
 *
 *   - The transport is injected as a narrow `XaiClient` interface.
 *     This keeps tests deterministic (no live API) and keeps the
 *     package free of a hard dependency on any xAI SDK. A real SDK
 *     client configured with `baseURL: "https://api.x.ai/v1"` is
 *     structurally compatible for the subset we use.
 *
 *   - Provider id is hard-coded to `'xai'`. Downstream routing
 *     (ADR-0003 three-lane model) keys off this id; the Grokipedia
 *     non-authoritative rule in `./xai-policy.ts` is enforced by
 *     `@sasa/guardrails` whenever the id appears in an Evidence or
 *     Claim provenance chain.
 *
 *   - `timeoutMs` is enforced with an `AbortController` at the
 *     adapter layer. Retries are NOT handled here — per ADR-0001,
 *     retry policy lives above the `ModelProvider` contract.
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
import { mapXaiFinishReason } from './finish-reason.js';
import { zodToXaiJsonSchema } from './json-schema.js';
import type {
  XaiChatCompletion,
  XaiChatCompletionChoice,
  XaiChatCompletionRequest,
  XaiChatMessage,
  XaiClient,
  XaiToolFunction,
} from './xai-client.js';

export interface XaiProviderConfig {
  readonly client: XaiClient;
  readonly model: string;
  /**
   * Name attached to the JSON schema sent as `response_format`. xAI
   * accepts (and echoes) the same `name` field as OpenAI. Default:
   * `'output'`.
   */
  readonly responseSchemaName?: string;
}

const ZERO_USAGE: TokenUsage = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

export function createXaiProvider(config: XaiProviderConfig): ModelProvider {
  const { client, model } = config;
  const responseSchemaName = config.responseSchemaName ?? 'output';

  return {
    id: 'xai',
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

      let completion: XaiChatCompletion;
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
        throw new Error('xai adapter: provider returned no choices');
      }

      const content = choice.message.content;
      if (content === null) {
        throw new Error(
          `xai adapter: assistant message had null content (finish_reason=${choice.finish_reason}); v1 does not support tool-call-only responses`,
        );
      }

      const parsedValue = parseAndValidate(args.schema, content, choice);
      const usage: TokenUsage = normaliseUsage(completion);
      const status = mapXaiFinishReason(choice.finish_reason);

      return {
        value: parsedValue,
        usage,
        provider: 'xai',
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
): XaiChatCompletionRequest {
  const messages: ReadonlyArray<XaiChatMessage> = args.messages.map(
    (m): XaiChatMessage => ({ role: m.role, content: m.content }),
  );

  const responseSchema = zodToXaiJsonSchema(args.schema);

  const tools: ReadonlyArray<XaiToolFunction> | undefined =
    args.tools === undefined
      ? undefined
      : args.tools.map(
          (t): XaiToolFunction => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: zodToXaiJsonSchema(t.parameters),
            },
          }),
        );

  // Build in two phases so optional fields stay truly absent under
  // `exactOptionalPropertyTypes` rather than becoming `undefined`.
  const base: XaiChatCompletionRequest = {
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
  choice: XaiChatCompletionChoice,
): z.infer<TSchema> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch (cause) {
    throw new Error(
      `xai adapter: assistant content was not valid JSON (finish_reason=${choice.finish_reason})`,
      { cause },
    );
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    throw new Error(
      `xai adapter: response failed schema validation: ${result.error.message}`,
      { cause: result.error },
    );
  }
  return result.data as z.infer<TSchema>;
}

function normaliseUsage(completion: XaiChatCompletion): TokenUsage {
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
