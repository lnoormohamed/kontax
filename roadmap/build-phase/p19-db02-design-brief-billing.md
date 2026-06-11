# P19-DB02 Design Brief: Billing & Subscription UI

## Purpose

This brief gives the designer everything needed to produce high-fidelity mockups for all billing-related UI surfaces in Phase 19. The brief covers the upgrade/downgrade flows visible to the user, the billing settings section, the failed-payment and trial banners, and the downgrade confirmation modal. The Stripe-hosted checkout and portal pages are not designed here — those are Stripe's surfaces.

## Background

Phase 19 adds real Stripe billing to Kontax. Users interact with billing in three main places:
1. The pricing page (`/pricing`) — where they choose a plan
2. The settings billing section — where they see their current plan and manage it
3. In-app banners — for payment failures, trial status, and grace period warnings

The existing pricing page design is covered by the locked `11-pricing-and-upgrade.md` brief. This brief focuses on everything in settings and the banners.

The locked Kontax light palette applies: ink `#1d2823`, secondary `#5c655e`, muted `#8b938c`, hairline `#d8ddd6`, green `#17352e`, blue `#4158f4`, Geist typeface. Lucide React icons.

## Scope

### In scope

1. Settings billing section — all states
2. Failed-payment grace period banner — amber and red variants
3. Family member billing issue banner
4. Trial status display and "Add payment method" prompt
5. Downgrade confirmation modal
6. `/pricing` CTA states (Current plan, Upgrade, Switch, Downgrade)

### Out of scope

- The Stripe Checkout page (Stripe-hosted)
- The Stripe Customer Portal (Stripe-hosted)
- Email templates (Phase 20 / DB-03)
- The pricing page card layout (covered by `11-pricing-and-upgrade.md`)

---

## Design / Implementation Spec

### 1. Settings Billing Section

Location: `/settings`, within the "Plan & Billing" section.

#### 1a. Free plan

```
Plan & Billing

Free plan
──────────────────────────────────────────────────────
You're on the free plan.

Contacts:   ████████░░  423 / 500
Imports:    ██░░░░░░░░  1 / 3 this month
Sync accounts: ●○○○○  1 / 1
App passwords: ●○○○○  1 / 1

[Upgrade to Pro →]  (primary button)
```

Usage bars: same pattern as the existing settings plan section (P11-06). Green fill up to 80%, amber at 80-99%, red at 100%.

#### 1b. Pro plan (active)

```
Plan & Billing

Pro · Monthly
──────────────────────────────────────────────────────
Next billing date: July 15, 2026          £8.00/month

Contacts:   ██░░░░░░░░  423 / unlimited
Imports:    ██░░░░░░░░  Unlimited
Sync accounts: ██░░░  2 / 5
App passwords: ██░░░  2 / 5

[Manage billing →]  (secondary button → Customer Portal)
[Cancel plan]  (text link, muted, below the button)
```

"Cancel plan" opens the P19-07 downgrade confirmation modal before routing to the portal.

#### 1c. Pro plan (trialing)

```
Plan & Billing

Pro · Trial
──────────────────────────────────────────────────────
Trial ends: July 25, 2026  (14 days remaining)

You're enjoying all Pro features free during your trial.
Add a payment method before your trial ends to continue.

[Add payment method →]  (primary button → Customer Portal)
```

The "14 days remaining" text turns amber at < 5 days, red at < 2 days.

#### 1d. Pro plan (cancel scheduled)

```
Plan & Billing

Pro · Cancelling
──────────────────────────────────────────────────────
Your plan ends on July 15, 2026.
After that, you'll move to the Free plan.

[Keep my plan]  (primary button → Customer Portal to reactivate)
```

#### 1e. Family plan (owner)

```
Plan & Billing

Family · Monthly
──────────────────────────────────────────────────────
Next billing date: July 15, 2026          £16.00/month

Members: ●●●○○○  3 / 6 slots used
[Invite a member]  (text link)

[Manage billing →]  [Cancel plan]
```

#### 1f. GRACE / payment failed state

