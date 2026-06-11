# Phase 18 — Account Settings & Auth Hardening

## Objective

Give every Kontax user first-class control over their own account: change their name, password, and email address; see and revoke the devices logged into their account; enrol in two-factor authentication; and link a Google or Apple account for passwordless login. Alongside these user-facing features, this phase adds the foundational auth infrastructure — email verification tokens, password-reset tokens, session tracking, and TOTP state — that Phase 19 (Stripe billing), Phase 20 (Amazon SES), and Phase 22 (suspicious activity alerts) all depend on.

## Why now

The existing `User` model has `name`, `email`, and `password` but no `emailVerified`, no session tracking, no TOTP, and no way to do a password reset. These are blocking gaps for production: without email verification, transactional email is spam-prone; without password reset, locked-out users have no recovery path; without session revocation, a stolen device retains full access indefinitely.

## Design source

- `roadmap/build-phase/p18-db01-design-brief-account-security-settings.md` (must be completed before implementation of P18-01, P18-02, P18-06, P18-07)

## Schema additions summary

All schema changes are documented in detail in the individual ticket files. Summary of net-new fields and models:

| Addition | Ticket |
| --- | --- |
| `User.emailVerified DateTime?` | P18-04 |
| `User.emailPendingChange String?` | P18-03 |
| `User.emailPendingChangeRequestedAt DateTime?` | P18-03 |
| `User.sessionVersion Int @default(1)` | P18-02, P18-06 |
| `User.totpEnabled Boolean @default(false)` | P18-07 |
| `User.totpSecret String?` (encrypted) | P18-07 |
| `User.totpVerifiedAt DateTime?` | P18-07 |
| `User.avatarUrl String?` | P18-01 |
| `EmailVerificationToken` model | P18-04 |
| `PasswordResetToken` model | P18-05 |
| `UserSession` model | P18-06 |
| `TotpRecoveryCode` model | P18-07 |
| `OAuthAccount` model | TBD (deferred from P18-08) |

## Phase Tracker

| Ticket | Title | Status | Priority | Depends On |
| --- | --- | --- | --- | --- |
| DB-01 | Design brief — account and security settings surfaces | Not Started | P1 | — |
| P18-10 | Rate limiting + security infrastructure (middleware, JWT maxAge, env vars) | Not Started | P0 | — |
| P18-01 | Profile edit — name, display name, avatar | Not Started | P0 | DB-01 |
| P18-02 | Password change (current + new + confirm; invalidates all other sessions) | Not Started | P0 | P18-10 |
| P18-03 | Email change flow (pending state + re-verification before activation) | Not Started | P0 | P18-04 |
| P18-04 | Email verification on signup and after email change | Not Started | P0 | P18-10 |
| P18-05 | Password reset via email link | Not Started | P0 | P18-04, P18-10 |
| P18-06 | Active sessions panel (list devices, revoke individual or all; JWT maxAge) | Not Started | P1 | P18-02 |
| P18-07 | Two-factor authentication — TOTP enrol, verify, disable, recovery codes | Not Started | P1 | P18-02, P18-04, P18-10 |
| P18-08 | OAuth login providers — Google Sign-In, Apple Sign-In (link/unlink) | **Deferred → TBD** | P2 | P18-03 |
| P18-09 | Account deletion — 30-day grace period, cascade, Stripe cancellation stub | Not Started | P1 | P18-10 |
| P18-11 | Personal address books — AddressBook model, stable CardDAV slugs, book-scoped CTag | Not Started | P0 | — |

## Build order

**P18-10 (rate limiting + middleware + env vars) must land first** — it is a prerequisite for P18-02, P18-04, P18-05, P18-07, and P18-09. It also ships the only `src/middleware.ts` file, which gates the app.

After P18-10: build P18-04 (email verification tokens) and P18-02 (password change + session version) — they introduce the shared infrastructure (token model, `sessionVersion` field) that P18-03, P18-05, P18-06, and P18-07 all build on. P18-01 (profile edit) is independent and can be built at any point. P18-09 (account deletion) is lower priority and can run in parallel once the core tickets are done. P18-08 (OAuth — Google/Apple) has been deferred to a TBD phase.

DB-01 (design brief) should be produced before P18-01, P18-06, and P18-07, since those tickets have the most new UI surface. P18-02, P18-04, and P18-05 are primarily server logic with minimal new UI and can be built before the brief is delivered.

