import { Prisma } from "../../generated/prisma";
import { emitEvent } from "~/lib/activity";
import {
  emailDomain,
  getFamilyName as getFamilyNameKey,
  givenInitialMatch,
  normalizePhoneKey,
  phoneticNameKey,
} from "~/lib/duplicate-signals";
import {
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";
import { db } from "~/server/db";

type MergeCandidateContact = {
  id: string;
  fullName: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  namePrefix?: string | null;
  nameSuffix?: string | null;
  nickname?: string | null;
  email: string | null;
  emailAddresses?: unknown;
  emailEntries?: unknown;
  phone: string | null;
  phoneNumbers?: unknown;
  phoneEntries?: unknown;
  company: string | null;
  jobTitle?: string | null;
  website?: string | null;
  websiteEntries?: unknown;
  birthday?: string | null;
  address?: string | null;
  postalAddresses?: unknown;
  addressEntries?: unknown;
  avatarUrl?: string | null;
  isFavorite?: boolean;
  labels?: unknown;
  significantDates?: unknown;
  relatedPeople?: unknown;
  customFields?: unknown;
  importJobId?: string | null;
  updatedAt: Date;
};

export type MergeSuggestionSignal =
  | "exact-email"
  | "exact-phone"
  | "normalized-phone"
  | "name-and-company"
  | "name-and-company-proximity"
  | "name-and-missing-company"
  | "phonetic-name"
  | "email-domain-and-name";

// Per-signal score contribution, surfaced in the "why was this suggested?" panel (P10-08).
export type SignalContribution = {
  signal: MergeSuggestionSignal;
  label: string;
  score: number;
};

export type MergeSuggestionConfidence = "high" | "medium" | "low";

export type MergeableContact = MergeCandidateContact & {
  notes: string | null;
  archivedAt: Date | null;
  importJobId?: string | null;
  sourceKind?: "manual" | "imported";
};

export type MergeFieldChoice = "primary" | "secondary" | "combine";

export type MergeFieldChoices = {
  fullName?: Extract<MergeFieldChoice, "primary" | "secondary">;
  email?: Extract<MergeFieldChoice, "primary" | "secondary">;
  phone?: Extract<MergeFieldChoice, "primary" | "secondary">;
  company?: Extract<MergeFieldChoice, "primary" | "secondary">;
  notes?: MergeFieldChoice;
};

export type MergeSuggestionPreview = {
  pairKey: string;
  leftContact: MergeCandidateContact;
  rightContact: MergeCandidateContact;
  confidence: MergeSuggestionConfidence;
  score: number;
  reasons: string[];
  signals: MergeSuggestionSignal[];
  contributions: SignalContribution[];
  hardMatch: boolean;
};

export type PersistedMergeSuggestion = {
  id: string;
  status: "OPEN" | "DISMISSED" | "MERGED" | "STALE";
  confidence: MergeSuggestionConfidence;
  score: number;
  hardMatch: boolean;
  source: string;
  generatedAt: Date;
  reviewedAt: Date | null;
  reasons: string[];
  signals: MergeSuggestionSignal[];
  contributions: SignalContribution[];
  leftContact: MergeCandidateContact;
  rightContact: MergeCandidateContact;
};

export type MergePreview = {
  primaryContact: MergeableContact;
  secondaryContact: MergeableContact;
  defaultChoices: Required<MergeFieldChoices>;
  edgeCaseWarnings: string[];
  mergedContact: {
    fullName: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    namePrefix: string | null;
    nameSuffix: string | null;
    email: string | null;
    emailAddresses: string[] | null;
    emailEntries: Array<{ label: string; value: string; isPrimary: boolean }> | null;
    phone: string | null;
    phoneNumbers: string[] | null;
    phoneEntries: Array<{ label: string; value: string; isPrimary: boolean }> | null;
    company: string | null;
    nickname: string | null;
    jobTitle: string | null;
    website: string | null;
    websiteEntries: Array<{ label: string; value: string; isPrimary: boolean }> | null;
    birthday: string | null;
    address: string | null;
    postalAddresses: Array<{ label: string; formatted: string }> | null;
    addressEntries: Array<{
      label: string;
      formatted: string;
      isPrimary: boolean;
      countryOrRegion?: string;
      streetLine1?: string;
      streetLine2?: string;
      cityOrTown?: string;
      postcode?: string;
      poBox?: string;
    }> | null;
    avatarUrl: string | null;
    isFavorite: boolean;
    labels: string[] | null;
    significantDates: Array<{ label: string; date: string; isPrimary: boolean }> | null;
    relatedPeople: Array<{ relationship: string; name: string }> | null;
    customFields: Array<{ label: string; value: string }> | null;
    notes: string | null;
  };
  mergeNotes: string[];
};

type MergeDecisionSnapshot = {
  primaryBefore: {
    id: string;
    fullName: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    namePrefix: string | null;
    nameSuffix: string | null;
    nickname: string | null;
    email: string | null;
    emailAddresses: string[] | null;
    emailEntries: Array<{ label: string; value: string; isPrimary: boolean }> | null;
    phone: string | null;
    phoneNumbers: string[] | null;
    phoneEntries: Array<{ label: string; value: string; isPrimary: boolean }> | null;
    company: string | null;
    jobTitle: string | null;
    website: string | null;
    websiteEntries: Array<{ label: string; value: string; isPrimary: boolean }> | null;
    birthday: string | null;
    address: string | null;
    postalAddresses: Array<{ label: string; formatted: string }> | null;
    addressEntries: Array<{
      label: string;
      formatted: string;
      isPrimary: boolean;
      countryOrRegion?: string;
      streetLine1?: string;
      streetLine2?: string;
      cityOrTown?: string;
      postcode?: string;
      poBox?: string;
    }> | null;
    avatarUrl: string | null;
    isFavorite: boolean;
    labels: string[] | null;
    significantDates: Array<{ label: string; date: string; isPrimary: boolean }> | null;
    relatedPeople: Array<{ relationship: string; name: string }> | null;
    customFields: Array<{ label: string; value: string }> | null;
    notes: string | null;
    archivedAt: string | null;
    syncTombstoneAt: string | null;
    mergedIntoContactId: string | null;
  };
  secondaryBefore: {
    id: string;
    fullName: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    namePrefix: string | null;
    nameSuffix: string | null;
    nickname: string | null;
    email: string | null;
    emailAddresses: string[] | null;
    emailEntries: Array<{ label: string; value: string; isPrimary: boolean }> | null;
    phone: string | null;
    phoneNumbers: string[] | null;
    phoneEntries: Array<{ label: string; value: string; isPrimary: boolean }> | null;
    company: string | null;
    jobTitle: string | null;
    website: string | null;
    websiteEntries: Array<{ label: string; value: string; isPrimary: boolean }> | null;
    birthday: string | null;
    address: string | null;
    postalAddresses: Array<{ label: string; formatted: string }> | null;
    addressEntries: Array<{
      label: string;
      formatted: string;
      isPrimary: boolean;
      countryOrRegion?: string;
      streetLine1?: string;
      streetLine2?: string;
      cityOrTown?: string;
      postcode?: string;
      poBox?: string;
    }> | null;
    avatarUrl: string | null;
    isFavorite: boolean;
    labels: string[] | null;
    significantDates: Array<{ label: string; date: string; isPrimary: boolean }> | null;
    relatedPeople: Array<{ relationship: string; name: string }> | null;
    customFields: Array<{ label: string; value: string }> | null;
    notes: string | null;
    archivedAt: string | null;
    syncTombstoneAt: string | null;
    mergedIntoContactId: string | null;
  };
  mergedAfter: {
    fullName: string;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    namePrefix: string | null;
    nameSuffix: string | null;
    nickname: string | null;
    email: string | null;
    emailAddresses: string[] | null;
    emailEntries: Array<{ label: string; value: string; isPrimary: boolean }> | null;
    phone: string | null;
    phoneNumbers: string[] | null;
    phoneEntries: Array<{ label: string; value: string; isPrimary: boolean }> | null;
    company: string | null;
    jobTitle: string | null;
    website: string | null;
    websiteEntries: Array<{ label: string; value: string; isPrimary: boolean }> | null;
    birthday: string | null;
    address: string | null;
    postalAddresses: Array<{ label: string; formatted: string }> | null;
    addressEntries: Array<{
      label: string;
      formatted: string;
      isPrimary: boolean;
      countryOrRegion?: string;
      streetLine1?: string;
      streetLine2?: string;
      cityOrTown?: string;
      postcode?: string;
      poBox?: string;
    }> | null;
    avatarUrl: string | null;
    isFavorite: boolean;
    labels: string[] | null;
    significantDates: Array<{ label: string; date: string; isPrimary: boolean }> | null;
    relatedPeople: Array<{ relationship: string; name: string }> | null;
    customFields: Array<{ label: string; value: string }> | null;
    notes: string | null;
  };
  fieldChoices: MergeFieldChoices;
};

const normalizeValue = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

const normalizeName = (value: string) =>
  normalizeValue(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizePhone = (value: string | null | undefined) => {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length >= 7 ? digits : "";
};

const getNameTokens = (value: string) => normalizeName(value).split(" ").filter(Boolean);

const getFamilyName = (value: string) => {
  const tokens = getNameTokens(value);
  return tokens.at(-1) ?? "";
};

const getGivenName = (value: string) => {
  const tokens = getNameTokens(value);
  return tokens[0] ?? "";
};

const buildPairKey = (leftContactId: string, rightContactId: string) =>
  [leftContactId, rightContactId].sort().join("::");

const getSourceKind = (contact: MergeableContact) =>
  contact.importJobId ? "imported" : "manual";

const combineNotes = (primaryNotes: string | null, secondaryNotes: string | null) => {
  const trimmedPrimary = primaryNotes?.trim() ?? "";
  const trimmedSecondary = secondaryNotes?.trim() ?? "";

  if (!trimmedPrimary && !trimmedSecondary) {
    return null;
  }

  if (!trimmedPrimary) {
    return trimmedSecondary;
  }

  if (!trimmedSecondary || trimmedPrimary === trimmedSecondary) {
    return trimmedPrimary;
  }

  return `${trimmedPrimary}\n\n---\nMerged notes\n${trimmedSecondary}`;
};

const toNullableJsonField = (
  value:
    | string[]
    | Array<{ label: string; formatted: string }>
    | Array<{ label: string; value: string; isPrimary: boolean }>
    | Array<{
        label: string;
        formatted: string;
        isPrimary: boolean;
        countryOrRegion?: string;
        streetLine1?: string;
        streetLine2?: string;
        cityOrTown?: string;
        postcode?: string;
        poBox?: string;
      }>
    | Array<{ label: string; date: string; isPrimary: boolean }>
    | Array<{ relationship: string; name: string }>
    | Array<{ label: string; value: string }>
    | null
    | undefined,
) => value ?? Prisma.DbNull;

const parseObjectArray = <T extends Record<string, unknown>>(value: unknown) =>
  Array.isArray(value) ? (value.filter((item): item is T => Boolean(item) && typeof item === "object")) : [];

const mergeUniqueStrings = (...groups: Array<Array<string | null | undefined>>) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const group of groups) {
    for (const value of group) {
      const trimmed = value?.trim();
      if (!trimmed) {
        continue;
      }

      const key = trimmed.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(trimmed);
    }
  }

  return result;
};

