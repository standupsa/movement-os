import { generateKey } from './key.js';

/**
 * Minimal shape the ingest function needs from the R2 binding.
 * Using a structural subset keeps the test doubles free of the full
 * `R2Bucket` type surface.
 */
export interface ObjectStore {
  put(
    key: string,
    value: ArrayBuffer,
    options?: {
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
    },
  ): Promise<unknown>;
}

/**
 * Minimal shape the ingest function needs from a Cloudflare
 * `ForwardableEmailMessage`. Keeping this local means the unit test
 * does not have to construct a real runtime message.
 */
export interface IncomingMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
}

/**
 * Persist a raw inbound MIME message to R2 and return the key used.
 *
 * The whole message is read into memory once. Cloudflare Email Workers
 * have a 25 MiB cap on incoming mail, which fits comfortably inside
 * the Worker's runtime memory budget. If a larger-message regime ever
 * becomes relevant, this function is the seam where streaming-to-R2
 * would replace the `new Response(raw).arrayBuffer()` step.
 */
export async function ingest(
  message: IncomingMessage,
  inbox: ObjectStore,
  now: Date,
): Promise<string> {
  const key = generateKey(now, message.to);
  const body = await new Response(message.raw).arrayBuffer();
  await inbox.put(key, body, {
    customMetadata: {
      from: message.from,
      to: message.to,
      messageId: message.headers.get('message-id') ?? '',
      subject: message.headers.get('subject') ?? '',
      received: now.toISOString(),
    },
    httpMetadata: {
      contentType: 'message/rfc822',
    },
  });
  return key;
}
