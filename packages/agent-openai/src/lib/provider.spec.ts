import { z } from 'zod';
import type {
  AgentMessage,
  CompleteArgs,
  ToolSpec,
} from '@sasa/agent-contracts';
import { createOpenAiProvider } from './provider.js';
import type {
  OpenAiChatCompletion,
  OpenAiChatCompletionRequest,
  OpenAiClient,
  OpenAiRequestOptions,
} from './openai-client.js';

interface RecordedCall {
  readonly request: OpenAiChatCompletionRequest;
  readonly options?: OpenAiRequestOptions | undefined;
}

function fakeCompletion(
  overrides: Partial<OpenAiChatCompletion> & {
    readonly content?: string | null;
    readonly finishReason?: string;
  } = {},
): OpenAiChatCompletion {
  const content = Object.hasOwn(overrides, 'content')
    ? (overrides.content ?? null)
    : '{"ok":true}';
  const finishReason = overrides.finishReason ?? 'stop';
  return {
    id: overrides.id ?? 'cmpl_test_0',
    model: overrides.model ?? 'gpt-4o-mini',
    choices: overrides.choices ?? [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: finishReason,
      },
    ],
    usage: overrides.usage ?? {
      prompt_tokens: 11,
      completion_tokens: 5,
      total_tokens: 16,
    },
  };
}

function makeFakeClient(
  responder: (
    request: OpenAiChatCompletionRequest,
  ) => OpenAiChatCompletion | Promise<OpenAiChatCompletion>,
): { client: OpenAiClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const client: OpenAiClient = {
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

describe('createOpenAiProvider', () => {
  it('reports its id as "openai"', () => {
    const { client } = makeFakeClient(() => fakeCompletion());

    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });

    expect(provider.id).toBe('openai');
  });

  it('round-trips a schema-validated JSON response', async () => {
    const ResponseSchema = z.object({ title: z.string(), count: z.number() });
    const { client } = makeFakeClient(() =>
      fakeCompletion({ content: '{"title":"hello","count":3}' }),
    );
    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });
    const args: CompleteArgs<typeof ResponseSchema> = {
      schema: ResponseSchema,
      messages: [SYSTEM_MESSAGE, USER_MESSAGE],
      taskKind: 'analysis',
    };

    const result = await provider.complete(args);

    expect(result.value).toEqual({ title: 'hello', count: 3 });
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o-mini');
    expect(result.responseId).toBe('cmpl_test_0');
    expect(result.rawFinishReason).toBe('stop');
    expect(result.status).toBe('completed');
    expect(result.usage).toEqual({
      inputTokens: 11,
      outputTokens: 5,
      totalTokens: 16,
    });
  });

  it('forwards messages, response_format, and model into the request', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client, calls } = makeFakeClient(() => fakeCompletion());
    const provider = createOpenAiProvider({
      client,
      model: 'gpt-4o-mini',
      responseSchemaName: 'record',
    });

    await provider.complete({
      schema: ResponseSchema,
      messages: [SYSTEM_MESSAGE, USER_MESSAGE],
      taskKind: 'sensitive-intake',
    });

    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (call === undefined) {
      throw new Error('expected one recorded call');
    }
    expect(call.request.model).toBe('gpt-4o-mini');
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

  it('forwards maxOutputTokens as max_completion_tokens', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const { client, calls } = makeFakeClient(() => fakeCompletion());
    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });

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
    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });

    await provider.complete({
      schema: ResponseSchema,
      messages: [USER_MESSAGE],
      taskKind: 'analysis',
      requestId: 'req_abc',
    });
    await provider.complete({
      schema: ResponseSchema,
      messages: [USER_MESSAGE],
      taskKind: 'analysis',
    });

    expect(calls[0]?.request.user).toBe('req_abc');
    expect(Object.hasOwn(calls[1]?.request ?? {}, 'user')).toBe(false);
  });

  it('serialises tool specifications to OpenAI function format', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    const tool: ToolSpec = {
      name: 'fetch_record',
      description: 'Fetch a record by id.',
      parameters: z.object({ id: z.string() }),
    };
    const { client, calls } = makeFakeClient(() => fakeCompletion());
    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });

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
    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });

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
    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });

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
    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });

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
    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });

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
    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });

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

  it('passes an AbortSignal and aborts when timeoutMs elapses', async () => {
    jest.useFakeTimers();
    const ResponseSchema = z.object({ ok: z.boolean() });
    let capturedSignal: AbortSignal | undefined;
    const client: OpenAiClient = {
      chat: {
        completions: {
          create: (_request, options) => {
            capturedSignal = options?.signal;
            return new Promise<OpenAiChatCompletion>((_resolve, reject) => {
              capturedSignal?.addEventListener('abort', () => {
                reject(new Error('aborted'));
              });
            });
          },
        },
      },
    };
    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });

    const pending = provider.complete({
      schema: ResponseSchema,
      messages: [USER_MESSAGE],
      taskKind: 'analysis',
      timeoutMs: 50,
    });
    const assertion = expect(pending).rejects.toThrow(/aborted/);
    jest.advanceTimersByTime(60);
    await assertion;
    expect(capturedSignal?.aborted).toBe(true);
    jest.useRealTimers();
  });

  it('does not arm a timer when timeoutMs is absent', async () => {
    const ResponseSchema = z.object({ ok: z.boolean() });
    let capturedSignal: AbortSignal | undefined;
    const client: OpenAiClient = {
      chat: {
        completions: {
          create: (_request, options) => {
            capturedSignal = options?.signal;
            return Promise.resolve(fakeCompletion());
          },
        },
      },
    };
    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });

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
      id: 'cmpl_empty',
      model: 'gpt-4o-mini',
      choices: [],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }));
    const provider = createOpenAiProvider({ client, model: 'gpt-4o-mini' });

    await expect(
      provider.complete({
        schema: ResponseSchema,
        messages: [USER_MESSAGE],
        taskKind: 'analysis',
      }),
    ).rejects.toThrow(/no choices/);
  });
});
