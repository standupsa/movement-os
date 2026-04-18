import { ingest, type IncomingMessage, type ObjectStore } from './ingest.js';

function streamFromString(body: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
}

interface RecordedPut {
  readonly key: string;
  readonly body: ArrayBuffer;
  readonly options:
    | {
        customMetadata?: Record<string, string>;
        httpMetadata?: { contentType?: string };
      }
    | undefined;
}

function createRecordingStore(): { store: ObjectStore; puts: RecordedPut[] } {
  const puts: RecordedPut[] = [];
  const store: ObjectStore = {
    put(key, body, options) {
      puts.push({ key, body, options });
      return Promise.resolve();
    },
  };
  return { store, puts };
}

describe('ingest', () => {
  it('writes the raw MIME body to R2 with the generated key', async () => {
    const { store, puts } = createRecordingStore();
    const message: IncomingMessage = {
      from: 'alice@example.org',
      to: 'hello@witnesssouthafrica.org',
      headers: new Headers({
        'message-id': '<abc@example.org>',
        subject: 'a test',
      }),
      raw: streamFromString(
        'From: alice@example.org\nSubject: a test\n\nhello',
      ),
    };

    const key = await ingest(message, store, new Date('2026-04-18T09:00:00Z'));

    expect(puts).toHaveLength(1);
    expect(puts[0]?.key).toBe(key);
    expect(new TextDecoder().decode(puts[0]?.body)).toBe(
      'From: alice@example.org\nSubject: a test\n\nhello',
    );
  });

  it('attaches canonical custom metadata (from, to, message-id, subject, received)', async () => {
    const { store, puts } = createRecordingStore();
    const message: IncomingMessage = {
      from: 'alice@example.org',
      to: 'support@witnesssouthafrica.org',
      headers: new Headers({
        'authentication-results':
          'mx.cloudflare.net; spf=pass smtp.mailfrom=example.org; dkim=pass header.d=example.org; dmarc=pass header.from=example.org',
        'message-id': '<m1@x>',
        date: 'Sat, 18 Apr 2026 12:34:56 +0000',
        subject: 'help',
      }),
      raw: streamFromString('body'),
    };

    await ingest(message, store, new Date('2026-04-18T12:34:56Z'));

    expect(puts[0]?.options?.customMetadata).toStrictEqual({
      from: 'alice@example.org',
      to: 'support@witnesssouthafrica.org',
      messageId: '<m1@x>',
      subject: 'help',
      received: '2026-04-18T12:34:56.000Z',
      spamVerdict: 'clean',
      authVerdict: 'pass',
      spfVerdict: 'pass',
      dkimVerdict: 'pass',
      dmarcVerdict: 'pass',
      messageSizeBytes: '4',
      headerAnomalies: 'none',
    });
  });

  it('coerces missing message-id and subject to empty strings', async () => {
    const { store, puts } = createRecordingStore();
    const message: IncomingMessage = {
      from: 'bob@example.org',
      to: 'legal@witnesssouthafrica.org',
      headers: new Headers(),
      raw: streamFromString('body'),
    };

    await ingest(message, store, new Date('2026-04-18T00:00:00Z'));

    expect(puts[0]?.options?.customMetadata?.messageId).toBe('');
    expect(puts[0]?.options?.customMetadata?.subject).toBe('');
    expect(puts[0]?.options?.customMetadata?.spamVerdict).toBe('suspect');
    expect(puts[0]?.options?.customMetadata?.headerAnomalies).toBe(
      'missing-authentication-results,missing-message-id,missing-date',
    );
  });

  it('sets the content type to message/rfc822 (raw MIME)', async () => {
    const { store, puts } = createRecordingStore();
    const message: IncomingMessage = {
      from: 'alice@example.org',
      to: 'hello@witnesssouthafrica.org',
      headers: new Headers(),
      raw: streamFromString('body'),
    };

    await ingest(message, store, new Date());

    expect(puts[0]?.options?.httpMetadata?.contentType).toBe('message/rfc822');
  });

  it('returns the generated key so callers can log it', async () => {
    const { store } = createRecordingStore();
    const message: IncomingMessage = {
      from: 'alice@example.org',
      to: 'hello@witnesssouthafrica.org',
      headers: new Headers(),
      raw: streamFromString('body'),
    };

    const key = await ingest(message, store, new Date('2026-04-18T00:00:00Z'));

    expect(key).toMatch(/^2026-04-18\/000000-.+-hello\.eml$/);
  });
});
