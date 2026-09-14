#!/usr/bin/env node
/**
 * P48-07 backfill: strip policy-private fields that leaked into copies and
 * snapshots created BEFORE the sharing-policy projection (src/lib/sharing-policy.ts
 * projectContactForSharing) was wired into addContactToFamilyBook,
 * addContactToTeamBook, snapshotFamilyBookForUser, createStaticShare and
 * createLiveShare.
 *
 * Two independent passes, both idempotent (re-running after a prior --apply is
 * always a no-op) and additive-only (never deletes rows, only nulls fields):
 *
 *   1. ContactShare.snapshot JSON — every share row's `notes` key is nulled.
 *      Static/live Kontax-to-Kontax shares only ever leaked `notes`
 *      (LIVE_FIELD_SELECT already excluded it from ongoing live propagation;
 *      see contact-shares.ts) — every other field is a deliberate one-to-one
 *      grant and is left alone.
 *
 *   2. Group-book copies — every Contact reachable via GroupContact (an "add
 *      to family/team book" copy). There is no FK from a copy back to the
 *      private contact it was copied from (Contact has no sourceContactId /
 *      copiedFromContactId column — confirmed against prisma/schema.prisma);
 *      provenance is GroupContact.addedByUserId + groupAddressBookId only. So
 *      the POLICY applied here is the one that governs that member's shares in
 *      that book today — GroupMember.sharingPolicy for (groupId, addedByUserId)
 *      OR'd with GroupAddressBook.minimumSharingPolicy (mirrors
 *      resolveEffectiveSharingPolicy, src/lib/sharing-policy.ts) — not a
 *      specific source contact's policy (none is addressable). `notes` is
 *      always nulled; personalPhone/homeAddress/birthday/labels/customFields
 *      are nulled only where that resolved policy marks them private; email/
 *      phone entries are split by label (work vs personal) the same way
 *      projectContactForSharing does.
 *
 * This mirrors src/lib/sharing-policy.ts's projectContactForSharing by hand —
 * a plain .mjs script can't import a TS path-aliased module — so keep the two
 * in sync if the policy model changes.
 *
 * Usage:
 *   node scripts/backfill-p48-07-strip-private-fields.mjs           # dry run (default)
 *   node scripts/backfill-p48-07-strip-private-fields.mjs --apply   # write changes
 */
import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 500;

// --- sharing-policy resolution (mirrors src/lib/sharing-policy.ts) ---------

const SHARING_POLICY_KEYS = [
  "name",
  "company",
  "jobTitle",
  "workEmail",
  "workPhone",
  "personalEmail",
  "personalPhone",
  "homeAddress",
  "birthday",
  "notes",
  "labels",
  "customFields",
];

const DEFAULT_SHARING_POLICY = {
  name: true,
  company: true,
  jobTitle: true,
  workEmail: true,
  workPhone: true,
  personalEmail: false,
  personalPhone: false,
  homeAddress: false,
  birthday: false,
  notes: false,
  labels: false,
  customFields: false,
};

function normalizeSharingPolicy(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};
  for (const key of SHARING_POLICY_KEYS) {
    if (typeof raw[key] === "boolean") out[key] = raw[key];
  }
  return out;
}

function resolveEffectiveSharingPolicy(memberPolicy, minimumPolicy) {
  const member = normalizeSharingPolicy(memberPolicy);
  const floor = normalizeSharingPolicy(minimumPolicy);
  const out = {};
  for (const key of SHARING_POLICY_KEYS) {
    const base = member[key] ?? DEFAULT_SHARING_POLICY[key];
    out[key] = floor[key] === true ? true : base;
  }
  return out;
}

const WORK_LABELS = new Set(["work", "office", "business", "company"]);
const isWorkLabel = (label) => (label ? WORK_LABELS.has(String(label).trim().toLowerCase()) : false);

const policyKeyForField = (fieldType, label) => {
  if (fieldType === "EMAIL") return isWorkLabel(label) ? "workEmail" : "personalEmail";
  if (fieldType === "PHONE") return isWorkLabel(label) ? "workPhone" : "personalPhone";
  throw new Error(`unexpected fieldType ${fieldType}`);
};

const isFieldShared = (fieldType, label, policy) => policy[policyKeyForField(fieldType, label)];

// Filter an EMAIL/PHONE entries array by label, and recompute the scalar
// convenience field from the surviving entries — same rule as
// applyEntryFieldPolicy in src/lib/sharing-policy.ts.
function projectEntryField(entries, scalar, fieldType, policy) {
  if (Array.isArray(entries)) {
    const kept = entries.filter((entry) =>
      isFieldShared(fieldType, typeof entry?.label === "string" ? entry.label : null, policy),
    );
    const changed = kept.length !== entries.length;
    const primary = kept.find((e) => e?.isPrimary === true) ?? kept[0];
    const nextScalar = kept.length > 0 ? (primary && "value" in primary ? (primary.value ?? null) : null) : null;
    return {
      entries: kept,
      scalar: nextScalar,
      changed: changed || nextScalar !== (scalar ?? null),
    };
  }
  // No entries — the scalar has no label, so it falls into the personal bucket.
  const shared = isFieldShared(fieldType, null, policy);
  return { entries, scalar: shared ? scalar : null, changed: !shared && scalar != null };
}

