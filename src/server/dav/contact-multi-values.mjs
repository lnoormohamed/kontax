// P49A-10 (A-14, A-19): the one canonical model for a contact's multi-value
// fields — emails, phones, postal addresses and websites.
//
// The typed, labelled `*Entries` Json columns are the single source of truth:
//   emailEntries   [{ label, value, isPrimary, ... }]
//   phoneEntries   [{ label, value, isPrimary, e164?, ... }]   (P37 metadata kept)
//   addressEntries [{ label, formatted, isPrimary, streetLine1?, ... }]
//   websiteEntries [{ label, value, isPrimary }]
// The legacy columns are DERIVED from them and never written on their own:
//   email / emailAddresses, phone / phoneNumbers, address / postalAddresses,
//   website.
// Every writer (web editor, REST API, CSV / vCard / Kontax-archive import,
// Kontax's own CardDAV server, Google / Outlook / CardDAV sync, merge, shares,
// family / team copies) builds its Prisma data with `buildMultiValueWriteData`;
// every reader goes through `readMultiValueEntries` / `read*Entries`. The
// legacy columns stay in the schema until P49A-18 drops them.
//
// Before P49A-10 the CSV import wrote only the legacy arrays and the web
// editor read only the entries, so a CSV contact's 2nd/3rd emails were
// invisible in the editor and deleted on the first save. The migration
// `20260927090000_p49a_10_backfill_multi_value_entries` backfilled every
// legacy value missing from the entries; the reader's legacy fallback below
// only covers rows the backfill has not reached yet (e.g. a deploy before the
// migration was applied).
//
// Like `plan-entitlements.mjs`, this is plain ESM with JSDoc types so the
// CardDAV server (`server.mjs`, not bundled by Next) and the Next app share
// one implementation; the Docker image ships `src/server/dav/` for exactly
// this reason.

/** @typedef {"emails" | "phones" | "addresses" | "websites"} MultiValueFamily */

/**
 * A stored email / phone / website entry. Extra keys (phone `e164`,
 * `validationStatus`, …) are carried through untouched.
 *
 * @typedef {{ label: string, value: string, isPrimary: boolean } & Record<string, unknown>} MultiValueEntry
 */

/**
 * A stored postal address entry. Two component vocabularies exist in stored
 * data — `streetLine1`/`cityOrTown`/`stateOrProvince`/`countryOrRegion`
 * (imports, sync, DAV) and `street`/`city`/`state`/`country` (the inline web
 * editor) — and both are kept as stored.
 *
 * @typedef {{ label: string, formatted: string, isPrimary: boolean } & Record<string, unknown>} MultiValueAddressEntry
 */

/**
 * Typed entries for any subset of the families. A key that is `undefined`
 * (or absent) means "not part of this write"; an empty array means "clear".
 *
 * @typedef {object} MultiValueEntriesInput
 * @property {unknown} [emailEntries]
 * @property {unknown} [phoneEntries]
 * @property {unknown} [addressEntries]
 * @property {unknown} [websiteEntries]
 */

/**
 * @typedef {object} MultiValueEntries
 * @property {MultiValueEntry[]} emailEntries
 * @property {MultiValueEntry[]} phoneEntries
 * @property {MultiValueAddressEntry[]} addressEntries
 * @property {MultiValueEntry[]} websiteEntries
 */

/** Families in a stable order, with the columns each one owns. */
export const MULTI_VALUE_FAMILIES = /** @type {const} */ ([
  "emails",
  "phones",
  "addresses",
  "websites",
]);

/**
 * Column names per family: `entries` is canonical; `scalar` and `legacy` are
 * derived (websites have no legacy array).
 */
export const MULTI_VALUE_COLUMNS = /** @type {const} */ ({
  emails: { entries: "emailEntries", scalar: "email", legacy: "emailAddresses" },
  phones: { entries: "phoneEntries", scalar: "phone", legacy: "phoneNumbers" },
  addresses: { entries: "addressEntries", scalar: "address", legacy: "postalAddresses" },
  websites: { entries: "websiteEntries", scalar: "website", legacy: null },
});

