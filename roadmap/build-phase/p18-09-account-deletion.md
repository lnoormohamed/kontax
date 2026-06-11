# P18-09 — Account Deletion

## Purpose

Users must be able to permanently close their Kontax account and have all their personal data deleted. This is both a user-trust expectation and a legal requirement under GDPR (right to erasure) and similar regulations. Without it, a user who wants to leave — or who has a paid plan they want to cancel — has no self-service path. Providing a clear, confirmed, irreversible deletion flow demonstrates that Kontax respects user data.

## Policy reference

This ticket must comply with `lifecycle-policies.md` Section 3d (owner account deletion with active group). The exact dissolution process, notification timing, data fate for shared contacts, and the v1 decision to defer ownership transfer are all specified there. Do not implement group handling without reading that document first.

## Background

The Prisma schema uses `onDelete: Cascade` on nearly all child models (`Contact`, `SyncAccount`, `AppPassword`, `ActivityEvent`, etc.), so a `db.user.delete()` will cascade-delete most associated data automatically. However several things require explicit handling before the delete:

- **Stripe subscription:** must be cancelled via the Stripe API before the local record is deleted (Phase 19 wires this; P18-09 must account for it — see Scope).
- **Live contact shares:** the recipient holds a `SHARED_LIVE` copy linked to the owner's contact. Deleting the owner's account must either convert live shares to static snapshots for recipients or notify them that the live link is broken.
- **GroupMember:** if the user is the owner (`Group.ownerId`) of a Family or Teams group, the group must be transferred or dissolved before deletion.
- **Blob-stored avatars:** the avatar file in MinIO (P18-01) is not deleted by Prisma cascade and must be cleaned up explicitly using `DeleteObjectCommand` from `@aws-sdk/client-s3`.

## Scope

**In scope:**
- Account deletion settings section (UI + server action)
- Confirmation step: user must type their email address to confirm
- Pre-deletion checks: active paid subscription, owned groups — block or require resolution first
- Stripe subscription cancellation (stub call; Phase 19 wires the real API — see notes)
- Live-share recipient handling: convert all outbound `SHARED_LIVE` shares to `SHARED_STATIC` snapshots before deletion
- Avatar blob cleanup
- Soft-delete option (30-day grace period) vs hard-delete — see decision below
- Post-deletion: sign out and redirect to a "Your account has been deleted" confirmation page
- Admin-triggered deletion (Phase 21 calls the same underlying function)

**Out of scope:**
- Data export before deletion — Kontax already has CSV/vCard export (Phase 3). The deletion page should link to the export feature as a pre-deletion suggestion, but the export itself is not new work here.
- GDPR data-access requests (subject access requests) — deferred to a future compliance phase.

---

## Design / Implementation Spec

### Deletion model decision: hard-delete with 30-day recovery window

v1 uses a **scheduled hard-delete with a 30-day grace period**:

