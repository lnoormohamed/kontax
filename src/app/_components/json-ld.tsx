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
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return (
    <script
      type="application/ld+json"
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

export const softwareApplicationSchema = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Kontax",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  url: SITE_URL,
  description:
    "Kontax keeps your contacts in sync across every device and app via CardDAV — private, portable, no lock-in.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "GBP",
    description: "Free for up to 500 contacts; paid plans add unlimited contacts and sharing.",
  },
});

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
