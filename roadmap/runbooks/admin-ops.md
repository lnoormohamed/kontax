# Runbook: Admin operations

**Subsystem:** `/admin` panel — user management, impersonation, feature flags, audit log  
**Audience:** Engineers and admins doing support tasks or flag rollouts

---

## Overview

The admin panel lives at `/admin`. Access requires `User.role = "ADMIN"` in the database. All admin actions are append-only logged to `AdminAuditEvent`.

---

## Granting admin access

Manually set the role in the database. There is no UI for this — only the `grant-admin` script (see [DB & verification workflow](../../memory/project_db-and-verification-workflow.md)):

```bash
# From the repo root
npx ts-node scripts/grant-admin.ts user@example.com
```

Or directly:
```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'user@example.com';
```

---

## Impersonation

Impersonation lets an admin view and interact with the app exactly as a user would, without knowing their password. It is **read-only** — write actions return `IMPERSONATION_READ_ONLY`.

**How to start:**
1. In `/admin` → Users, find the user and click Impersonate.
2. A signed `kontax_imp` cookie is set (30-minute TTL, HMAC-SHA256 signed with `AUTH_SECRET`).
3. The admin is redirected to `/contacts` as the impersonated user.
4. A banner at the top shows who is being impersonated and a Stop button.

**How to stop:** Click Stop impersonating in the banner. The `kontax_imp` cookie is cleared.

**What is read-only:**
- Any server action that calls `auth()` checks `session.impersonatedBy` and returns `IMPERSONATION_READ_ONLY` for: profile updates, password change, email change, account deletion, contact write actions, sync mutations.
- The admin can read contacts, view activity, and navigate the full UI.

**Session expiry:** The cookie expires after 30 minutes. After expiry, the next page load returns the admin to their own session automatically.

**Audit trail:** Impersonation start and end are logged as `impersonation.start` and `impersonation.end` in the admin audit log, including the admin's IP.

---

## Feature flags

Feature flags control gradual rollouts without code deploys. Managed at `/admin` → Feature flags.

**Flag modes:**

| Mode | Behaviour |
|------|-----------|
| `OFF` | Disabled for everyone |
| `ALL` | Enabled for everyone |
| `SPECIFIC_USERS` | Enabled only for users in the allow-list |
| `ROLLOUT` | Deterministic percentage rollout — `sha256(key:userId) % 100 < rolloutPct`. Stable: a user's bucket doesn't change as the percentage grows. |

**Adding a new flag:**
1. Create it via `/admin` → Feature flags → New flag. Set `key` (the string used in code), `name`, `description`, and initial mode.
2. In code, call `isFeatureEnabled(key, userId)` from `src/server/admin/feature-flags.ts`.
3. Flag creation and changes are logged as `flag.update` in the audit log.

---

## Plan override

To manually set a user's plan (for comps, internal accounts, or corrections):
1. `/admin` → Users → find user → Override plan.
2. Choose the plan and billing interval. This creates or updates a `Subscription` row directly, bypassing Stripe.
3. Logged as `plan.override` in the audit log.

To revert to the Stripe-managed state, delete the manual subscription row and re-deliver the relevant Stripe webhook.

---

## Suspend / unsuspend

To prevent a user from signing in (e.g. abuse, pending investigation):
1. `/admin` → Users → Suspend. Sets `lifecycleState = LOCKED` and increments `sessionVersion` to invalidate all active sessions.
2. Logged as `account.suspend`.
3. To reinstate: Unsuspend → sets `lifecycleState = ACTIVE`. Logged as `account.unlock`.

> Suspension is different from account deletion: no data is removed, and the account is immediately recoverable by unsuspending.

---

## Admin audit log

Every admin action is recorded in `AdminAuditEvent` with: admin identity, target user, action key, IP address, and a JSON details blob.

**Action keys:**

| Key | Triggered by |
|-----|-------------|
| `user.view` | Admin opens a user detail page |
| `plan.override` | Manual plan override |
| `account.suspend` | Suspend action |
| `account.unlock` | Unsuspend action |
| `account.delete.schedule` | Admin schedules deletion |
| `impersonation.start` | Impersonation begins |
| `impersonation.end` | Impersonation ends |
| `flag.update` | Feature flag created or changed |
| `product.broadcast` | In-app announcement sent |

**Viewing the log:** `/admin` → Audit log. Filterable by action type, target email, and time range (24h / 7d / 30d). 50 rows per page, newest first.

---

## References

- Impersonation: `src/server/admin/impersonation.ts`
- Feature flags: `src/server/admin/feature-flags.ts`
- Audit log: `src/server/admin/audit.ts`
- Admin guard: `src/server/admin/guard.ts`
- Admin server actions: `src/app/actions/admin.ts`
