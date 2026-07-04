// P39-03: field exclusions on read and write. The P36 panel stores vCard-style
// tokens in SyncAccountSettings.excludedFields ("NOTE", "BDAY", "ADR",
// "X-CUSTOM"); the runner must neither push those fields out nor let remote
// values overwrite local ones — while leaving existing remote data untouched
// (no active scrubbing).
//
// The token list is open (Phase 44 adds "PHOTO"): unknown tokens are ignored
// gracefully rather than rejected.
//
// Provider strategies for "outbound without scrubbing":
// - CardDAV PUTs a full vCard — the pushed contact grafts the remote's own
//   current values for excluded fields (mergeExcludedFieldsFromRemote).
// - Google updateContact replaces every family in updatePersonFields — the
//   excluded families are subtracted from the mask (googleUpdateFieldsFor)
//   and stripped from the body.
// - Microsoft Graph PATCH only touches keys present in the body — stripping
//   the source fields is enough.

import type { PortableContactInput } from "~/server/contact-portability";

type PortableKey = keyof PortableContactInput;

// Token → the portable/contact-write keys it covers. BDAY covers the whole
// dates family (birthday + significant dates) — a user excluding birthdays
// expects lunar birthdays/anniversaries held back too.
const TOKEN_KEYS: Record<string, PortableKey[]> = {
  NOTE: ["notes"],
  BDAY: ["birthday", "significantDates"],
  ADR: ["address", "postalAddresses", "addressEntries"],
  "X-CUSTOM": ["customFields"],
  // P44-03: photos are a field family, but the image is not a portable-contact
  // key — it syncs through its own pipeline (contact-photo-sync). No portable
  // keys to strip; the entry exists so PHOTO survives normalizeExcludedFields
  // and the photo seams can gate on it via isPhotoExcluded().
  PHOTO: [],
};

// Token → Google updatePersonFields families to withhold from replacement.
const TOKEN_GOOGLE_FAMILIES: Record<string, string[]> = {
  NOTE: ["biographies"],
  BDAY: ["birthdays"],
  ADR: ["addresses"],
  // X-CUSTOM: userDefined is not in the push mask today — nothing to subtract.
  // PHOTO: photos are not in the base push mask (dedicated photo endpoint) —
  // the photo pipeline checks isPhotoExcluded() directly.
};

/** Uppercased known tokens only — unknown values drop out silently. */
export const normalizeExcludedFields = (
  excludedFields: string[] | null | undefined,
): Set<string> =>
  new Set(
    (excludedFields ?? [])
      .map((token) => token.trim().toUpperCase())
      .filter((token) => token in TOKEN_KEYS),
  );

/** P44-03: whether the photo family is excluded on this connection. */
export const isPhotoExcluded = (excludedFields: string[] | null | undefined): boolean =>
  normalizeExcludedFields(excludedFields).has("PHOTO");

const keysFor = (excluded: Set<string>): PortableKey[] =>
  [...excluded].flatMap((token) => TOKEN_KEYS[token] ?? []);

/**
 * Null out excluded fields on a portable contact. Used on both sides of the
 * supported-field shadow comparison so a change confined to an excluded field
 * never registers as a push- or pull-worthy diff, and on outbound sources for
 * providers whose write path omits absent keys (Microsoft, Google body).
 */
export const stripExcludedPortableFields = <T extends object>(
  portable: T,
  excluded: Set<string>,
): T => {
  if (excluded.size === 0) return portable;
  const next = { ...portable } as Record<string, unknown>;
  for (const key of keysFor(excluded)) {
    if (key in next) next[key] = null;
  }
  return next as T;
};

/**
 * Remove excluded keys from a Prisma contact write payload (inbound apply /
 * create). Keys are deleted — not nulled — so an excluded remote change never
 * overwrites, and never blanks, the local value.
 */
export const omitExcludedContactWriteData = <T extends Record<string, unknown>>(
  data: T,
  excluded: Set<string>,
): T => {
  if (excluded.size === 0) return data;
  const next = { ...data };
  for (const key of keysFor(excluded)) {
    delete next[key];
  }
  return next;
};

/**
 * CardDAV outbound: a vCard PUT replaces the whole card, so the pushed
 * portable carries the remote's own current values for excluded fields —
 * local edits to them never reach the remote, and the remote's data survives
 * the write. No remote card (a create) leaves the fields empty.
 */
export const mergeExcludedFieldsFromRemote = (
  outbound: PortableContactInput,
  remote: PortableContactInput | null,
  excluded: Set<string>,
): PortableContactInput => {
  if (excluded.size === 0) return outbound;
  const next = { ...outbound } as Record<string, unknown>;
  for (const key of keysFor(excluded)) {
    next[key] = remote ? ((remote as Record<string, unknown>)[key] ?? null) : null;
  }
  return next as PortableContactInput;
};

/** Google updatePersonFields with the excluded families withheld. */
export const googleUpdateFieldsFor = (
  baseMask: string,
  excluded: Set<string>,
): string => {
  if (excluded.size === 0) return baseMask;
  const withheld = new Set([...excluded].flatMap((token) => TOKEN_GOOGLE_FAMILIES[token] ?? []));
  return baseMask
    .split(",")
    .map((family) => family.trim())
    .filter((family) => family && !withheld.has(family))
    .join(",");
};
