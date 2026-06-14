# P34C-08 — /pricing Page Rebuild

## Purpose

Rebuild the `/pricing` page with updated plan cards that reflect the current
feature set and match the live Stripe configuration exactly. The pricing page
is a direct revenue driver — stale plan information or a mismatch with Stripe
erodes trust at the most critical conversion moment.

## Background

The existing pricing page was written against an earlier feature set. Phases
31B (labels), 33 (search), and 29 (API) added capabilities that are not
reflected. Plan limits (contact caps, sync account limits) must be verified
against Stripe before shipping — Stripe is the source of truth.

P34C-DB02 specifies the visual design. P34C-09 adds the billing toggle.
P34C-10 adds the feature matrix below the cards. This ticket covers the plan
cards only.

## Scope

**In scope**
- `src/app/(marketing)/pricing/page.tsx` (create or rebuild).
- Four plan cards: Free, Pro, Family, Teams.
- Feature list per card (from the data constant below).
- CTA buttons per plan.
- `<MarketingNav>` and `<MarketingFooter>` via the shared layout.
- A `src/app/(marketing)/pricing/pricing-data.ts` constants file so plan data
  is updated in one place (consumed by the cards in P34C-08, the matrix in
  P34C-10, and the toggle in P34C-09).

**Out of scope**
- Billing toggle (P34C-09).
- Feature comparison matrix (P34C-10).
- FAQ section (P34C-11).
- Stripe price ID or checkout session creation (that lives in the app's billing
  flow, not the marketing page).

## Design / Implementation Spec

### Plan data constant

Define in `src/app/(marketing)/pricing/pricing-data.ts`:

```ts
export type Plan = {
  id: "free" | "pro" | "family" | "teams";
  name: string;
  monthlyPrice: number | null;   // null = free
  annualPrice: number | null;    // null = free; annual total
  currency: "GBP";
  recommended: boolean;
  ctaLabel: string;
  ctaHref: string;
  tagline: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: null,
    annualPrice: null,
    currency: "GBP",
    recommended: false,
    ctaLabel: "Get started free",
    ctaHref: "/register",
    tagline: "For personal use",
    features: [
      "Up to 100 contacts",
      "Labels and advanced search",
      "1 CardDAV sync account",
      "Public contact card (/u/username)",
      "Data export (GDPR)",
      "30 days activity history",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 5,         // TODO: verify against Stripe
    annualPrice: 48,         // TODO: verify against Stripe
    currency: "GBP",
    recommended: false,
    ctaLabel: "Start Pro",
    ctaHref: "/register?plan=pro",
    tagline: "For power users",
    features: [
      "Unlimited contacts",
      "Labels and advanced search",
      "Unlimited CardDAV sync accounts",
      "Google Contacts & Outlook sync",
      "Contact sharing links",
      "Public contact card",
      "Developer REST API",
      "Unlimited activity history",
      "Data export (GDPR)",
      "Email support",
    ],
  },
  {
    id: "family",
    name: "Family",
    monthlyPrice: 8,         // TODO: verify against Stripe
    annualPrice: 76,         // TODO: verify against Stripe
    currency: "GBP",
    recommended: true,
    ctaLabel: "Start Family",
    ctaHref: "/register?plan=family",
    tagline: "For households",
    features: [
      "Everything in Pro",
      "Family shared address book",
      "Up to 6 family members",
      "Real-time shared edits",
      "Priority email support",
    ],
  },
  {
    id: "teams",
    name: "Teams",
    monthlyPrice: 12,        // TODO: verify against Stripe
    annualPrice: 115,        // TODO: verify against Stripe
    currency: "GBP",
    recommended: false,
    ctaLabel: "Start Teams",
    ctaHref: "/register?plan=teams",
    tagline: "For organisations",
    features: [
      "Everything in Pro",
      "Team shared address book",
      "Unlimited team members",
      "Role-based access (Owner, Can edit, Can view)",
      "Audit log",
      "Priority email support",
    ],
  },
];
```

**IMPORTANT**: All prices marked `// TODO: verify against Stripe` must be
confirmed against the live Stripe dashboard before this page is merged to
`main`. Prices must never be hardcoded strings — they always come from
`PLANS` in `pricing-data.ts`.

### Plan card component

```
┌──────────────────────────────────────┐
│  Plan name (20px semibold)           │
│  Tagline (13px muted)                │
│                                      │
│  £5 / month                          │
│  (price, 40px bold, #17352e)         │
│  billed monthly                      │
│                                      │
│  [CTA Button]                        │
│                                      │
│  ───────────────────────────────     │
│  ✓ Feature one                       │
│  ✓ Feature two                       │
│  ✓ …                                 │
└──────────────────────────────────────┘
```

**Recommended plan (Family)**: border `border-2 border-[#17352e]`, "Most popular"
badge (`bg-[#17352e] text-white text-[11px] font-bold rounded-full px-3 py-1`)
positioned absolute top-4 right-4.

**Free plan**: price renders as "Free" in the price slot, no sub-label.

**CTA button**: filled `bg-[#17352e] text-white` for Free and recommended plan;
`border border-[#d8ddd6] text-[#1d2823]` for non-recommended paid plans.

**Feature list** checkmarks: `text-[#17352e]` ✓ character or Lucide `Check`
icon (16px), next to `text-[14px] text-[#1d2823]`.

### Grid

Four cards in `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6`. On mobile
(1 column), cards stack; the Pro card renders first in the DOM (even if it's
the second in the visual grid) for search engines to see the recommended plan
first. Actually, keep DOM order Free → Pro → Family → Teams for logical reading;
the visual grid handles presentation.

### Page hero

```
"Simple, honest pricing"
"Start free. Upgrade when you're ready."
```

Typography: `text-[42px] font-bold text-[#17352e] text-center` for headline,
`text-[18px] text-[#5c655e] text-center mt-4` for sub-copy.

## Acceptance Criteria

- [ ] `/pricing` page renders with four plan cards (Free, Pro, Family, Teams).
- [ ] Plan prices come from `pricing-data.ts`, not hardcoded strings.
- [ ] Prices are verified against live Stripe config before merging to `main`.
- [ ] Family card has "Most popular" badge and a stronger border.
- [ ] CTA buttons link to the correct registration paths.
- [ ] Feature lists match `PLANS[].features` in `pricing-data.ts`.
- [ ] Page uses `<MarketingNav>` and `<MarketingFooter>`.
- [ ] `metadata` title and description are set.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Price verification**: the `// TODO: verify against Stripe` markers must be
  resolved before go-live. Assign a specific person to check the Stripe
  dashboard and confirm or update the prices in `pricing-data.ts`.
- **Plan IDs**: the `ctaHref` query param (`?plan=pro`) must match what the
  registration flow or billing upgrade flow expects. Verify before shipping.
- **"Most popular" badge**: Family is the recommended plan. If this changes based on signup data, update `recommended: true` in `pricing-data.ts`.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/: note that pricing-data.ts is
      the single source of truth for plan names and prices
- [x] Internal · engineering — docs/: document pricing-data.ts structure and
      the Stripe verification step required before each pricing update
