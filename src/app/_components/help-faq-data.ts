// P50A-05 · The single-page /help FAQ (HELP_FAQ, 14 sections) moved into the
// help centre: src/app/(marketing)/help/_content (one module per category,
// old #anchors mapped in anchors.ts). What remains here is the homepage FAQ.

export type HelpFaqItem = { q: string; a: string };

// P49-04 · Homepage FAQ (design P49-DB01 §9). The homepage renders these five
// entries AND builds its FAQPage JSON-LD from this same array, so the visible
// answers and the structured data cannot drift apart. `a` is plain text (it
// goes into the schema verbatim); `link` is an optional trailing link shown
// on the page only.
//
// Facts reconciled against the product: Free = 500 contacts / 1 sync source
// and Pro = up to 5 sync sources (src/server/billing.ts); deletion has a
// 30-day grace period (src/app/actions/account.ts); vCard export is a paid
// feature, so the leave answer names CSV and the Kontax format only.
export type HomepageFaqItem = HelpFaqItem & {
  link?: { href: string; label: string };
};

export const HOMEPAGE_FAQ: HomepageFaqItem[] = [
  {
    q: "Do I need to install an app?",
    a: "No. On iPhone and Mac, Kontax appears inside the Contacts app you already use, over CardDAV. Everywhere else, use Kontax in your browser.",
  },
  {
    q: "Does it work with iPhone?",
    a: "Yes. Add Kontax as a CardDAV account in Settings with an app password. Changes made on your iPhone sync back to Kontax, and the other way round.",
  },
  {
    q: "Is Kontax free?",
    a: "The Free plan holds up to 500 contacts with one sync source. No card needed. Pro removes the contact limit and adds up to five sync sources and the developer API.",
    link: { href: "/pricing", label: "Compare plans" },
  },
  {
    q: "What happens to my contacts if I leave?",
    a: "Export everything at any time as CSV or the documented Kontax format, then delete your account from Settings. Deletion completes after a 30-day grace period you can cancel.",
  },
  {
    q: "Can I share contacts with my family?",
    a: "Yes. The Family plan gives your household a shared address book. Each member can edit or view, and it syncs to everyone's devices.",
  },
];
