import assert from "node:assert/strict";
import { test, mock, beforeEach } from "node:test";

/**
 * P49A-07 (admin hardening) — the admin audit CSV export
 * (src/app/admin/audit/export/route.ts) used to only CSV-quote a cell; it
 * never guarded against formula injection, so an admin action's denormalised
 * text (e.g. an admin's display name, a target email) could open as an
 * executable formula in Excel/Google Sheets/LibreOffice. The fix reuses the
 * already-tested `escapeCsvCell` (src/server/contact-portability.ts, see
 * tests/node/csv-escape.test.ts) instead of the route's own bare quoting.
 *
 * `~/server/admin/guard` and `~/server/admin/audit` are mocked so this test
 * exercises the route's actual CSV-building logic (including the real,
 * unmocked `escapeCsvCell`) without touching Postgres or a real admin session.
 */

let currentCapabilities: Record<string, boolean> = { "audit.view": true };
mock.module("~/server/admin/guard", {
  namedExports: {
    assertAdmin: async () => ({ capabilities: currentCapabilities }),
    requireAdminCapability: (admin: { capabilities: Record<string, boolean> }, capability: string) => {
      if (!admin.capabilities[capability]) throw new Error("FORBIDDEN");
    },
  },
});

const exportedRows = [
  {
    id: "evt_1",
    createdAt: "2026-09-25T00:00:00.000Z",
    // The formula-trigger cell under test: a cell reading exactly "-2+2"
    // must be exported as "'-2+2" — Excel/Sheets otherwise evaluate it.
    adminName: "-2+2",
    action: "plan.override",
    severity: "standard",
    targetEmail: "user@example.invalid",
    targetUserId: "user_1",
    ipAddress: "",
    details: "{}",
  },
];
mock.module("~/server/admin/audit", {
  namedExports: {
    exportAdminAudit: async () => exportedRows,
  },
});

const { GET } = await import("../../src/app/admin/audit/export/route");

beforeEach(() => {
  currentCapabilities = { "audit.view": true };
});

test("audit CSV export neutralizes a formula-trigger cell: -2+2 is exported as '-2+2", async () => {
  const response = await GET(new Request("https://admin.kontax.invalid/admin/audit/export"));
  assert.equal(response.status, 200);

  const text = await response.text();
  const lines = text.trim().split("\n");
  assert.equal(lines.length, 2, "header + exactly one data row");
  assert.equal(
    lines[0],
    "id,createdAt,adminName,action,severity,targetEmail,targetUserId,ipAddress,details",
  );
  assert.equal(
    lines[1],
    "evt_1,2026-09-25T00:00:00.000Z,'-2+2,plan.override,standard,user@example.invalid,user_1,,{}",
  );
});

test("audit CSV export is refused (403) without audit.view", async () => {
  currentCapabilities = { "audit.view": false };
  const response = await GET(new Request("https://admin.kontax.invalid/admin/audit/export"));
  assert.equal(response.status, 403);
});
