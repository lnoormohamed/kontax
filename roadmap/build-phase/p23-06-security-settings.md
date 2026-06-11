# P23-06 — Security Settings for Connection Changes

## Purpose

Require re-authentication before a user can modify sync connection settings (direction, conflict policy, book allowlist, or credentials). Sync connections have access to external accounts with full contact-write permissions — a compromised Kontax session should not be able to silently change where contacts are being pushed. Log every settings change to `ActivityEvent` for auditability.

## Background

The session model (P18-02) tracks `sessionVersion` for bulk invalidation. P18-06 implemented the active sessions panel. This ticket extends that infrastructure with a targeted re-auth challenge: the user must confirm their password (not a full re-login) before any sync settings mutation is committed. This is the same pattern used by GitHub's "sudo mode" — short-lived elevation within an existing session.

The audit log requirement follows Phase 10's `ActivityEvent` model (P10-01). Sync settings changes are security-relevant mutations and must be attributable.

## Scope

**In scope:**
- `SyncSettingsElevation` model — short-lived (15-minute) password confirmation token per user session
- `confirmSyncSettingsPassword(password)` server action — verifies current password, issues elevation token
- `requireSyncSettingsElevation()` guard — called at the top of `updateSyncAccountSettings` and `updateBookAllowlist`
- Re-auth modal — shown when user clicks "Save settings" without a valid elevation token
- `ActivityEvent` emission on every settings change: direction, conflict policy, allowlist, credentials

**Out of scope:**
- 2FA challenge (password-only confirmation is sufficient for this surface)
- Connection creation (the initial connect flow requires credentials by definition; no additional re-auth needed)

---

## Design / Implementation Spec

### `SyncSettingsElevation` model

```prisma
model SyncSettingsElevation {
    id        String   @id @default(cuid())
    userId    String
    jti       String   // the session JTI this elevation is tied to
    expiresAt DateTime
    createdAt DateTime @default(now())

    @@index([userId, jti])
}
```

Run: `prisma migrate dev --name add-sync-settings-elevation`

An elevation is valid for 15 minutes and is tied to the current session's JWT ID (`jti`). If the session changes (re-login, token refresh), the elevation is invalidated.

### `confirmSyncSettingsPassword`

```typescript
export async function confirmSyncSettingsPassword(
  password: string,
): Promise<{ elevated: boolean }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { elevated: false };

  const jti = (session as { jti?: string }).jti ?? session.user.id;

  await db.syncSettingsElevation.upsert({
    where: { id: `${session.user.id}-${jti}` },
    create: {
      userId: session.user.id,
      jti,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
    update: {
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  return { elevated: true };
}
```

### `requireSyncSettingsElevation`

```typescript
export async function requireSyncSettingsElevation(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  const jti = (session as { jti?: string }).jti ?? session.user.id;

  const elevation = await db.syncSettingsElevation.findFirst({
    where: {
      userId: session.user.id,
      jti,
      expiresAt: { gt: new Date() },
    },
  });

  if (!elevation) throw new Error("SYNC_SETTINGS_ELEVATION_REQUIRED");
}
```

`updateSyncAccountSettings` (P23-02) and `updateBookAllowlist` (P23-03) call `requireSyncSettingsElevation()` at the top. If it throws, the client catches `SYNC_SETTINGS_ELEVATION_REQUIRED` and shows the re-auth modal.

### Re-auth modal

When `SYNC_SETTINGS_ELEVATION_REQUIRED` is thrown by the save action:

```
┌──────────────────────────────────────────────────┐
│  Confirm your password                           │
│                                                  │
│  To change sync settings, please enter your      │
│  Kontax password.                                │
│                                                  │
│  Password  [••••••••••••••       ]               │
│                                                  │
│  [Cancel]    [Confirm]                           │
└──────────────────────────────────────────────────┘
```

On confirm, calls `confirmSyncSettingsPassword`. If elevated, re-submits the original save action automatically. Elevation is cached in component state for 15 minutes — subsequent saves within the window skip the modal.

### Activity event emission

After every successful settings mutation, emit an `ActivityEvent`:

```typescript
await emitEvent({
  userId: session.user.id,
  eventType: "SYNC_SETTINGS_CHANGED",
  actor: "USER",
  payload: {
    syncAccountId: input.syncAccountId,
    changes: changedFields, // { direction: { from: "TWO_WAY", to: "IMPORT_ONLY" } }
  },
});
```

The `SYNC_SETTINGS_CHANGED` event type needs to be added to the `EventType` enum if not already present.

---

## Acceptance Criteria

- Clicking "Save settings" without a valid elevation token shows the re-auth modal.
- Correct password grants a 15-minute elevation; incorrect password shows an error and keeps the modal open.
- After elevation, the save action proceeds without the user re-entering their password.
- Elevation is tied to the session JTI — a new login clears the elevation.
- Every sync settings change (direction, conflict policy, allowlist, credentials) creates an `ActivityEvent` with a `SYNC_SETTINGS_CHANGED` event type.
- The elevation expires after 15 minutes — the modal reappears for the next save attempt.

---

## Risks and Open Questions

- **Users without a password (OAuth-only accounts):** P18-08 OAuth users may not have a password hash. For these users, skip the password check and require 2FA confirmation instead (if enrolled, P18-07). If neither is available, skip elevation and log a warning — do not block the action for users who cannot complete the challenge.
- **JTI availability in session:** the session JWT may not expose `jti` to server components depending on the NextAuth configuration. Confirm that `jti` is included in the JWT callback and accessible via `auth()` before shipping. If not, fall back to a composite key of `userId + sessionVersion`.
