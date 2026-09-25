import { SITE_URL } from "~/lib/site-url";

// P26-09 · structured data (JSON-LD). Rendered as <script type="application/ld+json">;
// Google reads it anywhere in the document.
//
// SEC-01: some callers (e.g. the public contact card at /u/[username]) build the
// schema from user-controlled fields like the display name. JSON.stringify does
// NOT escape "<", so a value containing "</script>" would close this tag and let
// arbitrary markup execute. Escaping "<" is necessary and sufficient to prevent
// the raw-text breakout; ">" and "&" are escaped as defence in depth. All three
// are valid JSON and decode back to the original characters, so consumers read
// the schema identically.
export function JsonLd({
  data,
  nonce,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
  // SEC-02: on pages served under a nonce-based CSP (the public card at
  // /u/[username]), pass the request nonce so this inline script is permitted.
  nonce?: string;
}) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

export const organizationSchema = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Kontax",
  url: SITE_URL,
  logo: `${SITE_URL}/opengraph-image.png`,
});

// P50A-03 · the same price shape `fetchStripePrices()` (pricing/_prices.ts)
// returns — amounts in whole currency units, currency lower-cased, as read
// from the Stripe catalogue. Kept structural (not imported from the pricing
// route) so this file has no dependency on a page under (marketing).
export type StripePriceCatalog = {
  currency: string;
  pro: { monthly: number; annual: number };
  family: { monthly: number; annual: number };
  teams: { monthly: number; annual: number };
};

// Mirrors the FALLBACK_PRICES used by the pricing page/toggle for when the
// Stripe catalog can't be read — same numbers, so the schema never disagrees
// with what a visitor sees rendered.
const FALLBACK_PRICE_CATALOG: StripePriceCatalog = {
  currency: "gbp",
  pro: { monthly: 5, annual: 48 },
  family: { monthly: 8, annual: 72 },
  teams: { monthly: 12, annual: 120 },
};

const freeOffer = (currency: string): Record<string, unknown> => ({
  "@type": "Offer",
  name: "Free",
  price: "0",
  priceCurrency: currency.toUpperCase(),
  url: `${SITE_URL}/pricing`,
  description: "Free for up to 500 contacts.",
});

const paidOffer = (
  planName: string,
  currency: string,
  amount: number,
  interval: "monthly" | "annual",
): Record<string, unknown> => ({
  "@type": "Offer",
  name: `${planName} (${interval === "monthly" ? "billed monthly" : "billed annually"})`,
  price: String(amount),
  priceCurrency: currency.toUpperCase(),
  url: `${SITE_URL}/pricing`,
});

// One Offer per paid plan and billing interval, plus the free plan, all in
// the same currency as the Stripe catalogue. `catalog` should come straight
// from `fetchStripePrices()` — pass `null` (catalog unavailable) to fall back
// to the same numbers the page itself falls back to.
export const pricingOffers = (
  catalog: StripePriceCatalog | null,
): Record<string, unknown>[] => {
  const c = catalog ?? FALLBACK_PRICE_CATALOG;
  return [
    freeOffer(c.currency),
    paidOffer("Pro", c.currency, c.pro.monthly, "monthly"),
    paidOffer("Pro", c.currency, c.pro.annual, "annual"),
    paidOffer("Family", c.currency, c.family.monthly, "monthly"),
    paidOffer("Family", c.currency, c.family.annual, "annual"),
    paidOffer("Teams", c.currency, c.teams.monthly, "monthly"),
    paidOffer("Teams", c.currency, c.teams.annual, "annual"),
  ];
};

// /pricing · SoftwareApplication with one Offer per paid plan and interval
// (P50A-03). `catalog` is the exact value `/pricing` rendered, so a Stripe
// price change changes both the page and this schema together.
export const pricingSoftwareApplicationSchema = (
  catalog: StripePriceCatalog | null,
): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Kontax",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  url: `${SITE_URL}/pricing`,
  offers: pricingOffers(catalog),
});

// Homepage · Organization + WebSite + SoftwareApplication. `catalog` (or
// `null` for the same fallback numbers the pricing page uses) drives the
// offers so the homepage never hard-codes a price: free plan + the cheapest
// paid plan, both in the catalogue's currency.
export const softwareApplicationSchema = (
  catalog: StripePriceCatalog | null = null,
): Record<string, unknown> => {
  const c = catalog ?? FALLBACK_PRICE_CATALOG;
  const planIds = ["pro", "family", "teams"] as const;
  const cheapestPaid = planIds.reduce<(typeof planIds)[number]>(
    (min, id) => (c[id].monthly < c[min].monthly ? id : min),
    "pro",
  );
  const planName = cheapestPaid.charAt(0).toUpperCase() + cheapestPaid.slice(1);

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Kontax",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    url: SITE_URL,
    description:
      "Kontax keeps your contacts in sync across every device and app via CardDAV — private, portable, no lock-in.",
    offers: [
      freeOffer(c.currency),
      paidOffer(planName, c.currency, c[cheapestPaid].monthly, "monthly"),
    ],
  };
};

export const websiteSchema = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Kontax",
  url: SITE_URL,
});

export const faqPageSchema = (
  items: { q: string; a: string }[],
): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((it) => ({
    "@type": "Question",
    name: it.q,
    acceptedAnswer: { "@type": "Answer", text: it.a },
  })),
});

export const breadcrumbSchema = (
  items: { name: string; path: string }[],
): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: `${SITE_URL}${it.path}`,
  })),
});

// P50A-03 · reusable Article schema for help articles and guides.
// `url` is a path (e.g. "/help/sync/connect-icloud-contacts"), resolved
// against SITE_URL like breadcrumbSchema does. `dateModified` should be the
// article's own "last reviewed" date, not the build date. Other agents may
// currently define an equivalent schema locally on their own pages; the
// integrator may switch those call sites to this one later.
export const articleSchema = ({
  headline,
  description,
  url,
  dateModified,
}: {
  headline: string;
  description: string;
  url: string;
  dateModified: string;
}): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "Article",
  headline,
  description,
  url: `${SITE_URL}${url}`,
  dateModified,
  author: { "@type": "Organization", name: "Kontax" },
  publisher: {
    "@type": "Organization",
    name: "Kontax",
    logo: { "@type": "ImageObject", url: `${SITE_URL}/opengraph-image.png` },
  },
});
