# P11-03 Entitlement Enforcement Update

## Purpose
This ticket audits every entitlement gate in `billing.ts` and throughout the application, then updates or adds enforcement logic to reflect the four-tier feature matrix defined in P11-01 and the new schema fields introduced in P11-02. It also documents and implements the downgrade behavior for all three tier transitions that affect active data: Pro-to-Free, Family-to-Pro, and Teams-to-Pro/Free.

## Background
Kontax's entitlement enforcement is centralised in `src/server/billing.ts`. The file exposes assertion functions (`assertCanCreateContacts`, `assertCanImportContacts`, `assertCanUsePremiumExport`, `assertCanUseCardDavSync`, `assertCanCreateSyncAccount`) that are called from server actions and API routes before writes are committed. These functions read from `getUserBillingContext`, which in turn reads the user's active subscription from the database and falls back to `PLAN_DEFAULTS` when no subscription is found.

The current implementation has several gaps relative to the P11-01 feature matrix:
- `monthlyImportLimit` is currently checked against the import count, not the number of import jobs. P11-01 defines Free as "3 imports per month" meaning 3 `ImportJob` completions, not 3 contacts. This must be clarified and potentially the enforcement logic corrected.
- There are no gates for: app passwords, advanced merge, live sharing, static sharing, activity log access, shared address books, or group membership actions.
- The `assertCanCreateContacts` gate uses a hard numeric comparison that will fail when `contactsLimit` is `null` (the new unlimited value for Pro/Family/Teams) — it will evaluate `null > limit` as false in JavaScript but `contactsUsed + count > null` is `NaN > null` which is `false`, meaning the gate would silently pass all counts. This is technically the correct behavior but it is accidental and fragile.
- The existing error messages reference "Plus and Pro plans" and "the Pro plan" — these must be updated to reflect the new tier names.

## Scope
### In scope
- Update all existing `assert*` functions to handle `null` limits correctly and use updated tier names in error messages.
- Fix the import limit gate: clarify whether the limit applies to ImportJob count or contact row count, and enforce the correct interpretation (P11-01 says 3 imports/month = 3 ImportJob completions).
- Add new assertion functions for: app passwords, advanced merge, live sharing, static sharing, activity log global feed access.
- Add stub assertion functions for: shared address book creation (Family/Teams gate).
- Document and implement downgrade behavior: Pro-to-Free, Family-to-Pro, Teams-to-Pro (data state transitions on downgrade confirmation).
- Update all error messages to reference correct plan names.
- Ensure all server actions that create/update/delete entitlement-gated resources call the appropriate assertion.

### Out of scope
- The activity log retention job itself — covered in P11-05.
- UI for upgrade prompts — covered in P11-04.
- Settings page updates — covered in P11-06.
- Group management product logic (invite, remove, admin controls) — Phase 13 and 14.
- Stripe webhook integration updates — separate billing integration work.

---

## Design / Implementation Spec

### 1. Null-safe limit enforcement

Every place in the codebase that evaluates a plan limit must use null-safe comparisons. Define a shared utility:

```typescript
// src/server/billing.ts

/** Returns true if the usage is at or over the limit. Returns false if limit is null (unlimited). */
export const isAtLimit = (used: number, limit: number | null): boolean => {
  if (limit === null) return false;
  return used >= limit;
};

/** Returns remaining capacity. Returns Infinity if limit is null (unlimited). */
export const remaining = (used: number, limit: number | null): number => {
  if (limit === null) return Infinity;
  return Math.max(limit - used, 0);
};
```

Replace all direct arithmetic comparisons against `contactsLimit`, `monthlyImportLimit`, and `syncAccountsLimit` with `isAtLimit`.

### 2. assertCanCreateContacts update

Current implementation: `summary.contactsUsed + incomingCount > summary.entitlements.contactsLimit`

Updated implementation:
```typescript
export const assertCanCreateContacts = async (userId: string, incomingCount = 1) => {
  const summary = await getUserPlanSummary(userId);
  assertWritableAccount(summary);

  if (isAtLimit(summary.contactsUsed + incomingCount - 1, summary.entitlements.contactsLimit)) {
    const limitStr =
      summary.entitlements.contactsLimit === null
        ? "unlimited"
        : summary.entitlements.contactsLimit.toLocaleString();
    throw new Error(
      `${summary.planLabel} plan limit reached. Upgrade to store more than ${limitStr} contacts.`,
    );
  }

  return summary;
};
```

