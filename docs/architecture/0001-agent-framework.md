# ADR-0001: Agent framework choice

- **Status:** Accepted
- **Date:** 2026-04-18
- **Deciders:** Rudi (founder); pending Cause Council ratification.
- **Supersedes:** —
- **Superseded by:** —

## Context

Witness South Africa (WSA) is building an open-source civic accountability
platform in which AI agents act as staff for the five pillars of the movement:
Cause Council, Evidence Unit, Media Engine, Community Network, Action Wing.
The platform must:

1. Be **cleanly open source** under the OSI definition. No source-available,
   fair-code, or custom-licence dependencies in the core.
2. Be **provider-agnostic** at the LLM layer. The movement's credibility
   cannot depend on any single vendor remaining available, affordable, or
   aligned with our mission.
3. Keep a **human-in-the-loop** for every outbound artefact. No agent
   publishes autonomously.
4. Produce a **signed, append-only audit log** of every agent action.
5. Remain **small enough for a few volunteers to maintain** — not a platform
   team.
6. Run cleanly on **Node 22, TypeScript strict, Nx 21+, pnpm** per the
   project-wide conventions.

## Options considered

### Option A: OpenAI Agents SDK for TypeScript (chosen default)

- Licence: **MIT** (`openai/openai-agents-js`).
- Provider-agnostic by design; Anthropic, local (Ollama/vLLM), and other
  OpenAI-API-compatible backends plug in behind a common interface.
- First-class support for tool use, handoffs, guardrails, tracing, and
  human-in-the-loop. Matches the shapes we need.
- Small, idiomatic TypeScript; no heavy runtime.

### Option B: LangGraph (JS/TS)

- Licence: **MIT** (`langchain-ai/langgraph`).
- Strong on durable execution and graph-shaped workflows.
- Larger footprint; pulls in much of the LangChain ecosystem by gravity.
- Better fit if/when we need explicit graph checkpointing; today we do not.

### Option C: Claude Agent SDK (TypeScript)

- Licence: MIT, but vendor-owned and vendor-shaped.
- Excellent quality; tight coupling to Anthropic tooling.
- Conflicts with the provider-agnostic requirement unless wrapped —
  and wrapping it is identical effort to wrapping OpenAI Agents SDK.

### Option D: n8n or similar self-hosted automation platform

- **Rejected.** n8n is distributed under the Sustainable Use Licence
  plus an Enterprise Licence; it is source-available, not OSI open source.
  Using it in the core would contradict our "cleanly open source" goal.

## Decision

Adopt **OpenAI Agents SDK for TypeScript** (Option A) as the **default
adapter**, wrapped behind an internal `@wsa/agent-contracts` interface.
The movement's own agent definitions, tool schemas, and guardrails live
in that internal interface; swapping to LangGraph or to a fully
self-hosted inference stack (vLLM/Ollama) is a per-adapter change, not
a platform rewrite.

## Consequences

### Positive

- Permissive MIT licence across the chosen framework, our own code, and
  the core dependencies (Node, TypeScript, Zod, BullMQ, Postgres, Redis).
- One small, auditable wrapper (`@wsa/agent-contracts`) is the only
  place the platform depends on provider-specific shapes.
- Human-in-the-loop and tracing are first-class features, not bolt-ons.
- Contributors from adjacent communities (journalists, NGOs, other
  movements) can fork and reuse without licence friction.

### Negative

- We take on the cost of maintaining an abstraction layer that always
  lags slightly behind the framework's latest features. Acceptable
  — the layer is small and stable by design.
- Default inference goes through hosted model APIs, so operators must
  fund model calls in ZAR. Mitigated by (a) per-agent monthly budgets,
  (b) an `agent-ollama` adapter for on-prem operation, (c) cache-aware
  tracing to avoid redundant calls.

### Neutral

- We do not adopt LangGraph today but leave the door open: a second
  adapter can be added when (not if) we need durable graph execution.

## Rollback

Reverting this ADR means removing `@wsa/agent-openai` and picking a
different primary adapter. Because every agent in the repo depends only
on `@wsa/agent-contracts`, the blast radius is the adapter package plus
its tests. No agent definitions, tools, or schemas need to change.

## Validation

- `pnpm nx run-many -t test --projects=tag:adapter` must pass for every
  adapter shipped. The CI enforces parity: if `agent-openai` exposes a
  capability, `agent-anthropic` must expose the same capability or
  explicitly mark it as unsupported in its capability manifest.
- No package under `packages/` or `apps/` may import a
  provider-specific SDK directly. A repo-level ESLint rule enforces
  this.

## References

- OpenAI Agents SDK (JS/TS): <https://github.com/openai/openai-agents-js>
- LangGraph: <https://github.com/langchain-ai/langgraph>
- Open Source Definition: <https://opensource.org/osd>
- n8n licensing note:
  <https://docs.n8n.io/sustainable-use-license/>
