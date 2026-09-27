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
  type MultiValueAddressEntry,
  type MultiValueEntries,
  type MultiValueEntriesInput,
  type MultiValueEntry,
  type MultiValueFamily,
  readMultiValueEntries as readEntries,
  snapshotMultiValueWriteData as snapshotWriteData,
} from "~/server/dav/contact-multi-values.mjs";

export {
  addressEntriesFromLegacy,
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

export type {
  MultiValueAddressEntry,
  MultiValueEntries,
  MultiValueEntriesInput,
  MultiValueEntry,
  MultiValueFamily,
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
  buildMultiValueWriteData(input, { jsonNull: Prisma.DbNull }) as MultiValueWriteData;

/**
 * Prisma data carrying every family of a contact-shaped source (a stored row
 * being copied, a merge "before" snapshot being restored, a portable contact
 * being imported) — read through the reader, so legacy-only values survive.
 */
export const copyMultiValueWriteData = (source: ContactLike): MultiValueWriteData =>
  multiValueWriteData(readEntries(asRecord(source)));

/**
 * Prisma data for the families a remote / conflict snapshot actually carries
 * (a family the snapshot never recorded is not cleared).
 */
export const snapshotMultiValueWriteData = (snapshot: ContactLike): MultiValueWriteData =>
  snapshotWriteData(asRecord(snapshot), { jsonNull: Prisma.DbNull }) as MultiValueWriteData;

/** Typed entries of a stored contact (legacy fallback only for a not-yet-backfilled row). */
export const readMultiValueEntries = (contact: ContactLike): MultiValueEntries =>
  readEntries(asRecord(contact));

/**
 * Entries plus legacy keys derived from them, for read paths that still hand a
 * `PortableContactInput`-style object downstream (exports, sync push, shadows).
 */
export const readMultiValueFields = (contact: ContactLike): MultiValueFields => {
  const entries = readEntries(asRecord(contact));
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

/** Whether a snapshot carries a family at all (typed or legacy key present). */
export const snapshotCarriesFamily = (snapshot: ContactLike, family: MultiValueFamily) =>
  familiesPresentIn(asRecord(snapshot)).includes(family);
