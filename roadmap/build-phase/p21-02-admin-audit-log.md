# P21-02 — Admin Audit Log

## Purpose

Every action an admin takes — looking up a user, overriding a plan, suspending an account — must be recorded in an immutable audit log. Without this, there is no accountability for admin actions, no way to investigate incidents, and no evidence trail if a billing dispute or legal issue arises.

## Background

The existing `ActivityEvent` model captures end-user actions. Admin actions are a distinct category — they are internal operations performed by Kontax staff rather than by users. A separate table avoids polluting the user-facing activity log with admin events.

## Scope

**In scope:**
- `AdminAuditEvent` Prisma model
- `emitAdminEvent(adminUserId, action, targetUserId?, details?)` utility
- Called by every admin server action
- Admin audit log page at `/admin/audit` (read-only table, filterable by action type and date)

---

## Design / Implementation Spec

### Schema change

```prisma
model AdminAuditEvent {
    id           String   @id @default(cuid())
    adminUserId  String
    action       String   // e.g. "USER_PLAN_OVERRIDE", "USER_SUSPENDED", "USER_VIEWED"
    targetUserId String?
    details      Json?    // arbitrary context (old plan, new plan, reason, etc.)
    ipAddress    String?
    createdAt    DateTime @default(now())

    @@index([adminUserId, createdAt(sort: Desc)])
    @@index([targetUserId, createdAt(sort: Desc)])
    @@index([action, createdAt(sort: Desc)])
}
```

Run: `prisma migrate dev --name add-admin-audit-event`

### `emitAdminEvent`

`src/server/admin.ts`:

```typescript
export async function emitAdminEvent(params: {
  adminUserId: string;
  action: string;
  targetUserId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  await db.adminAuditEvent.create({
    data: {
      adminUserId: params.adminUserId,
      action: params.action,
      targetUserId: params.targetUserId,
      details: params.details ?? {},
      ipAddress: params.ipAddress,
    },
  });
}
```

### Standard action names

Define as constants to prevent typos:

```typescript
export const ADMIN_ACTIONS = {
  USER_VIEWED:          "USER_VIEWED",
  USER_PLAN_OVERRIDE:   "USER_PLAN_OVERRIDE",
  USER_SUSPENDED:       "USER_SUSPENDED",
  USER_UNSUSPENDED:     "USER_UNSUSPENDED",
  USER_DELETED:         "USER_DELETED",
  USER_IMPERSONATED:    "USER_IMPERSONATED",
  FEATURE_FLAG_CHANGED: "FEATURE_FLAG_CHANGED",
} as const;
```

### Audit log page

`/admin/audit` — server-rendered table:

| Time | Admin | Action | Target user | Details |
|---|---|---|---|---|
| 2026-06-11 14:32 | admin@kontax.app | USER_PLAN_OVERRIDE | john@example.com | Pro → Family |
| 2026-06-11 14:28 | admin@kontax.app | USER_VIEWED | jane@example.com | — |

- Filterable by action type (dropdown) and date range
- Paginated (50 rows per page)
- Target user is a clickable link to the user detail panel (P21-03)
- Exported as CSV via a "Download" button

---

## Acceptance Criteria

- `AdminAuditEvent` model exists; migration applied.
- `emitAdminEvent` creates a row for every call.
- Every admin server action (P21-03 through P21-08) calls `emitAdminEvent`.
- The `/admin/audit` page displays a paginated, filterable audit log.
- The audit log is read-only — no delete or edit capability.
