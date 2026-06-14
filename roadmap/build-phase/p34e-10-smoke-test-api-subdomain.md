# P34E-10 — Smoke test: api subdomain

## Purpose

Run a structured manual smoke test to verify that the full `api.getkontax.com`
stack (DNS → TLS → middleware rewrite → auth → rate limiting → CORS) works
end-to-end before the subdomain is considered production-ready.

## Background

Phase 34E is a stack of infrastructure changes (DNS, Coolify, middleware, CORS).
Each ticket has its own acceptance criteria, but a final end-to-end verification
is necessary to catch interactions between layers — e.g. the middleware rewrite
stripping CORS headers, or the OPTIONS handler being bypassed by auth middleware.
This ticket is a manual test script that should be run once all of P34E-01
through P34E-09 are complete.

## Scope

**In scope**
- Seven manual test cases covering auth, success, create, rate limit headers,
  CORS preflight, non-v1 path non-rewrite, and TLS validity.
- Each test case has a command and expected output.
- A checklist to tick off each test case as it passes.
- Document any failures as bugs with the relevant ticket to fix.

**Out of scope**
- Automated regression tests (valuable but out of scope for this phase).
- Performance or load testing.
- Testing on the old `getkontax.com/api/v1` path (assumed still working).

## Design / Implementation Spec

### Prerequisites

Before running the smoke test:
- [ ] P34E-01 complete: `dig api.getkontax.com` resolves.
- [ ] P34E-02 complete: TLS cert issued.
- [ ] P34E-03 complete: middleware deployed.
- [ ] P34E-04 + P34E-05 complete: CORS headers and OPTIONS handler in place.
- [ ] A valid API token (`kt_live_xxx`) is available for testing.
  Create a temporary test token in Settings → API Tokens.

### Test cases

**TC-1: No auth → 401**
```bash
curl -s -o /dev/null -w "%{http_code}" https://api.getkontax.com/v1/contacts
```
Expected: `401`

**TC-2: Valid token → 200 with contact array**
```bash
curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer kt_live_xxx" \
  https://api.getkontax.com/v1/contacts
```
Expected: `200` with a JSON array body (may be `[]` if no contacts exist).

**TC-3: POST create contact → 201**
```bash
curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer kt_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Smoke","lastName":"Test"}' \
  https://api.getkontax.com/v1/contacts
```
Expected: `201` with the created contact object. Clean up the test contact
after the test.

**TC-4: Rate limit headers present**
```bash
curl -s -I -H "Authorization: Bearer kt_live_xxx" \
  https://api.getkontax.com/v1/contacts | grep -i "x-ratelimit"
```
Expected: at least `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers
present.

**TC-5: CORS OPTIONS preflight → 200**
```bash
curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization" \
  https://api.getkontax.com/v1/contacts
```
Expected: `200`

Verify CORS headers in verbose output:
```bash
curl -v -X OPTIONS \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization" \
  https://api.getkontax.com/v1/contacts 2>&1 | grep -i "access-control"
```
Expected: `access-control-allow-origin: *` and other CORS headers present.

**TC-6: Non-v1 path is NOT rewritten**
```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://api.getkontax.com/api/auth/session
```
Expected: any response that is NOT a 404 caused by double-prefixing to
`/api/api/auth/session`. The middleware guard (`!pathname.startsWith("/api/")`)
must prevent this. Acceptable responses: 200, 401, or a NextAuth-handled
redirect.

**TC-7: TLS certificate valid**
```bash
curl -v https://api.getkontax.com/v1/contacts \
  -H "Authorization: Bearer kt_live_xxx" 2>&1 | grep -E "SSL|certificate|issuer|verify"
```
Expected: no SSL error lines; `SSL connection using TLS` or similar; no
`certificate verify failed`.

### Test result checklist

- [ ] TC-1 PASS: 401 without auth
- [ ] TC-2 PASS: 200 with valid token
- [ ] TC-3 PASS: 201 on POST create
- [ ] TC-4 PASS: rate limit headers present
- [ ] TC-5 PASS: OPTIONS preflight 200 with CORS headers
- [ ] TC-6 PASS: non-v1 path not double-rewritten
- [ ] TC-7 PASS: TLS certificate valid

### On failure

For each failing test case, note: the command run, the actual response, and the
ticket responsible for that layer. File a bug against the relevant P34E ticket
and block go-live until resolved.

## Acceptance Criteria
- All seven test cases pass.
- The test result checklist is filled in and attached to this ticket (or to the
  Phase 34E summary) before the phase is marked complete.
- Any failures are documented as bugs against the specific P34E ticket.

## Risks / Open Questions
- TC-3 creates a real contact in production. Remember to delete the "Smoke Test"
  contact after testing, or use a staging environment for TC-3.
- If a staging environment exists, run all seven test cases there before
  production.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12): none required
- [ ] External · developers — /developers (P29-07): none required
- [x] Internal · admins/ops — roadmap/runbooks/: save the smoke test commands
      in the runbook as a "verify api subdomain" checklist for future deployments
- [ ] Internal · engineering — docs/: none required
