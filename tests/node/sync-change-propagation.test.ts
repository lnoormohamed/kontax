// P49A-12 (A-16, A-17, A-20): every way a contact changes reaches the sync
// providers — an API edit and an iPhone edit through Kontax's CardDAV server
// are pushed to Google; "Delete permanently" deletes the Google copy, drops out
// of device REPORTs, never resurrects and is purged afterwards; restore brings
// it back; a merge relinks / pushes the survivor and keeps every field and
// membership; undo keeps later edits and is refused after 30 days.
//
// Real code paths (REST v1 PUT route, google-sync push / import, the DAV write
// builder + propagation module server.mjs uses, contact-deletion, contact-merge)
// against the in-memory Prisma stand-in and a stubbed People API — no network,
// no Postgres.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beforeEach, mock, test } from "node:test";

import type { people_v1 } from "@googleapis/people";

import { installFakeSyncDb } from "./_sync-fake-db";

const USER = "user_1";
const fake = installFakeSyncDb();

// The v1 route's token check is not under test.
mock.module("../../src/app/api/v1/_lib/auth", {
  namedExports: {
    withApiAuth: async (_req: unknown, handler: (userId: string, scope: string) => Promise<unknown>) =>
      handler(USER, "READ_WRITE"),
    requireWriteScope: () => null,
    resolveOwnedBookId: async (_userId: string, bookId: string | null) => ({ bookId }),
  },
});

const google = await import("~/server/google-sync");
const { PUT: apiPut } = await import("../../src/app/api/v1/contacts/[id]/route");
const { deleteContactsPermanently, purgeDeletedContacts } = await import("~/server/contact-deletion");
const { reviveContactSyncLinks } = await import("~/server/sync-dirty");
const { mergeContactsForUser, undoMergedContactsForUser, MergeUndoError } = await import(
  "~/server/contact-merge"
);
const { buildDavContactWriteData } = await import("~/server/dav/vcard.mjs");
const { DAV_DEVICE_MUTATION, flagDeviceWriteForSync } = await import("~/server/dav/sync-propagation.mjs");

type Person = people_v1.Schema$Person;
type Row = Record<string, unknown> & { id: string };

// ── People API stub ──────────────────────────────────────────────────────────

const api = {
  list: [] as Person[],
  updates: [] as people_v1.Params$Resource$People$Updatecontact[],
  deletes: [] as string[],
  creates: [] as Person[],
  failNextUpdate: false,
};

google.__setGooglePeopleApiFactoryForTests(
  async () =>
    ({
      people: {
        connections: {
          list: async () => ({ data: { connections: api.list, nextSyncToken: "t1" } }),
        },
        updateContact: async (params: people_v1.Params$Resource$People$Updatecontact) => {
          if (api.failNextUpdate) {
            api.failNextUpdate = false;
            throw Object.assign(new Error("bad"), {
              response: { status: 400, data: { error: { code: 400, status: "INVALID_ARGUMENT", message: "bad" } } },
            });
          }
          api.updates.push(params);
          return { data: { ...params.requestBody, resourceName: params.resourceName, etag: `${params.resourceName}-pushed` } };
        },
        deleteContact: async (params: { resourceName: string }) => {
          api.deletes.push(params.resourceName);
          return { data: {} };
        },
        createContact: async (params: { requestBody: Person }) => {
          api.creates.push(params.requestBody);
          return { data: { ...params.requestBody, resourceName: `people/new${api.creates.length}`, etag: "e-new" } };
        },
        get: async (params: { resourceName: string }) => ({ data: { resourceName: params.resourceName, etag: "fresh" } }),
      },
    }) as unknown as people_v1.People,
);

const account = {
  id: "acct_google",
  userId: USER,
  label: "Google (test)",
  credentialReference: "unused-in-tests",
  lastSyncCursor: null as string | null,
  conflictPolicy: "MANUAL" as const,
  syncDirection: "TWO_WAY" as const,
};

