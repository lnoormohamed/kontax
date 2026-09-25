// P49A-01 (A-01, A-04, A-05, A-07, A-22): Google sync run behaviour against an
// in-memory database and a stubbed People API — no network, no Postgres.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";

import type { people_v1 } from "@googleapis/people";

import { installFakeSyncDb } from "./_sync-fake-db";

const fake = installFakeSyncDb();
const google = await import("~/server/google-sync");

type Person = people_v1.Schema$Person;
type ListParams = people_v1.Params$Resource$People$Connections$List;
type UpdateParams = people_v1.Params$Resource$People$Updatecontact;

// ── People API stub ──────────────────────────────────────────────────────────

type ListHandler = (params: ListParams) => { data: people_v1.Schema$ListConnectionsResponse };

const api = {
  listCalls: [] as ListParams[],
  updateCalls: [] as UpdateParams[],
  getCalls: [] as string[],
  onList: (() => ({ data: {} })) as ListHandler,
  onUpdate: (params: UpdateParams): { data: Person } => ({
    data: { ...params.requestBody, resourceName: params.resourceName, etag: `${params.resourceName}-pushed` },
  }),
  onGet: (resourceName: string): { data: Person } => ({ data: { resourceName, etag: "fresh" } }),
};

const peopleStub = {
  people: {
    connections: {
      list: async (params: ListParams) => {
        api.listCalls.push(params);
        return api.onList(params);
      },
    },
    updateContact: async (params: UpdateParams) => {
      api.updateCalls.push(params);
      return api.onUpdate(params);
    },
    get: async (params: { resourceName: string }) => {
      api.getCalls.push(params.resourceName);
      return api.onGet(params.resourceName);
    },
    createContact: async () => {
      throw new Error("unexpected createContact");
    },
    deleteContact: async () => {
      throw new Error("unexpected deleteContact");
    },
  },
};

google.__setGooglePeopleApiFactoryForTests(async () => peopleStub as unknown as people_v1.People);

const googleError = (status: number, apiStatus: string, message: string) =>
  Object.assign(new Error(message), {
    response: { status, data: { error: { code: status, status: apiStatus, message } } },
  });

const person = (n: number, overrides: Partial<Person> = {}): Person => ({
  resourceName: `people/c${n}`,
  etag: `e${n}`,
  metadata: {},
  names: [{ givenName: `Given${n}`, familyName: `Family${n}`, displayName: `Given${n} Family${n}` }],
  emailAddresses: [{ value: `p${n}@example.com`, type: "home" }],
  ...overrides,
});

const baseAccount = {
  id: "acct_1",
  userId: "user_1",
  label: "Google (test)",
  credentialReference: "unused-in-tests",
  lastSyncCursor: null as string | null,
  conflictPolicy: "MANUAL" as const,
  syncDirection: "TWO_WAY" as const,
};

// Run the way the runner does: the account row's cursor is re-read each run.
const runSync = (overrides: Partial<typeof baseAccount> = {}) =>
  google.runGoogleSync({
    ...baseAccount,
    lastSyncCursor: fake.lastCursorFor(baseAccount.id) ?? null,
    ...overrides,
  });

beforeEach(() => {
  fake.reset();
  api.listCalls = [];
  api.updateCalls = [];
  api.getCalls = [];
  api.onList = () => ({ data: {} });
  api.onUpdate = (params) => ({
    data: { ...params.requestBody, resourceName: params.resourceName, etag: `${params.resourceName}-pushed` },
  });
  api.onGet = (resourceName) => ({ data: { resourceName, etag: "fresh" } });
});

// Seed: a full import of the given people, leaving the cursor at "t0".
const seedFromGoogle = async (people: Person[]) => {
  api.onList = () => ({ data: { connections: people, nextSyncToken: "t0" } });
  await runSync({ lastSyncCursor: null });
  api.listCalls = [];
};

// ── A-04: incremental paging ─────────────────────────────────────────────────

