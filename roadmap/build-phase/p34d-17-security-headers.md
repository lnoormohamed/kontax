# P34D-17 — Add Security Headers via next.config.js

## Purpose

Add HTTP security headers to all responses from the Next.js application via the
`headers()` function in `next.config.js`. Deploy Content-Security-Policy in
report-only mode initially to audit violations before switching to enforcement.

## Background

Next.js does not add security headers by default. Without them:
- `X-Frame-Options: DENY` is absent → the app can be embedded in iframes (clickjacking risk)
- `Strict-Transport-Security` is absent → browsers don't enforce HTTPS on repeat visits
- `X-Content-Type-Options: nosniff` is absent → MIME-sniffing attacks are possible

CSP is the most complex header. A too-strict CSP breaks Stripe.js, Google OAuth, and
other legitimate third-party scripts. Starting in report-only mode allows violations
to be observed without breaking the app.

This ticket is a prerequisite for P34D-15 (HSTS verification) and P34D-19 (security
checklist).

## Scope

**In scope**
- HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
  added to all routes
- CSP in `Content-Security-Policy-Report-Only` mode initially
- CSP directive covering: self, Stripe.js, Google APIs, data:, blob:
- Code change in `next.config.js` headers() function
- Build verification (no TypeScript errors)

**Out of scope**
- CSP in enforcing mode (switch after 2 weeks of report-only — out of scope for this
  launch phase, planned for post-launch sprint)
- CSP reporting endpoint (nice-to-have; if one doesn't exist, omit `report-uri`)
- Feature-Policy (deprecated in favour of Permissions-Policy, already covered)

## Design / Implementation Spec

### next.config.js changes

Open `next.config.js` (or `next.config.mjs`) and add or extend the `headers()`
export:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config ...

  async headers() {
    const securityHeaders = [
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      },
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
      // CSP in Report-Only mode — switch to Content-Security-Policy after
      // 2 weeks with no legitimate violations
      {
        key: 'Content-Security-Policy-Report-Only',
        value: [
          "default-src 'self'",
          // Stripe.js and Stripe Checkout
          "script-src 'self' 'unsafe-inline' https://js.stripe.com https://checkout.stripe.com",
          "frame-src https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com",
          "connect-src 'self' https://api.stripe.com https://checkout.stripe.com",
          // Google APIs (for OAuth / sync)
          "connect-src 'self' https://accounts.google.com https://www.googleapis.com",
          // Images: self, data URIs (inline SVGs), and any CDN if used
          "img-src 'self' data: https:",
          // Styles: self and inline (for Next.js)
          "style-src 'self' 'unsafe-inline'",
          // Fonts: self
          "font-src 'self'",
          // Object/media: none
          "object-src 'none'",
          // Blob: for vCard downloads
          "worker-src blob:",
        ].join('; '),
      },
    ];

    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
```

**Note on `connect-src`**: the `connect-src` directive appears twice in the array
above for clarity; in practice, merge all `connect-src` values into one directive:
```
"connect-src 'self' https://api.stripe.com https://checkout.stripe.com https://accounts.google.com https://www.googleapis.com"
```

### CSP directive notes

- `'unsafe-inline'` in `script-src` is required for Next.js inline scripts (the
  `__NEXT_DATA__` hydration script). Next.js 13+ supports nonces to avoid this,
  but implementing nonces requires additional middleware. Accept `'unsafe-inline'`
  for the initial launch; plan to remove it in a follow-up with nonce support.
- `'unsafe-eval'` is NOT included — verify no library in the bundle requires it.
  If the Stripe.js SDK or a dev tool requires eval, note it.
- `frame-src` covers Stripe's iframe-based payment elements.

### Verification

After deploying:
```bash
curl -I https://getkontax.com | grep -iE "strict-transport|x-frame|x-content|referrer|permissions|content-security"
```

Expected output should include all 6 headers.

Also verify the app still works after the headers are added — in particular:
- Stripe Checkout loads (not blocked by frame-src)
- Google OAuth redirect works (not blocked by CSP)
- vCard downloads work (blob: in worker-src)

### Switch to enforcing CSP (post-launch sprint, not this ticket)

After 2 weeks in report-only mode with no legitimate violations logged:
1. Change `Content-Security-Policy-Report-Only` to `Content-Security-Policy`
2. Remove any directives that caused false violations
3. Deploy and monitor for breakage

## Acceptance Criteria

- [ ] `next.config.js` contains a `headers()` function returning security headers for
      `source: '/(.*)'`.
- [ ] `curl -I https://getkontax.com | grep strict-transport` returns the HSTS header.
- [ ] `curl -I https://getkontax.com | grep x-frame` returns `DENY`.
- [ ] `curl -I https://getkontax.com | grep x-content` returns `nosniff`.
- [ ] CSP is present as `Content-Security-Policy-Report-Only` (not enforcing at
      launch).
- [ ] Stripe Checkout still loads and functions correctly after headers are deployed.
- [ ] App builds with `next build` without errors after config change.
- [ ] securityheaders.com scan shows grade A or A+ (note: CSP report-only may limit
      grade to A rather than A+; that is acceptable for launch).

## Risks / Open Questions

- **HSTS preload list**: the HSTS header includes `preload`. To actually be on the
  HSTS preload list, the domain must be submitted to https://hstspreload.org. This is
  a one-way action with a long removal process. Do not submit until confident the
  domain will stay on HTTPS forever. The header can include `preload` without being
  on the list — it is just a signal.
- **Next.js middleware**: if Kontax uses a `middleware.ts` file that sets headers, it
  may conflict with or override `headers()` from `next.config.js`. Check for any
  header-related code in middleware before and after deploying.
- **API routes**: API routes under `/api/` should inherit the same headers. Verify
  that `/api/auth/signin` does not have `X-Frame-Options: DENY` blocking anything
  (it shouldn't — auth forms are navigated to directly, not iframed).
- **`'unsafe-inline'` in script-src**: this weakens the CSP's XSS protection. Track
  the nonce implementation as a P1 post-launch item.

## Documentation

- [ ] External · users — no changes needed
- [ ] External · developers — /developers: note that API responses include rate limit
      and security headers (covered in the API docs, not here)
- [x] Internal · ops — note the CSP report-only switch date in the ops runbook (2 weeks
      post-launch)
- [x] Internal · engineering — `docs/security.md` (or equivalent): document the header
      strategy and the plan to move CSP to enforcing mode
