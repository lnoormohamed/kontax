// P49A-09 — FROZEN COPY of the pre-P49A-09 O(n²) duplicate scorer
// (src/server/contact-merge.ts at a4781c5: getSignalDetails,
// getEdgeCaseWarnings, deriveConfidence, buildContactMergeSuggestions).
//
// Test-only oracle: tests/node/merge-suggestion-equivalence.test.ts runs this
// and the new blocked/precomputed engine on the same contacts and asserts the
// suggestion lists are identical. Do NOT "fix" or refactor this file — its
// whole value is that it is the old behaviour, verbatim. If the scoring rules
// change on purpose, change them here too, in the same commit.
import {
  emailDomain,
  getFamilyName as getFamilyNameKey,
  getGivenName as getGivenNameKey,
  getNameTokens as getNameTokensKey,
  levenshtein,
  normalizeName as normalizeNameKey,
  phoneticToken,
} from "../../src/lib/duplicate-signals";
import { comparableNameKey, hasNonLatinLetters } from "../../src/lib/name-romanization";
import {
  normalizePhoneCandidate,
  normalizePhoneExactKey,
  normalizePhoneLooseKey,
} from "../../src/lib/phone-normalization";
import type {
  MergeCandidateContact,
  MergeSuggestionConfidence,
  MergeSuggestionPreview,
  MergeSuggestionSignal,
  SignalContribution,
} from "../../src/server/contact-merge";

// P49A-09 touched these src/lib/duplicate-signals helpers (to accept
// precomputed inputs), so the oracle keeps its own verbatim pre-change copies
// rather than importing the new versions.
const normalizePhoneKey = (value: string | null | undefined) => {
  const exact = normalizePhoneExactKey(value);
  return exact ? exact.replace(/^\+/, "") : normalizePhoneLooseKey(value);
};

const phoneticNameKey = (value: string | null | undefined) => {
  const tokens = getNameTokensKey(value).map(phoneticToken).filter(Boolean);
  if (tokens.length === 0) {
    return "";
  }
  return [...tokens].sort().join(" ");
};

const nameTokensCompatible = (leftToken: string, rightToken: string) => {
  if (!leftToken || !rightToken) {
    return true;
  }
  if (leftToken === rightToken) {
    return true;
  }
  if (
    (leftToken.length === 1 || rightToken.length === 1) &&
    leftToken.startsWith(rightToken.charAt(0))
  ) {
    return true;
  }
  if (
    Math.min(leftToken.length, rightToken.length) >= 4 &&
    levenshtein(leftToken, rightToken, 1) <= 1
  ) {
    return true;
  }
  const leftPhonetic = phoneticToken(leftToken);
  return Boolean(leftPhonetic && leftPhonetic === phoneticToken(rightToken));
};

const givenNamesCompatible = (left: string | null | undefined, right: string | null | undefined) =>
  nameTokensCompatible(getGivenNameKey(left), getGivenNameKey(right));

const familyNamesCompatible = (left: string | null | undefined, right: string | null | undefined) =>
  nameTokensCompatible(getFamilyNameKey(left), getFamilyNameKey(right));

const givenInitialMatch = (left: string | null | undefined, right: string | null | undefined) => {
  const leftGiven = getGivenNameKey(left);
  const rightGiven = getGivenNameKey(right);
  if (!leftGiven || !rightGiven) {
    return false;
  }
  if (leftGiven === rightGiven) {
    return true;
  }
  const oneIsInitial = leftGiven.length === 1 || rightGiven.length === 1;
  return oneIsInitial && leftGiven.startsWith(rightGiven.charAt(0));
};

type MergeableContact = MergeCandidateContact & {
  notes: string | null;
  archivedAt: Date | null;
  importJobId?: string | null;
  sourceKind?: "manual" | "imported";
};

const normalizeValue = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

// Diacritics fold to their base letters (see ~/lib/duplicate-signals) so
// accented names normalize to comparable tokens instead of being mangled.
const normalizeName = (value: string) => normalizeNameKey(value);

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

// P46-20: cross-script comparison via romanization (陈志强 ≡ 陳志強 ≡
// "chen zhi qiang", Ольга ≡ "Olga"). Lossy, so it's a supporting signal
// only — never a hard match — and it's consulted only when at least one
// side has non-Latin letters; Latin-only pairs use the normal name signals.
const romanizedComparison = (
  leftFullName: string,
  rightFullName: string,
): "equal" | "fuzzy" | "none" => {
  if (!hasNonLatinLetters(leftFullName) && !hasNonLatinLetters(rightFullName)) {
    return "none";
  }
  const leftKey = comparableNameKey(leftFullName);
  const rightKey = comparableNameKey(rightFullName);
  if (!leftKey || !rightKey) {
    return "none";
  }
  if (leftKey === rightKey) {
    return "equal";
  }
  if (
    levenshtein(leftKey, rightKey, 2) <= 2 &&
    givenNamesCompatible(leftKey, rightKey) &&
    familyNamesCompatible(leftKey, rightKey)
  ) {
    return "fuzzy";
  }
  return "none";
};

