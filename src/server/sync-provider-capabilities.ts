import type {
  ContactAddressEntryInput,
  ContactDateEntryInput,
  ContactValueEntryInput,
  PortableContactInput,
} from "./contact-portability";
import { resolveCardDavProviderIdentity } from "./sync-provider-identity";

export type SyncProviderCapabilityProfileId =
  | "carddav-generic"
  | "carddav-generic-safe"
  | "carddav-icloud"
  | "carddav-fastmail"
  | "google"
  | "microsoft";

export type CardDavCapabilityProfileOverrideId =
  | "carddav-generic-safe"
  | "carddav-icloud"
  | "carddav-fastmail";

export const CARD_DAV_CAPABILITY_OVERRIDE_IDS = [
  "carddav-generic-safe",
  "carddav-icloud",
  "carddav-fastmail",
] as const satisfies readonly CardDavCapabilityProfileOverrideId[];

export type SyncProviderCapabilityProfile = {
  id: SyncProviderCapabilityProfileId;
  provider: "CARDDAV" | "GOOGLE" | "MICROSOFT";
  variant?: "generic" | "icloud" | "fastmail";
  fields: {
    birthday: "full";
    significantDates: "full" | "none";
  };
};

export type ProviderCapabilityUnsupportedFieldFamily = "significantDates";

export type ProviderCapabilityDiagnostics = {
  unsupportedFieldFamilies: ProviderCapabilityUnsupportedFieldFamily[];
  unsupportedFieldCount: number;
};

export type ProviderCapabilityNotice = {
  title: string;
  body: string;
  unsupportedFieldFamilies: ProviderCapabilityUnsupportedFieldFamily[];
};

export type ProviderFieldFamilyKey =
  | "names"
  | "phones"
  | "emails"
  | "addresses"
  | "websites"
  | "notes"
  | "birthday"
  | "significantDates";

export type ProviderFieldFamilySupport = "two_way" | "local_only";

export type ProviderFieldFamilyDescriptor = {
  key: ProviderFieldFamilyKey;
  label: string;
  support: ProviderFieldFamilySupport;
  detail: string;
};

export type ProviderSupportedContactShadow = {
  fullName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  namePrefix: string | null;
  nameSuffix: string | null;
  nickname: string | null;
  email: string | null;
  emailAddresses: string[];
  emailEntries: Array<{ label: string; value: string; isPrimary: boolean }>;
  phone: string | null;
  phoneNumbers: string[];
  phoneEntries: Array<{ label: string; value: string; isPrimary: boolean }>;
  company: string | null;
  department: string | null;
  jobTitle: string | null;
  website: string | null;
  websiteEntries: Array<{ label: string; value: string; isPrimary: boolean }>;
  birthday: string | null;
  significantDates?: Array<{ label: string; date: string; isPrimary: boolean }>;
  address: string | null;
  postalAddresses: Array<{ label: string; formatted: string }>;
  addressEntries: Array<{
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
  }>;
  notes: string | null;
};

type SyncProviderCapabilityInput = {
  provider?: "CARDDAV" | "GOOGLE" | "MICROSOFT" | null;
  baseUrl?: string | null;
  addressBookUrl?: string | null;
  label?: string | null;
  capabilityProfileOverride?: string | null;
};

const GOOGLE_PROFILE: SyncProviderCapabilityProfile = {
  id: "google",
  provider: "GOOGLE",
  fields: {
    birthday: "full",
    significantDates: "none",
  },
};

const MICROSOFT_PROFILE: SyncProviderCapabilityProfile = {
  id: "microsoft",
  provider: "MICROSOFT",
  fields: {
    birthday: "full",
    significantDates: "none",
  },
};

const GENERIC_CARDDAV_PROFILE: SyncProviderCapabilityProfile = {
  id: "carddav-generic-safe",
  provider: "CARDDAV",
  variant: "generic",
  fields: {
    birthday: "full",
    significantDates: "none",
  },
};

const ICLOUD_CARDDAV_PROFILE: SyncProviderCapabilityProfile = {
  id: "carddav-icloud",
  provider: "CARDDAV",
  variant: "icloud",
  fields: {
    birthday: "full",
    significantDates: "full",
  },
};

const FASTMAIL_CARDDAV_PROFILE: SyncProviderCapabilityProfile = {
  id: "carddav-fastmail",
  provider: "CARDDAV",
  variant: "fastmail",
  fields: {
    birthday: "full",
    significantDates: "none",
  },
};

const normalizeCardDavCapabilityProfileId = (
  id: string | null | undefined,
): CardDavCapabilityProfileOverrideId | null => {
  if (!id) {
    return null;
  }

  switch (id) {
    case "carddav-generic":
    case "carddav-generic-safe":
      return "carddav-generic-safe";
    case "carddav-icloud":
    case "carddav-fastmail":
      return id;
    default:
      return null;
  }
};

