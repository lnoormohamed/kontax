import { type MetadataRoute } from "next";

import { SITE_URL } from "~/lib/site-url";

// P26-08 — robots.txt. Allow public marketing/auth routes; disallow the
// authenticated app surfaces and machine endpoints.
export default function robots(): MetadataRoute.Robots {
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
        "/shares",
        "/dav",
        "/verify-email",
        "/reset-password",
        "/account-deleted",
        "/account-pending-deletion",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
