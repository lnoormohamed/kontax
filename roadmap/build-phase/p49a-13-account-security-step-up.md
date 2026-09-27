# P49A-13 — Step-up for durable credentials; account-security hardening

**Phase:** 49A · **Priority:** P1 · **Depends on:** — · **Effort:** M (many S items) · **Status:** Done (2026-09-27, branch `p49a-13`; not yet deployed — no migration needed; awaiting Fable security review)
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

## Resolution (2026-09-27)

Branch `p49a-13` (from `docs/p49-homepage-brief` @ 98f0d1b), seven commits. **No schema change**
— the new recovery-code hash format lives in the existing `TotpRecoveryCode.codeHash` column.

### 1. Step-up for durable credentials (A-28)
All checks are server-side through `verifyStepUpPassword` (`src/server/auth/step-up.ts`);
OAuth-only accounts (no password hash) pass on their session, the helper's existing convention.
- **API token creation** — `createApiToken` (`src/app/actions/api-tokens.ts`) takes
  `currentPassword`, returns a result instead of throwing (Next redacts thrown action messages in
  production, so the old error codes never reached the form), validates name/scope with zod and
  reports a duplicate name. Settings → Developer asks in `ConfirmPasswordModal` (`serverVerifies`).
- **TOTP enrolment** — `startTotpEnrolment({ currentPassword })` verifies the password before
  minting the pending token; the token now carries `userId`, and `confirmTotpEnrolment` refuses a
  token minted for another account or before this change (no `userId`; they expire in 10 min
  anyway). The enrol modal opens on a password step. Confirm needs no second prompt.
- **Recovery-code regeneration** — password **and** a second factor: a current TOTP code
  (rate-limited `totpChallenge` bucket `regen:<user>`, replay-guarded through `lastTotpCounter`)
  or, decision beyond the ticket, **one of the user's unused recovery codes**. Without that, a
  user who lost their phone and signed in with a recovery code (what the help centre tells them
  to do) could never get a fresh set. Logs an `ACCOUNT_UPDATED` activity event.
- **CardDAV credentials** — `createSyncAccount` and `attachSyncCredentials`
  (`src/app/actions/sync.ts`, `checkSyncCredentialStepUp`) require the Kontax password
  (`currentPassword` form field) before discovery or any write. The add-account and
  edit-credentials forms show a "Your Kontax password" field for password accounts.
- The step-up bucket (5/hour) now **refunds a correct password** (`refundRateLimit`, consumed
  before the compare so concurrent guesses stay bounded): only wrong passwords count, so a user
  doing a few CardDAV attempts isn't locked out.
- Already covered before this ticket: data export, app passwords, billing portal, account
  deletion, email change (password required).

