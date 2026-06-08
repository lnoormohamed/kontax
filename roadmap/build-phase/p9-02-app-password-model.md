# P9-02 App Password Model

## Purpose
Native CardDAV clients authenticate using HTTP Basic Auth over HTTPS — they send a username and password on every request. Using the user's primary account password for this is a serious security risk: it would mean a stolen device or a compromised third-party sync client has the user's full Kontax login credentials. App passwords solve this by creating per-device, revocable, limited-scope credentials that can be invalidated without affecting the user's login session or other connected devices. This ticket adds the `AppPassword` model, its generation and hashing logic, plan-based limits, and the server-side verification path that CardDAV auth middleware will call.

## Background
The Kontax Prisma schema already has `User`, `Subscription`, and `AuditEvent` models from earlier phases. The `Subscription` model carries a `plan` field (`FREE`, `PLUS`, `PRO`) and per-plan boolean entitlements. The existing sync credential storage uses a `credentialReference` approach on `SyncAccount` — app passwords for the CardDAV server are a different concept and require their own first-class model because they are user-facing, plan-gated, and need a revocation timestamp.

The `src/server/auth/` directory contains existing session-based auth logic. App password verification is a new code path that runs exclusively in CardDAV request handlers; it must not interfere with the existing session cookie flow.

## Scope

**In scope:**
- `AppPassword` Prisma model: schema, migration, indexes
- Token generation: 24-character base58url random string, shown once, stored as bcrypt hash
- Plan limit enforcement: Free=1, Plus=3, Pro=unlimited
- Server-side verification function: look up active password by user email, compare bcrypt hash
- `lastUsedAt` timestamp update on successful auth
- Revocation: set `revokedAt`, do not hard-delete
- Rate limiting: auth attempt throttle per-IP and per-email
- Audit event emission on creation and revocation
- Server action or API route for creating, listing, and revoking app passwords

**Out of scope:**
- Settings page UI (P9-05)
- Design (P9-06)
- Per-password sync-direction restriction (deferred to a future pass)
- OAuth2 or token introspection endpoints — Basic Auth only in v1

---

## Design / Implementation Spec

### Prisma Model

Add the following to `prisma/schema.prisma`:

```prisma
model AppPassword {
    id            String    @id @default(cuid())
    userId        String
    label         String
    hashedPassword String
    lastUsedAt    DateTime?
    revokedAt     DateTime?
    createdAt     DateTime  @default(now())
    updatedAt     DateTime  @updatedAt
    user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, revokedAt, createdAt])
    @@index([userId, revokedAt])
}
```

Add to the `User` model:

```prisma
appPasswords AppPassword[]
```

**Field notes:**

- `id`: cuid, primary key.
- `userId`: foreign key to `User.id`, cascade delete. If a user's account is deleted, all their app passwords are destroyed.
- `label`: free-text string entered by the user at creation time (e.g. "iPhone", "Work Mac", "DAVx5"). Max 64 characters. Not unique per user — a user might create two passwords labeled "iPhone" if they upgrade phones.
- `hashedPassword`: bcrypt hash (cost factor 12) of the generated plaintext token. The plaintext is never persisted anywhere: not in the database, not in logs, not in response bodies after the initial creation response.
- `lastUsedAt`: updated to `now()` on every successful BasicAuth verification. Allows users to see which device last used a credential and identify stale or stolen ones.
- `revokedAt`: soft-delete field. When set, the credential is permanently invalid. The record is retained for audit purposes.
- `createdAt`: immutable timestamp for display in the UI.
- `updatedAt`: auto-managed.

**Indexes:**

- `[userId, revokedAt, createdAt]`: supports listing active (non-revoked) passwords for a user, ordered by creation date.
- `[userId, revokedAt]`: supports counting active passwords for plan-limit enforcement.

### Token Generation

App password tokens are generated using Node.js `crypto.randomBytes`. The token must be:

- Random: 18 bytes of cryptographic randomness (produces 24 base58 characters)
- Base58url encoded: uses the Bitcoin base58 alphabet (`123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`). Avoids ambiguous characters (`0`, `O`, `I`, `l`) to reduce transcription errors if a user ever needs to type the token manually.
- 24 characters long: provides approximately 132 bits of entropy, well above the NIST recommendation for high-security credentials.
- Formatted for readability: displayed in groups of 4 separated by hyphens in the UI (e.g. `a3Kx-mP9q-bNRt-vZ7w-hYcJ-kWQd`) but stored and verified without hyphens.

**Generation function** (`src/server/app-passwords.ts`):

