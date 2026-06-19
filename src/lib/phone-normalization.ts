export type PhoneValidationStatus = "valid" | "possible" | "invalid";
export type PhoneEntrySource = "user" | "import" | "sync";

export type StoredPhoneEntry = {
  label: string;
  value: string;
  isPrimary: boolean;
  rawInput?: string;
  e164?: string | null;
  national?: string | null;
  countryCode?: string | null;
  callingCode?: string | null;
  extension?: string | null;
  displayInternational?: string | null;
  displayNational?: string | null;
  validationStatus?: PhoneValidationStatus;
  source?: PhoneEntrySource;
};

type NormalizedPhoneCandidate = {
  rawInput: string;
  value: string;
  normalizedDigits: string;
  exactKey: string;
  looseKey: string;
  e164: string | null;
  national: string | null;
  countryCode: string | null;
  callingCode: string | null;
  extension: string | null;
  displayInternational: string | null;
  displayNational: string | null;
  validationStatus: PhoneValidationStatus;
};

const tidyPhoneInput = (value: string | null | undefined) => value?.trim() ?? "";

const extractExtension = (value: string) => {
  const match = value.match(/(?:ext\.?|extension|x|#)\s*(\d+)\s*$/i);
  if (!match) {
    return { base: value, extension: null as string | null };
  }
  return {
    base: value.slice(0, match.index).trim(),
    extension: match[1] ?? null,
  };
};

const normalizeInternationalPrefix = (value: string) => {
  if (value.startsWith("+")) {
    return `+${value.slice(1).replace(/\D/g, "")}`;
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("00")) {
    return `+${digits.replace(/^00+/, "")}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return digits;
};

const formatNanp = (national: string) =>
  national.length === 10
    ? {
        international: `+1 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`,
        national: `(${national.slice(0, 3)}) ${national.slice(3, 6)} ${national.slice(6)}`,
      }
    : {
        international: `+1 ${national}`,
        national,
      };

const formatUk = (national: string) =>
  national.length === 10
    ? {
        international: `+44 ${national.slice(0, 4)} ${national.slice(4)}`,
        national: `0${national.slice(0, 4)} ${national.slice(4)}`,
      }
    : {
        international: `+44 ${national}`,
        national: `0${national}`,
      };

const deriveKnownRegion = (digits: string) => {
  if (digits.startsWith("1") && digits.length === 11) {
    return {
      countryCode: "US",
      callingCode: "1",
      national: digits.slice(1),
      validationStatus: "valid" as const,
    };
  }

  if (digits.startsWith("44") && digits.length >= 12 && digits.length <= 13) {
    return {
      countryCode: "GB",
      callingCode: "44",
      national: digits.slice(2),
      validationStatus: "valid" as const,
    };
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return {
      countryCode: null,
      callingCode: null,
      national: null,
      validationStatus: "possible" as const,
    };
  }

  return {
    countryCode: null,
    callingCode: null,
    national: null,
    validationStatus: "invalid" as const,
  };
};

export const normalizePhoneCandidate = (
  value: string | null | undefined,
): NormalizedPhoneCandidate => {
  const rawInput = tidyPhoneInput(value);
  if (!rawInput) {
    return {
      rawInput: "",
      value: "",
      normalizedDigits: "",
      exactKey: "",
      looseKey: "",
      e164: null,
      national: null,
      countryCode: null,
      callingCode: null,
      extension: null,
      displayInternational: null,
      displayNational: null,
      validationStatus: "invalid",
    };
  }

  const { base, extension } = extractExtension(rawInput);
  const canonicalSeed = normalizeInternationalPrefix(base);
  const hasPlus = canonicalSeed.startsWith("+");
  const digits = canonicalSeed.replace(/\D/g, "");
  const known = deriveKnownRegion(digits);
  const e164 = hasPlus && digits ? `+${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;

  let displayInternational = e164;
  let displayNational = known.national;

  if (known.countryCode === "US" && known.national) {
    const formatted = formatNanp(known.national);
    displayInternational = formatted.international;
    displayNational = formatted.national;
  } else if (known.countryCode === "GB" && known.national) {
    const formatted = formatUk(known.national);
    displayInternational = formatted.international;
    displayNational = formatted.national;
  }

  const fallbackValue = hasPlus ? `+${digits}` : digits || rawInput;
  const valueForStorage = displayInternational ?? fallbackValue;

  return {
    rawInput,
    value: valueForStorage,
    normalizedDigits: digits,
    exactKey: e164 ?? "",
    looseKey: digits.length >= 7 ? digits.slice(-10) : "",
    e164,
    national: known.national,
    countryCode: known.countryCode,
    callingCode: known.callingCode,
    extension,
    displayInternational,
    displayNational,
    validationStatus: known.validationStatus,
  };
};

const phoneLabelScore = (label: string) => {
  switch (label.trim().toLowerCase()) {
    case "mobile":
    case "iphone":
      return 6;
    case "main":
      return 5;
    case "work":
    case "work mobile":
      return 4;
    case "home":
      return 3;
    default:
      return 1;
  }
};

const phoneSourceScore = (source: PhoneEntrySource | undefined) => {
  switch (source) {
    case "user":
      return 3;
    case "sync":
      return 2;
    case "import":
      return 1;
    default:
      return 0;
  }
};

const phoneValueScore = (candidate: NormalizedPhoneCandidate) => {
  let score = 0;
  if (candidate.validationStatus === "valid") score += 100;
  else if (candidate.validationStatus === "possible") score += 60;

  if (candidate.e164) score += 30;
  if (candidate.value.startsWith("+")) score += 10;
  if (candidate.extension) score += 5;

  return score;
};

const candidatesRepresentSamePhone = (
  left: NormalizedPhoneCandidate,
  right: NormalizedPhoneCandidate,
) => {
  if (left.exactKey && right.exactKey) {
    return left.exactKey === right.exactKey;
  }

  if (left.exactKey && right.looseKey) {
    return left.looseKey !== "" && left.looseKey === right.looseKey;
  }

  if (right.exactKey && left.looseKey) {
    return right.looseKey !== "" && left.looseKey === right.looseKey;
  }

  return left.looseKey !== "" && left.looseKey === right.looseKey;
};

export const choosePreferredPhoneChoice = ({
  primaryValue,
  secondaryValue,
}: {
  primaryValue: string | null | undefined;
  secondaryValue: string | null | undefined;
}): "primary" | "secondary" => {
  const primary = normalizePhoneCandidate(primaryValue);
  const secondary = normalizePhoneCandidate(secondaryValue);

  if (!primary.rawInput && secondary.rawInput) {
    return "secondary";
  }

  if (!secondary.rawInput) {
    return "primary";
  }

  if (!candidatesRepresentSamePhone(primary, secondary)) {
    return "primary";
  }

  return phoneValueScore(secondary) > phoneValueScore(primary) ? "secondary" : "primary";
};

type EntrySeed = {
  label: string;
  value: string;
  isPrimary: boolean;
  source: PhoneEntrySource;
};

type Bucket = {
  best: StoredPhoneEntry;
  candidate: NormalizedPhoneCandidate;
  index: number;
};

const chooseBetterEntry = (
  current: Bucket,
  candidate: StoredPhoneEntry,
  candidateMeta: NormalizedPhoneCandidate,
): Bucket => {
  const currentScore =
    phoneValueScore(current.candidate) +
    (current.best.isPrimary ? 12 : 0) +
    phoneLabelScore(current.best.label) +
    phoneSourceScore(current.best.source);
  const nextScore =
    phoneValueScore(candidateMeta) +
    (candidate.isPrimary ? 12 : 0) +
    phoneLabelScore(candidate.label) +
    phoneSourceScore(candidate.source);

  if (nextScore > currentScore) {
    return {
      best: {
        ...candidate,
        isPrimary: current.best.isPrimary || candidate.isPrimary,
      },
      candidate: candidateMeta,
      index: current.index,
    };
  }

  return {
    ...current,
    best: {
      ...current.best,
      isPrimary: current.best.isPrimary || candidate.isPrimary,
    },
  };
};

export const buildNormalizedPhoneEntries = ({
  primaryValue,
  primaryLabel,
  secondaryValues,
  secondaryLabel,
  defaultLabel,
  source,
}: {
  primaryValue: string | null | undefined;
  primaryLabel: string | null | undefined;
  secondaryValues: Array<string | null | undefined>;
  secondaryLabel: string | null | undefined;
  defaultLabel: string;
  source: PhoneEntrySource;
}) => {
  const seeds: EntrySeed[] = [];

  if (tidyPhoneInput(primaryValue)) {
    seeds.push({
      label: tidyPhoneInput(primaryLabel) || defaultLabel,
      value: tidyPhoneInput(primaryValue),
      isPrimary: true,
      source,
    });
  }

  for (const value of secondaryValues) {
    const raw = tidyPhoneInput(value);
    if (!raw) continue;
    seeds.push({
      label: tidyPhoneInput(secondaryLabel) || defaultLabel,
      value: raw,
      isPrimary: false,
      source,
    });
  }

  const buckets: Bucket[] = [];

  seeds.forEach((seed, index) => {
    const candidate = normalizePhoneCandidate(seed.value);
    if (!candidate.rawInput) {
      return;
    }

    const entry: StoredPhoneEntry = {
      label: seed.label,
      value: candidate.value,
      isPrimary: seed.isPrimary,
      rawInput: candidate.rawInput,
      e164: candidate.e164,
      national: candidate.national,
      countryCode: candidate.countryCode,
      callingCode: candidate.callingCode,
      extension: candidate.extension,
      displayInternational: candidate.displayInternational,
      displayNational: candidate.displayNational,
      validationStatus: candidate.validationStatus,
      source: seed.source,
    };

    const existingIndex = buckets.findIndex((bucket) =>
      candidatesRepresentSamePhone(bucket.candidate, candidate),
    );

    if (existingIndex === -1) {
      buckets.push({ best: entry, candidate, index });
      return;
    }

    buckets[existingIndex] = chooseBetterEntry(buckets[existingIndex]!, entry, candidate);
  });

  const entries = buckets
    .sort((left, right) => left.index - right.index)
    .map((bucket, index) => ({
      ...bucket.best,
      isPrimary: index === 0 || bucket.best.isPrimary,
    }));

  return {
    phone: entries[0]?.value ?? undefined,
    phoneNumbers: entries.map((entry) => entry.e164 ?? entry.value),
    phoneEntries: entries,
  };
};

export const mergePhoneValues = (...groups: Array<Array<string | null | undefined>>) =>
  buildNormalizedPhoneEntries({
    primaryValue: groups.flat().find((value) => tidyPhoneInput(value)),
    primaryLabel: "Primary",
    secondaryValues: groups.flat().slice(1),
    secondaryLabel: "Other",
    defaultLabel: "Other",
    source: "sync",
  }).phoneNumbers;

export const mergePhoneEntries = (
  primaryEntries: Array<{ label: string; value: string; isPrimary?: boolean }>,
  secondaryEntries: Array<{ label: string; value: string; isPrimary?: boolean }>,
) =>
  buildNormalizedPhoneEntries({
    primaryValue: primaryEntries[0]?.value,
    primaryLabel: primaryEntries[0]?.label,
    secondaryValues: [
      ...primaryEntries.slice(1).map((entry) => entry.value),
      ...secondaryEntries.map((entry) => entry.value),
    ],
    secondaryLabel: secondaryEntries[0]?.label ?? primaryEntries[1]?.label,
    defaultLabel: "Other",
    source: "sync",
  }).phoneEntries;

export const normalizePhoneExactKey = (value: string | null | undefined) =>
  normalizePhoneCandidate(value).exactKey;

export const normalizePhoneLooseKey = (value: string | null | undefined) =>
  normalizePhoneCandidate(value).looseKey;
