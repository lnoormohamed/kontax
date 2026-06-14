# P34C-11 — Pricing Page FAQ Section

## Purpose

Add a FAQ accordion below the feature matrix on `/pricing`. Answers the most
common pre-purchase questions so visitors can resolve their hesitations without
contacting support — reducing support volume and increasing conversion.

## Background

Pricing page FAQs are a standard SaaS pattern that converts fence-sitters. The
questions in scope are the ones that come up repeatedly in support conversations
or that address common purchasing objections (free trial, cancellation, refunds,
data safety). Implementing as an accordion keeps the page scannable — closed
items take up minimal space.

## Scope

**In scope**
- FAQ section of `src/app/(marketing)/pricing/page.tsx`.
- 8 questions with answers defined as a typed constant.
- Expand/collapse accordion per question.
- Plain implementation — no animation required for launch.

**Out of scope**
- Search within the FAQ.
- Routing to individual FAQ items (no URL anchors per question — full-page
  `/pricing` anchor is enough).
- General FAQ page (a separate `/faq` or `/help` route, if needed, is out
  of scope for this phase).

## Design / Implementation Spec

### FAQ data constant

Define at the top of the pricing page or in `pricing-data.ts`:

```ts
export type FAQItem = {
  question: string;
  answer: string; // plain text; can include a link string e.g. "[/security]"
};

export const PRICING_FAQ: FAQItem[] = [
  {
    question: "Can I try Kontax before I buy?",
    answer:
      "Yes — the Free plan is free forever with no credit card required. " +
      "You get 100 contacts, labels, search, and a CardDAV sync account for as " +
      "long as you want. Upgrade to Pro when you need more.",
  },
  {
    question: "What happens to my contacts if I downgrade to Free?",
    answer:
      "Your contacts are always safe. If you downgrade from Pro to Free and you " +
      "have more than 100 contacts, existing contacts are kept — you just can't " +
      "add new ones until you're back under the limit. No data is deleted on " +
      "downgrade.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Cancel from Settings → Billing at any time. Your plan stays active " +
      "until the end of the billing period — we don't pro-rate cancellations, " +
      "but you keep full access until your next renewal date. You can manage " +
      "everything through the Stripe customer portal.",
  },
  {
    question: "Is my data safe with Kontax?",
    answer:
      "Yes. Contacts are stored in an encrypted database, connections are TLS-" +
      "only, and your sync credentials (CardDAV, Google, Outlook) are stored " +
      "encrypted at rest and never logged. We also support 2FA on every account. " +
      "See /security for the full picture.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "We offer a full refund if you request one within 7 days of your first " +
      "paid charge on any plan. After 7 days, charges are final. To request a " +
      "refund, email us at support@getkontax.com and we'll process it promptly.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "All major credit and debit cards (Visa, Mastercard, American Express) " +
      "via Stripe. We don't currently accept PayPal, bank transfers, or " +
      "cryptocurrency.",
  },
  {
    question: "Is there a family discount?",
    answer:
      "The Family plan is the family discount — one subscription covers up to " +
      "six people sharing a family address book, at a lower per-person cost than " +
      "individual Pro subscriptions. There's no separate family discount code.",
  },
  {
    question: "Can I use the developer API on the Free plan?",
    answer:
      "No — API access is a Pro and above feature. The REST API at " +
      "api.getkontax.com is available on Pro, Family, and Teams plans. " +
      "You can generate API tokens from Settings → API once you're on a paid plan.",
  },
];
```

**NOTE**: Refund policy ("7 days") must be agreed internally before shipping.
If no policy is set, use `[REFUND POLICY TBD]` as a placeholder and do not
ship to production until confirmed. This is a business decision, not a
technical one.

### FAQ accordion component

Plain, no animation:

```tsx
"use client";
import { useState } from "react";

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="divide-y divide-[#edf0ea] border border-[#d8ddd6]
                    rounded-[14px] overflow-hidden">
      {items.map((item, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex justify-between items-center px-6 py-5
                       text-left text-[15px] font-semibold text-[#1d2823]
                       hover:bg-[#f4f6f2] transition-colors"
            aria-expanded={open === i}
          >
            {item.question}
            <span className="ml-4 shrink-0 text-[#8b938c] text-xl font-normal">
              {open === i ? "−" : "+"}
            </span>
          </button>
          {open === i && (
            <div className="px-6 pb-5 text-[14.5px] text-[#5c655e]
                            leading-[1.7]">
              <FAQAnswer text={item.answer} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

`FAQAnswer` renders the plain text but converts a `/security` reference to a
`<Link>` if needed. Keep it simple: for launch, render as plain text and
manually add any links as JSX in the `answer` field (typed as `React.ReactNode`
instead of `string`).

### Section layout

```tsx
<section className="max-w-3xl mx-auto px-6 py-20">
  <h2 className="text-[28px] font-bold text-[#17352e] mb-8 text-center">
    Frequently asked questions
  </h2>
  <FAQAccordion items={PRICING_FAQ} />
  <p className="mt-8 text-center text-[14px] text-[#8b938c]">
    Still have questions?{" "}
    <Link href="/contact" className="text-[#4158f4] hover:underline">
      Get in touch
    </Link>
    .
  </p>
</section>
```

### Accessibility

- Each button has `aria-expanded`.
- The expanded content panel has `role="region"` and `aria-labelledby` pointing
  to the button (if animated; for plain show/hide, this is optional).
- The `+`/`−` icons are `aria-hidden="true"`.

## Acceptance Criteria

- [ ] FAQ section renders below the feature matrix on `/pricing`.
- [ ] All 8 questions appear as collapsed accordion items by default.
- [ ] Clicking a question expands its answer.
- [ ] Only one item is open at a time (clicking a second item closes the first).
- [ ] The "Still have questions?" link at the bottom links to `/contact`.
- [ ] No placeholder text (`[REFUND POLICY TBD]`) ships to production.
- [ ] No animation required — plain toggle is acceptable.
- [ ] `tsc --noEmit` passes; no console errors.

## Risks / Open Questions

- **Refund policy**: the 7-day window is a placeholder. Confirm the actual
  policy with the business before this ticket is marked done.
- **Answer link handling**: if answers need clickable links (e.g. `/security`),
  the `answer` field type should be `React.ReactNode` rather than `string`.
  Update the `FAQItem` type before adding links.
- **"Can I cancel anytime?"**: the customer portal link in the answer should be
  a real Stripe customer portal URL once billing is live. Check if the app
  already has a portal redirect endpoint (e.g. `/api/billing/portal`).

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/: link to the pricing FAQ as
      the source of truth for support team answers on billing questions
- [x] Internal · engineering — docs/: document the PRICING_FAQ constant and
      how to add/edit questions without touching JSX
