// P49A-19 item 2: a sync conflict "Manual merge" saves exactly the side the
// user picked for each field. The picks used to stay in the browser and the
// server unioned both sides with local winning.
//
// Pure rules (picks parsing, comparison rows, the merge write data) plus the
// real resolveSyncConflict server action against the in-memory Prisma
// stand-in, with the CardDAV push captured instead of sent.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { installFakeSyncDb } from "./_sync-fake-db";

const USER = "user_1";
const fake = installFakeSyncDb();

const pushed: Array<Record<string, unknown>> = [];

mock.module("~/server/auth/require-session", {
  namedExports: {
    requireUserId: async () => USER,
    requireSession: async () => ({ user: { id: USER } }),
    isSessionError: () => false,
    sessionErrorMessage: () => "",
    SessionError: class SessionError extends Error {},
  },
});
mock.module("~/server/billing", {
  namedExports: {
    assertCanCreateContactsTx: async () => undefined,
    assertCanCreateSyncAccount: async () => undefined,
    assertCanCreateSyncAccountTx: async () => undefined,
    assertCanUseCardDavSync: async () => undefined,
    lockUserForPlanCheck: async () => undefined,
  },
});
mock.module("~/server/carddav", {
  namedExports: {
    CardDavPreflightError: class CardDavPreflightError extends Error {},
    discoverCardDavAccount: async () => {
      throw new Error("unexpected discovery");
    },
    pushCardDavContact: async (args: { contact: Record<string, unknown>; remoteUid: string }) => {
      pushed.push(args.contact);
      return { href: `/card/${args.remoteUid}.vcf`, etag: "\"pushed\"" };
    },
  },
});
mock.module("~/server/sync-credentials", {
  namedExports: {
    decryptSyncCredentialPayload: () => ({ username: "u", password: "p" }),
    encryptSyncCredentialPayload: () => "enc",
    getSyncCredentialEncryptionStatus: () => ({ available: true }),
  },
});
mock.module("next/cache", {
  namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined },
});

const { parseConflictPicks, ConflictPicksError, CONFLICT_FIELDS } = await import("~/lib/sync-conflict-picks");
const { buildConflictRows, buildPickedMergeWriteData } = await import("~/server/sync-conflict-merge");
const { resolveSyncConflict } = await import("~/app/actions/sync");

// ── snapshots ────────────────────────────────────────────────────────────────

// As buildLocalConflictSnapshot records a contact (no department key).
const LOCAL = {
  id: "contact_x",
  syncUid: "uid-x",
  syncVersion: 3,
  fullName: "Ada Lovelace",
  firstName: "Ada",
  middleName: null,
  lastName: "Lovelace",
  namePrefix: null,
  nameSuffix: null,
  nickname: "Countess",
  emailEntries: [
    { label: "work", value: "ada@local.test", isPrimary: true },
    { label: "home", value: "ada@home.test", isPrimary: false },
  ],
  email: "ada@local.test",
  emailAddresses: ["ada@local.test", "ada@home.test"],
  phoneEntries: [{ label: "mobile", value: "+44 7700 900001", isPrimary: true }],
  phone: "+44 7700 900001",
  phoneNumbers: ["+44 7700 900001"],
  addressEntries: [],
  websiteEntries: [],
  company: "Local Co",
  jobTitle: "Mathematician",
  birthday: "1815-12-10",
  significantDates: [],
  notes: "local note",
  avatarUrl: null,
};

// A CardDAV card as the runner stores it for a conflict.
const REMOTE = {
  uid: "uid-x",
  fullName: "Augusta Ada King",
  firstName: "Augusta Ada",
  middleName: null,
  lastName: "King",
  namePrefix: "Countess",
  nameSuffix: null,
  nickname: null,
  emailAddresses: ["ada@remote.test"],
  emailEntries: [{ label: "work", value: "ada@remote.test", isPrimary: true }],
  phoneNumbers: ["+44 7700 900002"],
  phoneEntries: [{ label: "mobile", value: "+44 7700 900002", isPrimary: true }],
  company: "Remote Co",
  department: "Engines",
  jobTitle: null,
  website: null,
  websiteEntries: [],
  birthday: "1815-12-10",
  significantDates: [{ label: "anniversary", date: "1835-07-08", isPrimary: false }],
  address: null,
  postalAddresses: [],
  addressEntries: [],
  notes: "remote note",
};

