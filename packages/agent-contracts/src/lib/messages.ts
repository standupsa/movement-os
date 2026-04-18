/**
 * Provider-agnostic conversation messages.
 *
 * v1 keeps the shape intentionally narrow — `role` + `content`. Tool-call
 * message threading (assistant-with-tool-call / tool-result) is not here
 * yet because no current workflow needs multi-turn tool dialogs; it can
 * be added without breaking this shape by introducing a discriminated
 * union on `role`.
 */

import { z } from 'zod';

export const AgentMessageRoleSchema = z.enum(['system', 'user', 'assistant']);
export type AgentMessageRole = z.infer<typeof AgentMessageRoleSchema>;

export const AgentMessageSchema = z
  .object({
    role: AgentMessageRoleSchema,
    content: z.string().min(1),
  })
  .strict();
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
