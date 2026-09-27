// P49A-10 (A-14): one canonical representation for emails, phones, addresses
// and websites. The typed `*Entries` columns are the source of truth; the
// legacy `email`/`emailAddresses`, `phone`/`phoneNumbers`, `address`/
// `postalAddresses` and `website` columns are derived from them by
// src/server/dav/contact-multi-values.mjs on every write.
//
// The acceptance path runs the real CSV commit route, the real contact server
// actions and the real DAV serializer against an in-memory Prisma stand-in —
// no Postgres. The backfill migration's SQL was checked against its JS twin
// (reconcileLegacyIntoEntries) on a throwaway local cluster; the pure rules are
// pinned here.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";

import { Prisma } from "../../generated/prisma";
import {
  buildMultiValueWriteData,
  deriveMultiValueFields,
  familiesHeldBy,
  familiesPresentIn,
  normalizeAddressEntries,
  normalizeValueEntries,
  readMultiValueEntries,
  reconcileLegacyIntoEntries,
  snapshotMultiValueWriteData,
} from "../../src/server/dav/contact-multi-values.mjs";
import { parseVCardToContactFields, serializeContactToVCard } from "../../src/server/dav/vcard.mjs";

type Row = Record<string, unknown>;

const DB_NULL = Symbol("DbNull");

// ── pure module ───────────────────────────────────────────────────────────────

test("entries normalise without inventing labels or reassigning primacy", () => {
  const entries = normalizeValueEntries([
    { label: " Work ", value: " a@x.test ", isPrimary: true, e164: "kept" },
    { label: "work", value: "A@X.test" }, // same label + value → duplicate
    { label: "Home", value: "a@x.test" }, // same value, other label → kept
    { value: "  " },
    "not-an-entry",
    { value: "b@x.test" },
  ]);
  assert.deepEqual(entries, [
    { label: "Work", value: "a@x.test", isPrimary: true, e164: "kept" },
    { label: "Home", value: "a@x.test", isPrimary: false },
    { label: "", value: "b@x.test", isPrimary: false },
  ]);
});

test("legacy columns are derived from entries: primary scalar, distinct flat values", () => {
  const derived = deriveMultiValueFields({
    emailEntries: [
      { label: "Home", value: "home@x.test", isPrimary: false },
      { label: "Work", value: "work@x.test", isPrimary: true },
      { label: "Other", value: "WORK@x.test", isPrimary: false },
    ],
    phoneEntries: [{ label: "mobile", value: "07799 720622", e164: "+447799720622", isPrimary: true }],
    addressEntries: [{ label: "Home", street: "5 Market St", city: "Leeds", country: "UK" }],
    websiteEntries: [],
  });
  assert.equal(derived.email, "work@x.test");
  assert.deepEqual(derived.emailAddresses, ["home@x.test", "work@x.test"]);
  assert.equal(derived.phone, "07799 720622");
  assert.deepEqual(derived.phoneNumbers, ["+447799720622"], "the e164 form, as the web form wrote it");
  assert.equal(derived.address, "5 Market St, Leeds, UK", "formatted is built from the web-editor keys");
  assert.deepEqual(derived.postalAddresses, [{ label: "Home", formatted: "5 Market St, Leeds, UK" }]);
  assert.equal(derived.website, null);
});

test("write data: an empty family is cleared, an undefined family is left out", () => {
  const data = buildMultiValueWriteData(
    { emailEntries: [], phoneEntries: [{ label: "Mobile", value: "+1 555 0100" }] },
    { jsonNull: DB_NULL },
  );
  assert.deepEqual(data, {
    emailEntries: DB_NULL,
    email: null,
    emailAddresses: DB_NULL,
    phoneEntries: [{ label: "Mobile", value: "+1 555 0100", isPrimary: false }],
    phone: "+1 555 0100",
    phoneNumbers: ["+1 555 0100"],
  });
  assert.ok(!("addressEntries" in data) && !("address" in data) && !("website" in data));
});

