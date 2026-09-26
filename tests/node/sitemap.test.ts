import assert from "node:assert/strict";
import test from "node:test";

import sitemap from "~/app/sitemap";
import { isPublicPath } from "~/server/public-paths";

// P50A · every URL in the sitemap must be unique and reachable by a
// logged-out visitor (otherwise crawlers are sent to a login redirect).
test("sitemap lists unique, public URLs only", () => {
  const entries = sitemap();
  const paths = entries.map((e) => new URL(e.url).pathname);
  assert.ok(paths.length > 80, `expected the content routes to be listed, got ${paths.length}`);
  assert.equal(new Set(paths).size, paths.length, "duplicate sitemap URL");
  for (const p of paths) {
    assert.ok(isPublicPath(p), `${p} is in the sitemap but not a public path`);
  }
  for (const excluded of ["/login", "/contacts", "/settings"]) {
    assert.ok(!paths.includes(excluded), `${excluded} must not be in the sitemap`);
  }
  assert.ok(!paths.some((p) => p.startsWith("/u/")), "public cards are excluded until the owner decides");
});
