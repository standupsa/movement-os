/**
 * AuditEvent — every mutation to the platform produces exactly one.
 *
 * Append-only, hash-chained. The audit log is the source of truth for who
 * did what, when, with what inputs. It is not subject to deletion per the
 * POPIA commitments in `POPIA.md`.
 */

import { z } from 'zod';
import { ActorIdSchema } from './ids.js';
import { IsoTimestampSchema, Sha256HexSchema } from './common.js';

export const AuditActionSchema = z.enum([
  'intake.received',
  'intake.redacted',
  'claim.extracted',
  'claim.status.changed',
  'evidence.linked',
  'artefact.drafted',
  'artefact.approved',
  'artefact.published',
  'principles.hash.verified',
  'agent.aborted',
  // Persistent-pursuit events
  'case.created',
  'case.status.changed',
  'question.opened',
  'question.answered',
  'method.attempted',
  'humanlead.scheduled',
  'humanlead.completed',
  'consent.granted',
  'consent.withdrawn',
  'custody.collected',
  'custody.transferred',
  'custody.incident',
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEventSchema = z
  .object({
    id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'ULID'),
    at: IsoTimestampSchema,
    actor: ActorIdSchema,
    action: AuditActionSchema,
    // JSON-serialisable detail — schema validated per-action at write time.
    detail: z.record(z.string(), z.unknown()),
    // Hash chain: sha256 of the previous AuditEvent, tamper-evident log.
    prevHash: Sha256HexSchema,
  })
  .strict();
export type AuditEvent = z.infer<typeof AuditEventSchema>;
