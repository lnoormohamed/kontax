import type { ChangelogEntry } from "~/app/(marketing)/changelog/_entries";

// P49A-15: RSS rendering for /changelog.xml, kept out of route.ts (a route
// module may only export route handlers) so it can be unit-tested.
//
// Fable review: the item description used to be HTML inside CDATA, where a
// literal `]]>` in any entry text would end the section early and break the
// feed. It is now plain XML-escaped text instead — the HTML markup is escaped
// once more, which RSS readers decode back to HTML — so no entry text can
// escape its element.

export const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

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

const entryToRssItem = (entry: ChangelogEntry, siteUrl: string) => {
  const link = `${siteUrl}/changelog#${entry.id}`;
  const pubDate = new Date(`${entry.date}T00:00:00Z`).toUTCString();
  const title = `${entry.version} — ${entry.title}`;

  return [
    "    <item>",
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <guid isPermaLink="false">kontax-changelog-${escapeXml(entry.id)}</guid>`,
    `      <pubDate>${pubDate}</pubDate>`,
    `      <description>${escapeXml(entryDescriptionHtml(entry))}</description>`,
    "    </item>",
  ].join("\n");
};

export function buildRssFeed(entries: readonly ChangelogEntry[], siteUrl: string): string {
  const channelLink = `${siteUrl}/changelog`;
  const latest = entries[0];
  const lastBuildDate = latest
    ? new Date(`${latest.date}T00:00:00Z`).toUTCString()
    : new Date(0).toUTCString();
  const items = entries.map((entry) => entryToRssItem(entry, siteUrl)).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>Kontax Changelog</title>",
    `    <link>${escapeXml(channelLink)}</link>`,
    "    <description>Every Kontax update in order — new features, improvements, and fixes.</description>",
    `    <atom:link href="${escapeXml(`${siteUrl}/changelog.xml`)}" rel="self" type="application/rss+xml" />`,
    "    <language>en</language>",
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
