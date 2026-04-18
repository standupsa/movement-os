# ADR-0006: Email ingress runs through a Cloudflare Email Worker, not a human inbox

- Status: accepted
- Date: 2026-04-18
- Deciders: Rudi (founder); pending Cause Council ratification
- Relates to: [ADR-0002](./0002-persistent-pursuit.md), [ADR-0004](./0004-evidence-graph-architecture.md)

## Context

Witness South Africa now has live aliases:

- `hello@witnesssouthafrica.org`
- `support@witnesssouthafrica.org`
- `legal@witnesssouthafrica.org`

They currently forward to a human inbox as a bootstrap. That is operationally
useful but architecturally wrong for the platform's stated posture.

The platform is evidence-first, append-only, and AI-assisted. A human mailbox
as the first landing point for inbound mail creates three problems:

1. **The canonical record starts in a private inbox.** That breaks the "system
   of record is append-only and recoverable" rule from
   [ADR-0004](./0004-evidence-graph-architecture.md).
2. **Ingress depends on a human operator checking mail.** That contradicts the
   desired "AI primitives first" operating model.
3. **Chain of custody starts late.** If an email is opened, moved, or deleted
   before it is preserved, the platform cannot prove what arrived first.

The platform needs an ingress path where the code is the first recipient.

## Decision

Inbound mail will terminate at a **Cloudflare Email Worker** that preserves the
raw message before any human sees it.

The Worker is the canonical ingress path. Human forwarding is a temporary
bootstrap only and must be retired after the Worker is deployed.

## Phase-1 target design

### 1. Transport

Cloudflare Email Routing remains the edge receiver for:

- `hello@witnesssouthafrica.org`
- `support@witnesssouthafrica.org`
- `legal@witnesssouthafrica.org`

Instead of forwarding directly to a person, each alias routes to the Email
Worker.

### 2. Preservation

The Worker writes the full raw MIME message to an R2 bucket:

- bucket: `wsa-inbox`
- object key pattern:
  `incoming/YYYY/MM/DD/<received-at-iso>--<recipient>--<random>.eml`

The Worker also writes a compact metadata sidecar:

- key pattern:
  `incoming/YYYY/MM/DD/<received-at-iso>--<recipient>--<random>.json`

Minimum metadata fields:

- `receivedAt`
- `recipient`
- `sender`
- `subject`
- `messageId`
- `rawSize`
- `headersSha256`
- `rawSha256`
- `storageKey`

The `.eml` object is the evidential artifact. The `.json` object exists for
indexing and operator visibility.

### 3. Failure policy

The Worker must not silently drop mail.

- If R2 write succeeds, accept the message.
- If R2 write fails, reject with a temporary SMTP failure so the sender can
  retry.
- If metadata extraction fails but raw storage succeeds, accept the message and
  emit a degraded-ingest marker in the sidecar.

Durable preservation outranks convenience.

### 4. Notification

Operator notification is optional and secondary.

Phase 1 may send a small notification to a webhook or queue with:

- recipient alias
- sender
- subject
- storage key

The notification is not the system of record. R2 is.

### 5. Human access

Humans do not receive the original email as the primary transport. They access
preserved mail through the platform's retrieval path or an operator tool that
reads from R2.

### 6. Scope limits

Phase 1 ingress does **not**:

- parse attachments into claims
- run extraction models inline on the email event
- publish, classify, or route to the case graph automatically

It only preserves and surfaces inbound mail safely.

## Consequences

### Positive

- The first durable copy is under platform control, not in a personal inbox.
- Chain of custody starts at receipt time.
- Human response can lag without risking loss of the original message.
- The design matches the platform's append-only and persistent-pursuit posture.

### Negative

- A Worker and R2 bucket add another deployable edge component.
- Operators need one more runbook and one more secret scope for Cloudflare
  automation.
- Human-friendly mailbox behavior becomes a derived feature, not the default.

## Temporary exception

Forwarding to a human inbox is allowed only as a bootstrap while the Worker is
not yet deployed. It is not the target architecture and must not be described
as the finished state in docs or ops summaries.

## Rollout

Implementation is split into two narrow follow-ups:

1. **Ops follow-up**
   - enable Workers on the Cloudflare account
   - create the `wsa-inbox` R2 bucket
   - extend the Cloudflare token scope for Workers and R2 deployment
2. **Repo follow-up**
   - add a deployable Worker package
   - add a small operator-facing retrieval/read path for preserved mail

## References

- Cloudflare Email Workers runtime:
  <https://developers.cloudflare.com/email-routing/email-workers/runtime-api/>
- Cloudflare Email Workers enablement:
  <https://developers.cloudflare.com/email-routing/email-workers/enable-email-workers/>
- Cloudflare R2 Workers binding:
  <https://developers.cloudflare.com/r2/api/workers/workers-api-reference/>