Error message must not reference specific plan names from the old tier structure.

### 3. assertCanImportContacts update: job count vs contact count

P11-01 defines the Free import limit as "3 imports per month" where an "import" is a completed `ImportJob`, not the number of contacts in that job. The current `getUserPlanSummary` function uses:

```typescript
db.importJob.aggregate({
  where: { userId, status: "COMPLETED", createdAt: { gte: monthStart } },
  _sum: { importedCount: true },
})
```

This sums the total contact count across all import jobs, not the number of jobs. This is the wrong metric for the new intent. Update to count completed ImportJob rows:

```typescript
const importJobsThisMonth = await db.importJob.count({
  where: { userId, status: "COMPLETED", createdAt: { gte: monthStart } },
});
```

Return this as `importJobsUsedThisMonth` from `getUserPlanSummary`. The `assertCanImportContacts` function gates on job count before the job begins (checked at the start of a new import, before file processing):

```typescript
export const assertCanStartImportJob = async (userId: string) => {
  const summary = await getUserPlanSummary(userId);
  assertWritableAccount(summary);

  if (isAtLimit(summary.importJobsUsedThisMonth, summary.entitlements.monthlyImportLimit)) {
    const limitStr =
      summary.entitlements.monthlyImportLimit === null
        ? "unlimited"
        : `${summary.entitlements.monthlyImportLimit}`;
    throw new Error(
      `You have used all ${limitStr} imports for this month on the ${summary.planLabel} plan. Imports reset at the start of each calendar month.`,
    );
  }

  return summary;
};
```

The old `assertCanImportContacts(userId, incomingCount)` which gated on contact count within the import should be retired or repurposed. If contact count within a single import should also be bounded (e.g., Free users cannot import more than 500 contacts in one job), document that explicitly. For now, only the job count gate is in scope.

### 4. assertCanCreateSyncAccount update

Current: checks `cardDavSyncEnabled` then slot count.

Updated: the `cardDavSyncEnabled` field is replaced by reading `syncAccountsLimit`. If `syncAccountsLimit` is 0, CardDAV sync is not available. The explicit `cardDavSyncEnabled` boolean is redundant because `syncAccountsLimit > 0` implies the feature is enabled. However, both fields are kept during Phase 11 for backward compatibility. The assertion checks both:

```typescript
export const assertCanCreateSyncAccount = async (userId: string) => {
  const summary = await getUserPlanSummary(userId);
  assertWritableAccount(summary);

  if (!summary.entitlements.cardDavSyncEnabled) {
    throw new Error(
      "CardDAV sync is available on Pro, Family, and Teams plans.",
    );
  }

  const syncAccountsUsed = await db.syncAccount.count({ where: { userId } });

  if (isAtLimit(syncAccountsUsed, summary.entitlements.syncAccountsLimit)) {
    throw new Error(
      `${summary.planLabel} plan sync limit reached. You can connect up to ${summary.entitlements.syncAccountsLimit} sync accounts on this plan.`,
    );
  }

  return { ...summary, syncAccountsUsed };
};
```

### 5. assertCanCreateAppPassword (new)

App passwords authenticate devices to the Kontax CardDAV server endpoint. They are subject to the `appPasswordsLimit` entitlement.

The model for app passwords is expected to be a separate table (e.g., `AppPassword`). If this model does not yet exist, this function is a stub that always passes, and a TODO comment marks it for activation in the ticket that introduces the `AppPassword` model.

```typescript
export const assertCanCreateAppPassword = async (userId: string) => {
  const summary = await getUserPlanSummary(userId);
  assertWritableAccount(summary);

  // TODO: Remove stub when AppPassword model is available.
  // const appPasswordsUsed = await db.appPassword.count({ where: { userId } });
  const appPasswordsUsed = 0;

  if (isAtLimit(appPasswordsUsed, summary.entitlements.appPasswordsLimit)) {
    throw new Error(
      `${summary.planLabel} plan app password limit reached. You can create up to ${summary.entitlements.appPasswordsLimit} device app passwords on this plan.`,
    );
  }

  return { ...summary, appPasswordsUsed };
};
```