const person = (n: number, overrides: Partial<Person> = {}): Person => ({
  resourceName: `people/c${n}`,
  etag: `e${n}`,
  metadata: {},
  names: [{ givenName: `Given${n}`, familyName: `Family${n}`, displayName: `Given${n} Family${n}` }],
  emailAddresses: [{ value: `p${n}@example.com`, type: "home" }],
  ...overrides,
});

// Import the given people from Google (full import), as a first sync does.
const seedFromGoogle = async (people: Person[]) => {
  api.list = people;
  await google.runGoogleSync({ ...account, lastSyncCursor: null });
  api.updates = [];
};

const contactOf = (remoteUid: string): Row => fake.contactByRemoteUid(remoteUid)!;
const linkOf = (remoteUid: string): Row => fake.linkByRemoteUid(remoteUid)!;
const push = () => google.pushLocalChangesToGoogle(account);
const pushedBody = (index = 0): Person => api.updates[index]?.requestBody ?? {};

beforeEach(() => {
  fake.reset();
  api.list = [];
  api.updates = [];
  api.deletes = [];
  api.creates = [];
  api.failNextUpdate = false;
});

// ── A-17: non-web edits are local mutations ──────────────────────────────────

test("an API edit to a contact imported from Google is pushed back to Google", async () => {
  await seedFromGoogle([person(1)]);
  const contact = contactOf("people/c1");
  assert.equal(contact.lastMutatedBy, "SYNC_GOOGLE");

  const res = (await apiPut(
    new Request(`https://kontax.test/api/v1/contacts/${contact.id}`, {
      method: "PUT",
      body: JSON.stringify({ company: "Analytical Engines" }),
    }) as never,
    { params: Promise.resolve({ id: contact.id }) },
  )) as Response;
  assert.equal(res.status, 200);
  assert.equal(contactOf("people/c1").lastMutatedBy, "API");
  assert.ok(linkOf("people/c1").localDirtyAt instanceof Date, "the link is marked dirty");

  const tally = await push();
  assert.equal(tally.updated, 1);
  assert.equal(pushedBody().organizations?.[0]?.name, "Analytical Engines");
  assert.equal(linkOf("people/c1").localDirtyAt, null, "settled by the push");

  await push();
  assert.equal(api.updates.length, 1, "nothing left to push");
});

test("an iPhone edit through Kontax's CardDAV server is pushed to Google", async () => {
  await seedFromGoogle([person(2)]);
  const existing = contactOf("people/c2");

  // Exactly what server.mjs does for a PUT on an existing card.
  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `UID:${existing.syncUid as string}`,
    "FN:Given2 Family2",
    "N:Family2;Given2;;;",
    "EMAIL;TYPE=HOME:p2@example.com",
    "TEL;TYPE=CELL:+44 7700 900123",
    "END:VCARD",
  ].join("\r\n");
  const fields = buildDavContactWriteData(vcard, { jsonNull: null, existing });
  await fake.client.$transaction(async (tx: unknown) => {
    const client = tx as typeof fake.client;
    await client.contact.update({
      where: { id: existing.id },
      data: { ...fields, ...DAV_DEVICE_MUTATION, syncVersion: { increment: 1 } },
    });
    await flagDeviceWriteForSync(client as never, existing);
  });
  assert.equal(contactOf("people/c2").lastMutatedBy, "MANUAL");
  assert.ok(linkOf("people/c2").localDirtyAt instanceof Date);

  await push();
  assert.equal(api.updates.length, 1);
  assert.deepEqual(
    pushedBody().phoneNumbers?.map((p) => p.value),
    ["+44 7700 900123"],
  );
});

test("server.mjs marks every device PUT / DELETE as a local mutation", () => {
  const source = readFileSync(new URL("../../server.mjs", import.meta.url), "utf8");
  // personal, family and team collections: create + update + delete each.
  assert.equal(source.match(/\.\.\.DAV_DEVICE_MUTATION/g)?.length, 9);
  assert.equal(source.match(/await flagDeviceWriteForSync\(tx, existing\)/g)?.length, 3);
});

