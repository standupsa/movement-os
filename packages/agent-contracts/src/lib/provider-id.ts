/**
 * LLM provider identifiers. `anthropic` and `local` are reserved in the
 * union so ADR-0003's three-lane routing can reference them today; the
 * adapter packages land in later PRs.
 */

import { z } from 'zod';

export const LlmProviderIdSchema = z.enum([
  'openai',
  'xai',
  'anthropic',
  'local',
]);
export type LlmProviderId = z.infer<typeof LlmProviderIdSchema>;
