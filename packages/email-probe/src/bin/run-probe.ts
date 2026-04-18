/**
 * Nx CLI entry. Reads config from env (intended use: `infisical run`
 * injects the secrets), runs the probe, writes a machine-parseable
 * JSON result to stdout, exits non-zero on fail.
 *
 * Invoke via:
 *   infisical run --projectId <id> --env=prod --path=/witness-south-africa \
 *     -- pnpm --filter @wsa/email-probe exec node ./dist/bin/run-probe.js
 */
import { runProbe, type ProbeResult } from '../lib/probe.js';

interface RequiredEnv {
  readonly RESEND_API_KEY: string;
  readonly CLOUDFLARE_API_TOKEN: string;
  readonly CLOUDFLARE_ACCOUNT_ID: string;
}

function requireEnv(): RequiredEnv {
  const missing: string[] = [];
  const check = (
    name: keyof RequiredEnv,
    value: string | undefined,
  ): string => {
    if (typeof value !== 'string' || value.length === 0) {
      missing.push(name);
      return '';
    }
    return value;
  };
  const out: RequiredEnv = {
    RESEND_API_KEY: check('RESEND_API_KEY', process.env.RESEND_API_KEY),
    CLOUDFLARE_API_TOKEN: check(
      'CLOUDFLARE_API_TOKEN',
      process.env.CLOUDFLARE_API_TOKEN,
    ),
    CLOUDFLARE_ACCOUNT_ID: check(
      'CLOUDFLARE_ACCOUNT_ID',
      process.env.CLOUDFLARE_ACCOUNT_ID,
    ),
  };
  if (missing.length > 0) {
    console.error(
      JSON.stringify({
        status: 'fail',
        reason: 'missing-env',
        missing,
        hint:
          'Run under `infisical run --env=prod --path=/witness-south-africa ' +
          '-- node ./dist/bin/run-probe.js`',
      }),
    );
    process.exit(2);
  }
  return out;
}

async function main(): Promise<void> {
  const env = requireEnv();

  const from =
    process.env.WSA_PROBE_FROM ?? 'probe@mail.witnesssouthafrica.org';
  const to = process.env.WSA_PROBE_TO ?? 'hello@witnesssouthafrica.org';
  const bucket = process.env.WSA_R2_BUCKET ?? 'wsa-inbox';
  const pollTimeoutMs = Number.parseInt(
    process.env.WSA_PROBE_TIMEOUT_MS ?? '120000',
    10,
  );
  const pollIntervalMs = Number.parseInt(
    process.env.WSA_PROBE_INTERVAL_MS ?? '5000',
    10,
  );

  const result: ProbeResult = await runProbe({
    resendApiKey: env.RESEND_API_KEY,
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
    r2Bucket: bucket,
    from,
    to,
    pollTimeoutMs,
    pollIntervalMs,
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'pass' ? 0 : 1);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(
    JSON.stringify({
      status: 'fail',
      reason: 'exception',
      message,
    }),
  );
  process.exit(3);
});
