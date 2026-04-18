import { z } from 'zod';
import type {
  AgentMessage,
  CompleteArgs,
  ToolSpec,
} from '@wsa/agent-contracts';
import { createXaiProvider } from './provider.js';
import { XaiBudgetExceededError } from './telemetry.js';
import type {
  XaiChatCompletion,
  XaiChatCompletionRequest,
  XaiClient,
  XaiRequestOptions,
} from './xai-client.js';

interface RecordedCall {
  readonly request: XaiChatCompletionRequest;
  readonly options?: XaiRequestOptions | undefined;
}

function fakeCompletion(
  overrides: Partial<XaiChatCompletion> & {
    readonly content?: string | null;
    readonly finishReason?: string;
  } = {},
): XaiChatCompletion {
  const content = Object.hasOwn(overrides, 'content')
    ? (overrides.content ?? null)
    : '{"ok":true}';
  const finishReason = overrides.finishReason ?? 'stop';
  return {
    id: overrides.id ?? 'xai_cmpl_test_0',
    model: overrides.model ?? 'grok-4',
    choices: overrides.choices ?? [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: finishReason,
      },
    ],
    usage: overrides.usage ?? {
      prompt_tokens: 17,
      completion_tokens: 9,
      total_tokens: 26,
      prompt_tokens_details: {
        cached_tokens: 11,
      },
      cost_in_usd_ticks: 12345,
    },
  };
}

function makeFakeClient(
  responder: (
    request: XaiChatCompletionRequest,
  ) => XaiChatCompletion | Promise<XaiChatCompletion>,
): { client: XaiClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const client: XaiClient = {
    chat: {
      completions: {
        create: async (request, options) => {
          calls.push({ request, options });
          return responder(request);
        },
      },
    },
  };
  return { client, calls };
}

const SYSTEM_MESSAGE: AgentMessage = {
  role: 'system',
  content: 'You produce strict JSON matching the schema.',
};
const USER_MESSAGE: AgentMessage = {
  role: 'user',
  content: 'Return the record.',
};

