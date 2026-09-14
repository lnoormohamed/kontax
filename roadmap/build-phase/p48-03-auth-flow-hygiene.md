# P48-03 — Auth-flow hygiene: reset cache, reset IP, unverified claims, LOCKED on tokens, old-email notice, open redirects

**Phase:** 48 · **Workstream:** A · **Priority:** P1 · **Depends on:** P48-01
**Audit severity:** Medium (×6) + Low (×4)

## Objective

Close the remaining auth-flow gaps found in review. Each is a small,
independent change; they are grouped because they touch the same files and
should ship together with the P48-01 guard.

## Context and steps

1. **Password reset does not invalidate the session cache.**
   `src/app/actions/auth.ts:121-130` bumps `sessionVersion` but never calls
   `invalidateSessionValidation(userId)`; every other bumping path does
   (`account.ts:93,285`, `admin.ts:136,211`, `email-verification.ts:99`,
   `notifications.ts:392`). An attacker's live session survives the victim's
   reset for up to 45 s. → Add the call after the transaction.
2. **Reset per-IP limiter is caller-controlled.** `auth.ts:25-46`
   `requestPasswordReset(email, ip?)` takes `ip` as an action argument; the UI
   passes nothing, so `passwordResetByIp` never fires and `requestedFromIp` is
   forgeable. → Remove the parameter; derive via `getClientIp(await headers())`.
3. **Registration auto-claims shares and invites for an unverified email.**
   `src/app/api/register/route.ts:73-91` links `contactShare.recipientEmail`
   and `groupMember.invitedEmail` at registration; `emailVerified` is null.
   → Move the linking into the SIGNUP branch of `verifyEmailToken`, or hide
   claimed shares/invites until verified.
4. **LOCKED users keep working via API tokens and app passwords.**
   `src/server/api-tokens.ts:27-51 validateApiToken` and
   `src/server/app-passwords.ts:125-167` / `server.mjs:181
   verifyCardDavCredentials` never read `lifecycleState`. → Select it and
   reject `LOCKED` (and pending-deletion per P48-02).
5. **Email change never notifies the old address.** `account.ts:163-166` is a
   `console.log`. → Send a real email to the old address with a time-limited
   "this wasn't me" link that reverts the pending change and bumps
   `sessionVersion`.
6. **Open redirects.** `login/page.tsx:22`, `register/page.tsx:23`,
   `_components/auth-card.tsx:269,303`, and `actions/contacts.ts:136-139
   getRedirectTarget` (13 call sites) accept anything starting with `/`,
   including `//evil.com` and `/\evil.com`. → One shared
   `safeInternalPath(next)` that requires `/^\/(?![\/\\])/`, rejects `@` and
   `\`, and falls back to `/contacts`. Also `api/sync/run` (P48-10).
7. **Low items in the same files:**
   - Login timing enumeration (`config.ts:109` returns before
     `bcrypt.compare` for unknown emails) → run a dummy compare, as
     `app-passwords.ts:139` does.
   - Revoked sessions return `{}` from the JWT callback (`config.ts:214,233,
     272,286`) → return `null` so Auth.js clears the cookie and
     `login/page.tsx:27`-style `session?.user` gates don't loop.
   - Session-cache write race (`config.ts:255-263`) → `await` the write or
     use a version check so a concurrent revoke can't leave a stale snapshot.
   - TOTP: store `lastTotpCounter` and reject `<=` (replay within the window);
     rate-limit `disableTotpAuth` and `confirmTotpEnrolment` with
     `rateLimiters.totpChallenge`; fix recovery codes to 10 chars
     (`totp.ts:74,115`; `randomBytes(5)` yields 7).

## Acceptance

- Reset password → a second browser's session is refused on its next request
  (no 45 s window).
- `requestPasswordReset` has no `ip` argument; 11 requests from one IP in 30
  min are limited.
- Registering with an address that has a pending share/invite does not expose
  it until the email is verified.
- A LOCKED user's API token returns 401 and their app password returns 401 on
  DAV.
- Changing email sends a notice to the old address whose link reverts the
  change.
- `?next=//evil.com` and `redirectTo=//evil.com` land on `/contacts`.
- Unit tests for `safeInternalPath` and for each of the Low items.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (email-change security notice)
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (support: revert email change)
- [ ] Internal · engineering — docs/

## References

- Audit report §Medium (auth items), §Low (auth items)
- `src/app/actions/auth.ts`, `src/app/actions/account.ts`, `src/app/api/register/route.ts`, `src/server/api-tokens.ts`, `src/server/app-passwords.ts`, `src/server/auth/config.ts`, `src/app/actions/totp.ts`
