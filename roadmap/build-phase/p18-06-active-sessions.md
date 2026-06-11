# P18-06 — Active Sessions Panel

## Purpose

Users currently have no visibility into which devices are logged into their account and no way to sign out a specific device remotely. This is a standard security feature expected by any user who suspects their account may be compromised, or who simply wants to sign out of a forgotten shared device. This ticket adds a `UserSession` tracking model, wires session creation and revocation into NextAuth's JWT callbacks, and surfaces the sessions list in the security settings page.

## Background

The app uses NextAuth with a JWT strategy (`session.strategy: "jwt"`). JWTs are stateless — there is no server-side session record to query or revoke. P18-02 introduced `User.sessionVersion` for blanket session invalidation (all sessions at once). This ticket adds individual session tracking: each JWT gets a unique `jti` (JWT ID) that maps to a `UserSession` row. Revocation sets `revokedAt` on the row; the JWT callback checks this on every request.

The `UserSession` table is also the data source for Phase 22 suspicious-activity detection (new-device logins from unexpected IPs).

**JWT `maxAge` configuration** is owned by this ticket — it is the natural home since session lifetime and revocation are the same concern. The NextAuth `session.maxAge` and `session.updateAge` settings are specified in the Implementation Spec below and must be applied in `src/server/auth/config.ts` as part of this ticket.

## Scope

**In scope:**
- `UserSession` Prisma model
- Embed a `jti` in every JWT at sign-in
- JWT callback: validate `jti` against `UserSession` (not revoked + version matches)
- Update `UserSession.lastActiveAt` on each authenticated request (batched/debounced — not on every single request)
- `listActiveSessions()` server action
- `revokeSession(sessionId)` server action (revoke any session except the current one)
- `revokeAllOtherSessions()` server action (revoke all sessions except the current one)
- Settings UI: session list with device hint, IP, last active, revoke button
- Sign-out of all devices option

**Out of scope:**
- Push notification to the revoked device (the session is silently invalidated; the user sees a redirect to login on next request)
- Geolocation of IP addresses (store the IP; geocoding is a future enhancement)
- Browser extension sessions (same mechanism applies naturally)

---

## Design / Implementation Spec

### Schema change

Add to `prisma/schema.prisma`:

```prisma
model UserSession {
    id           String    @id @default(cuid())
    userId       String
    jti          String    @unique
    ipAddress    String?
    userAgent    String?
    deviceHint   String?
    lastActiveAt DateTime  @default(now())
    revokedAt    DateTime?
    createdAt    DateTime  @default(now())
    user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@index([userId, revokedAt, lastActiveAt])
    @@index([jti])
}
```

Add to `User` model:
```prisma
sessions UserSession[]
```

Run: `prisma migrate dev --name add-user-session`

**Field notes:**
- `jti`: a `cuid()` generated at sign-in, embedded in the JWT, and looked up on every request. It is the per-session revocation key.
- `deviceHint`: a human-readable label derived from the `User-Agent` string at sign-in. Examples: "Chrome on macOS", "Safari on iPhone", "Firefox on Windows". Parse using a lightweight UA parser library (e.g. `ua-parser-js`) or a simple regex. This is a display hint — it is not guaranteed to be unique or accurate.
- `ipAddress`: the IP at sign-in, stored for audit and suspicious-activity detection (Phase 22).
- `lastActiveAt`: updated periodically (not on every request) to show "last active N minutes ago" in the UI. Update strategy: in the JWT callback, if `lastActiveAt` is more than 5 minutes ago, fire a background update (`db.userSession.update(...)` without await). Acceptable eventual consistency.
- `revokedAt`: set on revocation; never hard-deleted. Revoked sessions accumulate; add a cleanup job in Phase 21 or a cron to purge rows older than 90 days.

### JWT `maxAge` configuration

Add to the `session` block in `src/server/auth/config.ts`:

```typescript
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60,    // 30 days — hard expiry regardless of activity
  updateAge: 7 * 24 * 60 * 60,  // 7 days — re-issue token if user is active within window
},
```