// --- pass 1: ContactShare.snapshot ------------------------------------------

async function backfillShareSnapshots() {
  let scanned = 0;
  let updated = 0;
  let cursor = null;

  for (;;) {
    const shares = await db.contactShare.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      where: { snapshot: { not: null } },
      select: { id: true, snapshot: true },
    });
    if (shares.length === 0) break;
    cursor = shares[shares.length - 1].id;

    for (const share of shares) {
      scanned++;
      const snapshot = share.snapshot;
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) continue;
      if (snapshot.notes == null) continue; // already clean

      updated++;
      console.log(`[share] ${share.id} — strip notes from snapshot`);
      if (APPLY) {
        await db.contactShare.update({
          where: { id: share.id },
          data: { snapshot: { ...snapshot, notes: null } },
        });
      }
    }
  }

  console.log(
    `\nShare snapshots — scanned ${scanned}, ${APPLY ? "stripped" : "would strip"} notes on ${updated}.`,
  );
}

// --- pass 2: group-book (family/team) copies --------------------------------

async function backfillGroupBookCopies() {
  let scanned = 0;
  let updated = 0;
  const fieldCounts = {
    notes: 0,
    personalEmail: 0,
    personalPhone: 0,
    homeAddress: 0,
    birthday: 0,
    labels: 0,
    customFields: 0,
  };
  let cursor = null;

  for (;;) {
    const groupContacts = await db.groupContact.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        contactId: true,
        addedByUserId: true,
        groupAddressBook: { select: { groupId: true, minimumSharingPolicy: true } },
        contact: {
          select: {
            notes: true,
            email: true,
            emailEntries: true,
            phone: true,
            phoneEntries: true,
            address: true,
            addressEntries: true,
            postalAddresses: true,
            birthday: true,
            labels: true,
            customFields: true,
          },
        },
      },
    });
    if (groupContacts.length === 0) break;
    cursor = groupContacts[groupContacts.length - 1].id;

    // Bulk-resolve GroupMember.sharingPolicy for the (groupId, addedByUserId)
    // pairs in this batch, to avoid one query per row.
    const pairs = new Map();
    for (const gc of groupContacts) {
      pairs.set(`${gc.groupAddressBook.groupId}:${gc.addedByUserId}`, {
        groupId: gc.groupAddressBook.groupId,
        userId: gc.addedByUserId,
      });
    }
    const members = await db.groupMember.findMany({
      where: { OR: [...pairs.values()].map(({ groupId, userId }) => ({ groupId, userId })) },
      select: { groupId: true, userId: true, sharingPolicy: true },
    });
    const memberPolicyByPair = new Map(
      members.map((m) => [`${m.groupId}:${m.userId}`, m.sharingPolicy]),
    );

    for (const gc of groupContacts) {
      scanned++;
      const key = `${gc.groupAddressBook.groupId}:${gc.addedByUserId}`;
      const policy = resolveEffectiveSharingPolicy(
        memberPolicyByPair.get(key) ?? null,
        gc.groupAddressBook.minimumSharingPolicy ?? null,
      );
      const c = gc.contact;
      const data = {};
      const touched = [];

      if (c.notes != null) {
        data.notes = null;
        touched.push("notes");
        fieldCounts.notes++;
      }

      const email = projectEntryField(c.emailEntries, c.email, "EMAIL", policy);
      if (email.changed) {
        data.email = email.scalar;
        data.emailEntries = email.entries;
        touched.push("personalEmail");
        fieldCounts.personalEmail++;
      }

      const phone = projectEntryField(c.phoneEntries, c.phone, "PHONE", policy);
      if (phone.changed) {
        data.phone = phone.scalar;
        data.phoneEntries = phone.entries;
        touched.push("personalPhone");
        fieldCounts.personalPhone++;
      }

      if (!policy.homeAddress && (c.address != null || c.addressEntries != null || c.postalAddresses != null)) {
        data.address = null;
        data.addressEntries = null;
        data.postalAddresses = null;
        touched.push("homeAddress");
        fieldCounts.homeAddress++;
      }

      if (!policy.birthday && c.birthday != null) {
        data.birthday = null;
        touched.push("birthday");
        fieldCounts.birthday++;
      }

      if (!policy.labels && c.labels != null) {
        data.labels = null;
        touched.push("labels");
        fieldCounts.labels++;
      }

      if (!policy.customFields && c.customFields != null) {
        data.customFields = null;
        touched.push("customFields");
        fieldCounts.customFields++;
      }

      if (touched.length === 0) continue;

      updated++;
      console.log(`[contact] ${gc.contactId} (via group ${key}) — strip ${touched.join(", ")}`);
      if (APPLY) {
        await db.contact.update({ where: { id: gc.contactId }, data });
      }
    }
  }

  console.log(
    `\nGroup-book copies — scanned ${scanned}, ${APPLY ? "updated" : "would update"} ${updated}.`,
  );
  console.log(`  by field: ${JSON.stringify(fieldCounts)}`);
}

async function main() {
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — P48-07 strip leaked private fields\n`);
  await backfillShareSnapshots();
  console.log("");
  await backfillGroupBookCopies();
  if (!APPLY) console.log("\nRe-run with --apply to write these changes.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
