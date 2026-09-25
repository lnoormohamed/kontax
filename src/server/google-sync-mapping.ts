// P27-02 — Google People API ↔ Kontax contact field mapping.
//
// Translates Google `Person` objects to the canonical Kontax contact write
// shape used by the sync importer (mirrors CardDavContactCard's contact fields)
// and back again for the push phase. Pure functions — no DB, no network.
import type { people_v1 } from "@googleapis/people";

import type { AddressEntry, MappedContact, ValueEntry } from "~/server/sync-contact-mapping";

export type GooglePerson = people_v1.Schema$Person;

// Connector mappers all produce the canonical MappedContact (shared shape).
export type GoogleMappedContact = MappedContact;

// ── label normalisation ──────────────────────────────────────────────────────

const GOOGLE_TO_KONTAX_LABEL: Record<string, string> = {
  mobile: "Mobile",
  home: "Home",
  work: "Work",
  other: "Other",
  main: "Main",
  homefax: "Home Fax",
  workfax: "Work Fax",
  otherfax: "Other Fax",
  fax: "Fax",
  pager: "Pager",
  workmobile: "Work Mobile",
  workpager: "Work Pager",
  googlevoice: "Google Voice",
};

// Google → Kontax. Prefers Google's human-readable formattedType, otherwise
// maps the machine `type`, otherwise falls back to "Other".
export const normaliseGoogleLabel = (
  formattedType: string | null | undefined,
  type?: string | null,
): string => {
  const raw = (type ?? "").trim();
  const mapped = GOOGLE_TO_KONTAX_LABEL[raw.toLowerCase()];
  if (mapped) return mapped;
  const formatted = (formattedType ?? "").trim();
  if (formatted) return formatted;
  if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1);
  return "Other";
};

const KONTAX_TO_GOOGLE_TYPE: Record<string, string> = {
  mobile: "mobile",
  cell: "mobile",
  home: "home",
  work: "work",
  other: "other",
  main: "main",
  fax: "homeFax",
  "home fax": "homeFax",
  "work fax": "workFax",
  pager: "pager",
};

// Kontax → Google. Google accepts arbitrary type strings, so an unmapped label
// is lower-cased and passed through rather than dropped.
export const normaliseKontaxLabelToGoogle = (label: string | null | undefined): string => {
  const raw = (label ?? "").trim();
  if (!raw) return "other";
  return KONTAX_TO_GOOGLE_TYPE[raw.toLowerCase()] ?? raw.toLowerCase();
};

// ── birthday ─────────────────────────────────────────────────────────────────

// Google → Kontax. With year: YYYY-MM-DD. Without year: --MM-DD.
export const parseGoogleBirthday = (
  birthday: people_v1.Schema$Birthday | undefined,
): string | null => {
  const d = birthday?.date;
  if (!d?.month || !d?.day) return null;
  const mm = String(d.month).padStart(2, "0");
  const dd = String(d.day).padStart(2, "0");
  return d.year ? `${d.year}-${mm}-${dd}` : `--${mm}-${dd}`;
};

// Kontax → Google. Accepts YYYY-MM-DD or --MM-DD.
export const parseBirthdayToGoogle = (
  birthday: string | null | undefined,
): people_v1.Schema$Date | undefined => {
  if (!birthday) return undefined;
  const withYear = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (withYear) {
    return {
      year: Number(withYear[1]),
      month: Number(withYear[2]),
      day: Number(withYear[3]),
    };
  }
  const noYear = /^--(\d{2})-(\d{2})$/.exec(birthday);
  if (noYear) {
    return { month: Number(noYear[1]), day: Number(noYear[2]) };
  }
  return undefined;
};

// ── helpers ──────────────────────────────────────────────────────────────────

// Trim and collapse empty strings to null (empty-string handling is why these
// use a helper rather than ?? — Google often returns "" for absent subfields).
const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
};

const toValueEntries = (
  items: Array<{
    value?: string | null;
    type?: string | null;
    formattedType?: string | null;
    metadata?: people_v1.Schema$FieldMetadata;
  }> | undefined,
): ValueEntry[] =>
  (items ?? [])
    .filter((item): item is typeof item & { value: string } => Boolean(item.value?.trim()))
    .map((item) => ({
      label: normaliseGoogleLabel(item.formattedType, item.type),
      value: item.value.trim(),
      isPrimary: Boolean(item.metadata?.primary),
    }));