Without `maxAge`, JWTs are valid indefinitely. A stolen token that is never explicitly revoked (no `sessionVersion` change, no `jti` revocation) would remain valid forever. With `maxAge: 30d`, the worst-case exposure window for a stolen token is 30 days.

`updateAge: 7d` means NextAuth automatically re-issues the JWT (resetting the 30-day clock) whenever the session is accessed more than 7 days since the last issue. Active users never see an unexpected logout; inactive users are signed out after 30 days of inactivity.

### NextAuth changes

#### JWT callback — create `UserSession` at sign-in, validate on subsequent requests

```typescript
jwt: async ({ token, user, trigger, session, account, profile, req }) => {
  if (user) {
    // Initial sign-in: create a new UserSession
    const jti = cuid();
    const ip = req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim()
      ?? req?.socket?.remoteAddress
      ?? null;
    const ua = req?.headers?.["user-agent"] ?? null;
    const deviceHint = parseDeviceHint(ua); // simple UA parse
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { sessionVersion: true, name: true, avatarUrl: true },
    });

    await db.userSession.create({
      data: {
        userId: user.id,
        jti,
        ipAddress: ip,
        userAgent: ua,
        deviceHint,
      },
    });

    token.sub = user.id;
    token.jti = jti;
    token.sv = dbUser?.sessionVersion ?? 1;
    token.name = dbUser?.name ?? null;
    token.avatarUrl = (dbUser as { avatarUrl?: string | null })?.avatarUrl ?? null;
  } else if (token.sub && token.jti) {
    // Subsequent requests: validate session
    const [dbUser, session] = await Promise.all([
      db.user.findUnique({
        where: { id: token.sub },
        select: { sessionVersion: true },
      }),
      db.userSession.findUnique({
        where: { jti: token.jti as string },
        select: { revokedAt: true, lastActiveAt: true },
      }),
    ]);

    // Reject stale sessionVersion (P18-02) or revoked session (P18-06)
    if (!dbUser || dbUser.sessionVersion !== token.sv || !session || session.revokedAt) {
      return {};
    }

    // Update lastActiveAt if stale by > 5 minutes (fire and forget)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (session.lastActiveAt < fiveMinutesAgo) {
      void db.userSession.update({
        where: { jti: token.jti as string },
        data: { lastActiveAt: new Date() },
      });
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

**Performance note:** The `Promise.all` in the subsequent-request path runs two DB queries per request. Both are primary-key or unique-index lookups. Add a short-lived (60-second) Redis cache keyed by `jti` to store the `{ revokedAt, sessionVersion }` pair — this reduces DB load to ~1 cache miss per session per minute.

### `listActiveSessions` server action

```typescript
export async function listActiveSessions(): Promise<SessionSummary[]>

interface SessionSummary {
  id: string;
  deviceHint: string | null;
  ipAddress: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  isCurrent: boolean; // jti matches token.jti from the current session
}
```

Query: `UserSession WHERE userId = session.user.id AND revokedAt IS NULL ORDER BY lastActiveAt DESC`

### `revokeSession` server action

```typescript
export async function revokeSession(
  sessionId: string,
): Promise<{ success: true } | { error: string }>
```

Steps:
1. Assert authenticated session.
2. Look up `UserSession` by `id` where `userId = session.user.id` (ownership check).
3. If not found: return `{ error: "SESSION_NOT_FOUND" }`.
4. If `session.jti === currentToken.jti`: return `{ error: "CANNOT_REVOKE_CURRENT_SESSION" }` (the UI disables the revoke button for the current session, but guard server-side too).
5. Set `revokedAt = now()`.
6. Emit `ACCOUNT_UPDATED` ActivityEvent with `payload: { field: "sessionRevoked", sessionId }`.
7. Return `{ success: true }`.

### `revokeAllOtherSessions` server action

```typescript
export async function revokeAllOtherSessions(): Promise<{ revokedCount: number }>
```

Steps:
1. Assert authenticated session.
2. `UPDATE UserSession SET revokedAt = now() WHERE userId = session.user.id AND jti != currentToken.jti AND revokedAt IS NULL`.
3. Emit `ACCOUNT_UPDATED` ActivityEvent with `payload: { field: "allOtherSessionsRevoked" }`.
4. Return `{ revokedCount: updatedCount }`.

Note: This does NOT increment `sessionVersion`. It only revokes individual session rows. The current session remains valid. `sessionVersion` is only incremented on password change (P18-02) or a "sign out everywhere including current device" action — which is `revokeAllOtherSessions` + `signOut()`.

### Settings UI — Active sessions panel

Location: `/settings/security`, below the password change form.

**Session list:**

```
Active sessions