export const coerceCardDavCapabilityProfileOverrideId = (
  id: string | null | undefined,
): CardDavCapabilityProfileOverrideId | null =>
  normalizeCardDavCapabilityProfileId(id);

const resolveCardDavProfile = ({
  baseUrl,
  addressBookUrl,
  label,
  capabilityProfileOverride,
}: Pick<
  SyncProviderCapabilityInput,
  "baseUrl" | "addressBookUrl" | "label" | "capabilityProfileOverride"
>): SyncProviderCapabilityProfile => {
  const overrideId = normalizeCardDavCapabilityProfileId(capabilityProfileOverride);
  if (overrideId === "carddav-icloud") {
    return ICLOUD_CARDDAV_PROFILE;
  }

  if (overrideId === "carddav-fastmail") {
    return FASTMAIL_CARDDAV_PROFILE;
  }

  if (overrideId === "carddav-generic-safe") {
    return GENERIC_CARDDAV_PROFILE;
  }

  const identity = resolveCardDavProviderIdentity({
    label,
    baseUrl,
    addressBookUrl,
  });

  if (
    identity.providerVerificationState === "VERIFIED" &&
    identity.providerBrandKey === "icloud"
  ) {
    return ICLOUD_CARDDAV_PROFILE;
  }

  if (
    identity.providerVerificationState === "VERIFIED" &&
    identity.providerBrandKey === "fastmail"
  ) {
    return FASTMAIL_CARDDAV_PROFILE;
  }

  return GENERIC_CARDDAV_PROFILE;
};

export const resolveSyncProviderCapabilityProfile = (
  input: SyncProviderCapabilityInput,
): SyncProviderCapabilityProfile => {
  if (input.provider === "GOOGLE") {
    return GOOGLE_PROFILE;
  }

  if (input.provider === "MICROSOFT") {
    return MICROSOFT_PROFILE;
  }

  return resolveCardDavProfile(input);
};

export const getSyncProviderCapabilityProfileLabel = (
  profile: SyncProviderCapabilityProfile,
) => {
  switch (normalizeCardDavCapabilityProfileId(profile.id)) {
    case "carddav-generic-safe":
      return "Generic safe";
    case "carddav-icloud":
      return "Verified iCloud";
    case "carddav-fastmail":
      return "Verified Fastmail";
    default:
      switch (profile.id) {
        case "google":
          return "Google Contacts";
        case "microsoft":
          return "Outlook";
        default:
          return "Provider default";
      }
  }
};

export const isGenericSafeCardDavProfile = (
  profile: SyncProviderCapabilityProfile,
) => normalizeCardDavCapabilityProfileId(profile.id) === "carddav-generic-safe";

export const providerSupportsSignificantDates = (
  profile: SyncProviderCapabilityProfile,
) => profile.fields.significantDates === "full";

export const getSyncProviderCapabilityProfileDisplayName = (
  profile: SyncProviderCapabilityProfile,
) => {
  switch (profile.id) {
    case "carddav-generic":
    case "carddav-generic-safe":
      return "this CardDAV provider";
    case "carddav-icloud":
      return "iCloud";
    case "carddav-fastmail":
      return "Fastmail";
    case "google":
      return "Google Contacts";
    case "microsoft":
      return "Outlook";
    default:
      return "this provider";
  }
};

export const formatProviderCapabilityFamilies = (
  families: ProviderCapabilityUnsupportedFieldFamily[],
) => {
  const unique = [...new Set(families)];

  if (unique.length === 0) {
    return "unsupported fields";
  }

  const labels = unique.map((family) => {
    switch (family) {
      case "significantDates":
        return "significant dates";
      default:
        return "unsupported fields";
    }
  });

  if (labels.length === 1) {
    return labels[0]!;
  }

  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
};

const normalizeSignificantDates = (
  significantDates: ContactDateEntryInput[] | null | undefined,
) => {
  if (!significantDates || significantDates.length === 0) {
    return undefined;
  }
  return significantDates;
};

const countUnsupportedSignificantDates = (
  significantDates: ContactDateEntryInput[] | null | undefined,
) => normalizeSignificantDatesForShadow(significantDates).length;

export const buildProviderCapabilityDiagnostics = (
  contact: PortableContactInput,
  profile: SyncProviderCapabilityProfile,
): ProviderCapabilityDiagnostics | null => {
  const unsupportedFieldFamilies: ProviderCapabilityUnsupportedFieldFamily[] = [];
  let unsupportedFieldCount = 0;

  if (!providerSupportsSignificantDates(profile)) {
    const significantDateCount = countUnsupportedSignificantDates(
      contact.significantDates,
    );
    if (significantDateCount > 0) {
      unsupportedFieldFamilies.push("significantDates");
      unsupportedFieldCount += significantDateCount;
    }
  }

  if (unsupportedFieldCount === 0) {
    return null;
  }

  return {
    unsupportedFieldFamilies,
    unsupportedFieldCount,
  };
};

