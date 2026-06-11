# P18-04 — Email Verification (Signup & Post-Change)

## Purpose

The current signup flow creates a `User` record and immediately grants full access with no email ownership check. This means a user can register with someone else's email address, which causes problems for password reset (tokens would be sent to the wrong person), billing (invoices go to an unverified address), and share notifications (Phase 12 share invite emails are sent without confidence the recipient owns the inbox). This ticket adds `User.emailVerified`, a `EmailVerificationToken` model, and the verification send/confirm flows that P18-03 (email change), P18-05 (password reset), and Phase 20 (Amazon SES) all depend on.

## Background

The `User` model currently has `email String @unique` but no `emailVerified` field. NextAuth's built-in adapter-backed email provider is not in use — the app uses a custom Credentials provider. Therefore email verification must be implemented manually rather than relying on NextAuth's built-in email flow.

The token model needs to support two distinct use cases handled by the same table:
- **SIGNUP:** sent when a new user creates an account. No consequence for existing sessions.
- **EMAIL_CHANGE:** sent when a user requests a new email address (P18-03). The token validates the new address before it is activated.

Both token types expire and are single-use (marked `usedAt` on consumption).

## Scope

**In scope:**
- `User.emailVerified DateTime?` field
- `EmailVerificationToken` Prisma model
- `sendVerificationEmail(userId, type)` server function — creates token, sends email
- `verifyEmailToken(token)` server action — validates token, marks `User.emailVerified`, marks token used
- Signup hook — call `sendVerificationEmail` immediately after user creation
- Verification landing page (`/verify-email?token=...`) — client page that calls `verifyEmailToken` on load
- Resend verification email action (rate-limited)
- Unverified-account banner in the app (soft gate — full access is retained in v1, but a dismissable banner prompts verification)

**Out of scope:**
- Hard-gating features behind email verification (v1 is a soft nudge only; a hard gate is a product decision for a future phase)
- Email delivery (this ticket uses a local/console transport; Phase 20 wires SES)
- The email template visual design (Phase 20 / DB-03)

---

## Design / Implementation Spec

### Schema changes

Add to the `User` model in `prisma/schema.prisma`:

```prisma
emailVerified DateTime?
```

Add new model:

```prisma
enum EmailVerificationTokenType {
    SIGNUP
    EMAIL_CHANGE
}

model EmailVerificationToken {
    id          String                      @id @default(cuid())
    userId      String
    type        EmailVerificationTokenType
    tokenHash   String                      @unique
    targetEmail String
    expiresAt   DateTime
    usedAt      DateTime?
    createdAt   DateTime                    @default(now())
    user        User                        @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, type, usedAt])
    @@index([tokenHash])
}
```

Add to `User` model:
```prisma
emailVerificationTokens EmailVerificationToken[]
```

Run: `prisma migrate dev --name add-email-verification`

**Field notes:**
- `tokenHash`: SHA-256 hash of the plaintext token (NOT bcrypt — verification tokens are random enough that SHA-256 is sufficient and much faster to verify). The plaintext token is a 32-byte random hex string (64 characters). Stored only as hash; plaintext is embedded in the email link and never persisted.
- `targetEmail`: the email address this token verifies. For SIGNUP tokens this equals `User.email`. For EMAIL_CHANGE tokens this is the new email address being claimed (the `User.email` field still holds the old address until the token is consumed).
- `expiresAt`: SIGNUP tokens expire in 72 hours (to accommodate users who check email infrequently). EMAIL_CHANGE tokens expire in 24 hours (tighter because it is a security-sensitive change).

### Token generation

In `src/server/email-verification.ts`:

```typescript
import crypto from "crypto";

export function generateVerificationToken(): { plaintext: string; hash: string } {
  const plaintext = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}
```

### `sendVerificationEmail` function

```typescript
export async function sendVerificationEmail(
  userId: string,
  type: EmailVerificationTokenType,
  targetEmail?: string, // required for EMAIL_CHANGE, defaults to User.email for SIGNUP
): Promise<void>
```

Steps:
1. Fetch the user; if not found, throw (caller must ensure userId is valid).
2. Determine `email` — use `targetEmail` if provided, else `user.email`.
3. Invalidate any previous unused tokens of the same type for this user: `UPDATE EmailVerificationToken SET usedAt = now() WHERE userId = ? AND type = ? AND usedAt IS NULL`.
4. Generate `{ plaintext, hash }`.
5. Set `expiresAt`: `+72h` for SIGNUP, `+24h` for EMAIL_CHANGE.
6. Insert `EmailVerificationToken { userId, type, tokenHash: hash, targetEmail: email, expiresAt }`.
7. Build the verification URL: `${process.env.APP_URL}/verify-email?token=${plaintext}`.
8. Send email via the transport layer (Phase 20 will swap in SES; for now, use `console.log` in dev or a local SMTP transport):
   - **Subject:** "Confirm your email address – Kontax" (SIGNUP) or "Confirm your new email address – Kontax" (EMAIL_CHANGE)
   - **Body:** "Click the link below to verify your email address. This link expires in 72 hours (or 24 hours for email-change tokens). [Verify email →]"

