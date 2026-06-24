// Canonical mapped-contact shape shared by every sync connector's field mapper
// (Google P27-02, Microsoft P27-05). Maps to the same Contact write fields the
// CardDAV importer sets, so contacts look identical regardless of source.
import type { PortableContactInput } from "~/server/contact-portability";

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
};

// MappedContact → Prisma contact write data (mirrors the CardDAV create path).
// Json fields are omitted (undefined) when empty so we never write empty arrays.
export const mappedContactToWriteData = (m: MappedContact) => ({
  fullName: m.fullName,
  firstName: m.firstName,
  middleName: m.middleName,
  lastName: m.lastName,
  namePrefix: m.namePrefix,
  nameSuffix: m.nameSuffix,
  nickname: m.nickname,
  email: m.emailAddresses[0] ?? null,
  emailAddresses: m.emailAddresses.length > 0 ? m.emailAddresses : undefined,
  emailEntries: m.emailEntries.length > 0 ? m.emailEntries : undefined,
  phone: m.phoneNumbers[0] ?? null,
  phoneNumbers: m.phoneNumbers.length > 0 ? m.phoneNumbers : undefined,
  phoneEntries: m.phoneEntries.length > 0 ? m.phoneEntries : undefined,
  company: m.company,
  jobTitle: m.jobTitle,
  department: m.department,
  website: m.website,
  websiteEntries: m.websiteEntries.length > 0 ? m.websiteEntries : undefined,
  birthday: m.birthday,
  address: m.address,
  postalAddresses: m.postalAddresses.length > 0 ? m.postalAddresses : undefined,
  addressEntries: m.addressEntries.length > 0 ? m.addressEntries : undefined,
  notes: m.notes,
  relatedPeople: m.relatedPeople.length > 0 ? m.relatedPeople : undefined,
  customFields: m.customFields.length > 0 ? m.customFields : undefined,
});

export const mappedContactToPortableContact = (
  m: MappedContact,
): PortableContactInput => ({
  fullName: m.fullName,
  firstName: m.firstName,
  middleName: m.middleName,
  lastName: m.lastName,
  namePrefix: m.namePrefix,
  nameSuffix: m.nameSuffix,
  nickname: m.nickname,
  email: m.emailAddresses[0] ?? null,
  emailAddresses: m.emailAddresses,
  emailEntries: m.emailEntries,
  phone: m.phoneNumbers[0] ?? null,
  phoneNumbers: m.phoneNumbers,
  phoneEntries: m.phoneEntries,
  company: m.company,
  department: m.department,
  jobTitle: m.jobTitle,
  website: m.website,
  websiteEntries: m.websiteEntries,
  birthday: m.birthday,
  address: m.address,
  postalAddresses: m.postalAddresses,
  addressEntries: m.addressEntries,
  notes: m.notes,
  customFields:
    m.customFields.length > 0
      ? Object.fromEntries(m.customFields.map((field) => [field.label, field.value]))
      : null,
});