test("a pending API edit is not anchored away when its push fails and the pull finds no remote change", async () => {
  await seedFromGoogle([person(3)]);
  const contact = contactOf("people/c3");
  await apiPut(
    new Request(`https://kontax.test/api/v1/contacts/${contact.id}`, {
      method: "PUT",
      body: JSON.stringify({ jobTitle: "Analyst" }),
    }) as never,
    { params: Promise.resolve({ id: contact.id }) },
  );
  const syncedBefore = linkOf("people/c3").lastSyncedAt;

  api.failNextUpdate = true;
  api.list = [person(3)]; // unchanged remotely
  await google.runGoogleSync({ ...account, lastSyncCursor: null });
  assert.ok(linkOf("people/c3").localDirtyAt instanceof Date, "still dirty");
  assert.equal(linkOf("people/c3").lastSyncedAt, syncedBefore, "not anchored to the pull");

  await push();
  assert.equal(pushedBody().organizations?.[0]?.title, "Analyst");
});

// ── A-16: permanent delete ───────────────────────────────────────────────────

test("Delete permanently: Google gets a DELETE, devices stop listing it, nothing resurrects, then it is purged", async () => {
  await seedFromGoogle([person(4)]);
  const contact = contactOf("people/c4");
  const before = { updatedAt: contact.updatedAt as Date, syncVersion: contact.syncVersion as number };

  const result = await deleteContactsPermanently(fake.client as never, {
    userId: USER,
    contactIds: [contact.id],
    actor: "USER",
    source: "MANUAL",
  });
  assert.deepEqual(result.deferredIds, [contact.id], "held until Google has deleted it");
  const hidden = fake.contacts.get(contact.id)!;
  assert.ok(hidden.deletedAt instanceof Date && hidden.archivedAt instanceof Date && hidden.syncTombstoneAt);
  assert.ok((hidden.updatedAt as Date) > before.updatedAt, "the book CTag moves");
  assert.equal(hidden.syncVersion, before.syncVersion + 1, "the device ETag moves");
  // The Kontax CardDAV server lists (REPORT / PROPFIND) only this filter.
  const deviceListing = await fake.client.contact.findMany({
    where: { userId: USER, archivedAt: null, syncTombstoneAt: null },
  });
  assert.ok(!deviceListing.some((c) => c.id === contact.id), "device REPORT omits it");
  assert.equal(fake.events.at(-1)?.eventType, "CONTACT_DELETED");

  // Still linked → not purgeable yet, even after the grace period.
  const later = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  assert.equal((await purgeDeletedContacts({ now: later })).purged, 0);

  await push();
  assert.deepEqual(api.deletes, ["people/c4"]);
  assert.ok(linkOf("people/c4").tombstonedAt instanceof Date);

  // Google still lists it on a re-import: the tombstoned link keeps it from
  // coming back as a new contact.
  const count = fake.contacts.size;
  await seedFromGoogle([person(4)]);
  assert.equal(fake.contacts.size, count, "no resurrection");

  assert.equal((await purgeDeletedContacts()).purged, 0, "grace period for offline devices");
  assert.equal((await purgeDeletedContacts({ now: later })).purged, 1);
  assert.equal(fake.contacts.has(contact.id), false);
});

test("Delete permanently removes a trashed contact at once when no provider still has it", async () => {
  const trashed = await fake.client.contact.create({
    data: { userId: USER, fullName: "Old Friend", archivedAt: new Date(), lastMutatedBy: "MANUAL" },
  });
  const result = await deleteContactsPermanently(fake.client as never, {
    userId: USER,
    contactIds: [trashed.id],
    actor: "USER",
    source: "MANUAL",
  });
  assert.deepEqual(result.purgedIds, [trashed.id]);
  assert.equal(fake.contacts.has(trashed.id), false);
});

test("a link on a retired connection does not hold a purge back", async () => {
  await seedFromGoogle([person(5)]);
  const contact = contactOf("people/c5");
  await deleteContactsPermanently(fake.client as never, {
    userId: USER,
    contactIds: [contact.id],
    actor: "API",
    source: "API",
  });
  fake.accountStatus.set(account.id, "RETIRED");
  const later = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  assert.equal((await purgeDeletedContacts({ now: later })).purged, 1);
});

