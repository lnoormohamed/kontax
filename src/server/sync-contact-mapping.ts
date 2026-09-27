// Canonical mapped-contact shape shared by every sync connector's field mapper
// (Google P27-02, Microsoft P27-05). Maps to the same Contact write fields the
// CardDAV importer sets, so contacts look identical regardless of source.
//
// P49A-10: the mapped typed entries are canonical — the legacy email/phone/
// address/website columns are derived from them (src/server/contact-multi-values.ts),
// never from the mapper's flat arrays. P49A-10 (A-19): an empty inbound list
// clears the local one when the provider's list is authoritative for that
// family (capability profile) and the record actually carried it.
import type { PortableContactInput } from "~/server/contact-portability";
import {
  deriveLegacyAddresses,
  deriveLegacyEmails,
  deriveLegacyPhones,
  deriveLegacyWebsites,
  type MultiValueFamily,
  multiValueWriteData,
  normalizeAddressEntries,
  normalizeValueEntries,
} from "~/server/contact-multi-values";
import {
  providerListIsAuthoritative,
  type SyncProviderCapabilityProfile,
} from "~/server/sync-provider-capabilities";

export type ValueEntry = { label: string; value: string; isPrimary: boolean };

export type AddressEntry = {
  label: string;
  formatted: string;
  isPrimary: boolean;
  countryOrRegion?: string;
  streetLine1?: string;
  streetLine2?: string;
  cityOrTown?: string;
  stateOrProvince?: string;
  postcode?: string;
  poBox?: string;
};

// The subset of the Contact model a connector's mapper produces.
export type MappedContact = {
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
  // P49A-10 (A-19): families this remote record did not carry at all (a
  // partial payload — e.g. an Outlook contact whose JSON has no phone keys).
  // Left untouched on apply, never cleared. Absent = the record carried every
  // family it maps.
  omittedFamilies?: MultiValueFamily[];
};

// Which multi-value families an inbound apply writes. An empty list is only a
// deletion when the provider's list is authoritative for the family and this
// record carried it; otherwise an empty list leaves the local values alone
// (a non-empty one always applies).
const inboundFamilies = (
  m: MappedContact,
  profile: SyncProviderCapabilityProfile,
): Record<MultiValueFamily, boolean> => {
  const omitted = new Set(m.omittedFamilies ?? []);
  const applies = (family: MultiValueFamily, entries: unknown[]) =>
    !omitted.has(family) && (entries.length > 0 || providerListIsAuthoritative(profile, family));
  return {
    emails: applies("emails", m.emailEntries),
    phones: applies("phones", m.phoneEntries),
    addresses: applies("addresses", m.addressEntries),
    websites: applies("websites", m.websiteEntries),
  };
};

// MappedContact → Prisma contact write data (mirrors the CardDAV create path).
// Multi-value families go through the canonical module: typed entries plus the
// legacy columns derived from them, an applied empty family cleared (A-19).
// relatedPeople / customFields are omitted (undefined) when empty — Kontax
// keeps local-only values there that no provider returns.
export const mappedContactToWriteData = (
  m: MappedContact,
  profile: SyncProviderCapabilityProfile,
) => {
  const families = inboundFamilies(m, profile);
  return {
    fullName: m.fullName,
    firstName: m.firstName,
    middleName: m.middleName,
    lastName: m.lastName,
    namePrefix: m.namePrefix,
    nameSuffix: m.nameSuffix,
    nickname: m.nickname,
    ...multiValueWriteData({
      emailEntries: families.emails ? m.emailEntries : undefined,
      phoneEntries: families.phones ? m.phoneEntries : undefined,
      addressEntries: families.addresses ? m.addressEntries : undefined,
      websiteEntries: families.websites ? m.websiteEntries : undefined,
    }),
    company: m.company,
    jobTitle: m.jobTitle,
    department: m.department,
    birthday: m.birthday,
    notes: m.notes,
    relatedPeople: m.relatedPeople.length > 0 ? m.relatedPeople : undefined,
    customFields: m.customFields.length > 0 ? m.customFields : undefined,
  };
};

// The remote side of a supported-field shadow / conflict snapshot. Entries are
// normalised exactly as the write normalises them and the legacy keys derived
// from them, so the shadow of what was just applied equals the local shadow of
// the stored contact. A family the record omitted is nulled (like a P39-03
// exclusion) so it never reads as a remote change.
export const mappedContactToPortableContact = (
  m: MappedContact,
): PortableContactInput => {
  const omitted = new Set(m.omittedFamilies ?? []);
  const emailEntries = normalizeValueEntries(m.emailEntries);
  const phoneEntries = normalizeValueEntries(m.phoneEntries);
  const addressEntries = normalizeAddressEntries(m.addressEntries);
  const websiteEntries = normalizeValueEntries(m.websiteEntries);
  return {
    fullName: m.fullName,
    firstName: m.firstName,
    middleName: m.middleName,
    lastName: m.lastName,
    namePrefix: m.namePrefix,
    nameSuffix: m.nameSuffix,
    nickname: m.nickname,
    ...(omitted.has("emails")
      ? { email: null, emailAddresses: null, emailEntries: null }
      : { ...deriveLegacyEmails(emailEntries), emailEntries }),
    ...(omitted.has("phones")
      ? { phone: null, phoneNumbers: null, phoneEntries: null }
      : { ...deriveLegacyPhones(phoneEntries), phoneEntries }),
    company: m.company,
    department: m.department,
    jobTitle: m.jobTitle,
    ...(omitted.has("websites")
      ? { website: null, websiteEntries: null }
      : { ...deriveLegacyWebsites(websiteEntries), websiteEntries }),
    birthday: m.birthday,
    ...(omitted.has("addresses")
      ? { address: null, postalAddresses: null, addressEntries: null }
      : { ...deriveLegacyAddresses(addressEntries), addressEntries }),
    notes: m.notes,
    customFields:
      m.customFields.length > 0
        ? Object.fromEntries(m.customFields.map((field) => [field.label, field.value]))
        : null,
  };
};