test("reader: typed entries win; legacy columns only when the entries are empty", () => {
  const typed = readMultiValueEntries({
    email: "stale@x.test",
    emailAddresses: ["stale@x.test"],
    emailEntries: [{ label: "Work", value: "a@x.test", isPrimary: true }],
  });
  assert.deepEqual(typed.emailEntries.map((e) => e.value), ["a@x.test"]);

  const legacyOnly = readMultiValueEntries({
    email: "a@x.test",
    emailAddresses: ["a@x.test", "b@x.test", "c@x.test"],
    emailEntries: null,
    address: "1 Main St",
    postalAddresses: [{ label: "work", formatted: "2 Side St" }],
  });
  assert.deepEqual(legacyOnly.emailEntries, [
    { label: "other", value: "a@x.test", isPrimary: true },
    { label: "other", value: "b@x.test", isPrimary: false },
    { label: "other", value: "c@x.test", isPrimary: false },
  ]);
  assert.deepEqual(
    legacyOnly.addressEntries.map((e) => [e.label, e.formatted, e.isPrimary]),
    [
      ["other", "1 Main St", true],
      ["work", "2 Side St", false],
    ],
  );
});

test("reconcile (the backfill rule): legacy values missing from entries are appended as 'other'", () => {
  const reconciled = reconcileLegacyIntoEntries({
    email: "New@x.test",
    emailAddresses: ["a@x.test", "B@x.test"],
    emailEntries: [{ label: "Work", value: "A@x.test", isPrimary: true }],
    phone: "07799720622",
    phoneNumbers: ["+447799720622", "+1 (555) 010-0101"],
    phoneEntries: [{ label: "mobile", value: "07799 720622", e164: "+447799720622", isPrimary: true }],
    address: "1 Main St",
    postalAddresses: [{ label: "work", formatted: "2 Side St" }],
    addressEntries: [{ label: "Home", formatted: "1 main st" }],
    website: "https://w.test",
    websiteEntries: null,
  });
  assert.deepEqual(
    reconciled.emailEntries.map((e) => [e.label, e.value, e.isPrimary]),
    [
      ["Work", "A@x.test", true],
      ["other", "New@x.test", false],
      ["other", "B@x.test", false],
    ],
  );
  assert.deepEqual(
    reconciled.phoneEntries.map((e) => e.value),
    ["07799 720622", "+1 (555) 010-0101"],
    "e164 and formatting-insensitive matches are not duplicated",
  );
  assert.deepEqual(
    reconciled.addressEntries.map((e) => [e.label, e.formatted]),
    [
      ["Home", "1 main st"],
      ["work", "2 Side St"],
    ],
  );
  assert.deepEqual(reconciled.websiteEntries, [{ label: "other", value: "https://w.test", isPrimary: true }]);

  // Idempotent: reconciling the reconciled contact changes nothing.
  const again = reconcileLegacyIntoEntries({ ...deriveMultiValueFields(reconciled), ...reconciled });
  assert.deepEqual(again, reconciled);
});

test("a snapshot only writes the families it carries; an empty one only when clearable", () => {
  assert.deepEqual(familiesPresentIn({ fullName: "x", phoneEntries: [] }), ["phones"]);
  const cleared = snapshotMultiValueWriteData(
    { fullName: "x", phoneEntries: [] },
    { jsonNull: DB_NULL, clearable: ["phones"] },
  );
  assert.deepEqual(cleared, { phoneEntries: DB_NULL, phone: null, phoneNumbers: DB_NULL });
  // Not clearable (no evidence / "partial" family): an empty list is skipped…
  assert.deepEqual(
    snapshotMultiValueWriteData({ fullName: "x", phoneEntries: [] }, { jsonNull: DB_NULL, clearable: [] }),
    {},
  );
  // …but a non-empty one always applies.
  const applied = snapshotMultiValueWriteData(
    { fullName: "x", phoneEntries: [{ label: "Mobile", value: "+1 555 0100", isPrimary: true }] },
    { jsonNull: DB_NULL, clearable: [] },
  );
  assert.equal(applied.phone, "+1 555 0100");
});

test("null keys and raw provider arrays are not carried Kontax families", () => {
  // A P39-03-stripped snapshot nulls a family: not carried, never cleared.
  assert.deepEqual(
    familiesPresentIn({ address: null, postalAddresses: null, addressEntries: null, email: "a@x.test" }),
    ["emails"],
  );
  // Google's raw Person arrays are objects, not Kontax's legacy strings.
  assert.deepEqual(
    familiesPresentIn({
      emailAddresses: [{ value: "a@x.test", type: "home" }],
      phoneNumbers: [{ value: "+15550100" }],
    }),
    [],
  );
  assert.deepEqual(familiesPresentIn({ emailAddresses: ["a@x.test"], postalAddresses: [{ formatted: "1 Rd" }] }), [
    "emails",
    "addresses",
  ]);
});

