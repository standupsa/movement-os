# Agent Cheat Sheet — `movement-os`

Fast operator reference for the repo agent loop.

## Roles

| Label | Canonical role | Job |
| --- | --- | --- |
| `BOSS` | Controller | Name the slice, drive the task, integrate findings |
| `WS1` / `WS2` | Worker | Implement or validate the scoped change |
| `R3` | Reviewer | Independently review the slice |
| `L1` | Lifecycle | Verify repo truth and certify the slice |

## Default rules

- New role -> new conversation
- New slice -> new conversation
- Same role + same slice -> same conversation is acceptable
- Every prompt must name the role
- Every prompt must name the slice

## Safe sequence

1. `BOSS` defines the slice
2. `WS1` implements the slice
3. `R3` reviews the slice
4. `BOSS` responds to findings if needed
5. `L1` certifies the slice

## Scope rules

- Do not ask `WS1` to work on “whatever is dirty”
- Do not ask `R3` to review the whole worktree unless that is the real
  slice
- Do not ask `L1` to certify unrelated dirty files
- If the worktree contains two independent buckets, split them into two
  slices

## When a role should block

`WS1` should block when:

- no slice is named
- the prompt is too vague
- the worktree contains multiple coherent buckets and the intended one
  is not named

`R3` should block when:

- the slice is unclear
- the requested review includes unrelated files

`L1` should block when:

- implementation and docs do not match
- the claimed scope does not match the real worktree
- the role is relying on stale conclusions instead of current files

## One-line definitions

- Slice: the smallest coherent change that can be reviewed and
  certified on its own
- Repo truth: current file contents and actual validation evidence
- Certification: `L1` saying a named slice is ready on its own

## Common mistakes

- Reusing one conversation across multiple roles
- Treating runtime `packages/agent-*` code as the same thing as
  governance roles
- Asking a worker to pick a slice for you
- Certifying a whole dirty worktree when only one slice was reviewed
- Relying on a summary instead of re-reading the files

## Current repo truth

- Canonical roles matter more than labels
- Current v1 labels still matter operationally because
  `quorum-audit.yml` parses them
- `L1` is still a protocol role, not yet an enforced workflow seat
