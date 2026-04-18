/**
 * SHA-256 hashing for the event chain.
 *
 * We use `node:crypto` rather than a userland dependency so the chain
 * code can't be compromised by a supply-chain attack on an npm
 * package: the algorithm ships with the runtime. The chain verifier is
 * the first line of tamper-evidence for the entire log; minimising its
 * dependency surface is deliberate.
 *
 * The genesis sentinel is 64 zero hex digits. Every aggregate's first
 * event carries `prevHash === GENESIS_HASH`; this is what lets a
 * verifier tell "legitimate first event" from "middle event whose
 * predecessor was removed" — a stripped-head tamper reveals itself
 * because the new head-of-chain's `prevHash` won't be the sentinel
 * unless the attacker also rewrites that field, which breaks the
 * recomputed hash.
 */

import { createHash } from 'node:crypto';

export const GENESIS_HASH: string = '0'.repeat(64);

/**
 * Lowercase hex SHA-256 of the given UTF-8 string. Output is exactly
 * 64 characters and matches `Sha256HexSchema` from `@wsa/schemas`.
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