/** Label given to a legacy value that had no typed entry (backfill + reader fallback). */
export const LEGACY_ENTRY_LABEL = "other";

// --- small helpers ------------------------------------------------------------

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/** @param {unknown} value */
const trimmedString = (value) => (typeof value === "string" ? value.trim() : "");

/** @param {string} value */
const foldKey = (value) => value.trim().toLowerCase();

/**
 * @template {{ isPrimary: boolean }} T
 * @param {T[]} entries
 * @returns {T | undefined}
 */
export const primaryEntryOf = (entries) => entries.find((entry) => entry.isPrimary) ?? entries[0];

// --- normalisation --------------------------------------------------------------

/**
 * Clean a stored / incoming value-entry list: non-records and blank values
 * dropped, value and label trimmed (a blank label stays blank unless a
 * `fallbackLabel` is given — no label is invented), `isPrimary`
 * coerced to a boolean, exact label + value repeats (case-insensitive)
 * removed. Primacy is NOT reassigned — a list with no primary keeps none and
 * its first entry acts as primary when deriving the scalar — so a sync
 * shadow built from the same list compares equal.
 *
 * @param {unknown} raw
 * @param {string} [fallbackLabel]
 * @returns {MultiValueEntry[]}
 */
export const normalizeValueEntries = (raw, fallbackLabel = "") => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  /** @type {MultiValueEntry[]} */
  const entries = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const value = trimmedString(item.value);
    if (!value) continue;
    const label = trimmedString(item.label) || fallbackLabel;
    const key = `${foldKey(label)}\u0000${foldKey(value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ ...item, label, value, isPrimary: item.isPrimary === true });
  }
  return entries;
};

/**
 * Structured address components in display order, across both vocabularies.
 *
 * @param {Record<string, unknown>} entry
 */
const addressComponents = (entry) => {
  const streetLine1 = trimmedString(entry.streetLine1) || trimmedString(entry.street);
  const streetLine2 = trimmedString(entry.streetLine2);
  const city = trimmedString(entry.cityOrTown) || trimmedString(entry.city);
  const region =
    trimmedString(entry.stateOrProvince) || trimmedString(entry.state) || trimmedString(entry.region);
  const postcode = trimmedString(entry.postcode) || trimmedString(entry.postalCode);
  const country = trimmedString(entry.countryOrRegion) || trimmedString(entry.country);
  return [streetLine1, streetLine2, city, region, postcode, country].filter(Boolean);
};

/**
 * Clean a stored / incoming address-entry list. `formatted` is kept when
 * present, otherwise built from the structured components; entries with
 * neither are dropped, as are exact label + formatted + PO box repeats.
 *
 * @param {unknown} raw
 * @param {string} [fallbackLabel]
 * @returns {MultiValueAddressEntry[]}
 */
export const normalizeAddressEntries = (raw, fallbackLabel = "") => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  /** @type {MultiValueAddressEntry[]} */
  const entries = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const poBox = trimmedString(item.poBox);
    const formatted = trimmedString(item.formatted) || addressComponents(item).join(", ") || poBox;
    if (!formatted) continue;
    const label = trimmedString(item.label) || fallbackLabel;
    const key = `${foldKey(label)}\u0000${foldKey(formatted)}\u0000${foldKey(poBox)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({ ...item, label, formatted, isPrimary: item.isPrimary === true });
  }
  return entries;
};

// --- legacy → entries (backfill + reader fallback) -------------------------------

/**
 * Value entries from a legacy scalar + flat array (scalar first, primary;
 * case-insensitive duplicates dropped).
 *
 * @param {unknown} scalar
 * @param {unknown} legacy
 * @param {string} [label]
 * @returns {MultiValueEntry[]}
 */
export const valueEntriesFromLegacy = (scalar, legacy, label = LEGACY_ENTRY_LABEL) => {
  const values = [trimmedString(scalar), ...(Array.isArray(legacy) ? legacy.map(trimmedString) : [])];
  const seen = new Set();
  /** @type {MultiValueEntry[]} */
  const entries = [];
  for (const value of values) {
    if (!value || seen.has(foldKey(value))) continue;
    seen.add(foldKey(value));
    entries.push({ label, value, isPrimary: entries.length === 0 });
  }
  return entries;
};

