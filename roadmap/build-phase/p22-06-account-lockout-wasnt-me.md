# P22-06 — Account Lockout ("Wasn't Me" Flow)

## Purpose

When a user confirms that suspicious activity was not them, Kontax must immediately revoke all sessions and force a password reset — making the account unusable to the attacker even if they have an active session token. This is a security-critical flow where speed and completeness matter more than UX smoothness.

## Background

`User.sessionVersion` (P18-02) provides global session invalidation. `PasswordResetToken` (P18-05) provides the email-based reset mechanism. This ticket wires them together into an atomic "lockdown" action.

## Scope

**In scope:**
- `lockdownAccount()` server action — increments sessionVersion, forces password reset via email, marks suspicious notifications as actioned
- `/settings/security?action=lockdown` page — confirmation screen before the lockdown
- Post-lockdown redirect: user is signed out and lands on `/login?message=secured`

---

## Design / Implementation Spec

### Lockdown confirmation page

`/settings/security?action=lockdown`:

```
Secure your account

This will:
• Immediately sign you out of all devices (including this one)
• Send a password reset link to [user@example.com]
• You'll need to reset your password to sign back in

[Cancel — it was me]   [Yes — secure my account]
```

"Yes — secure my account" calls `lockdownAccount()`.

### `lockdownAccount` server action

```typescript
export async function lockdownAccount(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");
  const userId = session.user.id;

  // 1. Invalidate all sessions
  await db.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });

  // 2. Revoke all UserSession rows
  await db.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  // 3. Send a password reset email (same flow as P18-05)
  await requestPasswordReset(session.user.email);

  // 4. Mark all unread SECURITY notifications as actioned
  await db.userNotification.updateMany({
    where: { userId, category: "SECURITY", readAt: null },
    data: { readAt: new Date() },
  });

  // 5. Sign out the current session
  await signOut({ redirect: false });
}
```

After this runs, the client redirects to `/login?message=secured`. The login page shows:
```
Your account has been secured. We've sent a password reset link to your email address.
Check your inbox to set a new password.
```

---

## Acceptance Criteria

- `lockdownAccount` increments `sessionVersion` — all existing sessions are invalidated on their next request.
- All `UserSession` rows for the user are set to `revokedAt = now()`.
- A password reset email is sent immediately.
- All unread SECURITY notifications are marked read.
- The user is signed out and redirected to `/login?message=secured`.
- The login page shows the "account secured" message when `message=secured` is present.
- The lockdown action is idempotent — running it twice does not cause errors.