test("familiesHeldBy reads a shadow through the reader (typed or legacy keys)", () => {
  assert.deepEqual(familiesHeldBy(null), []);
  assert.deepEqual(
    familiesHeldBy({ phoneEntries: [], emailAddresses: ["a@x.test"], website: "https://w.test" }),
    ["emails", "websites"],
  );
});

test("address normalisation keeps both vocabularies and builds a missing formatted", () => {
  const [entry] = normalizeAddressEntries([
    { label: "Work", streetLine1: "1 Loop", cityOrTown: "Cupertino", stateOrProvince: "CA", postcode: "95014" },
  ]);
  assert.equal(entry?.formatted, "1 Loop, Cupertino, CA, 95014");
  assert.equal(entry?.streetLine1, "1 Loop");
});

// ── acceptance: CSV → editor → save → device ───────────────────────────────────

const USER = "user_1";
const state = { contacts: [] as Row[], jobs: new Map<string, Row>() };
let seq = 0;

const applyWrite = (row: Row, data: Row): Row => {
  const next: Row = { ...row, updatedAt: new Date() };
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && "increment" in (value as Row)) {
      next[key] = Number(row[key] ?? 0) + Number((value as { increment: number }).increment);
    } else {
      next[key] = value;
    }
  }
  return next;
};

const stub: Record<string, unknown> = {
  user: {
    findUnique: async ({ select }: { select?: Row }) => {
      if (select && "autoFillPhoneticNames" in select) return { autoFillPhoneticNames: false };
      return {
        lifecycleState: "ACTIVE",
        subscriptions: [{ plan: "PRO", memberSlotsLimit: null }],
        groupMemberships: [],
      };
    },
  },
  contact: {
    count: async () => state.contacts.length,
    createMany: async ({ data }: { data: Row[] }) => {
      for (const row of data) {
        state.contacts.push({ id: `c_${++seq}`, syncUid: `uid_${seq}`, syncVersion: 1, ...row });
      }
      return { count: data.length };
    },
    findMany: async ({ where }: { where: Row }) =>
      state.contacts.filter((c) => c.importJobId === where.importJobId).map((c) => ({ id: c.id })),
    findFirst: async ({ where }: { where: { id: string } }) =>
      state.contacts.find((c) => c.id === where.id) ?? null,
    update: async ({ where, data }: { where: { id: string }; data: Row }) => {
      const index = state.contacts.findIndex((c) => c.id === where.id);
      const next = applyWrite(state.contacts[index]!, data);
      state.contacts[index] = next;
      return next;
    },
  },
  importJob: {
    count: async () => 0,
    findFirst: async ({ where }: { where: { id: string } }) => state.jobs.get(where.id) ?? null,
    create: async ({ data }: { data: Row }) => {
      const row = { id: `job_${++seq}`, importedCount: 0, previewedAt: null, ...data };
      state.jobs.set(row.id, row);
      return row;
    },
    update: async ({ where, data }: { where: { id: string }; data: Row }) => {
      const next = applyWrite(state.jobs.get(where.id)!, data);
      state.jobs.set(where.id, next);
      return next;
    },
    updateMany: async () => ({ count: 0 }),
  },
  activityEvent: { createMany: async () => ({ count: 0 }) },
  syncAccount: { count: async () => 0 },
  appPassword: { count: async () => 0 },
  $queryRaw: async () => [],
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(stub),
};

mock.module("~/server/db", { namedExports: { db: stub } });
mock.module("~/server/auth/require-session", {
  namedExports: {
    requireUserId: async () => USER,
    requireSession: async () => ({ user: { id: USER } }),
    isSessionError: () => false,
    sessionErrorMessage: () => "",
    SessionError: class SessionError extends Error {},
  },
});
mock.module("~/server/shared-access", {
  namedExports: { resolveContactEditAccess: async () => ({ shared: false, allowed: true }) },
});
mock.module("~/server/contact-shares", { namedExports: { propagateLiveShares: async () => undefined } });
mock.module("~/lib/activity", { namedExports: { emitEvent: async () => undefined } });
mock.module("next/cache", {
  namedExports: { revalidatePath: () => undefined, revalidateTag: () => undefined },
});
class RedirectSignal extends Error {}
mock.module("next/navigation", {
  namedExports: {
    redirect: (url: string) => {
      throw new RedirectSignal(url);
    },
    notFound: () => {
      throw new Error("notFound");
    },
  },
});

