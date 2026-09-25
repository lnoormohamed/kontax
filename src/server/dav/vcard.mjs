// P49A-02: vCard parse / serialize for Kontax's own CardDAV server.
//
// `server.mjs` is plain ESM JavaScript run directly by Node in production
// (`node server.mjs`), so — like `parse.mjs` next to it — this module is `.mjs`
// with JSDoc types instead of TypeScript. It was extracted from `server.mjs` so
// the device-facing vCard mapping is unit-testable (`tests/node/dav-vcard.test.ts`).
//
// The mapping owns a fixed set of Contact columns (`DAV_OWNED_FIELDS`), in two
// tiers (Fable review of P49A-02):
//   · CORE (`DAV_CORE_FIELDS`: FN/N, EMAIL, TEL, ADR, URL, NOTE, BDAY, ORG
//     company, TITLE) — every CardDAV client models these, so a PUT is a full
//     replacement: a property the device left out clears the column (that is
//     how a deletion on an iPhone arrives).
//   · EXTENDED (`DAV_EXTENDED_FIELDS`: NICKNAME, X-PHONETIC-*, the ORG
//     department component) — less-capable clients (Thunderbird, many Android
//     apps) drop these on every save, so they are only written when the body
//     carries them; absent means untouched.
// Columns outside the mapping (tags, significant dates, related people, custom
// fields, favourites, …) are never written by a PUT.
//
// Both representations of multi-value fields are written from the same parse:
// the typed `*Entries` columns (what the web app reads first) and the legacy
// `email`/`emailAddresses`, `phone`/`phoneNumbers`, `website`,
// `address`/`postalAddresses` columns.

import { Buffer } from "node:buffer";

/**
 * @typedef {object} VCardLine
 * @property {string | null} group  Property group (`item1` in `item1.TEL`), if any.
 * @property {string} name          Upper-cased property name without the group.
 * @property {Record<string, string[]>} params Upper-cased keys; bare params go under TYPE.
 * @property {string} rawValue      Value exactly as sent (still escaped).
 * @property {string} value         Unescaped, trimmed value.
 */

/** @typedef {{ label: string, value: string, isPrimary: boolean }} DavValueEntry */

/**
 * @typedef {object} DavAddressEntry
 * @property {string} label
 * @property {string} formatted
 * @property {boolean} isPrimary
 * @property {string} [poBox]
 * @property {string} [streetLine1]
 * @property {string} [streetLine2]
 * @property {string} [cityOrTown]
 * @property {string} [stateOrProvince]
 * @property {string} [postcode]
 * @property {string} [countryOrRegion]
 */

/**
 * @typedef {object} DavContactFields
 * @property {string | null} fullName
 * @property {string | null} firstName
 * @property {string | null} middleName
 * @property {string | null} lastName
 * @property {string | null} namePrefix
 * @property {string | null} nameSuffix
 * @property {string | null} nickname
 * @property {string | null} phoneticFirstName
 * @property {string | null} phoneticLastName
 * @property {string | null} company
 * @property {string | null} department
 * @property {string | null} jobTitle
 * @property {string | null} email
 * @property {string[]} emailAddresses
 * @property {DavValueEntry[]} emailEntries
 * @property {string | null} phone
 * @property {string[]} phoneNumbers
 * @property {DavValueEntry[]} phoneEntries
 * @property {string | null} website
 * @property {DavValueEntry[]} websiteEntries
 * @property {string | null} birthday
 * @property {string | null} address
 * @property {Array<{ label: string, formatted: string }>} postalAddresses
 * @property {DavAddressEntry[]} addressEntries
 * @property {string | null} notes
 * @property {string | null} [avatarUrl] Only present when the card carries a URI photo.
 */

/**
 * Extended columns: written by a PUT only when the body carries the property
 * (see `presentExtendedFields`); absent leaves the stored value untouched.
 */
export const DAV_EXTENDED_FIELDS = /** @type {const} */ ([
  "nickname",
  "phoneticFirstName",
  "phoneticLastName",
  "department",
]);

/**
 * Core columns: a PUT writes every one of these (absent → null / empty);
 * `avatarUrl` is the exception, see `parseVCardToContactFields`.
 */
export const DAV_CORE_FIELDS = /** @type {const} */ ([
  "fullName",
  "firstName",
  "middleName",
  "lastName",
  "namePrefix",
  "nameSuffix",
  "company",
  "jobTitle",
  "email",
  "emailAddresses",
  "emailEntries",
  "phone",
  "phoneNumbers",
  "phoneEntries",
  "website",
  "websiteEntries",
  "birthday",
  "address",
  "postalAddresses",
  "addressEntries",
  "notes",
]);