export const getProviderCapabilityNotice = (
  profile: SyncProviderCapabilityProfile,
): ProviderCapabilityNotice | null => {
  const unsupportedFieldFamilies: ProviderCapabilityUnsupportedFieldFamily[] = [];

  if (!providerSupportsSignificantDates(profile)) {
    unsupportedFieldFamilies.push("significantDates");
  }

  if (unsupportedFieldFamilies.length === 0) {
    return null;
  }

  if (isGenericSafeCardDavProfile(profile)) {
    return {
      title: "Safe compatibility mode is on",
      body: "Kontax has not verified every field for this CardDAV provider yet. Significant dates stay in Kontax until this connection is explicitly verified or overridden.",
      unsupportedFieldFamilies,
    };
  }

  const providerName = getSyncProviderCapabilityProfileDisplayName(profile);
  const familyLabel = formatProviderCapabilityFamilies(unsupportedFieldFamilies);

  return {
    title: "Some fields stay in Kontax",
    body: `Some providers do not support every contact field. ${providerName} does not currently store ${familyLabel}, so those values stay in Kontax and in providers that support them.`,
    unsupportedFieldFamilies,
  };
};

export const describeProviderFieldFamilies = (
  profile: SyncProviderCapabilityProfile,
): ProviderFieldFamilyDescriptor[] => {
  const providerName = getSyncProviderCapabilityProfileDisplayName(profile);
  const significantDatesSupported = providerSupportsSignificantDates(profile);

  return [
    {
      key: "names",
      label: "Names",
      support: "two_way",
      detail: `Names sync between Kontax and ${providerName}.`,
    },
    {
      key: "phones",
      label: "Phones",
      support: "two_way",
      detail: `Phone numbers sync between Kontax and ${providerName}.`,
    },
    {
      key: "emails",
      label: "Emails",
      support: "two_way",
      detail: `Email addresses sync between Kontax and ${providerName}.`,
    },
    {
      key: "addresses",
      label: "Addresses",
      support: "two_way",
      detail: `Postal addresses sync between Kontax and ${providerName}.`,
    },
    {
      key: "websites",
      label: "Websites",
      support: "two_way",
      detail: `Websites sync between Kontax and ${providerName}.`,
    },
    {
      key: "notes",
      label: "Notes",
      support: "two_way",
      detail: `Notes sync between Kontax and ${providerName}.`,
    },
    {
      key: "birthday",
      label: "Birthday",
      support: "two_way",
      detail: `Birthday syncs between Kontax and ${providerName}.`,
    },
    {
      key: "significantDates",
      label: "Other significant dates",
      support: significantDatesSupported ? "two_way" : "local_only",
      detail: significantDatesSupported
        ? `Anniversaries, lunar birthdays, and custom dates sync with ${providerName}.`
        : `Anniversaries, lunar birthdays, and custom dates stay in Kontax because ${providerName} does not currently store them.`,
    },
  ];
};

export const projectPortableContactForProvider = (
  contact: PortableContactInput,
  profile: SyncProviderCapabilityProfile,
): PortableContactInput => {
  const projected: PortableContactInput = { ...contact };

  if (providerSupportsSignificantDates(profile)) {
    projected.significantDates = normalizeSignificantDates(contact.significantDates);
  } else {
    delete projected.significantDates;
  }

  return projected;
};

export const getCardDavVCardFlavor = (
  profile: SyncProviderCapabilityProfile,
): "generic" | "fastmail" => (profile.variant === "fastmail" ? "fastmail" : "generic");

const normalizeString = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const normalizeStringArray = (values: string[] | null | undefined) =>
  [...(values ?? [])]
    .map((value) => normalizeString(value))
    .filter((value): value is string => value != null)
    .sort((left, right) => left.localeCompare(right));

const normalizeValueEntries = (
  values: ContactValueEntryInput[] | null | undefined,
) =>
  [...(values ?? [])]
    .flatMap((entry) => {
      const value = normalizeString(entry.value);
      if (!value) {
        return [];
      }
      return [
        {
          label: normalizeString(entry.label) ?? "Other",
          value,
          isPrimary: entry.isPrimary === true,
        },
      ];
    })
    .sort((left, right) =>
      `${left.label}\u0000${left.value}\u0000${left.isPrimary ? 1 : 0}`.localeCompare(
        `${right.label}\u0000${right.value}\u0000${right.isPrimary ? 1 : 0}`,
      ),
    );