// Names "genuinely differ" only beyond spelling variance: not equal, not within
// fuzzy edit distance, not phonetically equivalent, and not the same name
// written in two scripts. "Katherine"/"Catherine" is a variant, not a conflict.
const namesGenuinelyDiffer = (leftFullName: string, rightFullName: string) => {
  const leftName = normalizeName(leftFullName);
  const rightName = normalizeName(rightFullName);
  if (!leftName || !rightName || leftName === rightName) {
    return false;
  }
  if (
    levenshtein(leftName, rightName, 2) <= 2 &&
    givenNamesCompatible(leftFullName, rightFullName) &&
    familyNamesCompatible(leftFullName, rightFullName)
  ) {
    return false;
  }
  if (romanizedComparison(leftFullName, rightFullName) !== "none") {
    return false;
  }
  const leftPhonetic = phoneticNameKey(leftFullName);
  return !(leftPhonetic && leftPhonetic === phoneticNameKey(rightFullName));
};

const getEdgeCaseWarnings = (left: MergeableContact, right: MergeableContact) => {
  const warnings: string[] = [];
  const leftEmail = normalizeValue(left.email);
  const rightEmail = normalizeValue(right.email);
  const leftPhone = normalizePhoneKey(left.phone);
  const rightPhone = normalizePhoneKey(right.phone);
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
    !familyNamesCompatible(left.fullName, right.fullName) &&
    romanizedComparison(left.fullName, right.fullName) === "none"
  ) {
    warnings.push(
      "Shared email with different family names detected. This could be a household address or shared inbox, so review carefully before merging.",
    );
  }

  if (
    leftPhone &&
    rightPhone &&
    leftPhone === rightPhone &&
    namesGenuinelyDiffer(left.fullName, right.fullName)
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

  const leftBirthday = normalizeValue(left.birthday);
  const rightBirthday = normalizeValue(right.birthday);
  if (leftBirthday && rightBirthday && leftBirthday !== rightBirthday) {
    warnings.push(
      "The two records have different birthdays. That usually means two different people, so review carefully before merging.",
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
    namesGenuinelyDiffer(leftGivenName, rightGivenName) &&
    leftFamilyName &&
    rightFamilyName &&
    leftFamilyName === rightFamilyName &&
    ((leftEmail && leftEmail === rightEmail) || (leftPhone && leftPhone === rightPhone))
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
  const leftPhone = normalizePhoneCandidate(left.phone);
  const rightPhone = normalizePhoneCandidate(right.phone);
  const leftPhoneExact = leftPhone.exactKey;
  const rightPhoneExact = rightPhone.exactKey;
  const leftPhoneKey = normalizePhoneKey(left.phone);
  const rightPhoneKey = normalizePhoneKey(right.phone);
  const rawPhonesMatch = Boolean(
    normalizeValue(left.phone) && normalizeValue(left.phone) === normalizeValue(right.phone),
  );
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
  const nameDist = leftName && rightName ? levenshtein(leftName, rightName, 2) : 3;
  // Whole-name edit distance alone over-matches short names ("Thảo Nguyễn" is
  // 2 edits from "Hải Nguyễn", "Priya Khan" is 2 from "Priya Shah") — both the
  // given names and the family names must also be plausible variants.
  const fuzzyName =
    !exactName &&
    nameDist <= 2 &&
    givenNamesCompatible(left.fullName, right.fullName) &&
    familyNamesCompatible(left.fullName, right.fullName);

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
    getFamilyNameKey(left.fullName) &&
    getFamilyNameKey(left.fullName) === getFamilyNameKey(right.fullName) &&
    givenInitialMatch(left.fullName, right.fullName)
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
    const romanized = romanizedComparison(left.fullName, right.fullName);
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
    const leftPhonetic = phoneticNameKey(left.fullName);
    const rightPhonetic = phoneticNameKey(right.fullName);
    if (leftPhonetic && leftPhonetic === rightPhonetic) {
      add(
        "phonetic-name",
        `Names sound alike: ${left.fullName} ≈ ${right.fullName}`,
        sameCompany ? 40 : 25,
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

  // --- Conflicting evidence ------------------------------------------------------
  // A shared identifier is strong evidence, but two clearly different people
  // sharing a line (assistant, front desk, household number) is the classic
  // false positive. When the edge-case review warnings would fire, the score
  // must agree with them: conflicting names/companies subtract points instead
  // of leaving a contradictory 95 next to a "probably not a duplicate" warning.
  const hasPositiveSignal = contributions.some((contribution) => contribution.score > 0);

  if (hardMatch) {
    const surnameKeysMatch = Boolean(
      getFamilyNameKey(left.fullName) &&
        getFamilyNameKey(left.fullName) === getFamilyNameKey(right.fullName),
    );
    const namesConflict = namesGenuinelyDiffer(left.fullName, right.fullName);

    if (namesConflict && !surnameKeysMatch) {
      add(
        "conflicting-name",
        `Names don't match: ${left.fullName} vs ${right.fullName}`,
        -40,
      );
    } else if (namesConflict && !givenInitialMatch(left.fullName, right.fullName)) {
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
  const leftBirthday = normalizeValue(left.birthday);
  const rightBirthday = normalizeValue(right.birthday);
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
export const legacyBuildContactMergeSuggestions = (contacts: MergeCandidateContact[]) => {
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
      if (confidence === "low") {
        continue;
      }

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

  return suggestions.sort((left, right) => right.score - left.score).slice(0, 500);
};
