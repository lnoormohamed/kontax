import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveCardAnalytics,
  normaliseCardReferrer,
} from "../../src/server/public-card/analytics-utils";

test("public card analytics derives windows, sources, and latest activity", () => {
  const now = new Date("2026-06-27T12:00:00.000Z");
  const analytics = deriveCardAnalytics(
    { totalViews: 42, ctaClicks: 5 },
    [
      { viewedAt: new Date("2026-06-27T11:30:00.000Z"), referrer: "https://www.google.com/search?q=kontax" },
      { viewedAt: new Date("2026-06-24T10:00:00.000Z"), referrer: "https://twitter.com/example" },
      { viewedAt: new Date("2026-06-10T09:00:00.000Z"), referrer: null },
      { viewedAt: new Date("2026-05-29T09:00:00.000Z"), referrer: "https://www.google.com/search?q=kontax" },
    ],
    now,
  );

  assert.equal(analytics.totalViews, 42);
  assert.equal(analytics.views7d, 2);
  assert.equal(analytics.views30d, 4);
  assert.equal(analytics.ctaClicks, 5);
  assert.equal(analytics.latestActivityAt?.toISOString(), "2026-06-27T11:30:00.000Z");
  assert.equal(analytics.topCta?.label, "Add to Kontax");
  assert.deepEqual(analytics.topSources.slice(0, 3), [
    { label: "google.com", count: 2 },
    { label: "Direct / unknown", count: 1 },
    { label: "twitter.com", count: 1 },
  ]);
  assert.equal(analytics.dailyViews30d.length, 30);
});

test("referrer normalisation falls back safely", () => {
  assert.equal(normaliseCardReferrer("https://www.fastmail.com/contacts"), "fastmail.com");
  assert.equal(normaliseCardReferrer("not-a-url"), "Direct / unknown");
  assert.equal(normaliseCardReferrer(null), "Direct / unknown");
});
