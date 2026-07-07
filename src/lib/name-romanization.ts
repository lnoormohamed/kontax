// P46-20 — Cross-script name romanization for duplicate detection.
//
// Turns a personal name in any script into a folded Latin key so the same
// person recorded in two scripts can be compared: 陈志强 and 陳志強 both
// romanize to "chen zhi qiang" (pinyin unifies simplified and traditional),
// Ольга → "olga", タナカ → "tanaka". This is a SUPPORTING signal for the
// merge scorer — romanization is lossy, so it must never be treated as a
// hard identifier match, and callers only consult it when at least one side
// contains non-Latin letters.
//
// Both dependencies are already used by scripts/seed-sort-romanization.mjs
// (P46-01 sort keys); here they run as pure functions with no DB table.

import { pinyin } from "pinyin-pro";
import { transliterate } from "transliteration";

import { normalizeName } from "./duplicate-signals";

const HAN = /\p{Script=Han}/u;
const NON_LATIN_LETTER = /(?![\p{Script=Latin}])\p{L}/u;

export const hasNonLatinLetters = (value: string | null | undefined) =>
  Boolean(value && NON_LATIN_LETTER.test(value));

const foldLatin = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const romanizeToken = (token: string): string => {
  if (!NON_LATIN_LETTER.test(token)) {
    return token;
  }
  if (HAN.test(token)) {
    // pinyin-pro reads both simplified and traditional characters; one
    // syllable per character, tones dropped.
    return pinyin(token, { toneType: "none", type: "array", nonZh: "consecutive" }).join(" ");
  }
  return transliterate(token);
};

// The scorer compares every pair (O(n²)) but each distinct name only needs
// romanizing once (O(n)). Bounded so a pathological dataset can't grow it
// unboundedly.
const CACHE_MAX = 10_000;
const cache = new Map<string, string>();

/**
 * Folded Latin key for a name containing non-Latin letters; "" for names
 * that are already Latin-only (compare those with normalizeName instead)
 * or that produce nothing usable.
 */
export const romanizedNameKey = (value: string | null | undefined): string => {
  const name = normalizeName(value);
  if (!name || !NON_LATIN_LETTER.test(name)) {
    return "";
  }
  const cached = cache.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const key = foldLatin(name.split(" ").map(romanizeToken).join(" "));
  if (cache.size >= CACHE_MAX) {
    cache.clear();
  }
  cache.set(name, key);
  return key;
};

/**
 * Latin-comparison form of a name: the romanized key when the name has
 * non-Latin letters, otherwise its normalized form. Lets one code path
 * compare 李娜 with "Li Na".
 */
export const comparableNameKey = (value: string | null | undefined): string => {
  const romanized = romanizedNameKey(value);
  return romanized || normalizeName(value);
};