test("incremental sync walks every page and advances the cursor once, at the end", async () => {
  const pages: Record<string, people_v1.Schema$ListConnectionsResponse> = {
    first: { connections: [person(1)], nextPageToken: "pg2" },
    pg2: { connections: [person(2)], nextPageToken: "pg3" },
    pg3: { connections: [person(3)], nextSyncToken: "t1" },
  };
  api.onList = (params) => ({ data: pages[params.pageToken ?? "first"]! });

  const summary = await google.googleIncrementalSync({ ...baseAccount, lastSyncCursor: "t0" });

  assert.equal(api.listCalls.length, 3);
  assert.deepEqual(
    api.listCalls.map((c) => [c.syncToken, c.pageToken]),
    [
      ["t0", undefined],
      ["t0", "pg2"],
      ["t0", "pg3"],
    ],
  );
  assert.equal(summary.created, 3, "contacts from every page are imported");
  const cursorWrites = fake.accountUpdates.filter((u) => "lastSyncCursor" in u.data);
  assert.equal(cursorWrites.length, 1);
  assert.equal(cursorWrites[0]!.data.lastSyncCursor, "t1");
});

test("a failure mid-stream leaves the stored cursor untouched", async () => {
  api.onList = (params) => {
    if (params.pageToken === "pg2") throw googleError(500, "INTERNAL", "backend error");
    return { data: { connections: [person(1)], nextPageToken: "pg2" } };
  };

  await assert.rejects(
    google.googleIncrementalSync({ ...baseAccount, lastSyncCursor: "t0" }),
    (error: unknown) => error instanceof google.GoogleSyncError,
  );
  assert.equal(fake.accountUpdates.filter((u) => "lastSyncCursor" in u.data).length, 0);
});

test("a stream that ends without a sync token never falls back to the old cursor", async () => {
  api.onList = () => ({ data: { connections: [person(1)] } });
  await google.googleIncrementalSync({ ...baseAccount, lastSyncCursor: "t0" });
  assert.equal(fake.lastCursorFor(baseAccount.id), null);
});

// ── A-22: expired sync token ─────────────────────────────────────────────────

test("400 FAILED_PRECONDITION on an expired sync token falls back to a full import", async () => {
  api.onList = (params) => {
    if (params.syncToken) {
      throw googleError(
        400,
        "FAILED_PRECONDITION",
        "Sync token is expired. Clear local cache and retry call without the sync token.",
      );
    }
    return { data: { connections: [person(1), person(2)], nextSyncToken: "fresh-token" } };
  };

  const summary = await google.googleIncrementalSync({ ...baseAccount, lastSyncCursor: "stale" });

  assert.equal(summary.created, 2);
  assert.equal(api.listCalls.at(-1)?.syncToken, undefined, "full import drops the token");
  assert.equal(fake.lastCursorFor(baseAccount.id), "fresh-token");
});

test("error classifiers recognise Google's precondition shapes", () => {
  const expired = googleError(400, "FAILED_PRECONDITION", "Sync token is expired.");
  const staleEtag = googleError(
    400,
    "FAILED_PRECONDITION",
    "Request person.etag is different than the current person.etag. Clear local cache and get the latest person.",
  );
  const badRequest = googleError(400, "INVALID_ARGUMENT", "Invalid phone number.");

  assert.equal(google.isGoogleExpiredSyncTokenError(expired), true);
  assert.equal(google.isGoogleExpiredSyncTokenError({ code: 410 }), true);
  assert.equal(google.isGoogleExpiredSyncTokenError(staleEtag), false);
  assert.equal(google.isGoogleExpiredSyncTokenError(badRequest), false);

  // gaxios variants that only carry a top-level status and message.
  const bareExpired = Object.assign(new Error("Sync token is expired. Clear local cache."), { status: 400 });
  const bareEtag = Object.assign(
    new Error("Request person.etag is different than the current person.etag."),
    { code: "400" },
  );
  assert.equal(google.isGoogleExpiredSyncTokenError(bareExpired), true);
  assert.equal(google.isGoogleStaleEtagError(bareEtag), true);
  assert.equal(google.isGoogleStaleEtagError(bareExpired), false);

  assert.equal(google.isGoogleStaleEtagError(staleEtag), true);
  assert.equal(google.isGoogleStaleEtagError({ response: { status: 412 } }), true);
  assert.equal(google.isGoogleStaleEtagError(expired), false);
  assert.equal(google.isGoogleStaleEtagError(badRequest), false);
});

