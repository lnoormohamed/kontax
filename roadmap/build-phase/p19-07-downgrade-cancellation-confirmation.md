# P19-07 — Downgrade & Cancellation Confirmation Flow

## Purpose

Before a user downgrades or cancels their plan, Kontax must show them exactly what will change — which features they'll lose, what happens to their data, and what the timeline is. This is both a user-trust and a retention mechanism. A user who understands the consequences and proceeds is making an informed choice; one who discovers the consequences after the fact will raise a chargeback or support ticket. This ticket implements the confirmation flow that appears before the user is sent to the Stripe Customer Portal.

## Background

The Stripe Customer Portal (P19-05) handles the mechanics of changing or cancelling a subscription. This ticket is the Kontax-native gate *before* the portal — it shows a downgrade warning specific to the user's current data and plan, requires explicit confirmation, then routes to the portal.

The affected-features list is derived from `lifecycle-policies.md` Section 4 (downgrade data fate) and the user's current usage (contacts used, sync accounts connected, live shares active, group membership).

## Scope

**In scope:**
- `getDowngradeSummary(userId, targetPlan)` server action — computes what will change
- Downgrade confirmation modal — shown when a user clicks "Cancel plan" or "Change plan" for a lower tier
- Dynamic affected-features list based on the user's actual usage
- "Confirm and manage billing" CTA — dismisses the modal and opens the Customer Portal

**Out of scope:**
- The portal itself (P19-05)
- Upgrade confirmation (no warning needed for upgrades)
- Admin-triggered plan overrides (Phase 21)

---

## Design / Implementation Spec

### `getDowngradeSummary`

```typescript
interface DowngradeSummary {
  fromPlan: SubscriptionPlan;
  toPlan: SubscriptionPlan;
  consequences: DowngradeConsequence[];
  groupWillDissolve: boolean;
  syncAccountsToBeDisabled: number;
  liveShareCount: number;
  contactsOverLimit: number; // contacts above the target plan's limit
}

interface DowngradeConsequence {
  feature: string;
  detail: string;
  severity: "warning" | "info";
}
```

Steps:
1. Fetch user's current contacts count, sync account count, active live shares, group membership.
2. Compare against target plan's entitlements (from `PLAN_DEFAULTS` in `billing.ts`).
3. Build the `consequences` array with relevant entries.

Example consequence entries for Pro → Free:

| Feature | Detail | Severity |
|---|---|---|
| Activity log | "Your activity history will be hidden (not deleted). Upgrading restores it." | info |
| Sync accounts | "N of your N sync connections will be paused." | warning |
| Live shares | "N live-synced contacts will be converted to static snapshots." | warning |
| Contact limit | "You have N contacts. Free accounts include 500. Contacts over the limit are read-only." | warning |
| Import limit | "Unlimited imports → 3 per month." | info |

For Family → Pro:

| Feature | Detail | Severity |
|---|---|---|
| Family group | "Your family group will end. Members will revert to Free and receive a copy of shared contacts." | warning |
| Shared address book | "The shared address book will be archived and copied to your personal library." | warning |

### Confirmation modal

Triggered when a paid user clicks "Cancel plan" or selects a lower plan tier in settings or pricing page.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Downgrade to Free?                                                         │
│                                                                             │
│  Here's what will change:                                                   │
│                                                                             │
│  ⚠  2 of your 3 sync connections will be paused                            │
│  ⚠  1 live-synced contact will be converted to a static copy               │
│  ℹ  Your activity log will be hidden (not deleted)                         │
│  ℹ  Imports are limited to 3 per month                                     │
│                                                                             │
│  Your contacts (847) are over the Free limit (500).                        │
│  You can still view all contacts — you just can't add new ones until       │
│  you reduce to 500.                                                         │
│                                                                             │
│  ℹ  No contacts are deleted. You can upgrade at any time to restore        │
│     full access.                                                            │
│                                                                             │
│  [Cancel]          [I understand — manage billing →]                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

"I understand — manage billing →" calls `createPortalSession()` and redirects to Stripe.

If `groupWillDissolve = true`, the modal shows an elevated warning:

```
  ⛔  Your family group will end. Your 5 family members will lose group
      access and revert to Free.
```

### Placement

The confirmation modal is triggered from:
1. Settings billing section — "Cancel plan" link
2. Pricing page — "Downgrade to Free" option (if user is on a paid plan and clicks Free)

For upgrades (Free → paid, or Pro → Family/Teams), no confirmation modal — route directly to Stripe Checkout.

---

## Acceptance Criteria

- `getDowngradeSummary` returns accurate affected-features based on the user's live usage.
- The confirmation modal appears before the user is sent to the Stripe portal for a downgrade or cancellation.
- Sync account pausing, live share count, contacts over limit, and group dissolution are all surfaced if applicable.
- The modal explicitly states that no contacts are deleted on downgrade.
- Clicking "I understand" opens the Stripe Customer Portal.
- No modal appears for upgrades — users are routed directly to checkout.

---

## Risks and Open Questions

- **Stale data:** `getDowngradeSummary` queries live usage at the time the user opens the modal. If they have tabs open modifying data, counts could be stale. This is acceptable — the consequences are computed dynamically and the actual enforcement happens in the webhook handler.
- **User dismisses and then cancels via portal:** the user could close the modal without clicking "I understand" and then navigate directly to the portal URL. This is fine — the modal is informational, not a true gate. The data-fate logic in P19-04 runs regardless of whether the user saw the modal.
