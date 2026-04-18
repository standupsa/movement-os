# `@wsa/email-probe`

Machine-only external-SMTP probe for the Witness South Africa
email-ingress worker. No human inbox, no manual verification, no
reliance on someone opening a mail client.

## What it does

1. **Send** a tagged email via Resend from
   `probe@mail.witnesssouthafrica.org` to
   `hello@witnesssouthafrica.org`. The subject embeds a unique
   `wsa-probe-YYYYMMDD-HHMMSS-<entropy>` run id.
2. **Poll** the `wsa-inbox` R2 bucket for a new object whose
   `subject` custom metadata contains that run id.
3. **Assert** the expected metadata is stamped by the
   `wsa-email-ingress` Worker:
   - `subject` (contains the run id)
   - `spamVerdict`
   - `authVerdict`
4. Exit `0` on a matched object within the poll window, `1` on
   timeout, `2` on missing env, `3` on unhandled exception. The
   result JSON is printed to stdout.

No live network is exercised from the unit test suite. The CLI entry
(`bin/run-probe.ts`) is the only live-path entry and it is gated by
`infisical run` so the Resend and Cloudflare credentials come from
the canonical `/witness-south-africa` folder, not from ad-hoc env.

## Running the live probe

```sh
pnpm -w install
pnpm nx run @wsa/email-probe:build

infisical run \
  --projectId 02498468-7dd8-481a-be49-d6348278e98f \
  --env=prod \
  --path=/witness-south-africa \
  --silent \
  -- pnpm --filter @wsa/email-probe exec node ./dist/bin/run-probe.js
```

Expected output on pass:

```json
{
  "status": "pass",
  "runId": "wsa-probe-20260418-102030-...",
  "send": {
    "id": "re_...",
    "from": "...",
    "to": "...",
    "subject": "...",
    "sentAt": "..."
  },
  "match": {
    "key": "2026-04-18/102031-...-hello.eml",
    "size": 587,
    "customMetadata": {
      "subject": "wsa-probe-20260418-102030-...",
      "spamVerdict": "clean",
      "authVerdict": "pass"
    },
    "elapsedMs": 4120
  }
}
```

## Tunables (env overrides)

| Variable                | Default                             | Purpose                                           |
| ----------------------- | ----------------------------------- | ------------------------------------------------- |
| `WSA_PROBE_FROM`        | `probe@mail.witnesssouthafrica.org` | Sender address (must be a Resend-verified domain) |
| `WSA_PROBE_TO`          | `hello@witnesssouthafrica.org`      | Recipient alias (must route to the Worker)        |
| `WSA_R2_BUCKET`         | `wsa-inbox`                         | R2 bucket the Worker writes to                    |
| `WSA_PROBE_TIMEOUT_MS`  | `120000`                            | Max wait before timeout (2 min default)           |
| `WSA_PROBE_INTERVAL_MS` | `5000`                              | Poll cadence between R2 list calls                |

## Deps policy

Zero runtime dependencies. Uses Node 22's native `fetch` for both
Resend and Cloudflare's REST API. This keeps the probe auditable —
there is no vendor SDK in the trust chain, only the two HTTP
contracts and whatever Node itself ships.

## Layout

```
packages/email-probe/
├── src/
│   ├── index.ts               # public re-exports
│   ├── lib/
│   │   ├── send.ts            # Resend POST /emails
│   │   ├── send.spec.ts
│   │   ├── poll.ts            # CF R2 list + head for matching object
│   │   ├── poll.spec.ts
│   │   ├── probe.ts           # send -> poll -> pass/fail
│   │   └── probe.spec.ts
│   └── bin/
│       └── run-probe.ts       # CLI entry, reads env, prints JSON, exit code
├── jest.config.ts
├── tsconfig.{json,lib,spec}.json
├── .spec.swcrc
├── package.json
└── README.md
```

## Not in this package (by design)

- No automated schedule. This is a manual/on-demand probe today;
  scheduled invocation belongs in a later PR wiring a GitHub Actions
  cron or Cloudflare Scheduled Trigger.
- No metrics emission. Aggregate telemetry is
  [`@wsa/agent-xai`](../agent-xai)'s concern; the probe prints a JSON
  result and exits.
- No xAI or guardrails. The probe is an evidence-path smoke test,
  not a content-analysis pipeline.
