# P34C-09 — Pricing Page Billing Toggle (Monthly / Annual)

## Purpose

Add a "Monthly / Annually" segmented toggle above the plan cards on `/pricing`.
When "Annually" is selected, prices update to show the per-month equivalent of
the annual price and a "Save X%" badge. Encourages annual signups, which reduce
churn and improve cash flow.

## Background

The plan cards from P34C-08 show monthly prices by default. Many SaaS products
offer a discount for annual commitment. The toggle is a client-side interaction
(no server needed) that swaps displayed prices based on the `annualPrice` field
already in `pricing-data.ts`.

This ticket depends on P34C-08 being complete (the plan card component and
`pricing-data.ts` must exist).

## Scope

**In scope**
- `<BillingToggle>` client component in
  `src/app/(marketing)/pricing/billing-toggle.tsx`.
- Integration into `pricing/page.tsx` above the plan card grid.
- Price display in the plan cards updates based on toggle state.
- Annual savings badge ("Save 20%") per plan.

**Out of scope**
- Actually initiating an annual Stripe subscription (that is the billing flow
  in the authenticated app, not the marketing page).
- Persisting the toggle state across sessions.
- The feature matrix or FAQ (P34C-10 / P34C-11).

## Design / Implementation Spec

### How prices update

From `pricing-data.ts`:
- `monthlyPrice`: the monthly price (e.g. £5).
- `annualPrice`: the total annual price (e.g. £48).
- Per-month annual display: `(annualPrice / 12).toFixed(0)` → "£4/mo" (rounded).
- Savings percent: `Math.round((1 - (annualPrice / 12) / monthlyPrice) * 100)` → 20%.

The `PLANS` constant does not change — the toggle state is a React prop passed
down from the `<BillingToggle>` island.

### Client component architecture

The `/pricing` page is a server component. The toggle and price-switching are
a self-contained client island:

```tsx
// billing-toggle.tsx
"use client";

import { useState } from "react";
import { PLANS } from "./pricing-data";

export function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <>
      <BillingToggle annual={annual} onChange={setAnnual} />
      <PlanCardGrid plans={PLANS} annual={annual} />
    </>
  );
}
```

The server component `pricing/page.tsx` renders the page hero and then
`<PricingSection />` (the client island). The feature matrix and FAQ below the
cards are separate server-rendered sections.

### Toggle UI

```
      ┌────────────────────────────────┐
      │  Monthly    │    Annually      │
      └────────────────────────────────┘
         (active: bg-[#17352e] text-white, inactive: text-[#5c655e])
      Pill shape: rounded-[10px], border border-[#d8ddd6], bg-[#f4f6f2]
      Active segment: absolute rounded-[8px] bg-[#17352e] text-white
      Width: w-fit, mx-auto
```

```tsx
function BillingToggle({ annual, onChange }) {
  return (
    <div className="flex justify-center mb-10">
      <div className="relative flex bg-[#f4f6f2] border border-[#d8ddd6]
                      rounded-[12px] p-1 gap-1">
        {["Monthly", "Annually"].map((label, i) => {
          const isActive = annual === (i === 1);
          return (
            <button
              key={label}
              onClick={() => onChange(i === 1)}
              className={`relative z-10 px-6 py-2 rounded-[9px] text-[15px]
                          font-medium transition-colors
                          ${isActive
                            ? "bg-[#17352e] text-white shadow-sm"
                            : "text-[#5c655e] hover:text-[#1d2823]"}`}
            >
              {label}
              {i === 1 && (
                <span className="ml-2 text-[11px] font-bold bg-[#4158f4]
                                 text-white rounded-full px-2 py-0.5">
                  Save up to 20%
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

### Price display in plan cards

When `annual` is `true`:
- Show `£{(plan.annualPrice / 12).toFixed(0)}/mo` in the price slot.
- Show sub-label: "billed annually · save {savings}%".
- Show a green `Save {savings}%` badge inline with the price.

When `annual` is `false`:
- Show `£{plan.monthlyPrice}/mo` (or "Free").
- Sub-label: "billed monthly".
- No savings badge.

```tsx
function PlanPrice({ plan, annual }: { plan: Plan; annual: boolean }) {
  if (!plan.monthlyPrice) return <span className="text-[40px] font-bold text-[#17352e]">Free</span>;

  const price = annual
    ? Math.round(plan.annualPrice! / 12)
    : plan.monthlyPrice;
  const savings = annual
    ? Math.round((1 - price / plan.monthlyPrice) * 100)
    : 0;

  return (
    <div className="flex items-end gap-2">
      <span className="text-[40px] font-bold text-[#17352e]">£{price}</span>
      <span className="text-[15px] text-[#8b938c] mb-2">/mo</span>
      {annual && savings > 0 && (
        <span className="mb-2 text-[11px] font-bold bg-[#eef5ef] text-[#17352e]
                         rounded-full px-2 py-0.5">
          Save {savings}%
        </span>
      )}
    </div>
  );
}
```

### Animation

No animation required. The price text simply changes on toggle. If an animation
is later desired, a simple `transition-opacity` fade is acceptable — no number-
counter animation that increases page complexity.

## Acceptance Criteria

- [ ] "Monthly" / "Annually" toggle renders above the plan cards.
- [ ] Toggling to "Annually" updates all four plan card prices to the
      per-month annual equivalent.
- [ ] A "Save X%" badge appears on the Pro, Family, and Teams cards when
      "Annually" is selected.
- [ ] Free plan shows "Free" and is unaffected by the toggle.
- [ ] Sub-label changes to "billed annually" / "billed monthly" correctly.
- [ ] Toggle state is reset to "Monthly" on page refresh (no persistence).
- [ ] The rest of the pricing page (matrix, FAQ, nav, footer) remains a server
      component and is not wrapped in the client island.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Annual price accuracy**: `annualPrice` in `pricing-data.ts` must reflect
  the actual Stripe annual plan price. The "Save X%" badge is computed from
  these values — if Stripe has a different discount, the displayed saving will
  be wrong. Verify as part of P34C-08's Stripe verification step.
- **Segmented control pattern**: use the same implementation pattern as the
  existing segmented controls in the app UI (e.g., the tab bar) to maintain
  consistency. If a shared `<SegmentedControl>` component exists, use it.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: document the billing toggle as a client
      island pattern for the (marketing) server component pages
