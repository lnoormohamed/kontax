import { Prisma } from "../../generated/prisma";
import {
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";
import { db } from "~/server/db";

type MergeCandidateContact = {
  id: string;
  fullName: string;
  nickname?: string | null;
  email: string | null;
  emailAddresses?: unknown;
  phone: string | null;
  phoneNumbers?: unknown;
  company: string | null;
  jobTitle?: string | null;
  website?: string | null;
  birthday?: string | null;
  address?: string | null;
  postalAddresses?: unknown;
  importJobId?: string | null;
  updatedAt: Date;
};

export type MergeSuggestionSignal =
  | "exact-email"
  | "exact-phone"
  | "name-and-company"
  | "name-and-missing-company";

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
    email: string | null;
    emailAddresses: string[] | null;
    phone: string | null;
    phoneNumbers: string[] | null;
    company: string | null;
    nickname: string | null;
    jobTitle: string | null;
    website: string | null;
    birthday: string | null;
    address: string | null;
    postalAddresses: Array<{ label: string; formatted: string }> | null;
    notes: string | null;
  };
  mergeNotes: string[];
};

type MergeDecisionSnapshot = {
  primaryBefore: {
    id: string;
    fullName: string;
    nickname: string | null;
    email: string | null;
    emailAddresses: string[] | null;
    phone: string | null;
    phoneNumbers: string[] | null;
    company: string | null;
    jobTitle: string | null;
    website: string | null;
    birthday: string | null;
    address: string | null;
    postalAddresses: Array<{ label: string; formatted: string }> | null;
    notes: string | null;
    archivedAt: string | null;
    syncTombstoneAt: string | null;
    mergedIntoContactId: string | null;
  };
  secondaryBefore: {
    id: string;
    fullName: string;
    nickname: string | null;
    email: string | null;
    emailAddresses: string[] | null;
    phone: string | null;
    phoneNumbers: string[] | null;
    company: string | null;
    jobTitle: string | null;
    website: string | null;
    birthday: string | null;
    address: string | null;
    postalAddresses: Array<{ label: string; formatted: string }> | null;
    notes: string | null;
    archivedAt: string | null;
    syncTombstoneAt: string | null;
    mergedIntoContactId: string | null;
  };
  mergedAfter: {
    fullName: string;
    nickname: string | null;
    email: string | null;
    emailAddresses: string[] | null;
    phone: string | null;
    phoneNumbers: string[] | null;
    company: string | null;
    jobTitle: string | null;
    website: string | null;
    birthday: string | null;
    address: string | null;
    postalAddresses: Array<{ label: string; formatted: string }> | null;
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
  value: string[] | Array<{ label: string; formatted: string }> | null | undefined,
) => value ?? Prisma.DbNull;

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
  const leftPhone = normalizePhone(left.phone);
  const rightPhone = normalizePhone(right.phone);
  const leftName = normalizeName(left.fullName);
  const rightName = normalizeName(right.fullName);
  const leftCompany = normalizeValue(left.company);
  const rightCompany = normalizeValue(right.company);

  const signals: MergeSuggestionSignal[] = [];
  const reasons: string[] = [];
  let score = 0;
  let hardMatch = false;

  if (leftEmail && rightEmail && leftEmail === rightEmail) {
    signals.push("exact-email");
    reasons.push(`Same email: ${left.email}`);
    score += 100;
    hardMatch = true;
  }

  if (leftPhone && rightPhone && leftPhone === rightPhone) {
    signals.push("exact-phone");
    reasons.push(`Same phone: ${left.phone}`);
    score += 95;
    hardMatch = true;
  }

  if (leftName && rightName && leftName === rightName) {
    if (leftCompany && rightCompany && leftCompany === rightCompany) {
      signals.push("name-and-company");
      reasons.push(`Same name and company: ${left.fullName} at ${left.company}`);
      score += 70;
    } else if (!leftCompany || !rightCompany) {
      signals.push("name-and-missing-company");
      reasons.push(`Same name with missing company context: ${left.fullName}`);
      score += 45;
    }
  }

  return {
    signals,
    reasons,
    score,
    hardMatch,
  };
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

      const { signals, reasons, score, hardMatch } = getSignalDetails(left, right);
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

      const confidence: MergeSuggestionConfidence =
        edgeCaseWarnings.length > 0 ? "medium" : hardMatch || score >= 90 ? "high" : "medium";

      suggestions.push({
        pairKey: buildPairKey(left.id, right.id),
        leftContact: left,
        rightContact: right,
        confidence,
        score,
        reasons: [...reasons, ...edgeCaseWarnings],
        signals,
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
    emailAddresses: parseStringArray(primaryContact.emailAddresses),
    phoneNumbers: parseStringArray(primaryContact.phoneNumbers),
    postalAddresses: parsePostalAddressArray(primaryContact.postalAddresses),
  };
  const normalizedSecondary = {
    ...secondaryContact,
    sourceKind: secondaryContact.sourceKind ?? getSourceKind(secondaryContact),
    emailAddresses: parseStringArray(secondaryContact.emailAddresses),
    phoneNumbers: parseStringArray(secondaryContact.phoneNumbers),
    postalAddresses: parsePostalAddressArray(secondaryContact.postalAddresses),
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
        confidence: suggestion.confidence.toUpperCase() as "HIGH" | "MEDIUM",
        score: suggestion.score,
        hardMatch: suggestion.hardMatch,
        signals: suggestion.signals,
        reasons: suggestion.reasons,
        source,
        generatedAt: new Date(),
      },
      update: {
        leftContactId: suggestion.leftContact.id,
        rightContactId: suggestion.rightContact.id,
        status: existing?.status === "DISMISSED" || existing?.status === "MERGED" ? existing.status : "OPEN",
        confidence: suggestion.confidence.toUpperCase() as "HIGH" | "MEDIUM",
        score: suggestion.score,
        hardMatch: suggestion.hardMatch,
        signals: suggestion.signals,
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

export const getOpenMergeSuggestionsForUser = async (userId: string) => {
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

  return suggestions.map((suggestion) => ({
    id: suggestion.id,
    status: suggestion.status,
    confidence: suggestion.confidence.toLowerCase() as MergeSuggestionConfidence,
    score: suggestion.score,
    hardMatch: suggestion.hardMatch,
    source: suggestion.source,
    generatedAt: suggestion.generatedAt,
    reviewedAt: suggestion.reviewedAt,
    reasons: Array.isArray(suggestion.reasons) ? (suggestion.reasons as string[]) : [],
    signals: Array.isArray(suggestion.signals)
      ? (suggestion.signals as MergeSuggestionSignal[])
      : [],
    leftContact: suggestion.leftContact,
    rightContact: suggestion.rightContact,
  })) satisfies PersistedMergeSuggestion[];
};

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
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          company: true,
          notes: true,
          archivedAt: true,
          importJobId: true,
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
          notes: true,
          archivedAt: true,
          importJobId: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!suggestion) {
    return null;
  }

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
    signals: Array.isArray(suggestion.signals)
      ? (suggestion.signals as MergeSuggestionSignal[])
      : [],
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
        nickname: true,
        email: true,
        emailAddresses: true,
        phone: true,
        phoneNumbers: true,
        company: true,
        jobTitle: true,
        website: true,
        birthday: true,
        address: true,
        postalAddresses: true,
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
            confidence:
              signalDetails.hardMatch || signalDetails.score >= 90
                ? "HIGH"
                : signalDetails.signals.length > 0
                  ? "MEDIUM"
                  : "LOW",
            score: signalDetails.score,
            hardMatch: signalDetails.hardMatch,
            signals: signalDetails.signals,
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
        email: preview.mergedContact.email,
        emailAddresses: toNullableJsonField(preview.mergedContact.emailAddresses),
        phone: preview.mergedContact.phone,
        phoneNumbers: toNullableJsonField(preview.mergedContact.phoneNumbers),
        company: preview.mergedContact.company,
        nickname: preview.mergedContact.nickname,
        jobTitle: preview.mergedContact.jobTitle,
        website: preview.mergedContact.website,
        birthday: preview.mergedContact.birthday,
        address: preview.mergedContact.address,
        postalAddresses: toNullableJsonField(preview.mergedContact.postalAddresses),
        notes: preview.mergedContact.notes,
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
        syncVersion: {
          increment: 1,
        },
      },
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
              nickname: primaryContact.nickname ?? null,
              email: primaryContact.email,
              emailAddresses: parseContactStringArray(primaryContact.emailAddresses),
              phone: primaryContact.phone,
              phoneNumbers: parseContactStringArray(primaryContact.phoneNumbers),
              company: primaryContact.company,
              jobTitle: primaryContact.jobTitle ?? null,
              website: primaryContact.website ?? null,
              birthday: primaryContact.birthday ?? null,
              address: primaryContact.address ?? null,
              postalAddresses: parseContactPostalAddresses(primaryContact.postalAddresses),
              notes: primaryContact.notes,
              archivedAt: primaryContact.archivedAt?.toISOString() ?? null,
              syncTombstoneAt: primaryContact.syncTombstoneAt?.toISOString() ?? null,
              mergedIntoContactId: primaryContact.mergedIntoContactId ?? null,
            },
            secondaryBefore: {
              id: secondaryContact.id,
              fullName: secondaryContact.fullName,
              nickname: secondaryContact.nickname ?? null,
              email: secondaryContact.email,
              emailAddresses: parseContactStringArray(secondaryContact.emailAddresses),
              phone: secondaryContact.phone,
              phoneNumbers: parseContactStringArray(secondaryContact.phoneNumbers),
              company: secondaryContact.company,
              jobTitle: secondaryContact.jobTitle ?? null,
              website: secondaryContact.website ?? null,
              birthday: secondaryContact.birthday ?? null,
              address: secondaryContact.address ?? null,
              postalAddresses: parseContactPostalAddresses(secondaryContact.postalAddresses),
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
        nickname: details.primaryBefore.nickname,
        email: details.primaryBefore.email,
        emailAddresses: toNullableJsonField(details.primaryBefore.emailAddresses),
        phone: details.primaryBefore.phone,
        phoneNumbers: toNullableJsonField(details.primaryBefore.phoneNumbers),
        company: details.primaryBefore.company,
        jobTitle: details.primaryBefore.jobTitle,
        website: details.primaryBefore.website,
        birthday: details.primaryBefore.birthday,
        address: details.primaryBefore.address,
        postalAddresses: toNullableJsonField(details.primaryBefore.postalAddresses),
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
        nickname: details.secondaryBefore.nickname,
        email: details.secondaryBefore.email,
        emailAddresses: toNullableJsonField(details.secondaryBefore.emailAddresses),
        phone: details.secondaryBefore.phone,
        phoneNumbers: toNullableJsonField(details.secondaryBefore.phoneNumbers),
        company: details.secondaryBefore.company,
        jobTitle: details.secondaryBefore.jobTitle,
        website: details.secondaryBefore.website,
        birthday: details.secondaryBefore.birthday,
        address: details.secondaryBefore.address,
        postalAddresses: toNullableJsonField(details.secondaryBefore.postalAddresses),
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
