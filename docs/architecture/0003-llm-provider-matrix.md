# 0003 — LLM provider matrix: OpenAI + xAI + fallback, behind `ModelProvider`

- Status: accepted
- Date: 2026-04-18
- Supersedes: nothing
- Relates to: [ADR-0001](./0001-agent-framework.md), [ADR-0002](./0002-persistent-pursuit.md)

## Context

ADR-0001 chose the OpenAI Agents SDK as the **default** agent framework,
explicitly wrapped behind an internal `@wsa/agent-contracts` interface
so the platform is never captured by a single vendor. That ADR did not
pick concrete _model providers_. This one does.

Three things force the decision:

1. **Credibility.** A movement built on truth cannot be "ask one model
   and publish." If one provider's model is wrong, confident, and
   alone, the platform will publish its error.
2. **Sovereignty.** South African witness and archival material must not
   default to a single non-SA vendor's servers. The routing must
   distinguish sensitive lanes from analysis lanes.
3. **Operational reality.** Operators will have different API access,
   different budgets, and different legal opinions on cross-border
   transfer. The platform has to make provider choice a config
   decision, not a code change.

## Decision

`movement-os` adopts a **three-lane provider model** behind a single
`ModelProvider` abstraction.

### Providers shipped in v0.1

- `openai` — OpenAI API. Default adapter, already chosen in ADR-0001.
- `xai` — xAI (Grok) API. Added day one. xAI's API is OpenAI-
  compatible via `base_url="https://api.x.ai/v1"`, so the adapter
  is thin. Grok supports tool use, function calling, and schema-
  constrained structured outputs, which matches the platform's
  extraction and drafting workloads.
- `anthropic` — Claude API. Optional second verification lane.
- `local` — placeholder for a local / self-hosted provider
  (e.g. Ollama, vLLM) added in a later ADR. Referenced here so
  routing rules can already name it.

### The three lanes

Every task on the platform is routed into one of three lanes.

**Lane 1 — Sensitive intake lane.**
Unredacted witness intake, raw identifying information, minors'
information, medical information. Default: `local` (when available) or
`openai` with explicit minimisation and zero-retention terms confirmed
by the operator. **Never** send unredacted intake to a provider whose
data-processing terms have not been reviewed and recorded in the
deployment's `POPIA` configuration.

**Lane 2 — Analysis lane.**
Public records, archive indexes, court judgments (SAFLII), gazetted
notices, newspaper extracts, already-redacted or already-consented
material. xAI is allowed here. This is where extraction, clustering,
timeline building, and dossier drafting run.

**Lane 3 — Challenge lane.**
Before a `Claim` can be promoted to `conclusive` or `high-confidence`
(ADR-0002), a **second, different** provider must re-run the
evaluation. The challenge lane exists so no single model gets to
define "truth." Pairing rule: if the analysis lane used `xai`, the
challenge lane defaults to `openai` or `anthropic`, and vice versa.

Final public accusations or case conclusions always require **both**
multi-model agreement and a human `Approval` record.

### The `ModelProvider` interface

Shipped in `@wsa/agent-contracts` (follow-up implementation PR).
Sketch of the contract:

```ts
// @wsa/agent-contracts
export type LlmProviderId = 'openai' | 'xai' | 'anthropic' | 'local';

export interface ModelProvider {
  readonly id: LlmProviderId;
  readonly supportsStructuredOutput: boolean;
  readonly supportsToolCalls: boolean;
  readonly residencyGuarantee: 'zero-retention' | 'standard' | 'unknown';

  complete<TSchema>(args: {
    task: AgentTaskKind;
    messages: AgentMessage[];
    schema?: TSchema; // Zod schema for structured output
    tools?: ToolSpec[];
    traceId: string; // threaded into the audit log
  }): Promise<ModelResponse<TSchema>>;
}

export type AgentTaskKind =
  | 'intakeRedaction'
  | 'claimExtraction'
  | 'contradictionReview'
  | 'dossierDrafting'
  | 'publicationDrafting'
  | 'challenge';
```

### Task-to-provider routing (default)

```ts
// config shipped as a default; operators may override per deployment
export const defaultRouting: Record<AgentTaskKind, LlmProviderId> = {
  intakeRedaction: 'openai', // or 'local' when local adapter ships
  claimExtraction: 'xai',
  contradictionReview: 'openai', // deliberate cross-check vs extraction
  dossierDrafting: 'xai',
  publicationDrafting: 'xai',
  challenge: 'anthropic', // third opinion before promotion
};
```

Routing is runtime config (`config/routing.yaml` + env overrides),
not hard-coded. The deployment's routing choice is logged as an
`AuditEvent` at service start.

### What xAI **does** on this platform

- Structured claim extraction from documents and transcripts.
- Affidavit summarisation (from redacted / consented text only).
- Archive-result triage — ranking probable matches from search results.
- Contradiction highlighting across sources in the case graph.
- Draft timeline building.
- Public-facing thread and dossier drafts (always human-gated before
  publication).

### Runtime controls for xAI

Every production xAI call must be measurable before it is promoted from
credential-only readiness into a live runtime path. PR-11 adds the
required provider-layer controls in `@wsa/agent-xai`:

- append-only telemetry hooks for `model`, `taskKind`, `requestId`,
  token usage, cached prompt tokens, and `costInUsdTicks`
- a hard preflight budget gate that blocks new calls once the recorded
  month-to-date spend reaches the configured cap
- a soft-threshold alert when a successful call pushes projected spend
  across the configured warning percentage
- cache-aware request shaping by collapsing leading system prompts into
  one stable prefix so xAI's prompt caching can actually work

