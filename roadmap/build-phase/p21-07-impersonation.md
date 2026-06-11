# P21-07 — Read-Only Impersonation

## Purpose

Admins occasionally need to reproduce a user's exact experience to diagnose a support ticket — seeing what they see, with their data. Impersonation lets an admin view the app as a specific user without modifying any of their data. Read-only is enforced at the server action layer, not the UI layer, so the admin sees the real interface but all write operations are blocked.

## Background

Impersonation is implemented by issuing a short-lived JWT that includes `impersonating: true` and `impersonatingUserId`. The admin's own session is preserved — they can end the impersonation and return to their admin account at any time.

## Scope

**In scope:**
- `startImpersonation(targetUserId)` admin action — issues a special session token
- `endImpersonation()` — returns to the admin's own session
- Write operations check `isImpersonating` in the session and return 403
- Visible "Impersonating [user email]" banner while in impersonation mode
- `USER_IMPERSONATED` admin audit event on start and end

**Out of scope:**
- Write operations on behalf of the user (impersonation is read-only by design)
- Impersonating an admin user (blocked)

---

## Design / Implementation Spec

### Session extension

Extend the NextAuth `Session` type:

```typescript
interface Session {
  // ... existing fields ...
  impersonating?: boolean;
  impersonatingUserId?: string;
  realAdminUserId?: string; // the admin's own user ID
}
```

### `startImpersonation`

```typescript
export async function startImpersonation(targetUserId: string): Promise<void> {
  const { userId: adminUserId } = await assertAdmin();

  // Block impersonating another admin
  const target = await db.user.findUniqueOrThrow({
    where: { id: targetUserId },
    select: { role: true, email: true },
  });
  if (target.role === "ADMIN") throw new Error("Cannot impersonate an admin");

  // Trigger a session update to embed impersonation context
  // The caller (client component) calls update() from next-auth/react after this
  await emitAdminEvent({
    adminUserId,
    action: ADMIN_ACTIONS.USER_IMPERSONATED,
    targetUserId,
    details: { action: "start" },
  });

  // Return the target userId so the client can call update()
  // The jwt callback will embed impersonatingUserId when triggered
}
```

The impersonation state is stored in the JWT via a `update()` call from the client after `startImpersonation` succeeds. The JWT callback detects the update trigger and embeds `impersonating: true`, `impersonatingUserId`, and `realAdminUserId`.

### Write operation guard

In `src/server/admin.ts`:

```typescript
export async function assertNotImpersonating(): Promise<void> {
  const session = await auth();
  if ((session as { impersonating?: boolean }).impersonating) {
    throw new Error("WRITE_BLOCKED_DURING_IMPERSONATION");
  }
}
```

Every server action that writes data calls `assertNotImpersonating()`. Returns a user-friendly error message: "You're viewing this account in read-only mode."

### Impersonation banner

When `session.impersonating === true`, render a persistent banner at the top of the app:

```
┌────────────────────────────────────────────────────────────────────────┐
│  👁  Viewing as user@example.com (read-only)     [End impersonation]  │
└────────────────────────────────────────────────────────────────────────┘
```

Background: blue-900 text on blue-50 background. "End impersonation" calls `endImpersonation()` and clears the impersonation state from the session.

---

## Acceptance Criteria

- An admin can start impersonating a non-admin user via the admin user detail panel.
- While impersonating, the app renders the target user's data.
- All write server actions return a `WRITE_BLOCKED_DURING_IMPERSONATION` error while impersonating.
- The impersonation banner is visible on all app pages during impersonation.
- "End impersonation" returns the admin to their own session.
- Attempting to impersonate an admin user is blocked with an error.
- `USER_IMPERSONATED` audit events are emitted on start and end.