const mergePostalAddresses = (
  primaryAddress: string | null | undefined,
  primaryPostalAddresses: Array<{ label: string; formatted: string }>,
  secondaryAddress: string | null | undefined,
  secondaryPostalAddresses: Array<{ label: string; formatted: string }>,
) => {
  const seen = new Set<string>();
  const result: Array<{ label: string; formatted: string }> = [];

  for (const entry of [
    ...(primaryAddress ? [{ label: "primary", formatted: primaryAddress }] : []),
    ...primaryPostalAddresses,
    ...(secondaryAddress ? [{ label: "other", formatted: secondaryAddress }] : []),
    ...secondaryPostalAddresses,
  ]) {
    const key = entry.formatted.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(entry);
  }

  return result;
};

const mergeStructuredValueEntries = (
  primaryEntries: Array<{ label: string; value: string; isPrimary?: boolean }>,
  secondaryEntries: Array<{ label: string; value: string; isPrimary?: boolean }>,
) => {
  const seen = new Set<string>();
  const result: Array<{ label: string; value: string; isPrimary: boolean }> = [];

  for (const entry of [...primaryEntries, ...secondaryEntries]) {
    const key = entry.value.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      label: entry.label,
      value: entry.value,
      isPrimary: result.length === 0,
    });
  }

  return result;
};

const mergeAddressEntries = (
  primaryEntries: Array<{
    label: string;
    formatted: string;
    isPrimary?: boolean;
    countryOrRegion?: string;
    streetLine1?: string;
    streetLine2?: string;
    cityOrTown?: string;
    postcode?: string;
    poBox?: string;
  }>,
  secondaryEntries: Array<{
    label: string;
    formatted: string;
    isPrimary?: boolean;
    countryOrRegion?: string;
    streetLine1?: string;
    streetLine2?: string;
    cityOrTown?: string;
    postcode?: string;
    poBox?: string;
  }>,
) => {
  const seen = new Set<string>();
  const result: Array<{
    label: string;
    formatted: string;
    isPrimary: boolean;
    countryOrRegion?: string;
    streetLine1?: string;
    streetLine2?: string;
    cityOrTown?: string;
    postcode?: string;
    poBox?: string;
  }> = [];

  for (const entry of [...primaryEntries, ...secondaryEntries]) {
    const key = entry.formatted.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      ...entry,
      isPrimary: result.length === 0,
    });
  }

  return result;
};

