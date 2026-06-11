# P21-03 — User Search & Detail Panel

## Purpose

The first and most-used admin tool: finding a specific user and seeing their account state. Without this, handling a support request requires direct database access. This panel gives the admin team everything they need to investigate an account — plan, usage, recent activity, sessions — without touching the database directly.

## Scope

**In scope:**
- `/admin/users` — search page with email/name search
- `/admin/users/[userId]` — user detail panel
- Fields shown: email, name, plan, lifecycleState, emailStatus, contact count, sync account count, last active, created date, subscription details, group membership
- Recent activity: last 10 `ActivityEvent` rows for the user
- Active sessions: last 5 `UserSession` rows

---

## Design / Implementation Spec

### `/admin/users` — search

Server component with a search form (`q` query param):

```typescript
const users = await db.user.findMany({
  where: q ? {
    OR: [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ],
  } : undefined,
  orderBy: { createdAt: "desc" },
  take: 50,
  select: {
    id: true, email: true, name: true, role: true,
    lifecycleState: true, createdAt: true,
    subscriptions: { orderBy: { createdAt: "desc" }, take: 1, select: { plan: true, status: true } },
  },
});
```

Results table: email, name, plan, lifecycle state, created date, link to detail panel.

### `/admin/users/[userId]` — detail panel

Sections:

**Account overview:**
- Email, name, role, lifecycle state, email status
- Created at, last active (from most recent `UserSession.lastActiveAt`)
- Subscription: plan, status, current period end, cancel at period end

**Usage:**
- Contacts: count / limit
- Sync accounts: count / limit
- App passwords: active count
- Imports this month: count / limit
- Group membership: if in a Family/Teams group, show group name and role

**Recent activity** (last 10 `ActivityEvent` rows):
- Event type, contact name, timestamp

**Active sessions** (last 5 `UserSession` rows):
- Device hint, IP, last active, revoked status

**Actions** (rendered as buttons, each triggers a server action):
- Override plan (P21-04)
- Suspend / unsuspend (P21-05)
- Delete account (P21-05)
- Impersonate (P21-07)

All actions call `emitAdminEvent` (P21-02).

---

## Acceptance Criteria

- `/admin/users` search returns results for partial email and name matches.
- `/admin/users/[userId]` shows all specified fields for a valid user ID.
- A non-existent user ID renders a 404 within the admin layout.
- Each action button on the detail panel is wired to the corresponding server action (or placeholder if that ticket isn't shipped yet).
- `USER_VIEWED` admin audit event is emitted when the detail panel is loaded.
