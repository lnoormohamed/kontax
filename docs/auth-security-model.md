# Auth & security model

**Cross-cutting subsystem.** How sessions work, how they are invalidated, TOTP 2FA enrollment, step-up authentication, rate limiting, and suspicious-activity detection.

---

## Sessions

Kontax uses NextAuth.js with the Prisma adapter. Sessions are stored in the `Session` table and identified by a JWT cookie.

### Session invalidation via `sessionVersion`

`User.sessionVersion` is an integer that acts as a revocation counter. Every JWT encodes the `sessionVersion` at issue time. On every authenticated request, the middleware checks:

```
if (jwt.sessionVersion !== user.sessionVersion) → 401 SESSION_EXPIRED
```

Incrementing `sessionVersion` immediately invalidates **all** active sessions for that user. This is used by:
- Password change → `sessionVersion++` (sign out all other sessions)
- Email change → no increment (stays signed in during pending verification)
- Account deletion scheduling → `sessionVersion++` (sign out immediately)
- Account suspension (admin) → `sessionVersion++`
- Security alert "Wasn't me" → `sessionVersion++`

### Impersonation sessions

Impersonation does not create a new `Session` row. It uses a separate signed cookie (`kontax_imp`) alongside the admin's real JWT. The `auth()` helper reads both: if `kontax_imp` is valid (HMAC-SHA256, 30-minute TTL), it returns the impersonated user as the session identity with `session.impersonatedBy` set. The admin's real session is preserved and restored when impersonation ends. See `src/server/admin/impersonation.ts`.

---

## TOTP two-factor authentication

### Enrollment

1. User requests 2FA setup → server generates a TOTP secret (`otplib` / RFC 6238).
2. The secret is encrypted with `TOTP_ENCRYPTION_KEY` (AES-256) before storage in `User.totpSecret`.
3. A QR code is rendered for the user's authenticator app.
4. User enters a 6-digit code to confirm enrollment → server verifies, sets `User.totpEnabled=true`.
5. Recovery codes are generated (10 codes, each single-use), hashed, and stored in `User.totpRecoveryCodes`.

### Challenge

On sign-in for a 2FA-enabled account:
1. Password is verified first.
2. If correct, sign-in is paused and a TOTP challenge is shown.
3. User enters the 6-digit code → verified against the current and adjacent TOTP windows (±30s drift tolerance).
4. If a recovery code is submitted instead: the matching hashed code is marked used; the user is signed in.

### Secret rotation

`TOTP_ENCRYPTION_KEY` rotation requires re-encrypting all stored secrets — there is no automated migration path. Do not rotate this key without a migration plan.

---

## Step-up authentication

Sensitive actions (email change, account deletion, API token operations) require re-confirming the user's password even within an active session. The `ConfirmPasswordModal` collects the password and calls `verifyPasswordForStepUp` before the action proceeds.

`verifyPasswordForStepUp` in `src/app/actions/account.ts`:
- Checks the password against the stored bcrypt hash.
- Rate-limited: 5 attempts per user per 15-minute window (Valkey, with in-memory fallback).
- OAuth-only accounts (no password set) are auto-verified — their active session is the step-up signal.

---

## Rate limiting

Rate limits use a sliding window counter backed by Valkey (Redis-compatible). In development without `REDIS_URL`, limits fall back to in-memory (not shared across restarts).

Key limiters (configured in `src/server/rate-limit.ts`):

| Limiter | Window | Limit | Used by |
|---------|--------|-------|---------|
| `passwordChange` | 15 min | 5 attempts | Change password action |
| `emailResend` | 1 hour | 5 sends | Email verification / email change resend |
| `stepUpVerify` | 15 min | 5 attempts | Step-up password check |
| `signIn` | 1 hour | 10 attempts | Auth sign-in handler |

When a limit is exceeded, actions return `RATE_LIMIT_EXCEEDED` or `RATE_LIMITED`. The API returns HTTP 429 with `Retry-After` and `X-RateLimit-*` headers.

---

## Suspicious activity detection

### Failed login tracking

`FailedLoginAttempt` rows are created on every failed sign-in against a known account. The security alert rule fires when more than 5 failed attempts occur within 1 hour:

```
FailedLoginAttempt.count(userId, last 1h) > 5 → create SecurityAlert(kind="device")
```

### New device / location detection

On successful sign-in, Kontax compares the current device fingerprint (user-agent hash) and IP against recent sessions. If both differ from the last 3 sessions, a `SecurityAlert(kind="device")` is created.

### Security alert resolution

Alerts appear in the notification bell. The user can:
- **Dismiss ("That was me")**: marks the alert as `resolution=DISMISSED`.
- **Secure account ("Wasn't me")**: marks as `resolution=SECURED`, increments `sessionVersion` (signs out all sessions), and shows a prompt to change password.

---

## App passwords (CardDAV)

`AppPassword` rows let users create named credentials for CardDAV sync clients without sharing their main account password:

```
AppPassword {
  userId
  syncAccountId    — links to the SyncAccount this password was created for
  name             — user-chosen label (e.g. "iPhone Contacts")
  hashedPassword   — bcrypt hash; plaintext shown once on creation
  lastUsedAt
}
```

App passwords are rate-limited by plan: 1 for Free, 5 for Pro+. Revoking an app password invalidates any CardDAV client using it immediately (next request returns 401).

---

## References

- Session version check: `src/server/auth.ts`
- Impersonation: `src/server/admin/impersonation.ts`
- TOTP (enrollment + challenge): `src/server/totp.ts` (or `src/app/actions/totp.ts`)
- Step-up: `src/app/actions/account.ts` → `verifyPasswordForStepUp`
- Rate limiters: `src/server/rate-limit.ts`
- Security alerts: `src/server/security-alerts.ts`
- Schema: `prisma/schema.prisma` — `Session`, `AppPassword`, `SecurityAlert`, `FailedLoginAttempt`
- Runbook: [admin-ops.md](../roadmap/runbooks/admin-ops.md) (impersonation)
