# Phase 48 — Security audit remediation & launch hardening

## Overview

Phase 48 closes the findings of the **2026-09-14 security review and
engineering audit** of the codebase and the live pre-prod deployment on
`getkontax.com` (commit `ab10c61`). The audit ran six parallel code reviews
(auth and account lifecycle, every API route, all 177 server actions, the
CardDAV server, the sync engine and credential handling, infra/schema/code
health), re-verified every Critical and High in source, ran `npm audit`,
scanned git history for secrets, and probed the live origin with
unauthenticated requests only.

Full report (private artifact): https://claude.ai/artifact/CrtWbtXDkb87gpjyotJ8GP

**Tally:** 2 critical · 9 high · 22 medium · 20 low.

The foundations are sound — hashed tokens throughout, AES-256-GCM for TOTP
secrets and sync credentials, a real session-revocation model, a strict CSP,
signature-checked Stripe and SNS webhooks, and a properly hardened SSRF guard
on the image proxy. The problems cluster in three places, plus one build
blocker:

1. **2FA is decorative.** The only gate redirecting password-only sessions to
   the TOTP challenge lived in the edge middleware and was removed in
   `b332c94`; nothing replaced it. A second bypass lets the client clear the
   pending-2FA flag itself.
2. **The CardDAV paths never got the SSRF hardening the image proxy has.** Any
   free-tier user can point a connection at the LAN, cloud metadata or
   localhost with a reliable error oracle, and cron re-probes it.
3. **The custom CardDAV server is a DoS surface.** Unbounded bodies plus a
   quadratic regex stall the whole Node process; the brute-force limiter keys
   on the proxy IP so 20 bad requests lock CardDAV for everyone.
4. **`npm ci` fails** (lockfile drift), so every CI run since 2 July 2026 has
   failed and a fresh Docker build cannot succeed. The regression lane has not
   run on `main` in over two months.

This phase is a **hardening phase, not feature work**: every ticket maps to
audit findings, cites the file:line evidence, and has a testable acceptance
criterion. P0 tickets block go-live (P47-14).

### Workstream A — Authentication & sessions (P48-01 → P48-03)
Restore 2FA enforcement through one central session guard, make account
deletion recoverable, and close the auth-flow gaps (reset cache, unverified
email claims, LOCKED users on tokens, open redirects).

### Workstream B — Outbound requests (P48-04)
One hardened fetcher, reused from `safe-image-fetch.ts`, for every CardDAV
call, discovered href, photo URI and the photo pass.

### Workstream C — Authorization & tenant isolation (P48-05 → P48-07)
Close the cross-user reads/writes, make impersonation genuinely read-only,
and apply the sharing policy to shared copies.

### Workstream D — CardDAV server (P48-08 → P48-09)
Body caps and linear parsing; correct client IP, Redis-backed limits, a
verified-credential cache, read-only book scoping.

### Workstream E — API routes & data handling (P48-10 → P48-11)
Guard the unguarded endpoints; bound and sanitise imports and exports.

### Workstream F — Dependencies, build & CI (P48-12 → P48-13)
Upgrade the vulnerable packages, regenerate the lockfile, make CI actually
gate on typecheck/lint/build, add authorization regression tests.

### Workstream G — Infrastructure, schema & operations (P48-14 → P48-17)
Migrations baseline, cascade fixes, non-root image, rate-limit outage
policy, credential key rotation, and residual hardening including making the
`/security` page true.

---

## Tickets

