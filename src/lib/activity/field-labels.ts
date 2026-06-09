// Contact field name → human-readable label for activity diffs (P10-04).
const FIELD_LABELS: Record<string, string> = {
  fullName: "Full name",
  firstName: "First name",
  middleName: "Middle name",
  lastName: "Last name",
  namePrefix: "Name prefix",
  nameSuffix: "Name suffix",
  phoneticFirstName: "Phonetic first name",
  phoneticLastName: "Phonetic last name",
  phoneticCompany: "Phonetic company",
  nickname: "Nickname",
  email: "Email",
  emailAddresses: "Email addresses",
  emailEntries: "Email addresses",
  phone: "Phone",
  phoneNumbers: "Phone numbers",
  phoneEntries: "Phone numbers",
  company: "Company",
  jobTitle: "Job title",
  website: "Website",
  websiteEntries: "Websites",
  birthday: "Birthday",
  address: "Address",
  postalAddresses: "Addresses",
  addressEntries: "Addresses",
  avatarUrl: "Photo",
  isFavorite: "Favourite",
  labels: "Labels",
  significantDates: "Significant dates",
  relatedPeople: "Related people",
  customFields: "Custom fields",
  notes: "Notes",
};

export function formatFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}
