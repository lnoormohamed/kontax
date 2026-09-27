// P49A-03 (A-03, A-21): the CardDAV sync run end to end — runQueuedSyncJobs
// against an in-memory database (tests/node/_sync-fake-db.ts, extended below
// with the job/settings/upsert shapes the CardDAV branch uses) and an
// in-memory CardDAV server standing in for iCloud. No Postgres, no network.
//
// Covers the ticket's acceptance: an iCloud card edited in Kontax keeps its
// X-ABDATE / IMPP / X-ABRELATEDNAMES / CATEGORIES; a PUT that loses its
// If-Match race creates one conflict and overwrites nothing; a book with two
// cards sharing a UID syncs.
import test, { beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

import { createFakeSyncDb } from "./_sync-fake-db";
import { createFakeCardDavServer, vcard, vcardLines } from "./_fake-carddav-server";

process.env.SYNC_CREDENTIAL_ENCRYPTION_KEY = "11".repeat(32);

type Row = Record<string, unknown> & { id: string };

// ── In-memory database ─────────────────────────────────────────────────────
const fake = createFakeSyncDb();
const client = fake.client as unknown as Record<string, Record<string, unknown>>;
const jobs: Row[] = [];
const accounts = new Map<string, Row>();
let accountSettings: Record<string, unknown> | null = null;
let jobSeq = 0;

client.syncJob = {
  findMany: async ({ where }: { where: Record<string, unknown> }) =>
    jobs
      .filter(
        (job) =>
          (where.status === undefined || job.status === where.status) &&
          (where.syncAccountId === undefined || job.syncAccountId === where.syncAccountId),
      )
      .map((job) => ({ ...job, syncAccount: accounts.get(job.syncAccountId as string) })),
  findFirst: async ({ where }: { where: { syncAccountId: string; status: string; id: { not: string } } }) =>
    jobs.find(
      (job) =>
        job.syncAccountId === where.syncAccountId &&
        job.status === where.status &&
        job.id !== where.id.not,
    ) ?? null,
  updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    if ("leaseExpiresAt" in where) return { count: 0 }; // nothing is ever expired here
    const ids = where.id as string | { in: string[] } | undefined;
    const matched = jobs.filter(
      (job) =>
        (ids === undefined || (typeof ids === "string" ? job.id === ids : ids.in.includes(job.id))) &&
        (where.status === undefined || job.status === where.status),
    );
    for (const job of matched) Object.assign(job, data);
    return { count: matched.length };
  },
  update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    const job = jobs.find((candidate) => candidate.id === where.id)!;
    Object.assign(job, data);
    return job;
  },
};
client.syncAccountSettings = { findUnique: async () => accountSettings };
// markJobFailed reads the account back (only reached when a run fails, which
// runSync then reports with the job's error).
client.syncAccount!.findUnique = async ({ where }: { where: { id: string } }) => accounts.get(where.id) ?? null;

// The link query's nested contact `select` is honoured, so a field missing
// from the runner's select (A-03: significantDates) is missing here too.
const baseLinkFindMany = client.syncContactLink!.findMany as (args: unknown) => Promise<Row[]>;
client.syncContactLink!.findMany = async (args: {
  where?: Record<string, unknown>;
  select?: { contact?: { select?: Record<string, unknown> } };
}) => {
  const rows = await baseLinkFindMany(args);
  const contactSelect = args.select?.contact?.select;
  if (!contactSelect) return rows;
  return rows.map((row) => {
    const contact = row.contact as Row | null;
    if (!contact) return row;
    const projected: Record<string, unknown> = {};
    for (const [key, wanted] of Object.entries(contactSelect)) {
      if (wanted === true) projected[key] = contact[key];
      else if (wanted) projected[key] = null; // relations (book) — none in this fake
    }
    return { ...row, contact: projected };
  });
};
client.syncContactLink!.upsert = async ({
  where,
  create,
  update,
}: {
  where: { syncAccountId_contactId: { syncAccountId: string; contactId: string } };
  create: Record<string, unknown>;
  update: Record<string, unknown>;
}) => {
  const key = where.syncAccountId_contactId;
  const existing = [...fake.links.values()].find(
    (link) => link.syncAccountId === key.syncAccountId && link.contactId === key.contactId,
  );
  const links = client.syncContactLink as unknown as {
    update: (args: unknown) => Promise<Row>;
    create: (args: unknown) => Promise<Row>;
  };
  return existing
    ? links.update({ where: { id: existing.id }, data: update })
    : links.create({ data: create });
};