### `verifyEmailToken` server action

```typescript
export async function verifyEmailToken(
  plaintextToken: string,
): Promise<{ success: true; type: EmailVerificationTokenType } | { error: string }>
```

Steps:
1. Hash the plaintext: `sha256(plaintextToken)`.
2. Look up `EmailVerificationToken` by `tokenHash` where `usedAt IS NULL`.
3. If not found: return `{ error: "TOKEN_INVALID" }`.
4. If `token.expiresAt < now()`: return `{ error: "TOKEN_EXPIRED" }`.
5. Based on `token.type`:
   - **SIGNUP:** `UPDATE User SET emailVerified = now() WHERE id = token.userId AND emailVerified IS NULL`.
   - **EMAIL_CHANGE:** call the `activateEmailChange(token.userId, token.targetEmail)` function (defined in P18-03). That function updates `User.email` and `User.emailVerified` atomically.
6. Mark token used: `UPDATE EmailVerificationToken SET usedAt = now() WHERE id = token.id`.
7. Emit `ACCOUNT_UPDATED` `ActivityEvent` with `payload: { field: "emailVerified" }`.
8. Return `{ success: true, type: token.type }`.

### Verification landing page

Route: `/verify-email` (in `src/app/(auth)/verify-email/page.tsx`)

This is a server component that reads `searchParams.token`, calls `verifyEmailToken(token)`, and renders the result. No client-side JavaScript required for the happy path.

**States:**
- Loading (server-side, no JS spinner needed — just render the result)
- Success (SIGNUP): "Your email is confirmed. [Go to your contacts →]"
- Success (EMAIL_CHANGE): "Your new email address is confirmed. You can now log in with [new email]."
- TOKEN_INVALID: "This verification link is invalid or has already been used. [Request a new link]" (link → `/settings/security?resend=1`)
- TOKEN_EXPIRED: "This verification link has expired. [Request a new link]"

The page does not require an authenticated session — EMAIL_CHANGE links are sent to the new address, which may not yet have a session.

### Signup integration

In the existing signup / registration server action (`src/app/actions/auth.ts` or wherever account creation happens), add after the user insert:

```typescript
await sendVerificationEmail(newUser.id, "SIGNUP");
```

If email sending fails (transport not configured), log a warning and continue — do not fail the signup.

### Unverified account banner

In the main app layout or the contacts workspace, check `session.user.emailVerified` (surfaced via the JWT callback — add `emailVerified` to the token just like `sessionVersion`). If `null`, render a dismissable banner:

```
Please verify your email address. We sent a confirmation link to {email}. [Resend] [Dismiss]
```

- "Resend" calls a `resendVerificationEmail` action (rate-limited to once per 5 minutes per user)
- "Dismiss" stores the dismiss state in `sessionStorage` — it reappears on the next login
- The banner is not shown if `emailVerified` is set or if the user registered via OAuth (P18-08, where the provider has already verified the email)

### Resend action

```typescript
export async function resendVerificationEmail(): Promise<
  { success: true } | { error: string }
>
```

Rate limit: one resend per 5 minutes per `userId`. Uses the same rate-limit key store as P18-02.

---

## Acceptance Criteria

- `User.emailVerified DateTime?` exists in the schema; migration applied cleanly.
- `EmailVerificationToken` model exists with all fields and indexes specified above.
- A new user registration triggers a verification email send (or a console log in dev).
- Visiting `/verify-email?token=<plaintext>` with a valid, unexpired SIGNUP token sets `User.emailVerified = now()`.
- Visiting the verification URL a second time returns TOKEN_INVALID (token is marked used on first consumption).
- Visiting an expired token URL returns TOKEN_EXPIRED.
- The unverified-account banner appears for users with `emailVerified = null`.
- The resend action rate-limits to once per 5 minutes.
- Previous unused tokens of the same type for a user are invalidated when a new one is generated.
- TOKEN_EXPIRED and TOKEN_INVALID render informative states with a link to request a new token.
- `ACCOUNT_UPDATED` ActivityEvent is emitted on successful verification.

---

## Risks and Open Questions

- **Grace period for unverified accounts:** The v1 soft gate (banner only) means unverified accounts have full feature access. If abuse becomes a problem (e.g., users signing up with others' emails and importing their contact data), a hard gate on import and sync could be added without a schema change — just check `emailVerified` in the relevant server actions.
- **Email transport in dev:** Using `console.log` for the token URL in development makes it easy to test the flow without an email provider. Ensure the console output is clearly labelled and only emits in `NODE_ENV !== "production"`.
- **Token URL security:** The `plaintext` token is 64 hex characters (256 bits of entropy). It is transmitted in a URL, which may appear in server logs or referrer headers. Ensure the verification page is served over HTTPS in production and that the token is consumed in the path (not a query param in a GET that could be cached) — though a query param is acceptable here given the one-time-use token model.
- **Email change token flow:** P18-03 calls `sendVerificationEmail` with `type: EMAIL_CHANGE`. The token's `targetEmail` is the new address being claimed. Ensure P18-03 and P18-04 are implemented together (P18-03 depends on P18-04).
