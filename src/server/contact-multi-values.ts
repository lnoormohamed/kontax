// P49A-10: Prisma-typed wrapper around the canonical multi-value model in
// src/server/dav/contact-multi-values.mjs (shared with the plain-ESM CardDAV
// server). Typed `*Entries` are the single source of truth; the legacy
// `email`/`emailAddresses`, `phone`/`phoneNumbers`, `address`/
// `postalAddresses` and `website` columns are always derived from them.
//
// Writers: build the multi-value part of every Contact write with
// `multiValueWriteData` (explicit entries), `copyMultiValueWriteData` (copy /
// restore a contact-shaped source) or `snapshotMultiValueWriteData` (apply a
// remote / conflict snapshot — only the families it carries).
// Readers: `readMultiValueEntries` (entries only), or `readMultiValueFields`
// when a downstream shape still wants the legacy keys — they are re-derived
// from the entries, never read from the stored legacy columns.
import { Prisma } from "../../generated/prisma";

import {
  buildMultiValueWriteData,
  deriveMultiValueFields,
  familiesPresentIn,
  type MultiValueEntriesInput,
  type MultiValueFamily,
  readMultiValueEntries as readEntries,
  reconcileLegacyIntoEntries as reconcileEntries,
  snapshotMultiValueWriteData as snapshotWriteData,
} from "~/server/dav/contact-multi-values.mjs";

export {
  addressEntriesFromLegacy,
  deriveMultiValueFields,
  deriveLegacyAddresses,
  deriveLegacyEmails,
  deriveLegacyPhones,
  deriveLegacyWebsites,
  familiesPresentIn,
  LEGACY_ENTRY_LABEL,
  MULTI_VALUE_COLUMNS,
  MULTI_VALUE_FAMILIES,
  normalizeAddressEntries,
  normalizeValueEntries,
  primaryEntryOf,
  readAddressEntries,
  readEmailEntries,
  readPhoneEntries,
  readWebsiteEntries,
  valueEntriesFromLegacy,
} from "~/server/dav/contact-multi-values.mjs";

export type { MultiValueEntriesInput, MultiValueFamily };

// Stored entries are Json: the known keys plus whatever metadata a writer
// attached (phone `e164`, `validationStatus`, …), typed so they can be written
// back through Prisma unchanged.
type JsonExtras = Record<string, Prisma.InputJsonValue | null | undefined>;

/** An email / phone / website entry as stored in its `*Entries` column. */
export type MultiValueEntry = { label: string; value: string; isPrimary: boolean } & JsonExtras;

/** A postal address entry as stored in `addressEntries`. */
export type MultiValueAddressEntry = { label: string; formatted: string; isPrimary: boolean } & JsonExtras;

export type MultiValueEntries = {
  emailEntries: MultiValueEntry[];
  phoneEntries: MultiValueEntry[];
  addressEntries: MultiValueAddressEntry[];
  websiteEntries: MultiValueEntry[];
};

type JsonWrite = Prisma.InputJsonValue | typeof Prisma.DbNull;

/** The multi-value columns of a Contact write (only the families written). */
export type MultiValueWriteData = {
  email?: string | null;
  emailAddresses?: JsonWrite;
  emailEntries?: JsonWrite;
  phone?: string | null;
  phoneNumbers?: JsonWrite;
  phoneEntries?: JsonWrite;
  address?: string | null;
  postalAddresses?: JsonWrite;
  addressEntries?: JsonWrite;
  website?: string | null;
  websiteEntries?: JsonWrite;
};

/** Entries plus the legacy keys re-derived from them (read side). */
export type MultiValueFields = MultiValueEntries & {
  email: string | null;
  emailAddresses: string[];
  phone: string | null;
  phoneNumbers: string[];
  address: string | null;
  postalAddresses: Array<{ label: string; formatted: string }>;
  website: string | null;
};

type ContactLike = Record<string, unknown> | object;

const asRecord = (value: ContactLike) => value as Record<string, unknown>;

/**
 * Prisma data for the families present in `input` (an `undefined` family is
 * left untouched; an empty one is cleared). Legacy columns are derived.
 */
