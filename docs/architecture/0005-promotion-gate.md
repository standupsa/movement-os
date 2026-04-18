# 0005 — Evidence promotion gate: promotable statuses require active evidence, provider independence, and primary-source honesty

- Status: accepted
- Date: 2026-04-18
- Relates to: [ADR-0002](./0002-persistent-pursuit.md), [ADR-0003](./0003-llm-provider-matrix.md), [ADR-0004](./0004-evidence-graph-architecture.md)

## Context

ADR-0002 defines the evidential-completeness vocabulary. ADR-0003 defines the
provider posture and the Grokipedia non-authoritative rule. ADR-0004 defines
the append-only evidence graph and bi-temporal provenance. Until now, those
three decisions described promotion policy in prose only. `@sasa/guardrails`
enforced tone, but not the pre-publication evidence gate that decides whether a
claim is even eligible to sit at `high-confidence` or `conclusive`.

That gap is operationally unsafe. A platform can write careful ADR text and
still accidentally:

- count superseded or expired evidence toward a promotion decision
- treat xAI-generated text as if it were a court record or official publication
- mark a claim `conclusive` without an active primary-source record
- ignore live contradiction and still publish a one-sided status
- label a claim `destroyed-or-missing-record-suspected` without recording why

The gate has to be deterministic, cheap, and auditable. It must run on the
typed evidence bundle already in hand. It does not replace human review; it
prevents obviously invalid promotion states from reaching it.

## Decision

`@sasa/guardrails` gains an evidence-promotion gate in
`packages/guardrails/src/lib/evidence-gate.ts`.

The gate evaluates a `Claim` together with a sidecar
`EvidenceWithProvenance[]` input. The sidecar model deliberately lives in
guardrails rather than `@sasa/schemas`: evidence-schema changes would be too
heavy for a v1 policy gate, while provider provenance is operational metadata
about how the evidence bundle was assembled.

## Rules

The gate emits six rule outcomes:

- `R1` block — xAI-only model output must not claim a primary-source evidence
  kind (`court-record`, `government-publication`, `statssa`, `commission`).
- `R2` block — if xAI-only model-output evidence supports promotion to
  `high-confidence` or `conclusive`, at least one non-xai primary-source
  evidence record must corroborate it.
- `R3` block — `high-confidence` and `conclusive` require supporting-evidence
  provenance from at least two distinct providers.
- `R4` block — `conclusive` requires at least one active supporting
  primary-source evidence record.
- `R5` block — `high-confidence` and `conclusive` are invalid while active
  contradicting evidence exists.
- `R6` warn — `destroyed-or-missing-record-suspected` should carry at least one
  active supporting evidence note explaining the missing-record basis.

The gate also filters the candidate evidence set before evaluating those rules:

- evidence with `supersededBy` is ignored
- evidence whose `validFrom` is in the future is ignored
- evidence whose `validTo` is in the past is ignored

## Independence model

Provider independence at v1 is intentionally narrow:

- it is measured as distinct provider identifiers on the active supporting
  evidence bundle
- it is not a claim about editorial independence, witness independence, or
  institutional independence

This is a practical floor, not a complete theory of trust. Real evidentiary
independence remains a human judgement. The gate is only responsible for
rejecting obviously under-diversified model provenance when a promotable status
is requested.

## Consequences

Positive:

- Promotion policy now exists in code, not just ADR prose.
- The Grokipedia rule is enforced at the guardrail boundary where promotion
  decisions happen.
- `destroyed-or-missing-record-suspected` becomes a better documented finding
  because the gate warns when the supporting note is missing.

Negative:

- The sidecar provenance model means callers must provide provider IDs
  explicitly when they want promotable statuses to pass the gate.
- v1 provider independence is a coarse signal. It catches "only one model ever
  looked at this" but it does not prove source independence.

## Rollout

1. Add `evidence-gate.ts` and exhaustive unit tests in `@sasa/guardrails`.
2. Wire `@sasa/schemas` and `@sasa/agent-xai` as guardrails dependencies.
3. Re-export the gate from the package barrel.
4. Keep the tone gate unchanged.
