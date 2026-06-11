# P18-02 — Password Change

## Purpose

Users have no way to change their password after account creation. This ticket adds a secure password-change flow that verifies the current password before accepting a new one, then invalidates all other active sessions so a user who suspects their account is compromised can lock out any attacker with a single password change. It also introduces `User.sessionVersion` — the mechanism that subsequent session-related tickets (P18-06 active sessions, P18-07 TOTP, P22 suspicious-activity lockout) all depend on.

## Background

The current auth flow (`src/server/auth/config.ts`) uses NextAuth with a JWT strategy and Credentials provider. Passwords are stored as `bcryptjs` hashes in `User.password`. There is no session tracking table — the JWT is stateless, meaning there is currently no way to invalidate existing tokens short of changing the signing secret.

The `sessionVersion` pattern solves this: add a monotonic integer to `User`; embed it in every JWT; the JWT callback reads it from the DB on each request and rejects tokens where the embedded version is lower than the stored version. Incrementing `sessionVersion` on password change invalidates every previously issued JWT. This is the same technique used by Firebase Auth and Auth0 when rotating credentials.

## Scope

**In scope:**
- `User.sessionVersion Int @default(1)` field addition
- Embed `sessionVersion` in the NextAuth JWT payload
- JWT callback validation: reject tokens whose `sessionVersion` is older than the current DB value
- `changePassword` server action: verify current password → hash new → save → increment `sessionVersion`
- Settings page UI: current password + new password + confirm password form
- Rate limiting: max 5 failed attempts per hour per user
- `ActivityEvent` emission on successful password change

