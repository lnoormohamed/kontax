# P49A-13 — Step-up for durable credentials; account-security hardening

**Phase:** 49A · **Priority:** P1 · **Depends on:** — · **Effort:** M (many S items)
**Audit IDs:** A-28, A-29, and security P2 items (SEC-4, -5, -7, -8, -9, -10; admin-audit 7–11)

## Objective
A hijacked browser session must not be able to mint durable access, take over 2FA, or redirect
contact exports; close the remaining low-severity gaps.

## Production verification (2026-09-25)
Code-verified against origin/main (identical to audited code):
- `createApiToken` has no `verifyStepUpPassword` (0 matches in `actions/api-tokens.ts`), and
  `validateApiToken` ignores `sessionVersion` (tokens survive a password change).
- `startTotpEnrolment`, `confirmTotpEnrolment`, `regenerateRecoveryCodes` (`totp.ts:33-153`) gate
  on the session only (0 step-up matches in `regenerateRecoveryCodes`).
- `attachSyncCredentials` (`sync.ts:1039`) needs no elevation, unlike settings changes.
- A-29: lazy `[\s\S]*?` regexes over up to 10 MB untrusted CardDAV bodies (`carddav.ts:171,190`).

## Steps
1. Require `verifyStepUpPassword` for: API token creation, TOTP enrol/confirm, recovery-code
   regeneration (plus a current TOTP code), `attachSyncCredentials` and `createSyncAccount`.
2. Revoke API tokens (or require re-confirmation) on password change.
3. Recovery codes: ≥ 16 base32 chars, slow hash, atomic `updateMany({ usedAt: null })` redemption.
4. Replace the response-block regexes with the linear tokenizer from `parse.mjs`; lower the
   REPORT/PROPFIND cap (e.g. 2 MB per page) and bail on unclosed tags.
5. Smaller items: `javascript:` URLs rejected in `isValidUrl` and at render; single-use share link
   via conditional `updateMany`; session + rate limit on `checkUsernameAvailability`; per-IP
   sampling/limit on `PublicCardView`; decline-invite bound to invitee; IP limiter before API
   token lookup and count requests after the rate check; `assertSameOrigin` on cookie-authed
   side-effecting GETs (make `books?refresh` a POST); drop the XFF fallback in production; log user
   ids not emails; per-user limiter/concurrency on the 64 MB archive import.

## Acceptance
- Tests: each step-up action fails without the password; recovery code can't be redeemed twice
  concurrently; a 10 MB pathological REPORT body parses in linear time (< 200 ms);
  `javascript:alert(1)` website rejected.
- Fable security review sign-off.