### 6. assertCanUseAdvancedMerge (new)

```typescript
export const assertCanUseAdvancedMerge = async (userId: string) => {
  const summary = await getUserPlanSummary(userId);
  assertWritableAccount(summary);

  if (!summary.entitlements.advancedMergeEnabled) {
    throw new Error(
      "Advanced merge is available on Pro, Family, and Teams plans. On the Free plan, contacts can be merged one at a time using automatic detection.",
    );
  }

  return summary;
};
```

This function must be called from the merge server actions before:
- Field-level merge resolution (choosing which field value wins).
- Bulk accept of HIGH confidence suggestions.
- Any merge undo action (30-day window).

The existing merge flow in `src/server/contact-merge.ts` must be audited. Any path that performs advanced merge operations without calling this assertion must be updated.

### 7. assertCanUseLiveSharing (new)

Live sharing requires both the sender and receiver to be on Pro, Family, or Teams. This assertion takes both user IDs and checks both:

```typescript
export const assertCanUseLiveSharing = async (senderId: string, receiverId: string) => {
  const [senderContext, receiverContext] = await Promise.all([
    getUserBillingContext(senderId),
    getUserBillingContext(receiverId),
  ]);

  const senderCanShare = senderContext.entitlements.liveShareEnabled;
  const receiverCanReceive = receiverContext.entitlements.liveShareEnabled;

  if (!senderCanShare) {
    throw new Error(
      "Live contact sharing is available on Pro, Family, and Teams plans.",
    );
  }

  if (!receiverCanReceive) {
    throw new Error(
      "The person you are sharing with must also be on a Pro, Family, or Teams plan to receive live contact updates. They can still receive a static snapshot.",
    );
  }

  return { senderContext, receiverContext };
};
```

### 8. assertCanUseStaticSharing (new)

Static sharing only requires the sender to be on Pro+. The receiver can be on any plan.

```typescript
export const assertCanUseStaticSharing = async (senderId: string) => {
  const summary = await getUserPlanSummary(senderId);
  assertWritableAccount(summary);

  if (!summary.entitlements.staticShareEnabled) {
    throw new Error(
      "Contact sharing is available on Pro, Family, and Teams plans.",
    );
  }

  return summary;
};
```

### 9. assertCanAccessActivityLogFeed (new)

The global activity log feed is gated on `activityLogRetentionDays !== 0`. Free users have `activityLogRetentionDays = 0` which means no global feed.

```typescript
export const assertCanAccessActivityLogFeed = async (userId: string) => {
  const summary = await getUserPlanSummary(userId);

  if (summary.entitlements.activityLogRetentionDays === 0) {
    throw new Error(
      "The activity log feed is available on Pro, Family, and Teams plans.",
    );
  }

  return summary;
};
```

This function must be called from the server action or route handler that loads the activity log page/feed. It does not need to be called on every contact edit — only on the feed access path.

### 10. assertCanCreateSharedAddressBook (new stub)

Shared address books are a Family/Teams-only feature. Phase 13 and 14 will implement the actual creation flow. This assertion is a stub that gates on `sharedAddressBooksLimit`:

```typescript
export const assertCanCreateSharedAddressBook = async (userId: string) => {
  const summary = await getUserPlanSummary(userId);
  assertWritableAccount(summary);

  if (summary.entitlements.sharedAddressBooksLimit === 0) {
    throw new Error(
      "Shared address books are available on Family and Teams plans.",
    );
  }

  // For Family: limit is 1. Check current count.
  if (summary.entitlements.sharedAddressBooksLimit !== null) {
    // TODO: count GroupAddressBook rows for this user's group when Phase 13 implements groups.
    // For now, this stub only blocks Free/Pro users.
  }

  return summary;
};
```

### 11. assertCanUsePremiumExport update

Current error message: "vCard export is available on Plus and Pro plans."

Updated:
```typescript
if (!summary.entitlements.premiumExportEnabled) {
  throw new Error("vCard export is available on Pro, Family, and Teams plans.");
}
```

### 12. Server action audit

The following server actions and route handlers must be audited to confirm they call the correct assertion before their write operation. If an assertion is missing, add it.

