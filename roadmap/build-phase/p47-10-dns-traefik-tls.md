# P47-10 — DNS / Cloudflare / Traefik routes + TLS end-to-end

**Phase:** 47 · **Workstream:** C · **Priority:** P0 · **Depends on:** —

## Objective

Confirm every production hostname resolves through Cloudflare → Traefik to the
right service, with valid TLS and no mixed content or empty-Host 404s.

## Hostnames to verify

| Hostname | Routes to | Notes |
|----------|-----------|-------|
| `getkontax.com` | Coolify app (LXC 122) | apex; Cloudflare proxied |
| `app.getkontax.com` | Coolify app | **decide** whether this is the canonical app origin (OAuth examples use it) — see P47-11 |
| `media.getkontax.com` | MinIO proxy (LXC 151) | must preserve `/kontax-uploads/…` path (P47-02) |
| `kontax.vexon.co` | staging | keep, or 301 → prod at cutover (P47-14) |

## Steps

1. **DNS** — confirm A/CNAME records for each hostname point at the Cloudflare
   edge; confirm proxied (orange-cloud) where TLS termination is at Cloudflare.
2. **Traefik domain rules** — in Coolify, set the app's Domains field to the
   full `https://<host>` value(s). **Known trap (P34D-11):** a bare host or
   misconfigured value generates an empty `Host()` rule → 404 on every request.
3. **TLS** — valid certificate on each hostname (Cloudflare edge and/or Traefik
   origin cert); no expiry inside 30 days; TLS ≥1.2; HSTS as configured.
4. **Mixed content** — load the app over HTTPS and confirm no `http://` subresource
   requests (esp. avatar/media URLs — they must be `https://media.getkontax.com`).
5. **Redirect hygiene** — `http://` → `https://`; decide apex vs `www`/`app`
   canonicalisation (feeds P47-11).

## Acceptance

- Each hostname returns the right service over valid HTTPS (200, correct cert).
- No empty-Host 404 (P34D-11 trap cleared).
- No mixed-content warnings on the app.
- Recorded on the P47-01 checklist.

## References

- Infra memory §DNS / Known issue fixed in P34D-11
- Depends into [P47-11](p47-11-url-host-audit-security-headers.md) (origin decision)
</content>
