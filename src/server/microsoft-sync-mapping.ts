// P27-05 — Microsoft Graph contact ↔ Kontax field mapping.
//
// Maps Graph /me/contacts `Contact` objects to the canonical MappedContact and
// back for the push phase. Pure functions — no DB, no network.
//
// NOTE: the real Graph contact resource exposes phone numbers as
// homePhones[] / businessPhones[] / mobilePhone (not the single typed `phones`
// array in the brief's pseudocode), so we map those actual fields.
import type {
  AddressEntry,
  MappedContact,
  ValueEntry,
} from "~/server/sync-contact-mapping";

export type GraphAddress = {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryOrRegion?: string | null;
};

export type GraphContact = {
  id?: string;
  givenName?: string | null;
  surname?: string | null;
  displayName?: string | null;
  middleName?: string | null;
  title?: string | null;
  nickName?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  department?: string | null;
  emailAddresses?: Array<{ name?: string | null; address?: string | null }>;
  homePhones?: string[];
  businessPhones?: string[];
  mobilePhone?: string | null;
  homeAddress?: GraphAddress;
  businessAddress?: GraphAddress;
  otherAddress?: GraphAddress;
  birthday?: string | null;
  personalNotes?: string | null;
  businessHomePage?: string | null;
  categories?: string[];
  sensitivity?: string | null;
  "@odata.etag"?: string;
  "@removed"?: { reason?: string };
};

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed;
};

// ── label normalisation ──────────────────────────────────────────────────────

// Outlook email entries carry a free-text `name` ("Work", "Home Email", a
// person's name, …). Map the common cases, preserve anything custom.
export const normaliseOutlookEmailName = (name: string | null | undefined): string => {
  const raw = (name ?? "").trim();
  if (!raw) return "Other";
  const lower = raw.toLowerCase();
  if (lower.includes("work") || lower.includes("business")) return "Work";
  if (lower.includes("home") || lower.includes("personal")) return "Home";
  if (lower.includes("other")) return "Other";
  return raw;
};

const KONTAX_TO_OUTLOOK_PHONE: Record<string, "business" | "home" | "mobile"> = {
  work: "business",
  business: "business",
  home: "home",
  mobile: "mobile",
  cell: "mobile",
};

export const normaliseKontaxLabelToOutlookPhone = (
  label: string | null | undefined,
): "business" | "home" | "mobile" =>
  KONTAX_TO_OUTLOOK_PHONE[(label ?? "").trim().toLowerCase()] ?? "business";

// ── helpers ──────────────────────────────────────────────────────────────────

const formatGraphAddress = (a: GraphAddress): string =>
  [a.street, a.city, a.state, a.postalCode, a.countryOrRegion]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");

const mapGraphAddressEntry = (
  a: GraphAddress,
  label: string,
): AddressEntry | null => {
  const formatted = formatGraphAddress(a);
  if (!formatted) return null;
  return {
    label,
    formatted,
    isPrimary: label === "Work",
    ...(a.countryOrRegion?.trim() ? { countryOrRegion: a.countryOrRegion.trim() } : {}),
    ...(a.street?.trim() ? { streetLine1: a.street.trim() } : {}),
    ...(a.city?.trim() ? { cityOrTown: a.city.trim() } : {}),
    ...(a.postalCode?.trim() ? { postcode: a.postalCode.trim() } : {}),
  };
};

const buildFullName = (
  contact: GraphContact,
  emails: string[],
  phones: string[],
): string => {
  const display = contact.displayName?.trim();
  if (display) return display;
  const assembled = [contact.givenName, contact.middleName, contact.surname]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  if (assembled) return assembled;
  return emails[0] ?? phones[0] ?? "Unnamed contact";
};

// ── Graph → Kontax ───────────────────────────────────────────────────────────

