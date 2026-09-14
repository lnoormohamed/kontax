# P48-01 — Enforce 2FA: central session guard + remove client-side clear

**Phase:** 48 · **Workstream:** A · **Priority:** P0 · **Depends on:** —
**Audit severity:** Critical (×2)

## Objective

Make two-factor authentication actually gate the app. Today a correct
password on a TOTP-enabled account yields a fully usable session, and even if
that were fixed, the client can clear its own pending-2FA flag.

## Context

- `src/server/auth/config.ts:191-198` sets `token.pendingTotp = true` after a
  correct password, but the `session` callback (`:300-318`) still populates
  `user.id`, so `auth()` returns a usable session.
- `src/middleware.ts` only checks that a session cookie exists. The redirect
  to `/login/verify-2fa` lived in the Auth.js edge wrapper and was deleted in
  commit `b332c94` ("replace Auth.js edge middleware wrapper with plain
  cookie-presence check"). `src/server/auth/config.edge.ts` still exists but
  has zero importers.
- `grep -rn pendingTotp src` hits only `src/app/actions/totp.ts:139,170` (the
  challenge actions, which require the flag to be *set*) and comments. No
  page, layout, other action or API route rejects a pending session.
- `src/app/_components/login-form.tsx:42` does
  `router.push(result.url ?? next ?? "/contacts")`; 2FA users are never sent
  to the challenge page.
- Independent bypass: `config.ts:294-296` on `trigger === "update"` trusts the
  client payload — `if (session.clearPendingTotp) token.pendingTotp = undefined`
  — without checking `UserSession.totpChallengeVerified`. Auth.js `update()`
  is a plain `POST /api/auth/session` with `{csrfToken, data}`.
- 27 of 30 action files roll their own `session?.user?.id` check; there is no
  central helper. `src/server/impersonation-guard.ts assertWritable` has no
  callers.

## Steps

1. **Central guard.** Add `src/server/auth/require-session.ts` exporting
   `requireSession(opts?: { write?: boolean; allowPendingTotp?: boolean })`.
   It calls `auth()` and throws/returns a typed error when: no `user.id`;
   `pendingTotp` (unless `allowPendingTotp`); `pendingDeletion` (P48-02
   decides the exact semantics); and, when `write: true`, `impersonatedBy`.
   Provide a page variant that `redirect()`s to `/login/verify-2fa` (for
   pending TOTP) or `/login?next=…`.
2. **Use it everywhere.** Replace the ad-hoc checks in all 30
   `src/app/actions/*.ts` files and every route under `src/app/api/**` that
   calls `auth()`. Only `actions/totp.ts` challenge actions and the
   `/login/verify-2fa` page pass `allowPendingTotp: true`.
3. **Belt and braces.** In the root authenticated layout (or a shared
   `requirePageAuth` used by every protected page), redirect pending-TOTP
   sessions to `/login/verify-2fa`.
4. **Delete the client-side clear.** Remove `config.ts:294-296`. The DB-backed
   branch at `:237-239` already clears the flag once `totpChallengeVerified`
   is set, and the 2FA page already forces that path via
   `fetch("/api/auth/session")` (`verify-2fa/page.tsx:76`).
5. **Route the login client.** After `signIn()` succeeds, fetch
   `/api/auth/session` and route to `/login/verify-2fa` when `pendingTotp` is
   true; otherwise honour `next` (after P48-03's redirect validation).
6. **Optional middleware restore.** If desired, decode the JWT in middleware
   with `AUTH_SECRET` read at runtime (the build-time inlining concern from
   `b332c94` applies only to module-scope `process.env` references in the
   Edge bundle). Not required if steps 1-3 are complete.

## Acceptance

- With a 2FA-enabled test account: sign in with password only → every
  protected page redirects to `/login/verify-2fa`; every server action and
  API route returns an auth error; `/api/exports/contacts/csv` returns 401/403.
- `POST /api/auth/session` with `{"data":{"clearPendingTotp":true}}` does not
  clear the flag.
- After a valid TOTP code, all of the above work normally.
- No file under `src/app/actions` or `src/app/api` calls `auth()` directly
  except through the new helper (lint rule or grep check in P48-13).
- Regression tests for the three cases above (P48-13 lands the harness; this
  ticket adds the cases).

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (no user-visible change beyond 2FA working)
- [ ] External · developers — /developers (none)
- [x] Internal · admins/ops — roadmap/runbooks/ (note the guard in the auth runbook)
- [x] Internal · engineering — docs/ (session model: `pendingTotp` lifecycle)

## References

- Audit report §Critical
- `src/server/auth/config.ts`, `src/middleware.ts`, `src/app/_components/login-form.tsx`
- `docs/session-continuity.md` (describes the redirect that no longer exists)
- Related: P48-02 (`pendingDeletion` semantics), P48-06 (impersonation writes)
