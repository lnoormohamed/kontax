# P31-02 — Step-Up Authentication Policy

## Purpose

Define and implement explicit re-authentication (step-up) for sensitive actions,
so that the *only* time a logged-in user is asked to confirm identity is a
deliberate, well-explained prompt — never a silent session failure or a surprise
login bounce.

## Background

Today there is no middle ground between "logged in" and "logged out": any guard
that fails sends the user to `/login`. Sensitive operations (password change,
account deletion, export-all) deserve an intentional confirmation, while ordinary
contact work should never re-prompt. The credential primitives already exist:
JWT sessions (`config.ts`, 30-day `maxAge`, 7-day `updateAge`), TOTP + recovery
codes (`TotpRecoveryCode`, the `/login/verify-2fa` flow), and app passwords
(`AppPassword`).

## Scope

**In scope**
- A single **step-up policy** module listing which actions require confirmation
  and at what strength (password confirm vs. TOTP challenge vs. recent-session).
- A reusable server guard `assertRecentAuth(strength)` and a client
  **confirm-identity modal** that re-runs the attempted action on success.
- Wiring the guard into the sensitive actions.

**Out of scope**
- The redirect audit (P31-01), session-expired recovery (P31-04).
- New TOTP enrollment UI (depends on the account-security work).

## Design / Implementation Spec

### Sensitive-action list (require step-up)
Password change · email change · **export all contacts** · permanent delete ·
app-password creation · CardDAV credential changes · billing changes · account
deletion · viewing recovery codes.

**Never step-up** (ordinary session): browsing, contact create/edit, favorite,
archive/restore, labels, books, lists, merge review, filtered export.

### Strength tiers
- **recent-session** — action allowed if the session was authenticated within N
  minutes (track an `authAt` claim in the JWT); else prompt.
- **password** — require re-entering the account password (verify against the
  bcrypt hash, reuse the credentials verify path).
- **totp** — require a TOTP code when the user has 2FA enabled; fall back to
  password otherwise.

### Server guard
```ts
// throws StepUpRequired (a structured error, NOT a redirect) when confirmation
// is needed; the client catches it and opens the confirm-identity modal.
await assertRecentAuth("password"); // or "totp" | "recent-session"
```
Pair with a `confirmIdentity({ password?, totpCode? })` action that verifies and
stamps a short-lived `stepUpAt` so the retried action passes.

### Client modal
A `ConfirmIdentityModal` that explains *why* ("Confirm it's you to export all
contacts"), collects the factor, calls `confirmIdentity`, then re-invokes the
original action. Returns the user to the exact action — no navigation.

## Acceptance Criteria
- Each sensitive action is gated by `assertRecentAuth` at the correct strength.
- Re-auth prompts explain why confirmation is needed and return to the exact action.
- Ordinary contact work never re-prompts unless the session is genuinely expired.
- Export-all uses a stricter tier than filtered export.
- With 2FA enabled, the TOTP tier is used; without it, password fallback applies.

## Risks / Open Questions
- `updateAge` re-issues tokens every 7 days; the `authAt`/`stepUpAt` claims must
  survive token refresh correctly.
- TOTP availability depends on the user having enrolled; define the password
  fallback explicitly.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (P26-12): "Why Kontax asks you to confirm it's you"
- [ ] External · developers — /developers (P29-07)
- [x] Internal · admins/ops — roadmap/runbooks/: which actions step-up + how to support a stuck user
- [x] Internal · engineering — docs/: the step-up policy + strength tiers
