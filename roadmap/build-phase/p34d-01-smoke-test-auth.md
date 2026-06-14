# P34D-01 — Smoke Test: Authentication Flows

## Purpose

Verify every authentication flow works correctly end-to-end against the staging
environment, then re-verify critical paths on production after the P34D-23 cutover.
All test cases must pass before the P34D-08 sign-off gate is reached.

## Background

Kontax uses NextAuth with the Credentials provider (email + password). Two-factor
authentication (TOTP) is optional. Password reset and email verification are
delivered via SES (noreply@vexon.co, us-east-1). Sessions are stored in the
database. A rate-limiting layer on `/api/auth/signin` prevents brute-force attacks.

This ticket covers only the auth layer; contact data flows are in P34D-02.

## Scope

**In scope**
- Registration (email/password) and email verification via SES link
- Credential login and logout
- Forgot-password flow (email delivery, link validity, password change)
- TOTP 2FA enrol, verify, and disable
- Session management (view active sessions, revoke a session)
- Email address change (verification to new address, old address invalidated)
- Password change (old password rejected after change)
- Rate limiting / temporary lockout on repeated wrong passwords

**Out of scope**
- Google or Microsoft OAuth login (not implemented — only sync OAuth exists)
- Admin role flows (covered in P34D-05)
- Billing flows (P34D-05)

## Design / Implementation Spec

Run all test cases on **kontax.vexon.co** first. Record results in
`roadmap/runbooks/smoke-test-results-v1.md` in the Auth section. After P34D-23
cutover, re-run TC-01, TC-02, TC-03, TC-09, and TC-10 on **getkontax.com** to
confirm the production environment is healthy.

Use a dedicated test email account (e.g. a `+smoketest` alias) so results are
repeatable. Delete the test account after each full run to avoid state leakage.

## Test Cases

| ID | Test Case | Steps | Expected Result | Pass/Fail |
|----|-----------|-------|-----------------|-----------|
| TC-01 | Register with email/password | Navigate to /register. Enter name, valid email, strong password. Submit. | Account created. Verification email arrives from noreply@vexon.co within 60s. Email contains a verification link. | |
| TC-02 | Email verification | Click the verification link from TC-01 email. | Account marked verified. Redirected to /contacts (or onboarding). No error page. | |
| TC-03 | Log in with credentials | Navigate to /login. Enter verified email + correct password. | Redirected to /contacts. Session cookie present. | |
| TC-04 | Log out | Click logout (from settings or avatar menu). | Redirected to /login. Session cookie cleared. Navigating to /contacts redirects back to /login. | |
| TC-05 | Forgot password — email delivery | Click "Forgot password" on /login. Enter registered email. | Password-reset email arrives from noreply@vexon.co within 60s. Email contains a reset link. | |
| TC-06 | Forgot password — set new password | Click reset link from TC-05. Enter and confirm a new password. Submit. | Password changed. Redirected to /login or logged in directly. | |
| TC-07 | Forgot password — log in with new password | Log in with the new password from TC-06. | Login succeeds. Redirected to /contacts. | |
| TC-08 | Enrol TOTP 2FA | Go to Settings → Security → Enable 2FA. Scan QR code with authenticator app. Enter the 6-digit code. | 2FA enabled. Recovery codes shown (or skipped). | |
| TC-09 | Log in with 2FA active | Log out. Log in with email + password. | 2FA challenge screen appears. Enter code from authenticator. Redirected to /contacts. | |
| TC-10 | Disable 2FA | Go to Settings → Security → Disable 2FA. Confirm. Log out and log back in. | No 2FA challenge appears. Login completes directly. | |
| TC-11 | View active sessions | Go to Settings → Security → Active Sessions. | At least one session listed with device/IP and timestamp. | |
| TC-12 | Revoke a session | Open the app in a second browser/incognito (create a second session). From the first session, revoke the second session in Settings → Security. | The revoked session is immediately invalid: refreshing in the second browser redirects to /login. | |
| TC-13 | Change email address | Go to Settings → Account → Change Email. Enter a new email address. Submit. | Verification email sent to the NEW address. Old email still works until verification. | |
| TC-14 | Verify new email | Click the verification link in the new email. | Email changed. Log out. Log in with new email → succeeds. Log in with old email → fails. | |
| TC-15 | Change password | Go to Settings → Security → Change Password. Enter current password, then new password twice. Submit. | Password changed. | |
| TC-16 | Old password rejected after change | Log out. Try to log in with the OLD password from TC-15. | Login fails with "invalid credentials" message. New password works. | |
| TC-17 | Rate limiting — wrong password | Enter wrong password 5 times in a row on /login. | After 5 failures: either a 429 response, a lockout message, or a CAPTCHA challenge. The account is not permanently locked (recoverable after cooldown or via forgot-password). | |

## Acceptance Criteria

- All 17 test cases pass with no exceptions before P34D-08 sign-off.
- Critical-path cases TC-01, TC-02, TC-03, TC-04 also pass on getkontax.com
  after P34D-23.
- SES delivery time for all emails is under 60 seconds.
- Results are recorded in `roadmap/runbooks/smoke-test-results-v1.md` with pass/fail
  and tester name.

## Risks / Open Questions

- SES delivery to certain email providers (Outlook, Yahoo) may have higher latency
  or land in spam. Use a Gmail address for the smoke test account to minimise
  this variable.
- TOTP time sync: if the test machine clock is drifted, TOTP codes will fail. Verify
  NTP sync on the machine running the test.
- Rate limiting implementation: confirm whether it is implemented at the NextAuth
  level, middleware, or via an external service. If not implemented, TC-17 will
  fail and this is a P0 (security blocker for go-live).
- Session revocation depends on the session being stored in the DB (not a stateless
  JWT). Verify this assumption before TC-12.

## Documentation

- [ ] External · users — in-app Help: no changes needed (auth UI is self-explanatory)
- [ ] External · developers — /developers: no changes needed
- [x] Internal · ops — `roadmap/runbooks/smoke-test-results-v1.md`: record results here
- [ ] Internal · engineering — docs/: no code changes in this ticket
