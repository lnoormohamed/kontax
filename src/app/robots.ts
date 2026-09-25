import { type MetadataRoute } from "next";

import { isProductionRuntime, SITE_URL } from "~/lib/site-url";

// P26-08 — robots.txt. Allow public marketing/auth routes; disallow the
// authenticated app surfaces and machine endpoints.
//
// P50A-01: non-production deploys (staging, preview) must never be indexable
// — `kontax.vexon.co` was previously fully crawlable. Same production check
// as everywhere else (`isProductionRuntime`, KONTAX_DEPLOY_ENV / NODE_ENV).
// Production behaviour is unchanged; only non-production gets `Disallow: /`
// and no sitemap line (nothing to submit for a site search engines shouldn't
// index). See tests/node/robots.test.ts.
export default function robots(): MetadataRoute.Robots {
  if (!isProductionRuntime()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/contacts",
        "/settings",
        "/admin",
        "/api",
        "/sync",
        "/import-export",
        "/merge",
        "/merge-suggestions",
        "/family",
        "/teams",
        "/share",
        "/settings/sharing/shared",
        "/dav",
        "/verify-email",
        "/reset-password",
        "/account-deleted",
        "/account-pending-deletion",
        "/revert-email", // P48-03: single-use token link, never indexable
        "/books",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
