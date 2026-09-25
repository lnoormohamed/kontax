import assert from "node:assert/strict";
import { test, mock, beforeEach } from "node:test";

import { createFakePrisma } from "./_fake-prisma";
import type { AdminCapabilityMap } from "../../src/server/admin/capabilities";

const ALL_CAPABILITIES: (keyof AdminCapabilityMap)[] = [
  "users.view",
  "support.manage",
  "billing.manage",
  "sync.view",
  "sync.override",
  "account.lifecycle",
  "plan.override",
  "impersonation",
  "audit.view",
  "flags.manage",
  "broadcast.manage",
];

/** A full capability map with everything false except the given overrides. */
function capabilities(overrides: Partial<AdminCapabilityMap>): AdminCapabilityMap {
  const base = Object.fromEntries(ALL_CAPABILITIES.map((key) => [key, false])) as AdminCapabilityMap;
  return { ...base, ...overrides };
}

/**
 * P49A-07 (admin hardening) — global admin search (src/server/admin/search.ts)
 * used to return audit-log pivots to every admin tier, regardless of whether
 * they hold the `audit.view` capability (governance-only). The fix passes the
 * acting admin's capabilities into `searchAdminEntities` and skips the
 * audit-log query entirely — not just its rendering — when `audit.view` is
 * missing, so a SUPPORT_OPS (or BILLING_OPS/SYNC_OPS) admin never triggers it.
 *
 * `~/server/db` is mocked to an empty in-memory fake (every other section
 * queried by searchAdminEntities returns no rows either way — this test only
 * cares about the audit-pivots section) and `~/server/admin/audit`'s
 * `loadAuditSearchTargets` is mocked with a call counter so the assertion is
 * "never queried", not merely "not shown".
 */

let currentDb: unknown;
mock.module("~/server/db", {
  namedExports: {
    db: new Proxy(
      {},
      {
        get(_target, prop) {
          return (currentDb as Record<string, unknown>)[prop as string];
        },
      },
    ),
  },
});

let loadAuditSearchTargetsCalls = 0;
mock.module("~/server/admin/audit", {
  namedExports: {
    loadAuditSearchTargets: async (q: string) => {
      loadAuditSearchTargetsCalls++;
      return [
        {
          id: "audit_1",
          label: `Suspicious admin action matching ${q}`,
          action: "account.suspend",
          href: "/admin/audit?q=suspend",
        },
      ];
    },
    buildAdminAuditHref: () => "/admin/audit",
  },
});

const { searchAdminEntities } = await import("../../src/server/admin/search");

let fake: ReturnType<typeof createFakePrisma>;

beforeEach(() => {
  fake = createFakePrisma();
  currentDb = fake.client;
  loadAuditSearchTargetsCalls = 0;
});

test("SUPPORT_OPS (no audit.view) search returns no audit rows and never queries the audit log", async () => {
  const supportOpsCapabilities = capabilities({ "users.view": true, "support.manage": true });
  const results = await searchAdminEntities("suspend", supportOpsCapabilities);
  assert.deepEqual(results.auditTargets, []);
  assert.equal(loadAuditSearchTargetsCalls, 0, "a SUPPORT_OPS admin must never trigger the audit-log query");
});

test("a governance admin (audit.view: true) search does surface audit pivots", async () => {
  const governanceCapabilities = capabilities({ "audit.view": true });
  const results = await searchAdminEntities("suspend", governanceCapabilities);
  assert.equal(loadAuditSearchTargetsCalls, 1);
  assert.equal(results.auditTargets.length, 1);
  assert.match(results.auditTargets[0]!.title, /Suspicious admin action/);
});

test("omitting capabilities keeps the old default (audit visible) for any not-yet-updated caller", async () => {
  const results = await searchAdminEntities("suspend");
  assert.equal(loadAuditSearchTargetsCalls, 1);
  assert.equal(results.auditTargets.length, 1);
});