/**
 * Address entries from the legacy `address` scalar + `postalAddresses`
 * ([{ label, formatted }]). A postal address keeps its own label when it has
 * one; everything else gets `label`.
 *
 * @param {unknown} scalar
 * @param {unknown} legacy
 * @param {string} [label]
 * @returns {MultiValueAddressEntry[]}
 */
export const addressEntriesFromLegacy = (scalar, legacy, label = LEGACY_ENTRY_LABEL) => {
  /** @type {Array<{ label: string, formatted: string }>} */
  const candidates = [];
  const primary = trimmedString(scalar);
  if (primary) candidates.push({ label, formatted: primary });
  if (Array.isArray(legacy)) {
    for (const item of legacy) {
      const formatted = isRecord(item) ? trimmedString(item.formatted) : trimmedString(item);
      const ownLabel = isRecord(item) ? trimmedString(item.label) : "";
      if (formatted) candidates.push({ label: ownLabel || label, formatted });
    }
  }
  const seen = new Set();
  /** @type {MultiValueAddressEntry[]} */
  const entries = [];
  for (const candidate of candidates) {
    if (seen.has(foldKey(candidate.formatted))) continue;
    seen.add(foldKey(candidate.formatted));
    entries.push({ ...candidate, isPrimary: entries.length === 0 });
  }
  return entries;
};

// --- readers ------------------------------------------------------------------------

/**
 * @typedef {object} ReadOptions
 * @property {string} [legacyLabel] Label for entries recovered from legacy
 *   columns (only when the typed column is empty). Default "other".
 */

/**
 * A contact's email entries: the typed column, or — only while it is empty —
 * the legacy `email` + `emailAddresses` (rows not yet backfilled).
 *
 * @param {Record<string, unknown>} contact
 * @param {ReadOptions} [options]
 */
export const readEmailEntries = (contact, options = {}) => {
  const entries = normalizeValueEntries(contact.emailEntries);
  return entries.length > 0
    ? entries
    : valueEntriesFromLegacy(contact.email, contact.emailAddresses, options.legacyLabel);
};

/**
 * @param {Record<string, unknown>} contact
 * @param {ReadOptions} [options]
 */
export const readPhoneEntries = (contact, options = {}) => {
  const entries = normalizeValueEntries(contact.phoneEntries);
  return entries.length > 0
    ? entries
    : valueEntriesFromLegacy(contact.phone, contact.phoneNumbers, options.legacyLabel);
};

/**
 * @param {Record<string, unknown>} contact
 * @param {ReadOptions} [options]
 */
export const readAddressEntries = (contact, options = {}) => {
  const entries = normalizeAddressEntries(contact.addressEntries);
  return entries.length > 0
    ? entries
    : addressEntriesFromLegacy(contact.address, contact.postalAddresses, options.legacyLabel);
};

/**
 * @param {Record<string, unknown>} contact
 * @param {ReadOptions} [options]
 */
export const readWebsiteEntries = (contact, options = {}) => {
  const entries = normalizeValueEntries(contact.websiteEntries);
  return entries.length > 0
    ? entries
    : valueEntriesFromLegacy(contact.website, null, options.legacyLabel);
};

/**
 * Every multi-value family of a stored contact row (or any object shaped like
 * one — a conflict snapshot, a merge "before" snapshot, a share payload).
 *
 * @param {Record<string, unknown>} contact
 * @param {ReadOptions} [options]
 * @returns {MultiValueEntries}
 */
export const readMultiValueEntries = (contact, options = {}) => ({
  emailEntries: readEmailEntries(contact, options),
  phoneEntries: readPhoneEntries(contact, options),
  addressEntries: readAddressEntries(contact, options),
  websiteEntries: readWebsiteEntries(contact, options),
});

// --- reconcile (backfill) -----------------------------------------------------------

