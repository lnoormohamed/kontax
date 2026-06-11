# P19-06 — Failed-Payment Banner & Grace Period

## Purpose

When a payment fails, users need a clear, urgent prompt to update their payment method before losing access to paid features. This ticket implements the in-app banner that appears when `User.lifecycleState = GRACE`, the grace period logic (3 days), and the banner's escalation behaviour as the deadline approaches.

## Background

P19-04 sets `lifecycleState = GRACE` when Stripe fires `invoice.payment_failed`. The grace period end date is stored in `Subscription.graceEndsAt`. This ticket reads that state and renders the appropriate UI.

## Scope

**In scope:**
- Grace period banner component — shown across the app when `lifecycleState = GRACE`
- Banner escalation: amber → red as `graceEndsAt` approaches
- "Update payment method" CTA — links to Customer Portal (P19-05)
- For Family plan owners: a different banner for group members (shown when owner's payment fails)
- Grace period expiry: after `graceEndsAt`, the next Stripe webhook fires `customer.subscription.deleted` → P19-04 downgrades to Free. No additional logic needed here — the webhook handles the actual downgrade.

**Out of scope:**
- The webhook handler that sets GRACE (P19-04)
- Email notifications for payment failure (Phase 20 / P20-08)

---

## Design / Implementation Spec

### Banner component

`src/app/_components/billing-grace-banner.tsx` — a server component that reads `User.lifecycleState` and `Subscription.graceEndsAt` from the session/DB and renders the appropriate banner.

**States:**

**State 1 — Grace period active (more than 24 hours remaining):**
```
┌──────────────────────────────────────────────────────────────────────────┐
│  ⚠  Your payment failed. Update your payment method to keep your plan.  │
│     [Update payment method →]                                            │
└──────────────────────────────────────────────────────────────────────────┘
```
Background: amber-50, border-left: 4px amber-500.

**State 2 — Grace period critical (less than 24 hours remaining):**
```
┌──────────────────────────────────────────────────────────────────────────┐
│  🔴  Your plan expires in less than 24 hours. Update now to avoid losing │
│      your contacts sync and activity log access.                         │
│      [Update payment method →]                                           │
└──────────────────────────────────────────────────────────────────────────┘
```
Background: red-50, border-left: 4px red-500.

**Family member banner** (shown to group members when the owner's payment fails):
```
┌──────────────────────────────────────────────────────────────────────────┐
│  ⚠  Your family plan has a billing issue. The plan owner needs to update │
│     their payment method to keep the group active.                       │
└──────────────────────────────────────────────────────────────────────────┘
```
No CTA for members — they cannot fix the owner's payment.

### Placement

The banner is rendered in the app layout shell, pinned below the top navigation bar, above the main content area. It is sticky — it scrolls with the user rather than disappearing on scroll.

### Banner visibility logic

Read from the server session:
- If `lifecycleState === 'GRACE'`: show the owner banner (variant based on `graceEndsAt`)
- If user is a Family/Teams group member and the group owner's `lifecycleState === 'GRACE'`: show the member banner

The group owner check requires a DB query: `GroupMember.userId = session.user.id AND inviteStatus = 'ACCEPTED'` → `Group.owner.lifecycleState`. Cache this for 5 minutes per session to avoid a DB query on every page load.

### "Update payment method" CTA

Clicking this button calls `createPortalSession()` (P19-05) and redirects to the Stripe portal. Show a loading spinner on the button while the server action runs.

---

## Acceptance Criteria

- The grace period banner appears across all app pages when `lifecycleState = GRACE`.
- The banner uses amber styling when more than 24 hours remain; red styling when less than 24 hours remain.
- Family/Teams group members see a member-specific banner when the group owner is in GRACE.
- The "Update payment method" CTA links to the Stripe Customer Portal.
- The banner disappears immediately after `invoice.payment_succeeded` fires (webhook sets `lifecycleState = ACTIVE`).
- The banner is not shown on the `/login`, `/register`, or public pages.

---

## Risks and Open Questions

- **Group member grace detection:** querying the group owner's lifecycle state on every page load adds a DB query. The 5-minute cache mitigates this. An alternative is to store a `groupBillingStatus` field on `GroupMember` that the webhook updates — deferred to a later optimisation.
- **Clock drift on 24-hour check:** `graceEndsAt` is set server-side. The "less than 24 hours" check is also server-side (in the layout data fetch). No client-side countdown is needed — the banner state is static per page load.
