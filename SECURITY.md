# Security policy

## Supported versions

`movement-os` is at v0.1. Only the `main` branch is supported while the
project is pre-1.0. Security fixes will be backported to tagged releases
once we start tagging.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately to `security@witnesssouthafrica.org` (to be set up). Include:

1. A description of the vulnerability.
2. The minimum steps to reproduce it.
3. The impact you can demonstrate (e.g., data exposure, privilege
   escalation, ability to bypass the human-approval gate).
4. Any proof-of-concept exploit code (kept confidential).

We will acknowledge your report within 72 hours and aim to provide
a triage assessment within 7 calendar days. We will keep you informed
of our progress and credit you (with your permission) in the fix
announcement.

## What counts as in-scope

- Anything in this repository.
- Bypasses of the human-approval gate or the audit log.
- Any mechanism that causes the platform to publish an artefact without
  a valid `Approval` record.
- Any mechanism that causes `@sasa/principles` hash verification to be
  skipped at agent startup.
- Leakage of witness or whistleblower material.
- Injection or confused-deputy issues in the agent tool layer.
- Supply-chain concerns about pinned dependencies.

## What is out of scope

- Vulnerabilities in upstream dependencies that we cannot mitigate at
  our layer (please report those to the upstream project and notify us
  so we can pin around them).
- Social-engineering attacks against human operators that do not
  involve a flaw in the software itself.
- Denial-of-service attacks on public infrastructure that are already
  mitigated by the hosting provider.

## Secrets and credentials

The public repository MUST NOT contain secrets, tokens, API keys, or
real witness data. If you find one in the history, treat it as
compromised, report it privately, and we will rotate and purge.

## Responsible disclosure

We will work with you in good faith, will not pursue legal action for
research conducted in good faith under this policy, and will publicly
credit researchers who ask to be credited. Please give us a reasonable
window to fix an issue before publishing details.
