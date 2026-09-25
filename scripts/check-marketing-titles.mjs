#!/usr/bin/env node
// P50A-04 — static guard: every public marketing page must have a unique
// title (≤ 60 chars, after whatever layout template applies to it) and a
// description (≤ 160 chars). See scripts/lib/marketing-metadata.mjs for how
// "effective title" is computed and which pages are in scope.
//
// Run: node scripts/check-marketing-titles.mjs   (wired as
// `npm run check:marketing-titles`, and exercised by
// tests/node/marketing-titles.test.ts as part of `npm run test:repo`).

import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkMarketingTitles } from "./lib/marketing-metadata.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function main() {
  const { pages, violations } = checkMarketingTitles(ROOT);

  if (violations.length > 0) {
    console.error(`check-marketing-titles: ${violations.length} problem(s):\n`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }

  console.log(
    `check-marketing-titles: OK — ${pages.length} public marketing page(s), ` +
      `all titles unique and ≤ ${60} chars, all descriptions ≤ ${160} chars.`,
  );
}

main();