export const multiValueWriteData = (input: MultiValueEntriesInput): MultiValueWriteData =>
  buildMultiValueWriteData(input, { jsonNull: Prisma.DbNull });

/**
 * Prisma data carrying every family of a contact-shaped source (a stored row
 * being copied, a merge "before" snapshot being restored, a portable contact
 * being imported) — read through the reader, so legacy-only values survive.
 */
export const copyMultiValueWriteData = (source: ContactLike): MultiValueWriteData =>
  multiValueWriteData(readEntries(asRecord(source)));

/**
 * Entries with every legacy value missing from them appended ("other") — the
 * rule the P49A-10 backfill migration applies in SQL.
 */
export const reconcileLegacyIntoEntries = (contact: ContactLike): MultiValueEntries =>
  reconcileEntries(asRecord(contact)) as MultiValueEntries;

/**
 * Prisma data restoring a snapshot taken before P49A-10 (merge undo): its
 * entries reconciled with its legacy values, so neither side's data is lost.
 */
export const restoreMultiValueWriteData = (snapshot: ContactLike): MultiValueWriteData =>
  multiValueWriteData(reconcileEntries(asRecord(snapshot)));

/**
 * Prisma data for the families a remote / conflict snapshot actually carries
 * (a family the snapshot never recorded is not cleared).
 */
export const snapshotMultiValueWriteData = (snapshot: ContactLike): MultiValueWriteData =>
  snapshotWriteData(asRecord(snapshot), { jsonNull: Prisma.DbNull });

/** Typed entries of a stored contact (legacy fallback only for a not-yet-backfilled row). */
export const readMultiValueEntries = (contact: ContactLike): MultiValueEntries =>
  readEntries(asRecord(contact)) as MultiValueEntries;

/**
 * Entries plus legacy keys derived from them, for read paths that still hand a
 * `PortableContactInput`-style object downstream (exports, sync push, shadows).
 */
export const readMultiValueFields = (contact: ContactLike): MultiValueFields => {
  const entries = readMultiValueEntries(contact);
  const derived = deriveMultiValueFields(entries);
  return {
    ...entries,
    email: derived.email ?? null,
    emailAddresses: derived.emailAddresses ?? [],
    phone: derived.phone ?? null,
    phoneNumbers: derived.phoneNumbers ?? [],
    address: derived.address ?? null,
    postalAddresses: derived.postalAddresses ?? [],
    website: derived.website ?? null,
  };
};

/**
 * Only the legacy keys (email / emailAddresses, phone / phoneNumbers, address /
 * postalAddresses, website), derived from the entries — for exports whose
 * output format is built from the flat values.
 */
export const readDerivedLegacyFields = (contact: ContactLike) => {
  const fields = readMultiValueFields(contact);
  return {
    email: fields.email,
    emailAddresses: fields.emailAddresses,
    phone: fields.phone,
    phoneNumbers: fields.phoneNumbers,
    address: fields.address,
    postalAddresses: fields.postalAddresses,
    website: fields.website,
  };
};

/** The typed entry columns — add to a `select` that feeds the readers. */
export const MULTI_VALUE_ENTRY_SELECT = {
  emailEntries: true,
  phoneEntries: true,
  addressEntries: true,
  websiteEntries: true,
} as const;

type EntryColumn = keyof typeof MULTI_VALUE_ENTRY_SELECT;

/**
 * A selected row with its entry columns swapped for the legacy keys derived
 * from them — for exports whose format is built from the flat values, so the
 * output stays exactly as before while the data comes from the entries.
 */
export const withDerivedLegacyFields = <T extends object>(
  contact: T,
): Omit<T, EntryColumn> & ReturnType<typeof readDerivedLegacyFields> => {
  const rest: Record<string, unknown> = { ...(contact as Record<string, unknown>) };
  for (const column of Object.keys(MULTI_VALUE_ENTRY_SELECT)) delete rest[column];
  return { ...(rest as Omit<T, EntryColumn>), ...readDerivedLegacyFields(contact) };
};

/** Whether a snapshot carries a family at all (typed or legacy key present). */
export const snapshotCarriesFamily = (snapshot: ContactLike, family: MultiValueFamily) =>
  familiesPresentIn(asRecord(snapshot)).includes(family);