/** Every Contact column the DAV mapping owns (core + extended). */
export const DAV_OWNED_FIELDS = /** @type {const} */ ([...DAV_CORE_FIELDS, ...DAV_EXTENDED_FIELDS]);

/** Json columns among the owned fields — written as `jsonNull` when empty. */
const JSON_FIELDS = new Set([
  "emailAddresses",
  "emailEntries",
  "phoneNumbers",
  "phoneEntries",
  "websiteEntries",
  "postalAddresses",
  "addressEntries",
]);

// The year Apple writes into a year-less date, flagged with X-APPLE-OMIT-YEAR.
const APPLE_OMIT_YEAR = "1604";

// --- escaping ---------------------------------------------------------------

/** @param {unknown} value */
export const escapeVCardValue = (value) =>
  String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");

/**
 * Single pass, so `\\n` (an escaped backslash followed by `n`) stays a
 * backslash + `n` instead of becoming a newline — the old chained
 * `replaceAll` handled `\\` last and got that wrong.
 *
 * @param {string} value
 */
export const unescapeVCardValue = (value) =>
  value.replace(/\\([\\nN,;:])/g, (_match, char) => (char === "n" || char === "N" ? "\n" : char)).trim();

/**
 * Split a still-escaped structured value (N, ADR, ORG) on unescaped `;`. Each
 * component is returned still escaped — unescape it exactly once afterwards.
 *
 * @param {string} rawValue
 * @returns {string[]}
 */
export const splitVCardComponents = (rawValue) => {
  /** @type {string[]} */
  const parts = [];
  let current = "";

  for (let index = 0; index < rawValue.length; index += 1) {
    const char = rawValue[index];
    if (char === "\\" && index + 1 < rawValue.length) {
      current += char + rawValue[index + 1];
      index += 1;
      continue;
    }
    if (char === ";") {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
};

/**
 * Unescaped components of a structured value; missing trailing components are "".
 *
 * @param {string} rawValue
 * @param {number} count
 */
const structuredComponents = (rawValue, count) => {
  const parts = splitVCardComponents(rawValue).map(unescapeVCardValue);
  while (parts.length < count) parts.push("");
  return parts;
};

/** @param {Array<string | null | undefined>} components */
const serializeComponents = (components) =>
  components.map((component) => escapeVCardValue(component ?? "")).join(";");

// --- folding ----------------------------------------------------------------

// Fold lines at 75 octets per RFC 6350 §3.2, continuation lines start with a space.
/** @param {string} line */
export const foldVCardLine = (line) => {
  const bytes = Buffer.from(line, "utf8");

  if (bytes.length <= 75) {
    return line;
  }

  /** @type {string[]} */
  const segments = [];
  let index = 0;
  let limit = 75;

  while (index < bytes.length) {
    // Avoid splitting a multi-byte UTF-8 sequence across a fold boundary.
    let end = Math.min(index + limit, bytes.length);
    while (end < bytes.length && ((bytes[end] ?? 0) & 0xc0) === 0x80) {
      end -= 1;
    }
    segments.push(bytes.subarray(index, end).toString("utf8"));
    index = end;
    limit = 74; // continuation lines lose one octet to the leading space
  }

  return segments.join("\r\n ");
};

/** @param {string} value */
export const unfoldVCard = (value) => value.replace(/\r?\n[ \t]/g, "");

// --- line parsing -----------------------------------------------------------

/**
 * Split `text` on `separator`, ignoring separators inside double quotes.
 *
 * @param {string} text
 * @param {string} separator
 */
const splitOutsideQuotes = (text, separator) => {
  /** @type {string[]} */
  const parts = [];
  let current = "";
  let inQuotes = false;

  for (const char of text) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === separator && !inQuotes) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
};

/** @param {string} value */
const unquoteParam = (value) => {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1)
    : trimmed;
};

/** @param {string[]} paramParts */
const parseParams = (paramParts) => {
  /** @type {Record<string, string[]>} */
  const params = {};

  for (const part of paramParts) {
    const equalsIndex = part.indexOf("=");
    // vCard 2.1 bare params (`TEL;HOME;CELL:`) are TYPE values.
    const key = (equalsIndex < 0 ? "TYPE" : part.slice(0, equalsIndex)).trim().toUpperCase();
    const rawValues = equalsIndex < 0 ? part : part.slice(equalsIndex + 1);
    if (!key) continue;

    const values = splitOutsideQuotes(rawValues, ",")
      .map(unquoteParam)
      .filter((value) => value.length > 0);
    params[key] = [...(params[key] ?? []), ...values];
  }

  return params;
};

/**
 * Parse one unfolded content line. Group prefixes (`item1.ADR`) are split off
 * so matching is always on the bare property name.
 *
 * @param {string} line
 * @returns {VCardLine | null}
 */