// ── picks parsing ────────────────────────────────────────────────────────────

test("picks: known field keys with local / remote parse; nothing sent means none", () => {
  assert.deepEqual(parseConflictPicks('{"emails":"remote","company":"local"}'), {
    emails: "remote",
    company: "local",
  });
  assert.equal(parseConflictPicks(null), null);
  assert.equal(parseConflictPicks(""), null);
});

test("picks: unknown keys, bad values, malformed JSON and non-objects are rejected", () => {
  for (const raw of [
    '{"emails":"remote","password":"local"}',
    '{"emails":"both"}',
    '{"emails":1}',
    "{not json",
    '["remote"]',
    '"remote"',
    "x".repeat(5_000),
  ]) {
    assert.throws(() => parseConflictPicks(raw), ConflictPicksError, raw.slice(0, 40));
  }
});

// ── comparison rows ──────────────────────────────────────────────────────────

test("rows are keyed by field, read multi-value families from the entries and skip empty fields", () => {
  const rows = buildConflictRows(LOCAL, REMOTE);
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
  assert.deepEqual(
    rows.map((row) => row.key),
    ["fullName", "nickname", "emails", "phones", "company", "department", "jobTitle", "birthday", "dates", "notes"],
  );
  assert.equal(byKey.emails?.local, "ada@local.test | ada@home.test");
  assert.equal(byKey.emails?.remote, "ada@remote.test");
  assert.equal(byKey.department?.local, "—");
  assert.equal(byKey.dates?.remote, "anniversary: 1835-07-08");
  // every key is a field the server accepts
  const known = new Set(CONFLICT_FIELDS.map((field) => field.key));
  assert.ok(rows.every((row) => known.has(row.key)));
});

// ── the merge ────────────────────────────────────────────────────────────────

test("each field comes from exactly the picked side — no union, no concatenated notes", () => {
  const data = buildPickedMergeWriteData(LOCAL, REMOTE, { emails: "remote", company: "remote" });
  // picked remote
  assert.deepEqual(
    (data.emailEntries as Array<{ value: string }>).map((e) => e.value),
    ["ada@remote.test"],
    "the local emails are not unioned in",
  );
  assert.equal(data.email, "ada@remote.test", "legacy columns derived from the chosen entries");
  assert.deepEqual(data.emailAddresses, ["ada@remote.test"]);
  assert.equal(data.company, "Remote Co");
  // unpicked → the preselected side, "Kontax (local)"
  assert.equal(data.fullName, "Ada Lovelace");
  assert.equal(data.firstName, "Ada");
  assert.deepEqual(
    (data.phoneEntries as Array<{ value: string }>).map((e) => e.value),
    ["+44 7700 900001"],
  );
  assert.equal(data.notes, "local note");
  assert.equal(data.jobTitle, "Mathematician");
  assert.equal(data.nickname, "Countess");
  // the local snapshot never recorded department → left as the contact holds it
  assert.ok(!("department" in data));
});

test("the name row carries the structured name; remote dates, department and empties apply as picked", () => {
  const data = buildPickedMergeWriteData(LOCAL, REMOTE, {
    fullName: "remote",
    department: "remote",
    dates: "remote",
    jobTitle: "remote",
    nickname: "remote",
    phones: "local",
  });
  assert.equal(data.fullName, "Augusta Ada King");
  assert.equal(data.firstName, "Augusta Ada");
  assert.equal(data.lastName, "King");
  assert.equal(data.namePrefix, "Countess");
  assert.equal(data.department, "Engines");
  assert.deepEqual(data.significantDates, REMOTE.significantDates);
  assert.equal(data.jobTitle, null, "remote had none — cleared, as picked");
  assert.equal(data.nickname, null);
});

test("with no picks at all every field is the local side (what the review UI preselects)", () => {
  const data = buildPickedMergeWriteData(LOCAL, REMOTE, null);
  assert.equal(data.company, "Local Co");
  assert.equal(data.notes, "local note");
  assert.deepEqual(
    (data.emailEntries as Array<{ value: string }>).map((e) => e.value),
    ["ada@local.test", "ada@home.test"],
  );
});

// ── the server action ────────────────────────────────────────────────────────

