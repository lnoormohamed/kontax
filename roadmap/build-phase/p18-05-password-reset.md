# P18-05 — Password Reset (Forgot Password via Email Link)

## Purpose

Users who forget their password currently have no recovery path — they cannot sign in and cannot get back into their account without direct database intervention. This ticket adds the standard forgot-password flow: request a reset link by email, click the link (which expires in 15 minutes), and set a new password. It depends on P18-04's email infrastructure and P18-02's `sessionVersion` mechanism for session invalidation.

## Background

The NextAuth Credentials provider (`src/server/auth/config.ts`) handles login but has no built-in password reset. This must be implemented as a standalone flow outside of NextAuth. The flow is intentionally short-lived (15-minute token) because it is a high-privilege operation: anyone who can receive the email can set a new password.

The pattern mirrors the `EmailVerificationToken` model from P18-04, but with separate concerns (different expiry, different page, different `ActivityEvent`). A separate `PasswordResetToken` model is used rather than reusing `EmailVerificationToken` to keep the purpose and auditing distinct.

## Scope

**In scope:**
- `PasswordResetToken` Prisma model
- `requestPasswordReset(email)` server action — creates token, sends email, rate-limited
- Password reset landing page (`/reset-password?token=...`) — form to set new password
- `resetPassword(token, newPassword)` server action — validates token, updates password, invalidates sessions
- Rate limiting on the request endpoint
- `ActivityEvent` emission on successful reset

**Out of scope:**
- SMS-based reset (email only in v1)
- Admin-initiated password reset (Phase 21)
- Account recovery when email is also lost (out of scope — document as a support escalation path)

---

## Design / Implementation Spec

### Schema change

Add to `prisma/schema.prisma`:

```prisma
model PasswordResetToken {
    id          String    @id @default(cuid())
    userId      String
    tokenHash   String    @unique
    expiresAt   DateTime
    usedAt      DateTime?
    requestedFromIp String?
    createdAt   DateTime  @default(now())
    user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, usedAt, expiresAt])
    @@index([tokenHash])
}
```

Add to `User` model:
```prisma
passwordResetTokens PasswordResetToken[]
```

Run: `prisma migrate dev --name add-password-reset-token`

**Field notes:**
- `tokenHash`: SHA-256 hash of a 32-byte random hex token (same approach as `EmailVerificationToken`). The plaintext is embedded in the reset URL and never stored.
- `expiresAt`: 15 minutes from creation. Short because this token can be used to take over an account.
- `requestedFromIp`: stored for audit; helps detect if a reset was triggered from an unusual IP.

### Server action — `requestPasswordReset`

Route: exposed as a form action on `/login` via a "Forgot password?" link, or from a dedicated `/forgot-password` page.

```typescript
export async function requestPasswordReset(
  email: string,
): Promise<{ success: true }>
```

This action always returns `{ success: true }` regardless of whether the email is registered. **Never reveal whether an account exists for a given email** — this prevents account enumeration.

Steps:
1. Validate `email` format (zod).
2. Rate limit: max 3 requests per email per 30-minute window; max 10 requests per IP per 30-minute window. If exceeded, return `{ success: true }` (same response as non-rate-limited — do not reveal the limit was hit via the response; log it server-side).
3. Look up `User` by `email` (case-insensitive). If not found: log a warning, return `{ success: true }` without sending any email.
4. Invalidate previous unused tokens for this user: `UPDATE PasswordResetToken SET usedAt = now() WHERE userId = ? AND usedAt IS NULL`.
5. Generate `{ plaintext, hash }` using the same `generateVerificationToken()` function from P18-04.
6. Insert `PasswordResetToken { userId, tokenHash: hash, expiresAt: now() + 15min, requestedFromIp }`.
7. Build reset URL: `${APP_URL}/reset-password?token=${plaintext}`.
8. Send email:
   - **Subject:** "Reset your Kontax password"
   - **Body:** "Click the link below to reset your password. This link expires in 15 minutes. If you didn't request a password reset, you can safely ignore this email — your password has not been changed. [Reset password →]"
9. Return `{ success: true }`.

### Password reset landing page

Route: `/reset-password` (in `src/app/(auth)/reset-password/page.tsx`)

This page reads `searchParams.token`, validates it on the server before rendering, and either:
- Renders the new-password form (valid, unexpired token), or
- Renders an error state (invalid/expired token)

