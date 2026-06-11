# P18-03 — Email Change Flow

## Purpose

Users need to be able to update the email address on their account — whether correcting a typo, switching providers, or separating work and personal addresses. This is a security-sensitive operation: the email address is the primary identity and recovery credential. The flow must verify ownership of the new address before activating it, and must notify the old address so the user is aware if the change was made without their knowledge.

## Background

`User.email` is a `@unique` field in the Prisma schema. It is the login credential used by the NextAuth Credentials provider (`src/server/auth/config.ts`) and is embedded in the JWT session token. Changing it requires updating the DB record, updating the in-flight JWT, and re-verifying the new address.

The verification token infrastructure is defined in P18-04 (`EmailVerificationToken`, `sendVerificationEmail`, `verifyEmailToken`). P18-03 depends on P18-04 being implemented first. The `EMAIL_CHANGE` token type and `activateEmailChange` hook are defined here; the token mechanics live in P18-04.

## Scope

**In scope:**
- `User.emailPendingChange String?` and `User.emailPendingChangeRequestedAt DateTime?` schema fields
- `requestEmailChange(newEmail)` server action — validates new email, saves pending state, sends verification to new address, sends notification to old address
- `activateEmailChange(userId, newEmail)` internal function — called by `verifyEmailToken` when an `EMAIL_CHANGE` token is consumed; atomically swaps `User.email`, clears pending state, re-sets `emailVerified`
- Cancellation: `cancelEmailChange()` server action — clears pending state without activating
- Settings page UI: current email display, "Change email" form, pending-change status banner

**Out of scope:**
- The email transport (uses the same transport layer as P18-04; Phase 20 wires SES)
- Changing the email for OAuth-only accounts where no password exists (deferred to P18-08)

---

## Design / Implementation Spec

### Schema changes

Add to the `User` model in `prisma/schema.prisma`:

```prisma
emailPendingChange            String?
emailPendingChangeRequestedAt DateTime?
```

No separate index needed — these are nullable fields queried by `userId` (primary key).

Run: `prisma migrate dev --name add-email-pending-change`

**Field notes:**
- `emailPendingChange`: the new email address the user has requested but not yet verified. Stored in plaintext since it is not sensitive — it is a future email address, not a password.
- `emailPendingChangeRequestedAt`: used for expiry checks (same 24-hour window as the `EMAIL_CHANGE` token) and for displaying "Requested N hours ago" in the UI.

### Server action — `requestEmailChange`

In `src/app/actions/account.ts`:

```typescript
export async function requestEmailChange(
  newEmail: string,
): Promise<{ success: true } | { error: string }>
```

Steps:
1. Assert authenticated session.
2. Validate `newEmail`: valid email format (zod `z.string().email()`), max 254 characters (RFC 5321), lowercase + trim.
3. Check that `newEmail` differs from the current `User.email`. Return `{ error: "EMAIL_SAME_AS_CURRENT" }` if identical.
4. Check that `newEmail` is not already in use: `db.user.findUnique({ where: { email: newEmail } })`. If a record exists (and it is not the current user), return `{ error: "EMAIL_ALREADY_IN_USE" }`.
5. Persist the pending state:
   ```typescript
   await db.user.update({
     where: { id: session.user.id },
     data: {
       emailPendingChange: newEmail,
       emailPendingChangeRequestedAt: new Date(),
     },
   });
   ```
6. Send verification email to `newEmail` via `sendVerificationEmail(userId, "EMAIL_CHANGE", newEmail)` (P18-04).
7. Send a notification email to the current `User.email` (the old address):
   - Subject: "Your Kontax email address is being changed"
   - Body: "A request was made to change your Kontax account email to [newEmail]. If you made this request, you can ignore this email — the change will only activate after you verify the new address. If you didn't make this request, [secure your account →] (link to password reset)"
   - Send async; do not fail the action if this send fails.
8. Emit `ACCOUNT_UPDATED` `ActivityEvent` with `payload: { field: "emailChangeRequested", newEmail }`.
9. Return `{ success: true }`.

### `activateEmailChange` internal function

This function is called by `verifyEmailToken` (P18-04) when a token of type `EMAIL_CHANGE` is consumed successfully:

```typescript
export async function activateEmailChange(
  userId: string,
  newEmail: string,
): Promise<void>
```

Steps:
1. Re-check that `newEmail` is not already taken by another user (race condition guard).
2. Atomic update:
   ```typescript
   await db.user.update({
     where: { id: userId },
     data: {
       email: newEmail,
       emailVerified: new Date(),
       emailPendingChange: null,
       emailPendingChangeRequestedAt: null,
       sessionVersion: { increment: 1 }, // invalidate all sessions — user must re-login with new email
     },
   });
   ```
