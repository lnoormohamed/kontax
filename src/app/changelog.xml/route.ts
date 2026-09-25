import { CHANGELOG_ENTRIES, type ChangelogEntry } from "~/app/(marketing)/changelog/_entries";
import { SITE_URL } from "~/lib/site-url";

// P49A-15: RSS feed for the "Subscribe via RSS" link on /changelog. Renders
// from the same CHANGELOG_ENTRIES data the page itself uses, so the two can
// never drift apart. Fully static (no request-dependent data), so Next.js can
// prerender and cache this route like any other static GET handler.

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const entryLink = (entry: ChangelogEntry) => `${SITE_URL}/changelog#${entry.id}`;

const entryDescriptionHtml = (entry: ChangelogEntry) => {
  const parts: string[] = [];
  if (entry.summary) {
    parts.push(`<p>${escapeXml(entry.summary)}</p>`);
  }
  for (const category of entry.categories) {
    const items = category.items.map((item) => `<li>${escapeXml(item)}</li>`).join("");
    parts.push(`<p><strong>${escapeXml(category.label)}</strong></p><ul>${items}</ul>`);
  }
  return parts.join("");
};

const entryToRssItem = (entry: ChangelogEntry) => {
  const link = entryLink(entry);
  const pubDate = new Date(`${entry.date}T00:00:00Z`).toUTCString();
  const title = `${entry.version} — ${entry.title}`;

  return [
    "    <item>",
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${link}</link>`,
    `      <guid isPermaLink="false">kontax-changelog-${entry.id}</guid>`,
    `      <pubDate>${pubDate}</pubDate>`,
    `      <description><![CDATA[${entryDescriptionHtml(entry)}]]></description>`,
    "    </item>",
  ].join("\n");
};

function buildRssFeed(): string {
  const channelLink = `${SITE_URL}/changelog`;
  const latest = CHANGELOG_ENTRIES[0];
  const lastBuildDate = latest
    ? new Date(`${latest.date}T00:00:00Z`).toUTCString()
    : new Date(0).toUTCString();
  const items = CHANGELOG_ENTRIES.map(entryToRssItem).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>Kontax Changelog</title>",
    `    <link>${channelLink}</link>`,
    "    <description>Every Kontax update in order — new features, improvements, and fixes.</description>",
    `    <atom:link href="${SITE_URL}/changelog.xml" rel="self" type="application/rss+xml" />`,
    "    <language>en</language>",
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export function GET() {
  return new Response(buildRssFeed(), {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Static content (build-time data) — safe for a shared/CDN cache. A new
      // release only ships via a deploy, which invalidates this anyway.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
