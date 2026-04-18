# 0008 — Operational security model

- Status: accepted
- Date: 2026-04-18
- Relates to: [ADR-0001](./0001-agent-framework.md),
  [ADR-0007](./0007-extract-api-surface.md)

## Context

Witness South Africa is currently a single-human project.

Today, only `rhaarhoff` has write access to the repository. The required
checks on `main` protect build quality, but GitHub does not currently
enforce separation between author, reviewer, controller, and lifecycle
roles. In practice, all agent actions that use GitHub credentials appear
as the same GitHub identity.

That means the operating model has an honest split:

- the four-role quorum is valuable
- the four-role quorum is not, by itself, an access-control boundary

The quorum already catches real bugs by forcing separate lenses on the
same work:

- author: ships the narrow change
- reviewer: hunts for correctness and risk
- controller: checks scope and sequence
- lifecycle: confirms the exact head SHA and CI state

This creates a durable audit trail and improves decision quality, but it
does not prevent a unilateral merge by the single write-capable human.

The project needs that distinction written down explicitly so the
security posture stays honest as automation grows.

## Decision

Witness South Africa adopts the following operational security model:

1. The current four-role quorum is defined as **cognitive scaffolding,
   audit trail, and bug-catching discipline**.
2. The current four-role quorum is **not** defined as a permission
   boundary.
3. The repository will add lightweight automation that verifies the
   quorum ceremony happened on the exact current PR head SHA.
4. The repository will add future-ready review structure now, even where
   it is inert until a second identity exists.
5. Hardening work will proceed in ranked order, with identity separation
   before stricter merge governance.

## Supporting runtime

The repository will support this model with two in-repo artefacts:

- `CODEOWNERS`, to define the future review surface for critical files
- `.github/workflows/quorum-audit.yml`, to verify that author,
  reviewer, and controller signatures exist on the current PR head SHA

On v1, `quorum-audit.yml` is report-only. It proves the ceremony is
happening without yet becoming a required status check. Promotion to a
required check is a later hardening step after two clean runs on
separate PRs.

## Ranked hardening plan

The hardening order is:

1. Separate Cloudflare deploy identity from GitHub push identity.
2. Introduce a scoped CI automation identity using a GitHub App instead
   of a broad personal token.
3. Promote `quorum-audit.yml` to a required status check after two clean
   runs.
4. Add CODEOWNERS-required review once a second write-capable
   collaborator exists.
5. Tighten branch protection further by restricting merge methods to
   squash-only and requiring linear history.

This order is deliberate:

- deploy identity separation reduces live-system blast radius first
- scoped automation reduces credential blast radius second
- workflow-enforced ceremony comes before social review enforcement
- required approvals only become honest once a second real identity
  exists

## Acceptance proofs

This ADR is considered landed when all of the following are true:

1. A PR can show parseable author, reviewer, and controller role
   signatures on the exact current head SHA.
2. `CODEOWNERS` exists in the repository root.
3. `quorum-audit.yml` executes on `pull_request` events.
4. A tracking issue exists for the ranked hardening plan.

## Non-goals

This ADR does not:

- add a second human collaborator
- enforce required approvals today
- implement deploy-token separation
- change branch-protection rules directly
- change application runtime code

## Rollout

Rollout happens in two phases:

### Phase 1: report-only

- add `CODEOWNERS`
- add `quorum-audit.yml`
- run `quorum-audit.yml` as report-only
- observe two clean PR runs

### Phase 2: enforced

- promote `quorum-audit.yml` to a required status check
- keep required approvals deferred until a second collaborator exists

## Consequences

### Positive

- the project stops pretending process discipline is the same thing as
  repository access control
- quorum evidence becomes machine-verifiable at the PR head SHA
- future hardening has an explicit order instead of ad hoc debate

### Negative

- the workflow can prove ceremony happened, but cannot prove the human
  behind every role was different
- `CODEOWNERS` is mostly future-facing until a second identity exists
- the model introduces one more workflow to maintain

## References

- [ADR-0001](./0001-agent-framework.md)
- [ADR-0007](./0007-extract-api-surface.md)
