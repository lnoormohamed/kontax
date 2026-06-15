"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "Can I try Kontax before I buy?",
    a: "Yes — the Free plan is free forever, no credit card required. It holds up to 100 contacts with full search, labels, one CardDAV connection and a public card, so you can run your day-to-day before deciding whether to upgrade.",
    defaultOpen: true,
  },
  {
    q: "What happens to my contacts if I downgrade or cancel?",
    a: "Nothing is deleted. Your contacts always belong to you — if you drop to Free, everything stays put and read-only access continues over CardDAV. You can export your full address book as vCard or CSV at any time, on any plan.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Anytime, from Settings → Billing. There's no contract and no cancellation fee. Your paid features stay active until the end of the period you've already paid for, then your account simply moves to Free.",
  },
  {
    q: "Is my data safe?",
    a: "Your address book is encrypted in transit and at rest, hosted in the EU. We never sell or share your data, and there are no ads or trackers anywhere in Kontax. Built on the open CardDAV standard, so you're never locked in.",
  },
  {
    q: "Do you offer refunds?",
    a: "If a paid plan isn't right for you, email us within 14 days of a charge and we'll refund it in full, no questions asked. Annual plans are covered by the same 14-day window from the renewal date.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All major credit and debit cards (Visa, Mastercard, American Express) plus Apple Pay and Google Pay, handled securely by Stripe. Teams on annual billing can also pay by invoice — just get in touch.",
  },
  {
    q: "Is there a family discount?",
    a: "The Family plan is the discount — one flat price covers up to six members, each with their own login, rather than six separate Pro subscriptions. Switch to annual billing to save a further 20%.",
  },
  {
    q: "Can I use the API on the Free plan?",
    a: "The developer REST API and webhooks are available on Pro and above. Free accounts can still sync over open CardDAV, which works with any standards-compliant client.",
  },
];

export function FaqList() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="pr-faq-list">
      {FAQS.map((faq, i) => {
        const isOpen = openIdx === i;
        return (
          <div key={i} className="pr-faq-item" data-open={isOpen ? "true" : "false"}>
            <button
              className="pr-faq-q"
              aria-expanded={isOpen}
              onClick={() => setOpenIdx(isOpen ? null : i)}
            >
              {faq.q}
              <span className="pr-faq-sign" aria-hidden="true">{isOpen ? "−" : "+"}</span>
            </button>
            <div className="pr-faq-a">
              <div className="pr-faq-a__inner">
                <p className="pr-faq-a__text">{faq.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
