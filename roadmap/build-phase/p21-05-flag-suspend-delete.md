# P21-05 — Flag, Suspend & Admin-Triggered Delete

## Purpose

Admins need to be able to suspend abusive accounts (blocking login immediately), unsuspend them, and trigger account deletion on behalf of users or for TOS violations. These are destructive actions — each requires a confirmation step and an audit log entry.

## Background

`User.lifecycleState` has `LOCKED` for suspended accounts. `User.lockReason` (added in P18-09) distinguishes `ADMIN_SUSPENSION` from `SCHEDULED_DELETION`. The `User.sessionVersion` increment from P18-02 invalidates all sessions immediately.

## Scope

**In scope:**
- `suspendAccount(userId, reason)` — sets `LOCKED`, increments `sessionVersion`, emits audit event
- `unsuspendAccount(userId)` — restores `ACTIVE`, emits audit event
- `adminDeleteAccount(userId, reason)` — schedules deletion (same as P18-09) with an admin reason
- Confirmation dialogs in the admin user detail panel for each action
- Email notification to the suspended/deleted user (uses P20-07 / P20-08 templates)

---

## Design / Implementation Spec

### `suspendAccount`

```typescript
export async function suspendAccount(input: {
  targetUserId: string;
  reason: string;
}): Promise<void> {
  const { userId: adminUserId } = await assertAdmin();

  await db.user.update({
    where: { id: input.targetUserId },
    data: {
      lifecycleState: "LOCKED",
      lockReason: "ADMIN_SUSPENSION",
      sessionVersion: { increment: 1 },
    },
  });

  await emitAdminEvent({
    adminUserId,
    action: ADMIN_ACTIONS.USER_SUSPENDED,
    targetUserId: input.targetUserId,
    details: { reason: input.reason },
  });

  // Notify the user via email (Phase 20)
  await sendAccountSuspendedEmail({ userId: input.targetUserId, reason: input.reason });
}
```

### `unsuspendAccount`

```typescript
export async function unsuspendAccount(input: {
  targetUserId: string;
}): Promise<void> {
  const { userId: adminUserId } = await assertAdmin();

  await db.user.update({
    where: { id: input.targetUserId },
    data: {
      lifecycleState: "ACTIVE",
      lockReason: null,
    },
  });

  await emitAdminEvent({
    adminUserId,
    action: ADMIN_ACTIONS.USER_UNSUSPENDED,
    targetUserId: input.targetUserId,
  });
}
```

### `adminDeleteAccount`

Reuses the P18-09 `scheduleAccountDeletion` logic but bypasses the email confirmation requirement and allows targeting another user:

```typescript
export async function adminDeleteAccount(input: {
  targetUserId: string;
  reason: string;
}): Promise<void> {
  const { userId: adminUserId } = await assertAdmin();

  await db.user.update({
    where: { id: input.targetUserId },
    data: {
      lifecycleState: "LOCKED",
      lockReason: "SCHEDULED_DELETION",
      scheduledDeleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sessionVersion: { increment: 1 },
    },
  });

  await emitAdminEvent({
    adminUserId,
    action: ADMIN_ACTIONS.USER_DELETED,
    targetUserId: input.targetUserId,
    details: { reason: input.reason },
  });
}
```

### Admin UI confirmation dialogs

Each action in the user detail panel shows a confirmation modal:

**Suspend:**
```
Suspend this account?
Reason: [text input — required]
This will immediately sign out the user and block all login attempts.
[Cancel]  [Suspend account]
```

**Unsuspend:** Simple confirmation with no reason required.

**Delete:**
```
Schedule account deletion?
Reason: [text input — required]
The user will be signed out. Their account and all data will be permanently
deleted in 30 days. This cannot be undone after the deletion runs.
[Cancel]  [Schedule deletion]
```

---

## Acceptance Criteria

- `suspendAccount` sets `lifecycleState = LOCKED`, `lockReason = ADMIN_SUSPENSION`, and increments `sessionVersion`.
- A suspended user is immediately signed out on their next request.
- `unsuspendAccount` restores `ACTIVE` and clears `lockReason`.
- `adminDeleteAccount` schedules deletion with `SCHEDULED_DELETION` lockReason.
- All three actions emit `AdminAuditEvent` with the reason.
- Confirmation dialogs require an explicit reason for suspend and delete actions.