(globalThis as unknown as { prisma: unknown }).prisma = fake.client;

// ── In-memory iCloud ───────────────────────────────────────────────────────
const server = createFakeCardDavServer("https://contacts.icloud.com/1234/carddavhome/card/");
const realSafeFetch = await import("~/server/safe-fetch");
mock.module("~/server/safe-fetch", {
  namedExports: { ...realSafeFetch, safeFetch: server.fetch },
});

const { runQueuedSyncJobs } = await import("~/server/sync-runner");
const { encryptSyncCredentialPayload } = await import("~/server/sync-credentials");

const ACCOUNT_ID = "acct_icloud";
const USER_ID = "user_1";

const ICLOUD_CARD = vcard(
  "BEGIN:VCARD",
  "VERSION:3.0",
  "PRODID:-//Apple Inc.//iPhone OS 18.0//EN",
  "N:Appleseed;Johnny;;;",
  "FN:Johnny Appleseed",
  "item1.EMAIL;type=INTERNET;type=pref:johnny@example.com",
  "item1.X-ABLabel:_$!<Other>!$_",
  "TEL;type=CELL;type=VOICE;type=pref:+1 555 0100",
  "item2.X-ABDATE;type=pref:2010-06-12",
  "item2.X-ABLabel:_$!<Anniversary>!$_",
  "IMPP;X-SERVICE-TYPE=Skype;type=pref:skype:johnny.appleseed",
  "item3.X-ABRELATEDNAMES;type=pref:Jane Appleseed",
  "item3.X-ABLabel:_$!<Spouse>!$_",
  "CATEGORIES:Friends,Family",
  "UID:icloud-uid-1",
  "END:VCARD",
);

const simpleCard = (uid: string, name: string, rev?: string) =>
  vcard("BEGIN:VCARD", "VERSION:3.0", `FN:${name}`, `N:${name};;;;`, ...(rev ? [`REV:${rev}`] : []), `UID:${uid}`, "END:VCARD");

const runSync = async () => {
  const job: Row = {
    id: `job_${++jobSeq}`,
    syncAccountId: ACCOUNT_ID,
    status: "QUEUED",
    syncDirection: "TWO_WAY",
    attemptCount: 1,
    maxAttempts: 5,
    cursorBefore: null,
    nextRetryAt: null,
    createdAt: new Date(),
  };
  jobs.push(job);
  const summary = await runQueuedSyncJobs({ syncAccountId: ACCOUNT_ID });
  assert.notEqual(job.status, "FAILED", `sync job failed: ${String(job.errorCode)} — ${String(job.errorSummary)}`);
  return { job, summary };
};

const onlyContact = () => {
  assert.equal(fake.contacts.size, 1);
  return [...fake.contacts.values()][0]!;
};

beforeEach(() => {
  fake.reset();
  server.reset();
  jobs.length = 0;
  accountSettings = null;
  accounts.set(ACCOUNT_ID, {
    id: ACCOUNT_ID,
    userId: USER_ID,
    label: "iCloud (test)",
    status: "ACTIVE",
    provider: "CARDDAV",
    syncDirection: "TWO_WAY",
    baseUrl: "https://contacts.icloud.com",
    principalUrl: "https://contacts.icloud.com/1234/principal/",
    addressBookUrl: server.bookUrl,
    remoteAccountId: "https://contacts.icloud.com/1234/principal/",
    remoteCTag: null,
    lastSyncCursor: null,
    credentialReference: encryptSyncCredentialPayload({
      provider: "CARDDAV",
      version: 1,
      username: "user@example.com",
      password: "app-specific-password",
    }).credentialReference,
    encryptionKeyRef: null,
    credentialRevokedAt: null,
    deletionGuardBypassOnce: false,
    settings: null,
    teamLink: null,
  });
});

