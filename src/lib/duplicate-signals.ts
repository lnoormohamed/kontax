// Pure helpers for duplicate-detection signals (P10-08).
// Kept dependency-free and side-effect-free so they're easy to unit test.

const normalizeValue = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

export const normalizeName = (value: string | null | undefined) =>
  normalizeValue(value)
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
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 7) {
    return "";
  }
  // National numbers are typically ≤ 10 digits; keep the trailing 10 so an
  // included country code doesn't prevent a match with the local form.
  return digits.length > 10 ? digits.slice(-10) : digits;
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
