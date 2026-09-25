import assert from "node:assert/strict";
import { test } from "node:test";

import type { ChangelogEntry } from "../../src/app/(marketing)/changelog/_entries";
import { buildRssFeed, escapeXml } from "../../src/app/changelog.xml/_feed";

// P49A-15 / Fable review: /changelog.xml must stay well-formed whatever the
// entry text contains — a literal `]]>` used to end the old CDATA section.

test("escapeXml escapes every XML-significant character", () => {
  assert.equal(escapeXml(`a & b < c > d "e" 'f' ]]>`), "a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos; ]]&gt;");
});

test("entry text containing ]]> or markup cannot break out of its element", () => {
  const entry: ChangelogEntry = {
    id: "v9-9-9",
    version: "v9.9.9",
    date: "2026-09-25",
    displayDate: "25 Sep 2026",
    title: "Fixes & <things>",
    summary: "Closes the ]]> gap",
    categories: [{ label: "Fixed", items: ["A literal ]]></description><evil/> in an item"] }],
  };

  const feed = buildRssFeed([entry], "https://example.test");

  assert.ok(!feed.includes("]]>"), "no raw CDATA terminator anywhere");
  assert.ok(!feed.includes("<![CDATA["));
  assert.ok(!feed.includes("<evil/>"));
  assert.equal(feed.match(/<description>/g)?.length, 2, "channel + one item description");
  assert.equal(feed.match(/<\/description>/g)?.length, 2);
  assert.ok(feed.includes("<title>v9.9.9 — Fixes &amp; &lt;things&gt;</title>"));

  // The description is HTML escaped once more for XML; decoding the XML layer
  // gives back HTML whose text is still escaped.
  const description = /<item>[\s\S]*<description>([\s\S]*?)<\/description>/.exec(feed)?.[1] ?? "";
  const html = description
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
  assert.ok(html.includes("<p>Closes the ]]&gt; gap</p>"));
  assert.ok(html.includes("<li>A literal ]]&gt;&lt;/description&gt;&lt;evil/&gt; in an item</li>"));
});