test("an iCloud card edited in Kontax (name change) is pushed with X-ABDATE, IMPP, X-ABRELATEDNAMES and CATEGORIES intact", async () => {
  const href = server.seed("icloud-uid-1.vcf", ICLOUD_CARD);
  await runSync();
  const contact = onlyContact();
  assert.deepEqual(
    (contact.significantDates as Array<{ date: string }>).map((entry) => entry.date),
    ["2010-06-12"],
    "the anniversary was imported",
  );
  assert.equal(server.puts().length, 0, "an import pushes nothing");

  await fake.editContact(contact.id, { fullName: "Johnny B. Appleseed", middleName: "B." });
  const { job } = await runSync();

  assert.equal(job.status, "SUCCEEDED");
  assert.equal(job.pushedUpdatedCount, 1);
  const [put] = server.puts();
  assert.equal(put!.headers["if-match"], '"etag-1"', "conditioned on the ETag Kontax read");

  const lines = vcardLines(server.card(href)!.vcard);
  assert.ok(lines.includes("FN:Johnny B. Appleseed"));
  assert.ok(lines.some((line) => /^item\d+\.X-ABDATE:2010-06-12$/.test(line)), "X-ABDATE intact");
  assert.equal(lines.filter((line) => line.includes("X-ABDATE")).length, 1, "and not duplicated");
  assert.ok(lines.includes("IMPP;X-SERVICE-TYPE=Skype;type=pref:skype:johnny.appleseed"), "IMPP intact");
  assert.ok(lines.includes("item3.X-ABRELATEDNAMES;type=pref:Jane Appleseed"), "X-ABRELATEDNAMES intact");
  assert.ok(lines.includes("item3.X-ABLabel:_$!<Spouse>!$_"), "its label intact");
  assert.ok(lines.includes("CATEGORIES:Friends,Family"), "CATEGORIES intact");
  assert.equal(lines.filter((line) => /(^|\.)EMAIL[;:]/.test(line)).length, 1, "EMAIL replaced, not duplicated");
  assert.equal(lines.filter((line) => /^TEL[;:]/.test(line)).length, 1, "TEL replaced, not duplicated");

  // A second Kontax edit straight after the push is pushed too. The stored ETag
  // is the PUT response's ("etag-2") and the REPORT now says &quot;etag-2&quot;
  // — the same version; comparing them raw made the card look remotely changed
  // and the default Server-wins policy silently reverted this edit.
  await fake.editContact(contact.id, { jobTitle: "Engineer" });
  const { job: third } = await runSync();
  assert.equal(third.status, "SUCCEEDED");
  assert.equal(fake.conflicts.length, 0, "no conflict, not even an auto-resolved one");
  assert.equal(onlyContact().jobTitle, "Engineer", "the local edit is kept");
  assert.equal(server.puts().length, 2);
  assert.ok(vcardLines(server.card(href)!.vcard).includes("TITLE:Engineer"));

  // And a run with nothing to do pushes nothing.
  const { job: fourth } = await runSync();
  assert.equal(fourth.status, "SUCCEEDED");
  assert.equal(server.puts().length, 2, "no further push");
  assert.equal(fake.conflicts.length, 0);
});