export const mapGraphContactToKontax = (
  contact: GraphContact,
): MappedContact | null => {
  // Delta tombstone — caller handles the delete.
  if (contact["@removed"]) return null;

  const emailEntries: ValueEntry[] = (contact.emailAddresses ?? [])
    .filter((e): e is { name?: string | null; address: string } => Boolean(e.address?.trim()))
    .map((e, i) => ({
      label: normaliseOutlookEmailName(e.name),
      value: e.address.trim(),
      isPrimary: i === 0,
    }));

  // Phones: mobile first (primary), then business (Work), then home.
  const phoneEntries: ValueEntry[] = [];
  if (contact.mobilePhone?.trim()) {
    phoneEntries.push({ label: "Mobile", value: contact.mobilePhone.trim(), isPrimary: true });
  }
  for (const p of contact.businessPhones ?? []) {
    if (p?.trim()) phoneEntries.push({ label: "Work", value: p.trim(), isPrimary: false });
  }
  for (const p of contact.homePhones ?? []) {
    if (p?.trim()) phoneEntries.push({ label: "Home", value: p.trim(), isPrimary: false });
  }

  const emailAddresses = emailEntries.map((e) => e.value);
  const phoneNumbers = phoneEntries.map((p) => p.value);

  const addressEntries: AddressEntry[] = [
    contact.businessAddress && mapGraphAddressEntry(contact.businessAddress, "Work"),
    contact.homeAddress && mapGraphAddressEntry(contact.homeAddress, "Home"),
    contact.otherAddress && mapGraphAddressEntry(contact.otherAddress, "Other"),
  ].filter((e): e is AddressEntry => e != null);
  const postalAddresses = addressEntries.map((e) => ({ label: e.label, formatted: e.formatted }));

  const websiteEntries: ValueEntry[] = contact.businessHomePage?.trim()
    ? [{ label: "Work", value: contact.businessHomePage.trim(), isPrimary: true }]
    : [];

  const customFields: Array<{ label: string; value: string }> = [];
  if (contact.categories?.length) {
    customFields.push({ label: "Categories", value: contact.categories.join(", ") });
  }
  if (contact.sensitivity && contact.sensitivity.toLowerCase() !== "normal") {
    customFields.push({ label: "Sensitivity", value: contact.sensitivity });
  }

  return {
    fullName: buildFullName(contact, emailAddresses, phoneNumbers),
    firstName: blankToNull(contact.givenName),
    middleName: blankToNull(contact.middleName),
    lastName: blankToNull(contact.surname),
    namePrefix: blankToNull(contact.title),
    nameSuffix: null,
    nickname: blankToNull(contact.nickName),
    emailAddresses,
    emailEntries,
    phoneNumbers,
    phoneEntries,
    company: blankToNull(contact.companyName),
    jobTitle: blankToNull(contact.jobTitle),
    department: blankToNull(contact.department),
    website: websiteEntries[0]?.value ?? null,
    websiteEntries,
    // Graph birthday is an ISO datetime ("1990-01-15T00:00:00Z") → YYYY-MM-DD.
    birthday: contact.birthday ? contact.birthday.substring(0, 10) : null,
    address: addressEntries[0]?.formatted ?? null,
    postalAddresses,
    addressEntries,
    notes: blankToNull(contact.personalNotes),
    relatedPeople: [],
    customFields,
  };
};

// ── Kontax → Graph (push phase, P27-06) ──────────────────────────────────────

export type GraphContactSource = {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  namePrefix?: string | null;
  nickname?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  department?: string | null;
  notes?: string | null;
  emailEntries?: ValueEntry[] | null;
  emailAddresses?: string[] | null;
  phoneEntries?: ValueEntry[] | null;
  websiteEntries?: ValueEntry[] | null;
};

export const mapKontaxContactToGraph = (
  contact: GraphContactSource,
): GraphContact => {
  const graph: GraphContact = {
    givenName: contact.firstName ?? undefined,
    surname: contact.lastName ?? undefined,
    middleName: contact.middleName ?? undefined,
    title: contact.namePrefix ?? undefined,
    nickName: contact.nickname ?? undefined,
    jobTitle: contact.jobTitle ?? undefined,
    companyName: contact.company ?? undefined,
    department: contact.department ?? undefined,
    personalNotes: contact.notes ?? undefined,
  };

  const displayName =
    contact.fullName?.trim() ??
    [contact.firstName, contact.lastName]
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(" ");
  if (displayName) graph.displayName = displayName;

  if (contact.emailEntries?.length) {
    graph.emailAddresses = contact.emailEntries.map((e) => ({ name: e.label, address: e.value }));
  } else if (contact.emailAddresses?.length) {
    graph.emailAddresses = contact.emailAddresses.map((address) => ({ address }));
  }

  if (contact.phoneEntries?.length) {
    const business: string[] = [];
    const home: string[] = [];
    let mobile: string | undefined;
    for (const p of contact.phoneEntries) {
      const type = normaliseKontaxLabelToOutlookPhone(p.label);
      if (type === "mobile") mobile ??= p.value;
      else if (type === "home") home.push(p.value);
      else business.push(p.value);
    }
    if (business.length) graph.businessPhones = business;
    if (home.length) graph.homePhones = home;
    if (mobile) graph.mobilePhone = mobile;
  }

  const workUrl = contact.websiteEntries?.find((u) => u.label === "Work") ?? contact.websiteEntries?.[0];
  if (workUrl) graph.businessHomePage = workUrl.value;

  return graph;
};
