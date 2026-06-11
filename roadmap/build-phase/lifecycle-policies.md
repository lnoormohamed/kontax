# Account & Plan Lifecycle Policies

> **Status: AUTHORITATIVE REFERENCE.** This document is the canonical source of truth for all account lifecycle, subscription, and group dissolution decisions. It extends and fills the gaps in `p11-01-plan-feature-matrix.md` (which remains frozen for entitlement values). Where this document and p11-01 conflict, this document takes precedence — file a revision notice if a conflict is found.
>
> **Implementation hooks are noted per section.** Phases that implement these policies must not deviate from the decisions here. If a scenario arises during implementation that this document does not cover, pause and get a decision recorded here before writing code.

---

## 1. Subscription Cancellation

### 1a. Cancel at end of billing period (standard cancellation)

When a user clicks "Cancel plan" and chooses to cancel at period end (`cancelAtPeriodEnd = true` in Stripe):

- All current plan features remain **fully active** until `Subscription.currentPeriodEnd`.
- At `currentPeriodEnd`, Stripe fires `customer.subscription.deleted`. The Phase 19 webhook handler sets `User.lifecycleState = ACTIVE` and `Subscription.plan = FREE` (the user does not become LOCKED; they simply revert to Free).
- Downgrade enforcement kicks in immediately at that point — sync accounts over the Free limit are paused, contacts remain (read-only if over 500), activity log feed is gated.
- **For Family plans specifically:** a 7-day dissolution warning is sent to all group members **at the time the owner confirms cancellation** — not at `currentPeriodEnd`. This gives members advance notice before their access actually ends. Members see an in-app banner: "Your family group will end on [date]. You can export the shared address book until then."
- **For Teams plans specifically:** a 30-day read-only grace period starts at `currentPeriodEnd` (not at cancellation confirmation). During grace: all team address books become read-only. The owner can export all books. After grace, books are archived.
- Export access is always available regardless of plan state. A user on a cancelled plan can still export their contacts. This is a portability guarantee.

**Implementation owners:** Phase 19 (Stripe webhook), Phase 13 (Family dissolution notice), Phase 14 (Teams grace period).

---

### 1b. Immediate cancellation (triggered by account deletion — P18-09)

When a user with an active paid subscription initiates account deletion:

- The Stripe subscription is cancelled **immediately** (not at period end). No proration or refund is issued in v1; document this in the cancellation confirmation UI.
- Group dissolution (if applicable) follows the account-deletion group policy in Section 3 below.
- `Subscription.status` is set to CANCELED; `Subscription.canceledAt` is set to now.

**Implementation owner:** Phase 19 stub in P18-09, retrofitted in Phase 19.

---

### 1c. Trial end without conversion

When `Subscription.trialEndsAt` passes and no payment method has been added:

- Stripe marks the subscription as `INCOMPLETE` or cancels it, depending on configuration.
- The webhook handler sets `Subscription.plan = FREE`, `User.lifecycleState = ACTIVE`.
- No grace period — the trial was the grace period.
- No group dissolution notice (trial users should not be able to create Family/Teams groups until a payment method is on file — enforce this at group creation time in Phases 13/14).

---

## 2. Payment Failure

### 2a. First payment failure

When Stripe fires `invoice.payment_failed`:

- `User.lifecycleState` is set to `GRACE`.
- A payment-failure banner is shown across the app: "Your payment failed. Please update your payment method to keep your plan. [Update now →]"
- For Family plan owners: all group members see a different banner: "Your family plan has a billing issue. The plan owner needs to update their payment method."
- Full functionality is maintained during the grace period. No feature gates change.
- An email is sent to the account owner (using the SES template from Phase 20, or a console log in dev).
- Stripe automatically retries payment. The retry schedule follows Stripe's default dunning configuration (typically: retry at 3 days, 5 days, 7 days).

### 2b. Grace period (days 1–3)

- `User.lifecycleState = GRACE`. All features remain accessible.
- The payment-failure banner persists and escalates in prominence (e.g., from amber to red after day 3).

### 2c. Subscription past due (day 3+, no resolution)

- Stripe marks the subscription `PAST_DUE`.
- `User.lifecycleState` is set to `GRACE` (still accessible — we do not lock during the retry window).
- The banner escalates.

### 2d. Subscription expired (Stripe retries exhausted, ~day 14)

