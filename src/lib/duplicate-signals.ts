// Pure helpers for duplicate-detection signals (P10-08).
// Kept dependency-free and side-effect-free so they're easy to unit test.

import { normalizePhoneExactKey, normalizePhoneLooseKey } from "./phone-normalization";

/**
 * Wagner-Fischer Levenshtein distance, capped at maxDist to short-circuit
 * early for large strings that obviously exceed the threshold.
 */
export function levenshtein(a: string, b: string, maxDist = 3): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]!;
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const temp = dp[i]!;
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i]!, dp[i - 1]!);
      prev = temp;
    }
  }
  return dp[a.length]!;
}

const normalizeValue = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

// Fold accented letters to their base form ("Thảo" → "thao", "Nguyễn" →
// "nguyen") instead of stripping them: dropping non-ASCII letters mangles
// names ("thảo" → "th o") and corrupts every token-based signal downstream.
export const normalizeName = (value: string | null | undefined) =>
  normalizeValue(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const getNameTokens = (value: string | null | undefined) =>
  normalizeName(value).split(" ").filter(Boolean);

export const getGivenName = (value: string | null | undefined) => getNameTokens(value)[0] ?? "";
export const getFamilyName = (value: string | null | undefined) => getNameTokens(value).at(-1) ?? "";

/**
 * Phone match key. Strips all non-digits, drops a leading international "00"
 * or "+" prefix, and keys on the last 10 significant digits so the same number
 * collapses across formats and country-code/trunk-zero differences:
 *   "+44 7700 900111", "07700 900111", "447700900111" → all share "7700900111".
 * Returns "" for anything too short to be a real phone number.
 */
export const normalizePhoneKey = (value: string | null | undefined) => {
  const exact = normalizePhoneExactKey(value);
  return exact ? exact.replace(/^\+/, "") : normalizePhoneLooseKey(value);
};

/**
 * The domain part of an email address, lowercased. "" when absent/malformed.
 */
export const emailDomain = (value: string | null | undefined) => {
  const email = normalizeValue(value);
  const at = email.lastIndexOf("@");
  return at > 0 && at < email.length - 1 ? email.slice(at + 1) : "";
};

const SOUNDEX_CODES: Record<string, string> = {
  b: "1", f: "1", p: "1", v: "1",
  c: "2", g: "2", j: "2", k: "2", q: "2", s: "2", x: "2", z: "2",
  d: "3", t: "3",
  l: "4",
  m: "5", n: "5",
  r: "6",
};

/**
 * Phonetic key for a single name token. A Soundex variant with light sound
 * folding *before* coding so equivalents that differ only in spelling collide,
 * including the first letter — e.g. "Catherine"/"Katherine" (C→K) and
 * "Jon"/"John" both produce the same key. Returns "" for non-alpha input.
 *
 * This is a deliberately *supporting* signal: it groups plausible variants but
 * is never treated as a hard identifier match.
 */
export const phoneticToken = (value: string) => {
  let s = value
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!s) {
    return "";
  }

  // Silent leading clusters.
  s = s.replace(/^(kn|gn|pn|wr|ps)/, (m) => m.slice(1));
  // Sound folding so spelling variants share a first letter / code.
  s = s
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/sch/g, "sk")
    .replace(/x/g, "ks")
    .replace(/q/g, "k")
    .replace(/z/g, "s")
    // "c" → "s" before e/i/y, otherwise → "k"
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k");

  const first = s[0]!;
  let prev = SOUNDEX_CODES[first] ?? "";
  let key = first.toUpperCase();

  for (let i = 1; i < s.length && key.length < 4; i += 1) {
    const ch = s[i]!;
    const code = SOUNDEX_CODES[ch] ?? "";
    if (code && code !== prev) {
      key += code;
    }
    // h and w don't separate equal codes; vowels do.
    if (ch !== "h" && ch !== "w") {
      prev = code;
    }
  }

  return (key + "000").slice(0, 4);
};

/**
 * Phonetic key for a full name: per-token phonetic codes joined, sorted so word
 * order doesn't matter ("John Smith" vs "Smith John"). "" when empty.
 */
export const phoneticNameKey = (value: string | null | undefined) => {
  const tokens = getNameTokens(value).map(phoneticToken).filter(Boolean);
  if (tokens.length === 0) {
    return "";
  }
  return [...tokens].sort().join(" ");
};

/**
 * True when two name tokens could plausibly be spellings of the same name:
 * equal, initial-vs-full, a one-edit variant, or phonetically equivalent.
 */
const nameTokensCompatible = (leftToken: string, rightToken: string) => {
  if (!leftToken || !rightToken) {
    return true;
  }
  if (leftToken === rightToken) {
    return true;
  }
  if (
    (leftToken.length === 1 || rightToken.length === 1) &&
    leftToken.charAt(0) === rightToken.charAt(0)
  ) {
    return true;
  }
  if (levenshtein(leftToken, rightToken, 1) <= 1) {
    return true;
  }
  const leftPhonetic = phoneticToken(leftToken);
  return Boolean(leftPhonetic && leftPhonetic === phoneticToken(rightToken));
};

/**
 * Whole-name edit distance alone is too permissive for short names — "Thảo"
 * vs "Hải" and "Khan" vs "Shah" are each 2 edits but are different people —
 * so fuzzy name matching must pass this per-token gate: both the given names
 * and the family names must be plausible variants of each other.
 */
export const givenNamesCompatible = (left: string | null | undefined, right: string | null | undefined) =>
  nameTokensCompatible(getGivenName(left), getGivenName(right));

export const familyNamesCompatible = (left: string | null | undefined, right: string | null | undefined) =>
  nameTokensCompatible(getFamilyName(left), getFamilyName(right));

/**
 * True when two names look like the same person referenced with an initial,
 * e.g. "J. Smith" ~ "John Smith": same family name and the given names share a
 * first initial (one may be just the initial).
 */
export const givenInitialMatch = (left: string | null | undefined, right: string | null | undefined) => {
  const leftGiven = getGivenName(left);
  const rightGiven = getGivenName(right);
  if (!leftGiven || !rightGiven) {
    return false;
  }
  if (leftGiven === rightGiven) {
    return true;
  }
  // One side is an initial (single letter) sharing the other's first letter.
  const oneIsInitial = leftGiven.length === 1 || rightGiven.length === 1;
  return oneIsInitial && leftGiven.startsWith(rightGiven.charAt(0));
};
