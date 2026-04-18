# @wsa/agent-contracts

Provider-agnostic contracts for LLM access. Defines the `ModelProvider`
interface every adapter (`@wsa/agent-openai`, `@wsa/agent-xai`, ...) must
satisfy, plus the Zod schemas that keep requests and responses honest.

## What it contains

- `ModelProvider` — the single-function interface adapters implement.
- `CompleteArgs<TSchema>` — narrow, schema-first call arguments.
- `ModelResponse<T>` — normalized provider response including
  `status`, `usage`, `model`, `responseId`, and `rawFinishReason`.
- `LlmProviderIdSchema` — identifier enum (`openai`, `xai`, plus
  `anthropic` and `local` reserved).
- `AgentTaskKindSchema` — the three ADR-0003 routing lanes
  (`sensitive-intake`, `analysis`, `challenge`).
- `AgentMessageSchema` — narrow conversation message (role + content).
- `ToolSpec` + `defineTool` — provider-agnostic tool definition backed
  by a Zod schema.
- `TokenUsageSchema` — input/output/total token counts.
- `createFakeProvider` — in-memory fake for deterministic tests.

## What it deliberately omits

Retry policy, circuit breaking, temperature and top-p knobs, streaming,
background mode. Those belong above the adapter layer, and forcing them
into the core contract early would overfit to one provider's shape.

## Usage

```ts
import { z } from 'zod';
import { createFakeProvider, type ModelProvider } from '@wsa/agent-contracts';

const ExtractionSchema = z.object({
  claims: z.array(z.string()).min(1),
});

const provider: ModelProvider = createFakeProvider({
  produce: (schema) => schema.parse({ claims: ['a', 'b'] }),
});

const response = await provider.complete({
  schema: ExtractionSchema,
  messages: [{ role: 'user', content: 'extract claims' }],
  taskKind: 'analysis',
  maxOutputTokens: 1_000,
});

// response.value is typed as { claims: string[] }.
```

## Building and testing

```sh
pnpm nx run @wsa/agent-contracts:build
pnpm nx run @wsa/agent-contracts:test
pnpm nx run @wsa/agent-contracts:lint --max-warnings=0
```