Stripe fires `customer.subscription.deleted` (or `customer.subscription.updated` with status `CANCELED`):

- Treat identically to Section 1a standard cancellation — except that `cancelAtPeriodEnd` was not set by the user, so:
  - `User.lifecycleState = ACTIVE` (not LOCKED).
  - `Subscription.plan = FREE`. Downgrade enforcement kicks in immediately.
  - **No grace period is extended** — the dunning cycle was the grace period.
  - For Family plans: the 7-day dissolution member notice is sent at this point (the owner did not have a chance to give advance warning).
  - For Teams: the 30-day read-only grace starts now (same as voluntary cancellation).

### 2e. Payment resolves during grace

- Stripe fires `invoice.payment_succeeded`.
- `User.lifecycleState = ACTIVE`.
- All plan features restored immediately.
- Banner dismissed.
- Email confirmation sent: "Your payment was processed. Your plan is active."

**Implementation owners:** Phase 19 (all Stripe webhook handling), Phase 22 (notification banners).

---

## 3. Group Dissolution (Family and Teams)

### 3a. Owner cancels subscription (Family plan)

See Section 1a. Summary: 7-day member notice at cancellation time → dissolution at `currentPeriodEnd`.

**Data fate on dissolution:**
- Each member (including the owner) automatically receives a **personal `AddressBook`** containing a copy of all the shared contacts they had access to. This personal book is named after the group (e.g. "Smith Family") with `sourceGroupBookId` set to the original `GroupAddressBook.id` for re-subscription continuity. See `p18-11-personal-address-books.md` for the model.
- The personal book is **not shared** — it is immediately private to each member. Members can rename, edit, or archive it like any other personal book.
- No action is required from members — the contacts appear in their library automatically at dissolution.
- After dissolution, members' existing personal contacts (outside the shared book) are completely unaffected. They revert to Free plan entitlements.
- The `GroupAddressBook` is archived (`archivedAt` set). The `dissolvedToBookId` field on it points to the owner's personal book, preserving the link for re-subscription.

**Notifications sent:**
1. At cancellation confirmation: email + in-app to all members: "Your family plan will end on [date]. Export shared contacts before then: [Export →]"
2. At dissolution: email + in-app to all members: "Your family group has ended. Your personal contacts are unaffected."

### 3b. Owner downgrades Family → Pro

Same dissolution process as 3a. The owner's subscription is updated from FAMILY to PRO via Stripe. The 7-day member notice starts when the downgrade is confirmed (not at the next billing cycle, since the plan changes immediately on confirmation).

The owner's Pro features activate immediately. The shared address book is archived to the owner's personal library as described above.

**Members reverted to Free immediately** — they do not wait for the 7-day notice period to receive their downgrade. The notice period is only for them to export shared contacts; their personal features revert right away.

### 3c. Owner downgrades Family → Free

Same as 3b — dissolution is the same process regardless of which plan the owner downgrades to.

### 3d. Owner's account deletion (P18-09)

The owner cannot delete their account while owning an active Family or Teams group. They must resolve the group first. Two options are presented in the deletion confirmation UI:

**Option A — Dissolve the group:**
- Owner confirms dissolution in the account deletion flow.
- Immediate dissolution (no 7-day window, since the owner is leaving).
- Each member immediately receives a personal `AddressBook` copy of the shared contacts (see `p18-11-personal-address-books.md`). No export window needed — contacts land in their library at the moment of dissolution.
- All members are notified by email and in-app: "Your family group has ended. [N] shared contacts have been added to your library as '[Group Name]'."
- The owner also receives a personal book copy, though it will be deleted in 30 days alongside their account (P18-09).
- Members revert to Free immediately.

**Option B — Ownership transfer (future feature):**
- Not available in v1. The UI should say: "To keep your family group active, you'll need to cancel your account later after setting up a new group as a different owner. Contact support if you need help."
- *Rationale:* Stripe customer/subscription transfer is complex. Defer to a future phase. Document as `TODO(post-v1): ownership transfer`.

**Implementation owner:** P18-09 (owns the group resolution check), Phase 13 (owns dissolution logic).

### 3e. Teams plan: owner cancels or downgrades to Pro/Family

