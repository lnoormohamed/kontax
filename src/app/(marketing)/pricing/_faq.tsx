import { PlusIcon } from "../_components/mkt-ui";

// P50-04 · Billing FAQ on native <details>/<summary> (.mkt-faq), no client JS.
// The first answer starts open.
//
// P49A-14 · every answer checked against the code (2026-09-25): vCard export
// is premiumExportEnabled (Pro and above); a downgrade never deletes or locks
// contacts; sync credentials and 2FA secrets use AES-256-GCM; no hard-coded
// annual saving, payment-method list, hosting location, invoicing or support
// tiers.

const FAQS = [
  {
    q: "Can I try Kontax before I buy?",
    a: "Yes. Free needs no card and has no time limit. It holds up to 500 contacts with search, labels, duplicate merge, one sync source and one iPhone or Mac, so you can use it day to day before deciding. The first time you subscribe to Pro you also get a 14-day free trial, which starts at checkout.",
    defaultOpen: true,
  },
  {
    q: "What happens to my contacts if I downgrade or cancel?",
    a: "Nothing is deleted. If you move to Free, all your contacts stay and you can keep editing them. You can export at any time on any plan: Free exports CSV or a Kontax archive and downloads single contacts as .vcf, and the full data export includes a contacts.vcf file. Exporting your whole library as vCard is a Pro feature.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Anytime, from Settings → Billing. There's no contract and no cancellation fee. Your paid features stay active until the end of the period you've already paid for, then your account simply moves to Free.",
  },
  {
    q: "Is my data safe?",
    a: "Everything travels over TLS, and your sync credentials and 2FA secret are encrypted at rest (AES-256-GCM). We never sell or share your data, and there are no ads or trackers anywhere in Kontax. Built on the open CardDAV standard, so you're never locked in.",
  },
  {
    q: "Do you offer refunds?",
    a: "If a paid plan isn't right for you, email us within 14 days of a charge and we'll refund it in full, no questions asked. Annual plans are covered by the same 14-day window from the renewal date.",
  },
  {
    q: "How do I pay?",
    a: "Payments are handled securely by Stripe. You'll see the payment methods available to you at checkout.",
  },
  {
    q: "Is there a family discount?",
    a: "The Family plan is the discount: one price covers up to six members, each with their own login, rather than six separate Pro subscriptions. Switch to annual billing to save more.",
  },
  {
    q: "Can I use the API on the Free plan?",
    a: "The developer REST API is available on Pro and Teams. Free accounts can still sync over open CardDAV, which works with any standards-compliant client.",
  },
  {
    q: "What support do I get?",
    a: "Email support on every plan, plus the help centre.",
  },
];

export function FaqList() {
  return (
    <div className="mkt-faq">
      {FAQS.map((faq) => (
        <details key={faq.q} open={faq.defaultOpen}>
          <summary>
            {faq.q}
            <PlusIcon size={20} />
          </summary>
          <div className="mkt-faq__a">{faq.a}</div>
        </details>
      ))}
    </div>
  );
}
