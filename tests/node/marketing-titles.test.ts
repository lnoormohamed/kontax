import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { checkMarketingTitles, DESCRIPTION_MAX, TITLE_MAX } from "../../scripts/lib/marketing-metadata.mjs";

// P50A-04 acceptance: unique titles ≤ 60 chars and descriptions ≤ 160 chars
// on every public marketing page. Runs the same check as
// `npm run check:marketing-titles` against the real repo source tree, so a
// future page with a missing/oversized/duplicate title fails CI here instead
// of only being caught by the standalone script.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("every public marketing page has a unique title and a description within budget", () => {
  const { pages, violations } = checkMarketingTitles(ROOT);

  assert.ok(pages.length >= 8, `expected to find at least 8 public marketing pages, found ${pages.length}`);
  assert.deepEqual(violations, []);

  for (const page of pages) {
    assert.ok(page.title, `${page.file} is missing a title`);
    assert.ok(page.title.length <= TITLE_MAX, `${page.file} title exceeds ${TITLE_MAX} chars`);
    assert.ok(page.description, `${page.file} is missing a description`);
    assert.ok(
      page.description.length <= DESCRIPTION_MAX,
      `${page.file} description exceeds ${DESCRIPTION_MAX} chars`,
    );
  }
});