| Ticket | Title | Workstream | Priority | Depends on |
| --- | --- | --- | --- | --- |
| [P48-01](p48-01-enforce-2fa-central-session-guard.md) | Enforce 2FA: central session guard + remove client-side clear | A | P0 | — |
| [P48-02](p48-02-account-deletion-recoverable-step-up.md) | Account deletion: recoverable grace state + server-side step-up | A | P0 | P48-01 |
| [P48-03](p48-03-auth-flow-hygiene.md) | Auth-flow hygiene: reset cache, reset IP, unverified claims, LOCKED on tokens, old-email notice, open redirects | A | P1 | P48-01 |
| [P48-04](p48-04-hardened-outbound-fetcher-carddav.md) | Hardened outbound fetcher for CardDAV, discovered hrefs, photo URIs and the photo pass | B | P0 | — |
| [P48-05](p48-05-cross-user-access-fixes.md) | Cross-user access fixes: merge suggestion, avatar delete, sync-job delete, REST `bookId` | C | P0 | — |
| [P48-06](p48-06-impersonation-readonly-enforcement.md) | Impersonation read-only + `pendingDeletion` enforcement across actions and API routes | C | P1 | P48-01 |
| [P48-07](p48-07-sharing-policy-on-copies-snapshots.md) | Apply the sharing policy to shared copies and snapshots | C | P1 | — |
| [P48-08](p48-08-dav-body-caps-linear-xml-parsing.md) | DAV request body caps, linear XML parsing, request timeouts | D | P0 | — |
| [P48-09](p48-09-dav-auth-rate-limit-client-ip.md) | DAV auth: client IP, Redis-backed limits, credential cache, read-only book scope, headers | D | P0 | P48-08 |
| [P48-10](p48-10-cron-and-internal-endpoint-guards.md) | Cron and internal endpoint guards: `cleanup-card-views`, `/api/sync/run`, timing-safe compares | E | P0 | — |
| [P48-11](p48-11-import-export-hardening.md) | Import/export hardening: archive content types, zip bounds, CSV caps, formula injection, iCal CRLF, error passthrough | E | P1 | — |
| [P48-12](p48-12-dependency-upgrades-lockfile.md) | Dependency upgrades, lockfile regeneration, image optimizer off, Host pinning | F | P0 | — |
| [P48-13](p48-13-ci-gates-lint-debt-authz-tests.md) | CI gates (check + build), lint debt, authorization regression tests | F | P1 | P48-12 |
| [P48-14](p48-14-prisma-migrations-cascades-billing.md) | Prisma migrations baseline, unique constraints, cascade and billing-on-delete fixes | G | P1 | — |
| [P48-15](p48-15-runtime-image-hardening.md) | Runtime image hardening: non-root, pruned, no `src`/`scripts`/`generated`, HEALTHCHECK | G | P1 | P48-12 |
| [P48-16](p48-16-rate-limit-policy-env-key-rotation.md) | Rate-limit outage policy, required prod env, sync-credential key rotation | G | P1 | — |
| [P48-17](p48-17-residual-hardening-security-page.md) | Residual hardening & `/security` page truth | G | P2 | P48-01 |

---

## Suggested execution order

1. **P48-12** first — nothing else can be verified in CI until `npm ci` works.
2. **P48-01**, **P48-05**, **P48-10** — the three smallest P0s with the largest
   blast radius (2FA, cross-user access, unguarded endpoints). Ship as hotfixes.
3. **P48-04**, **P48-08**, **P48-09** — SSRF and the CardDAV server.
4. **P48-02**, **P48-06**, **P48-03** — the rest of the auth track (all build on
   the P48-01 helper).
5. **P48-13** — turn CI green and gating; land authz tests alongside the fixes.
6. **P48-07**, **P48-11**, **P48-14**, **P48-15**, **P48-16** — P1 hardening.
7. **P48-17** — residuals; make the `/security` page true before launch.

---

## Finding → ticket map

