import { Prisma } from "../../generated/prisma";
import { emitEvent } from "~/lib/activity";
import { propagateLiveShares } from "~/server/contact-shares";
import {
  emailDomain,
  givenTokensInitialMatch,
  levenshtein,
  nameTokensCompatible,
  normalizeName as normalizeNameKey,
  phoneKeyFromCandidate,
  phoneticKeyFromTokens,
  phoneticToken,
} from "~/lib/duplicate-signals";
import {
  comparableNameKey,
  hasNonLatinLetters,
} from "~/lib/name-romanization";
import {
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";
import { db } from "~/server/db";
import {
  choosePreferredPhoneChoice,
  mergePhoneEntries,
  mergePhoneValues,
  normalizePhoneCandidate,
} from "~/lib/phone-normalization";

export type MergeCandidateContact = {
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
  | "exact-name"
  | "fuzzy-name-company"
  | "fuzzy-name"
  | "name-and-company"
  | "name-and-company-proximity"
  | "name-and-missing-company"
  | "phonetic-name"
  | "email-domain-and-name"
  | "conflicting-name"
  | "conflicting-given-name"
  | "conflicting-company"
  | "conflicting-birthday"
  | "conflicting-identifiers"
  | "romanized-name"
  | "romanized-fuzzy-name";

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
  avatarUrl?: Extract<MergeFieldChoice, "primary" | "secondary">; // P44-05
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

export type SuggestionContact = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  notes: string | null;
  address: string | null;
  birthday: string | null;
  createdAt: Date;
  importJobId: string | null;
  updatedAt: Date;
};

// P36-DB05: a friendly provenance label + grouping for the merge survivor cards,
// so near-identical records can be told apart by where they came from.
const MERGE_SOURCE_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  IMPORT_CSV: "CSV import",
  SYNC_CARDDAV: "CardDAV",
  SYNC_GOOGLE: "Google",
  SYNC_MICROSOFT: "Outlook",
  SHARED_STATIC: "Shared",
  SHARED_LIVE: "Shared",
  API: "API",
  CARD_IMPORT: "Card",
};

const relativeShort = (d: Date): string => {
  const diff = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
};

export type SurvivorMeta = { source: string; book: string | null; labels: string[]; updated: string };

export const survivorMetaFor = (c: {
  sourceType: string;
  labels: unknown;
  updatedAt: Date;
  book: { name: string } | null;
}): SurvivorMeta => ({
  source: MERGE_SOURCE_LABEL[c.sourceType] ?? "Manual",
  book: c.book?.name ?? null,
  labels: Array.isArray(c.labels) ? c.labels.filter((l): l is string => typeof l === "string") : [],
  updated: relativeShort(c.updatedAt),
});

const SIGNAL_LABELS: Record<string, string> = {
  "exact-email": "Same email",
  "exact-phone": "Same phone",
  "normalized-phone": "Same phone",
  "exact-name": "Same name",
  "fuzzy-name-company": "Similar name",
  "fuzzy-name": "Similar name",
  "name-and-company": "Same company",
  "name-and-missing-company": "Same name",
  "name-and-company-proximity": "Similar name",
  "phonetic-name": "Similar name",
  "email-domain-and-name": "Similar name",
  "romanized-name": "Same name",
  "romanized-fuzzy-name": "Similar name",
};

const SIGNAL_PRIORITY = [
  "Same email",
  "Same phone",
  "Same name",
  "Similar name",
  "Same company",
];

export function deriveDisplaySignals(contributions: SignalContribution[]): string[] {
  const seen = new Set<string>();
  for (const c of contributions) {
    const label = SIGNAL_LABELS[c.signal];
    if (label) seen.add(label);
  }
  return SIGNAL_PRIORITY.filter((l) => seen.has(l)).slice(0, 3);
}

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
  displaySignals: string[];
  quickMergePreview: {
    survivorSide: "left" | "right";
    fieldChoices: Required<MergeFieldChoices>;
    mergedContact: Pick<
      MergePreview["mergedContact"],
      "fullName" | "email" | "phone" | "company" | "jobTitle" | "address" | "birthday" | "notes"
    >;
  };
  leftContact: SuggestionContact;
  rightContact: SuggestionContact;
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

// Diacritics fold to their base letters (see ~/lib/duplicate-signals) so
// accented names normalize to comparable tokens instead of being mangled.
const normalizeName = (value: string) => normalizeNameKey(value);

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

// Legacy-data guard: these fields are supposed to be strings, but old JSON
// blobs (imports, hand-edited exports) can hold anything. `String(unknown)`
// would stringify a stray object to the useless "[object Object]" instead of
// treating it as absent, so only a genuine string counts — anything else is
// "".
const asText = (value: unknown): string => (typeof value === "string" ? value : "");