1. User confirms deletion → account is immediately locked (`lifecycleState: LOCKED`) and inaccessible.
2. A `scheduledDeleteAt DateTime?` timestamp is set to `now() + 30 days`.
3. A background job (Phase 21's cron infrastructure, or a scheduled Next.js route handler) runs daily and hard-deletes all accounts where `scheduledDeleteAt < now()`.
4. During the 30-day window, if the user signs in again, they are shown a "Your account is scheduled for deletion" page with an option to cancel the deletion.

This balances user trust (data is gone eventually) with the reality that deletion is often accidental or impulsive.

### Schema changes

Add to the `User` model in `prisma/schema.prisma`:

```prisma
scheduledDeleteAt DateTime?
```

Add index:
```prisma
@@index([scheduledDeleteAt])
```

Run: `prisma migrate dev --name add-scheduled-delete`

### Server action — `scheduleAccountDeletion`

In `src/app/actions/account.ts`:

```typescript
export async function scheduleAccountDeletion(input: {
  confirmEmail: string;
}): Promise<{ success: true } | { error: string }>
```

Steps:
1. Assert authenticated session.
2. Verify `input.confirmEmail.toLowerCase() === session.user.email.toLowerCase()`. If not: return `{ error: "EMAIL_MISMATCH" }`.
3. Fetch user with `lifecycleState`, `subscriptionCustomer` (to check for active paid sub), owned groups.
4. **Owned group check:** If the user owns any active Group (`Group.ownerId === userId`), return `{ error: "OWNS_ACTIVE_GROUP" }` with a message: "You must transfer or delete your Family/Teams group before closing your account."
5. **Active subscription check:** If the user has an active paid subscription (`Subscription.status IN ('ACTIVE', 'TRIALING') AND plan != FREE`): call `cancelSubscriptionImmediate(userId)` — stub function in Phase 19 scope. For v1 (before Phase 19), log a warning and proceed; Phase 19 will retrofit the real cancellation call.
6. **Convert outbound live shares to static snapshots:**
   ```typescript
   // For each LIVE_SYNC share owned by this user where recipient has accepted:
   await db.contactShare.updateMany({
     where: {
       ownerUserId: userId,
       shareType: "LIVE_SYNC",
       status: "ACTIVE",
       recipientContactId: { not: null },
     },
     data: { shareType: "STATIC_COPY" },
   });
   // Revoke pending live shares (not yet accepted)
   await db.contactShare.updateMany({
     where: {
       ownerUserId: userId,
       shareType: "LIVE_SYNC",
       status: "ACTIVE",
       recipientContactId: null,
     },
     data: { status: "REVOKED", revokedAt: new Date() },
   });
   ```
7. **Schedule deletion:**
   ```typescript
   await db.user.update({
     where: { id: userId },
     data: {
       lifecycleState: "LOCKED",
       scheduledDeleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
     },
   });
   ```
8. **Revoke all sessions** by incrementing `sessionVersion`:
   ```typescript
   await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
   ```
9. **Schedule avatar blob cleanup** (fire-and-forget, best effort):
   ```typescript
   if (user.avatarUrl?.includes(BLOB_DOMAIN)) {
     void deleteBlob(user.avatarUrl);
   }
   ```
10. Emit `ACCOUNT_UPDATED` ActivityEvent with `payload: { field: "accountDeletionScheduled", scheduledDeleteAt }`.
11. Sign the user out: call `signOut()` from NextAuth (server-side). Redirect to `/account-deleted`.
12. Return `{ success: true }`.

### Server action — `cancelAccountDeletion`

```typescript
export async function cancelAccountDeletion(): Promise<{ success: true }>
```

Called when a user signs in during the 30-day grace period and chooses to cancel deletion.

Steps:
1. Assert authenticated session where user has `scheduledDeleteAt` set (i.e., they signed in to an account marked for deletion — middleware allows a special "cancellation" page).
2. Update:
   ```typescript
   await db.user.update({
     where: { id: userId },
     data: { lifecycleState: "ACTIVE", scheduledDeleteAt: null },
   });
   ```
3. Emit `ACCOUNT_UPDATED` ActivityEvent with `payload: { field: "accountDeletionCancelled" }`.
4. Redirect to `/contacts`.

### Background deletion job

A route handler or cron job (daily) performs the actual hard delete:

```typescript
// src/app/api/cron/delete-accounts/route.ts
const dueForDeletion = await db.user.findMany({
  where: {
    scheduledDeleteAt: { lte: new Date() },
    lifecycleState: "LOCKED",
  },
  select: { id: true },
});

for (const user of dueForDeletion) {
  await db.user.delete({ where: { id: user.id } });
  // Cascade deletes all child records via Prisma onDelete: Cascade
}
```

Protect the cron route with a `CRON_SECRET` header check. Register on the LXC cron (`crontab -e`):
```
0 2 * * * curl -s -X POST https://your-app-url/api/cron/delete-accounts -H "x-cron-secret: $CRON_SECRET"
```

### Login behaviour during grace period

The NextAuth `authorize` callback checks `User.scheduledDeleteAt` after a successful password verification:

```typescript
if (user.scheduledDeleteAt) {
  // Return a special marker — not a full session
  return { id: user.id, email: user.email, pendingDeletion: true };
}
```

The JWT callback embeds `pendingDeletion: true`. The middleware (P18-07/P18-10) gates all app routes, allowing only `/account-pending-deletion` through for these sessions. That page shows:

```
Your account is scheduled for deletion on [date].
All your data will be permanently removed at that time.

[Cancel deletion — keep my account]   [Sign out]
```

### Settings page UI — Delete account section

Location: `/settings/security`, at the very bottom of the page.

```
Danger zone

Delete account

Permanently delete your account and all associated data.
This action cannot be undone.

[Delete my account]  (outlined destructive button — red border, red text)
```

Clicking "Delete my account" opens a confirmation dialog:

```
┌────────────────────────────────────────────────────────┐
│  Delete your Kontax account?                           │
│                                                        │
│  This will permanently delete:                         │
│  • All your contacts (N contacts)                      │
│  • All sync connections                                │
│  • All import and activity history                     │
│  • Your subscription (if active)                       │
│                                                        │
│  ⚠ Before you go: [Export your contacts →]            │
│                                                        │
│  Your account will be deleted in 30 days. You can      │
│  sign back in during that period to cancel.            │
│                                                        │
│  To confirm, type your email address:                  │
│  [                                              ]      │
│                                                        │
│  [Cancel]         [Delete my account]                  │
│                   (red, disabled until email matches)  │
└────────────────────────────────────────────────────────┘
```

**Blocked states:**

If the user owns an active group:
```
You must [transfer or delete your group →] before you can close your account.
[Delete my account] button is disabled.
```

---

## Acceptance Criteria

- `User.scheduledDeleteAt DateTime?` exists in the schema; migration applied.
- `scheduleAccountDeletion` rejects if the typed email does not match the account email.
- `scheduleAccountDeletion` blocks if the user owns an active group.
- After calling `scheduleAccountDeletion`: `User.lifecycleState` is set to `LOCKED`, `scheduledDeleteAt` is set to 30 days from now, all sessions are invalidated, and the user is signed out.
- All outbound `LIVE_SYNC` shares are converted to `STATIC_COPY` (accepted) or `REVOKED` (pending) before the account is locked.
- A user who signs in during the 30-day grace period lands on the "pending deletion" page, not the contacts list.
- `cancelAccountDeletion` restores `lifecycleState: ACTIVE` and clears `scheduledDeleteAt`.
- The background deletion job hard-deletes all users whose `scheduledDeleteAt < now()`.
- Cascade deletes remove all contacts, sync accounts, activity events, sessions, and app passwords.
- The deletion confirmation dialog shows contact count, requires email input, and links to the export feature.
- The "Delete my account" button is disabled while the email input does not match.

---

## Risks and Open Questions

- **Stripe cancellation stub:** Phase 19 has not shipped yet. The `cancelSubscriptionImmediate` function is a stub that logs a warning in v1. When Phase 19 ships, it must retrofit this call to actually cancel the Stripe subscription immediately (not at period end). Document this debt clearly with a `TODO(P19)` comment in the code.
- **Group ownership block:** The current check blocks deletion if the user owns a group. The UX for "transfer ownership" (needed to unblock) is not yet designed (Phase 13/14). For v1, the UI should link to the group management page with a note. If the group management page does not yet exist, the error message should say "Please contact support to transfer your group before deleting your account."
- **Shared-live recipients:** Recipients of live shares from a deleted account will have their contacts silently converted to static copies. They should receive a notification (email or in-app). This is deferred — Phase 22's notification system can send "a contact you received is no longer live-synced."
- **Data retention for legal/billing:** Some billing records (Stripe webhook events, invoices) are not stored in Kontax's database and exist in Stripe's systems. GDPR deletion applies to Kontax's stored data; Stripe retains billing records for their own compliance obligations. Document this distinction.
- **The 30-day grace period and data requests:** A user who submits a GDPR subject access request and then schedules deletion — their data must be exported before the hard-delete runs. Out of scope for v1; note as a compliance gap.
