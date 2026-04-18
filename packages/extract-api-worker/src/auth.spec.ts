import { createHmac, createHash } from 'node:crypto';
import {
  canonicalizeSignatureInput,
  extractRawPathAndQuery,
  verifySignedRequest,
} from './auth.js';
import type { AuthError } from './auth.js';

function buildSignedRequest(args: {
  readonly body: string;
  readonly keyId?: string;
  readonly timestamp?: string;
  readonly pathAndQuery?: string;
  readonly method?: string;
  readonly secret?: string;
  readonly signatureOverride?: string;
  readonly bodyHashOverride?: string;
}): Request {
  const bodyHash =
    args.bodyHashOverride ??
    createHash('sha256').update(args.body, 'utf8').digest('hex');
  const keyId = args.keyId ?? 'OP01';
  const timestamp = args.timestamp ?? '1713462000';
  const pathAndQuery = args.pathAndQuery ?? '/v1/extract?mode=fast';
  const method = args.method ?? 'POST';
  const secret = args.secret ?? 'top-secret';
  const canonical = canonicalizeSignatureInput(
    method,
    pathAndQuery,
    timestamp,
    bodyHash,
  );
  const signature =
    args.signatureOverride ??
    createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');

  return new Request(
    `https://extract-api.witnesssouthafrica.org${pathAndQuery}`,
    {
      method,
      headers: {
        'X-WSA-Key-Id': keyId,
        'X-WSA-Timestamp': timestamp,
        'X-WSA-Content-SHA256': bodyHash,
        'X-WSA-Signature': signature,
      },
      body: args.body,
    },
  );
}

describe('@wsa/extract-api-worker/auth', () => {
  it('verifies a correctly signed request', async () => {
    const request = buildSignedRequest({
      body: '{"hello":"world"}',
      pathAndQuery: '/v1/extract?mode=fast&x=%2F',
    });

    const result = await verifySignedRequest(
      request,
      { OPERATOR_HMAC_KEY_OP01: 'top-secret' },
      new Date('2024-04-18T16:20:00.000Z'),
    );

    expect(result.keyId).toBe('OP01');
    expect(result.rawPathAndQuery).toBe('/v1/extract?mode=fast&x=%2F');
  });

  it('rejects missing headers', async () => {
    await expect(
      verifySignedRequest(
        new Request('https://extract-api.witnesssouthafrica.org/v1/extract', {
          method: 'POST',
          body: '{}',
        }),
        {},
      ),
    ).rejects.toMatchObject({
      reason: 'missing_signature_headers',
    } satisfies Partial<AuthError>);
  });

  it('rejects stale timestamps', async () => {
    await expect(
      verifySignedRequest(
        buildSignedRequest({ body: '{}', timestamp: '1713460000' }),
        { OPERATOR_HMAC_KEY_OP01: 'top-secret' },
        new Date('2024-04-18T16:20:00.000Z'),
      ),
    ).rejects.toMatchObject({
      reason: 'stale_timestamp',
    } satisfies Partial<AuthError>);
  });

  it('rejects body hash mismatches', async () => {
    await expect(
      verifySignedRequest(
        buildSignedRequest({
          body: '{"hello":"world"}',
          bodyHashOverride: 'b'.repeat(64),
        }),
        { OPERATOR_HMAC_KEY_OP01: 'top-secret' },
        new Date('2024-04-18T16:20:00.000Z'),
      ),
    ).rejects.toMatchObject({
      reason: 'body_hash_mismatch',
    } satisfies Partial<AuthError>);
  });

  it('rejects unknown key ids', async () => {
    await expect(
      verifySignedRequest(
        buildSignedRequest({ body: '{}', keyId: 'MISSING' }),
        { OPERATOR_HMAC_KEY_OP01: 'top-secret' },
        new Date('2024-04-18T16:20:00.000Z'),
      ),
    ).rejects.toMatchObject({
      reason: 'unknown_key_id',
    } satisfies Partial<AuthError>);
  });

  it('rejects signature mismatches', async () => {
    await expect(
      verifySignedRequest(
        buildSignedRequest({
          body: '{}',
          signatureOverride: 'a'.repeat(64),
        }),
        { OPERATOR_HMAC_KEY_OP01: 'top-secret' },
        new Date('2024-04-18T16:20:00.000Z'),
      ),
    ).rejects.toMatchObject({
      reason: 'signature_mismatch',
    } satisfies Partial<AuthError>);
  });

  it('extracts the raw path and query without stripping encoding', () => {
    expect(
      extractRawPathAndQuery(
        'https://extract-api.witnesssouthafrica.org/v1/extract?source=%2Fdoc%20one',
      ),
    ).toBe('/v1/extract?source=%2Fdoc%20one');
  });
});