const mergeDates = (
  primaryEntries: Array<{ label: string; date: string; isPrimary?: boolean }>,
  secondaryEntries: Array<{ label: string; date: string; isPrimary?: boolean }>,
) => {
  const seen = new Set<string>();
  const result: Array<{ label: string; date: string; isPrimary: boolean }> = [];

  for (const raw of [...primaryEntries, ...secondaryEntries]) {
    // Legacy imports stored significant dates as {label, value} instead of {label, date}.
    const entry = raw as unknown as Record<string, unknown>;
    const label = asText(entry.label).trim();
    const date = (asText(entry.date) || asText(entry.value)).trim();
    if (!label || !date) continue;
    const key = `${label.toLowerCase()}::${date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      label,
      date,
      isPrimary: result.length === 0 ? label.toLowerCase() === "birthday" : false,
    });
  }

  return result;
};

// Normalise a relatedPeople entry that may have been stored in the legacy
// {label, value} shape instead of the canonical {relationship, name} shape.
function normaliseRelatedPerson(
  raw: Record<string, unknown>,
): { relationship: string; name: string } {
  const relationship = (asText(raw.relationship) || asText(raw.label)).trim();
  const name = (asText(raw.name) || asText(raw.value)).trim();
  return { relationship, name };
}

const mergeRelatedPeople = (
  primaryEntries: Array<{ relationship: string; name: string }>,
  secondaryEntries: Array<{ relationship: string; name: string }>,
) => {
  const seen = new Set<string>();
  const result: Array<{ relationship: string; name: string }> = [];

  for (const raw of [...primaryEntries, ...secondaryEntries]) {
    const entry = normaliseRelatedPerson(raw);
    if (!entry.relationship || !entry.name) continue;
    const key = `${entry.relationship.toLowerCase()}::${entry.name.toLowerCase()}`;
    if (seen.has(key)) continue;
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

// ---------------------------------------------------------------------------
// P49A-09: per-contact features, computed ONCE per contact instead of once per
// pair. The old scorer re-folded names, re-parsed phones and re-romanized
// inside the O(n²) pair loop (~110 µs/pair: 58 s of blocking CPU for 1,000
// contacts). Every pair function below takes precomputed features and must
// stay semantically identical to the pre-P49A-09 scorer, which
// tests/node/_legacy-merge-suggestions.ts keeps as a frozen oracle.

type NameTokenParts = {
  given: string;
  family: string;
  givenPhonetic: string;
  familyPhonetic: string;
};

type NameFeatures = NameTokenParts & {
  /** normalizeName(fullName) */
  norm: string;
  /** phoneticNameKey(fullName) */
  phonetic: string;
  /** hasNonLatinLetters(fullName) */
  nonLatin: boolean;
  /** comparableNameKey(fullName) */
  comparable: string;
  // Lazily derived — only a few pairs ever need them.
  comparableParts?: NameTokenParts;
  givenNameFeatures?: NameFeatures;
};

type ContactFeatures = {
  contact: MergeCandidateContact;
  name: NameFeatures;
  email: string;
  emailDomain: string;
  publicEmailDomain: boolean;
  /** normalizeValue(phone) — the raw-format comparison */
  phone: string;
  phoneExact: string;
  /** normalizePhoneKey(phone) */
  phoneKey: string;
  company: string;
  birthday: string;
  sourceKind: "manual" | "imported";
};

const PUBLIC_EMAIL_DOMAIN = /^(gmail|yahoo|hotmail|outlook|icloud|aol|proton(mail)?)\./;

const tokenPartsOf = (tokens: string[]): NameTokenParts => {
  const given = tokens[0] ?? "";
  const family = tokens.at(-1) ?? "";
  return {
    given,
    family,
    givenPhonetic: phoneticToken(given),
    familyPhonetic: phoneticToken(family),
  };
};

const computeNameFeatures = (raw: string): NameFeatures => {
  const norm = normalizeName(raw);
  const tokens = norm.split(" ").filter(Boolean);
  return {
    ...tokenPartsOf(tokens),
    norm,
    phonetic: phoneticKeyFromTokens(tokens),
    nonLatin: hasNonLatinLetters(raw),
    comparable: comparableNameKey(raw),
  };
};

const comparablePartsOf = (features: NameFeatures) =>
  (features.comparableParts ??= tokenPartsOf(
    normalizeName(features.comparable).split(" ").filter(Boolean),
  ));

const givenNameFeaturesOf = (features: NameFeatures) =>
  (features.givenNameFeatures ??= computeNameFeatures(features.given));

const computeContactFeatures = (contact: MergeCandidateContact): ContactFeatures => {
  const phone = normalizePhoneCandidate(contact.phone);
  const domain = emailDomain(contact.email);
  const declaredSourceKind = (contact as { sourceKind?: "manual" | "imported" }).sourceKind;
  return {
    contact,
    name: computeNameFeatures(contact.fullName),
    email: normalizeValue(contact.email),
    emailDomain: domain,
    publicEmailDomain: PUBLIC_EMAIL_DOMAIN.test(`${domain}.`),
    phone: normalizeValue(contact.phone),
    phoneExact: phone.exactKey,
    phoneKey: phoneKeyFromCandidate(phone),
    company: normalizeValue(contact.company),
    birthday: normalizeValue(contact.birthday),
    sourceKind: declaredSourceKind ?? (contact.importJobId ? "imported" : "manual"),
  };
};

// givenNamesCompatible / familyNamesCompatible on precomputed tokens.
const givenPartsCompatible = (left: NameTokenParts, right: NameTokenParts) =>
  nameTokensCompatible(left.given, right.given, left.givenPhonetic, right.givenPhonetic);

const familyPartsCompatible = (left: NameTokenParts, right: NameTokenParts) =>
  nameTokensCompatible(left.family, right.family, left.familyPhonetic, right.familyPhonetic);

// P46-20: cross-script comparison via romanization (陈志强 ≡ 陳志強 ≡
// "chen zhi qiang", Ольга ≡ "Olga"). Lossy, so it's a supporting signal
// only — never a hard match — and it's consulted only when at least one
// side has non-Latin letters; Latin-only pairs use the normal name signals.
const romanizedComparison = (
  left: NameFeatures,
  right: NameFeatures,
): "equal" | "fuzzy" | "none" => {
  if (!left.nonLatin && !right.nonLatin) {
    return "none";
  }
  const leftKey = left.comparable;
  const rightKey = right.comparable;
  if (!leftKey || !rightKey) {
    return "none";
  }
  if (leftKey === rightKey) {
    return "equal";
  }
  if (levenshtein(leftKey, rightKey, 2) <= 2) {
    const leftParts = comparablePartsOf(left);
    const rightParts = comparablePartsOf(right);
    if (givenPartsCompatible(leftParts, rightParts) && familyPartsCompatible(leftParts, rightParts)) {
      return "fuzzy";
    }
  }
  return "none";
};

// Names "genuinely differ" only beyond spelling variance: not equal, not within
// fuzzy edit distance, not phonetically equivalent, and not the same name
// written in two scripts. "Katherine"/"Catherine" is a variant, not a conflict.
const namesGenuinelyDiffer = (left: NameFeatures, right: NameFeatures) => {
  if (!left.norm || !right.norm || left.norm === right.norm) {
    return false;
  }
  if (
    levenshtein(left.norm, right.norm, 2) <= 2 &&
    givenPartsCompatible(left, right) &&
    familyPartsCompatible(left, right)
  ) {
    return false;
  }
  if (romanizedComparison(left, right) !== "none") {
    return false;
  }
  return !(left.phonetic && left.phonetic === right.phonetic);
};

const edgeCaseWarningsFromFeatures = (left: ContactFeatures, right: ContactFeatures) => {
  const warnings: string[] = [];
  const leftName = left.name;
  const rightName = right.name;

  if (
    left.email &&
    right.email &&
    left.email === right.email &&
    leftName.family &&
    rightName.family &&
    !familyPartsCompatible(leftName, rightName) &&
    romanizedComparison(leftName, rightName) === "none"
  ) {
    warnings.push(
      "Shared email with different family names detected. This could be a household address or shared inbox, so review carefully before merging.",
    );
  }

  const samePhoneKey = Boolean(left.phoneKey && right.phoneKey && left.phoneKey === right.phoneKey);

  if (samePhoneKey && namesGenuinelyDiffer(leftName, rightName)) {
    warnings.push(
      "Shared phone with different names detected. This could be an assistant line, family number, or front-desk number rather than a true duplicate.",
    );
  }

  if (samePhoneKey && left.company && right.company && left.company !== right.company) {
    warnings.push(
      "The same phone number appears across different companies. Treat this as review-first rather than an obvious duplicate.",
    );
  }

  if (left.birthday && right.birthday && left.birthday !== right.birthday) {
    warnings.push(
      "The two records have different birthdays. That usually means two different people, so review carefully before merging.",
    );
  }

  if (
    (left.sourceKind === "imported" || right.sourceKind === "imported") &&
    ((!left.contact.email && !left.contact.phone) || (!right.contact.email && !right.contact.phone))
  ) {
    warnings.push(
      "One side is a sparse imported record without a strong identifier. Imported sparse records should be merged cautiously.",
    );
  }

  if (
    leftName.given &&
    rightName.given &&
    leftName.family &&
    rightName.family &&
    leftName.family === rightName.family &&
    ((left.email && left.email === right.email) || (left.phoneKey && left.phoneKey === right.phoneKey)) &&
    namesGenuinelyDiffer(givenNameFeaturesOf(leftName), givenNameFeaturesOf(rightName))
  ) {
    warnings.push(
      "Names differ while surnames and identifiers overlap. This could be a nickname, transliteration, or different member of the same household.",
    );
  }

  return warnings;
};

const getEdgeCaseWarnings = (left: MergeableContact, right: MergeableContact) =>
  edgeCaseWarningsFromFeatures(computeContactFeatures(left), computeContactFeatures(right));

const signalDetailsFromFeatures = (leftFeatures: ContactFeatures, rightFeatures: ContactFeatures) => {
  const left = leftFeatures.contact;
  const right = rightFeatures.contact;
  const leftEmail = leftFeatures.email;
  const rightEmail = rightFeatures.email;
  const leftPhoneExact = leftFeatures.phoneExact;
  const rightPhoneExact = rightFeatures.phoneExact;
  const leftPhoneKey = leftFeatures.phoneKey;
  const rightPhoneKey = rightFeatures.phoneKey;
  const rawPhonesMatch = Boolean(leftFeatures.phone && leftFeatures.phone === rightFeatures.phone);
  const leftNameFeatures = leftFeatures.name;
  const rightNameFeatures = rightFeatures.name;
  const leftName = leftNameFeatures.norm;
  const rightName = rightNameFeatures.norm;
  const leftCompany = leftFeatures.company;
  const rightCompany = rightFeatures.company;
  const sameCompany = Boolean(leftCompany && rightCompany && leftCompany === rightCompany);
  const surnameKeysMatch = Boolean(
    leftNameFeatures.family && leftNameFeatures.family === rightNameFeatures.family,
  );

  const contributions: SignalContribution[] = [];
  let hardMatch = false;
  const add = (signal: MergeSuggestionSignal, label: string, points: number) => {
    contributions.push({ signal, label, score: points });
  };

  // --- Hard identifier matches -------------------------------------------------
  if (leftEmail && rightEmail && leftEmail === rightEmail) {
    add("exact-email", `Same email: ${left.email}`, 95);
    hardMatch = true;
  }

  if (leftPhoneExact && rightPhoneExact && leftPhoneExact === rightPhoneExact) {
    if (rawPhonesMatch) {
      add("exact-phone", `Same phone: ${left.phone}`, 95);
    } else {
      add("normalized-phone", `Same phone in a different format: ${left.phone} ≈ ${right.phone}`, 90);
    }
    hardMatch = true;
  } else if (leftPhoneKey && rightPhoneKey && leftPhoneKey === rightPhoneKey) {
    add("normalized-phone", `Same phone in a different format: ${left.phone} ≈ ${right.phone}`, 90);
    hardMatch = true;
  }

  // --- Name signals ------------------------------------------------------------
  const exactName = Boolean(leftName && rightName && leftName === rightName);
  // Whole-name edit distance alone over-matches short names ("Thảo Nguyễn" is
  // 2 edits from "Hải Nguyễn", "Priya Khan" is 2 from "Priya Shah") — both the
  // given names and the family names must also be plausible variants.
  const fuzzyName =
    !exactName &&
    Boolean(leftName && rightName) &&
    levenshtein(leftName, rightName, 2) <= 2 &&
    givenPartsCompatible(leftNameFeatures, rightNameFeatures) &&
    familyPartsCompatible(leftNameFeatures, rightNameFeatures);

  if (exactName) {
    add("exact-name", `Same full name: ${left.fullName}`, 80);
    if (sameCompany) {
      add("name-and-company", `Same name and company: ${left.fullName} at ${left.company}`, 60);
    } else if (!leftCompany || !rightCompany) {
      add("name-and-missing-company", `Same name with missing company context: ${left.fullName}`, 40);
    }
  } else if (fuzzyName) {
    if (sameCompany) {
      add("fuzzy-name-company", `Similar name at same company: ${left.fullName} ≈ ${right.fullName}`, 65);
    } else {
      add("fuzzy-name", `Similar name: ${left.fullName} ≈ ${right.fullName}`, 40);
    }
  } else if (
    sameCompany &&
    surnameKeysMatch &&
    givenTokensInitialMatch(leftNameFeatures.given, rightNameFeatures.given)
  ) {
    add(
      "name-and-company-proximity",
      `Likely same person at ${left.company}: ${left.fullName} ≈ ${right.fullName}`,
      60,
    );
  }

  // --- Cross-script name (supporting signal only — never a hard match) ---------
  // P46-20: the same person recorded in two scripts (陈志强 / 陳志強 /
  // "Chen Zhi Qiang") matches via romanized keys when the in-script
  // signals can't see it.
  if (!exactName && !fuzzyName) {
    const romanized = romanizedComparison(leftNameFeatures, rightNameFeatures);
    if (romanized === "equal") {
      add(
        "romanized-name",
        `Same name across scripts: ${left.fullName} ≈ ${right.fullName}`,
        70,
      );
    } else if (romanized === "fuzzy") {
      add(
        "romanized-fuzzy-name",
        `Similar name across scripts: ${left.fullName} ≈ ${right.fullName}`,
        40,
      );
    }
  }

  // --- Phonetic name (supporting signal only — never a hard match) -------------
  if (!exactName && !fuzzyName) {
    if (leftNameFeatures.phonetic && leftNameFeatures.phonetic === rightNameFeatures.phonetic) {
      add(
        "phonetic-name",
        `Names sound alike: ${left.fullName} ≈ ${right.fullName}`,
        sameCompany ? 40 : 25,
      );
    }
  }

  // --- Shared email domain + similar name (weak / LOW) -------------------------
  if (!(leftEmail && rightEmail && leftEmail === rightEmail)) {
    const leftDomain = leftFeatures.emailDomain;
    const commonDomain = leftDomain && leftDomain === rightFeatures.emailDomain;
    if (
      commonDomain &&
      !leftFeatures.publicEmailDomain &&
      (surnameKeysMatch ||
        givenTokensInitialMatch(leftNameFeatures.given, rightNameFeatures.given))
    ) {
      add("email-domain-and-name", `Same email domain and similar name: @${leftDomain}`, 15);
    }
  }

  // --- Conflicting evidence ------------------------------------------------------
  // A shared identifier is strong evidence, but two clearly different people
  // sharing a line (assistant, front desk, household number) is the classic
  // false positive. When the edge-case review warnings would fire, the score
  // must agree with them: conflicting names/companies subtract points instead
  // of leaving a contradictory 95 next to a "probably not a duplicate" warning.
  const hasPositiveSignal = contributions.some((contribution) => contribution.score > 0);

  if (hardMatch) {
    const namesConflict = namesGenuinelyDiffer(leftNameFeatures, rightNameFeatures);

    if (namesConflict && !surnameKeysMatch) {
      add(
        "conflicting-name",
        `Names don't match: ${left.fullName} vs ${right.fullName}`,
        -40,
      );
    } else if (
      namesConflict &&
      !givenTokensInitialMatch(leftNameFeatures.given, rightNameFeatures.given)
    ) {
      add(
        "conflicting-given-name",
        `Same surname but different first names: ${left.fullName} vs ${right.fullName}`,
        -20,
      );
    }
  }

  // Company conflict counts against name-based matches too — a "similar name"
  // at a different company is much weaker evidence than the same name signal
  // with no company context at all.
  if (hasPositiveSignal && leftCompany && rightCompany && !sameCompany) {
    add(
      "conflicting-company",
      `Different companies: ${left.company} vs ${right.company}`,
      -20,
    );
  }

  // When nothing hard matched and the names aren't exactly equal, two records
  // that each carry their own distinct email AND distinct phone look like two
  // separate identities, not one person recorded twice.
  if (
    hasPositiveSignal &&
    !hardMatch &&
    !exactName &&
    leftEmail &&
    rightEmail &&
    leftEmail !== rightEmail &&
    leftPhoneKey &&
    rightPhoneKey &&
    leftPhoneKey !== rightPhoneKey
  ) {
    add(
      "conflicting-identifiers",
      "Each record has its own distinct email and phone",
      -15,
    );
  }

  // Different recorded birthdays is near-decisive counter-evidence regardless
  // of what matched — the same person doesn't have two birthdays. Applies to
  // fuzzy/name-based matches too, not just hard identifier matches.
  const leftBirthday = leftFeatures.birthday;
  const rightBirthday = rightFeatures.birthday;
  if (hasPositiveSignal && leftBirthday && rightBirthday && leftBirthday !== rightBirthday) {
    add(
      "conflicting-birthday",
      `Different birthdays: ${left.birthday} vs ${right.birthday}`,
      -40,
    );
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

const getSignalDetails = (left: MergeCandidateContact, right: MergeCandidateContact) =>
  signalDetailsFromFeatures(computeContactFeatures(left), computeContactFeatures(right));

// Confidence tier from the total score. HIGH is reserved for hard identifier
// matches only; name/company evidence can still surface a pair for review, but
// should not be bulk-accepted as a one-click safe merge.
const deriveConfidence = (
  score: number,
  hardMatch: boolean,
  hasEdgeWarnings: boolean,
): MergeSuggestionConfidence => {
  if (!hasEdgeWarnings && hardMatch) {
    return "high";
  }
  if (score >= 50) {
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

// ---------------------------------------------------------------------------
// P49A-09 — candidate generation ("blocking").
//
// A pair is only ever suggested when deriveConfidence() is not "low", i.e. it
// is a hard match (same email, or same phone by exact or loose key) or its
// score reaches 50. Enumerating the positive signals, every such pair shares
// at least one of these keys:
//
//   e  normalised email                        → exact-email (hard)
//   x  phone exactKey / k  phone loose key     → exact/normalized-phone (hard)
//   n  normalised full name, and the romanized
//      comparable key                          → exact-name (80), romanized-name (70)
//   p  phonetic name key                       → any combination that includes
//                                                phonetic-name (25/40)
//   c  company + family name + given initial   → name-and-company-proximity (60)
//   fuzzy key, scoped to a company or to a
//      non-public email domain                 → fuzzy-name-company (65),
//                                                fuzzy-name (40) + email-domain (15),
//                                                romanized-fuzzy (40) + email-domain (15)
//
// Every other positive signal is < 50 on its own and no other combination
// reaches 50 (fuzzy-name excludes the romanized/phonetic/proximity branches;
// phonetic 25 + email-domain 15 = 40). Negative signals only lower a score.
//
// The fuzzy key must cover "edit distance ≤ 2" (levenshtein over UTF-16 code
// units) between the normalised names or the romanized keys, within a group:
//   - strings of length ≤ 10: the ≤2-deletion neighbourhood (two strings within
//     2 edits always share a string reachable by ≤2 deletions from each),
//     hashed to 30-bit ints — a collision only adds a candidate, never loses one;
//   - strings of length ≥ 9: pigeonhole segments (PassJoin): split into 3
//     parts; ≤2 edits leave one part intact in the other string, shifted by
//     at most 2 positions.
// Lengths within 2 edits differ by ≤ 2, so a pair whose shorter name is ≤ 8
// long has both lengths ≤ 10 (deletion scheme), and one whose shorter name is
// ≥ 9 has both ≥ 9 (segment scheme).
//
// The equivalence test (tests/node/merge-suggestion-equivalence.test.ts) runs
// this engine and a frozen copy of the old O(n²) scan side by side.

const MAX_MERGE_SUGGESTIONS = 500;
const DELETION_SCHEME_MAX_LENGTH = 10;
const SEGMENT_SCHEME_MIN_LENGTH = 9;
const FUZZY_EDIT_DISTANCE = 2;
const HASH_BASE = 0x01000193;
const HASH_MASK = 0x3fffffff; // keep Map keys in V8's small-integer range

type Block = number | number[];

const addToBlock = <K>(blocks: Map<K, Block>, key: K, index: number) => {
  const existing = blocks.get(key);
  if (existing === undefined) {
    blocks.set(key, index);
  } else if (typeof existing === "number") {
    if (existing !== index) {
      blocks.set(key, [existing, index]);
    }
  } else if (existing[existing.length - 1] !== index) {
    existing.push(index);
  }
};

// Hashes of every string reachable from `value` by at most two deletions,
// via a polynomial rolling hash (mod 2^32) so no substring is allocated.
const deletionNeighbourhoodHashes = (value: string, out: number[]) => {
  const length = value.length;
  const prefix = new Uint32Array(length + 1);
  const power = new Uint32Array(length + 1);
  power[0] = 1;
  for (let index = 0; index < length; index += 1) {
    prefix[index + 1] = (Math.imul(prefix[index]!, HASH_BASE) + value.charCodeAt(index)) >>> 0;
    power[index + 1] = Math.imul(power[index]!, HASH_BASE) >>> 0;
  }
  const range = (from: number, to: number) =>
    (prefix[to]! - Math.imul(prefix[from]!, power[to - from]!)) >>> 0;
  const concat = (head: number, tail: number, tailLength: number) =>
    (Math.imul(head, power[tailLength]!) + tail) >>> 0;

  out.push(prefix[length]!);
  for (let first = 0; first < length; first += 1) {
    const head = prefix[first]!;
    out.push(concat(head, range(first + 1, length), length - first - 1));
    for (let second = first + 1; second < length; second += 1) {
      const middle = concat(head, range(first + 1, second), second - first - 1);
      out.push(concat(middle, range(second + 1, length), length - second - 1));
    }
  }
};

// PassJoin partition: 3 contiguous segments, lengths differing by at most 1.
const segmentBounds = (length: number, segment: number) => {
  const base = Math.floor(length / 3);
  const longSegments = length % 3; // the last `longSegments` parts get +1
  const shortSegments = 3 - longSegments;
  const start =
    segment <= shortSegments
      ? segment * base
      : shortSegments * base + (segment - shortSegments) * (base + 1);
  const size = segment < shortSegments ? base : base + 1;
  return { start, size };
};

const segmentKey = (group: number, length: number, segment: number, text: string) =>
  `${group}\u0000${length}\u0000${segment}\u0000${text}`;

type FuzzyProbe = { groups: number[]; strings: string[] };

function* mergeSuggestionEngine(
  contacts: MergeCandidateContact[],
): Generator<undefined, MergeSuggestionPreview[], undefined> {
  const count = contacts.length;

  // 1. Features, once per contact.
  const features: Array<ContactFeatures | null> = new Array<ContactFeatures | null>(count).fill(null);
  for (let index = 0; index < count; index += 1) {
    const contact = contacts[index];
    if (contact) {
      features[index] = computeContactFeatures(contact);
    }
    yield;
  }

  // 2. Fuzzy-name groups (company, non-public email domain) with ≥ 2 members.
  const companyGroupOf = (feature: ContactFeatures) =>
    feature.company ? `c\u0000${feature.company}` : "";
  const domainGroupOf = (feature: ContactFeatures) =>
    feature.emailDomain && !feature.publicEmailDomain ? `d\u0000${feature.emailDomain}` : "";
  const groupSizes = new Map<string, number>();
  for (const feature of features) {
    if (!feature) continue;
    for (const group of [companyGroupOf(feature), domainGroupOf(feature)]) {
      if (group) groupSizes.set(group, (groupSizes.get(group) ?? 0) + 1);
    }
  }
  const groupIds = new Map<string, number>();
  for (const [group, size] of groupSizes) {
    if (size >= 2) groupIds.set(group, groupIds.size);
  }
  yield;

  // 3. Blocking index.
  const exactBlocks = new Map<string, Block>();
  const deletionBlocks = new Map<number, Block>();
  const segmentBlocks = new Map<string, Block>();
  const fuzzyProbes: Array<FuzzyProbe | null> = new Array<FuzzyProbe | null>(count).fill(null);
  const hashes: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const feature = features[index];
    if (!feature) {
      yield;
      continue;
    }
    const { name } = feature;
    if (feature.email) addToBlock(exactBlocks, `e\u0000${feature.email}`, index);
    if (feature.phoneExact) addToBlock(exactBlocks, `x\u0000${feature.phoneExact}`, index);
    if (feature.phoneKey) addToBlock(exactBlocks, `k\u0000${feature.phoneKey}`, index);
    if (name.norm) addToBlock(exactBlocks, `n\u0000${name.norm}`, index);
    if (name.comparable) addToBlock(exactBlocks, `n\u0000${name.comparable}`, index);
    if (name.phonetic) addToBlock(exactBlocks, `p\u0000${name.phonetic}`, index);
    if (feature.company && name.family && name.given) {
      addToBlock(
        exactBlocks,
        `c\u0000${feature.company}\u0000${name.family}\u0000${name.given.charAt(0)}`,
        index,
      );
    }

    const groups: number[] = [];
    for (const group of [companyGroupOf(feature), domainGroupOf(feature)]) {
      const id = group ? groupIds.get(group) : undefined;
      if (id !== undefined) groups.push(id);
    }
    const strings = [name.norm, name.comparable].filter(
      (value, position, all) => value && all.indexOf(value) === position,
    );
    if (groups.length > 0 && strings.length > 0) {
      fuzzyProbes[index] = { groups, strings };
      for (const value of strings) {
        if (value.length <= DELETION_SCHEME_MAX_LENGTH) {
          hashes.length = 0;
          deletionNeighbourhoodHashes(value, hashes);
          for (const group of groups) {
            const salt = Math.imul(group + 1, 0x9e3779b1);
            for (const hash of hashes) {
              addToBlock(deletionBlocks, ((hash ^ salt) >>> 0) & HASH_MASK, index);
            }
          }
        }
        if (value.length >= SEGMENT_SCHEME_MIN_LENGTH) {
          for (const group of groups) {
            for (let segment = 0; segment < 3; segment += 1) {
              const { start, size } = segmentBounds(value.length, segment);
              addToBlock(
                segmentBlocks,
                segmentKey(group, value.length, segment, value.slice(start, start + size)),
                index,
              );
            }
          }
        }
      }
    }
    yield;
  }

  // Each contact's multi-member blocks (singletons can't form a pair).
  const memberBlocks: Array<number[][] | null> = new Array<number[][] | null>(count).fill(null);
  let visited = 0;
  for (const blocks of [exactBlocks.values(), deletionBlocks.values()]) {
    for (const block of blocks) {
      if (typeof block !== "number") {
        for (const member of block) {
          (memberBlocks[member] ??= []).push(block);
        }
      }
      visited += 1;
      if ((visited & 1023) === 0) yield;
    }
  }
  yield;

  // 4. Score each candidate pair once, in the same (left, right) index order as
  //    the old full scan so the final stable sort is identical.
  const suggestions: MergeSuggestionPreview[] = [];
  const seenBy = new Int32Array(count).fill(-1);
  const partners: number[] = [];

  const collect = (index: number, other: number) => {
    if (other > index && seenBy[other] !== index) {
      seenBy[other] = index;
      partners.push(other);
    }
  };

  for (let index = 0; index < count; index += 1) {
    const left = features[index];
    if (!left) {
      yield;
      continue;
    }
    partners.length = 0;

    for (const block of memberBlocks[index] ?? []) {
      // Blocks list members in ascending index order.
      for (let position = block.length - 1; position >= 0; position -= 1) {
        const other = block[position]!;
        if (other <= index) break;
        collect(index, other);
      }
    }

    const probe = fuzzyProbes[index];
    if (probe) {
      for (const value of probe.strings) {
        if (value.length < SEGMENT_SCHEME_MIN_LENGTH) continue;
        for (
          let partnerLength = Math.max(SEGMENT_SCHEME_MIN_LENGTH, value.length - FUZZY_EDIT_DISTANCE);
          partnerLength <= value.length + FUZZY_EDIT_DISTANCE;
          partnerLength += 1
        ) {
          for (let segment = 0; segment < 3; segment += 1) {
            const { start, size } = segmentBounds(partnerLength, segment);
            for (let shift = -FUZZY_EDIT_DISTANCE; shift <= FUZZY_EDIT_DISTANCE; shift += 1) {
              const from = start + shift;
              if (from < 0 || from + size > value.length) continue;
              const text = value.slice(from, from + size);
              for (const group of probe.groups) {
                const block = segmentBlocks.get(segmentKey(group, partnerLength, segment, text));
                if (block === undefined) continue;
                if (typeof block === "number") {
                  collect(index, block);
                } else {
                  for (const other of block) collect(index, other);
                }
              }
            }
          }
        }
      }
    }

    partners.sort((a, b) => a - b);

    for (let position = 0; position < partners.length; position += 1) {
      const right = features[partners[position]!]!;
      const { signals, reasons, contributions, score, hardMatch } = signalDetailsFromFeatures(
        left,
        right,
      );
      if (signals.length > 0) {
        const edgeCaseWarnings = edgeCaseWarningsFromFeatures(left, right);
        const confidence = deriveConfidence(score, hardMatch, edgeCaseWarnings.length > 0);
        if (confidence !== "low") {
          suggestions.push({
            pairKey: buildPairKey(left.contact.id, right.contact.id),
            leftContact: left.contact,
            rightContact: right.contact,
            confidence,
            score,
            reasons: [...reasons, ...edgeCaseWarnings],
            signals,
            contributions,
            hardMatch,
          });
        }
      }
      if ((position & 63) === 63) yield;
    }
    yield;
  }

  return suggestions
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_MERGE_SUGGESTIONS);
}

/**
 * Synchronous driver — same result as the async one, but blocks until done.
 * Fine for tests and small inputs; request/sync paths use the async driver.
 */
export const buildContactMergeSuggestions = (contacts: MergeCandidateContact[]) => {
  const engine = mergeSuggestionEngine(contacts);
  let step = engine.next();
  while (!step.done) {
    step = engine.next();
  }
  return step.value;
};

export type MergeSuggestionBuildOptions = {
  /** Longest synchronous slice before yielding to the event loop (ms). */
  sliceBudgetMs?: number;
  /** Test hook: called with each synchronous slice's duration (ms). */
  onSlice?: (durationMs: number) => void;
};

const DEFAULT_SLICE_BUDGET_MS = 8;

const yieldToEventLoop = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * P49A-09: the scorer, run in short synchronous slices with a macrotask yield
 * between them, so a large address book never blocks the single Node process
 * that also serves web + CardDAV + sync.
 */
export const buildContactMergeSuggestionsAsync = async (
  contacts: MergeCandidateContact[],
  options: MergeSuggestionBuildOptions = {},
) => {
  const budget = options.sliceBudgetMs ?? DEFAULT_SLICE_BUDGET_MS;
  const engine = mergeSuggestionEngine(contacts);
  let sliceStart = performance.now();
  let step = engine.next();
  while (!step.done) {
    const now = performance.now();
    if (now - sliceStart >= budget) {
      options.onSlice?.(now - sliceStart);
      await yieldToEventLoop();
      sliceStart = performance.now();
    }
    step = engine.next();
  }
  options.onSlice?.(performance.now() - sliceStart);
  return step.value;
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
    phone: choosePreferredPhoneChoice({
      primaryValue: normalizedPrimary.phone,
      secondaryValue: normalizedSecondary.phone,
    }),
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
    avatarUrl: getDefaultFieldChoice({
      primaryValue: normalizedPrimary.avatarUrl,
      secondaryValue: normalizedSecondary.avatarUrl,
      primaryContact: normalizedPrimary,
      secondaryContact: normalizedSecondary,
    }) as "primary" | "secondary",
  };

  const resolvedChoices: Required<MergeFieldChoices> = {
    fullName: fieldChoices.fullName ?? defaultChoices.fullName,
    email: fieldChoices.email ?? defaultChoices.email,
    phone: fieldChoices.phone ?? defaultChoices.phone,
    company: fieldChoices.company ?? defaultChoices.company,
    notes: fieldChoices.notes ?? defaultChoices.notes,
    avatarUrl: fieldChoices.avatarUrl ?? defaultChoices.avatarUrl,
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
    })
      ? normalizePhoneCandidate(
          pickFieldValue({
            primaryValue: normalizedPrimary.phone,
            secondaryValue: normalizedSecondary.phone,
            choice: resolvedChoices.phone,
          }),
        ).value || null
      : null,
    phoneNumbers: mergePhoneValues(
      [normalizedPrimary.phone],
      normalizedPrimary.phoneNumbers,
      [normalizedSecondary.phone],
      normalizedSecondary.phoneNumbers,
    ),
    phoneEntries: mergePhoneEntries(
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
        choice: resolvedChoices.avatarUrl, // P44-05: honour the user's photo pick
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
      birthday: true,
      importJobId: true,
      updatedAt: true,
    },
  });

  // P49A-09: chunked — yields to the event loop between ~8 ms slices.
  const suggestions = await buildContactMergeSuggestionsAsync(contacts);
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
          birthday: true,
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
          birthday: true,
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

    const confidence = deriveConfidence(
      details.score,
      details.hardMatch,
      edgeCaseWarnings.length > 0,
    );

    await db.mergeSuggestion.update({
      where: { id: suggestion.id },
      data:
        confidence === "low"
          ? {
              status: "STALE",
              reviewedAt: new Date(),
              confidence: toConfidenceEnum(confidence),
              score: details.score,
              hardMatch: details.hardMatch,
              signals: details.contributions,
              reasons: [...details.reasons, ...edgeCaseWarnings],
              source: "stale-regenerated",
              generatedAt: new Date(),
            }
          : {
              confidence: toConfidenceEnum(confidence),
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

const suggestionContactSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  company: true,
  jobTitle: true,
  notes: true,
  address: true,
  birthday: true,
  createdAt: true,
  importJobId: true,
  updatedAt: true,
} as const;

export const getOpenMergeSuggestionsForUser = async (
  userId: string,
  options?: { take?: number },
) => {
  // Keep the read path fast for the duplicates queue. Stale/open suggestions are
  // refreshed via the explicit refresh endpoint and by background sync flows, so
  // we avoid blocking every page render on a full regeneration sweep.
  const take = Math.max(1, Math.min(options?.take ?? 120, 200));

  // Load dismissed pairs so we can exclude them after fetch.
  const dismissed = await db.mergeDismissal.findMany({
    where: { userId },
    select: { contactAId: true, contactBId: true },
  });
  const dismissedSet = new Set(dismissed.map((d) => `${d.contactAId}:${d.contactBId}`));

  const suggestions = await db.mergeSuggestion.findMany({
    where: {
      userId,
      status: "OPEN",
      confidence: {
        in: ["HIGH", "MEDIUM"],
      },
      // P48-05: never surface a suggestion whose contacts the user does not own.
      leftContact: { userId },
      rightContact: { userId },
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take,
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
      leftContact: { select: suggestionContactSelect },
      rightContact: { select: suggestionContactSelect },
    },
  });

  return suggestions
    .filter((s) => {
      const [aId, bId] = [s.leftContact.id, s.rightContact.id].sort() as [string, string];
      return !dismissedSet.has(`${aId}:${bId}`);
    })
    .map((suggestion) => {
      const leftIsPrimary = suggestion.leftContact.createdAt <= suggestion.rightContact.createdAt;
      const primaryContact = leftIsPrimary ? suggestion.leftContact : suggestion.rightContact;
      const secondaryContact = leftIsPrimary ? suggestion.rightContact : suggestion.leftContact;
      const quickMergePreview = buildMergedContactPreview(
        {
          ...primaryContact,
          fullName: primaryContact.fullName ?? "",
          archivedAt: null,
        },
        {
          ...secondaryContact,
          fullName: secondaryContact.fullName ?? "",
          archivedAt: null,
        },
      );
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
        signals: contributions.map((c) => c.signal),
        contributions,
        displaySignals: deriveDisplaySignals(contributions),
        quickMergePreview: {
          survivorSide: leftIsPrimary ? "left" : "right",
          fieldChoices: quickMergePreview.defaultChoices,
          mergedContact: {
            fullName: quickMergePreview.mergedContact.fullName,
            email: quickMergePreview.mergedContact.email,
            phone: quickMergePreview.mergedContact.phone,
            company: quickMergePreview.mergedContact.company,
            jobTitle: quickMergePreview.mergedContact.jobTitle,
            address: quickMergePreview.mergedContact.address,
            birthday: quickMergePreview.mergedContact.birthday,
            notes: quickMergePreview.mergedContact.notes,
          },
        },
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
  sourceType: true,
  sourceDetail: true,
  book: { select: { name: true } },
} satisfies Prisma.ContactSelect;

export const getMergeSuggestionByIdForUser = async (userId: string, suggestionId: string) => {
  const suggestion = await db.mergeSuggestion.findFirst({
    where: {
      id: suggestionId,
      userId,
      status: "OPEN",
      // P48-05: never surface a suggestion whose contacts the user does not own.
      leftContact: { userId },
      rightContact: { userId },
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

  const mergeResult = await db.$transaction(async (tx) => {
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

    // P12-08: the survivor inherits the absorbed contact's active shares (so live
    // recipients keep their link, pointed at the merged record).
    await tx.contactShare.updateMany({
      where: { contactId: secondaryContact.id, status: "ACTIVE" },
      data: { contactId: primaryContact.id },
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

  // P12-08: after the merge commits, push the merged record to any live
  // recipients (incl. shares just inherited from the absorbed contact).
  await propagateLiveShares(userId, mergeResult.survivingContactId);

  return mergeResult;
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