const { POST: csvCommit } = await import("../../src/app/api/imports/contacts/commit/route");
const { updateContact, updateContactEntries, updateContactField } = await import("~/app/actions/contacts");

beforeEach(() => {
  state.contacts = [];
  state.jobs = new Map();
});

const THREE_EMAIL_CSV =
  "Name,Email,Email 2,Email 3,Phone\nAda Lovelace,ada@one.test,ada@two.test,ada@three.test,+44 20 7946 0000\n";

const importCsv = async (csvText: string) => {
  const res = await csvCommit(
    new Request("https://kontax.test/api/imports/contacts/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csvText, profile: "GENERIC", sourceFileName: "people.csv" }),
    }),
  );
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
  assert.equal(state.contacts.length, 1);
  return state.contacts[0]!;
};

// What the contact page hands the editor (contacts/[id]/page.tsx: editorEntries).
const editorEmails = (row: Row) =>
  readMultiValueEntries(row).emailEntries.map((e) => ({ label: e.label || "Work", value: e.value }));

const emailValues = (row: Row) => readMultiValueEntries(row).emailEntries.map((e) => e.value);

const saveThroughMobileSheet = async (row: Row, firstName: string) => {
  // The mobile edit sheet's FormData contract (mobile-contact-sheet.tsx).
  const emails = editorEmails(row);
  const phones = readMultiValueEntries(row).phoneEntries.map((e) => ({ label: e.label, value: e.value }));
  const fd = new FormData();
  const set = (key: string, value: string | undefined) => {
    if (value?.trim()) fd.set(key, value.trim());
  };
  set("contactId", row.id as string);
  set("firstName", firstName);
  set("lastName", "Lovelace");
  set("phone", phones[0]?.value);
  set("phoneLabel", phones[0]?.label);
  set("email", emails[0]?.value);
  set("emailLabel", emails[0]?.label);
  set("secondaryEmail", emails[1]?.value);
  set("secondaryEmailLabel", emails[1]?.label);
  set("additionalEmails", emails.slice(2).map((e) => e.value).join("\n"));
  await assert.rejects(updateContact(fd), RedirectSignal);
  return state.contacts.find((c) => c.id === row.id)!;
};

test("CSV with three emails → typed entries hold all three, legacy derived", async () => {
  const row = await importCsv(THREE_EMAIL_CSV);
  assert.deepEqual(
    (row.emailEntries as Row[]).map((e) => e.value),
    ["ada@one.test", "ada@two.test", "ada@three.test"],
  );
  assert.equal(row.email, "ada@one.test");
  assert.deepEqual(row.emailAddresses, ["ada@one.test", "ada@two.test", "ada@three.test"]);
  assert.deepEqual((row.phoneEntries as Row[]).map((e) => e.value), ["+44 20 7946 0000"]);
  assert.equal(row.phone, "+44 20 7946 0000");
  // The editor shows three.
  assert.equal(editorEmails(row).length, 3);
});

test("editing the name keeps all three emails (full save and inline editor)", async () => {
  const imported = await importCsv(THREE_EMAIL_CSV);

  const saved = await saveThroughMobileSheet(imported, "Augusta Ada");
  assert.equal(saved.firstName, "Augusta Ada");
  assert.deepEqual(emailValues(saved), ["ada@one.test", "ada@two.test", "ada@three.test"]);
  assert.deepEqual(saved.emailAddresses, ["ada@one.test", "ada@two.test", "ada@three.test"]);
  assert.equal(saved.email, "ada@one.test");

  // Inline editor: a name change goes through updateContactField and never
  // touches the emails; an email-group save rewrites entries AND legacy.
  await updateContactField(saved.id as string, "firstName", "Ada");
  const renamed = state.contacts[0]!;
  assert.deepEqual(emailValues(renamed), ["ada@one.test", "ada@two.test", "ada@three.test"]);

  await updateContactEntries(
    renamed.id as string,
    "emails",
    editorEmails(renamed).filter((e) => e.value !== "ada@two.test"),
  );
  const pruned = state.contacts[0]!;
  assert.deepEqual(emailValues(pruned), ["ada@one.test", "ada@three.test"]);
  assert.deepEqual(pruned.emailAddresses, ["ada@one.test", "ada@three.test"], "legacy no longer goes stale");
});

