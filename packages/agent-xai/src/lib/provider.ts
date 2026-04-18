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
 *     `@wsa/guardrails` whenever the id appears in an Evidence or
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
} from '@wsa/agent-contracts';
import type { z } from 'zod';
import { mapXaiFinishReason } from './finish-reason.js';
import { zodToXaiJsonSchema } from './json-schema.js';
import {
  appendTelemetryEvent,
  assertBudgetAvailable,
  cacheHitRatioForUsage,
  collapseLeadingSystemMessagesForCache,
  getBudgetState,
  notifySoftLimit,
  type XaiTelemetryOptions,
} from './telemetry.js';
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
  /**
   * Optional telemetry / budget controls. When configured, xAI calls are
   * budget-gated against recorded month-to-date spend and every call emits
   * a structured telemetry event for append-only logging.
   */
  readonly telemetry?: XaiTelemetryOptions;
}

const ZERO_USAGE: TokenUsage = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
});

export function createXaiProvider(config: XaiProviderConfig): ModelProvider {
  const { client, model } = config;
  const responseSchemaName = config.responseSchemaName ?? 'output';
  const clock = config.telemetry?.clock ?? (() => new Date());

  return {
    id: 'xai',
    complete: async <TSchema extends z.ZodType>(
      args: CompleteArgs<TSchema>,
    ): Promise<ModelResponse<z.infer<TSchema>>> => {
      const request = buildRequest(args, model, responseSchemaName);
      const startedAt = clock();
      const budgetState = await getBudgetState(
        config.telemetry?.budget,
        startedAt,
      );
      const controller = new AbortController();
      const timeoutHandle =
        args.timeoutMs !== undefined
          ? setTimeout(() => {
              controller.abort();
            }, args.timeoutMs)
          : undefined;

      let completion: XaiChatCompletion | undefined;
      try {
        assertBudgetAvailable(budgetState);
        completion = await client.chat.completions.create(request, {
          signal: controller.signal,
        });
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
        const projectedMonthCostUsdTicks =
          budgetState?.monthToDateCostUsdTicks !== undefined &&
          usage.costInUsdTicks !== undefined
            ? budgetState.monthToDateCostUsdTicks + usage.costInUsdTicks
            : undefined;

        const result: ModelResponse<z.infer<TSchema>> = {
          value: parsedValue,
          usage,
          provider: 'xai',
          model: completion.model,
          responseId: completion.id,
          rawFinishReason: choice.finish_reason,
          status,
        };

        const event = {
          occurredAt: startedAt.toISOString(),
          monthKey:
            budgetState?.monthKey ?? startedAt.toISOString().slice(0, 7),
          provider: 'xai' as const,
          model: completion.model,
          taskKind: args.taskKind,
          outcome: 'success' as const,
          status,
          rawFinishReason: choice.finish_reason,
          usage,
          cacheHitRatio: cacheHitRatioForUsage(usage),
          ...(args.requestId !== undefined
            ? { requestId: args.requestId }
            : {}),
          responseId: completion.id,
          ...(budgetState?.monthToDateCostUsdTicks !== undefined
            ? { monthToDateCostUsdTicks: budgetState.monthToDateCostUsdTicks }
            : {}),
          ...(projectedMonthCostUsdTicks !== undefined
            ? { projectedMonthCostUsdTicks }
            : {}),
          ...(budgetState?.monthlyCapUsdTicks !== undefined
            ? { budgetCapUsdTicks: budgetState.monthlyCapUsdTicks }
            : {}),
          ...(budgetState?.softLimitThresholdPct !== undefined
            ? { softLimitThresholdPct: budgetState.softLimitThresholdPct }
            : {}),
        };
        await appendTelemetryEvent(config.telemetry?.sink, event);
        await notifySoftLimit(config.telemetry?.budget, budgetState, event);
        return result;
      } catch (cause) {
        const usage =
          completion === undefined ? ZERO_USAGE : normaliseUsage(completion);
        const rawFinishReason =
          completion?.choices[0]?.finish_reason ??
          (cause instanceof Error && cause.name === 'XaiBudgetExceededError'
            ? 'budget_cap_reached'
            : 'error');
        const status =
          completion?.choices[0] === undefined
            ? undefined
            : mapXaiFinishReason(completion.choices[0].finish_reason);
        const projectedMonthCostUsdTicks =
          budgetState?.monthToDateCostUsdTicks !== undefined &&
          usage.costInUsdTicks !== undefined
            ? budgetState.monthToDateCostUsdTicks + usage.costInUsdTicks
            : undefined;

        await appendTelemetryEvent(config.telemetry?.sink, {
          occurredAt: startedAt.toISOString(),
          monthKey:
            budgetState?.monthKey ?? startedAt.toISOString().slice(0, 7),
          provider: 'xai',
          model: completion?.model ?? model,
          taskKind: args.taskKind,
          outcome:
            cause instanceof Error && cause.name === 'XaiBudgetExceededError'
              ? 'budget-blocked'
              : 'error',
          usage,
          cacheHitRatio: cacheHitRatioForUsage(usage),
          ...(args.requestId !== undefined
            ? { requestId: args.requestId }
            : {}),
          ...(completion?.id !== undefined
            ? { responseId: completion.id }
            : {}),
          ...(status !== undefined ? { status } : {}),
          rawFinishReason,
          ...(budgetState?.monthToDateCostUsdTicks !== undefined
            ? { monthToDateCostUsdTicks: budgetState.monthToDateCostUsdTicks }
            : {}),
          ...(projectedMonthCostUsdTicks !== undefined
            ? { projectedMonthCostUsdTicks }
            : {}),
          ...(budgetState?.monthlyCapUsdTicks !== undefined
            ? { budgetCapUsdTicks: budgetState.monthlyCapUsdTicks }
            : {}),
          ...(budgetState?.softLimitThresholdPct !== undefined
            ? { softLimitThresholdPct: budgetState.softLimitThresholdPct }
            : {}),
          errorMessage: cause instanceof Error ? cause.message : String(cause),
        });
        throw cause;
      } finally {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
      }
    },
  };
}

function buildRequest<TSchema extends z.ZodType>(
  args: CompleteArgs<TSchema>,
  model: string,
  responseSchemaName: string,
): XaiChatCompletionRequest {
  const messages: ReadonlyArray<XaiChatMessage> =
    collapseLeadingSystemMessagesForCache(args.messages).map(
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
    ...(usage.prompt_tokens_details?.cached_tokens !== undefined
      ? { cachedInputTokens: usage.prompt_tokens_details.cached_tokens }
      : {}),
    ...(usage.cost_in_usd_ticks !== undefined
      ? { costInUsdTicks: usage.cost_in_usd_ticks }
      : {}),
  };
}