const mergeLabelValuePairs = (
  primaryEntries: Array<{ label: string; value: string }>,
  secondaryEntries: Array<{ label: string; value: string }>,
) => {
  const seen = new Set<string>();
  const result: Array<{ label: string; value: string }> = [];

  for (const entry of [...primaryEntries, ...secondaryEntries]) {
    const key = `${entry.label.trim().toLowerCase()}::${entry.value.trim().toLowerCase()}`;
    if (!entry.label.trim() || !entry.value.trim() || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(entry);
  }

  return result;
};

const mergeDates = (
  primaryEntries: Array<{ label: string; date: string; isPrimary?: boolean }>,
  secondaryEntries: Array<{ label: string; date: string; isPrimary?: boolean }>,
) => {
  const seen = new Set<string>();
  const result: Array<{ label: string; date: string; isPrimary: boolean }> = [];

  for (const entry of [...primaryEntries, ...secondaryEntries]) {
    const key = `${entry.label.trim().toLowerCase()}::${entry.date.trim()}`;
    if (!entry.label.trim() || !entry.date.trim() || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push({
      label: entry.label,
      date: entry.date,
      isPrimary: result.length === 0 ? entry.label.trim().toLowerCase() === "birthday" : false,
    });
  }

  return result;
};

const mergeRelatedPeople = (
  primaryEntries: Array<{ relationship: string; name: string }>,
  secondaryEntries: Array<{ relationship: string; name: string }>,
) => {
  const seen = new Set<string>();
  const result: Array<{ relationship: string; name: string }> = [];

  for (const entry of [...primaryEntries, ...secondaryEntries]) {
    const key = `${entry.relationship.trim().toLowerCase()}::${entry.name.trim().toLowerCase()}`;
    if (!entry.relationship.trim() || !entry.name.trim() || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(entry);
  }

  return result;
};

const getDefaultFieldChoice = ({
  primaryValue,
  secondaryValue,
  primaryContact,
  secondaryContact,
  allowCombine = false,
}: {
  primaryValue: string | null | undefined;
  secondaryValue: string | null | undefined;
  primaryContact: MergeableContact;
  secondaryContact: MergeableContact;
  allowCombine?: boolean;
}): MergeFieldChoice => {
  const primaryText = primaryValue?.trim() ?? "";
  const secondaryText = secondaryValue?.trim() ?? "";

  if (!primaryText && secondaryText) {
    return "secondary";
  }

  if (primaryText && !secondaryText) {
    return "primary";
  }

  if (!primaryText && !secondaryText) {
    return allowCombine ? "combine" : "primary";
  }

  if (primaryText === secondaryText) {
    return "primary";
  }

  if (allowCombine) {
    return "combine";
  }

  const primarySource = primaryContact.sourceKind ?? getSourceKind(primaryContact);
  const secondarySource = secondaryContact.sourceKind ?? getSourceKind(secondaryContact);

  if (primarySource === "manual" && secondarySource === "imported") {
    return "primary";
  }

  if (primarySource === "imported" && secondarySource === "manual") {
    return "secondary";
  }

  return "primary";
};

const pickFieldValue = ({
  primaryValue,
  secondaryValue,
  choice,
}: {
  primaryValue: string | null | undefined;
  secondaryValue: string | null | undefined;
  choice: MergeFieldChoice;
}) => {
  if (choice === "secondary") {
    return secondaryValue?.trim() ?? primaryValue?.trim() ?? null;
  }

  return primaryValue?.trim() ?? secondaryValue?.trim() ?? null;
};

const getEdgeCaseWarnings = (left: MergeableContact, right: MergeableContact) => {
  const warnings: string[] = [];
  const leftEmail = normalizeValue(left.email);
  const rightEmail = normalizeValue(right.email);
  const leftPhone = normalizePhone(left.phone);
  const rightPhone = normalizePhone(right.phone);
  const leftFamilyName = getFamilyName(left.fullName);
  const rightFamilyName = getFamilyName(right.fullName);
  const leftGivenName = getGivenName(left.fullName);
  const rightGivenName = getGivenName(right.fullName);
  const leftCompany = normalizeValue(left.company);
  const rightCompany = normalizeValue(right.company);
  const leftSource = left.sourceKind ?? getSourceKind(left);
  const rightSource = right.sourceKind ?? getSourceKind(right);

  if (
    leftEmail &&
    rightEmail &&
    leftEmail === rightEmail &&
    leftFamilyName &&
    rightFamilyName &&
    leftFamilyName !== rightFamilyName
  ) {
    warnings.push(
      "Shared email with different family names detected. This could be a household address or shared inbox, so review carefully before merging.",
    );
  }

  if (
    leftPhone &&
    rightPhone &&
    leftPhone === rightPhone &&
    normalizeName(left.fullName) !== normalizeName(right.fullName)
  ) {
    warnings.push(
      "Shared phone with different names detected. This could be an assistant line, family number, or front-desk number rather than a true duplicate.",
    );
  }

  if (
    leftPhone &&
    rightPhone &&
    leftPhone === rightPhone &&
    leftCompany &&
    rightCompany &&
    leftCompany !== rightCompany
  ) {
    warnings.push(
      "The same phone number appears across different companies. Treat this as review-first rather than an obvious duplicate.",
    );
  }

  if (
    (leftSource === "imported" || rightSource === "imported") &&
    ((!left.email && !left.phone) || (!right.email && !right.phone))
  ) {
    warnings.push(
      "One side is a sparse imported record without a strong identifier. Imported sparse records should be merged cautiously.",
    );
  }

  if (
    leftGivenName &&
    rightGivenName &&
    leftGivenName !== rightGivenName &&
    leftFamilyName &&
    rightFamilyName &&
    leftFamilyName === rightFamilyName &&
    (leftEmail === rightEmail || (leftPhone && leftPhone === rightPhone))
  ) {
    warnings.push(
      "Names differ while surnames and identifiers overlap. This could be a nickname, transliteration, or different member of the same household.",
    );
  }

  return warnings;
};

const getSignalDetails = (left: MergeCandidateContact, right: MergeCandidateContact) => {
  const leftEmail = normalizeValue(left.email);
  const rightEmail = normalizeValue(right.email);
  const leftPhoneExact = normalizePhone(left.phone);
  const rightPhoneExact = normalizePhone(right.phone);
  const leftPhoneKey = normalizePhoneKey(left.phone);
  const rightPhoneKey = normalizePhoneKey(right.phone);
  const leftName = normalizeName(left.fullName);
  const rightName = normalizeName(right.fullName);
  const leftCompany = normalizeValue(left.company);
  const rightCompany = normalizeValue(right.company);
  const sameCompany = Boolean(leftCompany && rightCompany && leftCompany === rightCompany);

  const contributions: SignalContribution[] = [];
  let hardMatch = false;
  const add = (signal: MergeSuggestionSignal, label: string, points: number) => {
    contributions.push({ signal, label, score: points });
  };

  // --- Hard identifier matches -------------------------------------------------
  if (leftEmail && rightEmail && leftEmail === rightEmail) {
    add("exact-email", `Same email: ${left.email}`, 100);
    hardMatch = true;
  }

  if (leftPhoneExact && rightPhoneExact && leftPhoneExact === rightPhoneExact) {
    add("exact-phone", `Same phone: ${left.phone}`, 95);
    hardMatch = true;
  } else if (leftPhoneKey && rightPhoneKey && leftPhoneKey === rightPhoneKey) {
    // Same number written in different formats (country code / spacing / trunk 0).
    add("normalized-phone", `Same phone in a different format: ${left.phone} ≈ ${right.phone}`, 90);
    hardMatch = true;
  }

  // --- Name + company ----------------------------------------------------------
  const exactName = Boolean(leftName && rightName && leftName === rightName);
  if (exactName) {
    if (sameCompany) {
      add("name-and-company", `Same name and company: ${left.fullName} at ${left.company}`, 70);
    } else if (!leftCompany || !rightCompany) {
      add("name-and-missing-company", `Same name with missing company context: ${left.fullName}`, 45);
    }
  } else if (
    sameCompany &&
    getFamilyNameKey(left.fullName) &&
    getFamilyNameKey(left.fullName) === getFamilyNameKey(right.fullName) &&
    givenInitialMatch(left.fullName, right.fullName)
  ) {
    // "J. Smith at Acme" ~ "John Smith, Acme Corp": same surname + initial + company.
    add(
      "name-and-company-proximity",
      `Likely same person at ${left.company}: ${left.fullName} ≈ ${right.fullName}`,
      55,
    );
  }

  // --- Phonetic name (supporting signal only — never a hard match) -------------
  if (!exactName) {
    const leftPhonetic = phoneticNameKey(left.fullName);
    const rightPhonetic = phoneticNameKey(right.fullName);
    if (leftPhonetic && leftPhonetic === rightPhonetic) {
      add(
        "phonetic-name",
        `Names sound alike: ${left.fullName} ≈ ${right.fullName}`,
        sameCompany ? 40 : 30,
      );
    }
  }

  // --- Shared email domain + similar name (weak / LOW) -------------------------
  if (!(leftEmail && rightEmail && leftEmail === rightEmail)) {
    const leftDomain = emailDomain(left.email);
    const rightDomain = emailDomain(right.email);
    const commonDomain = leftDomain && leftDomain === rightDomain;
    const isPublicDomain = /^(gmail|yahoo|hotmail|outlook|icloud|aol|proton(mail)?)\./.test(
      `${leftDomain}.`,
    );
    const surnameMatch =
      getFamilyNameKey(left.fullName) &&
      getFamilyNameKey(left.fullName) === getFamilyNameKey(right.fullName);
    if (commonDomain && !isPublicDomain && (surnameMatch || givenInitialMatch(left.fullName, right.fullName))) {
      add("email-domain-and-name", `Same email domain and similar name: @${leftDomain}`, 15);
    }
  }

  const signals = contributions.map((contribution) => contribution.signal);
  const reasons = contributions.map((contribution) => contribution.label);
  const score = contributions.reduce((total, contribution) => total + contribution.score, 0);

  return {
    signals,
    reasons,
    contributions,
    score,
    hardMatch,
  };
};

// Confidence tier from the total score. Edge-case warnings cap the result at
// MEDIUM so review-first pairs never land in the HIGH (bulk-acceptable) bucket,
// and weak supporting-only signals (phonetic / email-domain) stay LOW (P10-08).
const deriveConfidence = (
  score: number,
  hardMatch: boolean,
  hasEdgeWarnings: boolean,
): MergeSuggestionConfidence => {
  if (!hasEdgeWarnings && (hardMatch || score >= 90)) {
    return "high";
  }
  if (score >= 45) {
    return "medium";
  }
  return "low";
};

const toConfidenceEnum = (confidence: MergeSuggestionConfidence) =>
  confidence.toUpperCase() as "HIGH" | "MEDIUM" | "LOW";

// Parse the persisted `signals` JSON back into structured contributions. Newer
// rows store SignalContribution objects; older rows stored bare signal strings.
const parseContributions = (value: unknown): SignalContribution[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (typeof item === "string") {
      return [{ signal: item as MergeSuggestionSignal, label: item, score: 0 }];
    }
    if (item && typeof item === "object" && "signal" in item) {
      const record = item as { signal?: unknown; label?: unknown; score?: unknown };
      return [
        {
          signal: String(record.signal) as MergeSuggestionSignal,
          label: typeof record.label === "string" ? record.label : String(record.signal),
          score: typeof record.score === "number" ? record.score : 0,
        },
      ];
    }
    return [];
  });
};

export const buildContactMergeSuggestions = (contacts: MergeCandidateContact[]) => {
  const suggestions: MergeSuggestionPreview[] = [];

  for (let leftIndex = 0; leftIndex < contacts.length; leftIndex += 1) {
    const left = contacts[leftIndex];
    if (!left) {
      continue;
    }

    for (let rightIndex = leftIndex + 1; rightIndex < contacts.length; rightIndex += 1) {
      const right = contacts[rightIndex];
      if (!right) {
        continue;
      }

      const { signals, reasons, contributions, score, hardMatch } = getSignalDetails(left, right);
      const edgeCaseWarnings = getEdgeCaseWarnings(
        {
          ...left,
          notes: null,
          archivedAt: null,
        },
        {
          ...right,
          notes: null,
          archivedAt: null,
        },
      );

      if (signals.length === 0) {
        continue;
      }

      const confidence = deriveConfidence(score, hardMatch, edgeCaseWarnings.length > 0);

      suggestions.push({
        pairKey: buildPairKey(left.id, right.id),
        leftContact: left,
        rightContact: right,
        confidence,
        score,
        reasons: [...reasons, ...edgeCaseWarnings],
        signals,
        contributions,
        hardMatch,
      });
    }
  }

  return suggestions.sort((left, right) => right.score - left.score).slice(0, 8);
};

export const buildMergedContactPreview = (
  primaryContact: MergeableContact,
  secondaryContact: MergeableContact,
  fieldChoices: MergeFieldChoices = {},
): MergePreview => {
  const normalizedPrimary = {
    ...primaryContact,
    sourceKind: primaryContact.sourceKind ?? getSourceKind(primaryContact),
    emailAddresses: parseContactStringArray(primaryContact.emailAddresses),
    emailEntries: parseObjectArray<{ label: string; value: string; isPrimary?: boolean }>(
      primaryContact.emailEntries,
    ),
    phoneNumbers: parseContactStringArray(primaryContact.phoneNumbers),
    phoneEntries: parseObjectArray<{ label: string; value: string; isPrimary?: boolean }>(
      primaryContact.phoneEntries,
    ),
    postalAddresses: parseContactPostalAddresses(primaryContact.postalAddresses),
    addressEntries: parseObjectArray<{
      label: string;
      formatted: string;
      isPrimary?: boolean;
      countryOrRegion?: string;
      streetLine1?: string;
      streetLine2?: string;
      cityOrTown?: string;
      postcode?: string;
      poBox?: string;
    }>(primaryContact.addressEntries),
    websiteEntries: parseObjectArray<{ label: string; value: string; isPrimary?: boolean }>(
      primaryContact.websiteEntries,
    ),
    labels: parseContactStringArray(primaryContact.labels),
    significantDates: parseObjectArray<{ label: string; date: string; isPrimary?: boolean }>(
      primaryContact.significantDates,
    ),
    relatedPeople: parseObjectArray<{ relationship: string; name: string }>(
      primaryContact.relatedPeople,
    ),
    customFields: parseObjectArray<{ label: string; value: string }>(primaryContact.customFields),
  };
  const normalizedSecondary = {
    ...secondaryContact,
    sourceKind: secondaryContact.sourceKind ?? getSourceKind(secondaryContact),
    emailAddresses: parseContactStringArray(secondaryContact.emailAddresses),
    emailEntries: parseObjectArray<{ label: string; value: string; isPrimary?: boolean }>(
      secondaryContact.emailEntries,
    ),
    phoneNumbers: parseContactStringArray(secondaryContact.phoneNumbers),
    phoneEntries: parseObjectArray<{ label: string; value: string; isPrimary?: boolean }>(
      secondaryContact.phoneEntries,
    ),
    postalAddresses: parseContactPostalAddresses(secondaryContact.postalAddresses),
    addressEntries: parseObjectArray<{
      label: string;
      formatted: string;
      isPrimary?: boolean;
      countryOrRegion?: string;
      streetLine1?: string;
      streetLine2?: string;
      cityOrTown?: string;
      postcode?: string;
      poBox?: string;
    }>(secondaryContact.addressEntries),
    websiteEntries: parseObjectArray<{ label: string; value: string; isPrimary?: boolean }>(
      secondaryContact.websiteEntries,
    ),
    labels: parseContactStringArray(secondaryContact.labels),
    significantDates: parseObjectArray<{ label: string; date: string; isPrimary?: boolean }>(
      secondaryContact.significantDates,
    ),
    relatedPeople: parseObjectArray<{ relationship: string; name: string }>(
      secondaryContact.relatedPeople,
    ),
    customFields: parseObjectArray<{ label: string; value: string }>(
      secondaryContact.customFields,
    ),
  };

  const defaultChoices: Required<MergeFieldChoices> = {
    fullName: getDefaultFieldChoice({
      primaryValue: normalizedPrimary.fullName,
      secondaryValue: normalizedSecondary.fullName,
      primaryContact: normalizedPrimary,
      secondaryContact: normalizedSecondary,
    }) as "primary" | "secondary",
    email: getDefaultFieldChoice({
      primaryValue: normalizedPrimary.email,
      secondaryValue: normalizedSecondary.email,
      primaryContact: normalizedPrimary,
      secondaryContact: normalizedSecondary,
    }) as "primary" | "secondary",
    phone: getDefaultFieldChoice({
      primaryValue: normalizedPrimary.phone,
      secondaryValue: normalizedSecondary.phone,
      primaryContact: normalizedPrimary,
      secondaryContact: normalizedSecondary,
    }) as "primary" | "secondary",
    company: getDefaultFieldChoice({
      primaryValue: normalizedPrimary.company,
      secondaryValue: normalizedSecondary.company,
      primaryContact: normalizedPrimary,
      secondaryContact: normalizedSecondary,
    }) as "primary" | "secondary",
    notes: getDefaultFieldChoice({
      primaryValue: normalizedPrimary.notes,
      secondaryValue: normalizedSecondary.notes,
      primaryContact: normalizedPrimary,
      secondaryContact: normalizedSecondary,
      allowCombine: true,
    }),
  };

  const resolvedChoices: Required<MergeFieldChoices> = {
    fullName: fieldChoices.fullName ?? defaultChoices.fullName,
    email: fieldChoices.email ?? defaultChoices.email,
    phone: fieldChoices.phone ?? defaultChoices.phone,
    company: fieldChoices.company ?? defaultChoices.company,
    notes: fieldChoices.notes ?? defaultChoices.notes,
  };

  const mergedContact = {
    fullName:
      pickFieldValue({
        primaryValue: normalizedPrimary.fullName,
        secondaryValue: normalizedSecondary.fullName,
        choice: resolvedChoices.fullName,
      }) ?? normalizedPrimary.fullName,
    firstName:
      pickFieldValue({
        primaryValue: normalizedPrimary.firstName,
        secondaryValue: normalizedSecondary.firstName,
        choice: getDefaultFieldChoice({
          primaryValue: normalizedPrimary.firstName,
          secondaryValue: normalizedSecondary.firstName,
          primaryContact: normalizedPrimary,
          secondaryContact: normalizedSecondary,
        }),
      }) ?? null,
    middleName:
      pickFieldValue({
        primaryValue: normalizedPrimary.middleName,
        secondaryValue: normalizedSecondary.middleName,
        choice: getDefaultFieldChoice({
          primaryValue: normalizedPrimary.middleName,
          secondaryValue: normalizedSecondary.middleName,
          primaryContact: normalizedPrimary,
          secondaryContact: normalizedSecondary,
        }),
      }) ?? null,
    lastName:
      pickFieldValue({
        primaryValue: normalizedPrimary.lastName,
        secondaryValue: normalizedSecondary.lastName,
        choice: getDefaultFieldChoice({
          primaryValue: normalizedPrimary.lastName,
          secondaryValue: normalizedSecondary.lastName,
          primaryContact: normalizedPrimary,
          secondaryContact: normalizedSecondary,
        }),
      }) ?? null,
    namePrefix:
      pickFieldValue({
        primaryValue: normalizedPrimary.namePrefix,
        secondaryValue: normalizedSecondary.namePrefix,
        choice: getDefaultFieldChoice({
          primaryValue: normalizedPrimary.namePrefix,
          secondaryValue: normalizedSecondary.namePrefix,
          primaryContact: normalizedPrimary,
          secondaryContact: normalizedSecondary,
        }),
      }) ?? null,
    nameSuffix:
      pickFieldValue({
        primaryValue: normalizedPrimary.nameSuffix,
        secondaryValue: normalizedSecondary.nameSuffix,
        choice: getDefaultFieldChoice({
          primaryValue: normalizedPrimary.nameSuffix,
          secondaryValue: normalizedSecondary.nameSuffix,
          primaryContact: normalizedPrimary,
          secondaryContact: normalizedSecondary,
        }),
      }) ?? null,
    email: pickFieldValue({
      primaryValue: normalizedPrimary.email,
      secondaryValue: normalizedSecondary.email,
      choice: resolvedChoices.email,
    }),
    emailAddresses: mergeUniqueStrings(
      [normalizedPrimary.email],
      normalizedPrimary.emailAddresses,
      [normalizedSecondary.email],
      normalizedSecondary.emailAddresses,
    ),
    emailEntries: mergeStructuredValueEntries(
      normalizedPrimary.emailEntries,
      normalizedSecondary.emailEntries,
    ),
    phone: pickFieldValue({
      primaryValue: normalizedPrimary.phone,
      secondaryValue: normalizedSecondary.phone,
      choice: resolvedChoices.phone,
    }),
    phoneNumbers: mergeUniqueStrings(
      [normalizedPrimary.phone],
      normalizedPrimary.phoneNumbers,
      [normalizedSecondary.phone],
      normalizedSecondary.phoneNumbers,
    ),
    phoneEntries: mergeStructuredValueEntries(
      normalizedPrimary.phoneEntries,
      normalizedSecondary.phoneEntries,
    ),
    company: pickFieldValue({
      primaryValue: normalizedPrimary.company,
      secondaryValue: normalizedSecondary.company,
      choice: resolvedChoices.company,
    }),
    nickname:
      pickFieldValue({
        primaryValue: normalizedPrimary.nickname,
        secondaryValue: normalizedSecondary.nickname,
        choice: getDefaultFieldChoice({
          primaryValue: normalizedPrimary.nickname,
          secondaryValue: normalizedSecondary.nickname,
          primaryContact: normalizedPrimary,
          secondaryContact: normalizedSecondary,
        }),
      }) ?? null,
    jobTitle:
      pickFieldValue({
        primaryValue: normalizedPrimary.jobTitle,
        secondaryValue: normalizedSecondary.jobTitle,
        choice: getDefaultFieldChoice({
          primaryValue: normalizedPrimary.jobTitle,
          secondaryValue: normalizedSecondary.jobTitle,
          primaryContact: normalizedPrimary,
          secondaryContact: normalizedSecondary,
        }),
      }) ?? null,
    website:
      pickFieldValue({
        primaryValue: normalizedPrimary.website,
        secondaryValue: normalizedSecondary.website,
        choice: getDefaultFieldChoice({
          primaryValue: normalizedPrimary.website,
          secondaryValue: normalizedSecondary.website,
          primaryContact: normalizedPrimary,
          secondaryContact: normalizedSecondary,
        }),
      }) ?? null,
    websiteEntries: mergeStructuredValueEntries(
      normalizedPrimary.websiteEntries,
      normalizedSecondary.websiteEntries,
    ),
    birthday:
      pickFieldValue({
        primaryValue: normalizedPrimary.birthday,
        secondaryValue: normalizedSecondary.birthday,
        choice: getDefaultFieldChoice({
          primaryValue: normalizedPrimary.birthday,
          secondaryValue: normalizedSecondary.birthday,
          primaryContact: normalizedPrimary,
          secondaryContact: normalizedSecondary,
        }),
      }) ?? null,
    address:
      pickFieldValue({
        primaryValue: normalizedPrimary.address,
        secondaryValue: normalizedSecondary.address,
        choice: getDefaultFieldChoice({
          primaryValue: normalizedPrimary.address,
          secondaryValue: normalizedSecondary.address,
          primaryContact: normalizedPrimary,
          secondaryContact: normalizedSecondary,
        }),
      }) ?? null,
    postalAddresses: mergePostalAddresses(
      normalizedPrimary.address,
      normalizedPrimary.postalAddresses,
      normalizedSecondary.address,
      normalizedSecondary.postalAddresses,
    ),
    addressEntries: mergeAddressEntries(
      normalizedPrimary.addressEntries,
      normalizedSecondary.addressEntries,
    ),
    avatarUrl:
      pickFieldValue({
        primaryValue: normalizedPrimary.avatarUrl,
        secondaryValue: normalizedSecondary.avatarUrl,
        choice: getDefaultFieldChoice({
          primaryValue: normalizedPrimary.avatarUrl,
          secondaryValue: normalizedSecondary.avatarUrl,
          primaryContact: normalizedPrimary,
          secondaryContact: normalizedSecondary,
        }),
      }) ?? null,
    isFavorite: [normalizedPrimary.isFavorite, normalizedSecondary.isFavorite].some(Boolean),
    labels: mergeUniqueStrings(normalizedPrimary.labels, normalizedSecondary.labels),
    significantDates: mergeDates(
      normalizedPrimary.significantDates,
      normalizedSecondary.significantDates,
    ),
    relatedPeople: mergeRelatedPeople(
      normalizedPrimary.relatedPeople,
      normalizedSecondary.relatedPeople,
    ),
    customFields: mergeLabelValuePairs(
      normalizedPrimary.customFields,
      normalizedSecondary.customFields,
    ),
    notes:
      resolvedChoices.notes === "combine"
        ? combineNotes(normalizedPrimary.notes, normalizedSecondary.notes)
        : pickFieldValue({
            primaryValue: normalizedPrimary.notes,
            secondaryValue: normalizedSecondary.notes,
            choice: resolvedChoices.notes,
          }),
  };

  const mergeNotes = [
    normalizedPrimary.sourceKind !== normalizedSecondary.sourceKind
      ? "Default precedence favors manual values over imported values when both sides conflict."
      : null,
    normalizedPrimary.email &&
    normalizedSecondary.email &&
    normalizedPrimary.email !== normalizedSecondary.email
      ? `Email conflict currently resolves to ${mergedContact.email ?? "the available value"} unless you choose otherwise.`
      : null,
    normalizedPrimary.phone &&
    normalizedSecondary.phone &&
    normalizedPrimary.phone !== normalizedSecondary.phone
      ? `Phone conflict currently resolves to ${mergedContact.phone ?? "the available value"} unless you choose otherwise.`
      : null,
    normalizedPrimary.company &&
    normalizedSecondary.company &&
    normalizedPrimary.company !== normalizedSecondary.company
      ? `Company conflict currently resolves to ${mergedContact.company ?? "the available value"} unless you choose otherwise.`
      : null,
    normalizedPrimary.notes &&
    normalizedSecondary.notes &&
    normalizedPrimary.notes !== normalizedSecondary.notes &&
    resolvedChoices.notes === "combine"
      ? "Both notes fields will be combined into the merged record."
      : null,
    normalizedPrimary.labels.length > 0 || normalizedSecondary.labels.length > 0
      ? "Labels, related people, custom fields, websites, and significant dates merge by union so richer context is preserved across records."
      : null,
    normalizedPrimary.sourceKind !== normalizedSecondary.sourceKind
      ? "Rich scalar fields such as avatar, name parts, and structured address details follow the same manual-over-imported precedence as the canonical fields."
      : null,
    "The secondary record will be archived after merge so the action stays reversible at the record level.",
  ].filter((note): note is string => note != null);

  const edgeCaseWarnings = getEdgeCaseWarnings(normalizedPrimary, normalizedSecondary);

  return {
    primaryContact: normalizedPrimary,
    secondaryContact: normalizedSecondary,
    defaultChoices: resolvedChoices,
    edgeCaseWarnings,
    mergedContact,
    mergeNotes,
  };
};

export const refreshMergeSuggestionsForUser = async (
  userId: string,
  source = "manual-refresh",
) => {
  const contacts = await db.contact.findMany({
    where: {
      userId,
      archivedAt: null,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      company: true,
      importJobId: true,
      updatedAt: true,
    },
  });

  const suggestions = buildContactMergeSuggestions(contacts);
  const pairKeys = suggestions.map((suggestion) => suggestion.pairKey);

  for (const suggestion of suggestions) {
    const existing = await db.mergeSuggestion.findUnique({
      where: {
        userId_pairKey: {
          userId,
          pairKey: suggestion.pairKey,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    await db.mergeSuggestion.upsert({
      where: {
        userId_pairKey: {
          userId,
          pairKey: suggestion.pairKey,
        },
      },
      create: {
        userId,
        leftContactId: suggestion.leftContact.id,
        rightContactId: suggestion.rightContact.id,
        pairKey: suggestion.pairKey,
        status: "OPEN",
        confidence: toConfidenceEnum(suggestion.confidence),
        score: suggestion.score,
        hardMatch: suggestion.hardMatch,
        signals: suggestion.contributions,
        reasons: suggestion.reasons,
        source,
        generatedAt: new Date(),
      },
      update: {
        leftContactId: suggestion.leftContact.id,
        rightContactId: suggestion.rightContact.id,
        status: existing?.status === "DISMISSED" || existing?.status === "MERGED" ? existing.status : "OPEN",
        confidence: toConfidenceEnum(suggestion.confidence),
        score: suggestion.score,
        hardMatch: suggestion.hardMatch,
        signals: suggestion.contributions,
        reasons: suggestion.reasons,
        source,
        generatedAt: new Date(),
      },
    });
  }

  await db.mergeSuggestion.updateMany({
    where: {
      userId,
      status: "OPEN",
      ...(pairKeys.length > 0 ? { pairKey: { notIn: pairKeys } } : {}),
    },
    data: {
      status: "STALE",
      reviewedAt: new Date(),
    },
  });

  if (pairKeys.length === 0) {
    await db.mergeSuggestion.updateMany({
      where: {
        userId,
        status: "OPEN",
      },
      data: {
        status: "STALE",
        reviewedAt: new Date(),
      },
    });
  }

  return suggestions.length;
};

export type RecentMerge = {
  decisionId: string;
  survivorContactId: string;
  survivorName: string;
  absorbedName: string;
  decidedAt: Date;
  source: string;
  canUndo: boolean;
};

const MERGE_UNDO_WINDOW_DAYS = 30;

// Recent, not-yet-reversed merges for the "Merged contacts" section (P10-05).
// Undo is offered for 30 days (from decidedAt); older rows show as expired.
export const getRecentMergesForUser = async (userId: string): Promise<RecentMerge[]> => {
  const decisions = await db.mergeDecision.findMany({
    where: { userId, status: "ACCEPTED", reversedAt: null },
    orderBy: { decidedAt: "desc" },
    take: 20,
    select: { id: true, decidedAt: true, source: true, details: true },
  });

  const cutoff = Date.now() - MERGE_UNDO_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return decisions
    .map((decision) => {
      const details = decision.details as MergeDecisionSnapshot | null;
      if (!details) {
        return null;
      }
      return {
        decisionId: decision.id,
        survivorContactId: details.primaryBefore.id,
        survivorName: details.primaryBefore.fullName || "Unnamed contact",
        absorbedName: details.secondaryBefore.fullName || "Unnamed contact",
        decidedAt: decision.decidedAt,
        source: decision.source,
        canUndo: decision.decidedAt.getTime() >= cutoff,
      } satisfies RecentMerge;
    })
    .filter((row): row is RecentMerge => row != null);
};

// Bulk-accept every OPEN, HIGH-confidence suggestion (P10-05). Each pair merges
// in its own transaction (reusing mergeContactsForUser → events + decision +
// archive), so one failure doesn't abort the rest, and each stays undoable.
export const bulkAcceptHighConfidenceForUser = async (
  userId: string,
): Promise<{ mergedCount: number; failedCount: number }> => {
  const suggestions = await db.mergeSuggestion.findMany({
    where: { userId, status: "OPEN", confidence: "HIGH" },
    select: { id: true, leftContactId: true, rightContactId: true },
  });

  let mergedCount = 0;
  let failedCount = 0;

  for (const suggestion of suggestions) {
    try {
      await mergeContactsForUser({
        userId,
        primaryContactId: suggestion.leftContactId,
        secondaryContactId: suggestion.rightContactId,
        suggestionId: suggestion.id,
        source: "bulk-accept",
      });
      mergedCount += 1;
    } catch (error) {
      console.error(`Bulk merge failed for suggestion ${suggestion.id}`, error);
      failedCount += 1;
    }
  }

  return { mergedCount, failedCount };
};

// Recompute OPEN suggestions whose left/right contact was edited after the
// suggestion was generated (P10-08). A still-valid pair is refreshed in place
// (new score/reasons/confidence/generatedAt); a pair that no longer matches —
// or whose contacts were archived/removed — is marked STALE so the user never
// sees outdated match reasons.
export const regenerateStaleSuggestionsForUser = async (userId: string) => {
  const open = await db.mergeSuggestion.findMany({
    where: { userId, status: "OPEN" },
    select: {
      id: true,
      generatedAt: true,
      leftContact: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          company: true,
          importJobId: true,
          archivedAt: true,
          updatedAt: true,
        },
      },
      rightContact: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          company: true,
          importJobId: true,
          archivedAt: true,
          updatedAt: true,
        },
      },
    },
  });

  const stale = open.filter(
    (s) =>
      s.leftContact.updatedAt > s.generatedAt || s.rightContact.updatedAt > s.generatedAt,
  );

  for (const suggestion of stale) {
    const { leftContact, rightContact } = suggestion;

    // Either contact archived → the pair is no longer mergeable.
    if (leftContact.archivedAt || rightContact.archivedAt) {
      await db.mergeSuggestion.update({
        where: { id: suggestion.id },
        data: { status: "STALE", reviewedAt: new Date() },
      });
      continue;
    }

    const details = getSignalDetails(leftContact, rightContact);

    if (details.signals.length === 0) {
      // No longer looks like a duplicate.
      await db.mergeSuggestion.update({
        where: { id: suggestion.id },
        data: { status: "STALE", reviewedAt: new Date() },
      });
      continue;
    }

    const edgeCaseWarnings = getEdgeCaseWarnings(
      { ...leftContact, notes: null, archivedAt: null },
      { ...rightContact, notes: null, archivedAt: null },
    );

    await db.mergeSuggestion.update({
      where: { id: suggestion.id },
      data: {
        confidence: toConfidenceEnum(
          deriveConfidence(details.score, details.hardMatch, edgeCaseWarnings.length > 0),
        ),
        score: details.score,
        hardMatch: details.hardMatch,
        signals: details.contributions,
        reasons: [...details.reasons, ...edgeCaseWarnings],
        source: "stale-regenerated",
        generatedAt: new Date(),
      },
    });
  }
};

export const getOpenMergeSuggestionsForUser = async (userId: string) => {
  // Keep the open queue fresh: any suggestion whose contacts changed since it
  // was generated is recomputed (or retired) before we read (P10-08).
  await regenerateStaleSuggestionsForUser(userId);

  const suggestions = await db.mergeSuggestion.findMany({
    where: {
      userId,
      status: "OPEN",
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: 8,
    select: {
      id: true,
      status: true,
      confidence: true,
      score: true,
      hardMatch: true,
      source: true,
      generatedAt: true,
      reviewedAt: true,
      reasons: true,
      signals: true,
      leftContact: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          company: true,
          updatedAt: true,
        },
      },
      rightContact: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          company: true,
          updatedAt: true,
        },
      },
    },
  });

  return suggestions.map((suggestion) => {
    const contributions = parseContributions(suggestion.signals);
    return {
      id: suggestion.id,
      status: suggestion.status,
      confidence: suggestion.confidence.toLowerCase() as MergeSuggestionConfidence,
      score: suggestion.score,
      hardMatch: suggestion.hardMatch,
      source: suggestion.source,
      generatedAt: suggestion.generatedAt,
      reviewedAt: suggestion.reviewedAt,
      reasons: Array.isArray(suggestion.reasons) ? (suggestion.reasons as string[]) : [],
      signals: contributions.map((contribution) => contribution.signal),
      contributions,
      leftContact: suggestion.leftContact,
      rightContact: suggestion.rightContact,
    };
  }) satisfies PersistedMergeSuggestion[];
};