const formatGoogleAddress = (a: people_v1.Schema$Address): string => {
  if (a.formattedValue?.trim()) return a.formattedValue.trim();
  return [a.streetAddress, a.extendedAddress, a.city, a.region, a.postalCode, a.country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
};

const buildFullName = (person: GooglePerson, emails: string[], phones: string[]): string => {
  const name = person.names?.[0];
  const display = name?.displayName?.trim();
  if (display) return display;
  const assembled = [name?.givenName, name?.middleName, name?.familyName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  if (assembled) return assembled;
  return emails[0] ?? phones[0] ?? "Unnamed contact";
};

// ── Google → Kontax ──────────────────────────────────────────────────────────

export const mapGooglePersonToContact = (
  person: GooglePerson,
): GoogleMappedContact | null => {
  // Deleted contacts (incremental sync tombstones) — caller handles the delete.
  if (person.metadata?.deleted) return null;

  const name = person.names?.[0];

  const emailEntries = toValueEntries(person.emailAddresses);
  const phoneEntries = toValueEntries(person.phoneNumbers);
  const websiteEntries = toValueEntries(person.urls);
  const emailAddresses = emailEntries.map((e) => e.value);
  const phoneNumbers = phoneEntries.map((p) => p.value);

  const addressEntries: AddressEntry[] = (person.addresses ?? [])
    .map((a) => ({ a, formatted: formatGoogleAddress(a) }))
    .filter(({ formatted }) => formatted.length > 0)
    .map(({ a, formatted }) => ({
      label: normaliseGoogleLabel(a.formattedType, a.type),
      formatted,
      isPrimary: Boolean(a.metadata?.primary),
      ...(a.country?.trim() ? { countryOrRegion: a.country.trim() } : {}),
      ...(a.streetAddress?.trim() ? { streetLine1: a.streetAddress.trim() } : {}),
      ...(a.extendedAddress?.trim() ? { streetLine2: a.extendedAddress.trim() } : {}),
      ...(a.city?.trim() ? { cityOrTown: a.city.trim() } : {}),
      ...(a.region?.trim() ? { stateOrProvince: a.region.trim() } : {}),
      ...(a.postalCode?.trim() ? { postcode: a.postalCode.trim() } : {}),
      ...(a.poBox?.trim() ? { poBox: a.poBox.trim() } : {}),
    }));
  const postalAddresses = addressEntries.map((e) => ({
    label: e.label,
    formatted: e.formatted,
  }));

  const organizations = person.organizations ?? [];
  const primaryOrg = organizations[0];

  // relations → relatedPeople (Kontax has a dedicated field; better fit than
  // the brief's customFields.relations).
  const relatedPeople = (person.relations ?? [])
    .filter((r): r is typeof r & { person: string } => Boolean(r.person?.trim()))
    .map((r) => ({
      relationship: normaliseGoogleLabel(r.formattedType, r.type),
      name: r.person.trim(),
    }));

  // occupations + any organisations beyond the first → customFields.
  const customFields: Array<{ label: string; value: string }> = [];
  for (const occ of person.occupations ?? []) {
    if (occ.value?.trim()) customFields.push({ label: "Occupation", value: occ.value.trim() });
  }
  for (const org of organizations.slice(1)) {
    const parts = [org.name?.trim(), org.title?.trim()].filter(Boolean).join(" — ");
    if (parts) customFields.push({ label: "Organization", value: parts });
  }

  return {
    fullName: buildFullName(person, emailAddresses, phoneNumbers),
    firstName: blankToNull(name?.givenName),
    middleName: blankToNull(name?.middleName),
    lastName: blankToNull(name?.familyName),
    namePrefix: blankToNull(name?.honorificPrefix),
    nameSuffix: blankToNull(name?.honorificSuffix),
    nickname: blankToNull(person.nicknames?.[0]?.value),
    emailAddresses,
    emailEntries,
    phoneNumbers,
    phoneEntries,
    company: blankToNull(primaryOrg?.name),
    jobTitle: blankToNull(primaryOrg?.title),
    department: blankToNull(primaryOrg?.department),
    website: websiteEntries[0]?.value ?? null,
    websiteEntries,
    birthday: parseGoogleBirthday(person.birthdays?.[0]),
    address: addressEntries[0]?.formatted ?? null,
    postalAddresses,
    addressEntries,
    notes: blankToNull(person.biographies?.[0]?.value),
    relatedPeople,
    customFields,
  };
};

// ── Kontax → Google (push phase) ─────────────────────────────────────────────

export type GoogleContactSource = {
  fullName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  namePrefix?: string | null;
  nameSuffix?: string | null;
  nickname?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  birthday?: string | null;
  notes?: string | null;
  emailEntries?: ValueEntry[] | null;
  emailAddresses?: string[] | null;
  phoneEntries?: ValueEntry[] | null;
  phoneNumbers?: string[] | null;
  // P49A-01 (A-01): websites and addresses are pushed too. They were always in
  // the update mask, so leaving them out of the body wiped them on Google.
  website?: string | null;
  websiteEntries?: ValueEntry[] | null;
  address?: string | null;
  postalAddresses?: Array<{ label: string; formatted: string }> | null;
  addressEntries?: AddressEntry[] | null;
};

const trimOrUndefined = (value: string | null | undefined): string | undefined =>
  value?.trim() ? value.trim() : undefined;

const toGoogleTyped = (
  entries: ValueEntry[] | null | undefined,
  flat: string[] | null | undefined,
): Array<{ value: string; type: string }> | undefined => {
  const typed = entries?.length
    ? entries.flatMap((e) => {
        const value = trimOrUndefined(e.value);
        return value ? [{ value, type: normaliseKontaxLabelToGoogle(e.label) }] : [];
      })
    : (flat ?? []).flatMap((raw) => {
        const value = trimOrUndefined(raw);
        return value ? [{ value, type: "other" }] : [];
      });
  return typed.length ? typed : undefined;
};

type KontaxAddressLike = {
  label: string;
  formatted: string;
  streetLine1?: string;
  streetLine2?: string;
  cityOrTown?: string;
  stateOrProvince?: string;
  postcode?: string;
  countryOrRegion?: string;
  poBox?: string;
};

// Kontax address → Google Address. Structured parts are sent when Kontax has
// them; formattedValue always carries Kontax's own formatted string so an
// unstructured address (legacy `address` / `postalAddresses`) is not lost.
const toGoogleAddress = (entry: KontaxAddressLike): people_v1.Schema$Address => ({
  type: normaliseKontaxLabelToGoogle(entry.label),
  formattedValue: entry.formatted.trim(),
  streetAddress: trimOrUndefined(entry.streetLine1),
  extendedAddress: trimOrUndefined(entry.streetLine2),
  city: trimOrUndefined(entry.cityOrTown),
  region: trimOrUndefined(entry.stateOrProvince),
  postalCode: trimOrUndefined(entry.postcode),
  country: trimOrUndefined(entry.countryOrRegion),
  poBox: trimOrUndefined(entry.poBox),
});

// Source precedence: structured addressEntries, then label+formatted
// postalAddresses, then the single legacy `address` string (the importer
// writes all three; older or hand-edited contacts may only have one).
const toGoogleAddresses = (
  contact: GoogleContactSource,
): people_v1.Schema$Address[] | undefined => {
  const structured = (contact.addressEntries ?? []).filter((e) => e.formatted?.trim());
  if (structured.length) return structured.map(toGoogleAddress);
  const postal = (contact.postalAddresses ?? []).filter((e) => e.formatted?.trim());
  if (postal.length) return postal.map(toGoogleAddress);
  const single = trimOrUndefined(contact.address);
  return single ? [toGoogleAddress({ label: "Home", formatted: single })] : undefined;
};

const toGoogleUrls = (
  contact: GoogleContactSource,
): Array<{ value: string; type: string }> | undefined =>
  toGoogleTyped(contact.websiteEntries, contact.website ? [contact.website] : []);

// Every Person family Kontax pushes. The update mask is derived from the body
// against this list (buildGoogleUpdatePersonFields), so mask and body cannot
// drift apart again.
export const GOOGLE_PUSH_PERSON_FAMILIES = [
  "names",
  "nicknames",
  "emailAddresses",
  "phoneNumbers",
  "organizations",
  "addresses",
  "birthdays",
  "urls",
  "biographies",
] as const;

export type GooglePushPersonFamily = (typeof GOOGLE_PUSH_PERSON_FAMILIES)[number];

export const mapContactToGooglePerson = (
  contact: GoogleContactSource,
): people_v1.Schema$Person => {
  const person: people_v1.Schema$Person = {};

  const name: people_v1.Schema$Name = {
    givenName: trimOrUndefined(contact.firstName),
    middleName: trimOrUndefined(contact.middleName),
    familyName: trimOrUndefined(contact.lastName),
    honorificPrefix: trimOrUndefined(contact.namePrefix),
    honorificSuffix: trimOrUndefined(contact.nameSuffix),
  };
  const displayOnly = trimOrUndefined(contact.fullName);
  if (Object.values(name).some(Boolean)) {
    person.names = [name];
  } else if (displayOnly) {
    // A contact known only by its display name would otherwise push an empty
    // name and blank it on Google.
    person.names = [{ unstructuredName: displayOnly }];
  }

  const nickname = trimOrUndefined(contact.nickname);
  if (nickname) person.nicknames = [{ value: nickname }];

  const emails = toGoogleTyped(contact.emailEntries, contact.emailAddresses);
  if (emails) person.emailAddresses = emails;

  const phones = toGoogleTyped(contact.phoneEntries, contact.phoneNumbers);
  if (phones) person.phoneNumbers = phones;

  // A-01: emit organizations whenever ANY org field is set. A title without a
  // company used to be dropped from the body while still being masked.
  const company = trimOrUndefined(contact.company);
  const title = trimOrUndefined(contact.jobTitle);
  const department = trimOrUndefined(contact.department);
  if (company || title || department) {
    person.organizations = [{ name: company, title, department }];
  }

  const addresses = toGoogleAddresses(contact);
  if (addresses) person.addresses = addresses;

  const birthdayDate = parseBirthdayToGoogle(contact.birthday);
  if (birthdayDate) person.birthdays = [{ date: birthdayDate }];

  const urls = toGoogleUrls(contact);
  if (urls) person.urls = urls;

  const notes = trimOrUndefined(contact.notes);
  if (notes) person.biographies = [{ value: notes }];

  return person;
};

// Families present (non-empty) in a push body.
export const googlePersonFamiliesPresent = (
  person: people_v1.Schema$Person,
): Set<GooglePushPersonFamily> => {
  const present = new Set<GooglePushPersonFamily>();
  for (const family of GOOGLE_PUSH_PERSON_FAMILIES) {
    const value = person[family];
    if (Array.isArray(value) && value.length > 0) present.add(family);
  }
  return present;
};

const hasData = (value: unknown) =>
  (typeof value === "string" && value.trim().length > 0) ||
  (Array.isArray(value) && value.length > 0);

// Which families held data in a link's last-synced supportedFieldShadow, i.e.
// what Google had (or was sent) at the last successful sync. The shadow is
// stored JSON and older rows may predate some keys, so it is read loosely.
export const googleFamiliesInShadow = (shadow: unknown): Set<GooglePushPersonFamily> => {
  const present = new Set<GooglePushPersonFamily>();
  if (!shadow || typeof shadow !== "object" || Array.isArray(shadow)) return present;
  const s = shadow as Record<string, unknown>;
  const any = (...keys: string[]) => keys.some((key) => hasData(s[key]));
  if (any("firstName", "middleName", "lastName", "namePrefix", "nameSuffix")) present.add("names");
  if (any("nickname")) present.add("nicknames");
  if (any("email", "emailAddresses", "emailEntries")) present.add("emailAddresses");
  if (any("phone", "phoneNumbers", "phoneEntries")) present.add("phoneNumbers");
  if (any("company", "jobTitle", "department")) present.add("organizations");
  if (any("address", "postalAddresses", "addressEntries")) present.add("addresses");
  if (any("birthday")) present.add("birthdays");
  if (any("website", "websiteEntries")) present.add("urls");
  if (any("notes")) present.add("biographies");
  return present;
};

/**
 * P49A-01 (A-01): People API `updateContact` REPLACES every family named in
 * `updatePersonFields`; a masked family missing from the body is cleared on
 * Google. So the mask is exactly:
 *   - the families present in the body, plus
 *   - intentional clears: families that held data at the last sync (the
 *     link's supportedFieldShadow) and are now empty in Kontax.
 * With no shadow (legacy link) nothing is cleared: a field the user emptied
 * survives on Google, which is the safe failure mode.
 * `withheld` families (P39-03 field exclusions) are never masked.
 */
export const buildGoogleUpdatePersonFields = (
  body: people_v1.Schema$Person,
  previousShadow: unknown,
  withheld: ReadonlySet<string> = new Set(),
): string => {
  const inBody = googlePersonFamiliesPresent(body);
  const previously = googleFamiliesInShadow(previousShadow);
  return GOOGLE_PUSH_PERSON_FAMILIES.filter(
    (family) => !withheld.has(family) && (inBody.has(family) || previously.has(family)),
  ).join(",");
};