/** @param {string} value */
const phoneKey = (value) => value.replace(/[^0-9+]/g, "");

/**
 * Append every legacy value that is missing from the typed entries as an
 * entry labelled "other" (a postal address keeps its own label) — the same
 * rule as the P49A-10 backfill migration, which is the SQL twin of this
 * function. Matching is case-insensitive; phones also match an entry's `e164`
 * and ignore formatting (only digits and `+` are compared). An appended entry
 * is primary only when the family had no entries at all.
 *
 * Used for data written before P49A-10 where the two representations can
 * disagree (merge "before" snapshots restored by undo); live rows are
 * backfilled by the migration and read with `readMultiValueEntries`.
 *
 * @param {Record<string, unknown>} contact
 * @returns {MultiValueEntries}
 */
export const reconcileLegacyIntoEntries = (contact) => {
  /**
   * @param {MultiValueEntry[]} entries
   * @param {string[]} legacyValues
   * @param {(value: string) => string} keyOf
   * @param {(entry: MultiValueEntry) => string[]} entryKeys
   * @returns {MultiValueEntry[]}
   */
  const appendMissing = (entries, legacyValues, keyOf, entryKeys) => {
    const known = new Set(entries.flatMap(entryKeys).map(keyOf).filter(Boolean));
    const out = [...entries];
    for (const value of legacyValues) {
      const key = keyOf(value);
      if (!key || known.has(key)) continue;
      known.add(key);
      out.push({ label: LEGACY_ENTRY_LABEL, value, isPrimary: out.length === 0 });
    }
    return out;
  };
  /** @param {unknown} scalar @param {unknown} legacy */
  const legacyStrings = (scalar, legacy) =>
    [trimmedString(scalar), ...(Array.isArray(legacy) ? legacy.map(trimmedString) : [])].filter(Boolean);

  const emailEntries = appendMissing(
    normalizeValueEntries(contact.emailEntries),
    legacyStrings(contact.email, contact.emailAddresses),
    foldKey,
    (entry) => [entry.value],
  );
  const phoneEntries = appendMissing(
    normalizeValueEntries(contact.phoneEntries),
    legacyStrings(contact.phone, contact.phoneNumbers),
    phoneKey,
    (entry) => [entry.value, trimmedString(entry.e164)],
  );
  const websiteEntries = appendMissing(
    normalizeValueEntries(contact.websiteEntries),
    legacyStrings(contact.website, null),
    foldKey,
    (entry) => [entry.value],
  );

  const addressEntries = normalizeAddressEntries(contact.addressEntries);
  const knownAddresses = new Set(addressEntries.map((entry) => foldKey(entry.formatted)));
  for (const candidate of addressEntriesFromLegacy(contact.address, contact.postalAddresses)) {
    const key = foldKey(candidate.formatted);
    if (knownAddresses.has(key)) continue;
    knownAddresses.add(key);
    addressEntries.push({ ...candidate, isPrimary: addressEntries.length === 0 });
  }

  return { emailEntries, phoneEntries, addressEntries, websiteEntries };
};

// --- entries → legacy ------------------------------------------------------------

/**
 * Distinct strings in first-seen order (case-insensitive).
 *
 * @param {string[]} values
 */
