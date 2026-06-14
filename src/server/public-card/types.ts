export interface PublicCardFieldConfig {
  hidden?: boolean;
  showEmail?: boolean;
  showPhone?: boolean;
  showCompany?: boolean;
  showJobTitle?: boolean;
  showWebsite?: boolean;
  showLinkedIn?: boolean;
  showTwitter?: boolean;
}

const CARD_FIELD_DEFAULTS: Required<Omit<PublicCardFieldConfig, "hidden">> = {
  showEmail: true,
  showPhone: false,
  showCompany: true,
  showJobTitle: true,
  showWebsite: false,
  showLinkedIn: false,
  showTwitter: false,
};

export function resolveCardFields(
  stored: PublicCardFieldConfig | null | undefined,
): Required<PublicCardFieldConfig> {
  return { ...CARD_FIELD_DEFAULTS, hidden: false, ...stored };
}

export interface PublicCardData {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  company: string | null;
  visibleFields: Required<PublicCardFieldConfig>;
  emails: string[];
  phones: string[];
  websites: string[];
}
