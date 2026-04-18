# DNS Runbook — `standupsa.org`

Repo-side runbook for the Stand Up South Africa public domain.

## Decisions

- Canonical site: `https://standupsa.org`
- Redirect variant: `https://www.standupsa.org` -> `https://standupsa.org`
- Registrar: Cloudflare Registrar
- Authoritative DNS: Cloudflare DNS
- Inbound mail: Cloudflare Email Routing
- Public site host: GitHub Pages
- No wildcard DNS records

## Preconditions

- `standupsa.org` is registered in the existing hardware-key-protected
  Cloudflare account.
- Cloudflare is the authoritative nameserver for the domain.
- A hardened existing inbox is available as the Cloudflare Email Routing
  destination.
- GitHub organization: `standupsa`
- GitHub Pages target repo: `standupsa/movement-os`

## 1. GitHub Pages DNS records

Start with the records below exactly as shown.

### Apex records

GitHub Pages documents these IPs for apex domains:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `@` | `185.199.108.153` |
| `A` | `@` | `185.199.109.153` |
| `A` | `@` | `185.199.110.153` |
| `A` | `@` | `185.199.111.153` |
| `AAAA` | `@` | `2606:50c0:8000::153` |
| `AAAA` | `@` | `2606:50c0:8001::153` |
| `AAAA` | `@` | `2606:50c0:8002::153` |
| `AAAA` | `@` | `2606:50c0:8003::153` |

### `www` record

| Type | Name | Value |
| --- | --- | --- |
| `CNAME` | `www` | `standupsa.github.io` |

After Pages is working, configure the GitHub Pages custom domain as
`standupsa.org` and enforce the redirect from `www` to apex in the Pages
settings.

## 2. GitHub domain verification

Verify the domain at the GitHub organization level before treating it as
live:

1. GitHub -> `standupsa` organization settings -> `Pages` -> `Add a domain`
2. Enter `standupsa.org`
3. GitHub will show a TXT record under
   `_github-pages-challenge-standupsa.standupsa.org`
4. Add that TXT record in Cloudflare
5. Wait for DNS to propagate, then complete verification in GitHub

Keep the TXT record in place after verification.

## 3. Cloudflare Email Routing

Enable Email Routing only after Cloudflare is authoritative for DNS.

Create these aliases:

- `hello@standupsa.org`
- `support@standupsa.org`
- `legal@standupsa.org`

Route all three to the same hardened destination inbox for v1.

Important:

- Cloudflare Email Routing is inbound forwarding only.
- It is not a full mailbox service and does not provide branded outbound
  sending on its own.
- When Email Routing is enabled, Cloudflare will add the required MX/TXT
  records and will ask to remove conflicting MX records if they exist.

## 4. Certificate and mail-policy records

If CAA records are used, GitHub Pages HTTPS requires `letsencrypt.org` to
be allowed.

Recommended starting records:

| Type | Name | Value |
| --- | --- | --- |
| `CAA` | `@` | `0 issue "letsencrypt.org"` |
| `CAA` | `@` | `0 issuewild "letsencrypt.org"` |

Mail-policy scaffolding for an inbound-only phase:

| Type | Name | Value |
| --- | --- | --- |
| `TXT` | `@` | `v=spf1 -all` |
| `TXT` | `_dmarc` | `v=DMARC1; p=reject; adkim=s; aspf=s; rua=mailto:legal@standupsa.org` |

Revisit SPF/DKIM/DMARC when outbound branded mail is introduced.

## 5. Validation commands

Use these checks from a terminal after DNS changes propagate:

```sh
dig standupsa.org +noall +answer -t A
dig standupsa.org +noall +answer -t AAAA
dig www.standupsa.org +noall +answer -t CNAME
dig _github-pages-challenge-standupsa.standupsa.org +noall +answer -t TXT
dig standupsa.org +noall +answer -t CAA
dig _dmarc.standupsa.org +noall +answer -t TXT
```

Expected outcomes:

- Apex resolves to the four GitHub Pages `A` records and four `AAAA` records
- `www` resolves to `standupsa.github.io`
- The GitHub challenge TXT is visible before verification
- `CAA` includes `letsencrypt.org`
- `_dmarc` is present

## 6. Operational notes

- Do not use `*.` wildcard DNS records. GitHub explicitly warns that they
  increase takeover risk.
- Keep `CNAME` in the publishing source so the intended canonical domain stays
  in-repo.
- If the Pages custom-domain or HTTPS state sticks after DNS changes, remove
  and re-add the custom domain in GitHub Pages to force a fresh certificate
  issuance attempt.

## References

- GitHub Pages custom-domain DNS values and verification flow:
  <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>
- GitHub Pages domain verification:
  <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages>
- GitHub Pages and CAA requirement for HTTPS:
  <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages>
- Cloudflare Registrar:
  <https://developers.cloudflare.com/registrar/>
- Cloudflare Email Routing:
  <https://developers.cloudflare.com/email-routing/>