### 2. Password change / reset revoke API tokens
`changePassword` and `resetPassword` revoke every live API token (`revokeAllApiTokens`,
`src/server/api-tokens.ts`) in the same transaction as the password write and return the count.
The user is told: the Security page notice ("All N of your API tokens were revoked — create new
ones in Settings → Developer") and, after a reset, the login banner (`?message=password-reset-tokens`).
The activity event records the count. `resetPassword` also claims its token atomically now
(conditional `updateMany`). App passwords (CardDAV devices) are deliberately **not** revoked —
they already required a step-up to create, and revoking them would silently break every device.

### 3. Recovery codes
- 16 RFC 4648 base32 characters (80 bits), shown `XXXX-XXXX-XXXX-XXXX`; stored as scrypt
  (N=2^14, r=8, p=1) under a random per-set salt: `s1$<salt>$<hash>` (`src/server/totp-recovery-codes.ts`).
  One salt per set, so redeeming costs one scrypt, not eight.
- Redemption loads the (≤ 8) unused codes and compares every one in constant time, then claims
  atomically with `updateMany({ usedAt: null })` (P49A-19's claim kept).
- **Compatibility:** pre-existing 10-hex / unsalted SHA-256 codes still redeem until the user
  regenerates (they can't be upgraded in place — only hashes are stored). Settings → Security says
  when a set still holds old-format codes. Input ignores case, spaces and dashes, and reads 0/1/8
  as O/I/B for new codes.

### 4. Linear CardDAV response parsing (A-29)
`extractElements` / `firstElementContents` added to `src/server/dav/parse.mjs` on the existing
single-pass `forEachTag`; `carddav.ts` `getResponseBlocks` / `getTagContent` / `summarizeResponse`
use them — no regex runs over a whole response any more. Unclosed elements yield nothing;
CDATA/comments are one token. A 10 MB body of unclosed `<d:response>` tags parses in ~75 ms
(unclosed property tags ~90 ms) in isolation; the old regexes take minutes. Caps: discovery
PROPFIND responses **2 MB**; the address-book REPORT keeps **10 MB** because it still returns the
whole book in one response — lower it to 2 MB per page when P49A-16 adds the batched multiget.

### 5. Smaller items
- `javascript:` URLs: contact form website fields are http(s)-only (`src/lib/safe-url.ts`); the
  inline editor (free text, "example.com" allowed) refuses script/embed schemes; the public card
  links a website only through `safeExternalHref` and drops others from its JSON-LD.
- Single-use share link: conditional claim (`status: ACTIVE`, `downloadCount < maxDownloads`),
  then expiry by the row's own count (`src/app/share/[token]/vcard/route.ts`).
- `checkUsernameAvailability`: session required, 60 checks/user/hour (`rate_limited` state in UI).
- `PublicCardView`: one counted view per (IP, card) per 30 min, ≤ 120 per IP per hour.
- Invites: declining a family/team invite and accepting a family invite require the invitee
  (user id or current email, `src/server/invite-recipient.ts`). Accepting a family invite was
  not bound before (team accept was, P48-17) — decision: bound it too.
- REST API: an IP with 30 invalid tokens in 15 min gets 429 before the token lookup (peek, count
  failures only); `lastUsedAt` / `requestCountThisMonth` are written only after the per-token rate
  limit passes.
- Same-origin: `src/server/same-origin.ts` (`Sec-Fetch-Site`, else `Origin`). Book re-discovery
  is `POST /api/sync/[id]/books` (was `GET ?refresh=1`); that route and the CSV / vCard export
  GETs refuse cross-site requests.
- XFF: production trusts `CF-Connecting-IP` only (`src/lib/client-ip.ts` + the `.mjs` twin);
  `KONTAX_TRUST_FORWARDED_FOR=1` re-enables the fallback for a non-Cloudflare deployment.
- Logs: user ids not emails (hard-delete cron, Google callback); the email transport redacts the
  recipient on suppression/failure.
- Kontax archive import: Content-Length over 64 MB refused before the body is read, one upload in
  flight per user (per process), 20 uploads/user/hour across preview + commit.
- Help centre copy updated for the new prompts, the code format and token revocation.

### Tests
New: `account-security-step-up`, `sync-credential-step-up`, `carddav-response-parsing`,
`account-security-hardening`, `share-invite-website-hardening`; `totp-recovery-codes` rewritten
for the new format/step-up (legacy codes still redeem). `npm run test:repo`: 590 tests, 576 pass,
14 skipped (DB-gated), 0 fail. `_fake-prisma` gained `{ increment }` and array `$transaction`.

### Not done / follow-ups
- **Google / Outlook OAuth connect** (`/api/sync/{google,microsoft}/connect`) still needs only the
  session: a hijacked cookie can connect the attacker's Google account as a two-way sync target.
  Same threat as `attachSyncCredentials`; needs a step-up before the redirect (e.g. reuse the
  15-minute sync elevation) plus UI on every connect/reconnect entry point.
- `lockdown` ("Secure my account" on a security alert) revokes sessions but not API tokens; the
  password reset it triggers does.
- Admin-audit items 7–11 belong to P49A-07.
