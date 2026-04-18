# `@wsa/email-ingress-worker`

Cloudflare Email Worker that preserves every inbound message to
`witnesssouthafrica.org` aliases in the R2 bucket `wsa-inbox` as raw
RFC 822 MIME, per [ADR-0006](../../docs/architecture/0006-email-worker-ingress.md).

## What it does

1. Receives a `ForwardableEmailMessage` for `hello@`, `support@`, or
   `legal@ witnesssouthafrica.org` (wiring done in Cloudflare Email
   Routing; this package does not manage the routing rules).
2. Generates an R2 key of the form
   `YYYY-MM-DD/HHMMSS-<uuid>-<alias>.eml`.
3. Writes the raw MIME bytes to R2 with canonical custom metadata
   (`from`, `to`, `messageId`, `subject`, `received`).
4. Returns silently. Senders receive 250 OK from Cloudflare's Email
   Routing layer; the Worker does not forward onward.

The Worker is the **first recipient** of inbound mail, satisfying the
"canonical record starts in the system of record, not in a private
inbox" requirement from ADR-0006.

## Layout

```
packages/email-ingress-worker/
├── src/
│   ├── index.ts          # Worker entry (email handler)
│   └── lib/
│       ├── key.ts        # R2 key generator
│       ├── key.spec.ts
│       ├── ingest.ts     # message -> R2 persistence
│       └── ingest.spec.ts
├── wrangler.toml         # Cloudflare deploy config (bindings, etc.)
├── jest.config.ts        # SWC-Jest, ESM-safe
├── tsconfig.{json,lib.json,spec.json}
└── README.md
```

`ingest` and `generateKey` are exercised by direct unit tests with
structural fakes — no Miniflare or Worker runtime needed for the test
suite.

## Building and testing

```sh
pnpm nx run @wsa/email-ingress-worker:test      # jest, runInBand
pnpm nx run @wsa/email-ingress-worker:typecheck # tsc --noEmit
pnpm nx run @wsa/email-ingress-worker:build     # tsc --build
pnpm nx run @wsa/email-ingress-worker:lint      # eslint
```

## Deploying

Deployment happens via Wrangler, authenticated against the
Infisical-stored Cloudflare token (path `/witness-south-africa`,
env `prod`):

```sh
infisical run --env=prod --path=/witness-south-africa --silent -- \
  pnpm --filter @wsa/email-ingress-worker exec wrangler deploy
```

After the first deploy the three Email Routing rules
(`hello@`, `support@`, `legal@`) need to be cut over from their
current human-inbox forwarding targets to the Worker. That cutover is
an API call to `PUT /zones/:zone/email/routing/rules/:rule` and is
tracked in the runbook at
[`docs/ops/email-worker-runbook.md`](../../docs/ops/email-worker-runbook.md).

## Verification

After cutover, send a probe email to any of the three aliases and
check R2:

```sh
infisical run --env=prod --path=/witness-south-africa --silent -- \
  bash -c 'curl -s "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/wsa-inbox/objects" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq ".result.objects[-5:]"'
```

A new `YYYY-MM-DD/HHMMSS-<uuid>-<alias>.eml` object should appear
within seconds of the send.