// Full field selection for the field-level merge review (P10-05): include the
// rich JSON fields so buildMergedContactPreview can show real "keep both" unions.
const mergeReviewContactSelect = {
  id: true,
  fullName: true,
  firstName: true,
  middleName: true,
  lastName: true,
  namePrefix: true,
  nameSuffix: true,
  nickname: true,
  email: true,
  emailAddresses: true,
  emailEntries: true,
  phone: true,
  phoneNumbers: true,
  phoneEntries: true,
  company: true,
  jobTitle: true,
  website: true,
  websiteEntries: true,
  birthday: true,
  address: true,
  postalAddresses: true,
  addressEntries: true,
  avatarUrl: true,
  isFavorite: true,
  labels: true,
  significantDates: true,
  relatedPeople: true,
  customFields: true,
  notes: true,
  archivedAt: true,
  importJobId: true,
  updatedAt: true,
} satisfies Prisma.ContactSelect;

export const getMergeSuggestionByIdForUser = async (userId: string, suggestionId: string) => {
  const suggestion = await db.mergeSuggestion.findFirst({
    where: {
      id: suggestionId,
      userId,
      status: "OPEN",
    },
    select: {
      id: true,
      status: true,
      confidence: true,
      score: true,
      hardMatch: true,
      source: true,
      generatedAt: true,
      reviewedAt: true,
      reasons: true,
      signals: true,
      leftContact: {
        select: mergeReviewContactSelect,
      },
      rightContact: {
        select: mergeReviewContactSelect,
      },
    },
  });

  if (!suggestion) {
    return null;
  }

  const contributions = parseContributions(suggestion.signals);
  return {
    id: suggestion.id,
    status: suggestion.status,
    confidence: suggestion.confidence.toLowerCase() as MergeSuggestionConfidence,
    score: suggestion.score,
    hardMatch: suggestion.hardMatch,
    source: suggestion.source,
    generatedAt: suggestion.generatedAt,
    reviewedAt: suggestion.reviewedAt,
    reasons: Array.isArray(suggestion.reasons) ? (suggestion.reasons as string[]) : [],
    signals: contributions.map((contribution) => contribution.signal),
    contributions,
    leftContact: suggestion.leftContact,
    rightContact: suggestion.rightContact,
  };
};

