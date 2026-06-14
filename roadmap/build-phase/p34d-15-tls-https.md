# P34D-15 — Verify HTTPS / TLS End-to-End

## Purpose

Confirm that all three production domains (`getkontax.com`, `www.getkontax.com`,
`api.getkontax.com`) serve valid HTTPS with Let's Encrypt certificates, that HTTP
redirects to HTTPS, and that the HSTS header is present. Confirm certificate
auto-renewal is configured.

## Background

Coolify provisions Let's Encrypt certificates automatically via traefik for every
domain added to a Coolify application. However, this requires:
1. DNS to resolve the domain to the server IP (P34D-14 must be complete).
2. Port 80 to be open (for the HTTP-01 ACME challenge).
3. The domain to not be behind a Cloudflare Proxy (unless DNS-01 is configured).

This ticket depends on P34D-14 (DNS propagated) and P34D-17 (HSTS header from
next.config.js). The HSTS header check in this ticket is the integration test for
P34D-17.

## Scope

**In scope**
- Verify TLS certificate validity on all three domains
- Verify HTTP → HTTPS redirect on apex domain
- Verify HSTS header is present in responses
- Verify certificate expiry date and auto-renewal mechanism
- Verify `www` redirects or resolves correctly (no naked HTTP fallback)

**Out of scope**
- HPKP (HTTP Public Key Pinning) — deprecated, do not implement
- Certificate transparency logging — automatic with Let's Encrypt
- mTLS for the API subdomain — future phase

## Design / Implementation Spec

### Step 1 — Verify TLS handshake on all domains

```bash
# Apex domain
curl -I https://getkontax.com
# Expected: 200 OK (or redirect), no TLS error, no "certificate verify failed"

# www subdomain
curl -I https://www.getkontax.com
# Expected: 200 or 301 redirect to apex

# API subdomain
curl -I https://api.getkontax.com
# Expected: 200 or 404 (API route — not a full page), no TLS error
```

If any of these returns `curl: (60) SSL certificate problem: unable to get local
issuer certificate`, the Let's Encrypt cert has not been issued. Check:
1. DNS propagated? (`dig getkontax.com A` returns the server IP)
2. Port 80 open? (`curl http://getkontax.com` reaches the server)
3. Coolify traefik logs for ACME errors

### Step 2 — Verify certificate details

```bash
openssl s_client -connect getkontax.com:443 -servername getkontax.com \
  < /dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

Expected output:
```
subject=CN = getkontax.com
issuer=C = US, O = Let's Encrypt, CN = R3  (or E5/R10/E6 depending on issuance date)
notBefore=<issue date>
notAfter=<issue date + 90 days>
```

Let's Encrypt certificates are valid for 90 days. Auto-renewal should trigger at
~60 days (30 days remaining). Verify Coolify's renewal is active — check Coolify's
traefik container logs or the Coolify web UI for the certificate status.

### Step 3 — Verify HTTP → HTTPS redirect

```bash
curl -I http://getkontax.com
```

Expected response:
```
HTTP/1.1 301 Moved Permanently
Location: https://getkontax.com/
```

If Coolify's traefik does not automatically redirect HTTP to HTTPS, add the redirect
rule in the Coolify application settings (traefik entrypoints redirect middleware).

### Step 4 — Verify HSTS header

```bash
curl -I https://getkontax.com | grep -i strict-transport
```

Expected:
```
strict-transport-security: max-age=31536000; includeSubDomains; preload
```

This header is added by the Next.js `headers()` config in P34D-17. If P34D-17 is
not yet complete, this check will fail — that is expected; come back to this check
after P34D-17 is deployed.

### Step 5 — Verify www behaviour

```bash
curl -I https://www.getkontax.com
```

Either:
- Returns 200 (www serves the same app), OR
- Returns 301 to `https://getkontax.com` (canonical redirect)

Both are acceptable. Document which behaviour is active. If www returns 404 or a
TLS error, the domain is not correctly routed in Coolify.

### Step 6 — Full check with curl -v

For a complete view of the TLS handshake and headers:
```bash
curl -v https://getkontax.com 2>&1 | head -60
```
Look for: `SSL connection using TLSv1.3`, `Server certificate` block with
`issue date` and `expire date`, and the HTTP response code.

### Step 7 — securityheaders.com scan

After P34D-17 is deployed (security headers), run a scan:
- Visit https://securityheaders.com/?q=getkontax.com
- Expected grade: A or A+
- Record the grade in `roadmap/runbooks/smoke-test-results-v1.md` → Infrastructure
  section.

## Acceptance Criteria

- [ ] `curl -I https://getkontax.com` → 200 with no TLS error.
- [ ] `curl -I https://www.getkontax.com` → 200 or 301.
- [ ] `curl -I https://api.getkontax.com` → no TLS error (200, 401, or 404 is fine).
- [ ] `curl -I http://getkontax.com` → 301 redirect to HTTPS.
- [ ] `openssl x509 -noout -dates` shows a valid Let's Encrypt certificate.
- [ ] HSTS header present (after P34D-17 is deployed).
- [ ] Coolify certificate auto-renewal is active (visible in Coolify UI or traefik logs).

## Risks / Open Questions

- **Cloudflare proxy interference**: if getkontax.com is proxied through Cloudflare
  (orange cloud), the certificate seen by visitors is a Cloudflare edge cert, not the
  Let's Encrypt cert from the origin. This is fine for users but makes the
  `openssl s_client` check show a Cloudflare cert. Be aware of this when
  interpreting the cert subject.
- **SAN coverage**: the Let's Encrypt cert should cover both `getkontax.com` and
  `www.getkontax.com` (SAN). Check the cert's Subject Alternative Names:
  ```bash
  openssl s_client -connect getkontax.com:443 -servername getkontax.com \
    < /dev/null 2>/dev/null | openssl x509 -noout -text | grep -A2 "Subject Alternative"
  ```
- **api.getkontax.com**: this subdomain needs its own certificate entry. Verify
  Coolify issued a cert for it specifically, or that the wildcard cert (if used)
  covers `*.getkontax.com`.
- **Port 443 firewall**: confirm the Proxmox firewall allows inbound 443 from all IPs
  (not just Stripe or a specific range).

## Documentation

- [ ] External · users — no changes needed
- [ ] External · developers — /developers: note that the API is served over HTTPS at
      `https://api.getkontax.com`
- [x] Internal · ops — note TLS verification results and cert expiry date in ops runbook
- [ ] Internal · engineering — docs/: no code changes in this ticket
