// P27-02 — Google People API ↔ Kontax contact field mapping.
//
// Translates Google `Person` objects to the canonical Kontax contact write
// shape used by the sync importer (mirrors CardDavContactCard's contact fields)
// and back again for the push phase. Pure functions — no DB, no network.
import type { people_v1 } from "googleapis";

export type GooglePerson = people_v1.Schema$Person;

type ValueEntry = { label: string; value: string; isPrimary: boolean };
type AddressEntry = {
  label: string;
  formatted: string;
  isPrimary: boolean;
  countryOrRegion?: string;
  streetLine1?: string;
  streetLine2?: string;
  cityOrTown?: string;
  postcode?: string;
  poBox?: string;
};

// The contact write shape the importer persists (subset of the Contact model
// that the sync runner sets, matching the CardDAV create path).
export type GoogleMappedContact = {
  fullName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  namePrefix: string | null;
  nameSuffix: string | null;
  nickname: string | null;
  emailAddresses: string[];
  emailEntries: ValueEntry[];
  phoneNumbers: string[];
  phoneEntries: ValueEntry[];
  company: string | null;
  jobTitle: string | null;
  department: string | null;
  website: string | null;
  websiteEntries: ValueEntry[];
  birthday: string | null;
  address: string | null;
  postalAddresses: Array<{ label: string; formatted: string }>;
  addressEntries: AddressEntry[];
  notes: string | null;
  relatedPeople: Array<{ relationship: string; name: string }>;
  customFields: Array<{ label: string; value: string }>;
};

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
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  namePrefix?: string | null;
  nameSuffix?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  birthday?: string | null;
  notes?: string | null;
  emailEntries?: ValueEntry[] | null;
  emailAddresses?: string[] | null;
  phoneEntries?: ValueEntry[] | null;
  phoneNumbers?: string[] | null;
};

const toGoogleTyped = (
  entries: ValueEntry[] | null | undefined,
  flat: string[] | null | undefined,
): Array<{ value: string; type: string }> | undefined => {
  if (entries?.length) {
    return entries.map((e) => ({ value: e.value, type: normaliseKontaxLabelToGoogle(e.label) }));
  }
  if (flat?.length) {
    return flat.map((value) => ({ value, type: "other" }));
  }
  return undefined;
};

export const mapContactToGooglePerson = (
  contact: GoogleContactSource,
): people_v1.Schema$Person => {
  const person: people_v1.Schema$Person = {
    names: [
      {
        givenName: contact.firstName ?? undefined,
        middleName: contact.middleName ?? undefined,
        familyName: contact.lastName ?? undefined,
        honorificPrefix: contact.namePrefix ?? undefined,
        honorificSuffix: contact.nameSuffix ?? undefined,
      },
    ],
  };

  const emails = toGoogleTyped(contact.emailEntries, contact.emailAddresses);
  if (emails) person.emailAddresses = emails;

  const phones = toGoogleTyped(contact.phoneEntries, contact.phoneNumbers);
  if (phones) person.phoneNumbers = phones;

  if (contact.company?.trim()) {
    person.organizations = [
      {
        name: contact.company.trim(),
        title: contact.jobTitle ?? undefined,
        department: contact.department ?? undefined,
      },
    ];
  }

  const birthdayDate = parseBirthdayToGoogle(contact.birthday);
  if (birthdayDate) person.birthdays = [{ date: birthdayDate }];

  if (contact.notes?.trim()) person.biographies = [{ value: contact.notes.trim() }];

  return person;
};