// ── A-05: no false conflicts after a pull ────────────────────────────────────

test("import then immediate re-run produces zero conflicts and zero pushes", async () => {
  await seedFromGoogle([person(1), person(2)]);
  assert.equal(fake.contacts.size, 2);

  // Immediate re-run: nothing changed on either side.
  api.onList = () => ({ data: { connections: [], nextSyncToken: "t1" } });
  const rerun = await runSync();
  assert.equal(rerun.conflicts, 0);
  assert.equal(rerun.pushedCreated + rerun.pushedUpdated + rerun.pushedDeleted, 0);
  assert.equal(api.updateCalls.length, 0);

  // Google-side edits on the next two runs must apply as plain updates, not
  // conflicts: the pulls themselves are not local edits.
  for (const [etag, phone] of [
    ["e1-v2", "+447700900001"],
    ["e1-v3", "+447700900002"],
  ] as const) {
    api.onList = () => ({
      data: {
        connections: [person(1, { etag, phoneNumbers: [{ value: phone, type: "mobile" }] })],
        nextSyncToken: `after-${etag}`,
      },
    });
    const result = await runSync();
    assert.equal(result.conflicts, 0, `remote edit ${etag} must not conflict`);
    assert.equal(result.updated, 1);
  }
  assert.equal(fake.conflicts.length, 0);
  assert.equal(api.updateCalls.length, 0);

  for (const link of fake.links.values()) {
    const contact = fake.contacts.get(link.contactId as string)!;
    assert.ok(
      (link.lastSyncedAt as Date).getTime() >= (contact.updatedAt as Date).getTime(),
      "lastSyncedAt is anchored at or after the contact's updatedAt",
    );
  }
});

// ── A-01: the pushed mask matches the body ──────────────────────────────────

test("a Kontax edit pushes addresses/urls/title and only clears what the user emptied", async () => {
  await seedFromGoogle([
    person(1, {
      addresses: [{ formattedValue: "1 Main St, Springfield", streetAddress: "1 Main St", city: "Springfield", type: "home" }],
      urls: [{ value: "https://one.example.com", type: "work" }],
      organizations: [{ title: "Engineer" }],
      biographies: [{ value: "Met at a conference." }],
    }),
  ]);
  const contact = fake.contactByRemoteUid("people/c1")!;
  assert.equal(contact.jobTitle, "Engineer");

  // User adds a nickname and deletes the website; everything else untouched.
  await fake.editContact(contact.id, { nickname: "Uno", website: null, websiteEntries: null });
  api.onList = () => ({ data: { connections: [], nextSyncToken: "t1" } });
  const result = await runSync();

  assert.equal(result.pushedUpdated, 1);
  const call = api.updateCalls[0]!;
  const mask = new Set(call.updatePersonFields!.split(","));
  const body = call.requestBody!;

  assert.equal(body.addresses?.[0]?.streetAddress, "1 Main St");
  assert.equal(body.organizations?.[0]?.title, "Engineer");
  assert.equal(body.nicknames?.[0]?.value, "Uno");
  assert.equal(body.urls, undefined);
  for (const family of ["names", "nicknames", "emailAddresses", "organizations", "addresses", "biographies"]) {
    assert.ok(mask.has(family), `${family} in mask`);
  }
  assert.ok(mask.has("urls"), "the deleted website is cleared on purpose");
  assert.ok(!mask.has("phoneNumbers"), "never held, never sent: not masked");
  assert.ok(!mask.has("birthdays"));
  assert.equal(body.etag, "e1");
});

// ── A-07: per-contact isolation ─────────────────────────────────────────────

