# P34E-01 — DNS: api subdomain CNAME

## Purpose

Add a DNS CNAME record so that `api.getkontax.com` resolves to the same server
as `getkontax.com`, enabling the API subdomain to be used once Coolify and the
Next.js middleware are configured in P34E-02 and P34E-03.

## Background

The public API currently lives at `getkontax.com/api/v1/...`. Providing a
dedicated `api.getkontax.com` subdomain is a standard developer-experience
signal. DNS is the first step — all other Phase 34E tickets depend on the
subdomain resolving correctly. This ticket requires no code changes.

## Scope

**In scope**
- Add the following DNS record at the domain registrar / DNS provider for
  `getkontax.com`:
  ```
  Type:  CNAME
  Name:  api
  Value: getkontax.com
  TTL:   300
  ```
- Document where the DNS records are managed (registrar name, login method,
  or Notion page with credentials) in this ticket so the next person can
  find it.
- Verify propagation after creation using:
  ```bash
  dig api.getkontax.com
  ```
  Expected: the CNAME resolves to `getkontax.com` and then to the server IP.

**Out of scope**
- TLS / HTTPS — handled by Coolify in P34E-02.
- Any code change — this ticket is DNS configuration only.
- `www.api.getkontax.com` or any other subdomain variant.

## Design / Implementation Spec

### DNS record details

TTL 300 (5 minutes) is intentional. It allows fast correction if the value
needs to change before go-live. Increase to 3600 after the full subdomain stack
is verified live.

### Finding the DNS provider

Check the `getkontax.com` domain registration and/or Coolify deployment notes
for where DNS is managed. Common locations: Cloudflare, Namecheap, Route 53.
If DNS is managed at the registrar rather than a dedicated DNS provider, check
the registrar's control panel.

### Verification commands

```bash
# Check CNAME resolution
dig api.getkontax.com CNAME

# Check full resolution chain
dig api.getkontax.com

# If dig is unavailable:
nslookup api.getkontax.com
```

Propagation typically completes within 5 minutes given TTL 300, but may take
up to the registrar's minimum TTL globally.

## Acceptance Criteria
- `dig api.getkontax.com` returns a CNAME pointing to `getkontax.com` (or its
  resolved A record).
- `curl -I http://api.getkontax.com` returns a response (even if 404 or
  redirect — Coolify isn't configured yet, but the connection should reach the
  server).
- The DNS record is documented (provider + access method) in the relevant ops
  runbook or Notion page.

## Risks / Open Questions
- If `getkontax.com` uses Cloudflare's proxy (orange cloud), the CNAME target
  should be the Cloudflare proxied hostname, not a bare IP. Verify the existing
  `getkontax.com` A/CNAME setup before adding the subdomain record — the
  subdomain should use the same proxy configuration.
- If the DNS provider is Cloudflare, enable the proxy (orange cloud) on the
  `api` record to match the root domain's proxy setting, so that Cloudflare
  edge caching and DDoS protection apply uniformly.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): none required
- [ ] External · developers — /developers (P29-07): none yet (wait for P34E-07)
- [x] Internal · admins/ops — roadmap/runbooks/: document DNS provider, record
      details, and TTL increase schedule after go-live
- [ ] Internal · engineering — docs/: none required
