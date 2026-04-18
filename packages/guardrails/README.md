# @sasa/guardrails

Deterministic policy gates for publication and promotion decisions.

Current surfaces:

- `checkTone(text)` — outbound rhetoric gate for artefacts
- `checkEvidencePromotion(input)` — evidence-promotion gate for claim status
  decisions (`high-confidence`, `conclusive`, and
  `destroyed-or-missing-record-suspected`)

## Building

Run `nx build guardrails` to build the library.

## Running unit tests

Run `nx test guardrails` to execute the unit tests via [Jest](https://jestjs.io).