test("a 400 on contact N leaves N+1 pushed, records the error, and still imports", async () => {
  await seedFromGoogle([person(1), person(2), person(3)]);
  for (const n of [1, 2, 3]) {
    const contact = fake.contactByRemoteUid(`people/c${n}`)!;
    await fake.editContact(contact.id, { nickname: `Nick${n}` });
  }

  api.onUpdate = (params) => {
    if (params.resourceName === "people/c2") {
      throw googleError(400, "INVALID_ARGUMENT", "Invalid value at 'person.nicknames'.");
    }
    return { data: { ...params.requestBody, resourceName: params.resourceName, etag: `${params.resourceName}-pushed` } };
  };
  // A full import this time, so the unchanged failed contact is re-read too.
  api.onList = () => ({ data: { connections: [person(1), person(2), person(3)], nextSyncToken: "t1" } });

  const result = await runSync({ lastSyncCursor: null });

  assert.deepEqual(
    api.updateCalls.map((c) => c.resourceName),
    ["people/c1", "people/c2", "people/c3"],
  );
  assert.equal(result.pushedUpdated, 2);
  assert.equal(result.pushFailed, 1);
  assert.equal(api.listCalls.length, 1, "the import phase still ran");

  const failedLink = fake.linkByRemoteUid("people/c2")!;
  assert.equal(failedLink.lastErrorCode, "GOOGLE_SYNC_FAILED");
  assert.match(String(failedLink.lastErrorMessage), /nicknames/);
  assert.equal(fake.linkByRemoteUid("people/c3")!.lastErrorCode, null);

  // The failed edit stays pending: the import did not re-anchor it, so the
  // next run retries exactly that contact (and clears the error on success).
  api.updateCalls = [];
  api.onUpdate = (params) => ({
    data: { ...params.requestBody, resourceName: params.resourceName, etag: `${params.resourceName}-pushed` },
  });
  api.onList = () => ({ data: { connections: [], nextSyncToken: "t2" } });
  const retry = await runSync();
  assert.deepEqual(api.updateCalls.map((c) => c.resourceName), ["people/c2"]);
  assert.equal(retry.pushFailed, 0);
  assert.equal(fake.linkByRemoteUid("people/c2")!.lastErrorCode, null);
});

test("an auth failure during push still aborts the whole run", async () => {
  await seedFromGoogle([person(1), person(2)]);
  for (const n of [1, 2]) {
    await fake.editContact(fake.contactByRemoteUid(`people/c${n}`)!.id, { nickname: "x" });
  }
  api.onUpdate = () => {
    throw googleError(401, "UNAUTHENTICATED", "Request had invalid authentication credentials.");
  };

  await assert.rejects(
    runSync(),
    (error: unknown) =>
      error instanceof google.GoogleSyncError && error.code === "GOOGLE_AUTH_FAILED",
  );
  assert.equal(api.updateCalls.length, 1, "stops at the first account-level failure");
  assert.equal(api.listCalls.length, 0);
});

// ── A-22: stale etag on push ────────────────────────────────────────────────

test("400 FAILED_PRECONDITION on a stale etag refetches and opens a conflict", async () => {
  await seedFromGoogle([person(1)]);
  await fake.editContact(fake.contactByRemoteUid("people/c1")!.id, { nickname: "Mine" });

  api.onUpdate = () => {
    throw googleError(
      400,
      "FAILED_PRECONDITION",
      "Request person.etag is different than the current person.etag. Clear local cache and get the latest person.",
    );
  };
  api.onGet = (resourceName) => ({ data: person(1, { resourceName, etag: "e1-remote", nicknames: [{ value: "Theirs" }] }) });
  api.onList = () => ({ data: { connections: [], nextSyncToken: "t1" } });

  const result = await runSync();

  assert.deepEqual(api.getCalls, ["people/c1"]);
  assert.equal(result.conflicts, 1);
  assert.equal(result.pushFailed, 0);
  assert.equal(fake.conflicts[0]?.status, "OPEN");
  assert.equal(fake.conflicts[0]?.remoteETag, "e1-remote");
});