// ── A-20: restore ────────────────────────────────────────────────────────────

test("restoring a trashed contact re-creates it on Google", async () => {
  await seedFromGoogle([person(6)]);
  const contact = contactOf("people/c6");
  await fake.editContact(contact.id, { archivedAt: new Date(), syncTombstoneAt: new Date() });
  await push();
  assert.deepEqual(api.deletes, ["people/c6"]);

  // What restoreContact does: un-archive (MANUAL) + revive the links.
  await fake.editContact(contact.id, { archivedAt: null, syncTombstoneAt: null });
  await reviveContactSyncLinks(fake.client as never, contact.id);
  assert.equal([...fake.links.values()].filter((l) => l.contactId === contact.id).length, 0);

  const tally = await push();
  assert.equal(tally.created, 1, "created on Google again");
  assert.equal(api.creates[0]?.names?.[0]?.givenName, "Given6");
});

// ── A-20: merge and undo ─────────────────────────────────────────────────────

const localContact = (data: Record<string, unknown>) =>
  fake.client.contact.create({
    data: { userId: USER, lastMutatedBy: "MANUAL", sourceType: "MANUAL", ...data },
  });

test("merge: the absorbed contact's Google record is relinked to the survivor and updated in place; every field and book is kept", async () => {
  await seedFromGoogle([person(7, { names: [{ givenName: "Ada", familyName: "Lovelace", displayName: "Ada Lovelace" }] })]);
  const absorbed = contactOf("people/c7");
  await fake.editContact(absorbed.id, { phoneticFirstName: "AY-da", isEmergency: true, department: null });
  const survivor = await localContact({
    fullName: "Ada Lovelace",
    firstName: "Ada",
    lastName: "Lovelace",
    department: "Research",
    emailEntries: [{ label: "work", value: "ada@work.test", isPrimary: true }],
  });
  fake.memberships.push(
    { id: "m1", contactId: survivor.id, addressBookId: "book_home", isPrimary: true },
    { id: "m2", contactId: absorbed.id, addressBookId: "book_work", isPrimary: true },
  );
  fake.groupContacts.push({ id: "g1", contactId: absorbed.id, groupAddressBookId: "family_book" });

  const { decisionId } = await mergeContactsForUser({
    userId: USER,
    primaryContactId: survivor.id,
    secondaryContactId: absorbed.id,
    source: "test",
  });
  assert.ok(decisionId);

  const merged = fake.contacts.get(survivor.id)!;
  assert.equal(merged.department, "Research");
  assert.equal(merged.phoneticFirstName, "AY-da");
  assert.equal(merged.isEmergency, true);
  assert.deepEqual(
    fake.memberships.filter((m) => m.contactId === survivor.id).map((m) => [m.addressBookId, m.isPrimary]),
    [
      ["book_home", true],
      ["book_work", false],
    ],
  );
  assert.ok(fake.groupContacts.some((g) => g.contactId === survivor.id && g.groupAddressBookId === "family_book"));
  const link = linkOf("people/c7");
  assert.equal(link.contactId, survivor.id, "relinked to the survivor");
  assert.ok(link.localDirtyAt instanceof Date);
  assert.ok(fake.contacts.get(absorbed.id)!.archivedAt instanceof Date);

  const tally = await push();
  assert.deepEqual(api.deletes, [], "the Google record is kept");
  assert.equal(tally.created, 0, "…not re-created");
  assert.equal(api.updates[0]?.resourceName, "people/c7");
  assert.deepEqual(
    pushedBody().emailAddresses?.map((e) => e.value).sort(),
    ["ada@work.test", "p7@example.com"],
    "the merged record is pushed",
  );
});