| Action/Route | Expected assertion |
|---|---|
| Create contact (single) | `assertCanCreateContacts` |
| Import job commit | `assertCanStartImportJob` (before job starts), `assertCanCreateContacts` (before contacts are written) |
| Export job create | `assertCanUsePremiumExport` (for VCARD_4 format) |
| Create sync account | `assertCanCreateSyncAccount` |
| Create app password | `assertCanCreateAppPassword` |
| Advanced merge accept | `assertCanUseAdvancedMerge` |
| Bulk merge accept | `assertCanUseAdvancedMerge` |
| Merge undo | `assertCanUseAdvancedMerge` |
| Create live share | `assertCanUseLiveSharing` |
| Create static share | `assertCanUseStaticSharing` |
| Load activity log feed | `assertCanAccessActivityLogFeed` |
| Create shared address book | `assertCanCreateSharedAddressBook` |

Run `grep -r "assertCan" src/ --include="*.ts" --include="*.tsx"` to find existing callsites. Cross-reference with the table above to find gaps.

### 13. Downgrade behavior: Pro to Free

Trigger: Stripe webhook delivers a `customer.subscription.updated` or `customer.subscription.deleted` event that moves the user from PRO to FREE (or cancels the subscription).

The webhook handler (not yet in scope for full implementation in Phase 11 but the behavior must be documented here) must execute the following after updating the `Subscription` row:

**Sync accounts**: Count `SyncAccount` rows for the user. Free allows 1. If the user has more than 1, all sync accounts beyond the first (ordered by `createdAt ASC` — the oldest is kept) must have their `status` set to `PAUSED`. They are not deleted. The user sees them as paused in the sync center and can reactivate one if they re-upgrade.

**App passwords**: Count app passwords. Free allows 1. If the user has more than 1, revoke all but the oldest (same ordering logic as sync accounts). Revoked app passwords must have their hash cleared and a `revokedAt` timestamp set. The device using a revoked password will receive a 401 on next sync.

**Activity log data**: Events older than 0 days on the global feed are not deleted immediately. The nightly retention job (P11-05) will prune them on its next run. This intentional delay prevents data loss during an accidental downgrade and provides a grace window if the user immediately re-upgrades.

**Live shares**: Any outgoing live shares the user has sent must be converted to static snapshots. The share record's type is updated from `LIVE` to `STATIC` and the last-known contact state is frozen as the snapshot. Incoming live shares from other users: if the user is receiving a live share from someone, that person's share is also converted to static (because the receiver is now Free). The sender is notified.

**Advanced merge undo window**: Merges executed within the last 30 days while on Pro retain their undo window. The undo capability does not vanish on downgrade. This is a grace behavior — the undo is tied to the merge action timestamp, not the current plan.

### 14. Downgrade behavior: Family to Pro

Trigger: Family group owner cancels the Family subscription and downgrades to Pro (or the subscription lapses to a single-user plan).

**Group dissolution sequence:**
1. All `GroupMember` rows for the group have their `inviteStatus` set to `REVOKED`.
2. All members (except the owner) have their personal `User.lifecycleState` set based on whether they have an independent subscription. If they do not, their `lifecycleState` becomes `ACTIVE` but their plan defaults to `FREE` (no active subscription).
3. The `Group` row's `subscriptionId` link is nullified (or the group is archived with an `archivedAt` timestamp — prefer archiving over deletion for audit trail).
4. The shared `GroupAddressBook` is archived (`archivedAt` set). The owner retains read access to its contacts via a one-time export snapshot.
5. Contacts that existed only in the shared address book and were not in any member's personal library: these are transferred to the owner's personal library as archived contacts (with a source note indicating they came from the family book). They are not deleted.
6. The owner's subscription is updated to `PRO` plan. Their personal library entitlements update accordingly.

**Open question for product decision:** Should members receive a notification email before the group is dissolved? The implementation should emit a `GROUP_DISSOLUTION_PENDING` activity event 7 days before the dissolution takes effect if the subscription is scheduled to cancel at period end. If it is an immediate cancellation (e.g., payment failure), the dissolution happens immediately.

### 15. Downgrade behavior: Teams to Pro or Free