const parseContentLine = (line) => {
  let inQuotes = false;
  let separatorIndex = -1;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ":" && !inQuotes) {
      separatorIndex = index;
      break;
    }
  }

  if (separatorIndex < 0) {
    return null;
  }

  const [nameWithGroup = "", ...paramParts] = splitOutsideQuotes(line.slice(0, separatorIndex), ";");
  const dotIndex = nameWithGroup.indexOf(".");
  const group = dotIndex > 0 ? nameWithGroup.slice(0, dotIndex).trim() : null;
  const name = (dotIndex >= 0 ? nameWithGroup.slice(dotIndex + 1) : nameWithGroup).trim().toUpperCase();

  if (!name) {
    return null;
  }

  const rawValue = line.slice(separatorIndex + 1);

  return {
    group: group && group.length > 0 ? group.toLowerCase() : null,
    name,
    params: parseParams(paramParts),
    rawValue,
    value: unescapeVCardValue(rawValue),
  };
};

/**
 * @param {string} value
 * @returns {VCardLine[]}
 */
export const parseVCardLines = (value) =>
  unfoldVCard(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.toUpperCase().startsWith("BEGIN:") &&
        !line.toUpperCase().startsWith("END:"),
    )
    .map(parseContentLine)
    .filter(/** @returns {line is VCardLine} */ (line) => line !== null);

/** @param {string} text */
export const getVCardUid = (text) => {
  const match = unfoldVCard(text).match(/^UID(?:;[^:]*)?:(.+)$/im);
  return match?.[1]?.trim() ?? null;
};

/** @param {string} text */
export const isGroupVCard = (text) => /\bKIND:group\b/i.test(unfoldVCard(text));

// --- labels -----------------------------------------------------------------

// Apple's built-in labels (`_$!<Mobile>!$_`) → Kontax labels.
/** @type {Record<string, string>} */
const APPLE_LABELS = {
  mobile: "Mobile",
  iphone: "iPhone",
  home: "Home",
  work: "Work",
  main: "Main",
  homefax: "Home fax",
  workfax: "Work fax",
  otherfax: "Other fax",
  pager: "Pager",
  homepage: "Homepage",
  school: "School",
  other: "Other",
};

// Kontax labels that have an Apple built-in form with no vCard TYPE equivalent.
/** @type {Record<string, string>} */
const APPLE_ONLY_LABELS = {
  homepage: "_$!<HomePage>!$_",
  school: "_$!<School>!$_",
};

/** @param {string} raw */
const normalizeCustomLabel = (raw) => {
  const trimmed = raw.trim();
  const apple = /^_\$!<(.*)>!\$_$/.exec(trimmed);
  if (!apple) return trimmed || null;
  const inner = (apple[1] ?? "").trim();
  return APPLE_LABELS[inner.toLowerCase()] ?? (inner || null);
};

/** @param {VCardLine} line */
const lineTypes = (line) => (line.params.TYPE ?? []).map((type) => type.toLowerCase());

/** @param {VCardLine} line */
const isPreferred = (line) => lineTypes(line).includes("pref") || (line.params.PREF?.length ?? 0) > 0;

const IGNORED_TYPES = new Set(["pref", "internet", "voice", "x400", "msg", "dom", "intl", "parcel", "postal"]);

/**
 * Label from TYPE params (`TYPE=CELL` → "Mobile").
 *
 * @param {VCardLine} line
 * @param {string} fallback
 */
const labelFromTypes = (line, fallback) => {
  const types = lineTypes(line);
  if (types.includes("iphone")) return "iPhone";
  if (types.includes("fax")) {
    if (types.includes("home")) return "Home fax";
    if (types.includes("work")) return "Work fax";
    return "Fax";
  }
  if (types.includes("cell") || types.includes("mobile")) return "Mobile";
  if (types.includes("main")) return "Main";
  if (types.includes("pager")) return "Pager";
  if (types.includes("home")) return "Home";
  if (types.includes("work")) return "Work";
  if (types.includes("other")) return "Other";

  const custom = (line.params.TYPE ?? []).find((type) => !IGNORED_TYPES.has(type.toLowerCase()));
  return custom?.trim() ? custom.trim() : fallback;
};

/**
 * Entry label: an `X-ABLabel` from the same group wins, then TYPE params.
 *
 * @param {VCardLine[]} lines
 * @param {VCardLine} line
 * @param {string} fallback
 */
const resolveLabel = (lines, line, fallback) => {
  if (line.group) {
    const labelLine = lines.find(
      (candidate) => candidate.group === line.group && candidate.name === "X-ABLABEL",
    );
    const custom = labelLine ? normalizeCustomLabel(labelLine.value) : null;
    if (custom) return custom;
  }
  return labelFromTypes(line, fallback);
};