**Server-side token pre-validation** (before rendering the form):
```typescript
const tokenHash = sha256(searchParams.token);
const token = await db.passwordResetToken.findUnique({
  where: { tokenHash },
  select: { usedAt: true, expiresAt: true, userId: true },
});
const isValid = token && !token.usedAt && token.expiresAt > new Date();
```

**States:**

- **Valid token:** Render form: "New password" + "Confirm new password" + [Reset password] button. The plaintext token is embedded in a hidden form field or passed via the server action argument.
- **TOKEN_INVALID:** "This reset link is invalid or has already been used. [Request a new link →]"
- **TOKEN_EXPIRED:** "This reset link has expired (links are valid for 15 minutes). [Request a new link →]"

### Server action — `resetPassword`

```typescript
export async function resetPassword(input: {
  plaintextToken: string;
  newPassword: string;
}): Promise<{ success: true } | { error: string }>
```

Steps:
1. Validate `newPassword`: min 8 characters.
2. Hash the token: `sha256(input.plaintextToken)`.
3. Look up `PasswordResetToken` where `tokenHash = hash AND usedAt IS NULL`.
4. If not found: return `{ error: "TOKEN_INVALID" }`.
5. If `token.expiresAt < now()`: return `{ error: "TOKEN_EXPIRED" }`.
6. Hash the new password: `bcrypt.hash(input.newPassword, 12)`.
7. Atomic update in a transaction:
   ```typescript
   await db.$transaction([
     db.user.update({
       where: { id: token.userId },
       data: {
         password: newHash,
         sessionVersion: { increment: 1 },
       },
     }),
     db.passwordResetToken.update({
       where: { id: token.id },
       data: { usedAt: new Date() },
     }),
   ]);
   ```
8. Emit `ACCOUNT_UPDATED` `ActivityEvent` with `payload: { field: "passwordResetCompleted" }`, `actor: Actor.SYSTEM` (the reset is initiated via email, not an active session).
9. Return `{ success: true }`.

**On success, the page redirects to `/login?message=password-reset`.** The login page shows: "Your password has been reset. Please sign in with your new password."

### "Forgot password?" link on the login page

Add a "Forgot password?" link below the password field on `/login`, pointing to `/forgot-password`. The `/forgot-password` page is a simple form with an email field and a submit button. After submission (success or not), show: "If an account exists for that email, we've sent a reset link. Check your inbox."

---

## Acceptance Criteria

- `PasswordResetToken` model exists in the schema with all fields above; migration applied.
- `requestPasswordReset` always returns success and never reveals whether the email is registered.
- A reset email is sent when the email matches a registered account.
- The reset URL contains a plaintext token; only the SHA-256 hash is stored in the DB.
- Visiting `/reset-password?token=<valid>` renders the new-password form.
- Submitting a valid token with a valid new password updates `User.password`, increments `sessionVersion`, and marks the token used.
- After reset, all existing sessions are invalidated (via `sessionVersion` increment per P18-02).
- Visiting the same token URL a second time returns TOKEN_INVALID (token is marked used on first consumption).
- Visiting an expired token returns TOKEN_EXPIRED.
- Previous unused reset tokens for a user are invalidated when a new request is made.
- Rate limiting: more than 3 requests for the same email within 30 minutes are silently accepted client-side but not processed server-side.
- `ACCOUNT_UPDATED` ActivityEvent is emitted on successful reset.
- The "Forgot password?" link is visible on the login page.

---

## Risks and Open Questions

- **15-minute token window:** Some users check email infrequently. 15 minutes is standard for password resets (GitHub, Google both use this window). The short window reduces the attack surface if a reset email is intercepted. If user feedback shows the window is too short, it can be increased to 30 minutes without security risk.
- **No current-password requirement:** Unlike the password-change flow (P18-02), password reset does not require the current password — that is the whole point (the user forgot it). The email verification step is the ownership proof. Document this distinction clearly in the codebase.
- **`Actor.SYSTEM` for the ActivityEvent:** The reset is triggered by an email link, not by an authenticated session. Using `Actor.SYSTEM` is correct since there is no `session.user.id` available at the time of the reset. The `requestedFromIp` on the token record provides the audit trail.
- **Notification to the user:** Consider sending a confirmation email ("Your password was successfully reset") after the reset completes, not just a notification email when the reset was *requested*. This gives the user an alert if the reset was done by an attacker. Add this as a follow-up if not in v1 scope.
