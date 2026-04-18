/**
 * Thin wrapper over `zod-to-json-schema` that normalises output for the
 * OpenAI Chat Completions `response_format` / tool `parameters` fields.
 *
 * Wire format expected by OpenAI:
 *   - Inlined JSON Schema (not wrapped in `$ref`/`definitions`) — so we
 *     omit the `name` option of `zod-to-json-schema`, which otherwise
 *     emits a reference shape OpenAI won't accept here.
 *   - No `$schema` key — OpenAI rejects it in `json_schema.schema`.
 *   - Plain object, safe to `JSON.stringify`.
 */

import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function zodToOpenAiJsonSchema(
  schema: z.ZodType,
): Record<string, unknown> {
  const generated = zodToJsonSchema(schema, {
    $refStrategy: 'none',
    target: 'openApi3',
  });
  const { $schema: _schemaKey, ...rest } = generated as Record<string, unknown>;
  return rest;
}
