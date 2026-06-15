# Smoke Test Results — v1 (P34D)

Record all test results here before the P34D-08 sign-off gate.
Environment: **kontax.vexon.co** (staging). Re-run critical-path cases on **getkontax.com** after P34D-23 cutover.

Legend: ✅ Pass · ❌ Fail · ⏳ Not yet run · ⚠️ Blocked

---

## Auth (P34D-01)

Tester: _____________  Date: _____________

> **Pre-test setup:** Create a fresh test account using a Gmail `+smoketest` alias.  
> Delete the test account after the full run to avoid state leakage.  
> Verify NTP sync on the test machine before running TOTP cases (TC-08 through TC-10).

### Pre-check findings (from code audit)

| Item | Status | Notes |
|------|--------|-------|
| Session revocation (TC-12) | ✅ Confirmed | JWT strategy but every request checks `userSession.revokedAt` in DB — revocation works immediately |
| TOTP implementation | ✅ Present | `src/server/totp-crypto.ts`, `src/app/actions/totp.ts`, `rateLimiters.totpChallenge` (5 per 15 min) |
| Password reset rate limit | ✅ Present | `rateLimiters.passwordResetByEmail` (3/30 min), `rateLimiters.passwordResetByIp` (10/30 min) |
| **Login brute-force rate limit (TC-17)** | ❌ **MISSING — P0 BLOCKER** | `recordFailedLogin` fires a security alert after 5 failures but does NOT block login. No `loginAttempt` entry in `rateLimiters`. TC-17 will fail. Must be fixed before P34D-08 sign-off. See **Action required** below. |

> **Action required — P0 before go-live:** Add a login rate limiter (e.g. 5 attempts per 15 min per email or IP) in `src/server/rate-limit.ts` and enforce it in the `authorize` callback in `src/server/auth/config.ts`. Return `null` (or throw a custom error surfaced as a 429) when the limit is exceeded.

### Test Cases

| ID | Test Case | Pass/Fail | Notes |
|----|-----------|-----------|-------|
| TC-01 | Register with email/password | ✅ Pass | Account created, redirected to /contacts, verification email sent to li+smoketest@linoormohamed.com |
| TC-02 | Email verification | ✅ Pass | "Email verified. Your account is fully active." shown at /verify-email |
| TC-03 | Log in with credentials | ✅ Pass | Login succeeded, redirected to /contacts, session cookie present |
| TC-04 | Log out | ✅ Pass | Signed out via account menu, redirected to /login, /contacts redirects back to /login |
| TC-05 | Forgot password — email delivery | ✅ Pass | "Check your inbox" shown; reset email arrived from noreply@vexon.co |
| TC-06 | Forgot password — set new password | ✅ Pass | New password set, redirected to /login?message=password-reset |
| TC-07 | Forgot password — log in with new password | ✅ Pass | Login with SmokeTest5678! succeeded, redirected to /contacts |
| TC-08 | Enrol TOTP 2FA | ✅ Pass | TOTP_ENCRYPTION_KEY added to Coolify env. Re-run after fix deploy confirmed enrolment worked; QR code displayed, li+smoketest2 account enrolled successfully |
| TC-09 | Log in with 2FA active | ✅ Pass | 2FA challenge appeared at /login/verify-2fa; TOTP code accepted; landed on /contacts. Note: completeLogin bug (see below) required /api/auth/session refresh before navigation succeeded |
| TC-10 | Disable 2FA | ✅ Pass | Disabled via Settings → Security (password + TOTP required). Next login went straight to /contacts with no 2FA challenge |
| TC-11 | View active sessions | ✅ Pass | Settings → Security shows 3 active Chrome/macOS sessions with IP and "Active X ago" timestamps |
| TC-12 | Revoke a session | ✅ Pass | Revoked oldest session from Settings → Security; session count dropped 3→2 immediately. JWT revokedAt check confirmed in code audit. |
| TC-13 | Change email address | ✅ Pass | Verification email sent to li+smoketest2@linoormohamed.com; old email still active |
| TC-14 | Verify new email | ✅ Pass | New email verified and login succeeds; old email rejected. Note: ERR_TOO_MANY_REDIRECTS on verify page if session cookie still active — sign out first as workaround |
| TC-15 | Change password | ✅ Pass | Password changed via Settings → Account → Change Password; form dismissed cleanly |
| TC-16 | Old password rejected after change | ✅ Pass | Old password returns "Incorrect" error, stays on /login |
| TC-17 | Rate limiting — wrong password | ✅ Pass | After fix deployed: 5th wrong-password attempt blocked login (HTTP 200 with "Incorrect email or password" — no 429 exposed to UI by design). 6th attempt also blocked. |

### Bugs fixed during run

| Bug | Fix | Commit |
|-----|-----|--------|
| TOTP_ENCRYPTION_KEY missing | Added to Coolify env vars | — (env only) |
| Login rate limit missing | `loginByEmail` + `loginByIp` limiters; consume only on failure | `5677991` |
| ERR_TOO_MANY_REDIRECTS on email verify with active session | Render success page instead of redirect for `EMAIL_CHANGE` type | `40e1292` |
| `completeLogin()` loops back to /login/verify-2fa | Fetch `/api/auth/session` before `router.push` to clear `pendingTotp` cookie | (this run) |

### Section sign-off

| Criterion | Status |
|-----------|--------|
| All 17 TCs pass (no exceptions) | ✅ All 17 pass |
| TC-01–04 also pass on getkontax.com (post P34D-23) | ⏳ Post-cutover |
| SES email delivery < 60 s for all emails | ✅ All emails arrived within 60s |

Signed off by: _____________  Date: _____________

---

## Contacts (P34D-02)

_To be filled in when P34D-02 is run._

---

## Sync (P34D-03)

_To be filled in when P34D-03 is run._

---

## Sharing (P34D-04)

_To be filled in when P34D-04 is run._

---

## Billing (P34D-05)

_To be filled in when P34D-05 is run._

---

## Mobile (P34D-06)

_To be filled in when P34D-06 is run._

---

## Public Card · API · Notifications (P34D-07)

_To be filled in when P34D-07 is run._

---

## Sign-off Gate (P34D-08)

All sections above must be complete and signed off before the go-live gate is cleared.

Final sign-off: _____________  Date: _____________
