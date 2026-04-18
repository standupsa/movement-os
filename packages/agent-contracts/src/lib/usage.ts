/**
 * Token accounting per `complete()` call. Adapters are responsible for
 * mapping provider-native counters (OpenAI's `usage.input_tokens`, xAI's
 * equivalent fields) onto this shape.
 *
 * `totalTokens` is reported as a separate field rather than being
 * recomputed from inputs + outputs because some providers apply
 * caching or batch discounts and report a lower `total` than the sum.
 * Trust the provider's reported total.
 */

import { z } from 'zod';

export const TokenUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    totalTokens: z.number().int().nonnegative(),
  })
  .strict();
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
