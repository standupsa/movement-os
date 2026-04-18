/**
 * Poll the Cloudflare R2 bucket for the first object whose
 * `subject` custom-metadata contains the probe's run id.
 *
 * Uses CF's R2 Data API via the account-scoped bearer token. Two
 * separate calls: LIST by date prefix, HEAD each candidate to read
 * custom metadata (the LIST response does not reliably include
 * custom metadata on all CF endpoints at the time of writing).
 */

export interface PollInput {
  readonly apiToken: string;
  readonly accountId: string;
  readonly bucket: string;
  readonly runId: string;
  readonly datePrefix: string;
  readonly timeoutMs?: number;
  readonly intervalMs?: number;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface PollMatch {
  readonly key: string;
  readonly uploaded: string;
  readonly size: number;
  readonly customMetadata: Readonly<Record<string, string>>;
  readonly elapsedMs: number;
}

export interface PollTimeout {
  readonly reason: 'timeout';
  readonly elapsedMs: number;
  readonly lastSeenKeys: readonly string[];
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_INTERVAL_MS = 5_000;
const SUBJECT_METADATA_KEY = 'subject';

interface ListObject {
  readonly key: string;
  readonly size?: number;
  readonly uploaded?: string;
  readonly last_modified?: string;
  readonly custom_metadata?: Readonly<Record<string, string>>;
}

interface ListResponse {
  readonly success?: boolean;
  readonly result?:
    | readonly ListObject[]
    | {
        readonly objects?: readonly ListObject[];
      };
}

function isListObjectArray(value: unknown): value is readonly ListObject[] {
  return Array.isArray(value);
}

function isNestedListResult(
  value: unknown,
): value is { readonly objects?: readonly ListObject[] } {
  return typeof value === 'object' && value !== null && 'objects' in value;
}

interface HeadResult {
  readonly customMetadata?: Readonly<Record<string, string>>;
  readonly size?: number;
  readonly uploaded?: string;
}

interface HeadResponse {
  readonly success?: boolean;
  readonly result?: HeadResult;
}

async function listObjects(
  fetchImpl: typeof fetch,
  apiToken: string,
  accountId: string,
  bucket: string,
  prefix: string,
): Promise<readonly ListObject[]> {
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects` +
    `?prefix=${encodeURIComponent(prefix)}&per_page=200`;
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!response.ok) {
    throw new Error(`R2 list failed: HTTP ${String(response.status)}`);
  }
  const body = (await response.json()) as ListResponse;
  const result = body.result;
  if (isListObjectArray(result)) {
    return result;
  }
  if (isNestedListResult(result)) {
    return result.objects ?? [];
  }
  return [];
}

async function headObject(
  fetchImpl: typeof fetch,
  apiToken: string,
  accountId: string,
  bucket: string,
  key: string,
): Promise<HeadResult | undefined> {
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/` +
    encodeURIComponent(key);
  const response = await fetchImpl(url, {
    method: 'HEAD',
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!response.ok) {
    return undefined;
  }
  const body = (await response.json().catch(() => ({}))) as HeadResponse;
  return body.result;
}

export async function pollForMatch(
  input: PollInput,
): Promise<PollMatch | PollTimeout> {
  const fetchImpl = input.fetch ?? fetch;
  const now = input.now ?? ((): number => Date.now());
  const sleep =
    input.sleep ??
    ((ms: number): Promise<void> =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      }));

  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = input.intervalMs ?? DEFAULT_INTERVAL_MS;
  const start = now();
  const seen = new Set<string>();
  const lastSeenKeys: string[] = [];

  while (now() - start < timeoutMs) {
    const objects = await listObjects(
      fetchImpl,
      input.apiToken,
      input.accountId,
      input.bucket,
      input.datePrefix,
    );

    for (const o of objects) {
      if (seen.has(o.key)) {
        continue;
      }
      seen.add(o.key);
      lastSeenKeys.push(o.key);

      const head =
        o.custom_metadata === undefined
          ? await headObject(
              fetchImpl,
              input.apiToken,
              input.accountId,
              input.bucket,
              o.key,
            )
          : undefined;
      const meta = o.custom_metadata ?? head?.customMetadata ?? {};
      const subject = meta[SUBJECT_METADATA_KEY] ?? '';
      if (subject.includes(input.runId)) {
        return {
          key: o.key,
          uploaded: head?.uploaded ?? o.uploaded ?? o.last_modified ?? '',
          size: head?.size ?? o.size ?? 0,
          customMetadata: meta,
          elapsedMs: now() - start,
        };
      }
    }

    await sleep(intervalMs);
  }

  return {
    reason: 'timeout',
    elapsedMs: now() - start,
    lastSeenKeys,
  };
}
