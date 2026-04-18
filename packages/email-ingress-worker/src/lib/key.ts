/**
 * R2 object-key scheme for inbound mail.
 *
 * Key format: `YYYY-MM-DD/HHMMSS-<uuid>-<alias>.eml`
 *
 * - Date prefix gives natural chronological grouping in R2 listings.
 * - UUID guarantees uniqueness even if two messages arrive in the same
 *   second for the same alias.
 * - Alias suffix (the local-part of the `to` address) lets operators
 *   grep for a specific alias's mail stream without reading metadata.
 * - `.eml` is the conventional extension for raw RFC 822 messages.
 */
export function generateKey(when: Date, to: string): string {
  const iso = when.toISOString();
  const day = iso.slice(0, 10);
  const timeOfDay = iso.slice(11, 19).replace(/:/g, '');
  const nonce = crypto.randomUUID();
  const [localPart] = to.split('@');
  const alias = localPart && localPart.length > 0 ? localPart : 'unknown';
  return `${day}/${timeOfDay}-${nonce}-${alias}.eml`;
}
