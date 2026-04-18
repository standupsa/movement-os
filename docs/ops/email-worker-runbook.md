# Email Worker Runbook — `witnesssouthafrica.org`

Runbook for replacing the current human-inbox bootstrap with a Cloudflare Email
Worker that preserves inbound mail in R2.

## Current state

Live today:

- Cloudflare Email Routing is enabled
- `hello@`, `support@`, and `legal@` route to the Cloudflare Email Worker
- the Worker stores raw MIME in `wsa-inbox`
- each `.eml` object carries deterministic auth/triage metadata

Target state:

- downstream consumers rely on object metadata (`spamVerdict`, `authVerdict`,
  `spfVerdict`, `dkimVerdict`, `dmarcVerdict`, `headerAnomalies`) before any
  xAI-backed processing
- human access remains a downstream retrieval concern, not the primary ingress

See [ADR-0006](../architecture/0006-email-worker-ingress.md) for the design
decision.

## Preconditions

- Domain and DNS are already live
- GitHub Pages and org verification are already complete
- Cloudflare Email Routing is active for `witnesssouthafrica.org`
- Cloudflare token can already manage DNS and Email Routing

## Additional Cloudflare prerequisites

Before implementation, enable:

1. **Workers & Pages** on the Cloudflare account
2. **R2** on the Cloudflare account
3. an R2 bucket named `wsa-inbox`

The Cloudflare token also needs these extra permissions:

- `Account / Workers Scripts: Edit`
- `Account / Workers R2 Storage: Edit`

## Deployment shape

The eventual Worker deployment must include:

- one Email Worker script
- one R2 binding named `INBOX`
- routing rules for:
  - `hello@witnesssouthafrica.org`
  - `support@witnesssouthafrica.org`
  - `legal@witnesssouthafrica.org`

## Acceptance checks

The Email Worker ingress lane is complete only when all of these are true:

1. a test email to each alias is accepted
2. each test email produces one `.eml` object in `wsa-inbox`
3. each `.eml` object includes custom metadata with auth and spam verdicts
4. the human bootstrap inbox no longer receives the primary copy
5. a forced storage failure produces a temporary SMTP rejection instead of a
   silent drop

## Operational notes

- Do not delete the current forwarding rules until the Worker path is verified
  end-to-end.
- Do not claim the human inbox is retired until test mail proves R2 capture for
  all three aliases.
- Keep the spam/triage stage deterministic and auditable. Do not spend xAI
  tokens on inbound mail until a later lane explicitly wires a downstream
  consumer to `spamVerdict=clean`.
