/**
 * @wsa/schemas — compatibility barrel.
 *
 * The original monolith was split into per-entity files under `./`. This
 * barrel re-exports everything so existing `import { ... } from
 * '@wsa/schemas'` callers keep working unchanged.
 *
 * For new code, prefer importing the specific file directly:
 *   import { IntakeSchema } from '@wsa/schemas/intake.js';
 */

export * from './ids.js';
export * from './common.js';
export * from './intake.js';
export * from './claim.js';
export * from './evidence.js';
export * from './artefact.js';
export * from './approval.js';
export * from './audit.js';

// Persistent-pursuit entities (ADR-0002).
export * from './case.js';
export * from './question.js';
export * from './method-attempt.js';
export * from './human-lead.js';
export * from './consent.js';
export * from './chain-of-custody.js';

// Claim.status V1 → V2 migration helpers (ADR-0002 vocabulary).
export * from './migrations/claim-status-v1-to-v2.js';

// Claim shape V2 → V3 migration helpers (ADR-0004 bi-temporal).
export * from './migrations/claim-v2-to-v3.js';

// Shared test fixtures (deterministic ULIDs). Safe in production builds —
// no side effects, no I/O.
export * from './test-fixtures.js';
