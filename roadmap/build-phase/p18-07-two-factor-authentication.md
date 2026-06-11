# P18-07 — Two-Factor Authentication (TOTP)

## Purpose

Two-factor authentication (2FA) adds a second layer of defence against account takeover. Even if a user's password is compromised, an attacker cannot sign in without also having access to the user's authenticator app. This ticket implements TOTP (Time-based One-Time Password) 2FA using RFC 6238, compatible with Google Authenticator, Authy, 1Password, and any standard TOTP app. It depends on P18-02 (`sessionVersion`, password verification for 2FA disable) and P18-04 (verified email before TOTP enrolment is allowed, to ensure there is a recovery path).

## Background

The current NextAuth Credentials provider (`authorize` function in `src/server/auth/config.ts`) returns a user object on successful password verification, and NextAuth immediately issues a JWT. To add a TOTP challenge step, the flow needs an intermediate state: "password verified but TOTP code not yet submitted." This is implemented with a short-lived "pending TOTP" token that is issued after password verification and consumed by the TOTP verification step, which then issues the full session JWT.

The TOTP secret is stored encrypted in the DB. The application-level encryption uses AES-256-GCM with a key derived from an environment variable (`TOTP_ENCRYPTION_KEY`). This is a different concern from bcrypt password hashing — the TOTP secret needs to be decrypted at login time to verify the user's code, whereas passwords only need to be compared (not decrypted).

## Scope

**In scope:**
- `User.totpEnabled`, `User.totpSecret` (encrypted), `User.totpVerifiedAt` schema fields
- `TotpRecoveryCode` model — single-use hashed recovery codes
- `startTotpEnrolment()` — generates secret, returns QR code data URI + plaintext secret, does not yet enable TOTP
- `confirmTotpEnrolment(totpCode)` — verifies the user's first code, saves encrypted secret, enables TOTP, generates recovery codes
- `disableTotpAuth(password, totpCode)` — requires both credentials before disabling
- `verifyTotpCode(userId, code)` — called during the login flow
- TOTP challenge intermediate page (`/login/verify-2fa`) with recovery code fallback
- NextAuth flow modification: after credentials verify, check `totpEnabled`; if true, redirect to TOTP challenge instead of issuing JWT
- Recovery codes: 8 codes, each a random 10-character alphanumeric string, hashed at rest
- Regenerate recovery codes action

**Out of scope:**
- SMS/email OTP (TOTP only in v1)
- Hardware security keys (FIDO2/WebAuthn — future phase)
- Per-device "remember this device for 30 days" (future enhancement)
- Backup codes via SMS

---

## Design / Implementation Spec

### Schema changes

Add to the `User` model:

```prisma
totpEnabled     Boolean   @default(false)
totpSecret      String?
totpVerifiedAt  DateTime?
```

Add new model:

```prisma
model TotpRecoveryCode {
    id        String    @id @default(cuid())
    userId    String
    codeHash  String
    usedAt    DateTime?
    createdAt DateTime  @default(now())
    user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, usedAt])
}
```

Add to `User`:
```prisma
totpRecoveryCodes TotpRecoveryCode[]
```

Run: `prisma migrate dev --name add-totp`

**TOTP secret encryption:**

The `totpSecret` field stores the TOTP secret AES-256-GCM encrypted:

```typescript
// src/server/totp-crypto.ts

const ENCRYPTION_KEY = Buffer.from(process.env.TOTP_ENCRYPTION_KEY!, "hex");
// TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)

export function encryptTotpSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as: iv(12 bytes) + tag(16 bytes) + ciphertext — base64url encoded
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptTotpSecret(stored: string): string {
  const buf = Buffer.from(stored, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
```

### TOTP library

Use `otpauth` (npm package `otpauth`) — a well-maintained, zero-dependency TOTP/HOTP library:

```typescript
import * as OTPAuth from "otpauth";

export function createTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function generateTotpUri(secret: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Kontax",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

export function verifyTotpCode(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  // delta: ±1 window (30s tolerance for clock drift)
  return totp.validate({ token: code, window: 1 }) !== null;
}
```

### Enrolment flow

#### `startTotpEnrolment` server action

```typescript
export async function startTotpEnrolment(): Promise<{
  qrCodeDataUri: string;
  plaintextSecret: string;
} | { error: string }>
```

