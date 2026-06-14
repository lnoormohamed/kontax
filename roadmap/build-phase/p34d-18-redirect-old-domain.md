# P34D-18 — Redirect kontax.vexon.co → getkontax.com

## Purpose

Configure a permanent (301) redirect from `kontax.vexon.co` to `getkontax.com` that
preserves the URL path, so that existing bookmarks, links, and email links that
reference the staging domain continue to work after go-live.

## Background

After go-live on `getkontax.com`, the staging domain `kontax.vexon.co` will still
exist (Coolify is still running on the same server). Users who have bookmarked the
app, or received emails with `kontax.vexon.co` links (e.g. share links or public
card URLs), will continue to land on the staging environment rather than production
unless a redirect is in place.

The redirect must:
1. Be a 301 (permanent) redirect so that browsers and search engines update their
   cached URLs.
2. Preserve the path: `kontax.vexon.co/contacts` → `getkontax.com/contacts`.
3. Not break the staging environment for testing — the staging app must still be
   accessible for internal testing purposes after the redirect is in place.

## Scope

**In scope**
- 301 redirect from `kontax.vexon.co/*` to `getkontax.com/*`
- Path preservation in the redirect
- Keeping the redirect active for at least 6 months post-launch

**Out of scope**
- Redirecting the `vexon.co` apex domain or other subdomains
- Analytics tracking on redirect traffic (nice-to-have, out of scope)
- SES sending domain change (SES uses `noreply@vexon.co` which is at the apex level,
  not the subdomain — no change needed)

## Design / Implementation Spec

### Option A — Coolify redirect rule (preferred)

Coolify uses traefik as its reverse proxy. A redirect rule can be added without
deploying a separate application:

1. In Coolify, open the `kontax.vexon.co` application.
2. In the application settings → "Custom traefik configuration" (or equivalent),
   add a redirect middleware:

```yaml
# traefik labels or middleware configuration
http:
  middlewares:
    redirect-to-prod:
      redirectRegex:
        regex: "^https?://kontax\\.vexon\\.co(.*)"
        replacement: "https://getkontax.com${1}"
        permanent: true
  routers:
    kontax-staging-redirect:
      rule: "Host(`kontax.vexon.co`)"
      middlewares:
        - redirect-to-prod
      service: noop@internal
```

This approach keeps the staging app code running but redirects all external traffic
to production. Internal users who need to access staging can do so via an internal
IP or by temporarily disabling the redirect middleware.

### Option B — Separate minimal Coolify application

Deploy a minimal application (a 4-line `server.js` using Node's built-in HTTP module,
or a single-page Next.js app) that serves only 301 redirects:

```javascript
// server.js — minimal redirect server
const http = require('http');
http.createServer((req, res) => {
  const destination = `https://getkontax.com${req.url}`;
  res.writeHead(301, { Location: destination });
  res.end();
}).listen(3000);
```

Add to Coolify as a new application with domain `kontax.vexon.co`. This replaces the
staging app at that domain.

**Downside**: internal testers can no longer access staging at `kontax.vexon.co`.
They would need to access it via the internal IP or a different domain.

### Recommended approach

Use Option A (traefik redirect middleware) if Coolify supports custom middleware
configuration. This allows staging to remain accessible via the internal IP while
redirecting all external traffic to production.

If Option A is not available in the Coolify version in use, use Option B and
configure a new internal-only domain for staging (e.g. `staging.internal` via the
server's `/etc/hosts` or a local DNS entry).

### Verify the redirect

```bash
# Verify 301 redirect with path preservation
curl -I https://kontax.vexon.co/contacts

# Expected:
# HTTP/1.1 301 Moved Permanently
# Location: https://getkontax.com/contacts

# Follow the redirect
curl -L https://kontax.vexon.co/contacts
# Should eventually land on the Kontax app at /contacts
```

Also verify that the redirect preserves query strings:
```bash
curl -I "https://kontax.vexon.co/contacts?q=test"
# Expected Location: https://getkontax.com/contacts?q=test
```

### SES email template links

Verify that no SES email template currently generates links pointing to
`kontax.vexon.co`. This should be resolved in P34D-16 (URL audit). If P34D-16 is
complete, email links will use `NEXT_PUBLIC_APP_URL` and will point to
`getkontax.com` in production.

For any emails already sent with `kontax.vexon.co` links (e.g. a share link
generated before go-live), the 301 redirect will automatically forward those clicks
to the correct production URL.

## Acceptance Criteria

- [ ] `curl -I https://kontax.vexon.co` returns `301` with `Location: https://getkontax.com/`.
- [ ] `curl -I https://kontax.vexon.co/contacts` returns `301` with
      `Location: https://getkontax.com/contacts` (path preserved).
- [ ] `curl -I "https://kontax.vexon.co/s/share-token"` preserves the path in the
      redirect (share links still work via redirect).
- [ ] The redirect is documented as remaining active for at least 6 months
      (calendar reminder created).
- [ ] Staging remains accessible for internal use via an alternative access method.

## Risks / Open Questions

- **HTTPS on kontax.vexon.co**: the redirect must itself be served over HTTPS (so
  that browsers follow it). If the Let's Encrypt cert for `kontax.vexon.co` expires
  after go-live, the redirect will fail (browsers will show a cert error before
  following the redirect). Ensure Coolify continues to renew the cert for
  `kontax.vexon.co` for as long as the redirect is active.
- **Staging internal access method**: if the staging application is entirely replaced
  by the redirect (Option B), define an alternative access method for staging before
  implementing the redirect. Options: Coolify preview URL, internal IP + /etc/hosts,
  or a new `staging.getkontax.com` domain.
- **6-month retention**: set a calendar reminder for 6 months after go-live to review
  whether the redirect is still receiving traffic. If zero traffic, the staging domain
  can be decommissioned.

## Documentation

- [ ] External · users — no changes needed (redirect is transparent)
- [ ] External · developers — /developers: update any references to kontax.vexon.co
      with the production domain
- [x] Internal · ops — note the redirect implementation method and the 6-month review
      date in the ops runbook
- [ ] Internal · engineering — docs/: no code changes (unless Option B is chosen)