/**
 * TYPE params for a Kontax label, or null when it needs an `X-ABLabel`.
 *
 * @param {"EMAIL" | "TEL" | "URL" | "ADR"} property
 * @param {string} label
 * @returns {string[] | null}
 */
const typesForLabel = (property, label) => {
  const normalized = label.trim().toLowerCase();

  /** @type {Record<string, string[]>} */
  const common = { home: ["HOME"], work: ["WORK"], other: ["OTHER"] };
  /** @type {Record<string, string[]>} */
  const phone = {
    ...common,
    mobile: ["CELL", "VOICE"],
    cell: ["CELL", "VOICE"],
    iphone: ["IPHONE", "CELL", "VOICE"],
    main: ["MAIN"],
    fax: ["FAX"],
    "home fax": ["HOME", "FAX"],
    "work fax": ["WORK", "FAX"],
    pager: ["PAGER"],
  };

  // No label, or the web form's placeholder "primary" label: plain property
  // (primacy itself travels as TYPE=PREF).
  if (!normalized || normalized === "primary") return [];
  if (property === "TEL") return phone[normalized] ?? null;
  return common[normalized] ?? null;
};

// --- value entries ----------------------------------------------------------

/** @param {string} value */
const valueKey = (value) => value.trim().toLowerCase();

/** @param {string} label @param {string} value */
const entryKey = (label, value) => `${label.trim().toLowerCase()}\u0000${valueKey(value)}`;

/**
 * @param {VCardLine[]} lines
 * @param {string} property
 * @param {string} fallbackLabel
 * @returns {DavValueEntry[]}
 */
const parseValueEntries = (lines, property, fallbackLabel) => {
  const seen = new Set();
  /** @type {Array<DavValueEntry & { preferred: boolean }>} */
  const entries = [];

  for (const line of lines) {
    if (line.name !== property) continue;
    const value = line.value.trim();
    if (!value) continue;
    const label = resolveLabel(lines, line, fallbackLabel);
    // Same value under two labels (a shared line as Home and Work) stays two
    // entries; only an exact value + label repeat is a duplicate.
    const key = entryKey(label, value);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push({
      label,
      value,
      isPrimary: false,
      preferred: isPreferred(line),
    });
  }

  const primaryIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.preferred),
  );
  return entries.map(({ preferred: _preferred, ...entry }, index) => ({
    ...entry,
    isPrimary: index === primaryIndex,
  }));
};

/**
 * @param {VCardLine[]} lines
 * @returns {DavAddressEntry[]}
 */
const parseAddressEntries = (lines) => {
  const seen = new Set();
  /** @type {Array<DavAddressEntry & { preferred: boolean }>} */
  const entries = [];

  for (const line of lines) {
    if (line.name !== "ADR") continue;
    const [poBox, streetLine2, streetLine1, cityOrTown, stateOrProvince, postcode, countryOrRegion] =
      structuredComponents(line.rawValue, 7);
    const formatted = [streetLine1, streetLine2, cityOrTown, stateOrProvince, postcode, countryOrRegion]
      .filter(Boolean)
      .join(", ");
    const key = [poBox, formatted].join("|").toLowerCase();
    if (!formatted && !poBox) continue;
    if (seen.has(key)) continue;
    seen.add(key);

    /** @type {DavAddressEntry & { preferred: boolean }} */
    const entry = {
      label: resolveLabel(lines, line, "Home"),
      formatted: formatted || poBox || "",
      isPrimary: false,
      preferred: isPreferred(line),
    };
    if (poBox) entry.poBox = poBox;
    if (streetLine1) entry.streetLine1 = streetLine1;
    if (streetLine2) entry.streetLine2 = streetLine2;
    if (cityOrTown) entry.cityOrTown = cityOrTown;
    if (stateOrProvince) entry.stateOrProvince = stateOrProvince;
    if (postcode) entry.postcode = postcode;
    if (countryOrRegion) entry.countryOrRegion = countryOrRegion;
    entries.push(entry);
  }

  const primaryIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.preferred),
  );
  return entries.map(({ preferred: _preferred, ...entry }, index) => ({
    ...entry,
    isPrimary: index === primaryIndex,
  }));
};

/**
 * @template {{ isPrimary: boolean }} T
 * @param {T[]} entries
 * @returns {T | undefined}
 */
const primaryOf = (entries) => entries.find((entry) => entry.isPrimary) ?? entries[0];

// --- birthdays --------------------------------------------------------------

