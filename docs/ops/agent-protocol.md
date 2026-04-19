# Agent Protocol — `movement-os`

Operator-facing protocol for running role-based AI work inside this
repository.

This document is about **governance-time agent work on the repo**. It
is not about the runtime packages under `packages/agent-*`.

See also:

- [ADR-0008](../architecture/0008-operational-security-model.md)
- [Agent Cheat Sheet](./agent-cheat-sheet.md)
- [Agent Prompt Pack](./agent-prompts.md)

## Purpose

The goal is to make AI-assisted repo work:

- slice-based rather than vague
- independently reviewable
- certifiable against current repo truth
- readable by humans after the fact

The protocol is designed for a repo that currently has procedural
separation of roles, not technical separation of identities.

## Role model

Canonical roles:

| Canonical role | Current v1 label | Responsibility |
| --- | --- | --- |
| Controller | `BOSS` | Defines the slice, drives the task, integrates findings |
| Worker | `WS1` or `WS2` | Implements or validates the scoped change |
| Reviewer | `R3` | Independently reviews the slice for bugs, regressions, and ambiguity |
| Lifecycle | `L1` | Verifies the slice against current repo truth and validation evidence |

Important:

- The canonical roles are the durable concept.
- The current labels are the repo's v1 protocol labels.
- Today, `.github/workflows/quorum-audit.yml` still parses the current
  v1 labels verbatim.

## Core rules

1. Every run must name the role.
2. Every run must name the slice.
3. Different roles use different conversations.
4. Different slices use different conversations.
5. A role must verify current files, not rely on summaries.
6. `L1` certifies a slice, not an entire dirty worktree.

## Slice definition

A **slice** is the smallest coherent change that can be:

- described clearly
- validated narrowly
- reviewed independently
- committed without dragging unrelated files with it

Good slices:

- one workflow + the docs that explain it
- one package fix across a uniform set of files
- one ADR clarification

Bad slices:

- “whatever is dirty”
- unrelated docs plus code plus workflow churn
- a mixed worktree with no named boundary

## Conversation rules

Default rule:

- new role -> new conversation
- new slice -> new conversation

Reuse the same conversation only when:

- it is the same role
- on the same slice
- continuing the same job

Examples:

- `BOSS` responding to `R3` findings on the same slice -> same `BOSS`
  conversation is acceptable
- `WS1` moving from a governance slice to a Jest slice -> new
  conversation
- `L1` re-checking the same slice after a wording fix -> same `L1`
  conversation is acceptable, but it must refresh from current files

## Standard loop

### 1. BOSS

`BOSS`:

- inspects the repo and current worktree
- names the slice
- states the task boundary
- decides whether work should proceed

### 2. WS1

`WS1`:

- works only on the named slice
- refuses to guess when scope is ambiguous
- makes the smallest correct change
- runs the narrowest sensible validation

### 3. R3

`R3`:

- reviews only the named slice
- looks for bugs, regressions, ambiguity, and operator failure modes
- does not widen scope casually

### 4. BOSS follow-up

If `R3` finds issues, `BOSS`:

- addresses the findings
- narrows or clarifies scope if needed
- states what changed and what did not

### 5. L1

`L1`:

- verifies current file truth for the slice
- checks whether the implementation, docs, and validation line up
- certifies the slice or rejects it with exact reasons

## Mixed dirty worktrees

Dirty worktrees are allowed. What is not allowed is pretending a mixed
worktree is one slice when it is not.

If the tree contains multiple coherent buckets:

- name the intended bucket explicitly
- leave unrelated buckets alone
- commit slices separately
- run separate `WS1 -> R3 -> BOSS -> L1` loops for each slice

## What each role must output

`BOSS` should output:

- scope
- plan
- edits or decision
- validation
- summary

`WS1` should output:

- scope
- plan
- implementation
- validation
- handoff

`R3` should output:

- findings first
- file references
- `no findings` if none
- residual risk

`L1` should output:

- `ready` / `not ready`
- exact reasons
- files inspected
- validation reviewed
- residual risk

## Certification boundary

`L1` certifies only what was actually verified.

That means:

- if unrelated files are dirty, they are out of scope unless explicitly
  included
- if a role relied on stale conclusions, `L1` can reject and require a
  refresh from current files
- if the slice is good but the worktree is broader, certify the slice
  only

## Current repo-specific notes

- Governance roles are distinct from runtime `packages/agent-*` code.
- `quorum-audit.yml` is currently report-only.
- `Agent L1` remains unenforced in automation today.
- The current repo still has only one write-capable GitHub identity, so
  this protocol improves discipline and auditability, not technical
  separation of powers.
