import { sendProbe, type SendResult } from './send.js';
import { pollForMatch, type PollMatch, type PollTimeout } from './poll.js';

export interface ProbeInput {
  readonly resendApiKey: string;
  readonly cloudflareApiToken: string;
  readonly cloudflareAccountId: string;
  readonly r2Bucket: string;
  readonly from: string;
  readonly to: string;
  readonly now?: () => Date;
  readonly pollTimeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly fetch?: typeof fetch;
  readonly generateRunId?: () => string;
}

export type ProbeResult =
  | {
      readonly status: 'pass';
      readonly runId: string;
      readonly send: SendResult;
      readonly match: PollMatch;
    }
  | {
      readonly status: 'fail';
      readonly runId: string;
      readonly send: SendResult;
      readonly timeout: PollTimeout;
    };

function defaultRunId(now: () => Date): string {
  const t = now();
  const day = t.toISOString().slice(0, 10).replace(/-/g, '');
  const tod = t.toISOString().slice(11, 19).replace(/:/g, '');
  const entropy =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `wsa-probe-${day}-${tod}-${entropy}`;
}

/**
 * End-to-end probe:
 *   Resend -> SMTP -> Cloudflare Email Routing -> wsa-email-ingress Worker -> R2
 *
 * Every MX-edge hop except the Worker itself is real infrastructure.
 * A `pass` result means the inbound path is durable for a message
 * that is deterministically traceable by subject.
 */
export async function runProbe(input: ProbeInput): Promise<ProbeResult> {
  const now = input.now ?? ((): Date => new Date());
  const runId = (input.generateRunId ?? (() => defaultRunId(now)))();

  const subject = runId;
  const text =
    `Automated probe email for the Witness South Africa email-ingress ` +
    `worker. Run id: ${runId}. If you received this in a human inbox, ` +
    `the machine probe worked; please ignore.`;

  const send = await sendProbe({
    apiKey: input.resendApiKey,
    from: input.from,
    to: input.to,
    subject,
    text,
    ...(input.fetch === undefined ? {} : { fetch: input.fetch }),
  });

  const sendTime = new Date(send.sentAt);
  const datePrefix = sendTime.toISOString().slice(0, 10);

  const pollResult = await pollForMatch({
    apiToken: input.cloudflareApiToken,
    accountId: input.cloudflareAccountId,
    bucket: input.r2Bucket,
    runId,
    datePrefix,
    ...(input.pollTimeoutMs === undefined
      ? {}
      : { timeoutMs: input.pollTimeoutMs }),
    ...(input.pollIntervalMs === undefined
      ? {}
      : { intervalMs: input.pollIntervalMs }),
    ...(input.fetch === undefined ? {} : { fetch: input.fetch }),
  });

  if ('reason' in pollResult) {
    return { status: 'fail', runId, send, timeout: pollResult };
  }
  return { status: 'pass', runId, send, match: pollResult };
}