describe('createXaiProvider', () => {
  it('reports its id as "xai"', () => {
    const { client } = makeFakeClient(() => fakeCompletion());

    const provider = createXaiProvider({ client, model: 'grok-4' });

    expect(provider.id).toBe('xai');
  });

  it('round-trips a schema-validated JSON response', async () => {
    const ResponseSchema = z.object({ title: z.string(), count: z.number() });
    const { client } = makeFakeClient(() =>
      fakeCompletion({ content: '{"title":"hello","count":3}' }),
    );
    const provider = createXaiProvider({ client, model: 'grok-4' });
    const args: CompleteArgs<typeof ResponseSchema> = {
      schema: ResponseSchema,
      messages: [SYSTEM_MESSAGE, USER_MESSAGE],
      taskKind: 'analysis',
    };

    const result = await provider.complete(args);

    expect(result.value).toEqual({ title: 'hello', count: 3 });
    expect(result.provider).toBe('xai');
    expect(result.model).toBe('grok-4');
    expect(result.responseId).toBe('xai_cmpl_test_0');
    expect(result.rawFinishReason).toBe('stop');
    expect(result.status).toBe('completed');
    expect(result.usage).toEqual({
      inputTokens: 17,
      outputTokens: 9,
      totalTokens: 26,
      cachedInputTokens: 11,
      costInUsdTicks: 12345,
    });
  });

  it('forwards messages, response_format, and model into the request', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client, calls } = makeFakeClient(() => fakeCompletion());
    const provider = createXaiProvider({
      client,
      model: 'grok-4',
      responseSchemaName: 'record',
    });

    await provider.complete({
      schema: ResponseSchema,
      messages: [SYSTEM_MESSAGE, USER_MESSAGE],
      taskKind: 'analysis',
    });

    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (call === undefined) {
      throw new Error('expected one recorded call');
    }
    expect(call.request.model).toBe('grok-4');
    expect(call.request.messages).toEqual([
      { role: 'system', content: SYSTEM_MESSAGE.content },
      { role: 'user', content: USER_MESSAGE.content },
    ]);
    expect(call.request.response_format?.type).toBe('json_schema');
    expect(call.request.response_format?.json_schema.name).toBe('record');
    expect(call.request.response_format?.json_schema.strict).toBe(true);
    expect(call.request.response_format?.json_schema.schema).toMatchObject({
      type: 'object',
    });
  });

  it('collapses leading system messages into one stable prefix for cache hits', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client, calls } = makeFakeClient(() => fakeCompletion());
    const provider = createXaiProvider({ client, model: 'grok-4' });

    await provider.complete({
      schema: ResponseSchema,
      messages: [
        { role: 'system', content: 'Alpha' },
        { role: 'system', content: 'Beta' },
        USER_MESSAGE,
      ],
      taskKind: 'analysis',
    });

    expect(calls[0]?.request.messages).toEqual([
      { role: 'system', content: 'Alpha\n\nBeta' },
      { role: 'user', content: USER_MESSAGE.content },
    ]);
  });

  it('forwards maxOutputTokens as max_completion_tokens', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client, calls } = makeFakeClient(() => fakeCompletion());
    const provider = createXaiProvider({ client, model: 'grok-4' });

    await provider.complete({
      schema: ResponseSchema,
      messages: [USER_MESSAGE],
      taskKind: 'analysis',
      maxOutputTokens: 512,
    });

    expect(calls[0]?.request.max_completion_tokens).toBe(512);
  });

  it('forwards requestId as the user field, omits when absent', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client, calls } = makeFakeClient(() => fakeCompletion());
    const provider = createXaiProvider({ client, model: 'grok-4' });

    await provider.complete({
      schema: ResponseSchema,
      messages: [USER_MESSAGE],
      taskKind: 'analysis',
      requestId: 'req_xai_abc',
    });
    await provider.complete({
      schema: ResponseSchema,
      messages: [USER_MESSAGE],
      taskKind: 'analysis',
    });

    expect(calls[0]?.request.user).toBe('req_xai_abc');
    expect(Object.hasOwn(calls[1]?.request ?? {}, 'user')).toBe(false);
  });

  it('serialises tool specifications to xAI function format', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const tool: ToolSpec = {
      name: 'fetch_record',
      description: 'Fetch a record by id.',
      parameters: z.object({ id: z.string() }),
    };
    const { client, calls } = makeFakeClient(() => fakeCompletion());
    const provider = createXaiProvider({ client, model: 'grok-4' });

    await provider.complete({
      schema: ResponseSchema,
      messages: [USER_MESSAGE],
      taskKind: 'analysis',
      tools: [tool],
    });

    const tools = calls[0]?.request.tools;
    expect(tools).toHaveLength(1);
    expect(tools?.[0]).toMatchObject({
      type: 'function',
      function: {
        name: 'fetch_record',
        description: 'Fetch a record by id.',
        parameters: { type: 'object' },
      },
    });
  });

  it('throws a clear error when the response is not valid JSON', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client } = makeFakeClient(() =>
      fakeCompletion({ content: 'not json' }),
    );
    const provider = createXaiProvider({ client, model: 'grok-4' });

    await expect(
      provider.complete({
        schema: ResponseSchema,
        messages: [USER_MESSAGE],
        taskKind: 'analysis',
      }),
    ).rejects.toThrow(/not valid JSON/);
  });

  it('throws a clear error when the response fails schema validation', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client } = makeFakeClient(() =>
      fakeCompletion({ content: '{"ok":"yes"}' }),
    );
    const provider = createXaiProvider({ client, model: 'grok-4' });

    await expect(
      provider.complete({
        schema: ResponseSchema,
        messages: [USER_MESSAGE],
        taskKind: 'analysis',
      }),
    ).rejects.toThrow(/failed schema validation/);
  });

  it('rejects null content (tool-call-only response) in v1', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client } = makeFakeClient(() =>
      fakeCompletion({ content: null, finishReason: 'tool_calls' }),
    );
    const provider = createXaiProvider({ client, model: 'grok-4' });

    await expect(
      provider.complete({
        schema: ResponseSchema,
        messages: [USER_MESSAGE],
        taskKind: 'analysis',
      }),
    ).rejects.toThrow(/null content/);
  });

  it('maps length finish_reason to incomplete status', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client } = makeFakeClient(() =>
      fakeCompletion({ finishReason: 'length' }),
    );
    const provider = createXaiProvider({ client, model: 'grok-4' });

    const result = await provider.complete({
      schema: ResponseSchema,
      messages: [USER_MESSAGE],
      taskKind: 'analysis',
    });

    expect(result.status).toBe('incomplete');
    expect(result.rawFinishReason).toBe('length');
  });

  it('returns zeroed usage when the provider omits usage', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client } = makeFakeClient(() => {
      const { usage: _omit, ...withoutUsage } = fakeCompletion();
      return withoutUsage;
    });
    const provider = createXaiProvider({ client, model: 'grok-4' });

    const result = await provider.complete({
      schema: ResponseSchema,
      messages: [USER_MESSAGE],
      taskKind: 'analysis',
    });

    expect(result.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    });
  });

  it('emits telemetry with cache and cost accounting on success', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const events: unknown[] = [];
    const { client } = makeFakeClient(() => fakeCompletion());
    const provider = createXaiProvider({
      client,
      model: 'grok-4',
      telemetry: {
        clock: () => new Date('2026-04-18T12:00:00Z'),
        sink: {
          append: (event) => {
            events.push(event);
          },
        },
      },
    });

    await provider.complete({
      schema: ResponseSchema,
      messages: [USER_MESSAGE],
      taskKind: 'analysis',
      requestId: 'req_xai_telemetry',
    });

    expect(events).toEqual([
      expect.objectContaining({
        occurredAt: '2026-04-18T12:00:00.000Z',
        monthKey: '2026-04',
        provider: 'xai',
        model: 'grok-4',
        taskKind: 'analysis',
        requestId: 'req_xai_telemetry',
        outcome: 'success',
        rawFinishReason: 'stop',
        cacheHitRatio: 11 / 17,
        usage: {
          inputTokens: 17,
          outputTokens: 9,
          totalTokens: 26,
          cachedInputTokens: 11,
          costInUsdTicks: 12345,
        },
      }),
    ]);
  });

  it('blocks calls once the recorded monthly budget is exhausted', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client } = makeFakeClient(() => fakeCompletion());
    const provider = createXaiProvider({
      client,
      model: 'grok-4',
      telemetry: {
        clock: () => new Date('2026-04-18T12:00:00Z'),
        budget: {
          monthlyCapUsdTicks: 1000,
          softLimitThresholdPct: 80,
          meter: {
            getMonthToDateCostUsdTicks: () => 1000,
          },
        },
      },
    });

    await expect(
      provider.complete({
        schema: ResponseSchema,
        messages: [USER_MESSAGE],
        taskKind: 'analysis',
      }),
    ).rejects.toThrow(XaiBudgetExceededError);
  });

  it('notifies when a successful call crosses the soft budget threshold', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const alerts: unknown[] = [];
    const { client } = makeFakeClient(() => fakeCompletion());
    const provider = createXaiProvider({
      client,
      model: 'grok-4',
      telemetry: {
        clock: () => new Date('2026-04-18T12:00:00Z'),
        budget: {
          monthlyCapUsdTicks: 20000,
          softLimitThresholdPct: 80,
          meter: {
            getMonthToDateCostUsdTicks: () => 10000,
          },
          softLimitSink: {
            notify: (alert) => {
              alerts.push(alert);
            },
          },
        },
      },
    });

    await provider.complete({
      schema: ResponseSchema,
      messages: [USER_MESSAGE],
      taskKind: 'analysis',
      requestId: 'req_soft_limit',
    });

    expect(alerts).toEqual([
      {
        occurredAt: '2026-04-18T12:00:00.000Z',
        monthKey: '2026-04',
        provider: 'xai',
        model: 'grok-4',
        taskKind: 'analysis',
        requestId: 'req_soft_limit',
        monthToDateCostUsdTicks: 10000,
        projectedMonthCostUsdTicks: 22345,
        budgetCapUsdTicks: 20000,
        softLimitThresholdPct: 80,
      },
    ]);
  });

  it('passes an AbortSignal and aborts when timeoutMs elapses', async () => {
    jest.useFakeTimers();
    try {
      const ResponseSchema = z.object({ ok: z.boolean() });
      let capturedSignal: AbortSignal | undefined;
      const client: XaiClient = {
        chat: {
          completions: {
            create: (_request, options) => {
              capturedSignal = options?.signal;
              return new Promise<XaiChatCompletion>((_resolve, reject) => {
                capturedSignal?.addEventListener('abort', () => {
                  reject(new Error('aborted'));
                });
              });
            },
          },
        },
      };
      const provider = createXaiProvider({ client, model: 'grok-4' });

      const pending = provider.complete({
        schema: ResponseSchema,
        messages: [USER_MESSAGE],
        taskKind: 'analysis',
        timeoutMs: 50,
      });
      const assertion = expect(pending).rejects.toThrow(/aborted/);
      await jest.advanceTimersByTimeAsync(60);
      await assertion;
      expect(capturedSignal?.aborted).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not arm a timer when timeoutMs is absent', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    let capturedSignal: AbortSignal | undefined;
    const client: XaiClient = {
      chat: {
        completions: {
          create: (_request, options) => {
            capturedSignal = options?.signal;
            return Promise.resolve(fakeCompletion());
          },
        },
      },
    };
    const provider = createXaiProvider({ client, model: 'grok-4' });

    await provider.complete({
      schema: ResponseSchema,
      messages: [USER_MESSAGE],
      taskKind: 'analysis',
    });

    expect(capturedSignal?.aborted).toBe(false);
  });

  it('throws when the provider returns zero choices', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client } = makeFakeClient(() => ({
      id: 'xai_cmpl_empty',
      model: 'grok-4',
      choices: [],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }));
    const provider = createXaiProvider({ client, model: 'grok-4' });

    await expect(
      provider.complete({
        schema: ResponseSchema,
        messages: [USER_MESSAGE],
        taskKind: 'analysis',
      }),
    ).rejects.toThrow(/no choices/);
  });
});