| Audit finding | Sev | Ticket |
| --- | --- | --- |
| 2FA never enforced (`config.ts:191-198`, middleware `b332c94`, `login-form.tsx:42`) | Critical | P48-01 |
| Client clears `pendingTotp` via session update (`config.ts:294-296`) | Critical | P48-01 |
| SSRF via CardDAV URLs + photo URI credential leak + photo-pass bypass | High | P48-04 |
| Read any contact via manual merge suggestion (`merge.ts:25-54`) | High | P48-05 |
| Delete any user's avatar via `prevUrl` (`upload/avatar/route.ts:60-63`) | High | P48-05 |
| DAV unbounded body + quadratic regex (`server.mjs:298-323`) | High | P48-08 |
| DAV limiter keyed on proxy IP → global lockout (`server.mjs:147-150`) | High | P48-09 |
| Deletion sets LOCKED → cannot sign in to cancel (`account.ts:276-283`) | High | P48-02 |
| Vulnerable deps (next 15.5.19, next-auth beta.25, adm-zip, sharp, postcss) | High | P48-12 |
| Lockfile drift; CI red since 2 Jul; Docker build cannot succeed | High | P48-12 |
| No Prisma migrations; `calToken` / `connectionId` not unique | High | P48-14 |
| `cleanup-card-views` cron unauthenticated | Medium | P48-10 |
| `/api/sync/run` global drain, CSRF, open redirect, `AUTH_SECRET` reuse | Medium | P48-10 |
| Archive import: arbitrary content types on media host; unbounded zip | Medium | P48-11 |
| CSV formula injection | Medium | P48-11 |
| REST API `bookId` ownership | Medium | P48-05 |
| Impersonation guard has zero callers; API routes unguarded | Medium | P48-06 |
| Private fields leak into shared copies/snapshots | Medium | P48-07 |
| Unscoped sync-job delete in `disconnectSyncAccount` | Medium | P48-05 |
| Step-up password is client-side only | Medium | P48-02 |
| Reset doesn't invalidate session cache; reset IP arg spoofable | Medium | P48-03 |
| Registration auto-claims shares/invites for unverified email | Medium | P48-03 |
| LOCKED users keep API tokens and app passwords | Medium | P48-03 |
| Email change never notifies old address | Medium | P48-03 |
| Open redirects (`?next=`, action `redirectTo`) | Medium | P48-03 |
| DAV read-only book bypass; bcrypt per request | Medium | P48-09 |
| Sync credential key rotation absent; `AUTH_SECRET` fallback | Medium | P48-16 |
| Rate limiting fails closed/open inconsistently; silent in-memory fallback | Medium | P48-16 |
| Unlimited outbound email with attacker-controlled sender text | Medium | P48-17 |
| Plan-limit check-then-act races | Medium | P48-17 |
| Image runs as root, ships dev deps, seeds, `src/`, stale `generated/` | Medium | P48-15 |
| Audit/billing cascades; no Stripe cancel on delete; `/security` claims | Medium | P48-14, P48-17 |
| All Low findings | Low | P48-03, P48-09, P48-10, P48-11, P48-13, P48-15, P48-17 |

---

## Definition of Done for Phase 48

- [ ] A password-only session on a 2FA-enabled account cannot reach any page,
      action or API route; the client cannot clear the pending flag (P48-01)
- [ ] A user who schedules deletion can sign in and cancel within the grace
      period; scheduling requires the current password server-side (P48-02)
- [ ] No outbound request in `carddav.ts` or the photo pass can reach a private,
      loopback or link-local address; upstream errors are not echoed (P48-04)
- [ ] All four cross-user access paths return 403/404 for non-owners, with
      regression tests (P48-05)
- [ ] `assertWritable` (or the central guard) rejects every mutating action and
      route for impersonated and pending-deletion sessions (P48-06)
- [ ] A 4 MB PROPFIND body is rejected with 413 in under 50 ms; DAV limits key
      on `cf-connecting-ip` and survive a restart (P48-08, P48-09)
- [ ] Every `/api/cron/*` route returns 401 without the secret (P48-10)
- [ ] `npm ci` succeeds; CI runs typecheck, lint, tests and build and is green
      on `main`; `npm audit` reports zero critical/high (P48-12, P48-13)
- [ ] `prisma migrate deploy` is the production schema path; `calToken` and
      `connectionId` are `@unique` (P48-14)
- [ ] Runtime image runs as `node`, contains no devDependencies, `src/`,
      seed scripts or committed Prisma client (P48-15)
- [ ] `/security` page claims are each verifiable against the deployment (P48-17)

---

## References

- Audit report: https://claude.ai/artifact/CrtWbtXDkb87gpjyotJ8GP
- Prior security phase: [phase-sec.md](phase-sec.md) (SEC-01 → SEC-03)
- Pre-prod release phase: [phase-47-preprod-release.md](phase-47-preprod-release.md)
- SSRF guard to reuse: `src/server/safe-image-fetch.ts`
- Env inventory & rotation: [../runbooks/env-secrets.md](../runbooks/env-secrets.md)
- Deploy & schema policy: [../runbooks/deploy.md](../runbooks/deploy.md)