test("a PUT that loses its If-Match race creates one conflict and overwrites nothing (MANUAL policy)", async () => {
  accountSettings = { conflictPolicy: "MANUAL" };
  const href = server.seed("icloud-uid-1.vcf", ICLOUD_CARD);
  await runSync();
  const contact = onlyContact();
  await fake.editContact(contact.id, { fullName: "Johnny B. Appleseed" });

  // The phone is edited on the iPhone between Kontax's REPORT and its PUT.
  const concurrent = ICLOUD_CARD.replace(
    "TEL;type=CELL;type=VOICE;type=pref:+1 555 0100",
    "TEL;type=CELL;type=VOICE;type=pref:+1 555 0199",
  );
  server.onBeforePut((target) => {
    server.onBeforePut(null);
    server.remoteEdit(target, concurrent);
  });

  const { job } = await runSync();

  assert.equal(server.puts().length, 1, "one PUT, rejected — no blind retry");
  assert.equal(server.card(href)!.vcard, concurrent, "the concurrent remote edit is intact");
  assert.equal(fake.conflicts.length, 1, "exactly one conflict");
  const [conflict] = fake.conflicts;
  assert.equal(conflict!.status, "OPEN");
  assert.equal(conflict!.conflictType, "LOCAL_REMOTE_MUTATION");
  assert.deepEqual((conflict!.remoteSnapshot as { phoneNumbers: string[] }).phoneNumbers, ["+1 555 0199"]);
  assert.equal(job.status, "PARTIAL");
  assert.equal(job.pushedUpdatedCount, 0);
  assert.equal(onlyContact().fullName, "Johnny B. Appleseed", "the local edit is kept for review");

  // The next run re-detects the same divergence and refreshes that conflict.
  await runSync();
  assert.equal(fake.conflicts.length, 1);
  assert.equal(server.card(href)!.vcard, concurrent);
});

test("a lost race under the Server-wins policy applies the re-read remote card", async () => {
  accountSettings = { conflictPolicy: "SERVER_WINS" };
  const href = server.seed("icloud-uid-1.vcf", ICLOUD_CARD);
  await runSync();
  const contact = onlyContact();
  await fake.editContact(contact.id, { fullName: "Johnny B. Appleseed" });
  const concurrent = ICLOUD_CARD.replace("FN:Johnny Appleseed", "FN:John Appleseed");
  server.onBeforePut((target) => {
    server.onBeforePut(null);
    server.remoteEdit(target, concurrent);
  });

  await runSync();

  assert.equal(server.card(href)!.vcard, concurrent, "nothing overwritten");
  assert.equal(onlyContact().fullName, "John Appleseed", "the remote version was applied locally");
  assert.equal(fake.conflicts.filter((row) => row.status === "OPEN").length, 0);
  assert.equal(fake.conflicts.filter((row) => row.status === "AUTO_RESOLVED").length, 1);
});

test("a card deleted remotely between the REPORT and the PUT becomes a delete conflict", async () => {
  const href = server.seed("icloud-uid-1.vcf", ICLOUD_CARD);
  await runSync();
  await fake.editContact(onlyContact().id, { fullName: "Johnny B. Appleseed" });
  server.onBeforePut((target) => {
    server.onBeforePut(null);
    void server.fetch(target, { method: "DELETE" });
  });

  await runSync();

  assert.equal(server.card(href), undefined, "not recreated");
  assert.equal(fake.conflicts.length, 1);
  assert.equal(fake.conflicts[0]!.conflictType, "DELETE_CONFLICT");
});