**Teams → Pro:**
- Pro plan has no group concept. The Teams group must be dissolved.
- 30-day read-only grace period starts immediately.
- During grace: all team address books are read-only. Members can still view and export but cannot edit.
- Owner selects ONE address book to migrate to their personal library (Pro has no groups, so this is a flat import). All other books are archived.
- If the owner does not act within 30 days, the system archives all books automatically.
- Member access is revoked immediately (Pro has no group members). Members revert to Free.
- Audit log retained: at Pro retention level (365 days for personal activity; team-level audit beyond that is archived, not deleted, and owner can export it within the 30-day window).

**Teams → Family:**
- The Teams group must be dissolved. A new Family group must be created separately.
- Family does not inherit from Teams — the member list, address books, and permissions do not carry over automatically.
- The owner receives the same 30-day read-only grace for Teams books.
- This downgrade path is unusual but valid. The UI should ask: "You're switching to a Family plan. Your Teams group and its members will lose access. Would you like to export your team address books first? [Export] [Continue to downgrade]"

### 3f. Teams plan: owner's account deletion

Same as Family (Section 3d). Owner must dissolve the group first. The 24-hour member notice applies. Teams address books are archived to the owner's personal library.

### 3g. Non-owner member voluntarily leaves a group

- The member's group access is revoked **immediately** upon confirmation.
- A personal `AddressBook` copy of the shared contacts is created in their library at the moment of departure (same mechanism as dissolution — see `p18-11-personal-address-books.md`). No export window needed.
- Their personal contacts library is completely unaffected.
- They revert to **Free plan** immediately (not Pro — they were covered by the group subscription, not their own).
- **If the member had an individual paid subscription before joining:** that subscription was cancelled when they joined (see Section 5). They cannot recover it automatically. They must re-subscribe.
- The contacts they added to the shared address book remain in the shared book. They do not leave with them.
- The remaining group members are **not notified** unless the departing member was an admin (in which case the owner is notified).

### 3h. Non-owner member removed by admin

- The member is **notified by email and in-app** at the time of removal.
- They receive a **24-hour window** to export shared contacts before losing access.
- Functionally identical to voluntary departure after the 24 hours.
- The owner and other admins see a notification: "[Member name] was removed from the group."

**Implementation owners:** Phase 13 (Family member leave/remove), Phase 14 (Teams member leave/remove).

---

## 4. Plan Downgrade — Data & Feature Fate

### 4a. Pro → Free (individual)

| Feature | Before (Pro) | After (Free) | Action |
|---|---|---|---|
| Contacts | Unlimited | 500 limit | No deletion. Over-limit contacts become read-only. User cannot create new contacts until under 500. |
| Sync accounts | Up to 5 | Up to 1 | Over-limit accounts set to PAUSED immediately. Credentials retained. User must manually reduce to 1 active. |
| App passwords | Up to 5 | Up to 1 | Over-limit passwords are NOT revoked. User cannot create new ones until they revoke down to 1. Existing connections continue to work. |
| Activity log | 365-day feed | Gated (no feed) | Feed access gated immediately. Events are physically pruned on next nightly run (P11-05). |
| Per-contact history | All events | Last 3 shown | Display cap applied at query time. Physical prune to 10 events per contact on next nightly run. |
| Advanced merge | Enabled | Disabled | Existing merge decisions unaffected. New advanced merges blocked. |
| Live shares (outbound) | Active | Converted | All active outbound live shares converted to static snapshots immediately. Recipients notified. |
| Live shares (inbound) | Active | Converted | All active inbound live shares converted to static snapshots. Senders notified. |
| Static shares | Active | Gated | Existing static shares remain accessible to recipients. Owner cannot create new static shares. |
| vCard links | No expiry | 7-day expiry | Existing no-expiry links remain as-is (grandfathered). New links get 7-day expiry. |
| Imports | Unlimited | 3/month | Limit applied immediately. Mid-month usage counts against the 3-import quota. |

### 4b. Family → Pro or Free (owner)