## Environment variables introduced by Phase 18

All vars are documented in full in `p18-10-rate-limiting-and-security-infrastructure.md` and must be added to `.env.example` and validated in `src/env.js` as part of P18-10.

| Variable | Ticket | Required in prod | Notes |
| --- | --- | --- | --- |
| `AUTH_SECRET` | existing | yes | Already present |
| `DATABASE_URL` | existing | yes | Already present |
| `APP_URL` | existing | yes | Already present |
| `REDIS_URL` | P18-10 | yes | Self-hosted Valkey instance — `redis://host:6379` |
| `MINIO_ENDPOINT` | P18-01 | no | Self-hosted MinIO — e.g. `https://minio.yourdomain.com` |
| `MINIO_ACCESS_KEY` | P18-01 | no | MinIO access key |
| `MINIO_SECRET_KEY` | P18-01 | no | MinIO secret key |
| `MINIO_BUCKET` | P18-01 | no | MinIO bucket name |
| `MINIO_PUBLIC_URL` | P18-01 | no | Public base URL for avatar objects; falls back to URL-only if unset |
| `TOTP_ENCRYPTION_KEY` | P18-07 | yes | 64-char hex — `openssl rand -hex 32` |
| `CRON_SECRET` | P18-09 | yes | Guards `/api/cron/*` — `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | TBD (P18-08) | no | Deferred — OAuth Google Sign-In |
| `GOOGLE_CLIENT_SECRET` | TBD (P18-08) | no | Deferred |
| `APPLE_CLIENT_ID` | TBD (P18-08) | no | Deferred — OAuth Apple Sign-In |
| `APPLE_TEAM_ID` | TBD (P18-08) | no | Deferred |
| `APPLE_KEY_ID` | TBD (P18-08) | no | Deferred |
| `APPLE_PRIVATE_KEY` | TBD (P18-08) | no | Deferred — PEM, use `\n`-escaped string |

## Address book model (P18-11)

P18-11 is foundational for Phase 13 (Family dissolution) and Phase 23 (sync advanced settings). It must land before Phase 13 begins implementation. The `AddressBook` model introduces stable CardDAV slugs that replace the hardcoded `default` segment from Phase 9 — read `p18-11-personal-address-books.md` for the migration path and the Phase 13 usage guide.

## Register route updates required by Phase 18

The existing `/api/register/route.ts` must be updated as part of P18-10 (or the first P18 ticket that ships):
- Min password length: 6 → 8 characters (to match P18-02's policy)
- Rate limiting: add `checkRateLimit(rateLimiters.registration, ip)` before user creation
- Email verification: call `sendVerificationEmail(user.id, "SIGNUP")` after user insert (P18-04)

These are three small changes to an existing file — no new ticket needed; assign to P18-10 or P18-04.

## Lifecycle policy reference

All account lifecycle decisions (group dissolution, subscription downgrade data fate, payment failure cascade, member join/leave rules) are documented in `lifecycle-policies.md`. P18-09 (account deletion) must comply with Section 3d of that document. Phases 13, 14, and 19 are the primary implementors of those policies.

## Dependency map for downstream phases

- **Phase 19 (Stripe):** needs `User.emailVerified` (P18-04) so billing emails go to a verified address.
- **Phase 20 (Amazon SES):** needs the `EmailVerificationToken` and `PasswordResetToken` models (P18-04, P18-05) — these are the first two transactional email flows SES will carry.
- **Phase 22 (notifications):** needs `UserSession` (P18-06) to detect new-device logins and needs `sessionVersion` (P18-02) for the "wasn't me → invalidate all sessions" flow.

## Exit criteria

- A user can update their name and avatar from a settings page.
- A user can change their password by supplying the current one; all other active sessions are invalidated.
- A user can request an email address change; the change is held pending until the new address is verified via a one-time link.
- New accounts receive an email verification link at signup; unverified accounts are granted a grace period before certain features are gated.
- A user who forgets their password can reset it via an email link with a 15-minute expiry.
- A user can see all active sessions (IP, device hint, last active), revoke any individual session, or revoke all sessions except the current one.
- A user can enrol in TOTP 2FA; once enrolled, login requires a TOTP code after credentials are verified.
- Recovery codes are generated at TOTP enrolment and are single-use; a user can regenerate them.
- (Deferred — TBD) A user can link and unlink a Google or Apple account for passwordless login.