/**
 * Kontax stores a year-less birthday as `--MM-DD` (see `src/lib/dates.ts`,
 * `src/server/reminders.ts`, the v1 API schema). Apple writes one as
 * `BDAY;X-APPLE-OMIT-YEAR=1604:1604-MM-DD`; vCard 4 / DAVx⁵ as `--MMDD`.
 *
 * @param {VCardLine} line
 */
export const parseVCardBirthday = (line) => {
  const raw = line.value.trim();
  if (!raw) return null;

  const yearless = /^--(\d{2})-?(\d{2})$/.exec(raw);
  if (yearless) return `--${yearless[1]}-${yearless[2]}`;

  const full = /^(\d{4})-?(\d{2})-?(\d{2})(?:T.*)?$/.exec(raw);
  if (full) {
    const [, year, month, day] = full;
    const omitYear = line.params["X-APPLE-OMIT-YEAR"]?.[0]?.trim();
    if ((omitYear && omitYear === year) || (!omitYear && year === APPLE_OMIT_YEAR)) {
      return `--${month}-${day}`;
    }
    return `${year}-${month}-${day}`;
  }

  return raw;
};

/**
 * BDAY line for a stored birthday. Year-less dates use Apple's form, which
 * iOS, macOS and DAVx⁵ all read back as "no year".
 *
 * @param {string} birthday
 */
export const serializeVCardBirthday = (birthday) => {
  const trimmed = birthday.trim();
  const yearless = /^--(\d{2})-?(\d{2})$/.exec(trimmed);
  if (yearless) {
    return `BDAY;X-APPLE-OMIT-YEAR=${APPLE_OMIT_YEAR}:${APPLE_OMIT_YEAR}-${yearless[1]}-${yearless[2]}`;
  }
  const full = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(trimmed);
  if (full) {
    return `BDAY:${full[1]}-${full[2]}-${full[3]}`;
  }
  return `BDAY:${escapeVCardValue(trimmed)}`;
};

// --- parse ------------------------------------------------------------------

/** @param {string | null | undefined} value */
const orNull = (value) => (value?.trim() ? value.trim() : null);

/**
 * Legacy flat arrays: one value each, even when two labelled entries share it.
 *
 * @param {DavValueEntry[]} entries
 */
