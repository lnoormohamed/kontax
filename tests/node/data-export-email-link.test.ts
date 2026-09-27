import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { DATA_EXPORT_SETTINGS_PATH } from "../../src/server/data-export/jobs";

// P49A-19 item 3: the "your export is ready" email linked to /settings/account,
// which has no download. The link must be a real page that renders the export.
test("data export email links to the page that shows the download", () => {
  const page = `src/app${DATA_EXPORT_SETTINGS_PATH}/page.tsx`;
  assert.ok(existsSync(page), `${page} should exist`);
  assert.match(readFileSync(page, "utf8"), /DataExportSection/);
});

test("the cron route's email uses the shared path, not a hard-coded one", () => {
  const route = readFileSync("src/app/api/cron/data-export/route.ts", "utf8");
  assert.match(route, /\$\{appUrl\}\$\{DATA_EXPORT_SETTINGS_PATH\}/);
  assert.doesNotMatch(route, /settings\/account/);
});
