# movement-os

> *In memory of **Leon Eugene Haarhoff** (1973–1993). See [MEMORIAL.md](./MEMORIAL.md).*
> *No family should have to start from zero.*

**Witness South Africa — civic accountability platform.**

`movement-os` is the open-source backbone of the Witness South Africa (WSA)
movement. It is a small, auditable system of AI agents that act as **staff
for the five pillars** of the movement:

- **Cause Council** — keeps the mission and principles locked.
- **Evidence Unit** — ingests, verifies, and stores primary-source material.
- **Media Engine** — drafts posts, letters, briefs, and scripts in the
  movement's voice, always gated by a human approver.
- **Community Network** — onboards coordinators and volunteers.
- **Action Wing** — plans lawful petitions, campaigns, and public briefings.

**The agents are staff. Humans are accountable.** Nothing publishes without
a named, timestamped, signed human approval.

## Mission

> We stand for equal protection, equal dignity, and accountable government
> for every South African — regardless of race, class, or politics.

This sentence is the platform's public API. It is locked: changes are
release-gated by the Cause Council and asserted by every agent at startup
via `@sasa/principles` → `assertPinnedHash()`.

## Principles

1. **Non-racial.** We reject race as a basis for rights, blame, or allocation.
2. **Constitutional.** We operate inside the Bill of Rights. No exceptions.
3. **Non-violent.** Violence ends a human-rights movement. Full stop.
4. **Truth-first.** Every public claim is sourced, dated, and verifiable.
5. **Disciplined.** We argue from evidence, not insult.
6. **Endurance.** We build for years, not news cycles.
7. **Protection.** We shield witnesses, whistleblowers, and vulnerable members.
8. **Family-first.** No member sacrifices their health, safety, or family
   for the cause.

## What this repo is — and is not

**Is:**

- A **civic accountability platform**: evidence intake, source verification,
  drafting of human-approved content, signed audit log.
- **Open source under Apache-2.0.** Fork it, run it, adapt it for your own
  movement.
- **Provider-agnostic.** The default LLM adapter uses the OpenAI Agents SDK
  (MIT); a Claude adapter and a local-inference (Ollama/vLLM) adapter sit
  behind the same `@sasa/agent-contracts` interface.

**Is not:**

- **Not** a persuasion-bot framework. See [`ACCEPTABLE_USE.md`](./ACCEPTABLE_USE.md).
- **Not** an autonomous publisher. Every outbound artefact requires a
  named human approval. No exceptions.
- **Not** a political-party tool. The platform is non-partisan and
  refuses to endorse, attack, or campaign for any party.

## Repo layout

```text
apps/
  api/                # Fastify control plane  (scaffolded later)
  cli/                # operator CLI            (scaffolded later)
packages/
  principles/         # @sasa/principles  — mission + 8 principles (locked)
  schemas/            # @sasa/schemas     — Zod contracts at every boundary
  guardrails/         # @sasa/guardrails  — tone + evidence-promotion gates
  agent-contracts/    # (next) provider-agnostic Agent/Tool/Session interfaces
  agent-openai/       # (next) OpenAI Agents SDK adapter — the default
  agent-anthropic/    # (next) Claude adapter — for parity
  evidence-engine/    # (next) intake → extract → store (Postgres + pgvector)
  drafting-engine/    # (next) post/brief/script drafting
  sources/            # (next) primary-source fetchers
  audit/              # (next) append-only signed event log
workers/
  intake-worker/      # (next) BullMQ consumer
  draft-worker/       # (next) BullMQ consumer
docs/
  architecture/       # ADRs (see 0001-agent-framework.md)
  ops/                # operational runbooks (DNS, Pages, domain setup)
  threat-model/
```

## Getting started

Requires **Node 22+** and **pnpm 9+**.

```sh
pnpm install
pnpm nx run-many -t test
pnpm nx run-many -t build
```

Run a single package:

```sh
pnpm nx run @sasa/guardrails:test --runInBand
pnpm nx run @sasa/principles:build
```

Nx syncs TypeScript project references automatically. If you edit
cross-package imports and see stale references, run:

```sh
pnpm nx sync
```

## Licence

Apache-2.0 — see [`LICENSE`](./LICENSE). Contributions are accepted under
the same licence; see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Governance and conduct

- [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — how we treat each other.
- [`ACCEPTABLE_USE.md`](./ACCEPTABLE_USE.md) — what this software may and
  may not be used for.
- [`SECURITY.md`](./SECURITY.md) — how to report vulnerabilities safely.
- [`POPIA.md`](./POPIA.md) — our commitments around personal information
  under the South African Protection of Personal Information Act.
- [`docs/ops/dns-runbook.md`](./docs/ops/dns-runbook.md) — canonical DNS,
  GitHub Pages, and email-routing setup for `witnesssouthafrica.org`.
- [`docs/ops/infisical/witness-south-africa/README.md`](./docs/ops/infisical/witness-south-africa/README.md)
  — local Infisical CLI layout and Cloudflare secret workflow for the
  `witness-south-africa` domain path.

## Getting help and getting involved

This is v0.1. The repo is deliberately small. If you want to help, start
by reading the ADR in `docs/architecture/`, the acceptable-use policy,
and opening an issue describing what you want to work on.

Endurance over outrage. Build for years.
