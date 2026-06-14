# P34D-19 — Pre-Production Security Checklist

## Purpose

Run a structured security checklist against the production environment
(`getkontax.com`) before the go-live sign-off. Each item includes the check method,
expected result, and a pass/fail column. All items must pass before P34D-23.

## Background

This checklist covers the intersection of the deployed infrastructure (P34D-14 through
P34D-18) and the application's own security controls (auth, admin access, rate
limiting, webhook signature validation). It is not a penetration test — it is a
baseline verification that obvious misconfigurations are not present.

A full penetration test is recommended post-launch as a follow-up engagement.

## Scope

**In scope**
- HTTPS enforcement and HSTS header
- X-Frame-Options and X-Content-Type-Options headers
- Admin route protection (`/admin` requires admin role)
- API authentication (`/api/contacts` requires valid session)
- Rate limiting on sign-in
- NEXTAUTH_SECRET freshness check
- Stripe webhook signature verification
- `.env` file not publicly accessible
- No unauthenticated admin API routes

**Out of scope**
- SQL injection testing (application-level, not smoke test scope)
- XSS payload testing (CSP coverage)
- Full OWASP Top 10 assessment

## Design / Implementation Spec

Run all checks from a machine outside the production server (i.e. over the public
internet, not localhost). Use `curl` unless otherwise noted.

Before running: have two browser sessions ready:
- **Regular user session**: a non-admin account cookie (use the session cookie from
  a logged-in Chrome incognito window; copy via DevTools → Application → Cookies)
- **No session**: plain curl requests (no cookie header)

Record results in `roadmap/runbooks/smoke-test-results-v1.md` → Security section.

## Checklist

| # | Check | Command / Method | Expected Result | Actual Result | Pass/Fail |
|---|-------|-----------------|-----------------|---------------|-----------|
| S-01 | HTTPS enforced | `curl -I http://getkontax.com` | `301 Moved Permanently` → Location: https://getkontax.com | | |
| S-02 | HSTS header present | `curl -I https://getkontax.com \| grep strict-transport` | `strict-transport-security: max-age=31536000; includeSubDomains; preload` | | |
| S-03 | X-Frame-Options DENY | `curl -I https://getkontax.com \| grep -i x-frame` | `x-frame-options: DENY` | | |
| S-04 | X-Content-Type-Options nosniff | `curl -I https://getkontax.com \| grep -i x-content-type` | `x-content-type-options: nosniff` | | |
| S-05 | /admin protected — non-admin | Log in as a regular (non-admin) user. Navigate to `/admin` in the browser. | HTTP 403 response, or redirect to /login, or an "Access denied" page. NOT a 200 response showing admin UI. | | |
| S-06 | /admin protected — no session | `curl https://getkontax.com/admin` | Redirect to /login or 401. NOT 200 with admin content. | | |
| S-07 | /api/contacts requires session | `curl https://getkontax.com/api/contacts` (no cookie) | `401 Unauthorized` JSON response. | | |
| S-08 | /api/contacts with invalid session | `curl -H "Cookie: next-auth.session-token=fakeinvalidvalue" https://getkontax.com/api/contacts` | `401 Unauthorized`. Not a 500 or a data leak. | | |
| S-09 | Rate limiting on sign-in | Send 6 consecutive POST requests to `/api/auth/signin` with wrong password: `for i in $(seq 1 6); do curl -s -o /dev/null -w "%{http_code}\n" -X POST https://getkontax.com/api/auth/signin -d '{"email":"test@example.com","password":"wrong"}' -H "Content-Type: application/json"; done` | The 5th or 6th request returns 429 (Too Many Requests) or a lockout response. (Exact threshold may vary.) | | |
| S-10 | NEXTAUTH_SECRET is not default | This cannot be checked from outside the server. Check in Coolify: the production `NEXTAUTH_SECRET` must differ from the staging value. Verify visually in Coolify env vars (they should be different strings). | Production and staging NEXTAUTH_SECRET values are different. | | |
| S-11 | Stripe webhook rejects bad signature | `curl -X POST https://getkontax.com/api/webhooks/stripe -H "Content-Type: application/json" -H "Stripe-Signature: t=1,v1=invalidsignature" -d '{"type":"test"}'` | `400 Bad Request`. NOT 200. The handler must reject requests without a valid Stripe-Signature. | | |
| S-12 | .env file not publicly accessible | `curl -I https://getkontax.com/.env` | `404 Not Found` (or 403). Definitely NOT 200 with env file content. | | |
| S-13 | .env.example not publicly accessible | `curl -I https://getkontax.com/.env.example` | `404 Not Found`. | | |
| S-14 | No admin function without auth | Check every `/api/admin/*` route. `curl https://getkontax.com/api/admin/users` (no cookie) | 401 or 403 for all admin API routes. None return data without authentication. | | |
| S-15 | Referrer-Policy header present | `curl -I https://getkontax.com \| grep -i referrer` | `referrer-policy: strict-origin-when-cross-origin` | | |

## Acceptance Criteria

- All 15 checklist items pass before P34D-23 go-live execution.
- Any failure is classified P0 or P1:
  - S-05, S-06, S-07, S-08, S-09, S-11, S-12, S-14 failures are **P0** (security)
  - S-01, S-02, S-03, S-04, S-10, S-13, S-15 failures are **P1** (important but
    not immediate data/security breach risk)
- Results recorded in `roadmap/runbooks/smoke-test-results-v1.md`.

## Risks / Open Questions

- **Rate limiting (S-09)**: if rate limiting is not implemented at all, this is a P0.
  The check should fail within 6 attempts. If all 6 return 200 (no limiting), open an
  urgent P0 before go-live.
- **Admin API routes**: the specific paths of admin API routes may not be known at
  checklist time. Check the codebase for any `export async function GET/POST` under
  `src/app/api/admin/` and test each one.
- **Session cookie name**: NextAuth's default session cookie is
  `next-auth.session-token` in production (HTTPS). On staging (HTTP), it may be
  `next-auth.session-token` or `__Secure-next-auth.session-token`. Use the correct
  name from DevTools when constructing S-08.

## Documentation

- [ ] External · users — no changes needed
- [ ] External · developers — /developers: no changes needed
- [x] Internal · ops — `roadmap/runbooks/smoke-test-results-v1.md`: Security section
- [x] Internal · ops — flag any P0 security findings for immediate engineering
      escalation before go-live
- [ ] Internal · engineering — docs/: no code changes in this ticket
