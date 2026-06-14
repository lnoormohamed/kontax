# P34E-02 — Coolify: add api domain

## Purpose

Add `api.getkontax.com` as an additional domain in the Coolify application
configuration so that Coolify routes HTTPS traffic for the subdomain to the
Next.js app and provisions a valid Let's Encrypt TLS certificate automatically.

## Background

Coolify manages the deployment of Kontax on Proxmox LXC 114. It handles Traefik
reverse-proxy configuration and Let's Encrypt certificate issuance. Adding the
subdomain in Coolify's domain list is the only step needed for TLS — no manual
cert management is required. This ticket depends on P34E-01 (DNS must resolve
before Let's Encrypt ACME challenge can complete).

## Scope

**In scope**
- In the Coolify dashboard, navigate to the Kontax application settings →
  Domains section.
- Add `api.getkontax.com` alongside the existing entries (`getkontax.com`,
  `www.getkontax.com`).
- Trigger a redeploy (or Coolify's "update domains" action) so Traefik picks up
  the new domain and Let's Encrypt issues the certificate.
- Verify TLS: `curl -I https://api.getkontax.com` should return an HTTP
  response with a valid certificate (the response body may be 404 or a Next.js
  default — that is fine at this stage; middleware routing is added in P34E-03).

**Out of scope**
- Next.js middleware routing — see P34E-03.
- Any environment variable change.
- `www.api.getkontax.com` or other subdomains.

## Design / Implementation Spec

### Coolify domain configuration

Coolify domains are typically set as a comma-separated or newline-separated list
in the application's General or Network settings panel. The final list should be:

```
getkontax.com
www.getkontax.com
api.getkontax.com
```

After saving, Coolify triggers Traefik to:
1. Add a router rule for `api.getkontax.com`.
2. Request a Let's Encrypt certificate for the subdomain via HTTP-01 or TLS-ALPN
   challenge (whichever Coolify uses by default).

### Certificate verification

```bash
# Check TLS certificate
curl -v https://api.getkontax.com/health 2>&1 | grep -E "SSL|certificate|issuer"

# Or using openssl
openssl s_client -connect api.getkontax.com:443 -servername api.getkontax.com </dev/null 2>&1 | grep -E "subject|issuer|Verify"
```

Expected: certificate issued by Let's Encrypt, valid for `api.getkontax.com`,
not expired.

### If Let's Encrypt fails

Common causes: DNS not propagated yet (wait and retry), port 80 blocked (ACME
HTTP-01 challenge needs port 80 open), rate limit hit (unlikely for a new
subdomain). Check Coolify's certificate logs.

## Acceptance Criteria
- `api.getkontax.com` appears in the Coolify domain list for the Kontax
  application.
- `curl -v https://api.getkontax.com` completes the TLS handshake without
  certificate error.
- The certificate Common Name or SAN includes `api.getkontax.com`.
- The application is still reachable at `getkontax.com` and `www.getkontax.com`
  after the domain change (no regression).

## Risks / Open Questions
- Let's Encrypt rate limits: 50 certificates per registered domain per week.
  Adding one subdomain is well within limits, but verify there's no existing
  rate limit issue from prior certificate activity.
- If Coolify uses wildcard certificates (`*.getkontax.com`), this subdomain
  may already be covered and no action is needed beyond adding it to the router
  rules. Check the existing certificate SAN list first.
- Depends on P34E-01: DNS must resolve before Let's Encrypt can issue the cert.
  Do not attempt this ticket until `dig api.getkontax.com` returns a result.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): none required
- [ ] External · developers — /developers (P29-07): none yet (wait for P34E-07)
- [x] Internal · admins/ops — roadmap/runbooks/: document the Coolify domain
      list and certificate renewal notes
- [ ] Internal · engineering — docs/: none required
