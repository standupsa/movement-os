const CROCKFORD32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateUlid(now: Date): string {
  const timestamp = encodeCrockford(now.getTime(), 10);
  const randomBytes = crypto.getRandomValues(new Uint8Array(10));
  let randomValue = 0n;
  for (const byte of randomBytes) {
    randomValue = (randomValue << 8n) | BigInt(byte);
  }
  const randomness = encodeCrockford(randomValue, 16);
  return `${timestamp}${randomness}`;
}

function encodeCrockford(value: number | bigint, length: number): string {
  let cursor = BigInt(value);
  const chars = Array.from({ length }, () => '0');
  for (let idx = length - 1; idx >= 0; idx -= 1) {
    const digit = Number(cursor & 31n);
    chars[idx] = CROCKFORD32[digit] ?? '0';
    cursor >>= 5n;
  }
  return chars.join('');
}
