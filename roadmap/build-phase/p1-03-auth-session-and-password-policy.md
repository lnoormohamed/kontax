# P1-03 Auth, Session, and Password Policy

## Purpose
This document defines the authentication, session, and password policy for Kontax as a consumer-first SaaS contact app. It standardizes how users sign in, how sessions are created and invalidated, how credentials are stored and evolved, and which recovery and audit hooks must exist before deeper product functionality is built.

## Current Implementation Baseline
Current code already includes:
- credentials-based login
- `bcryptjs` password verification
- JWT-backed sessions through Auth.js
- dedicated `/login` and `/register` routes

Current gaps still to address in later implementation:
- no password reset flow
- no email verification flow
- no session inventory or device management UI
- no audit event persistence for auth actions
- no forced password rehash migration path

This blueprint defines the target policy so those gaps are filled consistently.

## Auth Principles
- Credentials auth is the primary v1 sign-in method.
- Email is the canonical login identifier.
- Sessions should be user-friendly for consumers but revocable for security-sensitive actions.
- Password handling must be upgradeable without forcing all users to reset credentials at once.
- Auth policy should support future premium features and sync credentials without redesigning account identity.

## Account Identity Policy
### Canonical account identifier
- `User.id` is the internal immutable identity key.
- `User.email` is the canonical login identifier in v1.
- Email must be unique globally in v1.

### Account states
Planned account lifecycle states:
- `active`
- `trialing`
- `grace`
- `canceled`
- `locked`

Rules:
- `active` and `trialing` can authenticate normally.
- `grace` can authenticate but may face entitlement restrictions later.
- `canceled` can authenticate only if product rules still allow read/export access.
- `locked` cannot authenticate until administrative or automated recovery unlocks the account.

## Login Policy
### Sign-in flow
V1 login should follow:
1. Accept email and password.
2. Normalize email by trimming and lowercasing before lookup.
3. Look up user by canonical email.
4. Verify password hash using approved password policy.
5. Create JWT-backed session on success.
6. Record an audit event for successful and failed authentication attempts in future implementation.

### Failure handling
- Invalid email/password combinations should return a generic auth failure response.
- The product should not reveal whether an email exists.
- Rate limiting and brute-force protections are expected in later implementation but should be planned now.

### Future auth extensions
This policy must remain compatible with:
- password reset
- email verification
- optional social login later
- WebAuthn or passkeys later if desired

## Session Policy
### Session model
- Use JWT-backed sessions in v1 to keep auth lightweight.
- Session payload should include immutable `user.id` and display-safe user identity data.
- Session creation and invalidation behavior should be centralized in Auth.js config.

### Session duration
Planned defaults:
- persistent consumer session with rolling refresh
- short-lived JWT internals relative to overall user session
- explicit reauthentication required for high-risk actions later if needed

Recommended policy target:
- standard app session: 30 days max with rolling activity refresh
- idle expiration: 7 days without use
- forced reauthentication for future high-risk actions such as exporting all data, changing password, or adding sync credentials

### Session invalidation
Planned invalidation triggers:
- explicit sign-out
- password change
- account lock
- suspected credential compromise
- future admin/security action

### Future session management
Later implementation should support:
- session versioning or token invalidation stamp on `User`
- “sign out all devices” capability
- device/session inventory UI as a later enhancement

## Password Policy
### Storage policy
- Store only password hashes, never plaintext or reversible encrypted passwords.
- Current practical baseline uses bcrypt.
- Password field should conceptually be treated as `passwordHash` even if the database column remains `password` temporarily.

### Hashing policy
Recommended baseline:
- bcrypt with a strong cost factor consistent with production latency budgets
- automatic rehash on login when stored cost/settings fall behind the current standard

### Password requirements
V1 minimum policy:
- minimum 8 characters preferred as target policy
- current implementation minimum 6 should be treated as a temporary floor to raise in implementation cleanup
- encourage passphrase-style passwords rather than composition gimmicks

Policy guidance:
- do not require forced uppercase/symbol patterns if length and breach protections are in place
- reject clearly empty or malformed credentials before DB lookup

### Password migration stance
- Support progressive migration rather than forced reset.
- On successful login, if hash parameters are outdated, rehash the password using the current policy and update the stored hash.
- If Kontax later adopts Argon2, migration should still happen progressively after successful login.

## Password Reset and Recovery Policy
### Reset flow placeholders
Later implementation should include:
- email-based password reset initiation
- short-lived single-use reset token
- explicit token expiration
- audit logging for request and completion

### Reset token requirements
- tokens must be random, high-entropy, single-use, and time-bound
- token hashes should be stored instead of raw reset tokens where feasible
- reset completion should invalidate active sessions

### Account recovery constraints
- no security questions
- no manual support-side password viewing or editing without formal recovery tooling
- recovery process must remain email-centric in v1

## Email Verification Policy
### Verification stance
- Email verification should be planned even if deferred from immediate implementation.
- Verification status should be stored on the user model once introduced.
- Future high-risk features may require verified email before use.

### Suggested rollout behavior
- account creation allowed before verification
- core usage can begin in early consumer beta
- export, sync setup, or billing-sensitive actions may later require verified email

## Audit Event Requirements for Auth
Future `AuditEvent` coverage should include:
- successful sign-in
- failed sign-in attempt
- sign-out
- password change
- password reset requested
- password reset completed
- account locked
- email verification sent
- email verified
- sign-out-all-devices action

Captured metadata should include:
- `userId` when known
- `actorType`
- `eventType`
- IP address
- user agent
- timestamp
- result status when meaningful

## Environment and Secret Policy
- `AUTH_SECRET` is mandatory in production.
- Secrets must come from environment/config providers, never code or committed files.
- Separate app auth secrets from future sync-provider or encryption-key secrets.
- Local development can use generated secrets, but deployment must use explicitly managed secrets.

## Recommended Implementation Follow-Ups
### Near-term code alignment
- rename conceptual references from `password` to `passwordHash` in docs and later schema cleanup
- raise minimum password requirement from 6 to 8 when auth UX is revisited
- add account status field to `User`
- add `lastActiveAt` or `lastLoginAt` tracking
- add a user-scoped session invalidation strategy for password changes

### Deferred but planned
- password reset tokens and routes
- email verification tokens and routes
- login rate limiting
- sign-in anomaly detection
- account/device session management

## Acceptance Outcome
`P1-03` is complete when this policy is treated as the source of truth for Kontax auth behavior, session lifecycle, password handling, reset placeholders, email verification planning, and future auth audit requirements.
