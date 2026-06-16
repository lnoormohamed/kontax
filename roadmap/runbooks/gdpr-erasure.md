# Runbook: GDPR erasure & data export

**Subsystem:** Account deletion, data export, right-to-erasure handling  
**Audience:** Engineers and support handling GDPR requests

---

## Overview

Kontax supports the GDPR right to erasure via a self-service account deletion flow. Deletion is a two-phase process: a 30-day grace period (during which the user can cancel), followed by hard deletion by a nightly cron job.

Data export (Art. 20 — right to data portability) is a self-service ZIP download available to all users.

---

## Data export (right to portability)

### What is in the export ZIP

| File | Contents |
|------|---------|
| `contacts.vcf` | All contacts in vCard 3.0 format (including archived) |
| `contacts.csv` | Same contacts as a spreadsheet |
| `activity-log.csv` | Every `ActivityEvent` row for the user, for the full retention window |
| `billing-summary.txt` | Plan, status, period end, cancellation state; note re Stripe portal for invoices |
| `account.json` | Profile (name, email, createdAt), settings, notification preferences |

The ZIP is generated on demand by `src/server/data-export/generate-export.ts`. For large accounts this runs as a background job triggered by `POST /api/cron/data-export` and the download link is emailed.

### How to trigger on behalf of a user (support)

If a user cannot access the self-service export (e.g. account is LOCKED pending deletion):
1. Impersonate the user (see [admin-ops.md](admin-ops.md)).
2. Navigate to Settings → Account → Your data → Request export.
3. Stop impersonating.

Or generate directly via the DB + generate-export script if impersonation is not possible.

---

## Account deletion flow

### Phase 1: User initiates deletion (30-day grace)

`scheduleAccountDeletion` in `src/app/actions/account.ts`:
1. Checks the user does not own an active Group (Family/Teams owner must transfer or dissolve first).
2. Converts all outbound **live shares** (`shareType=LIVE_SYNC, status=ACTIVE`) to `STATIC_COPY` — recipients keep a frozen snapshot.
3. Revokes pending live shares (not yet accepted) — sets `status=REVOKED`.
4. Sets `User.lifecycleState = LOCKED` and `User.scheduledDeleteAt = now + 30 days`.
5. Increments `sessionVersion` — invalidates all active sessions immediately.
6. Sends a deletion-scheduled confirmation email.

**The user is locked out immediately** but no data is removed yet.

### Phase 2: Cancellation (within 30 days)

`cancelAccountDeletion` in `src/app/actions/account.ts`:
1. Sets `lifecycleState = ACTIVE`, clears `scheduledDeleteAt`.
2. The user regains normal access on next sign-in.
3. Note: revoked/converted shares are NOT automatically reversed.

### Phase 3: Hard deletion (cron)

`POST /api/cron/delete-accounts` runs nightly. It finds all users where:
- `scheduledDeleteAt <= now`
- `lifecycleState = 'LOCKED'`

For each, it calls `db.user.delete({ where: { id } })`. Prisma cascades the delete to all child records: contacts, sync accounts, subscriptions, shares, activity events, sessions, notifications, etc. A confirmation email is sent to the address on file.

---

## Handling an inbound GDPR erasure request

If a user emails privacy@getkontax.com requesting erasure:

1. **Verify identity**: confirm the requester owns the account (reply asking them to send from their registered email, or verify via the admin panel).
2. **Check if already initiated**: in `/admin` → Users, check `lifecycleState` and `scheduledDeleteAt`. If already LOCKED and within the 30-day window, it will complete automatically.
3. **If not initiated**: direct the user to Settings → Account → Delete account. If they cannot access the UI, an admin can trigger deletion via the admin panel.
4. **Document the request**: note the date of the request in the user's admin notes field (audit log action `account.delete.schedule` captures the timestamp).
5. **Confirmation**: once the cron job runs and the account is gone, a confirmation email is sent automatically. For a formal deletion certificate, email privacy@getkontax.com with the user ID and deletion timestamp.

---

## Verifying deletion is complete

After `scheduledDeleteAt` has passed:
```sql
-- Should return 0 rows
SELECT id FROM "User" WHERE email = 'user@example.com';
```

If the row still exists after the expected cron run, check:
1. Coolify cron logs for the `delete-accounts` job.
2. `CRON_SECRET` env var matches what the LXC cron sends.
3. Whether the user owns a Group (the action would have returned `OWNS_ACTIVE_GROUP` and not set `scheduledDeleteAt`).

---

## Contested erasure / active Stripe subscription

If the user has an active Stripe subscription, the deletion flow currently logs a warning but does not cancel the subscription automatically (a TODO in the code). Before completing a manual deletion:
1. Cancel the Stripe subscription from the Stripe dashboard.
2. Then proceed with account deletion.

---

## References

- Account actions: `src/app/actions/account.ts`
- Deletion cron: `src/app/api/cron/delete-accounts/route.ts`
- Data export generator: `src/server/data-export/generate-export.ts`
- Contact portability (vCard/CSV serialisation): `src/server/contact-portability.ts`
- Admin operations: [admin-ops.md](admin-ops.md)