3. Emit `ACCOUNT_UPDATED` `ActivityEvent` with `payload: { field: "email", newEmail }`.

**Why `sessionVersion` is incremented:** After an email change, all existing sessions embed the old email address in the JWT. These sessions are now stale. The user must sign in again with the new email. This is intentional and expected — the UI should inform the user that they will be signed out after the email change activates.

### Server action — `cancelEmailChange`

```typescript
export async function cancelEmailChange(): Promise<{ success: true }>
```

Steps:
1. Assert authenticated session.
2. `UPDATE User SET emailPendingChange = NULL, emailPendingChangeRequestedAt = NULL WHERE id = session.user.id`
3. Invalidate any unused `EMAIL_CHANGE` tokens for this user: `UPDATE EmailVerificationToken SET usedAt = now() WHERE userId = ? AND type = 'EMAIL_CHANGE' AND usedAt IS NULL`.
4. Return `{ success: true }`.

### Settings page UI

The email section lives within `/settings/security` (alongside the password change form from P18-02).

**State A — No pending change:**
```
Email address
[user@example.com]  (read-only display)
[Change email]  (button)
```

Clicking "Change email" expands an inline form:
```
New email address
[                    ]
[Send verification email]   [Cancel]
```

**State B — Pending change in progress:**
```
Email address
[user@example.com]  (current address, read-only)

A verification email was sent to [newemail@example.com].
Check your inbox and click the link to confirm the change. (Sent N hours ago)

[Resend verification]   [Cancel email change]
```

- "Resend verification" calls `requestEmailChange(pendingEmail)` again (same rate limit as P18-04's resend — once per 5 minutes).
- "Cancel email change" calls `cancelEmailChange()` and returns to State A.

**State C — Change just activated (redirect from `/verify-email` with `type=EMAIL_CHANGE`):**
The user will be signed out (because `sessionVersion` was incremented). Redirect to `/login` with a query param: `/login?message=email-changed`. The login page shows: "Your email has been updated. Please log in with your new address."

### Error messages in UI

| Error code | Displayed message |
| --- | --- |
| `EMAIL_SAME_AS_CURRENT` | "That's already your current email address." |
| `EMAIL_ALREADY_IN_USE` | "That email address is already associated with another account." |
| `RATE_LIMIT_EXCEEDED` | "Too many requests. Please wait a few minutes." |

---

## Acceptance Criteria

- `User.emailPendingChange` and `User.emailPendingChangeRequestedAt` exist in the schema; migration applied.
- `requestEmailChange` rejects an email that matches the current address.
- `requestEmailChange` rejects an email already in use by another account.
- A successful request saves `emailPendingChange` and triggers a verification email to the new address.
- A notification email is sent to the current (old) address when an email change is requested.
- The settings page shows a "pending change" banner when `emailPendingChange` is set.
- `cancelEmailChange` clears the pending state and invalidates any unused EMAIL_CHANGE tokens.
- Consuming a valid `EMAIL_CHANGE` token via `/verify-email` calls `activateEmailChange`, swapping `User.email` to the new address.
- After `activateEmailChange`, `User.emailVerified` is set, `User.sessionVersion` is incremented, and all existing sessions are invalidated.
- The user is redirected to `/login?message=email-changed` after the email change activates.
- `ACCOUNT_UPDATED` ActivityEvent is emitted both at request time and at activation time.

---

## Risks and Open Questions

- **Race condition on email uniqueness:** Steps 4 and 5 (check uniqueness, then write) have a TOCTOU window. Two users could both request the same new email before either activates. The `activateEmailChange` function re-checks uniqueness before the final write, which catches this case. The `User.email` field has a `@unique` constraint so the DB will also reject a duplicate at write time — handle the Prisma unique constraint error and surface it as `EMAIL_ALREADY_IN_USE`.
- **24-hour token expiry for pending change:** If the token expires before the user verifies, the pending state (`emailPendingChange`) remains in the DB but the token is no longer usable. The UI must detect this and prompt the user to resend (by comparing `emailPendingChangeRequestedAt + 24h` against now). The resend generates a new token and resets `emailPendingChangeRequestedAt`.
- **OAuth accounts:** If a user has linked an OAuth account (P18-08) that uses the old email, the OAuth link may become stale after an email change. Document this as a known edge case for P18-08 to handle.
- **Billing email:** The Stripe `SubscriptionCustomer.billingEmail` field (Phase 19) stores a billing email that may differ from `User.email`. Changing `User.email` should not automatically change the billing email — these are intentionally separate. Document this.