**Out of scope:**
- Password reset (forgotten password without knowing the current one) — that is P18-05
- Session listing/revocation UI — that is P18-06 (builds on this ticket's `sessionVersion`)
- Password strength meter beyond a minimum length check

---

## Design / Implementation Spec

### Schema change

Add to the `User` model in `prisma/schema.prisma`:

```prisma
sessionVersion Int @default(1)
```

Run: `prisma migrate dev --name add-user-session-version`

`sessionVersion` starts at 1 for all users (new and existing via migration default). It increments by 1 on every password change and on every "revoke all sessions" action (P18-06). The JWT embeds the version at the time of issue; any JWT with a version less than the current DB value is rejected.

### NextAuth JWT session version enforcement

Update `src/server/auth/config.ts`:

**JWT callback — embed `sessionVersion` at login and validate on every subsequent request:**

```typescript
jwt: async ({ token, user, trigger, session }) => {
  if (user) {
    // Initial sign-in: fetch sessionVersion from DB
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { sessionVersion: true, name: true, avatarUrl: true },
    });
    token.sub = user.id;
    token.name = dbUser?.name ?? null;
    token.avatarUrl = (dbUser as { avatarUrl?: string | null })?.avatarUrl ?? null;
    token.sv = dbUser?.sessionVersion ?? 1; // "sv" = session version
  } else if (token.sub) {
    // Subsequent requests: validate sessionVersion against DB
    const dbUser = await db.user.findUnique({
      where: { id: token.sub },
      select: { sessionVersion: true },
    });
    if (!dbUser || dbUser.sessionVersion !== token.sv) {
      // Version mismatch: token was issued before a password change or revoke-all.
      // Return an empty token to force re-authentication.
      return {};
    }
  }
  if (trigger === "update" && session) {
    const fresh = await db.user.findUnique({
      where: { id: token.sub! },
      select: { name: true, avatarUrl: true, sessionVersion: true },
    });
    token.name = fresh?.name ?? token.name;
    token.avatarUrl = fresh?.avatarUrl ?? null;
    token.sv = fresh?.sessionVersion ?? token.sv;
  }
  return token;
},
```

**Performance note:** Reading `sessionVersion` on every JWT validation adds one DB query per authenticated request. To mitigate: use a short-lived Redis cache keyed by `userId` (TTL 60 seconds). On password change or session revoke, invalidate the cache entry. If Redis is not available, accept the DB read — the query is a single indexed column lookup on the primary key and is fast.

Returning `{}` from the `jwt` callback causes NextAuth to treat the session as expired, redirecting the user to `/login` on the next page visit. This is the correct behaviour for an invalidated session.

### Server action — `changePassword`

Create in `src/app/actions/account.ts`:

```typescript
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: true } | { error: string }>
```

Steps:
1. Assert authenticated session.
2. Check rate limit: max 5 failed attempts per `userId` per 60-minute window (store in Redis or an in-memory map for MVP). If exceeded, return `{ error: "RATE_LIMIT_EXCEEDED" }`.
3. Fetch `User` by `session.user.id`, selecting `password` and `sessionVersion`.
4. `bcrypt.compare(input.currentPassword, user.password)`. If false: increment the failure counter in the rate-limit store; return `{ error: "CURRENT_PASSWORD_INCORRECT" }`.
5. Validate `input.newPassword`:
   - Min 8 characters
   - Must differ from `input.currentPassword` (compare the raw strings before hashing — do not re-hash the current password just to compare hashes)
   - Return `{ error: "PASSWORD_TOO_SHORT" }` or `{ error: "PASSWORD_SAME_AS_CURRENT" }` as appropriate
6. `const newHash = await bcrypt.hash(input.newPassword, 12)`
7. Atomic DB update:
   ```typescript
   await db.user.update({
     where: { id: session.user.id },
     data: {
       password: newHash,
       sessionVersion: { increment: 1 },
     },
   });
   ```
8. Clear the rate-limit failure counter for this user.
9. Emit `ActivityEvent`:
   - `eventType: "ACCOUNT_UPDATED"` (new enum value to add — see below)
   - `actor: Actor.USER`
   - `payload: { field: "password" }` (do not include any password material)
   - `contactId: null`
10. Return `{ success: true }`.

### New EventType enum value

Add to the `EventType` enum in `prisma/schema.prisma`:

```prisma
ACCOUNT_UPDATED
```

This event covers profile edits (P18-01), password change (P18-02), email change (P18-03), and 2FA state changes (P18-07). The `payload` field distinguishes what changed.

Run a migration: `prisma migrate dev --name add-account-updated-event-type`

### Settings page UI

The password section lives within `/settings/security` (or as a subsection of `/settings`).

**Form fields:**
- Current password (type=password, autocomplete=current-password)
- New password (type=password, autocomplete=new-password)
- Confirm new password (type=password, autocomplete=new-password)

**Validation (client-side, before submit):**
- All three fields required
- New password ≥ 8 characters
- Confirm matches new password

**Server-error handling:**
- `CURRENT_PASSWORD_INCORRECT` → "Your current password is incorrect"
- `PASSWORD_TOO_SHORT` → "New password must be at least 8 characters"
- `PASSWORD_SAME_AS_CURRENT` → "New password must be different from your current password"
- `RATE_LIMIT_EXCEEDED` → "Too many attempts. Please wait an hour before trying again."

**On success:**
- Clear all three fields
- Show inline "Password updated. You've been signed out of all other devices." confirmation
- Call `update()` from `next-auth/react` to embed the new `sessionVersion` in the current session token (so the current session is not invalidated — only other sessions are)

---

## Acceptance Criteria

- `User.sessionVersion` exists in the schema with a default of 1; migration is applied cleanly.
- The NextAuth JWT callback embeds `sessionVersion` at sign-in and validates it on every subsequent request.
- A JWT with a stale `sessionVersion` is rejected and the user is redirected to `/login`.
- `changePassword` verifies the current password before accepting a new one.
- Supplying the wrong current password returns `CURRENT_PASSWORD_INCORRECT`.
- Supplying a new password shorter than 8 characters returns `PASSWORD_TOO_SHORT`.
- Supplying the same password as the current one returns `PASSWORD_SAME_AS_CURRENT`.
- A successful password change increments `sessionVersion` in the database.
- After a successful change, all sessions except the current one are invalidated (they receive a stale-version rejection on their next request).
- The current session is NOT invalidated — the user stays logged in on the device where they made the change.
- An `ACCOUNT_UPDATED` `ActivityEvent` is emitted with `payload.field === "password"`.
- 5 failed attempts within an hour trigger a rate-limit error; a 6th attempt within the window is rejected without checking the password.
- Unit tests: correct-password changes version; wrong-password rejects; rate-limit blocks 6th attempt; JWT version mismatch returns empty token.

---

## Risks and Open Questions

- **DB read on every JWT validation:** The `sessionVersion` check requires a DB query on every authenticated request. If this proves too slow, add a Redis cache with a 60-second TTL keyed by `userId`. On password change, immediately delete the cache key. Document the cache-invalidation path alongside the server action.
- **"Stays signed in on current device" behaviour:** Incrementing `sessionVersion` and then calling `update()` from `next-auth/react` in the same client response has a timing window: if the `update()` call happens before the DB commit, the re-issued token will still have the old version. Ensure the server action `await`s the DB update fully before returning `{ success: true }` to the client. The client should only call `update()` after receiving the success response.
- **bcrypt cost factor:** Using cost factor 12 for the new password hash (consistent with app-passwords). At cost 12, each hash takes ~200-400ms. This is fine for a user-initiated password change. Do not use a background worker — the response latency is acceptable and the user expects a brief delay.
- **Minimum password complexity:** v1 only enforces length (8 chars). Consider adding a zxcvbn score check in v2 to reject "password123" patterns. Note this as a future hardening item.
