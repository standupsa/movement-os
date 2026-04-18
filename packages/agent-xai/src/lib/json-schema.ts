/**
 * Thin wrapper over `zod-to-json-schema` that normalises output for the
 * xAI Chat Completions `response_format` / tool `parameters` fields.
 *
 * xAI accepts the same JSON Schema surface as OpenAI for `response_format:
 * json_schema`:
 *   - Inlined JSON Schema (not wrapped in `$ref`/`definitions`) — so we
 *     omit the `name` option of `zod-to-json-schema`, which otherwise
 *     emits a reference shape that xAI (like OpenAI) will not accept here.
 *   - No `$schema` key.
 *   - Plain object, safe to `JSON.stringify`.
 */

import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function zodToXaiJsonSchema(
  schema: z.ZodType,
): Record<string, unknown> {
  const generated = zodToJsonSchema(schema, {
    $refStrategy: 'none',
    target: 'openApi3',
  });
  const { $schema: _schemaKey, ...rest } = generated as Record<string, unknown>;
  return rest;
}
