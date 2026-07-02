# Phase SEC — Security Hardening (Review Findings)

> Fixes for issues surfaced by the security review of the current codebase and
> the `kontax.vexon.co` staging deployment. Ordered by severity and blast radius.

## Phase status
Complete — all three shipped to staging.

## Phase objective
Close the confirmed, exploitable vulnerabilities found in review and remove the
CSP weakness that turns an otherwise-contained bug into a live exploit.

## Tickets

> Build-ready detail in the standalone files:
> - [SEC-01 — Fix stored XSS in public-card JSON-LD output](sec-01-jsonld-stored-xss.md) · **HIGH** · ✅ done (`5531e2a`)
> - [SEC-02 — Remove `'unsafe-inline'` from the script-src CSP](sec-02-csp-remove-unsafe-inline.md) · defense-in-depth · ✅ done, Option C (`0fd01e4`)
> - [SEC-03 — Verify SNS signatures on the SES events webhook (blind SSRF)](sec-03-ses-webhook-ssrf.md) · **MEDIUM** · ✅ done

## Suggested implementation order
1. SEC-01 — stops the confirmed stored XSS (ship first, smallest change)
2. SEC-03 — closes the unauthenticated SSRF on the SES webhook
3. SEC-02 — CSP hardening; would have neutralized SEC-01 on its own

## Why this phase sits here
These are correctness/security bugs, not feature work. SEC-01 is a confirmed
stored XSS on a public, unauthenticated page and should be treated as a hotfix.
SEC-02 and SEC-03 are hardening that reduce the chance a future bug becomes
exploitable.

## Documentation
- [ ] External · users — no user-facing change
- [ ] Internal · engineering — record fixes and CSP rationale
- [ ] Internal · QA — XSS regression check on `/u/[username]`
