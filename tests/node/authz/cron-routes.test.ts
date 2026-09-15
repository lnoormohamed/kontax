import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

// P48-10 / P48-13: every /api/cron/* route must return 401 when the caller
// doesn't present a matching `x-cron-secret` header — these run the actual
// exported route module's POST handler (no mocking), not a re-implementation
// of the guard. No database is needed: `assertCronSecret` runs before any of
// these handlers touch `~/server/db`, and constructing a `PrismaClient` does
// not itself open a connection — so, unlike the rest of tests/node/authz/,
// this file does not need TEST_DATABASE_URL and does not import ./_env.mjs.
const CRON_ROUTES: Array<[string, () => Promise<{ POST: (req: NextRequest) => Promise<Response> }>]> = [
  ["birthday-reminders", () => import("../../../src/app/api/cron/birthday-reminders/route")],
  ["cleanup-card-views", () => import("../../../src/app/api/cron/cleanup-card-views/route")],
  ["data-export", () => import("../../../src/app/api/cron/data-export/route")],
  ["delete-accounts", () => import("../../../src/app/api/cron/delete-accounts/route")],
  ["digest", () => import("../../../src/app/api/cron/digest/route")],
  ["expire-exports", () => import("../../../src/app/api/cron/expire-exports/route")],
  ["reset-api-counters", () => import("../../../src/app/api/cron/reset-api-counters/route")],
  ["sync", () => import("../../../src/app/api/cron/sync/route")],
];

for (const [name, load] of CRON_ROUTES) {
  test(`/api/cron/${name} returns 401 without the cron secret header`, async () => {
    const savedSecret = process.env.CRON_SECRET;
    // Force the "no secret configured" branch to also be exercised alongside
    // the "secret configured, header missing" branch — assertCronSecret
    // denies both, but let's pin the header-missing case explicitly by
    // giving the route a real secret to compare against.
    process.env.CRON_SECRET = "test-cron-secret-authz-suite";
    try {
      const { POST } = await load();
      const req = new NextRequest(`http://localhost/api/cron/${name}`, { method: "POST" });
      const res = await POST(req);
      assert.equal(res.status, 401, `${name} should 401 without x-cron-secret`);
    } finally {
      process.env.CRON_SECRET = savedSecret;
    }
  });
}