These controls are deliberately provider-layer primitives, not
front-page branding. Public Grok/xAI attribution remains false until a
real production runtime path consumes these controls.

### What xAI **does not do alone** on this platform

- Make final guilt findings.
- Decide identity matches without human review.
- Publish unreviewed allegations.
- Hold the only copy of any sensitive artefact.

These constraints are enforced by the `@wsa/guardrails` rules and by
the `Approval` gate in `@wsa/schemas`. The guardrails will reject any
task whose output would be published without a matching `Approval` and
whose provenance records only one provider.

## Data handling

xAI's published enterprise terms (SOC 2 Type 2, GDPR, CCPA, zero-
retention options, data-processor DPA) are sufficient for **Lane 2**
use in a typical WSA deployment. They are **not** sufficient on their
own for **Lane 1**; Lane 1 requires a POPIA-specific assessment per
deployment. The same principle applies to OpenAI and Anthropic —
provider terms do not substitute for the operator's POPIA
responsibility. See [`POPIA.md`](../../POPIA.md).

## Consequences

**Positive.**

- No single-vendor capture. The OSS project can be run against any
  combination of providers an operator chooses.
- Built-in second opinion before any public claim is promoted.
- Matches ADR-0002's "maximum evidential completeness" doctrine —
  challenge lane is the operational mechanism for it.

**Negative / costs.**

- Two adapters to maintain from day one, three when `anthropic` is
  wired in, four when `local` is.
- Small extra latency and cost per promotion (challenge lane).
- Operators must make a routing decision rather than get a defaults-
  only experience. Mitigated by shipping a sensible default routing.

## Rollout

Implementation-only, in a follow-up PR, split into small commits:

1. `@wsa/agent-contracts` — `ModelProvider` interface, `AgentTaskKind`,
   `ModelResponse<T>`.
2. `@wsa/agent-openai` — OpenAI adapter (reference).
3. `@wsa/agent-xai` — xAI adapter (thin wrapper, `baseURL
https://api.x.ai/v1`).
4. `@wsa/agent-anthropic` — Claude adapter (parity).
5. Routing config loader + audit-log integration.
6. Guardrails rule: promotion to `conclusive` / `high-confidence`
   requires provenance from two distinct providers. Landed in
   ADR-0005 / `@wsa/guardrails`.

## References

- xAI API — OpenAI / Anthropic SDK compatibility and
  `base_url` quickstart.
- xAI — function calling, structured outputs, reasoning features.
- xAI Enterprise — SOC 2 Type 2, GDPR, CCPA, zero-retention
  configurations, DPA.
- OpenAI Agents SDK — provider adapter surface is the correct
  extension point for mixed-provider stacks.
- ADR-0001, ADR-0002, [`POPIA.md`](../../POPIA.md),
  [`ACCEPTABLE_USE.md`](../../ACCEPTABLE_USE.md).

## Amendment — 2026-04-18: Grokipedia non-authoritative rule

### Context

Since ADR-0003 landed, a product pattern has emerged in which xAI's
Grok line is used to surface background facts (the informal
"Grokipedia" mode — the model answering general-knowledge questions
from its training and browsing rather than from an operator-supplied
primary source). On an evidence platform built for truth-and-record,
this pattern is a hazard: an LLM's general-knowledge answer is
**model-generated text**, not a primary source, regardless of how
confident the prose sounds.

### Rule

Any Evidence record whose only source is an xAI output (Grokipedia-
style or otherwise):

1. MUST NOT carry `kind` in
   `{'court-record', 'government-publication', 'statssa', 'commission'}`.
   Those kinds imply a primary / official provenance an LLM cannot
   emit; only summarise or paraphrase.
2. MAY carry `kind` in `{'news-article', 'other'}`. The `news-article`
   kind is permitted only when the xAI output is itself a pointer to a
   named, fetchable article that the platform will retrieve and hash;
   otherwise use `other`. The `note` field on Evidence SHOULD make the
   AI-generated nature explicit and reference the upstream prompt / run
   id.
3. MUST be corroborated by at least one primary-source Evidence
   record — that is, a non-xai Evidence of a primary-source `kind`,
   with its own `url` + `sha256` binding — before the backing `Claim`
   is promoted to `conclusive` or `high-confidence` (ADR-0002).

The challenge-lane rule from the original decision still applies:
promotion continues to require a second opinion from a different
provider. The Grokipedia rule stacks on top — second-opinion alone
does not satisfy primary-source corroboration.

### Enforcement

The rule is reified in `@wsa/agent-xai`:

- `XAI_NON_AUTHORITATIVE = true`
- `GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS = ['court-record',
'government-publication', 'statssa', 'commission']`
- `GROKIPEDIA_ALLOWED_EVIDENCE_KINDS = ['news-article', 'other']`

These two lists partition `EvidenceKindSchema` from `@wsa/schemas`
exactly — no `maybe` bucket. The invariants (frozen, disjoint,
total) are covered by `xai-policy.spec.ts` at the adapter layer and
are re-checked by `@wsa/guardrails` against `EvidenceKindSchema`.

### Consequences

**Positive.**

- Closes the "Grok said it, so it must be true" failure mode before
  it can reach a published Claim.
- Gives operators a mechanical, testable filter rather than a policy
  they'd have to remember.

**Negative.**

- Operators cannot short-cut primary-source retrieval by quoting
  Grokipedia. That is the intent.
- Legitimate news-article-shaped xAI outputs need a small extra step
  (fetch + hash the real article) before they become evidence. That
  step is already required by the ADR-0004 evidence pipeline, so the
  cost here is zero over the baseline.