```typescript
import crypto from "crypto";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function generateAppPasswordToken(): string {
  const bytes = crypto.randomBytes(18);
  let result = "";
  let num = BigInt("0x" + bytes.toString("hex"));
  const base = BigInt(58);
  while (num > 0n) {
    result = BASE58_ALPHABET[Number(num % base)]! + result;
    num = num / base;
  }
  // Pad to exactly 24 characters
  while (result.length < 24) {
    result = BASE58_ALPHABET[0]! + result;
  }
  return result;
}
```

**Hashing:**

```typescript
import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export async function hashAppPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export async function verifyAppPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
```

bcrypt cost factor 12 is chosen to balance security (brute-force resistance) against latency: on modern hardware, cost 12 takes ~200-400ms, acceptable for an auth check that runs once per CardDAV sync initiation but not on every request. See the caching note below.

### Auth Verification Flow

The CardDAV auth middleware (implemented in P9-03) calls the following function:

```typescript
export async function verifyCardDavCredentials(
  email: string,
  plaintext: string,
): Promise<{ userId: string; appPasswordId: string } | null>
```

Steps:
1. Look up `User` by `email` (case-insensitive match). If not found, return `null`. Do not reveal whether the user exists.
2. Fetch all active (non-revoked) `AppPassword` records for the user.
3. Iterate and `bcrypt.compare` each hash against the plaintext. Stop on first match.
4. If a match is found: update `lastUsedAt = now()` on the matching `AppPassword` record (fire-and-forget — do not await if performance is a concern); return `{ userId, appPasswordId }`.
5. If no match: return `null`.
6. Return `null` in all error cases without throwing — the calling middleware converts `null` to HTTP 401.

**Performance consideration:** Iterating all app passwords per request is acceptable because the plan limit caps the number at 5 for PLUS and 1 for FREE. For PRO users with many devices, a timing-safe short-circuit after 10 passwords is reasonable. The `bcrypt.compare` cost itself dominates latency.

**Auth result caching:** Do not cache auth results in memory between requests. CardDAV sync is not high-frequency enough to require it, and caching would delay revocation from taking effect.

### Plan Limits

Plan limits are enforced at creation time, not at auth time. A user who downgrades from PRO to PLUS retains their existing app passwords but cannot create new ones once they exceed the PLUS limit.

| Plan | Active app password limit |
|---|---|
| FREE | 1 |
| PLUS | 3 |
| PRO | unlimited (no enforcement) |

**Limit enforcement function:**

```typescript
export async function canCreateAppPassword(userId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number | null;
}>
```

This function queries the active subscription plan for the user, counts active (non-revoked) app passwords, and returns whether a new one can be created. `limit: null` means unlimited (PRO).

The plan lookup must use the active subscription — check `Subscription.status IN ('ACTIVE', 'TRIALING')` and `Subscription.plan`. If no active subscription is found, default to FREE limits.

### Creation Server Action

Add a server action in `src/app/actions/app-passwords.ts`:

**`createAppPassword(label: string): Promise<{ token: string; appPasswordId: string } | { error: string }>`**

Steps:
1. Assert authenticated session (existing auth pattern).
2. Validate label: 1–64 characters, non-empty after trim.
3. Call `canCreateAppPassword(userId)` — if not allowed, return `{ error: "APP_PASSWORD_LIMIT_REACHED" }`.
4. Call `generateAppPasswordToken()` to produce the plaintext token.
5. Call `hashAppPassword(token)` to produce the bcrypt hash.
6. Insert `AppPassword` record with `userId`, `label`, `hashedPassword`.
7. Emit `AuditEvent` with `eventType: "APP_PASSWORD_CREATED"`, `targetType: "AppPassword"`, `targetId: appPasswordId`.
8. Return `{ token, appPasswordId }`. This is the only time the plaintext token is returned. The caller must display it immediately and never request it again.

**`listAppPasswords(): Promise<AppPasswordSummary[]>`**

Returns: `Array<{ id, label, lastUsedAt, createdAt, isRevoked: false }>` — only active (non-revoked) records. Sorted by `createdAt DESC`.

**`revokeAppPassword(appPasswordId: string): Promise<void>`**

Steps:
1. Assert authenticated session.
2. Look up `AppPassword` by `id` where `userId = session.userId` (ownership check — never allow cross-user revocation).
3. Set `revokedAt = now()`.
4. Emit `AuditEvent` with `eventType: "APP_PASSWORD_REVOKED"`, `targetType: "AppPassword"`, `targetId: appPasswordId`.

### Rate Limiting

Rate limiting is applied at the CardDAV auth layer (P9-03) but the rules are defined here:

