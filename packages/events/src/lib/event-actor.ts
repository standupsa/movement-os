/**
 * EventActor — the class of caller that emitted the event.
 *
 * Three accepted forms, deliberately anonymised at the event-log layer:
 *
 *   - `human` — a natural person acting through the platform. No
 *     identity is embedded here; the resolvable mapping lives in the
 *     chain-of-custody / consent records (ADR-0004) which are
 *     privacy-scoped and not exposed to public audit readers.
 *   - `agent:<slug>` — an LLM-backed agent role. The slug is the agent
 *     role-variant (e.g. `agent:tone-gate-v1`). Agent ids are safe to
 *     publish.
 *   - `system:<slug>` — automated platform process with no model in the
 *     loop (schedulers, importers, sweepers). Also safe to publish.
 *
 * The bare `human` form is the compliance-safe default: it says "a
 * human did this" without attaching PII to the event log. Any need for
 * a specific human identity goes through a join to the custody records
 * rather than leaking into an append-only, widely-replicated feed.
 *
 * Branded so a free-form string can't slip past this boundary.
 */

import { z } from 'zod';

export const EVENT_ACTOR_REGEX = /^(human|agent:[a-z0-9-]+|system:[a-z0-9-]+)$/;

export const EventActorSchema = z
  .string()
  .regex(
    EVENT_ACTOR_REGEX,
    'expected "human" or "agent:<slug>" or "system:<slug>"',
  )
  .brand<'EventActor'>();
export type EventActor = z.infer<typeof EventActorSchema>;