Steps:
1. Assert authenticated session.
2. If `User.totpEnabled` is already true: return `{ error: "TOTP_ALREADY_ENABLED" }`.
3. Check `User.emailVerified` — if null, return `{ error: "EMAIL_NOT_VERIFIED" }` (can't enrol without a verified recovery email).
4. Generate a TOTP secret: `createTotpSecret()` — returns a 20-byte base32 string.
5. Generate the TOTP URI: `generateTotpUri(secret, user.email)`.
6. Generate a QR code data URI from the TOTP URI (use `qrcode` npm package — `await QRCode.toDataURL(totpUri)`).
7. Store the secret temporarily in an encrypted pending field — either a short-lived `PendingTotpSecret` table or encrypted in a server-side session store. The simplest approach: encrypt the secret and return it as an opaque `pendingToken` to the client; the client submits it alongside the TOTP code in `confirmTotpEnrolment`. The pending secret is valid for 10 minutes.
8. Return `{ qrCodeDataUri, plaintextSecret }` — the UI shows both.

#### `confirmTotpEnrolment` server action

```typescript
export async function confirmTotpEnrolment(input: {
  totpCode: string;
  pendingToken: string; // the encrypted pending secret from startTotpEnrolment
}): Promise<{ success: true; recoveryCodes: string[] } | { error: string }>
```

Steps:
1. Assert authenticated session.
2. Decrypt `pendingToken` using `decryptTotpSecret` (reuse the same AES-256-GCM encryption). Validate that it has not expired (embed expiry in the token payload as `{ secret, expiresAt }`).
3. Verify `input.totpCode` against the decrypted secret using `verifyTotpCode`.
4. If invalid: return `{ error: "INVALID_TOTP_CODE" }`.
5. Encrypt the secret for permanent storage: `encryptTotpSecret(plaintextSecret)`.
6. Generate 8 recovery codes:
   ```typescript
   const recoveryCodes = Array.from({ length: 8 }, () =>
     crypto.randomBytes(5).toString("base64url").toUpperCase().slice(0, 10)
   );
   const codeHashes = recoveryCodes.map(code =>
     crypto.createHash("sha256").update(code).digest("hex")
   );
   ```
7. In a transaction:
   ```typescript
   await db.$transaction([
     db.user.update({
       where: { id: userId },
       data: {
         totpEnabled: true,
         totpSecret: encryptedSecret,
         totpVerifiedAt: new Date(),
       },
     }),
     db.totpRecoveryCode.deleteMany({ where: { userId } }),
     db.totpRecoveryCode.createMany({
       data: codeHashes.map(h => ({ userId, codeHash: h })),
     }),
   ]);
   ```
8. Emit `ACCOUNT_UPDATED` ActivityEvent with `payload: { field: "totpEnabled" }`.
9. Return `{ success: true, recoveryCodes }` — the plaintext codes are returned once and must be displayed to the user immediately. They are never stored in plaintext.

### Login flow modification

When NextAuth's `authorize` callback verifies credentials successfully and `User.totpEnabled` is true, do not return the user object. Instead, return a special intermediate object:

```typescript
// In the authorize callback, after password verification:
if (user.totpEnabled) {
  // Return a pending-TOTP marker. NextAuth will issue a JWT, but with
  // a special flag that the app middleware checks.
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    pendingTotp: true, // custom field on the user return
  };
}
return { id: user.id, email: user.email, name: user.name };
```

In the `jwt` callback, embed `pendingTotp` in the token:

```typescript
if (user && (user as { pendingTotp?: boolean }).pendingTotp) {
  token.pendingTotp = true;
}
```

The `pendingTotp` redirect is enforced in `src/middleware.ts` (P18-10). The middleware checks `token.pendingTotp === true` and redirects all routes except `/login/verify-2fa` and `/api/auth/**` to the challenge page. This ticket's responsibility is embedding `pendingTotp` correctly in the token; P18-10 owns the middleware file itself. Both must be shipped together in the same PR.

The `Session` interface extension in `src/server/auth/config.ts` must include `pendingTotp` and `pendingDeletion` (P18-09) so the middleware can read them from `req.auth`:

```typescript
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: { id: string; name: string | null; avatarUrl: string | null } & DefaultSession["user"];
    pendingTotp?: boolean;
    pendingDeletion?: boolean;
  }
}
```

The TOTP challenge page is the only page accessible with a `pendingTotp` session.

#### TOTP challenge page — `/login/verify-2fa`

A standalone page (outside the app shell) with:
- "Enter the 6-digit code from your authenticator app"
- Code input (6 digits, auto-submit on 6th digit)
- "Use a recovery code instead" toggle
- Cancel link (signs out the pending session)

On code submission, calls `submitTotpChallenge(code)`:

```typescript
export async function submitTotpChallenge(
  code: string,
): Promise<{ success: true } | { error: string }>
```

Steps:
1. Assert authenticated session where `token.pendingTotp === true`.
2. Fetch `User.totpSecret` and decrypt.
3. Verify the TOTP code. If invalid: return `{ error: "INVALID_TOTP_CODE" }`. Rate-limit: 5 failed attempts → 15-minute lockout on the pending session.
4. Clear `pendingTotp` from the token via a session update, create the full `UserSession` row (since this is effectively the completion of sign-in), emit the session-created event.
5. Redirect to `/contacts`.

**Recovery code path:** Same form, "Use a recovery code" reveals a text input. Calls `redeemTotpRecoveryCode(code)`:
1. Hash the submitted code: `sha256(code.toUpperCase())`.
2. Find an unused `TotpRecoveryCode` for the user with that hash.
3. If found: mark `usedAt = now()`, complete the login, show a warning: "Recovery code used. You have N codes remaining. [Generate new codes]."
4. If not found: return `{ error: "INVALID_RECOVERY_CODE" }`.

### `disableTotpAuth` server action

```typescript
export async function disableTotpAuth(input: {
  password: string;
  totpCode: string;
}): Promise<{ success: true } | { error: string }>
```

Requires both the account password and a current TOTP code before disabling. Steps mirror P18-02's `changePassword` (bcrypt verify), then `verifyTotpCode`, then `db.user.update({ totpEnabled: false, totpSecret: null, totpVerifiedAt: null })` + `db.totpRecoveryCode.deleteMany`.

---

## Acceptance Criteria

- `User.totpEnabled`, `User.totpSecret`, `User.totpVerifiedAt` exist in the schema; `TotpRecoveryCode` model exists; migration applied.
- `startTotpEnrolment` returns a QR code data URI and plaintext secret; requires a verified email.
- `confirmTotpEnrolment` with the correct first TOTP code enables TOTP and returns 8 recovery codes.
- Recovery codes are stored as SHA-256 hashes; the plaintext is returned once and never re-derivable from the DB.
- After enrolment, signing in with correct credentials redirects to `/login/verify-2fa` instead of issuing a full session.
- A valid TOTP code on the challenge page completes sign-in and issues a normal session.
- A recovery code on the challenge page completes sign-in and marks the code used.
- A used recovery code cannot be reused (marked `usedAt`).
- `disableTotpAuth` requires both the correct password and a valid TOTP code.
- TOTP secret is stored AES-256-GCM encrypted; the plaintext is never persisted.
- 5 failed TOTP attempts on the challenge page trigger a 15-minute lockout.
- `ACCOUNT_UPDATED` ActivityEvent is emitted on TOTP enable and disable.

---

## Risks and Open Questions

- **`pendingTotp` JWT approach:** Embedding `pendingTotp: true` in a JWT and relying on `src/middleware.ts` (P18-10) to redirect is a pattern that must be tested carefully. The middleware must gate every non-challenge page and must allow access to `/login/verify-2fa`, static assets, and auth API routes. A missed route is a security bypass. Ship this ticket and P18-10 together; do not merge either without the other.
- **TOTP_ENCRYPTION_KEY rotation:** If the encryption key needs to be rotated, all stored TOTP secrets must be re-encrypted. Define a key rotation procedure: set `TOTP_ENCRYPTION_KEY_PREVIOUS`, decrypt with old key, re-encrypt with new key, clear the old field. Not in scope for v1 but document it.
- **Clock drift:** The `window: 1` parameter in `verifyTotpCode` allows ±30 seconds of clock drift. This covers most devices. Users with severely misconfigured clocks (>30s drift) will experience failures — document this as a known limitation.
- **Recovery codes as the only 2FA bypass:** If a user loses both their authenticator and all recovery codes, there is no self-service recovery path in v1. They must contact support. Document the support escalation path (admin-side TOTP disable in Phase 21).