**Grace period:** When a Teams subscription is canceled or downgraded, a 30-day grace period begins. During grace:
- All shared address books remain readable and writable for the owner.
- Members retain read access.
- No new members can be added.
- No new shared address books can be created.

**After grace period:**
- All `GroupAddressBook` rows are archived (`archivedAt` set).
- All members (except owner) have their group membership `inviteStatus` set to `REVOKED`.
- The group is archived.
- The owner retains read access to archived book contacts via export. They cannot write to archived books.

**Multiple shared books:** Unlike Family (1 book), Teams may have many. All books are archived on the same schedule. The owner can export each book independently during the grace period. The settings/billing UI should surface a visible countdown during grace.

### 16. Downgrade state machine implementation

The downgrade logic above should be implemented as a dedicated function in `billing.ts`:

```typescript
export const handleSubscriptionDowngrade = async (
  userId: string,
  fromPlan: SubscriptionPlan,
  toPlan: SubscriptionPlan,
  opts: { immediate: boolean }
): Promise<void>
```

This function is called by the Stripe webhook handler after the subscription row has been updated. It is idempotent — calling it multiple times for the same transition must not cause duplicate side effects (use a database transaction and check current state before each mutation).

For Phase 11, this function should be implemented with the Pro-to-Free path fully functional. Family-to-Pro and Teams paths should be stubbed with a clear `// Phase 13/14: implement group dissolution here` comment and a thrown `NotImplementedError` in non-production environments so it is not silently swipped.

---

## Acceptance Criteria
- `isAtLimit` and `remaining` utility functions exist in `billing.ts` and are used by all assertion functions instead of raw arithmetic comparisons.
- `assertCanCreateContacts` handles `null` limit correctly (null = no ceiling, gate never triggers).
- `assertCanStartImportJob` correctly gates on completed `ImportJob` count (not contact count). The count query uses `db.importJob.count()`.
- All error messages reference "Pro, Family, and Teams plans" where appropriate (not the old Plus/Pro language).
- `assertCanCreateAppPassword`, `assertCanUseAdvancedMerge`, `assertCanUseLiveSharing`, `assertCanUseStaticSharing`, `assertCanAccessActivityLogFeed`, `assertCanCreateSharedAddressBook` are all present and exported from `billing.ts`.
- `assertCanUseLiveSharing` checks both sender and receiver eligibility in a single call.
- The server action audit table (section 12) is complete: every listed action has its assertion call verified or added.
- `handleSubscriptionDowngrade` exists with the Pro-to-Free path implemented: sync accounts beyond limit are paused, app passwords beyond limit are revoked, live shares are converted to static.
- Family-to-Pro and Teams downgrade paths are stubbed with `// Phase 13/14` comments and non-silent errors in non-production.
- Existing test coverage for `assertCanCreateContacts` and `assertCanCreateSyncAccount` is updated to pass with null limits.
- New tests for `assertCanUseLiveSharing` cover: both parties eligible, sender not eligible, receiver not eligible, receiver downgrades after share is created.

## Risks and Open Questions
- The `monthlyImportLimit` semantics change (contact count to job count) may break existing Free users who were relying on the old 250-contact monthly allowance. The behavioral change must be documented in release notes.
- `assertCanUseLiveSharing` makes two `getUserBillingContext` calls (sender and receiver). This adds two database round-trips to the sharing create path. If sharing is created frequently, consider caching the billing context for the duration of a request.
- The merge undo window surviving a Pro-to-Free downgrade is a grace behavior that must be documented in the user-facing changelog. It prevents a gotcha where a user merges contacts, then downgrades, and discovers they cannot undo the merge.
- `handleSubscriptionDowngrade` must be idempotent because Stripe webhooks can deliver events more than once. Idempotency key handling for webhook events must be in place before this function is called from production webhook handlers.
- The list of server actions requiring assertion calls may be incomplete. After implementation, a full search for all `db.contact.create`, `db.syncAccount.create`, `db.importJob.create`, `db.exportJob.create`, and `db.mergeDecision.create` calls should verify each has the correct upstream assertion.

## Outcome
All entitlement gates in Kontax enforce the four-tier feature matrix from P11-01, null limits are handled safely, downgrade transitions have defined behavior, and all assertion functions are available for Phase 12–14 features to call without additional billing wiring.
