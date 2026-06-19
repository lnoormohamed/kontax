import {
  findPhoneCountryRuleByCallingCode,
  findPhoneCountryRuleForLocalDigits,
  formatPhoneInternational,
  formatPhoneNational,
  getPhoneCountryRule,
  getPhoneNumberTypeLabel,
  inferPhoneNumberType,
  type PhoneNumberType,
} from "./phone-country-rules";

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
  numberType?: PhoneNumberType;
  validationStatus?: PhoneValidationStatus;
  source?: PhoneEntrySource;
};

export type NormalizedPhoneCandidate = {
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
  numberType: PhoneNumberType;
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

  return digits;
};

const inferValidationStatus = (digits: string, e164: string | null) => {
  if (e164) {
    return "valid" as const;
  }
  if (digits.length >= 8 && digits.length <= 15) {
    return "possible" as const;
  }
  return "invalid" as const;
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
      numberType: "unknown",
      validationStatus: "invalid",
    };
  }

  const { base, extension } = extractExtension(rawInput);
  const canonicalSeed = normalizeInternationalPrefix(base);
  const hasPlus = canonicalSeed.startsWith("+");
  const digits = canonicalSeed.replace(/\D/g, "");

  const supportedMatch = hasPlus
    ? findPhoneCountryRuleByCallingCode(digits)
    : findPhoneCountryRuleForLocalDigits(digits) ??
      (digits.length === 11 && digits.startsWith("1")
        ? findPhoneCountryRuleByCallingCode(digits)
        : null);

  const rule = supportedMatch?.rule ?? null;
  const nationalDigits = supportedMatch?.nationalDigits ?? null;
  const numberType = inferPhoneNumberType(nationalDigits ?? "", rule);
  const e164 = rule && nationalDigits ? `+${rule.callingCode}${nationalDigits}` : hasPlus && digits ? `+${digits}` : null;
  const displayInternational = rule && nationalDigits
    ? formatPhoneInternational(nationalDigits, rule, numberType)
    : e164;
  const displayNational = rule && nationalDigits
    ? formatPhoneNational(nationalDigits, rule, numberType)
    : null;
  const validationStatus = inferValidationStatus(digits, e164);
  const fallbackValue = displayInternational ?? (hasPlus ? `+${digits}` : digits || rawInput);
  const looseKey = e164
    ? e164.replace(/^\+/, "")
    : digits.length >= 7
      ? digits.length > 10
        ? digits.slice(-10)
        : digits
      : "";

  return {
    rawInput,
    value: fallbackValue,
    normalizedDigits: digits,
    exactKey: e164 ?? "",
    looseKey,
    e164,
    national: nationalDigits,
    countryCode: rule?.iso2 ?? null,
    callingCode: rule?.callingCode ?? null,
    extension,
    displayInternational,
    displayNational,
    numberType,
    validationStatus,
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
  if (candidate.countryCode) score += 15;
  if (candidate.numberType !== "unknown") score += 5;
  if (candidate.rawInput.startsWith("+")) score += 8;
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
      numberType: candidate.numberType,
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

export const arePhoneValuesEquivalent = (
  left: string | null | undefined,
  right: string | null | undefined,
) =>
  candidatesRepresentSamePhone(
    normalizePhoneCandidate(left),
    normalizePhoneCandidate(right),
  );

export const getPhoneValueContext = (value: string | null | undefined) => {
  const candidate = normalizePhoneCandidate(value);
  if (!candidate.rawInput) {
    return null;
  }

  const rule = candidate.countryCode ? getPhoneCountryRule(candidate.countryCode) : null;
  const typeLabel = getPhoneNumberTypeLabel(rule, candidate.numberType);
  const summary = [typeLabel, rule?.displayName].filter(Boolean).join(" · ");

  return {
    countryCode: candidate.countryCode,
    countryName: rule?.displayName ?? null,
    numberType: candidate.numberType,
    numberTypeLabel: typeLabel,
    summary: summary || null,
    preferredDisplay:
      candidate.displayInternational ??
      candidate.displayNational ??
      candidate.value ??
      candidate.rawInput,
  };
};
