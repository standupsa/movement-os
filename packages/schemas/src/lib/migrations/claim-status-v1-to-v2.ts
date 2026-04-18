/**
 * Claim.status migration: V1 ("unverified / verified / contradicted /
 * unverifiable") → V2 (ADR-0002 evidential-completeness vocabulary).
 *
 * Both functions are pure and side-effect free. They are the *only*
 * supported path between the two vocabularies — downstream code that
 * needs to move data must call these, not inline its own mapping.
 *
 * Invariant enforced by the forward map:
 *   `destroyed-or-missing-record-suspected` is NEVER a helper default.
 *   Reaching that status is a deliberate assignment backed by method
 *   evidence. If a legacy record needs that status, the case-engine
 *   layer must assign it explicitly after inspecting MethodAttempt
 *   outcomes — this helper will not put it there.
 *
 * Reverse mapping is lossy (V2 has five values, V1 has four). Reversal
 * exists for rollback and export into V1-aware systems; round-tripping
 * V1 → V2 → V1 is idempotent for the lossy-equivalent bucket.
 */

import { z } from 'zod';

/** Legacy Claim.status vocabulary (pre-ADR-0002). */
export const ClaimStatusV1Schema = z.enum([
  'unverified',
  'verified',
  'contradicted',
  'unverifiable',
]);
export type ClaimStatusV1 = z.infer<typeof ClaimStatusV1Schema>;

/** Current Claim.status vocabulary (per ADR-0002). */
export const ClaimStatusV2Schema = z.enum([
  'conclusive',
  'high-confidence',
  'contested',
  'insufficient-record',
  'destroyed-or-missing-record-suspected',
]);
export type ClaimStatusV2 = z.infer<typeof ClaimStatusV2Schema>;

/**
 * Forward map. `verified` promotes to `high-confidence` (never to
 * `conclusive`); promotion to `conclusive` requires the ADR-0003 challenge
 * lane and is deliberately out of reach for a blind migration.
 *
 * `unverifiable` maps to `insufficient-record` — NOT
 * `destroyed-or-missing-record-suspected`. The stronger status must be
 * assigned deliberately based on method evidence.
 */
const FORWARD: Readonly<Record<ClaimStatusV1, ClaimStatusV2>> = Object.freeze({
  unverified: 'insufficient-record',
  verified: 'high-confidence',
  contradicted: 'contested',
  unverifiable: 'insufficient-record',
});

/**
 * Reverse map. Lossy: V2 `conclusive` and `high-confidence` both fold to
 * V1 `verified`; `destroyed-or-missing-record-suspected` folds to V1
 * `unverifiable` (the closest legacy equivalent).
 */
const REVERSE: Readonly<Record<ClaimStatusV2, ClaimStatusV1>> = Object.freeze({
  conclusive: 'verified',
  'high-confidence': 'verified',
  contested: 'contradicted',
  'insufficient-record': 'unverified',
  'destroyed-or-missing-record-suspected': 'unverifiable',
});

/** Forward migration: V1 → V2. Pure. Total. */
export function migrateClaimStatusV1ToV2(
  old: ClaimStatusV1,
): ClaimStatusV2 {
  return FORWARD[old];
}

/** Reverse migration: V2 → V1. Pure. Total. Lossy by design. */
export function reverseClaimStatusV2ToV1(
  next: ClaimStatusV2,
): ClaimStatusV1 {
  return REVERSE[next];
}

/**
 * Read-only tables exported for tests and documentation generators.
 * Do not mutate.
 */
export const CLAIM_STATUS_FORWARD_MAP: Readonly<
  Record<ClaimStatusV1, ClaimStatusV2>
> = FORWARD;
export const CLAIM_STATUS_REVERSE_MAP: Readonly<
  Record<ClaimStatusV2, ClaimStatusV1>
> = REVERSE;
