// P50A-07 · Small local schema.org helper for content pages built in this
// phase (/for/*, /features/*, /glossary, /about, /contact). Deliberately NOT
// added to the shared `src/app/_components/json-ld.tsx` — that file is the
// site-wide schema surface (Organization, SoftwareApplication, WebSite, FAQPage,
// BreadcrumbList) and P50A-07 keeps its own page-level WebPage schema local to
// the marketing route group instead of growing that shared file. Pair with
// `breadcrumbSchema` from `~/app/_components/json-ld` for the trail.
import { SITE_URL } from "~/lib/site-url";

export const webPageSchema = (opts: {
  name: string;
  description: string;
  path: string;
}): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: opts.name,
  description: opts.description,
  url: `${SITE_URL}${opts.path}`,
});
