import { CHANGELOG_ENTRIES } from "~/app/(marketing)/changelog/_entries";
import { SITE_URL } from "~/lib/site-url";

import { buildRssFeed } from "./_feed";

// P49A-15: RSS feed for the "Subscribe via RSS" link on /changelog. Renders
// from the same CHANGELOG_ENTRIES data the page itself uses, so the two can
// never drift apart. Fully static (no request-dependent data), so Next.js can
// prerender and cache this route like any other static GET handler.

export function GET() {
  return new Response(buildRssFeed(CHANGELOG_ENTRIES, SITE_URL), {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Static content (build-time data) — safe for a shared/CDN cache. A new
      // release only ships via a deploy, which invalidates this anyway.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