test("a device GET of the saved contact returns all three emails", async () => {
  const imported = await importCsv(THREE_EMAIL_CSV);
  const saved = await saveThroughMobileSheet(imported, "Ada");
  const vcard = serializeContactToVCard({ ...saved, syncUid: saved.syncUid as string, fullName: saved.fullName as string });
  const emailLines = vcard.split("\r\n").filter((line) => /^(item\d+\.)?EMAIL/.test(line));
  assert.equal(emailLines.length, 3, vcard);
  assert.deepEqual(parseVCardToContactFields(vcard).emailAddresses, [
    "ada@one.test",
    "ada@two.test",
    "ada@three.test",
  ]);
});

test("a device GET of a not-yet-backfilled CSV row still returns every email", () => {
  // Pre-P49A-10 CSV rows hold only the legacy arrays until the migration runs.
  const vcard = serializeContactToVCard({
    syncUid: "legacy-1",
    fullName: "Legacy",
    email: "a@x.test",
    emailAddresses: ["a@x.test", "b@x.test", "c@x.test"],
    emailEntries: null,
  });
  assert.equal(vcard.split("\r\n").filter((line) => line.startsWith("EMAIL")).length, 3);
});

test("inline primary-email edit rewrites the primary entry instead of the scalar alone", async () => {
  const row = await importCsv(THREE_EMAIL_CSV);
  await updateContactField(row.id as string, "email", "Ada@Primary.test");
  const updated = state.contacts[0]!;
  assert.equal(updated.email, "ada@primary.test");
  assert.deepEqual(emailValues(updated), ["ada@primary.test", "ada@two.test", "ada@three.test"]);

  await updateContactField(row.id as string, "email", "");
  const cleared = state.contacts[0]!;
  assert.deepEqual(emailValues(cleared), ["ada@two.test", "ada@three.test"]);
  assert.equal(cleared.email, "ada@two.test", "the next entry becomes the primary");
});

test("inline primary-phone edit recomputes the phone metadata for the new number", async () => {
  const row = await importCsv(THREE_EMAIL_CSV);
  // Give the stored primary phone full P37 metadata, as the web form writes it.
  Object.assign(row, {
    phoneEntries: [
      {
        label: "mobile",
        value: "+44 20 7946 0000",
        isPrimary: true,
        rawInput: "+44 20 7946 0000",
        e164: "+442079460000",
        national: "020 7946 0000",
        displayInternational: "+44 20 7946 0000",
        numberType: "FIXED_LINE",
        validationStatus: "valid",
      },
      { label: "work", value: "+1 212 555 0100", isPrimary: false },
    ],
  });

  await updateContactField(row.id as string, "phone", "+1 415 555 0132");
  const updated = state.contacts[0]!;
  const [primary, other] = updated.phoneEntries as Row[];
  assert.equal(primary?.label, "mobile", "the label is kept");
  assert.equal(primary?.isPrimary, true);
  assert.equal(primary?.e164, "+14155550132", "e164 is the NEW number's");
  assert.notEqual(primary?.national, "020 7946 0000");
  assert.equal(primary?.rawInput, "+1 415 555 0132");
  assert.equal(other?.value, "+1 212 555 0100", "other entries untouched");
  assert.deepEqual(updated.phoneNumbers, ["+14155550132", "+1 212 555 0100"]);
  assert.equal(updated.phone, primary?.value);
  assert.ok(
    !updated.phoneNumbers.includes("+442079460000"),
    "the old number is gone from the derived array (and so from search)",
  );
});

test("emptying a family in the full form clears it (entries and legacy)", async () => {
  const row = await importCsv(THREE_EMAIL_CSV);
  const fd = new FormData();
  fd.set("contactId", row.id as string);
  fd.set("firstName", "Ada");
  await assert.rejects(updateContact(fd), RedirectSignal);
  const saved = state.contacts[0]!;
  assert.equal(saved.emailEntries, Prisma.DbNull);
  assert.equal(saved.emailAddresses, Prisma.DbNull);
  assert.equal(saved.email, null);
  assert.deepEqual(readMultiValueEntries(saved).emailEntries, []);
});