const normalizePostalAddresses = (
  values: PortableContactInput["postalAddresses"],
) =>
  [...(values ?? [])]
    .flatMap((entry) => {
      const formatted = normalizeString(entry.formatted);
      if (!formatted) {
        return [];
      }
      return [{ label: normalizeString(entry.label) ?? "Other", formatted }];
    })
    .sort((left, right) =>
      `${left.label}\u0000${left.formatted}`.localeCompare(
        `${right.label}\u0000${right.formatted}`,
      ),
    );

const normalizeAddressEntries = (
  values: ContactAddressEntryInput[] | null | undefined,
) =>
  [...(values ?? [])]
    .flatMap((entry) => {
      const formatted = normalizeString(entry.formatted);
      if (!formatted) {
        return [];
      }
      return [
        {
          label: normalizeString(entry.label) ?? "Other",
          formatted,
          isPrimary: entry.isPrimary === true,
          ...(normalizeString(entry.countryOrRegion)
            ? { countryOrRegion: normalizeString(entry.countryOrRegion)! }
            : {}),
          ...(normalizeString(entry.streetLine1)
            ? { streetLine1: normalizeString(entry.streetLine1)! }
            : {}),
          ...(normalizeString(entry.streetLine2)
            ? { streetLine2: normalizeString(entry.streetLine2)! }
            : {}),
          ...(normalizeString(entry.cityOrTown)
            ? { cityOrTown: normalizeString(entry.cityOrTown)! }
            : {}),
          ...(normalizeString(entry.stateOrProvince)
            ? { stateOrProvince: normalizeString(entry.stateOrProvince)! }
            : {}),
          ...(normalizeString(entry.postcode)
            ? { postcode: normalizeString(entry.postcode)! }
            : {}),
          ...(normalizeString(entry.poBox) ? { poBox: normalizeString(entry.poBox)! } : {}),
        },
      ];
    })
    .sort((left, right) =>
      `${left.label}\u0000${left.formatted}\u0000${left.isPrimary ? 1 : 0}`.localeCompare(
        `${right.label}\u0000${right.formatted}\u0000${right.isPrimary ? 1 : 0}`,
      ),
    );

const normalizeSignificantDatesForShadow = (
  values: ContactDateEntryInput[] | null | undefined,
) =>
  [...(values ?? [])]
    .flatMap((entry) => {
      const date = normalizeString(entry.date);
      if (!date) {
        return [];
      }
      return [
        {
          label: normalizeString(entry.label) ?? "Other",
          date,
          isPrimary: entry.isPrimary === true,
        },
      ];
    })
    .sort((left, right) =>
      `${left.label}\u0000${left.date}\u0000${left.isPrimary ? 1 : 0}`.localeCompare(
        `${right.label}\u0000${right.date}\u0000${right.isPrimary ? 1 : 0}`,
      ),
    );

export const buildProviderSupportedContactShadow = (
  contact: PortableContactInput,
  profile: SyncProviderCapabilityProfile,
): ProviderSupportedContactShadow => {
  const projected = projectPortableContactForProvider(contact, profile);

  const shadow: ProviderSupportedContactShadow = {
    fullName: normalizeString(projected.fullName) ?? "",
    firstName: normalizeString(projected.firstName),
    middleName: normalizeString(projected.middleName),
    lastName: normalizeString(projected.lastName),
    namePrefix: normalizeString(projected.namePrefix),
    nameSuffix: normalizeString(projected.nameSuffix),
    nickname: normalizeString(projected.nickname),
    email: normalizeString(projected.email),
    emailAddresses: normalizeStringArray(projected.emailAddresses),
    emailEntries: normalizeValueEntries(projected.emailEntries),
    phone: normalizeString(projected.phone),
    phoneNumbers: normalizeStringArray(projected.phoneNumbers),
    phoneEntries: normalizeValueEntries(projected.phoneEntries),
    company: normalizeString(projected.company),
    department: normalizeString(projected.department),
    jobTitle: normalizeString(projected.jobTitle),
    website: normalizeString(projected.website),
    websiteEntries: normalizeValueEntries(projected.websiteEntries),
    birthday: normalizeString(projected.birthday),
    address: normalizeString(projected.address),
    postalAddresses: normalizePostalAddresses(projected.postalAddresses),
    addressEntries: normalizeAddressEntries(projected.addressEntries),
    notes: normalizeString(projected.notes),
  };

  if (providerSupportsSignificantDates(profile)) {
    shadow.significantDates = normalizeSignificantDatesForShadow(
      projected.significantDates,
    );
  }

  return shadow;
};

export const providerSupportedShadowsEqual = (
  left: ProviderSupportedContactShadow | null | undefined,
  right: ProviderSupportedContactShadow | null | undefined,
) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
