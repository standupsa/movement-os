/**
 * Provider-agnostic tool specification.
 *
 * `parameters` is a Zod schema at runtime so adapters can convert to
 * whatever wire format the provider expects (JSON Schema for OpenAI and
 * xAI; the OpenAI-compatible form covers both today). Callers never
 * author JSON Schema by hand.
 *
 * `ToolSpec` is a TypeScript interface, not a Zod schema, because it
 * contains a Zod schema value — not something that parses cleanly
 * through Zod itself.
 */

import type { z } from 'zod';

const TOOL_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  readonly parameters: z.ZodType;
}

/**
 * Validating constructor for `ToolSpec`. Use at module initialization —
 * throws at first construction if the name or description are invalid,
 * so broken tool definitions never reach a provider.
 */
export function defineTool(spec: ToolSpec): ToolSpec {
  if (!TOOL_NAME_REGEX.test(spec.name)) {
    throw new Error(
      `invalid tool name "${spec.name}" — must match ${TOOL_NAME_REGEX.source}`,
    );
  }
  if (spec.description.trim().length === 0) {
    throw new Error(`tool "${spec.name}" must have a non-empty description`);
  }
  return spec;
}
