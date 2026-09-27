// P49A-19 item 2: a sync conflict's comparison rows and its "Manual merge".
//
// `buildConflictRows` turns the two conflict snapshots into the review UI's
// rows, each keyed by a stable field key (src/lib/sync-conflict-picks.ts).
// `buildPickedMergeWriteData` builds the merged contact from EXACTLY the side
// the user picked per field — it used to union both sides with local winning,
// whatever was picked, because the picks never left the browser.
//
// Multi-value families (emails, phones, addresses, websites) go through the
// P49A-10 canonical model: the chosen side's typed entries, legacy columns
// derived by `multiValueWriteData`. A field the chosen snapshot never recorded
// (e.g. `department` on a local snapshot taken before it was captured) is left
// as the contact holds it rather than cleared.
import { Prisma } from "../../generated/prisma";

import {
  CONFLICT_FIELDS,
  type ConflictFieldKey,
  type ConflictPicks,
  conflictSideFor,
} from "~/lib/sync-conflict-picks";
import {
  type MultiValueEntriesInput,
  multiValueWriteData,
  familiesPresentIn,
  readMultiValueEntries,
} from "~/server/contact-multi-values";

export type ConflictComparisonRowData = {
  key: ConflictFieldKey;
  label: string;
  local: string;
  remote: string;
  kind: "text" | "photo";
};

const EMPTY = "—";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (snapshot: unknown): Record<string, unknown> =>
  isRecord(snapshot) ? snapshot : {};

const textOf = (snapshot: Record<string, unknown>, key: string): string => {
  const value = snapshot[key];
  return typeof value === "string" && value.trim() ? value.trim() : EMPTY;
};

const listOf = (values: unknown[]): string =>
  values.filter((v): v is string => typeof v === "string" && v.trim().length > 0).join(" | ") ||
  EMPTY;

const datesOf = (snapshot: Record<string, unknown>): string => {
  const raw = snapshot.significantDates;
  if (!Array.isArray(raw)) return EMPTY;
  return listOf(
    raw.map((entry) => {
      if (!isRecord(entry) || typeof entry.date !== "string" || !entry.date.trim()) return "";
      const label = typeof entry.label === "string" && entry.label.trim() ? `${entry.label.trim()}: ` : "";
      return `${label}${entry.date.trim()}`;
    }),
  );
};

// Display text of one field of one snapshot.
const displayValue = (key: ConflictFieldKey, snapshot: Record<string, unknown>): string => {
  switch (key) {
    case "emails":
      return listOf(readMultiValueEntries(snapshot).emailEntries.map((e) => e.value));
    case "phones":
      return listOf(readMultiValueEntries(snapshot).phoneEntries.map((e) => e.value));
    case "addresses":
      return listOf(readMultiValueEntries(snapshot).addressEntries.map((e) => e.formatted));
    case "websites":
      return listOf(readMultiValueEntries(snapshot).websiteEntries.map((e) => e.value));
    case "dates":
      return datesOf(snapshot);
    case "photo":
      return textOf(snapshot, "avatarUrl");
    default:
      return textOf(snapshot, key);
  }
};

/**
 * The review UI's comparison rows: one per field either side has a value for,
 * in CONFLICT_FIELDS order, keyed by field.
 */
export const buildConflictRows = (local: unknown, remote: unknown): ConflictComparisonRowData[] => {
  const localRecord = asRecord(local);
  const remoteRecord = asRecord(remote);
  return CONFLICT_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    local: displayValue(field.key, localRecord),
    remote: displayValue(field.key, remoteRecord),
    kind: field.key === "photo" ? ("photo" as const) : ("text" as const),
  })).filter((row) => row.local !== EMPTY || row.remote !== EMPTY);
};

// ── the merge ─────────────────────────────────────────────────────────────────

const NAME_PARTS = ["firstName", "middleName", "lastName", "namePrefix", "nameSuffix"] as const;

const SCALAR_FIELDS = ["nickname", "company", "department", "jobTitle", "birthday", "notes"] as const;

const FAMILY_FIELDS = [
  ["emails", "emails", "emailEntries"],
  ["phones", "phones", "phoneEntries"],
  ["addresses", "addresses", "addressEntries"],
  ["websites", "websites", "websiteEntries"],
] as const;

const stringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export type PickedMergeWriteData = {
  fullName: string;
} & Record<string, unknown>;

/**
 * Prisma write data for a manual merge: each field from the side `picks`
 * chose (DEFAULT_CONFLICT_SIDE for a field without a pick). The contact needs
 * a name, so a chosen side without one falls back to the other side's.
 */
export const buildPickedMergeWriteData = (
  localSnapshot: unknown,
  remoteSnapshot: unknown,
  picks: ConflictPicks | null,
): PickedMergeWriteData => {
  const local = asRecord(localSnapshot);
  const remote = asRecord(remoteSnapshot);
  const chosen = (key: ConflictFieldKey) => (conflictSideFor(picks, key) === "local" ? local : remote);
  const other = (key: ConflictFieldKey) => (conflictSideFor(picks, key) === "local" ? remote : local);

  const nameSide = chosen("fullName");
  const fullName = stringOrNull(nameSide.fullName) ?? stringOrNull(other("fullName").fullName);
  if (!fullName) {
    throw new Error("Manual merge needs at least one valid contact name.");
  }

  const data: Record<string, unknown> = { fullName };

  // The structured name travels with the chosen full name.
  if (stringOrNull(nameSide.fullName)) {
    for (const part of NAME_PARTS) {
      if (part in nameSide) data[part] = stringOrNull(nameSide[part]);
    }
  }

  for (const field of SCALAR_FIELDS) {
    const source = chosen(field);
    if (field in source) data[field] = stringOrNull(source[field]);
  }

  const families: MultiValueEntriesInput = {};
  for (const [key, family, column] of FAMILY_FIELDS) {
    const source = chosen(key);
    if (familiesPresentIn(source).includes(family)) {
      families[column] = readMultiValueEntries(source)[column];
    }
  }
  Object.assign(data, multiValueWriteData(families));

  const datesSource = chosen("dates");
  if (Array.isArray(datesSource.significantDates)) {
    const dates = datesSource.significantDates.filter(isRecord);
    data.significantDates = dates.length > 0 ? dates : Prisma.DbNull;
  }

  // The photo only moves when the remote side is chosen and its snapshot
  // recorded one (conflicts detected before P44-05 did not).
  if (conflictSideFor(picks, "photo") === "remote" && "avatarUrl" in remote) {
    data.avatarUrl = stringOrNull(remote.avatarUrl);
  }

  return data as PickedMergeWriteData;
};
