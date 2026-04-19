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

- author / worker: ships the narrow change
- reviewer / critic: hunts for correctness and risk
- controller / orchestrator: checks scope and sequence
- lifecycle / verifier: confirms the exact head SHA and CI state

These four roles are the **role contract**. The role contract is what
this ADR governs. The specific label strings used to claim a role on a
PR (see "Role contract and v1 label protocol" below) are a separate,
narrower concern.

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
   quorum ceremony happened on the exact current PR head SHA, including
   after role signatures are posted as PR comments.
4. The repository will add future-ready review structure now, even where
   it is inert until a second identity exists.
5. Hardening work will proceed in ranked order, with identity separation
   before stricter merge governance.

## Role contract and v1 label protocol

The four roles above are conceptual. Each role can, in principle, be
claimed by any agreed-upon signal on the PR: a comment prefix, a review
body, a check run, a trailer line. The specific signals the repository
accepts today are a **v1 label protocol** layered on top of that
contract.

### Current v1 labels

| Role (contract)              | Current label prefix on PR issue comments or review bodies | Enforcement today                 |
|------------------------------|------------------------------------------------------------|-----------------------------------|
| author / worker              | `Agent WS1` or `Agent WS2`                                 | Required by `quorum-audit.yml`    |
| reviewer / critic            | `Agent R3`                                                 | Required by `quorum-audit.yml`    |
| controller / orchestrator    | `Agent BOSS`                                               | Required by `quorum-audit.yml`    |
| lifecycle / verifier         | `Agent L1` (intended)                                      | **Not yet enforced** — see TODO in workflow |

The exact regexes live in `.github/workflows/quorum-audit.yml`. The
workflow scans two sources for each PR: the list of PR issue comments,
and the list of PR reviews (excluding reviews in `DISMISSED` state).
The signature formats currently parsed are, for the head SHA of the
PR:

- `Agent WS1 ... <sha>` or `Agent WS2 ... <sha>` (author)
- `Agent R3: no findings on <sha>` or `Agent R3: concur at <sha>` (reviewer)
- `Agent BOSS: concur at <sha>` (controller)

Review-state semantics: reviews in `DISMISSED` state are excluded
entirely. Their bodies are not examined for any role, including
author (`Agent WS1` / `Agent WS2`) attestations that happen to have
been left inside a review body. Issue comments have no dismissal
state, so every issue comment on the PR is considered. To retract an
attestation posted as a review, dismiss that review (or leave a
superseding attestation on the new head SHA).

### What is arbitrary, what is not

- **Arbitrary (conceptually):** the literal strings `WS1`, `WS2`, `R3`,
  `BOSS`, `L1`. They are project-specific names, not load-bearing
  identifiers. A future protocol version could rename them without
  changing the contract.
- **Not arbitrary (operationally):** those exact strings are what
  `quorum-audit.yml` currently grep-parses on PR comments and reviews.
  Until the workflow is updated in lockstep, changing the labels on a
  PR will cause the audit to fail to detect the quorum.

### Changing labels later

Renaming or extending the label protocol is allowed, but it is a
coordinated change:

1. Update `.github/workflows/quorum-audit.yml` regexes.
2. Update this ADR's table.
3. Update the README governance section's glossary.
4. Update any in-flight PR templates or runbooks that cite the old
   labels.
5. Run through one full PR with the new labels before promoting
   `quorum-audit.yml` to a required check.

Until that coordinated change ships, contributors and agents must use
the v1 labels above verbatim.

### Governance roles vs runtime agents

The labels in this section are **governance roles**: they describe who
attests to what on a PR. They are *not* the same as the **runtime
agents** shipped under `packages/` (for example, `@wsa/agent-openai`,
`@wsa/agent-xai`, `@wsa/agent-contracts`). Runtime agents are product
code that calls LLMs to process evidence; governance roles are PR-time
attestations that process discipline happened. The two share the word
"agent" and nothing else.

## Supporting runtime

The repository will support this model with two in-repo artefacts:

- `CODEOWNERS`, to define the future review surface for critical files
- `.github/workflows/quorum-audit.yml`, to verify that author,
  reviewer, and controller signatures exist on the current PR head SHA
  on both PR-synchronize events and later PR discussion events

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
3. `quorum-audit.yml` executes on `pull_request`, PR-review, and
   PR-comment events.
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
- run `quorum-audit.yml` as report-only on PR open/update and on later
  quorum discussion events (issue comments and review submissions)
- publish the report-only `quorum-audit` result against the PR head SHA so
  discussion-triggered verification is visible on the PR surface
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
