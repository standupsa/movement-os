import { ingest } from './lib/ingest.js';

/**
 * Worker bindings declared in wrangler.toml.
 * `INBOX` is the R2 bucket `wsa-inbox` that holds every inbound
 * message as raw RFC 822 MIME.
 */
export interface Env {
  readonly INBOX: R2Bucket;
}

/**
 * Email Worker entry point.
 *
 * Per ADR-0006, every inbound message to the configured aliases is
 * preserved in R2 before any human sees it. The Worker:
 *
 * 1. Generates a deterministic-but-unique R2 key from `now` and the
 *    recipient alias.
 * 2. Writes the raw MIME body with canonical metadata (from, to,
 *    message-id, subject, received) plus deterministic auth/triage
 *    metadata for downstream filtering.
 * 3. Returns silently — senders get 250 OK via CF's Email Routing
 *    layer. The Worker does not forward; the mailbox forwarding of
 *    the bootstrap phase is retired when this Worker is wired to the
 *    aliases.
 *
 * Awaiting `ingest` means the handler only resolves once the R2
 * write is durable. If the write fails, the runtime retries and the
 * sender sees a deferral instead of a silent success — which is the
 * correct "no evidence lost on first-boot transients" semantic for
 * an evidence-first platform.
 */
const handler: ExportedHandler<Env> = {
  async email(message, env, _ctx): Promise<void> {
    await ingest(message, env.INBOX, new Date());
  },
};

export default handler;