const distinct = (values) => {
  const seen = new Set();
  return values.filter((value) => {
    const key = foldKey(value);
    if (!value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * @param {unknown} raw
 * @returns {{ email: string | null, emailAddresses: string[] }}
 */
export const deriveLegacyEmails = (raw) => {
  const entries = normalizeValueEntries(raw);
  return {
    email: primaryEntryOf(entries)?.value ?? null,
    emailAddresses: distinct(entries.map((entry) => entry.value)),
  };
};

/**
 * `phoneNumbers` holds the E.164 form when the entry carries one — what the
 * web form has always written (see `buildNormalizedPhoneEntries`).
 *
 * @param {unknown} raw
 * @returns {{ phone: string | null, phoneNumbers: string[] }}
 */
export const deriveLegacyPhones = (raw) => {
  const entries = normalizeValueEntries(raw);
  return {
    phone: primaryEntryOf(entries)?.value ?? null,
    phoneNumbers: distinct(entries.map((entry) => trimmedString(entry.e164) || entry.value)),
  };
};

/**
 * @param {unknown} raw
 * @returns {{ address: string | null, postalAddresses: Array<{ label: string, formatted: string }> }}
 */
export const deriveLegacyAddresses = (raw) => {
  const entries = normalizeAddressEntries(raw);
  return {
    address: primaryEntryOf(entries)?.formatted ?? null,
    postalAddresses: entries.map((entry) => ({ label: entry.label, formatted: entry.formatted })),
  };
};

/**
 * @param {unknown} raw
 * @returns {{ website: string | null }}
 */
export const deriveLegacyWebsites = (raw) => ({
  website: primaryEntryOf(normalizeValueEntries(raw))?.value ?? null,
});

/**
 * The full write shape for the families present in `input`: normalised
 * entries plus every derived legacy column, with empty lists as `[]` and
 * empty scalars as `null`. Families whose key is `undefined` are omitted
 * (left untouched by the write).
 *
 * @param {MultiValueEntriesInput} input
 */
export const deriveMultiValueFields = (input) => {
  /** @type {{
   *   emailEntries?: MultiValueEntry[], email?: string | null, emailAddresses?: string[],
   *   phoneEntries?: MultiValueEntry[], phone?: string | null, phoneNumbers?: string[],
   *   addressEntries?: MultiValueAddressEntry[], address?: string | null,
   *   postalAddresses?: Array<{ label: string, formatted: string }>,
   *   websiteEntries?: MultiValueEntry[], website?: string | null,
   * }} */
  const fields = {};
  if (input.emailEntries !== undefined) {
    fields.emailEntries = normalizeValueEntries(input.emailEntries);
    Object.assign(fields, deriveLegacyEmails(fields.emailEntries));
  }
  if (input.phoneEntries !== undefined) {
    fields.phoneEntries = normalizeValueEntries(input.phoneEntries);
    Object.assign(fields, deriveLegacyPhones(fields.phoneEntries));
  }
  if (input.addressEntries !== undefined) {
    fields.addressEntries = normalizeAddressEntries(input.addressEntries);
    Object.assign(fields, deriveLegacyAddresses(fields.addressEntries));
  }
  if (input.websiteEntries !== undefined) {
    fields.websiteEntries = normalizeValueEntries(input.websiteEntries);
    Object.assign(fields, deriveLegacyWebsites(fields.websiteEntries));
  }
  return fields;
};

const JSON_COLUMNS = new Set([
  "emailEntries",
  "emailAddresses",
  "phoneEntries",
  "phoneNumbers",
  "addressEntries",
  "postalAddresses",
  "websiteEntries",
]);

/**
 * Prisma `data` for the families present in `input`: the typed entries and
 * the legacy columns derived from them, written together so they can never
 * disagree. An empty family is cleared — Json columns get `jsonNull` (pass
 * `Prisma.DbNull`; Prisma rejects a bare `null` for a Json column), scalars
 * `null`. Families whose key is `undefined` are left out of the write.
 *
 * @template [J=null]
 * @param {MultiValueEntriesInput} input
 * @param {{ jsonNull?: J }} [options]
 * @returns {Record<string, unknown>}
 */
export const buildMultiValueWriteData = (input, options = {}) => {
  const jsonNull = "jsonNull" in options ? options.jsonNull : null;
  /** @type {Record<string, unknown>} */
  const data = {};
  for (const [key, value] of Object.entries(deriveMultiValueFields(input))) {
    data[key] = JSON_COLUMNS.has(key) && Array.isArray(value) && value.length === 0 ? jsonNull : value;
  }
  return data;
};

/**
 * `buildMultiValueWriteData` for every family of a contact-shaped source
 * (a stored row, a snapshot): copies / restores carry all four families,
 * recovered through the reader so a not-yet-backfilled source loses nothing.
 *
 * @template [J=null]
 * @param {Record<string, unknown>} source
 * @param {{ jsonNull?: J }} [options]
 */
export const copyMultiValueWriteData = (source, options = {}) =>
  buildMultiValueWriteData(readMultiValueEntries(source), options);

/**
 * A legacy flat array only counts as "carried" when it is in Kontax's own
 * shape (strings; postal `{ formatted }` records). A raw provider object —
 * Google's `emailAddresses: [{ value, type }]` — is not a Kontax family.
 *
 * @param {MultiValueFamily} family
 * @param {unknown} legacy
 */
const isKontaxLegacyArray = (family, legacy) =>
  Array.isArray(legacy) &&
  legacy.every((item) =>
    family === "addresses"
      ? typeof item === "string" || (isRecord(item) && typeof item.formatted === "string")
      : typeof item === "string",
  );

/**
 * The families a snapshot actually carries: a typed entries array, a string
 * scalar, or a legacy array in Kontax's shape. Keys that are absent or null
 * (a family the snapshot never recorded, or stripped by a P39-03 exclusion)
 * do not count, so such a family is never cleared from a snapshot.
 *
 * @param {Record<string, unknown>} snapshot
 * @returns {MultiValueFamily[]}
 */
export const familiesPresentIn = (snapshot) =>
  MULTI_VALUE_FAMILIES.filter((family) => {
    const columns = MULTI_VALUE_COLUMNS[family];
    return (
      Array.isArray(snapshot[columns.entries]) ||
      typeof snapshot[columns.scalar] === "string" ||
      (columns.legacy !== null && isKontaxLegacyArray(family, snapshot[columns.legacy]))
    );
  });

/**
 * The families a stored supported-field shadow (or any contact-shaped object)
 * shows holding at least one value — read through the reader, so a shadow
 * recorded before P49A-10 (legacy keys only) counts too. A null / missing
 * shadow holds nothing.
 *
 * @param {unknown} shadow
 * @returns {MultiValueFamily[]}
 */
export const familiesHeldBy = (shadow) => {
  if (!isRecord(shadow)) return [];
  const entries = readMultiValueEntries(shadow);
  return MULTI_VALUE_FAMILIES.filter(
    (family) => entries[MULTI_VALUE_COLUMNS[family].entries].length > 0,
  );
};

/**
 * Write data for the families a snapshot carries, read through the reader
 * (typed entries, else the snapshot's legacy values — conflict snapshots
 * recorded before P49A-10 may only have those). A carried family with values
 * always applies; a carried but EMPTY family is only written (cleared) when it
 * is in `clearable` — the caller decides from the capability profile and, for
 * automatic applies, from evidence that the provider held the family before
 * (P49A-10 Fable review: an empty remote list is otherwise no proof that the
 * user deleted anything).
 *
 * @template [J=null]
 * @param {Record<string, unknown>} snapshot
 * @param {{ jsonNull?: J, clearable: Iterable<MultiValueFamily> }} options
 */
export const snapshotMultiValueWriteData = (snapshot, options) => {
  const present = new Set(familiesPresentIn(snapshot));
  const clearable = new Set(options.clearable);
  const entries = readMultiValueEntries(snapshot);
  /** @type {Record<MultiValueFamily, unknown[]>} */
  const byFamily = {
    emails: entries.emailEntries,
    phones: entries.phoneEntries,
    addresses: entries.addressEntries,
    websites: entries.websiteEntries,
  };
  /** @param {MultiValueFamily} family */
  const applies = (family) =>
    present.has(family) && (byFamily[family].length > 0 || clearable.has(family));
  /** @type {MultiValueEntriesInput} */
  const input = {};
  if (applies("emails")) input.emailEntries = entries.emailEntries;
  if (applies("phones")) input.phoneEntries = entries.phoneEntries;
  if (applies("addresses")) input.addressEntries = entries.addressEntries;
  if (applies("websites")) input.websiteEntries = entries.websiteEntries;
  return buildMultiValueWriteData(input, "jsonNull" in options ? { jsonNull: options.jsonNull } : {});
};