const seedConflict = async () => {
  const contact = await fake.client.contact.create({
    data: {
      userId: USER,
      fullName: LOCAL.fullName,
      firstName: LOCAL.firstName,
      lastName: LOCAL.lastName,
      nickname: LOCAL.nickname,
      emailEntries: LOCAL.emailEntries,
      email: LOCAL.email,
      emailAddresses: LOCAL.emailAddresses,
      phoneEntries: LOCAL.phoneEntries,
      phone: LOCAL.phone,
      phoneNumbers: LOCAL.phoneNumbers,
      company: LOCAL.company,
      department: "Local dept",
      jobTitle: LOCAL.jobTitle,
      birthday: LOCAL.birthday,
      notes: LOCAL.notes,
      lastMutatedBy: "MANUAL",
    },
  });
  const link = await fake.client.syncContactLink.create({
    data: { syncAccountId: "acct_dav", contactId: contact.id, remoteUid: "uid-x", remoteHref: "/card/uid-x.vcf" },
  });
  const other = await fake.client.syncContactLink.create({
    data: { syncAccountId: "acct_google", contactId: contact.id, remoteUid: "people/c1" },
  });
  const conflict = await fake.client.syncConflict.create({
    data: {
      syncAccountId: "acct_dav",
      syncContactLinkId: link.id,
      contactId: contact.id,
      status: "OPEN",
      remoteETag: "\"r2\"",
      localSnapshot: { ...LOCAL, id: contact.id },
      remoteSnapshot: REMOTE,
      // what the action's relation select reads
      syncAccount: {
        id: "acct_dav",
        userId: USER,
        provider: "CARDDAV",
        baseUrl: "https://dav.example.test",
        label: "Fastmail",
        addressBookUrl: "https://dav.example.test/book/",
        credentialReference: "enc",
        settings: null,
      },
      syncContactLink: { id: link.id, remoteUid: "uid-x" },
      contact: { ...contact },
    },
  });
  return { contact, link, other, conflict };
};

const resolve = (conflictId: string, picks: string | null) => {
  const form = new FormData();
  form.set("syncConflictId", conflictId);
  form.set("resolutionStrategy", "MANUAL_MERGE");
  if (picks !== null) form.set("fieldPicks", picks);
  return resolveSyncConflict(form);
};

beforeEach(() => {
  fake.reset();
  pushed.length = 0;
});

test("Save merged contact stores and pushes exactly the picked fields, and flags the other providers", async () => {
  const { contact, link, other, conflict } = await seedConflict();

  await resolve(
    conflict.id,
    JSON.stringify({ fullName: "local", emails: "remote", phones: "local", company: "remote", notes: "remote" }),
  );

  const saved = fake.contacts.get(contact.id)!;
  assert.deepEqual(
    (saved.emailEntries as Array<{ value: string }>).map((e) => e.value),
    ["ada@remote.test"],
  );
  assert.equal(saved.email, "ada@remote.test");
  assert.equal(saved.company, "Remote Co");
  assert.equal(saved.notes, "remote note");
  assert.equal(saved.fullName, "Ada Lovelace");
  assert.equal(saved.department, "Local dept", "not in the local snapshot → kept as stored");

  assert.equal(pushed.length, 1);
  assert.equal(pushed[0]!.company, "Remote Co");
  assert.equal(pushed[0]!.department, "Local dept", "pushed from what was stored");
  assert.deepEqual(pushed[0]!.emailAddresses, ["ada@remote.test"]);

  assert.equal(fake.conflicts.find((c) => c.id === conflict.id)?.status, "RESOLVED");
  assert.equal(fake.links.get(link.id)!.localDirtyAt, null, "this provider was just pushed");
  assert.ok(fake.links.get(other.id)!.localDirtyAt instanceof Date, "Google gets it next sync");
});

test("invalid picks are refused before anything is written", async () => {
  const { contact, conflict } = await seedConflict();
  await assert.rejects(resolve(conflict.id, '{"emails":"remote","ssn":"local"}'), /Invalid field choices/);
  assert.equal(fake.contacts.get(contact.id)!.company, "Local Co");
  assert.equal(pushed.length, 0);
  assert.equal(fake.conflicts.find((c) => c.id === conflict.id)?.status, "OPEN");
});
