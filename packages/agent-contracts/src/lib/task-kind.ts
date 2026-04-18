/**
 * Routing lanes per ADR-0003.
 *
 * A provider MAY refuse a task based on its kind. In particular the
 * challenge lane REQUIRES a provider different from the one that
 * originally produced the analysis, which orchestration enforces by
 * refusing to dispatch the same provider twice for the same artefact.
 * That rule lives above the adapter, not in it — adapters don't track
 * history. But every `complete()` call still names its `taskKind` so
 * audit logs and routing can reason about what a call was for.
 */

import { z } from 'zod';

export const AgentTaskKindSchema = z.enum([
  'sensitive-intake',
  'analysis',
  'challenge',
]);
export type AgentTaskKind = z.infer<typeof AgentTaskKindSchema>;
