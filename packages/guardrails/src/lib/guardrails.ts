/**
 * @sasa/guardrails — the tone-gate.
 *
 * Every outbound artefact (post, letter, brief, script) runs through
 * checkTone() before it can be approved. The gate is deliberately
 * rule-based at v0.1: deterministic, auditable, and cheap. An LLM-backed
 * gate can be added later as a *second* check — not a replacement.
 *
 * Principle enforcement (see @sasa/principles):
 *   - "disciplined": no slurs, no dehumanising language.
 *   - "non-violent": no incitement, no calls to violence, no martyr framing.
 *   - "non-racial": no race-essentialist framing of blame or rights.
 *   - "truth-first": flag unsourced absolute claims (e.g. "always", "all X").
 *
 * The rules here are intentionally conservative and will over-flag.
 * That is the correct failure mode for a pre-publication gate.
 */

import { PRINCIPLES, type PrincipleId } from '@sasa/principles';

export interface Violation {
  readonly principle: PrincipleId;
  readonly rule: string;
  readonly excerpt: string;
  readonly severity: 'warn' | 'block';
}

export interface ToneCheckResult {
  readonly ok: boolean;
  readonly violations: ReadonlyArray<Violation>;
}

/**
 * Phrases that call for or celebrate political violence. Any hit blocks.
 * Kept deliberately minimal and obvious; extend only with care and evidence.
 */
const INCITEMENT_PATTERNS: ReadonlyArray<RegExp> = [
  /\bkill (?:them|him|her|the \w+)\b/i,
  /\bburn (?:down|it down|them down)\b/i,
  /\bhang (?:them|him|her)\b/i,
  /\btake up arms\b/i,
  /\beliminate the \w+\b/i,
  /\bby any means necessary\b/i,
];

/**
 * Dehumanising or slur-adjacent framings. Block on hit.
 * We intentionally do not list explicit slurs in source; the regexes target
 * structural dehumanisation ("X are vermin", "X are animals", etc.).
 */
const DEHUMANISING_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:they|those people) are (?:animals|vermin|parasites|scum|pigs)\b/i,
  /\b(?:sub-?human|not (?:really )?people)\b/i,
];

/**
 * Race-essentialist framings. These warn rather than block — context matters,
 * and descriptive statements about demographics are sometimes necessary.
 * A human approver must review any warning.
 */
const RACE_ESSENTIALIST_PATTERNS: ReadonlyArray<RegExp> = [
  /\ball (?:white|black|indian|coloured|asian) (?:people|south africans) (?:are|have|must)\b/i,
  /\b(?:white|black|indian|coloured|asian) (?:people|south africans) (?:always|never)\b/i,
];

/**
 * Martyr framing contradicts the endurance + family-first principles.
 * Warn — do not block — because it can appear in a critical quote.
 */
const MARTYR_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:die|dying|dead) for the cause\b/i,
  /\bwilling to die\b/i,
  /\blive or die, (?:our|my) children\b/i,
];

/**
 * Truth-first: unsourced universal claims. Warn.
 */
const UNSOURCED_UNIVERSAL_PATTERNS: ReadonlyArray<RegExp> = [
  /\bevery single\b/i,
  /\b(?:100|one hundred) per ?cent of\b/i,
];

export function checkTone(text: string): ToneCheckResult {
  const violations: Violation[] = [];

  for (const re of INCITEMENT_PATTERNS) {
    const m = text.match(re);
    if (m) {
      violations.push({
        principle: 'non-violent',
        rule: 'incitement-phrase',
        excerpt: m[0],
        severity: 'block',
      });
    }
  }

  for (const re of DEHUMANISING_PATTERNS) {
    const m = text.match(re);
    if (m) {
      violations.push({
        principle: 'disciplined',
        rule: 'dehumanising-language',
        excerpt: m[0],
        severity: 'block',
      });
    }
  }

  for (const re of RACE_ESSENTIALIST_PATTERNS) {
    const m = text.match(re);
    if (m) {
      violations.push({
        principle: 'non-racial',
        rule: 'race-essentialist-framing',
        excerpt: m[0],
        severity: 'warn',
      });
    }
  }

  for (const re of MARTYR_PATTERNS) {
    const m = text.match(re);
    if (m) {
      violations.push({
        principle: 'family-first',
        rule: 'martyr-framing',
        excerpt: m[0],
        severity: 'warn',
      });
    }
  }

  for (const re of UNSOURCED_UNIVERSAL_PATTERNS) {
    const m = text.match(re);
    if (m) {
      violations.push({
        principle: 'truth-first',
        rule: 'unsourced-universal-claim',
        excerpt: m[0],
        severity: 'warn',
      });
    }
  }

  const blocking = violations.some((v) => v.severity === 'block');
  return { ok: !blocking, violations };
}

/**
 * Convenience helper: summarise a ToneCheckResult for display in the CLI
 * or in an approval prompt.
 */
export function summariseViolations(result: ToneCheckResult): string {
  if (result.violations.length === 0) {
    return 'clean';
  }
  return result.violations
    .map(
      (v) =>
        `[${v.severity.toUpperCase()}] ${v.principle}/${v.rule}: "${v.excerpt}"`,
    )
    .join('\n');
}

/**
 * Expose the currently enforced principle set for agents that want to
 * include it in their run-time telemetry. Does not mutate.
 */
export function enforcedPrinciples(): ReadonlyArray<PrincipleId> {
  return PRINCIPLES.map((p) => p.id);
}