Beyond the Pro→Free changes above (applied to the owner's personal library):
- Group dissolution per Section 3a/3b/3c.
- All members revert to Free immediately.

### 4c. Teams → Pro (owner)

Beyond the Pro→Free changes applied to each member's personal library:
- 30-day read-only grace for team address books (Section 3e).
- After grace: all team books archived.

### 4d. Contact over-limit on downgrade: read-only behaviour

Contacts over the 500-contact Free limit are not deleted and not hidden. The user can:
- View, edit, export, and delete over-limit contacts.
- NOT create new contacts until the total drops below 500.
- NOT import contacts until the total would remain below 500 after import (pre-import count check).

The over-limit banner reads: "You have N contacts. Free accounts include 500. [Upgrade to Pro] or delete N to stay on Free."

### 4e. Sync accounts over-limit: paused behaviour

Over-limit sync accounts are set to `SyncAccountStatus.PAUSED` immediately on downgrade. The user sees: "This sync connection has been paused because your plan changed. [Upgrade to Pro] or [Delete this connection]."

No automatic deletion. Credentials and sync link data are retained. Reactivation on upgrade is instant.

### 4f. Live share conversion on downgrade

The conversion from `LIVE_SYNC` to `STATIC_COPY` is **immediate** — it happens in the downgrade webhook handler (Phase 19), not the next time the live sync job runs.

Both the share owner and the recipient receive:
- In-app notification: "A live-synced contact has been converted to a static copy because [owner's/your] plan changed."
- Email (if configured in Phase 20).

The converted share retains the most recent snapshot as the static copy. No data is lost; the contact simply stops receiving automatic updates.

---

## 5. Member Joins Group with Existing Paid Subscription

When a user with an active individual Pro subscription accepts a Family or Teams group invite:

- Their individual subscription is **cancelled at the end of their current billing period** (not immediately). `cancelAtPeriodEnd = true` is set on their Stripe subscription.
- Until their current period ends, they hold both their individual Pro entitlements and the group entitlements. If there is any conflict, the more generous entitlement applies.
- When their individual subscription expires, they transition fully to group membership (entitlements derived from the group owner's subscription).
- **Notification to the joining member at invite acceptance:** "Your individual Pro subscription will be cancelled on [date]. After that date, your account features will be covered by the family plan you're joining."
- **Notification to the group owner:** "[Member name] has joined. Their individual Pro subscription is active until [date]."
- If the member leaves the group before their individual subscription expires: their individual subscription is **reinstated** (cancelled → active again via Stripe). If it has already expired: they are on Free. They must re-subscribe.

**Implementation owner:** Phase 13/14 (invite acceptance flow), Phase 19 (Stripe subscription management).

---

## 6. Re-subscription After Cancellation

When a user who previously had a paid plan returns to Kontax and re-subscribes:

- A new Stripe subscription is created (same Stripe customer, new subscription).
- Their `User.lifecycleState` is set to `ACTIVE`.
- Their `Subscription.plan` is updated to the new plan.
- **Data that was archived (not deleted) during their Free period is restored** — archived contacts become active again when they upgrade. This is automatic if contacts were only archived by the downgrade (i.e. `archivedAt` was set by the system, not by the user). User-archived contacts remain archived. Differentiate these in the schema by adding an `archiveReason` field if needed (deferred to Phase 19 implementation).
- Over-limit sync accounts that were PAUSED are **not automatically reactivated** — the user must manually reactivate them. This prevents surprise syncs after a long absence.
- The activity log grace is lifted. Events beyond the retention window that were pruned during the Free period are gone permanently. Only future events accumulate from this point.

---

## 7. Account Locked State (Non-Payment or Admin Action)

`User.lifecycleState = LOCKED` can be set by:
- Admin action (Phase 21)
- Payment failure after the dunning cycle expires — **except this is currently handled as a Free downgrade (Section 2d), not a LOCKED state.** LOCKED is reserved for admin-initiated suspensions.

When an account is LOCKED:

- The user cannot sign in (NextAuth `authorize` must check `lifecycleState !== 'LOCKED'` and return null).
- All data is retained.
- If the account is part of a Family/Teams group: treated identically to the owner being suspended. Group members are not affected unless the locked user is the owner (in which case: see Section 3).
- Unlocking is admin-only (Phase 21).
- The user receives an email: "Your Kontax account has been suspended. [Contact support]."

**Note:** The `scheduledDeleteAt` flow from P18-09 also uses `LOCKED` to signal scheduled deletion. These two cases must be distinguishable — add `lockReason` to the data model (see below).

### Schema addition

Add to the `User` model:

```prisma
lockReason String? // "ADMIN_SUSPENSION" | "SCHEDULED_DELETION" | null
```

This allows the login flow and admin UI to display the correct message and offer the correct resolution path.

---

## 8. Notification Summary

All of the following trigger a notification (in-app + email when SES is configured in Phase 20):

| Event | Who is notified | Channel |
|---|---|---|
| Subscription cancelled (at period end) | Owner | Email + in-app |
| Family group dissolution warning (7 days) | All members | Email + in-app |
| Family group dissolved | All members | Email + in-app |
| Member removed from group | Removed member | Email + in-app |
| Member leaves group (voluntary) | Owner (if member was admin) | In-app only |
| Payment failure (first) | Owner + family members (banner) | Email (owner) + in-app banner |
| Payment resolved | Owner | Email |
| Live share converted to static | Both parties | Email + in-app |
| Subscription changed (upgrade or downgrade) | Owner | Email |
| Account locked by admin | Account owner | Email |
| Account deletion scheduled (30-day window) | Account owner | Email |
| Account deletion cancelled | Account owner | In-app |

Phase 22 (notification settings) allows users to opt out of non-security notifications. Security alerts (account locked, payment failure, account deletion) are always sent and cannot be opted out of.

---

## 9. Implementation Checklist by Phase

This table maps each policy section to the phase responsible for implementing it. A phase must not close without addressing its listed policies.

| Policy | Phase | Ticket |
|---|---|---|
| Cancel at period end → Free downgrade | 19 | Stripe webhook handler |
| Trial end → Free | 19 | Stripe webhook handler |
| Payment failure → GRACE → PAST_DUE → FREE | 19 | Stripe webhook handler |
| Live share conversion on downgrade | 19 | Stripe webhook handler + P12-04 propagation |
| Sync account pause on downgrade | 19 | Stripe webhook handler |
| Pro → Free data/feature fate | 19 | Stripe webhook handler |
| Contacts over-limit read-only behaviour | 19 | Entitlement enforcement |
| Re-subscription data restoration | 19 | Stripe webhook handler |
| Account LOCKED state + lockReason field | 18 (P18-09 schema), 21 (admin action) | P18-09 schema, P21-05 |
| Account deletion + group dissolution | 18 | P18-09 |
| Family group dissolution (all triggers) | 13 | P13-06 (group management) |
| Family member voluntary leave | 13 | P13-02/P13-06 |
| Family member removed by admin | 13 | P13-06 |
| Member joins with existing paid sub | 13 | P13-02 (invite acceptance) |
| Teams → Pro dissolution + grace | 14 | P14-07 |
| Teams member leave/remove | 14 | P14-07 |
| All group dissolution notifications | 20 | Email templates + Phase 22 notification system |
| Payment failure banner (in-app) | 22 | Notification settings |

---

## 10. Open Questions (must be resolved before the relevant phase ships)

1. **Grandfathered vCard links on Pro→Free:** Existing Pro-created no-expiry links — do they expire retroactively on downgrade (7-day window from downgrade date) or are they grandfathered permanently? **Recommended decision: grandfathered for 30 days, then expire.** Strikes a balance between not surprising users mid-campaign and not giving free users a permanent no-expiry link. Confirm before Phase 19 ships.

2. **`archiveReason` for system-archived contacts on downgrade:** When contacts are archived because a user hit the Free 500-contact limit, a re-subscriber's contacts should auto-unarchive. User-archived contacts should not. This requires distinguishing the two at archive time. If not added now, re-subscription will require the user to manually unarchive. **Recommended decision: add `archiveReason String?` to `Contact` (values: `USER`, `SYSTEM_DOWNGRADE`, `MERGE`).** Confirm before Phase 19 ships.

3. **App password behaviour on downgrade when over limit:** Current decision is "existing passwords continue to work; user cannot create new ones." An argument exists that over-limit app passwords should be revoked on downgrade to prevent unlimited active device connections on a Free plan. **Recommended decision: keep existing behaviour (no revocation) for user trust, but surface a warning in the settings UI.** Confirm before Phase 19 ships.

4. **Teams audit log on Teams→Pro:** The 365-day Pro retention window would prune most of the Teams unlimited audit log. The policy above says the owner can export during the 30-day grace. After that, the retention job prunes to Pro retention. Is this acceptable or should Teams audit logs be exempt from pruning for accounts that were previously on Teams? **Recommended decision: prune to Pro retention after grace — the data was accessible for export.** Confirm before Phase 14 ships.

5. **Ownership transfer (deferred from v1):** The inability to transfer Family/Teams group ownership without dissolving is a UX gap for long-running groups. Add to the post-v1 backlog with a `TODO` in P18-09 and Phase 13. The technical approach: Stripe customer update + group owner field update + Subscription re-association.