const distinctValues = (entries) => {
  const seen = new Set();
  return entries
    .map((entry) => entry.value)
    .filter((value) => {
      const key = valueKey(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

/**
 * Parse a vCard body into every Contact column the DAV mapping owns. Absent
 * properties come back as null / [] so the PUT clears them.
 *
 * `avatarUrl` is only returned when the card carries a URI photo: devices
 * send inline (base64) photos, which this server does not store, so a missing
 * URI photo must not wipe the stored avatar.
 *
 * @param {string} text
 * @returns {DavContactFields}
 */
export const parseVCardToContactFields = (text) => fieldsFromLines(parseVCardLines(text));

/**
 * @param {VCardLine[]} lines
 * @returns {DavContactFields}
 */
const fieldsFromLines = (lines) => {
  /** @param {string} name */
  const first = (name) => lines.find((line) => line.name === name);

  const nLine = first("N");
  const [lastName, firstName, middleName, namePrefix, nameSuffix] = nLine
    ? structuredComponents(nLine.rawValue, 5)
    : [];

  const orgLine = first("ORG");
  const [company, department] = orgLine ? structuredComponents(orgLine.rawValue, 2) : [];

  const phoneticFirst =
    first("X-PHONETIC-FIRST-NAME") ?? first("X-KONTAX-PINYIN-FIRST-NAME");
  const phoneticLast = first("X-PHONETIC-LAST-NAME") ?? first("X-KONTAX-PINYIN-LAST-NAME");

  const emailEntries = parseValueEntries(lines, "EMAIL", "Other");
  const phoneEntries = parseValueEntries(lines, "TEL", "Other");
  const websiteEntries = parseValueEntries(lines, "URL", "Other");
  const addressEntries = parseAddressEntries(lines);

  const bdayLine = first("BDAY");
  const notes = lines
    .filter((line) => line.name === "NOTE")
    .map((line) => line.value)
    .filter(Boolean)
    .join("\n\n");

  /** @type {DavContactFields} */
  const fields = {
    fullName: orNull(first("FN")?.value),
    firstName: orNull(firstName),
    middleName: orNull(middleName),
    lastName: orNull(lastName),
    namePrefix: orNull(namePrefix),
    nameSuffix: orNull(nameSuffix),
    nickname: orNull(first("NICKNAME")?.value),
    phoneticFirstName: orNull(phoneticFirst?.value),
    phoneticLastName: orNull(phoneticLast?.value),
    company: orNull(company),
    department: orNull(department),
    jobTitle: orNull(first("TITLE")?.value),
    email: primaryOf(emailEntries)?.value ?? null,
    emailAddresses: distinctValues(emailEntries),
    emailEntries,
    phone: primaryOf(phoneEntries)?.value ?? null,
    phoneNumbers: distinctValues(phoneEntries),
    phoneEntries,
    website: primaryOf(websiteEntries)?.value ?? null,
    websiteEntries,
    birthday: bdayLine ? parseVCardBirthday(bdayLine) : null,
    address: primaryOf(addressEntries)?.formatted ?? null,
    postalAddresses: addressEntries.map((entry) => ({ label: entry.label, formatted: entry.formatted })),
    addressEntries,
    notes: notes || null,
  };

  const photoLine = first("PHOTO");
  if (photoLine && (photoLine.params.VALUE ?? []).some((value) => /^uri$/i.test(value))) {
    // P48-04 follow-up: a device can put anything in PHOTO;VALUE=URI. Only keep
    // http(s) URLs; every later fetch of this value goes through the SSRF guard.
    const photoUri = photoLine.value.trim();
    fields.avatarUrl = /^https?:\/\//i.test(photoUri) ? photoUri : null;
  }

  return fields;
};

/**
 * Extended fields the body actually carries. NICKNAME and the phonetic names
 * count when their property is present (even empty, which is how a client that
 * models them sends a deletion); the department counts when ORG has a second
 * component (`ORG:Acme;` clears it, `ORG:Acme` leaves it alone).
 *
 * @param {VCardLine[]} lines
 * @returns {Set<string>}
 */
const presentExtendedFields = (lines) => {
  const names = new Set(lines.map((line) => line.name));
  const present = new Set();
  if (names.has("NICKNAME")) present.add("nickname");
  if (names.has("X-PHONETIC-FIRST-NAME") || names.has("X-KONTAX-PINYIN-FIRST-NAME")) {
    present.add("phoneticFirstName");
  }
  if (names.has("X-PHONETIC-LAST-NAME") || names.has("X-KONTAX-PINYIN-LAST-NAME")) {
    present.add("phoneticLastName");
  }
  const orgLine = lines.find((line) => line.name === "ORG");
  if (orgLine && splitVCardComponents(orgLine.rawValue).length >= 2) present.add("department");
  return present;
};

/**
 * Carry stored per-entry metadata (phone `e164` / validation, any other extra
 * keys) over to the parsed entry with the same value, so a device round-trip
 * doesn't strip it. The device's label / value / primacy win. Matches on value
 * + label first, then value alone; each stored entry is used at most once.
 *
 * @param {DavValueEntry[]} incoming
 * @param {unknown} stored
 * @returns {Array<Record<string, unknown>>}
 */
export const mergeStoredEntryMetadata = (incoming, stored) => {
  const pool = Array.isArray(stored) ? stored.filter(isRecord) : [];
  if (pool.length === 0) return incoming;

  /** @type {Set<number>} */
  const used = new Set();
  /** @type {Array<Record<string, unknown> | null>} */
  const matches = incoming.map(() => null);
  /** @param {(candidate: unknown, entry: DavValueEntry) => boolean} same */
  const pass = (same) => {
    incoming.forEach((entry, index) => {
      if (matches[index]) return;
      const found = pool.findIndex((candidate, i) => !used.has(i) && same(candidate, entry));
      if (found < 0) return;
      used.add(found);
      matches[index] = /** @type {Record<string, unknown>} */ (pool[found]);
    });
  };
  pass(
    (candidate, entry) =>
      entryKey(stringField(candidate, "label"), stringField(candidate, "value")) ===
      entryKey(entry.label, entry.value),
  );
  pass((candidate, entry) => valueKey(stringField(candidate, "value")) === valueKey(entry.value));

  return incoming.map((entry, index) => {
    const match = matches[index];
    return match ? { ...match, label: entry.label, value: entry.value, isPrimary: entry.isPrimary } : entry;
  });
};

/**
 * Prisma write data for a device PUT, with empty Json columns written as
 * `jsonNull` (pass `Prisma.DbNull`; Prisma rejects a bare `null` for a Json
 * column) and a display name always present.
 *
 * Core columns are always written (absent → cleared); extended columns only
 * when the body carries them. Pass the stored contact as `existing` to keep
 * per-entry metadata on unchanged phone / email / website entries.
 *
 * @template [J=null]
 * @param {string} text
 * @param {{ jsonNull?: J, existing?: Record<string, unknown> | null }} [options]
 * @returns {Record<string, unknown> & { fullName: string }}
 */
export const buildDavContactWriteData = (text, options = {}) => {
  const lines = parseVCardLines(text);
  const fields = fieldsFromLines(lines);
  const jsonNull = "jsonNull" in options ? options.jsonNull : null;
  const existing = options.existing ?? null;
  const presentExtended = presentExtendedFields(lines);

  /** @type {Record<string, unknown>} */
  const merged = { ...fields };
  if (existing) {
    merged.phoneEntries = mergeStoredEntryMetadata(fields.phoneEntries, existing.phoneEntries);
    merged.emailEntries = mergeStoredEntryMetadata(fields.emailEntries, existing.emailEntries);
    merged.websiteEntries = mergeStoredEntryMetadata(fields.websiteEntries, existing.websiteEntries);
  }

  /** @type {ReadonlySet<string>} */
  const extended = new Set(DAV_EXTENDED_FIELDS);
  /** @type {Record<string, unknown>} */
  const data = {};
  for (const [key, value] of Object.entries(merged)) {
    if (extended.has(key) && !presentExtended.has(key)) continue;
    data[key] = JSON_FIELDS.has(key) && Array.isArray(value) && value.length === 0 ? jsonNull : value;
  }

  const fullName =
    fields.fullName ??
    ([fields.firstName, fields.lastName].filter(Boolean).join(" ").trim() ||
      fields.company ||
      fields.email ||
      "Unnamed contact");

  return { ...data, fullName };
};

// --- serialize --------------------------------------------------------------

/** @param {unknown} value */
const isRecord = (value) => typeof value === "object" && value !== null;

/** @param {unknown} value @param {string} key */
const stringField = (value, key) => {
  if (!isRecord(value)) return "";
  const field = /** @type {Record<string, unknown>} */ (value)[key];
  return typeof field === "string" ? field.trim() : "";
};

/** @param {unknown} value */
const toStringArray = (value) =>
  Array.isArray(value)
    ? value.filter(/** @returns {entry is string} */ (entry) => typeof entry === "string" && entry.trim().length > 0)
    : [];

/**
 * Typed entries when the contact has them, else the legacy scalar + array.
 *
 * @param {unknown} entries
 * @param {unknown} scalar
 * @param {unknown} legacy
 * @returns {DavValueEntry[]}
 */
const resolveValueEntries = (entries, scalar, legacy) => {
  /** @type {DavValueEntry[]} */
  let resolved = Array.isArray(entries)
    ? entries
        .map((entry) => ({
          label: stringField(entry, "label"),
          value: stringField(entry, "value"),
          isPrimary: isRecord(entry) && /** @type {Record<string, unknown>} */ (entry).isPrimary === true,
        }))
        .filter((entry) => entry.value.length > 0)
    : [];

  if (resolved.length === 0) {
    const values = [...(typeof scalar === "string" && scalar.trim() ? [scalar.trim()] : []), ...toStringArray(legacy)];
    resolved = values.map((value, index) => ({ label: "", value: value.trim(), isPrimary: index === 0 }));
  }

  // Dedupe on value + label, matching the parser: two labels for one value are
  // two entries the device must see, or its next PUT would drop one.
  const seen = new Set();
  return resolved.filter((entry) => {
    const key = entryKey(entry.label, entry.value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * @param {Record<string, unknown>} contact
 * @returns {Array<{ label: string, isPrimary: boolean, components: string[] }>}
 */
const resolveAddressEntries = (contact) => {
  const entries = Array.isArray(contact.addressEntries) ? contact.addressEntries : [];
  const resolved = entries
    .map((entry) => {
      // Web editor entries use street/city/state/country; imported ones use
      // streetLine1/cityOrTown/stateOrProvince/countryOrRegion.
      const street = stringField(entry, "streetLine1") || stringField(entry, "street");
      const streetLine2 = stringField(entry, "streetLine2");
      const city = stringField(entry, "cityOrTown") || stringField(entry, "city");
      const region = stringField(entry, "stateOrProvince") || stringField(entry, "state");
      const postcode = stringField(entry, "postcode");
      const country = stringField(entry, "countryOrRegion") || stringField(entry, "country");
      const poBox = stringField(entry, "poBox");
      const formatted = stringField(entry, "formatted");
      const structured = Boolean(street || streetLine2 || city || region || postcode || country || poBox);
      return {
        label: stringField(entry, "label"),
        isPrimary: isRecord(entry) && /** @type {Record<string, unknown>} */ (entry).isPrimary === true,
        components: structured
          ? [poBox, streetLine2, street, city, region, postcode, country]
          : ["", "", formatted, "", "", "", ""],
      };
    })
    .filter((entry) => entry.components.some(Boolean));

  if (resolved.length > 0) return resolved;

  const legacy = [];
  if (typeof contact.address === "string" && contact.address.trim()) {
    legacy.push({ label: "", formatted: contact.address.trim() });
  }
  if (Array.isArray(contact.postalAddresses)) {
    for (const postal of contact.postalAddresses) {
      const formatted = stringField(postal, "formatted");
      if (formatted && !legacy.some((entry) => entry.formatted === formatted)) {
        legacy.push({ label: stringField(postal, "label"), formatted });
      }
    }
  }
  return legacy.map((entry, index) => ({
    label: entry.label,
    isPrimary: index === 0,
    components: ["", "", entry.formatted, "", "", "", ""],
  }));
};

/**
 * Render a stored contact as the vCard 3.0 a device downloads. Every column
 * the PUT mapping owns is emitted, so a device that edits one field and sends
 * the card back does not clear the others.
 *
 * @param {Record<string, unknown> & { syncUid: string, fullName: string }} contact
 */
export const serializeContactToVCard = (contact) => {
  /** @param {string} key */
  const text = (key) => {
    const value = contact[key];
    return typeof value === "string" && value.trim() ? value : null;
  };

  const lines = ["BEGIN:VCARD", "VERSION:3.0", `UID:${escapeVCardValue(contact.syncUid)}`];
  let groupIndex = 1;

  /**
   * @param {"EMAIL" | "TEL" | "URL" | "ADR"} property
   * @param {string} value   Already escaped.
   * @param {string} label
   * @param {boolean} isPrimary
   */
  const pushTyped = (property, value, label, isPrimary) => {
    const types = typesForLabel(property, label);
    const allTypes = [...(property === "EMAIL" ? ["INTERNET"] : []), ...(types ?? [])];
    if (isPrimary) allTypes.push("PREF");
    const typeSegment = [...new Set(allTypes)].map((type) => `;TYPE=${type}`).join("");

    if (types) {
      lines.push(`${property}${typeSegment}:${value}`);
      return;
    }

    // A label with no TYPE equivalent travels as an Apple group label, which
    // iOS, macOS and DAVx⁵ all show and send back.
    const group = `item${groupIndex}`;
    groupIndex += 1;
    const appleLabel = APPLE_ONLY_LABELS[label.trim().toLowerCase()] ?? label.trim();
    lines.push(`${group}.${property}${typeSegment}:${value}`);
    lines.push(`${group}.X-ABLabel:${escapeVCardValue(appleLabel)}`);
  };

  lines.push(`FN:${escapeVCardValue(contact.fullName)}`);

  const nameParts = ["lastName", "firstName", "middleName", "namePrefix", "nameSuffix"].map(text);
  if (nameParts.some(Boolean)) {
    lines.push(`N:${serializeComponents(nameParts)}`);
  }

  const nickname = text("nickname");
  if (nickname) lines.push(`NICKNAME:${escapeVCardValue(nickname)}`);

  const phoneticFirstName = text("phoneticFirstName");
  if (phoneticFirstName) lines.push(`X-PHONETIC-FIRST-NAME:${escapeVCardValue(phoneticFirstName)}`);

  const phoneticLastName = text("phoneticLastName");
  if (phoneticLastName) lines.push(`X-PHONETIC-LAST-NAME:${escapeVCardValue(phoneticLastName)}`);

  for (const entry of resolveValueEntries(contact.emailEntries, contact.email, contact.emailAddresses)) {
    pushTyped("EMAIL", escapeVCardValue(entry.value), entry.label, entry.isPrimary);
  }

  for (const entry of resolveValueEntries(contact.phoneEntries, contact.phone, contact.phoneNumbers)) {
    pushTyped("TEL", escapeVCardValue(entry.value), entry.label, entry.isPrimary);
  }

  const company = text("company");
  const department = text("department");
  if (company || department) {
    lines.push(`ORG:${serializeComponents(department ? [company, department] : [company])}`);
  }

  const jobTitle = text("jobTitle");
  if (jobTitle) lines.push(`TITLE:${escapeVCardValue(jobTitle)}`);

  for (const entry of resolveValueEntries(contact.websiteEntries, contact.website, null)) {
    pushTyped("URL", escapeVCardValue(entry.value), entry.label, entry.isPrimary);
  }

  const birthday = text("birthday");
  if (birthday) lines.push(serializeVCardBirthday(birthday));

  for (const entry of resolveAddressEntries(contact)) {
    pushTyped("ADR", serializeComponents(entry.components), entry.label, entry.isPrimary);
  }

  const notes = text("notes");
  if (notes) lines.push(`NOTE:${escapeVCardValue(notes)}`);

  const avatarUrl = text("avatarUrl");
  if (avatarUrl) lines.push(`PHOTO;VALUE=URI:${escapeVCardValue(avatarUrl)}`);

  lines.push("END:VCARD");

  return lines.map(foldVCardLine).join("\r\n");
};
