# @wsa/agent-xai

xAI (Grok) adapter behind the shared `@wsa/agent-contracts`
`ModelProvider` interface.

## What it does

- sends schema-constrained chat completion requests to xAI's
  OpenAI-compatible endpoint
- validates JSON output against the caller's Zod schema
- normalises token accounting into `TokenUsage`
- exposes optional telemetry/budget controls for append-only usage logs,
  soft-threshold alerts, and preflight hard-cap checks
- collapses leading system prompts into one stable prefix to improve
  prompt-cache hit rate

## Budget env parsing

`readXaiBudgetConfigFromEnv()` reads:

- `XAI_BUDGET_MONTHLY_CAP_USD_TICKS`
- `XAI_BUDGET_SOFT_LIMIT_THRESHOLD_PCT` (defaults to `80`)

It only parses config. Callers still supply the month-to-date meter and
the telemetry / alert sinks at runtime.

## Building

```sh
pnpm nx run @wsa/agent-xai:build
```

## Running unit tests

```sh
pnpm nx run @wsa/agent-xai:test --runInBand
```
