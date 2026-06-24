import type {
  ContactAddressEntryInput,
  ContactDateEntryInput,
  ContactValueEntryInput,
  PortableContactInput,
} from "~/server/contact-portability";

export type SyncProviderCapabilityProfileId =
  | "carddav-generic"
  | "carddav-icloud"
  | "carddav-fastmail"
  | "google"
  | "microsoft";

export type SyncProviderCapabilityProfile = {
  id: SyncProviderCapabilityProfileId;
  provider: "CARDDAV" | "GOOGLE" | "MICROSOFT";
  variant?: "generic" | "icloud" | "fastmail";
  fields: {
    birthday: "full";
    significantDates: "full" | "none";
  };
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
  id: "carddav-generic",
  provider: "CARDDAV",
  variant: "generic",
  fields: {
    birthday: "full",
    significantDates: "full",
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

const getHostnames = (value: string | null | undefined): string[] => {
  if (!value) {
    return [];
  }

  try {
    return [new URL(value).hostname.toLowerCase()];
  } catch {
    return [];
  }
};

const includesAny = (value: string | null | undefined, needles: string[]) => {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized && needles.some((needle) => normalized.includes(needle)));
};

const resolveCardDavProfile = ({
  baseUrl,
  addressBookUrl,
  label,
}: Pick<SyncProviderCapabilityInput, "baseUrl" | "addressBookUrl" | "label">): SyncProviderCapabilityProfile => {
  const hosts = [...getHostnames(baseUrl), ...getHostnames(addressBookUrl)];

  if (
    hosts.some((host) => host.includes("icloud.com")) ||
    includesAny(label, ["icloud"])
  ) {
    return ICLOUD_CARDDAV_PROFILE;
  }

  if (
    hosts.some((host) => host.includes("fastmail.com")) ||
    includesAny(label, ["fastmail"])
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

export const providerSupportsSignificantDates = (
  profile: SyncProviderCapabilityProfile,
) => profile.fields.significantDates === "full";

const normalizeSignificantDates = (
  significantDates: ContactDateEntryInput[] | null | undefined,
) => {
  if (!significantDates || significantDates.length === 0) {
    return undefined;
  }
  return significantDates;
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
