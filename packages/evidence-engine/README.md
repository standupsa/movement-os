# @wsa/evidence-engine

Thin orchestration layer for the first real xAI runtime path in
`movement-os`.

## What it does

- accepts already-redacted / already-consented source text plus canonical
  source metadata
- calls a `ModelProvider` in the `analysis` lane
- uses `@wsa/agent-xai` when created through `createXaiEvidenceEngine()`
- converts model output into typed `Claim` and `Evidence` records
- immediately runs `checkEvidencePromotion()` on every extracted claim
- downgrades model-requested `high-confidence` / `conclusive` claims to
  `contested` when the promotion gate blocks them
- returns audit-ready extraction records without pretending the append-only
  audit store already exists

## What it does not do

- no public branding / disclosure surface
- no challenge-lane second provider yet
- no persistence layer yet
- no live publication path

## Building

```sh
pnpm nx run @wsa/evidence-engine:build
```

## Running unit tests

```sh
pnpm nx run @wsa/evidence-engine:test --runInBand
```