```
Plan & Billing

Pro · Payment failed
──────────────────────────────────────────────────────
⚠  Your last payment failed. Update your payment
   method by July 18, 2026 to keep your Pro features.

[Update payment method →]  (primary, red variant)
```

---

### 2. Grace Period Banners

Pinned below the top navigation bar, above page content. Not dismissable.

#### 2a. Owner — standard grace (>24 hours remaining)

Background: amber-50, left border: 4px amber-500.
```
⚠  Payment failed. Update your payment method to keep your plan.
[Update payment method →]
```

Icon: `AlertTriangle` (Lucide, 16px, amber-600). Text: 14px `#1d2823`. CTA: text link, blue-600.

#### 2b. Owner — critical grace (<24 hours remaining)

Background: red-50, left border: 4px red-600.
```
🔴  Your plan expires soon. Update now to avoid losing sync and activity log access.
[Update payment method →]
```

Icon: `AlertCircle` (Lucide, 16px, red-600).

#### 2c. Family member — owner payment issue

Background: amber-50, left border: 4px amber-500.
```
⚠  Your family plan has a billing issue. The plan owner needs to update their payment method.
```

No CTA — member cannot fix the owner's payment.

#### 2d. Trial ending (<5 days)

Background: blue-50, left border: 4px blue-500.
```
ℹ  Your Pro trial ends in N days. Add a payment method to continue.
[Add payment method →]
```

---

### 3. Downgrade Confirmation Modal

400px max-width modal.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Downgrade to Free?                                                         │
│                                                                             │
│  Here's what will change when your current period ends:                    │
│                                                                             │
│  [icon] ⚠  2 sync connections will be paused                              │
│  [icon] ⚠  1 live-synced contact will become a static copy                │
│  [icon] ℹ  Activity log access will be hidden (not deleted)               │
│  [icon] ℹ  Imports limited to 3 per month                                 │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  ℹ  Your 847 contacts are safe. You just can't add new ones  │          │
│  │     above the 500 limit. Upgrade anytime to restore access.  │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                             │
│  [Keep my plan]          [Manage billing →]                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

Warning rows: `AlertTriangle` (16px, amber-500) for ⚠; `Info` (16px, blue-400) for ℹ.
"Keep my plan": secondary button. "Manage billing →": primary button.

**Family group dissolution variant** — adds a red-tinted block above the standard list:
```
  ┌──────────────────────────────────────────────────────────────┐
  │  ⛔  Your family group will end. 5 members will lose group   │
  │     access and revert to Free.                               │
  └──────────────────────────────────────────────────────────────┘
```
Background: red-50, border: red-200.

---

### 4. Pricing Page CTA States

Each plan card CTA button has these states:

| User plan | Card plan | CTA label | Style |
|---|---|---|---|
| Free | Free | "Current plan" | Disabled, gray |
| Free | Pro | "Start free trial" | Primary (blue) |
| Free | Family | "Upgrade to Family" | Primary |
| Free | Teams | "Upgrade to Teams" | Primary |
| Pro | Free | "Downgrade to Free" | Destructive outline (red border) |
| Pro | Pro | "Current plan" | Disabled |
| Pro | Family | "Switch to Family" | Primary |
| Pro | Teams | "Switch to Teams" | Primary |
| Family | Free | "Downgrade to Free" | Destructive outline |
| Family | Pro | "Switch to Pro" | Secondary |
| Family | Family | "Current plan" | Disabled |
| Family | Teams | "Switch to Teams" | Primary |

"Start free trial" shows a sub-label: "Then £8/month. Cancel anytime."

---

## Acceptance Criteria

- Designer receives this brief and can produce mockups for all 6 surface groups without follow-up.
- All interactive states are specified: loading (spinner on CTA while server action runs), error (inline "Something went wrong"), success (plan updated confirmation).
- All banner variants are specified with exact colour tokens.
- The downgrade modal group-dissolution variant is distinguished from the standard variant.
- Typography, spacing, and icon choices use the locked Kontax palette and Lucide set.