export const mergeContactsForUser = async ({
  userId,
  primaryContactId,
  secondaryContactId,
  suggestionId,
  source,
  fieldChoices,
}: {
  userId: string;
  primaryContactId: string;
  secondaryContactId: string;
  suggestionId?: string;
  source: string;
  fieldChoices?: MergeFieldChoices;
}) => {
  if (primaryContactId === secondaryContactId) {
    throw new Error("Choose two different contacts before merging.");
  }

  return db.$transaction(async (tx) => {
    const contacts = await tx.contact.findMany({
      where: {
        userId,
        archivedAt: null,
        id: {
          in: [primaryContactId, secondaryContactId],
        },
      },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        middleName: true,
        lastName: true,
        namePrefix: true,
        nameSuffix: true,
        nickname: true,
        email: true,
        emailAddresses: true,
        emailEntries: true,
        phone: true,
        phoneNumbers: true,
        phoneEntries: true,
        company: true,
        jobTitle: true,
        website: true,
        websiteEntries: true,
        birthday: true,
        address: true,
        postalAddresses: true,
        addressEntries: true,
        avatarUrl: true,
        isFavorite: true,
        labels: true,
        significantDates: true,
        relatedPeople: true,
        customFields: true,
        notes: true,
        archivedAt: true,
        syncTombstoneAt: true,
        mergedIntoContactId: true,
        importJobId: true,
        updatedAt: true,
      },
    });

    if (contacts.length !== 2) {
      throw new Error("Both contacts must exist and be active to merge.");
    }

    const primaryContact = contacts.find((contact) => contact.id === primaryContactId);
    const secondaryContact = contacts.find((contact) => contact.id === secondaryContactId);

    if (!primaryContact || !secondaryContact) {
      throw new Error("Could not resolve the selected merge pair.");
    }

    const preview = buildMergedContactPreview(primaryContact, secondaryContact, fieldChoices);
    const signalDetails = getSignalDetails(primaryContact, secondaryContact);
    const reviewedAt = new Date();
    const pairKey = buildPairKey(primaryContactId, secondaryContactId);

    let persistedSuggestionId = suggestionId;

    if (suggestionId) {
      const existingSuggestion = await tx.mergeSuggestion.findFirst({
        where: {
          id: suggestionId,
          userId,
        },
        select: {
          id: true,
        },
      });

      if (!existingSuggestion) {
        throw new Error("Merge suggestion not found for this account.");
      }
    } else {
      const existingSuggestion = await tx.mergeSuggestion.findUnique({
        where: {
          userId_pairKey: {
            userId,
            pairKey,
          },
        },
        select: {
          id: true,
        },
      });

      if (existingSuggestion) {
        persistedSuggestionId = existingSuggestion.id;
      } else {
        const createdSuggestion = await tx.mergeSuggestion.create({
          data: {
            userId,
            leftContactId: primaryContactId,
            rightContactId: secondaryContactId,
            pairKey,
            status: "MERGED",
            confidence: toConfidenceEnum(
              deriveConfidence(signalDetails.score, signalDetails.hardMatch, false),
            ),
            score: signalDetails.score,
            hardMatch: signalDetails.hardMatch,
            signals: signalDetails.contributions,
            reasons:
              signalDetails.reasons.length > 0
                ? signalDetails.reasons
                : ["Manual merge created without a heuristic match."],
            source,
            generatedAt: reviewedAt,
            reviewedAt,
          },
          select: {
            id: true,
          },
        });

        persistedSuggestionId = createdSuggestion.id;
      }
    }

    await tx.contact.update({
      where: {
        id: primaryContact.id,
      },
      data: {
        fullName: preview.mergedContact.fullName,
        firstName: preview.mergedContact.firstName,
        middleName: preview.mergedContact.middleName,
        lastName: preview.mergedContact.lastName,
        namePrefix: preview.mergedContact.namePrefix,
        nameSuffix: preview.mergedContact.nameSuffix,
        email: preview.mergedContact.email,
        emailAddresses: toNullableJsonField(preview.mergedContact.emailAddresses),
        emailEntries: toNullableJsonField(preview.mergedContact.emailEntries),
        phone: preview.mergedContact.phone,
        phoneNumbers: toNullableJsonField(preview.mergedContact.phoneNumbers),
        phoneEntries: toNullableJsonField(preview.mergedContact.phoneEntries),
        company: preview.mergedContact.company,
        nickname: preview.mergedContact.nickname,
        jobTitle: preview.mergedContact.jobTitle,
        website: preview.mergedContact.website,
        websiteEntries: toNullableJsonField(preview.mergedContact.websiteEntries),
        birthday: preview.mergedContact.birthday,
        address: preview.mergedContact.address,
        postalAddresses: toNullableJsonField(preview.mergedContact.postalAddresses),
        addressEntries: toNullableJsonField(preview.mergedContact.addressEntries),
        avatarUrl: preview.mergedContact.avatarUrl,
        isFavorite: preview.mergedContact.isFavorite,
        labels: toNullableJsonField(preview.mergedContact.labels),
        significantDates: toNullableJsonField(preview.mergedContact.significantDates),
        relatedPeople: toNullableJsonField(preview.mergedContact.relatedPeople),
        customFields: toNullableJsonField(preview.mergedContact.customFields),
        notes: preview.mergedContact.notes,
        lastMutatedBy: "MANUAL",
        lastMutatedByDetail: null,
        syncVersion: {
          increment: 1,
        },
      },
    });

    await tx.contact.update({
      where: {
        id: secondaryContact.id,
      },
      data: {
        archivedAt: reviewedAt,
        syncTombstoneAt: reviewedAt,
        mergedIntoContactId: primaryContact.id,
        lastMutatedBy: "MANUAL",
        lastMutatedByDetail: null,
        syncVersion: {
          increment: 1,
        },
      },
    });

    await emitEvent(tx, {
      userId,
      contactId: primaryContact.id,
      eventType: "CONTACT_MERGED",
      actor: "USER",
      payload: {
        absorbedContactId: secondaryContact.id,
        absorbedContactName: secondaryContact.fullName ?? "",
        fieldResolutions: [],
      },
    });
    await emitEvent(tx, {
      userId,
      contactId: secondaryContact.id,
      eventType: "CONTACT_ARCHIVED",
      actor: "SYSTEM",
      actorDetail: "merged",
      payload: {},
    });

    let acceptedDecisionId: string | undefined;

    if (persistedSuggestionId) {
      await tx.mergeSuggestion.update({
        where: {
          id: persistedSuggestionId,
        },
        data: {
          status: "MERGED",
          reviewedAt,
        },
      });

      const decision = await tx.mergeDecision.create({
        data: {
          suggestionId: persistedSuggestionId,
          userId,
          status: "ACCEPTED",
          source,
          decidedAt: reviewedAt,
          details: {
            primaryBefore: {
              id: primaryContact.id,
              fullName: primaryContact.fullName,
              firstName: primaryContact.firstName ?? null,
              middleName: primaryContact.middleName ?? null,
              lastName: primaryContact.lastName ?? null,
              namePrefix: primaryContact.namePrefix ?? null,
              nameSuffix: primaryContact.nameSuffix ?? null,
              nickname: primaryContact.nickname ?? null,
              email: primaryContact.email,
              emailAddresses: parseContactStringArray(primaryContact.emailAddresses),
              emailEntries: parseObjectArray<{ label: string; value: string; isPrimary: boolean }>(
                primaryContact.emailEntries,
              ),
              phone: primaryContact.phone,
              phoneNumbers: parseContactStringArray(primaryContact.phoneNumbers),
              phoneEntries: parseObjectArray<{ label: string; value: string; isPrimary: boolean }>(
                primaryContact.phoneEntries,
              ),
              company: primaryContact.company,
              jobTitle: primaryContact.jobTitle ?? null,
              website: primaryContact.website ?? null,
              websiteEntries: parseObjectArray<{ label: string; value: string; isPrimary: boolean }>(
                primaryContact.websiteEntries,
              ),
              birthday: primaryContact.birthday ?? null,
              address: primaryContact.address ?? null,
              postalAddresses: parseContactPostalAddresses(primaryContact.postalAddresses),
              addressEntries: parseObjectArray<{
                label: string;
                formatted: string;
                isPrimary: boolean;
                countryOrRegion?: string;
                streetLine1?: string;
                streetLine2?: string;
                cityOrTown?: string;
                postcode?: string;
                poBox?: string;
              }>(primaryContact.addressEntries),
              avatarUrl: primaryContact.avatarUrl ?? null,
              isFavorite: primaryContact.isFavorite ?? false,
              labels: parseContactStringArray(primaryContact.labels),
              significantDates: parseObjectArray<{
                label: string;
                date: string;
                isPrimary: boolean;
              }>(primaryContact.significantDates),
              relatedPeople: parseObjectArray<{ relationship: string; name: string }>(
                primaryContact.relatedPeople,
              ),
              customFields: parseObjectArray<{ label: string; value: string }>(
                primaryContact.customFields,
              ),
              notes: primaryContact.notes,
              archivedAt: primaryContact.archivedAt?.toISOString() ?? null,
              syncTombstoneAt: primaryContact.syncTombstoneAt?.toISOString() ?? null,
              mergedIntoContactId: primaryContact.mergedIntoContactId ?? null,
            },
            secondaryBefore: {
              id: secondaryContact.id,
              fullName: secondaryContact.fullName,
              firstName: secondaryContact.firstName ?? null,
              middleName: secondaryContact.middleName ?? null,
              lastName: secondaryContact.lastName ?? null,
              namePrefix: secondaryContact.namePrefix ?? null,
              nameSuffix: secondaryContact.nameSuffix ?? null,
              nickname: secondaryContact.nickname ?? null,
              email: secondaryContact.email,
              emailAddresses: parseContactStringArray(secondaryContact.emailAddresses),
              emailEntries: parseObjectArray<{ label: string; value: string; isPrimary: boolean }>(
                secondaryContact.emailEntries,
              ),
              phone: secondaryContact.phone,
              phoneNumbers: parseContactStringArray(secondaryContact.phoneNumbers),
              phoneEntries: parseObjectArray<{ label: string; value: string; isPrimary: boolean }>(
                secondaryContact.phoneEntries,
              ),
              company: secondaryContact.company,
              jobTitle: secondaryContact.jobTitle ?? null,
              website: secondaryContact.website ?? null,
              websiteEntries: parseObjectArray<{
                label: string;
                value: string;
                isPrimary: boolean;
              }>(secondaryContact.websiteEntries),
              birthday: secondaryContact.birthday ?? null,
              address: secondaryContact.address ?? null,
              postalAddresses: parseContactPostalAddresses(secondaryContact.postalAddresses),
              addressEntries: parseObjectArray<{
                label: string;
                formatted: string;
                isPrimary: boolean;
                countryOrRegion?: string;
                streetLine1?: string;
                streetLine2?: string;
                cityOrTown?: string;
                postcode?: string;
                poBox?: string;
              }>(secondaryContact.addressEntries),
              avatarUrl: secondaryContact.avatarUrl ?? null,
              isFavorite: secondaryContact.isFavorite ?? false,
              labels: parseContactStringArray(secondaryContact.labels),
              significantDates: parseObjectArray<{
                label: string;
                date: string;
                isPrimary: boolean;
              }>(secondaryContact.significantDates),
              relatedPeople: parseObjectArray<{ relationship: string; name: string }>(
                secondaryContact.relatedPeople,
              ),
              customFields: parseObjectArray<{ label: string; value: string }>(
                secondaryContact.customFields,
              ),
              notes: secondaryContact.notes,
              archivedAt: secondaryContact.archivedAt?.toISOString() ?? null,
              syncTombstoneAt: secondaryContact.syncTombstoneAt?.toISOString() ?? null,
              mergedIntoContactId: secondaryContact.mergedIntoContactId ?? null,
            },
            mergedAfter: preview.mergedContact,
            fieldChoices: fieldChoices ?? preview.defaultChoices,
          } satisfies MergeDecisionSnapshot,
        },
        select: {
          id: true,
        },
      });

      acceptedDecisionId = decision.id;
    }

    await tx.mergeSuggestion.updateMany({
      where: {
        userId,
        status: "OPEN",
        OR: [
          { leftContactId: secondaryContact.id },
          { rightContactId: secondaryContact.id },
        ],
      },
      data: {
        status: "STALE",
        reviewedAt,
      },
    });

    return {
      survivingContactId: primaryContact.id,
      decisionId: acceptedDecisionId,
    };
  });
};