test("a remote book with two cards sharing a UID syncs, and the duplicate is left alone", async () => {
  server.seed("older.vcf", simpleCard("dup-uid", "Older Copy", "2026-01-01T00:00:00Z"));
  const newer = server.seed("newer.vcf", simpleCard("dup-uid", "Newer Copy", "2026-06-01T00:00:00Z"));
  server.seed("solo.vcf", simpleCard("solo-uid", "Solo"));

  const { job } = await runSync();

  assert.equal(job.status, "SUCCEEDED", "the run no longer aborts on the unique constraint");
  assert.equal(fake.contacts.size, 2);
  assert.deepEqual(
    [...fake.contacts.values()].map((row) => row.fullName).sort(),
    ["Newer Copy", "Solo"],
  );
  assert.equal(fake.linkByRemoteUid("dup-uid")!.remoteHref, newer);
  assert.match(String(job.errorSummary), /skipped 1 remote card with a duplicate UID/);
  assert.equal(server.puts().length, 0);
  assert.equal(server.requests.filter((request) => request.method === "DELETE").length, 0);

  // Stable on the next run: same card kept, nothing pushed, no conflict.
  const { job: second } = await runSync();
  assert.equal(second.status, "SUCCEEDED");
  assert.equal(fake.contacts.size, 2);
  assert.equal(fake.linkByRemoteUid("dup-uid")!.remoteHref, newer);
  assert.equal(fake.conflicts.length, 0);
  assert.equal(server.cardCount(), 3);
});

test("creates use If-None-Match: * and a local contact whose UID is already remote is linked, not re-created", async () => {
  server.seed("shared.vcf", simpleCard("shared-uid", "Shared"));
  const created = await (client.contact as unknown as { create: (args: unknown) => Promise<Row> }).create({
    data: { userId: USER_ID, syncUid: "shared-uid", fullName: "Shared", lastMutatedBy: "MANUAL" },
  });
  await (client.contact as unknown as { create: (args: unknown) => Promise<Row> }).create({
    data: { userId: USER_ID, syncUid: "kontax-only-uid", fullName: "Kontax Only", lastMutatedBy: "MANUAL" },
  });

  await runSync();

  const puts = server.puts();
  assert.equal(puts.length, 1, "only the Kontax-only contact is created remotely");
  assert.equal(puts[0]!.headers["if-none-match"], "*");
  assert.match(puts[0]!.url, /kontax-only-uid\.vcf$/);
  assert.equal(fake.linkByRemoteUid("shared-uid")!.contactId, created.id, "linked to the existing card");
  assert.equal(fake.linkByRemoteUid("shared-uid")!.remoteHref, server.hrefFor("shared.vcf"));
  assert.equal(server.cardCount(), 2, "no second card with the shared UID");
});

// Fable review of P49A-12 (M1): a card missing from one listing must not
// retire the link of a contact that is only in the trash — otherwise a later
// "Delete permanently" hard-deletes it while the card still exists on iCloud
// and the next run re-imports it.
test("a trashed contact whose card is missing from a partial listing keeps its link, and the delete still reaches iCloud", async () => {
  const hrefA = server.seed("a.vcf", simpleCard("uid-a", "Ada"));
  server.seed("b.vcf", simpleCard("uid-b", "Bob"));
  await runSync();
  const ada = [...fake.contacts.values()].find((c) => c.fullName === "Ada")!;
  await fake.editContact(ada.id, { archivedAt: new Date() });

  server.hideFromReport([hrefA]);
  await runSync();
  const linkA = [...fake.links.values()].find((l) => l.contactId === ada.id)!;
  assert.equal(linkA.tombstonedAt ?? null, null, "not retired on a partial listing");
  assert.ok(server.card(hrefA), "the card is still on iCloud");

  server.hideFromReport(null);
  await runSync();
  assert.equal(server.card(hrefA), undefined, "the trash delete then reaches iCloud");
});

test("an empty listing never retires links, even for a permanently deleted contact", async () => {
  const hrefA = server.seed("a.vcf", simpleCard("uid-a", "Ada"));
  await runSync();
  const ada = onlyContact();
  await fake.editContact(ada.id, { archivedAt: new Date(), deletedAt: new Date() });

  server.hideFromReport([hrefA]);
  await runSync();
  const linkA = [...fake.links.values()].find((l) => l.contactId === ada.id)!;
  assert.equal(linkA.tombstonedAt ?? null, null, "an empty REPORT is not proof of deletion");
});
