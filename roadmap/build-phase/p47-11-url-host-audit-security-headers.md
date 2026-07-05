# P47-11 — URL/host audit + security headers / CSP media parity

**Phase:** 47 · **Workstream:** C · **Priority:** P0 · **Depends on:** P47-10

## Objective

Pick **one** canonical app origin, purge every baked staging/homelab URL, and
confirm security headers (esp. CSP `img-src`) allow the prod media host. This is
the codebase-hygiene half of the cutover, complementing P47-10's infra half.

## The origin decision (blocks P47-07)

The app references two app origins inconsistently:
- `.env.example` OAuth examples → `app.getkontax.com`
- Infra memory / cron → `getkontax.com`

Pick one canonical app origin and make everything agree: `APP_URL`,
`GOOGLE_REDIRECT_URI`, `MICROSOFT_REDIRECT_URI`, the Stripe webhook URL, cron
target host, and Traefik domain. Record the decision on the P47-01 checklist so
P47-07/08/10 use it.

## Steps

1. **URL audit** — grep the codebase for hardcoded hosts:
   - `kontax.vexon.co`, `vexon.co` (staging)
   - `10.0.0.` / `192.168.1.` (homelab private IPs — must never be browser-facing)
   - `localhost:3000`, `media-staging.getkontax.com`
   Anything user-facing must derive from `APP_URL` / `MINIO_PUBLIC_URL`, not a
   literal. Fix or confirm each hit is dev-only.
2. **Baked avatar hosts** — the prod DB is empty pre-launch, so there should be
   **no** baked `10.0.0.144:9000` avatar URLs to rewrite (unlike staging). Confirm
   with a query; if any exist, `scripts/rewrite-avatar-host.mjs` (dry-run first)
   → `https://media.getkontax.com/kontax-uploads`.
3. **CSP `img-src`** — confirm `media.getkontax.com` is allowed. It is the
   **built-in legacy match** in `next.config.js` + `middleware.ts`, so if
   `MINIO_PUBLIC_URL` uses that origin, no manual CSP edit is needed
   (env-secrets §P46-02). Verify the header on a live response, don't assume.
4. **Security headers** — confirm the sec-02 CSP (no `unsafe-inline` where
   removed), plus standard headers (HSTS, X-Content-Type-Options, Referrer-Policy,
   frame-ancestors) are present on live responses.
5. **Middleware static allowlist** — confirm `/format/*` public artifacts (P45-07)
   and other non-image static files aren't caught by the auth redirect.

## Acceptance

- One canonical app origin, consistent across env, OAuth, Stripe, cron, Traefik.
- Grep finds zero browser-facing staging/homelab URLs.
- Live response headers include the expected CSP with `media.getkontax.com` in
  `img-src`, plus the sec-02 header set.
- Recorded on the P47-01 checklist.

## References

- env-secrets §P46-02 (CSP/media host) · `next.config.js`, `middleware.ts`
- `scripts/rewrite-avatar-host.mjs` · sec-02 (CSP), P45-07 (`/format/` allowlist)
</content>
