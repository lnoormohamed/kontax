# P34D-14 — Configure DNS for getkontax.com

## Purpose

Point `getkontax.com`, `www.getkontax.com`, and `api.getkontax.com` at the
production server, configure these domains in Coolify, and pre-lower the TTL so that
any cutover DNS changes propagate within minutes.

## Background

Kontax is currently running at `kontax.vexon.co`. The production domain `getkontax.com`
must resolve to the production server IP. Coolify handles TLS provisioning (Let's
Encrypt) automatically once the domain is configured, but DNS must resolve first
before Coolify can issue the certificate.

TTL pre-lowering is a standard operational practice: by lowering TTL to 300 seconds
(or lower) at least 24 hours before the planned cutover, DNS resolvers will cache
the value for only 5 minutes, meaning any IP change during cutover propagates
globally within minutes rather than hours.

## Scope

**In scope**
- Add/update A record for apex domain (`@`)
- Add/update CNAME for `www` and `api` subdomains
- Lower TTL to 300 before cutover (then lower to 60 immediately before the DNS flip)
- Configure all three domains in Coolify's application settings
- Verify DNS propagation after each step

**Out of scope**
- TLS certificate provisioning (P34D-15 — depends on this ticket)
- SES/email DNS records (SPF, DKIM, DMARC for getkontax.com — if emails are to be
  sent from this domain, that is a separate SES setup; currently using vexon.co)
- CDN setup (not in scope for initial launch)

## Design / Implementation Spec

### Step 1 — Identify the production server IP

Get the public IP of the production Proxmox LXC:
```bash
# On the production server
curl -4 https://ifconfig.me
```
Note this as `<prod-ip>`.

### Step 2 — Lower TTL at the registrar (do this 24h before go-live)

Log in to the domain registrar for `getkontax.com`. Find the existing DNS records
and lower all TTL values to `300` seconds. If the domain is pointing elsewhere
currently (a parked page or another server), change the A record to `<prod-ip>` at
this step, or keep pointing at the parked page and change only the TTL now, then
change the A record during the P34D-23 cutover.

**24 hours before P34D-23**: lower TTL to 300 for all records.
**1 hour before P34D-23**: lower TTL to 60 for the apex A record.

### Step 3 — Add DNS records

At the registrar, set the following records (replacing or adding as needed):

```
Record Type   Host           Value              TTL
A             @              <prod-ip>          300
CNAME         www            getkontax.com      300
CNAME         api            getkontax.com      300
```

Notes:
- Some registrars require `www` to CNAME to `getkontax.com.` (with trailing dot).
- Some registrars do not allow CNAME on the apex (`@`) — that's correct; only A/AAAA
  records are valid on the apex.
- If the registrar supports ALIAS/ANAME records (Cloudflare, DNSimple, Route 53),
  `www` can also use an ALIAS to avoid the CNAME restriction.

### Step 4 — Configure domains in Coolify

In Coolify → Production application → Settings → Domains:

Add the following domain entries:
- `https://getkontax.com`
- `https://www.getkontax.com`
- `https://api.getkontax.com`

Coolify will attempt to issue Let's Encrypt certificates for each. This will only
succeed after DNS propagates (Step 3). Allow up to 10 minutes after DNS propagation
for cert issuance.

### Step 5 — Verify DNS propagation

After setting the records, verify propagation from multiple locations:

```bash
# Local verification
dig getkontax.com A +short
dig www.getkontax.com CNAME +short
dig api.getkontax.com CNAME +short

# Check from multiple global DNS resolvers
dig @8.8.8.8 getkontax.com A +short     # Google
dig @1.1.1.1 getkontax.com A +short     # Cloudflare
dig @9.9.9.9 getkontax.com A +short     # Quad9
```

Expected: `dig getkontax.com A +short` returns `<prod-ip>` from all three resolvers.

Also check: https://dnschecker.org/#A/getkontax.com — should show green from most
locations within 5–10 minutes (given TTL 300).

### Step 6 — Verify HTTP access (pre-TLS)

Before TLS is provisioned, Coolify may serve HTTP on port 80. Verify:
```bash
curl -I http://getkontax.com
```
Expected: either 200 (if TLS is not yet enforced) or a redirect to HTTPS. If a
connection is refused, the Coolify proxy is not routing the domain — check Coolify's
traefik/nginx configuration.

## Acceptance Criteria

- [ ] `dig getkontax.com A +short` returns `<prod-ip>` from Google and Cloudflare
      DNS resolvers.
- [ ] `dig www.getkontax.com CNAME +short` returns `getkontax.com`.
- [ ] `dig api.getkontax.com CNAME +short` returns `getkontax.com`.
- [ ] Coolify shows all three domains configured in the production app.
- [ ] TTL for the apex A record is ≤ 300 seconds (verified in dig output:
      `dig getkontax.com A` and check the TTL column).
- [ ] `curl -I http://getkontax.com` returns a non-connection-refused response.

## Risks / Open Questions

- **Registrar propagation time**: some registrars have their own internal propagation
  delay on top of the TTL. Make the DNS change at least 30 minutes before the
  P34D-15 TLS verification step.
- **CNAME flattening**: if `getkontax.com` is on Cloudflare, use "Proxied" mode
  carefully — Cloudflare Proxy intercepts TLS. If Coolify is managing its own TLS
  (Let's Encrypt via HTTP-01 challenge), Cloudflare proxying can cause the ACME
  challenge to fail. Either use "DNS Only" (grey cloud) mode in Cloudflare, or
  switch to a DNS-01 ACME challenge. Decide this before pointing DNS.
- **Existing getkontax.com content**: if the domain currently points at a landing
  page or parked page, the cutover will immediately replace it. Ensure no live
  traffic depends on the existing DNS target.

## Documentation

- [ ] External · users — no changes needed
- [ ] External · developers — /developers: update the base URL to getkontax.com
- [x] Internal · ops — `roadmap/runbooks/`: note the prod server IP, DNS registrar
      login, and TTL lowering schedule
- [ ] Internal · engineering — docs/: no code changes
