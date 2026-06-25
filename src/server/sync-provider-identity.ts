export type ProviderVerificationState =
  | "VERIFIED"
  | "DETECTED_UNVERIFIED"
  | "GENERIC";

export type SyncProviderBrandKey =
  | "icloud"
  | "fastmail"
  | "nextcloud"
  | "clickup"
  | "google"
  | "microsoft";

export type SyncProviderIdentity = {
  provider: "CARDDAV" | "GOOGLE" | "MICROSOFT";
  accountLabel: string | null;
  providerDisplayName: string | null;
  providerHost: string | null;
  providerVerificationState: ProviderVerificationState;
  providerBrandKey: SyncProviderBrandKey | null;
  providerKey: string | null;
  detectionSource: string | null;
};

type CardDavProviderRegistryEntry = {
  id: string;
  displayName: string;
  brandKey: Exclude<SyncProviderBrandKey, "google" | "microsoft">;
  verificationState: Exclude<ProviderVerificationState, "GENERIC">;
  exactHosts?: string[];
  suffixes?: string[];
  hostTokens?: string[];
};

const CARDDAV_PROVIDER_REGISTRY: CardDavProviderRegistryEntry[] = [
  {
    id: "icloud",
    displayName: "iCloud",
    brandKey: "icloud",
    verificationState: "VERIFIED",
    exactHosts: ["contacts.icloud.com"],
  },
  {
    id: "fastmail",
    displayName: "Fastmail",
    brandKey: "fastmail",
    verificationState: "VERIFIED",
    exactHosts: ["carddav.fastmail.com"],
  },
  {
    id: "clickup",
    displayName: "ClickUp",
    brandKey: "clickup",
    verificationState: "DETECTED_UNVERIFIED",
    suffixes: ["clickup.com"],
  },
  {
    id: "nextcloud",
    displayName: "Nextcloud",
    brandKey: "nextcloud",
    verificationState: "DETECTED_UNVERIFIED",
    hostTokens: ["nextcloud"],
  },
];

const normalizeAccountLabel = (label: string | null | undefined) => {
  const trimmed = label?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

const normalizeProviderHostFromUrl = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase().replace(/\.+$/, "") || null;
  } catch {
    return null;
  }
};

const resolveCardDavProviderRegistryEntry = (host: string | null) => {
  if (!host) {
    return null;
  }

  for (const entry of CARDDAV_PROVIDER_REGISTRY) {
    if (entry.exactHosts?.includes(host)) {
      return { entry, detectionSource: `exact:${host}` };
    }
  }

  for (const entry of CARDDAV_PROVIDER_REGISTRY) {
    const matchedSuffix = entry.suffixes?.find(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
    if (matchedSuffix) {
      return { entry, detectionSource: `suffix:${matchedSuffix}` };
    }
  }

  const hostTokens = host.split(/[^a-z0-9]+/).filter(Boolean);
  for (const entry of CARDDAV_PROVIDER_REGISTRY) {
    const matchedToken = entry.hostTokens?.find((token) => hostTokens.includes(token));
    if (matchedToken) {
      return { entry, detectionSource: `token:${matchedToken}` };
    }
  }

  return null;
};

export const resolveCardDavProviderIdentity = ({
  label,
  baseUrl,
  addressBookUrl,
}: {
  label?: string | null;
  baseUrl?: string | null;
  addressBookUrl?: string | null;
}): SyncProviderIdentity => {
  const providerHost =
    normalizeProviderHostFromUrl(addressBookUrl) ??
    normalizeProviderHostFromUrl(baseUrl);
  const matched = resolveCardDavProviderRegistryEntry(providerHost);

  return {
    provider: "CARDDAV",
    accountLabel: normalizeAccountLabel(label),
    providerDisplayName: matched?.entry.displayName ?? null,
    providerHost,
    providerVerificationState:
      matched?.entry.verificationState ?? "GENERIC",
    providerBrandKey: matched?.entry.brandKey ?? null,
    providerKey: matched?.entry.id ?? null,
    detectionSource: matched?.detectionSource ?? null,
  };
};

export const resolveSyncProviderIdentity = ({
  provider,
  label,
  baseUrl,
  addressBookUrl,
}: {
  provider?: "CARDDAV" | "GOOGLE" | "MICROSOFT" | null;
  label?: string | null;
  baseUrl?: string | null;
  addressBookUrl?: string | null;
}): SyncProviderIdentity => {
  if (provider === "GOOGLE") {
    return {
      provider: "GOOGLE",
      accountLabel: normalizeAccountLabel(label),
      providerDisplayName: "Google Contacts",
      providerHost: null,
      providerVerificationState: "VERIFIED",
      providerBrandKey: "google",
      providerKey: "google",
      detectionSource: "native:google",
    };
  }

  if (provider === "MICROSOFT") {
    return {
      provider: "MICROSOFT",
      accountLabel: normalizeAccountLabel(label),
      providerDisplayName: "Outlook",
      providerHost: null,
      providerVerificationState: "VERIFIED",
      providerBrandKey: "microsoft",
      providerKey: "microsoft",
      detectionSource: "native:microsoft",
    };
  }

  return resolveCardDavProviderIdentity({ label, baseUrl, addressBookUrl });
};

export const formatProviderIdentitySecondaryText = (
  identity: SyncProviderIdentity,
) => {
  if (identity.provider !== "CARDDAV") {
    return identity.providerDisplayName ?? "Connected provider";
  }

  switch (identity.providerVerificationState) {
    case "VERIFIED":
      return identity.providerDisplayName
        ? `Verified provider: ${identity.providerDisplayName}`
        : identity.providerHost ?? "Verified CardDAV provider";
    case "DETECTED_UNVERIFIED":
      return identity.providerHost
        ? `Detected from ${identity.providerHost}`
        : identity.providerDisplayName ?? "Detected provider";
    case "GENERIC":
    default:
      return identity.providerHost ?? "Generic CardDAV connection";
  }
};
