/**
 * Send a probe email through Resend's REST API.
 *
 * Uses native `fetch` (Node 22+) — no SDK dependency. The contract is
 * narrow enough that the SDK is not worth the footprint, and avoiding
 * it keeps the package dep set at zero runtime libraries.
 */

export interface SendInput {
  readonly apiKey: string;
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
}

export interface SendResult {
  readonly id: string;
  readonly to: string;
  readonly from: string;
  readonly subject: string;
  readonly sentAt: string;
}

export interface SendError {
  readonly statusCode: number;
  readonly message: string;
  readonly name?: string;
}

interface ResendResponseBody {
  readonly id?: string;
  readonly name?: string;
  readonly message?: string;
}

export class ResendSendError extends Error {
  readonly statusCode: number;
  readonly errorName: string;
  constructor(detail: SendError) {
    super(
      `Resend rejected send (HTTP ${String(detail.statusCode)}): ${detail.message}`,
    );
    this.name = 'ResendSendError';
    this.statusCode = detail.statusCode;
    this.errorName = detail.name ?? 'unknown';
  }
}

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export async function sendProbe(input: SendInput): Promise<SendResult> {
  const fetchImpl = input.fetch ?? fetch;
  const now = input.now ?? ((): Date => new Date());
  const response = await fetchImpl(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });

  const body = (await response.json()) as ResendResponseBody;

  if (!response.ok) {
    const detail: SendError = {
      statusCode: response.status,
      message:
        typeof body.message === 'string' ? body.message : 'unknown error',
      ...(typeof body.name === 'string' ? { name: body.name } : {}),
    };
    throw new ResendSendError(detail);
  }

  if (typeof body.id !== 'string') {
    throw new ResendSendError({
      statusCode: response.status,
      message: `Resend returned 2xx without an id field: ${JSON.stringify(body)}`,
      name: 'malformed_response',
    });
  }

  return {
    id: body.id,
    to: input.to,
    from: input.from,
    subject: input.subject,
    sentAt: now().toISOString(),
  };
}