[device icon] Chrome on macOS                    Current session
              91.108.4.5 · Active just now

[device icon] Safari on iPhone                  [Sign out]
              185.92.123.4 · Active 2 days ago

[device icon] Firefox on Windows                [Sign out]
              203.0.113.42 · Active 1 week ago

──────────────────────────────────────────────
[Sign out of all other devices]
```

- "Current session" is displayed (no revoke button) for the session matching the current JWT's `jti`.
- "Sign out" button calls `revokeSession(session.id)` — on success the row fades out.
- "Sign out of all other devices" calls `revokeAllOtherSessions()` — on success all non-current rows fade out and a "N devices signed out" toast appears.
- Device icon: `Monitor` for desktop/unknown, `Smartphone` for mobile, `Tablet` for tablet. Use Lucide icons.

**Empty state (only one session — the current one):**
```
You're only signed in on this device.
```

---

## Acceptance Criteria

- `UserSession` model exists in the schema; migration applied.
- Every sign-in creates a `UserSession` row with `jti`, `ipAddress`, `userAgent`, `deviceHint`.
- The NextAuth JWT callback validates `jti` against `UserSession.revokedAt` and `User.sessionVersion` on every request.
- A JWT for a revoked session is rejected; the user is redirected to `/login`.
- `listActiveSessions` returns only non-revoked sessions for the authenticated user, with `isCurrent` correctly set.
- `revokeSession` with the current session's ID returns `CANNOT_REVOKE_CURRENT_SESSION`.
- `revokeSession` for another user's session is blocked (ownership check).
- `revokeAllOtherSessions` sets `revokedAt` on all non-current sessions; the current session remains valid.
- The settings UI lists active sessions with device hint, IP, and last-active time.
- The current session is clearly identified and does not have a revoke button.
- `ACCOUNT_UPDATED` ActivityEvents are emitted for individual and bulk revocations.
- `lastActiveAt` is updated when a session has been idle for more than 5 minutes (eventual consistency acceptable).
- NextAuth `session.maxAge` is set to 30 days and `session.updateAge` to 7 days.
- A JWT that has exceeded `maxAge` is rejected automatically; the user is redirected to `/login`.

---

## Risks and Open Questions

- **Two DB queries per request:** The `Promise.all([dbUser, userSession])` adds latency to every authenticated request. Benchmarking is required before and after to confirm acceptable p99 latency. Redis caching of the `jti → { revokedAt, sessionVersion }` pair with a 60-second TTL is the mitigation if needed.
- **`req` availability in JWT callback:** NextAuth v5's JWT callback receives `req` differently than v4. Verify how to access request headers (for IP extraction) in the current NextAuth version in use. If `req` is not available in the `jwt` callback, extract IP during the `signIn` callback instead and pass it via a temporary DB write or a short-lived cache.
- **Session accumulation:** Every sign-in creates a new `UserSession` row. Users who sign in frequently (or bots that re-auth on each request) will accumulate rows. The cleanup strategy: a background cron job (Phase 21) deletes `revokedAt IS NOT NULL AND revokedAt < now() - 90 days` rows. Document this.
- **Revoked session cache invalidation (Redis):** If caching `jti → revokedAt` with a 60-second TTL, a revoked session could still pass validation for up to 60 seconds. This is acceptable for the session revocation case but must be documented. The maximum window is configurable by adjusting the TTL.