export const undoMergedContactsForUser = async ({
  userId,
  decisionId,
}: {
  userId: string;
  decisionId: string;
}) => {
  return db.$transaction(async (tx) => {
    const decision = await tx.mergeDecision.findFirst({
      where: {
        id: decisionId,
        userId,
        status: "ACCEPTED",
      },
      select: {
        id: true,
        suggestionId: true,
        reversedAt: true,
        details: true,
      },
    });

    if (!decision) {
      throw new Error("Merge decision not found.");
    }

    if (decision.reversedAt) {
      throw new Error("This merge has already been undone.");
    }

    const details = decision.details as MergeDecisionSnapshot | null;

    if (!details) {
      throw new Error("No merge snapshot is available for this decision.");
    }

    const reversedAt = new Date();

    await tx.contact.update({
      where: {
        id: details.primaryBefore.id,
      },
      data: {
        fullName: details.primaryBefore.fullName,
        firstName: details.primaryBefore.firstName,
        middleName: details.primaryBefore.middleName,
        lastName: details.primaryBefore.lastName,
        namePrefix: details.primaryBefore.namePrefix,
        nameSuffix: details.primaryBefore.nameSuffix,
        nickname: details.primaryBefore.nickname,
        email: details.primaryBefore.email,
        emailAddresses: toNullableJsonField(details.primaryBefore.emailAddresses),
        emailEntries: toNullableJsonField(details.primaryBefore.emailEntries),
        phone: details.primaryBefore.phone,
        phoneNumbers: toNullableJsonField(details.primaryBefore.phoneNumbers),
        phoneEntries: toNullableJsonField(details.primaryBefore.phoneEntries),
        company: details.primaryBefore.company,
        jobTitle: details.primaryBefore.jobTitle,
        website: details.primaryBefore.website,
        websiteEntries: toNullableJsonField(details.primaryBefore.websiteEntries),
        birthday: details.primaryBefore.birthday,
        address: details.primaryBefore.address,
        postalAddresses: toNullableJsonField(details.primaryBefore.postalAddresses),
        addressEntries: toNullableJsonField(details.primaryBefore.addressEntries),
        avatarUrl: details.primaryBefore.avatarUrl,
        isFavorite: details.primaryBefore.isFavorite,
        labels: toNullableJsonField(details.primaryBefore.labels),
        significantDates: toNullableJsonField(details.primaryBefore.significantDates),
        relatedPeople: toNullableJsonField(details.primaryBefore.relatedPeople),
        customFields: toNullableJsonField(details.primaryBefore.customFields),
        notes: details.primaryBefore.notes,
        archivedAt: details.primaryBefore.archivedAt
          ? new Date(details.primaryBefore.archivedAt)
          : null,
        syncTombstoneAt: details.primaryBefore.syncTombstoneAt
          ? new Date(details.primaryBefore.syncTombstoneAt)
          : null,
        mergedIntoContactId: details.primaryBefore.mergedIntoContactId,
        syncVersion: {
          increment: 1,
        },
      },
    });

    await tx.contact.update({
      where: {
        id: details.secondaryBefore.id,
      },
      data: {
        fullName: details.secondaryBefore.fullName,
        firstName: details.secondaryBefore.firstName,
        middleName: details.secondaryBefore.middleName,
        lastName: details.secondaryBefore.lastName,
        namePrefix: details.secondaryBefore.namePrefix,
        nameSuffix: details.secondaryBefore.nameSuffix,
        nickname: details.secondaryBefore.nickname,
        email: details.secondaryBefore.email,
        emailAddresses: toNullableJsonField(details.secondaryBefore.emailAddresses),
        emailEntries: toNullableJsonField(details.secondaryBefore.emailEntries),
        phone: details.secondaryBefore.phone,
        phoneNumbers: toNullableJsonField(details.secondaryBefore.phoneNumbers),
        phoneEntries: toNullableJsonField(details.secondaryBefore.phoneEntries),
        company: details.secondaryBefore.company,
        jobTitle: details.secondaryBefore.jobTitle,
        website: details.secondaryBefore.website,
        websiteEntries: toNullableJsonField(details.secondaryBefore.websiteEntries),
        birthday: details.secondaryBefore.birthday,
        address: details.secondaryBefore.address,
        postalAddresses: toNullableJsonField(details.secondaryBefore.postalAddresses),
        addressEntries: toNullableJsonField(details.secondaryBefore.addressEntries),
        avatarUrl: details.secondaryBefore.avatarUrl,
        isFavorite: details.secondaryBefore.isFavorite,
        labels: toNullableJsonField(details.secondaryBefore.labels),
        significantDates: toNullableJsonField(details.secondaryBefore.significantDates),
        relatedPeople: toNullableJsonField(details.secondaryBefore.relatedPeople),
        customFields: toNullableJsonField(details.secondaryBefore.customFields),
        notes: details.secondaryBefore.notes,
        archivedAt: details.secondaryBefore.archivedAt
          ? new Date(details.secondaryBefore.archivedAt)
          : null,
        syncTombstoneAt: details.secondaryBefore.syncTombstoneAt
          ? new Date(details.secondaryBefore.syncTombstoneAt)
          : null,
        mergedIntoContactId: details.secondaryBefore.mergedIntoContactId,
        syncVersion: {
          increment: 1,
        },
      },
    });

    await tx.mergeSuggestion.update({
      where: {
        id: decision.suggestionId,
      },
      data: {
        status: "OPEN",
        reviewedAt: null,
      },
    });

    await tx.mergeDecision.update({
      where: {
        id: decision.id,
      },
      data: {
        reversedAt,
        reversalSource: "manual-undo",
      },
    });

    await tx.mergeDecision.create({
      data: {
        suggestionId: decision.suggestionId,
        userId,
        status: "REVERSED",
        source: "manual-undo",
        decidedAt: reversedAt,
        details: {
          reversedDecisionId: decision.id,
        },
      },
    });

    await emitEvent(tx, {
      userId,
      contactId: details.primaryBefore.id,
      eventType: "CONTACT_MERGE_UNDONE",
      actor: "USER",
      payload: { restoredContactId: details.secondaryBefore.id },
    });
    await emitEvent(tx, {
      userId,
      contactId: details.secondaryBefore.id,
      eventType: "CONTACT_RESTORED",
      actor: "USER",
      payload: {},
    });

    return details.primaryBefore.id;
  });
};

export const dismissMergeSuggestionForUser = async (userId: string, suggestionId: string) => {
  const suggestion = await db.mergeSuggestion.findFirst({
    where: {
      id: suggestionId,
      userId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!suggestion) {
    throw new Error("Merge suggestion not found.");
  }

  if (suggestion.status !== "OPEN") {
    throw new Error("Only open merge suggestions can be dismissed.");
  }

  const reviewedAt = new Date();

  await db.mergeSuggestion.update({
    where: {
      id: suggestion.id,
    },
    data: {
      status: "DISMISSED",
      reviewedAt,
    },
  });

  await db.mergeDecision.create({
    data: {
      suggestionId: suggestion.id,
      userId,
      status: "REJECTED",
      source: "manual-dismiss",
      decidedAt: reviewedAt,
    },
  });
};
