# P19-08 — Pricing Page Rebuild

## Purpose

The existing pricing page (`pricing-comparison.tsx`) displays plan tiers but upgrade CTAs are not wired to Stripe. This ticket connects the pricing page to real Stripe price IDs and routes upgrade actions through the checkout flow (P19-02). It also adds a monthly/annual billing toggle that affects the price displayed and the price ID sent to checkout.

## Background

The existing component renders Free/Pro/Family/Teams plan cards. The design brief `11-pricing-and-upgrade.md` (from Phase 11, P11-04) is the locked design reference. This ticket implements against that brief, replacing placeholder CTAs with real actions.

## Scope

**In scope:**
- Monthly/annual billing toggle — switches displayed prices and routes to yearly price IDs
- Upgrade CTAs wired to `createCheckoutSession` (P19-02)
- "Manage subscription" CTA for existing paid users → Customer Portal (P19-05)
- Current plan highlight — user's active plan card is visually marked "Current plan"
- Downgrade flow: clicking a lower plan shows the confirmation modal (P19-07) before routing to portal
- Price display — monthly prices shown by default; yearly prices with per-month breakdown and "Save X%" badge

**Out of scope:**
- The checkout session itself (P19-02)
- The design of individual plan cards beyond wiring the CTAs

---

## Design / Implementation Spec

### Page data

`/pricing` is a server component. It reads:
- `session.user.plan` — to determine the user's current plan and highlight it
- `session.user.lifecycleState` — to suppress upgrade CTAs for LOCKED accounts

If unauthenticated, all CTAs route to `/register` with a `?plan=pro&interval=monthly` query param that pre-selects a plan in the register flow.

### Billing interval toggle

```tsx
const [interval, setInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

// Display price based on interval
const displayPrice = interval === "YEARLY" ? yearlyPrice / 12 : monthlyPrice;
const savingsPercent = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);
```

The toggle is a client component (needs state). The rest of the pricing page can be server-rendered around it.

### CTA logic per plan card

```typescript
function getPricingCTA(
  cardPlan: SubscriptionPlan,
  userPlan: SubscriptionPlan,
  interval: SubscriptionInterval,
) {
  if (cardPlan === userPlan) {
    return { label: "Current plan", disabled: true };
  }
  if (cardPlan === "FREE") {
    if (planRank(userPlan) > 0) {
      return { label: "Downgrade to Free", action: "downgrade_confirm" };
    }
    return { label: "Get started free", action: "register" };
  }
  if (planRank(cardPlan) > planRank(userPlan)) {
    if (userPlan === "FREE") {
      return { label: `Upgrade to ${planLabel(cardPlan)}`, action: "checkout" };
    }
    return { label: `Switch to ${planLabel(cardPlan)}`, action: "portal" };
  }
  return { label: `Switch to ${planLabel(cardPlan)}`, action: "downgrade_confirm" };
}
```

- `checkout` → `createCheckoutSession({ plan: cardPlan, interval })`
- `portal` → `createPortalSession()`
- `downgrade_confirm` → show the P19-07 confirmation modal, then portal
- `register` → `/register?plan=cardPlan&interval=interval`

### Annual savings badge

On the yearly toggle, each paid plan card shows a green badge: "Save 20%" (or the actual savings percentage configured via env).

---

## Acceptance Criteria

- Clicking "Upgrade to Pro" on the pricing page initiates a Stripe Checkout session for the correct plan and interval.
- The user's current plan card is visually marked "Current plan" with a disabled CTA.
- The monthly/annual toggle updates displayed prices and routes to the correct yearly price IDs.
- Clicking a lower-tier CTA shows the P19-07 downgrade confirmation modal before routing to the portal.
- Unauthenticated users clicking any paid CTA are routed to `/register` with the plan pre-selected.
- Annual pricing shows a "Save X%" badge derived from the actual monthly vs. yearly price difference.

---

## Risks and Open Questions

- **Pricing numbers:** actual monthly and yearly prices are not in the codebase — they are in Stripe's dashboard. Display them as env vars: `NEXT_PUBLIC_PRICE_PRO_MONTHLY_DISPLAY="£8"`, etc. The actual Stripe price IDs are kept server-side; only the display strings are public.
- **Teams "Contact sales":** the design brief (P11-04) shows Teams with a "Contact sales" CTA rather than a direct checkout. For v1, wire Teams to checkout like the other plans. The "Contact sales" path can be added post-launch when there is a sales process to route to.
