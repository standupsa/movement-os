/**
 * ADR-0003 amendment (2026-04-18) — Grokipedia non-authoritative rule.
 *
 * xAI / Grok outputs are MODEL-GENERATED TEXT, not primary sources. Under
 * ADR-0003 the platform may use xAI in Lane 2 (analysis) and Lane 3
 * (challenge), but MUST NOT treat xAI-produced artefacts as evidence of
 * primary-source type. Specifically, an `Evidence` record whose only
 * source is an xAI output:
 *
 *   - MUST NOT carry `kind` 'court-record' | 'government-publication' |
 *     'statssa' | 'commission'. Those kinds imply a primary / official
 *     source that an LLM cannot generate, only summarise or paraphrase.
 *   - MAY carry `kind` 'news-article' (when citing a news-shaped
 *     aggregation) or 'other' (the honest default). The `note` field
 *     on Evidence SHOULD make the AI-generated nature explicit and
 *     point to the upstream prompt / run id.
 *   - MUST be corroborated by at least one primary-source Evidence
 *     record before the backing `Claim` is promoted to `conclusive`
 *     or `high-confidence` (ADR-0002).
 *
 * These constants are the single source of truth for the rule; the
 * `@wsa/guardrails` package imports them when evaluating promotion.
 * The two lists partition `EvidenceKindSchema` from `@wsa/schemas`
 * exactly — there is no `maybe` bucket. Deliberate: we don't want
 * reviewers picking the ambiguous label to route around the rule.
 *
 * This file intentionally has zero runtime dependencies. Keeping the
 * lists as opaque string arrays (rather than importing `EvidenceKind`
 * from `@wsa/schemas`) avoids pulling a cross-package type dependency
 * into the adapter layer. The disjoint-and-total invariant is checked
 * in `@wsa/guardrails` once both packages meet.
 */

export const XAI_NON_AUTHORITATIVE = true as const;

export const GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS: ReadonlyArray<string> =
  Object.freeze([
    'court-record',
    'government-publication',
    'statssa',
    'commission',
  ]);

export const GROKIPEDIA_ALLOWED_EVIDENCE_KINDS: ReadonlyArray<string> =
  Object.freeze(['news-article', 'other']);

/**
 * Predicate form of the prohibited list. Useful at guardrail boundaries
 * that receive a raw `kind` string from persisted Evidence and want a
 * yes/no answer without carrying the full list around.
 */
export function isGrokipediaProhibitedEvidenceKind(kind: string): boolean {
  return GROKIPEDIA_PROHIBITED_EVIDENCE_KINDS.includes(kind);
}

/**
 * Predicate form of the allowed list. Same rationale as above; used by
 * code paths that explicitly opt-in rather than filter-out.
 */
export function isGrokipediaAllowedEvidenceKind(kind: string): boolean {
  return GROKIPEDIA_ALLOWED_EVIDENCE_KINDS.includes(kind);
}
