# Infisical Layout — `witness-south-africa`

This folder is the repo-visible reference point for local Infisical and
Cloudflare bootstrap material for the `witness-south-africa` domain and
public-site automation.

## Why this exists

The current Infisical plan is capped on project count, so v1 uses a dedicated
folder path inside an existing Infisical project instead of creating a brand
new project immediately.

That means:

- isolation is by **Infisical folder path**, not by project boundary
- local secrets still stay out of git
- the workflow is stable now and can be migrated to a dedicated project later

## Local files

Keep real credentials next to this README, never in chat:

- `cloudflare.env`
- `machine-identity.env`
- optional `exported.env` for one-off inspection

The local `.gitignore` in this folder ignores those files.

Start from the checked-in templates:

```sh
cp docs/ops/infisical/witness-south-africa/cloudflare.env.example \
  docs/ops/infisical/witness-south-africa/cloudflare.env
cp docs/ops/infisical/witness-south-africa/machine-identity.env.example \
  docs/ops/infisical/witness-south-africa/machine-identity.env
chmod 600 docs/ops/infisical/witness-south-africa/cloudflare.env \
  docs/ops/infisical/witness-south-africa/machine-identity.env
```

## Required values

### `cloudflare.env`

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ZONE_ID`

### `machine-identity.env`

- `INFISICAL_TOKEN`
- `INFISICAL_PROJECT_ID`
- `INFISICAL_ENV=prod`
- `INFISICAL_PATH=/witness-south-africa`

`INFISICAL_TOKEN` can be a machine identity access token or a service token.
Use the narrowest read/write scope that still supports this workflow.

## Round 1 — verify the Cloudflare token locally

```sh
cd /path/to/movement-os
set -a
. docs/ops/infisical/witness-south-africa/cloudflare.env
set +a
curl -s https://api.cloudflare.com/client/v4/user/tokens/verify \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.success, .result.status'
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_ZONE_ID
```

Expected output:

- `true`
- `"active"`

If the token value appears anywhere in terminal output, rotate it.

## Round 2 — seed the dedicated Infisical path

This writes the three Cloudflare values into the existing Infisical project at
the dedicated path stored in `INFISICAL_PATH`.

```sh
cd /path/to/movement-os
set -a
. docs/ops/infisical/witness-south-africa/cloudflare.env
. docs/ops/infisical/witness-south-africa/machine-identity.env
set +a
infisical secrets set \
  CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
  CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
  CLOUDFLARE_ZONE_ID="$CLOUDFLARE_ZONE_ID" \
  --projectId "$INFISICAL_PROJECT_ID" \
  --env "$INFISICAL_ENV" \
  --path "$INFISICAL_PATH" \
  --token "$INFISICAL_TOKEN"
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_ZONE_ID
unset INFISICAL_TOKEN INFISICAL_PROJECT_ID INFISICAL_ENV INFISICAL_PATH
```

## Round 3 — prove pull and rotation

Export the same path back out and verify the token again through the
Cloudflare API:

```sh
cd /path/to/movement-os
set -a
. docs/ops/infisical/witness-south-africa/machine-identity.env
set +a
infisical export \
  --projectId "$INFISICAL_PROJECT_ID" \
  --env "$INFISICAL_ENV" \
  --path "$INFISICAL_PATH" \
  --token "$INFISICAL_TOKEN" \
  --format dotenv \
  --output-file docs/ops/infisical/witness-south-africa/exported.env
chmod 600 docs/ops/infisical/witness-south-africa/exported.env
set -a
. docs/ops/infisical/witness-south-africa/exported.env
set +a
curl -s https://api.cloudflare.com/client/v4/user/tokens/verify \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.success, .result.status'
unset CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_ZONE_ID
unset INFISICAL_TOKEN INFISICAL_PROJECT_ID INFISICAL_ENV INFISICAL_PATH
rm -f docs/ops/infisical/witness-south-africa/exported.env
```

For rotation:

1. create a new Cloudflare token
2. update `cloudflare.env`
3. run the seed command again
4. revoke the old Cloudflare token
5. repeat the export + verify command

If the old token still verifies after revocation, rotation is incomplete.

## Scope guidance

The Cloudflare token should stay tight:

- `Zone / Zone: Read`
- `Zone / DNS: Edit`
- `Zone / Zone Settings: Edit`
- `Account / Email Routing Addresses: Edit`

Zone resources should include only the `witnesssouthafrica.org` zone.

## Migration later

Once the Infisical plan allows a separate project:

1. create a dedicated `witness-south-africa` project
2. copy the same three secrets into the new project
3. update `INFISICAL_PROJECT_ID`
4. keep `INFISICAL_PATH=/witness-south-africa` unless there is a reason to flatten it

That migration is mechanical because the local file layout stays the same.