- **Per-IP auth attempt limit:** 20 failed auth attempts per IP per 15-minute window. After threshold: return 429 Too Many Requests with `Retry-After` header.
- **Per-email auth attempt limit:** 10 failed auth attempts per email per 15-minute window. This catches credential stuffing attacks that rotate through IPs.
- **App password creation limit:** 5 creation attempts per user per hour. This prevents automated generation and immediate brute-force of the plaintext reveal window.

Rate limit state is stored in Redis (or the existing rate-limit infrastructure used in earlier phases). Keys:

- `ratelimit:dav:ip:{ip}` — counter, TTL 15 minutes
- `ratelimit:dav:email:{email}` — counter, TTL 15 minutes
- `ratelimit:dav:create:{userId}` — counter, TTL 1 hour

### Security Considerations

- **Never log the plaintext token.** Ensure all logging in the creation path strips the `token` field before writing to any structured log output.
- **Bcrypt timing:** bcrypt.compare takes a constant amount of time regardless of whether the first character matches or the entire string matches, making it resistant to timing attacks. Do not replace with a faster hash function.
- **User enumeration:** The `verifyCardDavCredentials` function must return `null` with the same latency whether the user is not found or the password is wrong. If the user is not found, call `bcrypt.compare` against a dummy hash to normalise timing.
- **HTTPS only:** App passwords must never be transmitted over plain HTTP. The middleware should check for HTTPS in production and reject plain HTTP requests to CardDAV endpoints. In development (localhost), HTTP is acceptable.
- **Revocation is immediate:** There is no grace period after revocation. The first CardDAV sync attempt after revocation will receive HTTP 401.
- **Audit trail:** All creation and revocation events are logged to `AuditEvent`. The `ipAddress` and `userAgent` fields on `AuditEvent` should be populated from the request context at creation time.

### Database Migration

Run `prisma migrate dev --name add-app-password-model` after adding the model to the schema. The migration must be reviewed to ensure it adds the correct indexes and does not lock existing tables.

---

## Acceptance Criteria

- The `AppPassword` model exists in `prisma/schema.prisma` with all fields specified above and the database migration is applied.
- `generateAppPasswordToken()` produces 24-character base58url strings with no ambiguous characters.
- `hashAppPassword()` uses bcrypt with cost factor 12.
- `verifyCardDavCredentials(email, plaintext)` returns `null` for revoked passwords, unknown emails, and wrong passwords.
- `verifyCardDavCredentials` updates `lastUsedAt` on successful verification.
- `createAppPassword` enforces plan limits and returns an error if the limit is exceeded.
- `revokeAppPassword` sets `revokedAt` and emits an `AuditEvent`.
- The plaintext token is returned exactly once (from `createAppPassword`) and never stored in the database.
- A bcrypt hash of a revoked password still exists in the database (soft delete), but auth verification rejects it immediately.
- FREE users cannot create more than 1 active app password.
- PLUS users cannot create more than 3 active app passwords.
- PRO users have no enforced limit.
- Auth attempts are rate-limited per IP and per email as specified.
- Unit tests cover: token generation entropy check, bcrypt round-trip, plan limit boundary (at limit, one below limit, one above limit), revocation rejection in verify function, cross-user revocation is blocked.

---

## Risks and Open Questions

- **bcrypt latency under load:** At cost factor 12, each CardDAV auth check takes ~200-400ms. If a single server handles many simultaneous CardDAV sync initiations (e.g. many users syncing at the same time), the event loop could become saturated. Consider using Node.js worker threads for bcrypt operations, or accept this constraint given that CardDAV sync initiations are not expected to be high-concurrency in early product phases.
- **Plan downgrade handling:** If a PRO user with 8 app passwords downgrades to FREE, they retain all 8 but cannot create new ones until they revoke enough to be below the FREE limit (1). The UI in P9-05 must surface this situation clearly. This ticket defines the enforcement logic; the UI is P9-05's concern.
- **Token format versioning:** The base58url 24-character format is v1. If the format needs to change (e.g. for longer tokens), there is no version prefix to distinguish old tokens. Consider prefixing tokens with a version byte (`kp1_`) in future iterations. Not required in v1.
- **Concurrent creation race condition:** Two simultaneous creation requests from the same user could both pass the plan limit check before either write completes. A database-level constraint (partial unique index on `userId` where `revokedAt IS NULL` for FREE/PLUS users) would be the cleanest solution but requires plan tier logic in the database, which is complex. For v1, accept the tiny race window and rely on the server action being single-tenant per session.
- **Label uniqueness:** Labels are not enforced as unique. A user can have two app passwords both labeled "iPhone". This is intentional — if they upgrade phones, they may want the new one to have the same label before revoking the old. The UI should not prevent duplicate labels.