test("merge: when both were on Google, the absorbed copy is deleted there and the survivor updated", async () => {
  await seedFromGoogle([person(8), person(9)]);
  const survivor = contactOf("people/c8");
  const absorbed = contactOf("people/c9");
  await mergeContactsForUser({
    userId: USER,
    primaryContactId: survivor.id,
    secondaryContactId: absorbed.id,
    source: "test",
  });
  await push();
  assert.deepEqual(api.deletes, ["people/c9"]);
  assert.deepEqual(
    api.updates.map((u) => u.resourceName),
    ["people/c8"],
  );
});

test("undo: fields edited after the merge are kept, the rest restored, links and books moved back", async () => {
  await seedFromGoogle([person(10)]);
  const absorbed = contactOf("people/c10");
  const survivor = await localContact({
    fullName: "Given10 Family10",
    company: "Before Co",
    jobTitle: "Before title",
    department: "Before dept",
  });
  await fake.editContact(absorbed.id, { company: "Absorbed Co", jobTitle: "Absorbed title" });
  fake.memberships.push({ id: "m9", contactId: absorbed.id, addressBookId: "book_work", isPrimary: true });
  const { decisionId } = await mergeContactsForUser({
    userId: USER,
    primaryContactId: survivor.id,
    secondaryContactId: absorbed.id,
    source: "test",
  });
  // A later edit to the survivor.
  await fake.editContact(survivor.id, { company: "Edited after merge" });

  const result = await undoMergedContactsForUser({ userId: USER, decisionId: decisionId! });
  assert.deepEqual(result.keptFields, ["company"]);
  const restored = fake.contacts.get(survivor.id)!;
  assert.equal(restored.company, "Edited after merge", "the later edit survives");
  assert.equal(restored.jobTitle, "Before title", "an untouched field is restored");
  assert.equal(restored.department, "Before dept");
  assert.ok(!fake.memberships.some((m) => m.contactId === survivor.id && m.addressBookId === "book_work"));

  const back = fake.contacts.get(absorbed.id)!;
  assert.equal(back.archivedAt, null);
  assert.equal(back.mergedIntoContactId, null);
  assert.equal(back.company, "Absorbed Co");
  const link = linkOf("people/c10");
  assert.equal(link.contactId, absorbed.id, "the Google record belongs to the absorbed contact again");
  assert.ok(link.localDirtyAt instanceof Date);

  await assert.rejects(
    undoMergedContactsForUser({ userId: USER, decisionId: decisionId! }),
    /already been undone/,
  );
});

test("undo is refused server-side after 30 days", async () => {
  const survivor = await localContact({ fullName: "Sam One" });
  const absorbed = await localContact({ fullName: "Sam One", email: "sam@x.test" });
  const { decisionId } = await mergeContactsForUser({
    userId: USER,
    primaryContactId: survivor.id,
    secondaryContactId: absorbed.id,
    source: "test",
  });
  const in31Days = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
  await assert.rejects(
    undoMergedContactsForUser({ userId: USER, decisionId: decisionId!, now: in31Days }),
    (error: unknown) => error instanceof MergeUndoError && error.message.includes("more than 30 days"),
  );
  assert.ok(fake.contacts.get(absorbed.id)!.archivedAt instanceof Date, "nothing was undone");
});

// Fable review of P49A-12 (M2): creates stay narrower than pushes. A contact
// someone shared with the user, or one that arrived by import, is not created
// on the user's own Google; one they made (or edited) themselves is.
test("only the user's own contacts are created on Google — not shared copies or imports", async () => {
  await localContact({ fullName: "Shared Live", firstName: "Shared", lastMutatedBy: "SHARED_LIVE", sourceType: "SHARED_LIVE" });
  await localContact({ fullName: "Shared Static", firstName: "Static", lastMutatedBy: "SHARED_STATIC", sourceType: "SHARED_STATIC" });
  await localContact({ fullName: "From CSV", firstName: "Csv", lastMutatedBy: "IMPORT_CSV", sourceType: "IMPORT_CSV" });
  await localContact({ fullName: "Mine", firstName: "Mine" });

  const tally = await push();
  assert.equal(tally.created, 1);
  assert.deepEqual(api.creates.map((p) => p.names?.[0]?.givenName), ["Mine"]);
});
