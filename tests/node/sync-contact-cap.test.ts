// P49A-06 (A-25): inbound sync honours the plan's contact cap — it stops
// creating at the cap, never deletes, and the job is flagged PARTIAL with
// CONTACT_LIMIT_REACHED. Google full import against an in-memory database and a
// stubbed People API — no network, no Postgres.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import type { people_v1 } from "@googleapis/people";

import { installFakeSyncDb } from "./_sync-fake-db";

const fake = installFakeSyncDb();
const google = await import("~/server/google-sync");
const { CONTACT_LIMIT_REACHED_CODE, settleOAuthSyncJob } = await import("~/server/sync-health");

type Person = people_v1.Schema$Person;

let connections: Person[] = [];
const peopleStub = {
  people: {
    connections: {
      list: async () => ({ data: { connections, nextSyncToken: "t1" } }),
    },
  },
};
google.__setGooglePeopleApiFactoryForTests(async () => peopleStub as unknown as people_v1.People);

const person = (n: number): Person => ({
  resourceName: `people/c${n}`,
  etag: `e${n}`,
  metadata: {},
  names: [{ givenName: `Given${n}`, familyName: `Family${n}`, displayName: `Given${n} Family${n}` }],
});

const account = {
  id: "acct_1",
  userId: "user_1",
  label: "Google (test)",
  credentialReference: "unused-in-tests",
  lastSyncCursor: null as string | null,
  conflictPolicy: "MANUAL" as const,
  syncDirection: "IMPORT_ONLY" as const,
};

beforeEach(() => {
  fake.reset();
  connections = Array.from({ length: 600 }, (_, i) => person(i + 1));
});

test("Google import of 600 on Free creates 500, skips 100, deletes nothing, and flags the job", async () => {
  const result = await google.runGoogleSync(account);

  assert.equal(result.created, 500);
  assert.equal(result.capSkipped, 100);
  assert.equal(result.deleted, 0);
  assert.equal(fake.contacts.size, 500, "stops exactly at the Free cap");
  assert.equal(fake.links.size, 500, "skipped contacts are left unlinked so a later run can offer them again");
  assert.ok([...fake.contacts.values()].every((c) => c.archivedAt === null), "nothing archived or deleted");

  const settlement = settleOAuthSyncJob({
    conflicts: result.conflicts,
    pushFailed: result.pushFailed,
    capSkipped: result.capSkipped,
    capWarning: "Free plan limit reached. You can store up to 500 contacts on this plan.",
  });
  assert.equal(settlement.status, "PARTIAL");
  assert.equal(settlement.errorCode, CONTACT_LIMIT_REACHED_CODE);
  assert.match(settlement.errorSummary ?? "", /Free plan limit reached/);
  assert.equal(settlement.skippedCount, 100);
});

test("an account already at the cap creates nothing but still applies updates", async () => {
  connections = connections.slice(0, 500);
  await google.runGoogleSync(account);
  assert.equal(fake.contacts.size, 500);

  connections = [
    { ...person(1), etag: "e1-v2", names: [{ givenName: "Renamed", displayName: "Renamed" }] },
    person(900),
  ];
  const result = await google.runGoogleSync({ ...account, lastSyncCursor: "t1" });
  assert.equal(result.created, 0);
  assert.equal(result.capSkipped, 1);
  assert.equal(result.updated, 1, "existing contacts keep syncing at the cap");
  assert.equal(fake.contacts.size, 500);
});

test("paid plans import everything (no cap)", async () => {
  fake.userPlan.subscriptions = [{ plan: "PRO", memberSlotsLimit: null }];
  const result = await google.runGoogleSync(account);
  assert.equal(result.created, 600);
  assert.equal(result.capSkipped, 0);
});

test("a clean run settles SUCCEEDED with no warning", () => {
  const settlement = settleOAuthSyncJob({ conflicts: 0, pushFailed: 0, capSkipped: 0 });
  assert.equal(settlement.status, "SUCCEEDED");
  assert.equal(settlement.errorCode, null);
  assert.equal(settlement.errorSummary, null);
});
