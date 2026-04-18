/**
 * @wsa/principles — the spine of the platform.
 *
 * The mission sentence and eight principles are the movement's public API.
 * Any change to these constants is a semver-major event, gated by Cause
 * Council sign-off in CI. Every agent asserts CONTENT_SHA256 against a
 * build-time value before it is allowed to run: no hash match, no run.
 *
 * Do not inline these strings anywhere else. Always import from this module.
 */

import { createHash } from 'node:crypto';

export interface Principle {
  readonly id: PrincipleId;
  readonly text: string;
}

export type PrincipleId =
  | 'non-racial'
  | 'constitutional'
  | 'non-violent'
  | 'truth-first'
  | 'disciplined'
  | 'endurance'
  | 'protection'
  | 'family-first';

export const MISSION: string =
  'We stand for equal protection, equal dignity, and accountable government for every South African — regardless of race, class, or politics.';

export const PRINCIPLES: ReadonlyArray<Principle> = Object.freeze([
  {
    id: 'non-racial',
    text: 'We reject race as a basis for rights, blame, or allocation.',
  },
  {
    id: 'constitutional',
    text: 'We operate inside the Bill of Rights. No exceptions.',
  },
  {
    id: 'non-violent',
    text: 'Violence ends a human-rights movement. Full stop.',
  },
  {
    id: 'truth-first',
    text: 'Every public claim is sourced, dated, and verifiable.',
  },
  {
    id: 'disciplined',
    text: 'We argue from evidence, not insult. No slurs, no dehumanising language.',
  },
  {
    id: 'endurance',
    text: 'We build for years, not news cycles.',
  },
  {
    id: 'protection',
    text: 'We shield witnesses, whistleblowers, and vulnerable members.',
  },
  {
    id: 'family-first',
    text: 'No member sacrifices their health, safety, or family for the cause.',
  },
] as const satisfies ReadonlyArray<Principle>);

export const VERSION = '0.1.0' as const;

/**
 * Stable SHA-256 over MISSION + PRINCIPLES (as canonical JSON).
 * Computed deterministically at module load; used to detect drift.
 *
 * Agents MUST compare this hash against a build-time-pinned value before
 * acting. If the hash does not match, the agent aborts.
 */
export const CONTENT_SHA256: string = computeContentHash();

function computeContentHash(): string {
  const canonical = JSON.stringify({
    mission: MISSION,
    principles: PRINCIPLES.map((p) => ({ id: p.id, text: p.text })),
    version: VERSION,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Throw if the current hash does not match the pinned value. Agents call
 * this at startup with a hash compiled into their build.
 */
export function assertPinnedHash(expected: string): void {
  if (expected !== CONTENT_SHA256) {
    throw new Error(
      `[@wsa/principles] content hash mismatch. expected=${expected} actual=${CONTENT_SHA256}. ` +
        `Refusing to run: the mission/principles have drifted from the pinned build.`,
    );
  }
}
