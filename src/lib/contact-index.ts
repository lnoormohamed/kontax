// P46-01 — Alphabet index derivation.
//
// One function turns a contact's primary sort key into its index letter, so the
// scrubber rail, the list's letter section headers, and the sort collation all
// derive from the SAME key (P46-DB01, "bucket = sort = header"). Jump to L and
// you land on 李 because 李 also *sorts* among the L names.
//
// The input is `sortName` — the server's primary ordering key for the row
// (contacts-workspace.ts NAME_ORDER): `phoneticLastName ?? lastName`, else
// company / full name, already lowercased and trimmed. Because the phonetic
// field is preferred there, a CJK name the contact form has auto-filled a
// reading for (李 → "Li") arrives here as "li" and buckets under L. Names with
// no phonetic reading that start with a non-Latin character get a romanization
// prefix at the SQL layer (SORT_KEY_COLUMNS + the seeded CharRomanization
// table — Han via pinyin, Arabic/Cyrillic/Greek/Hebrew/Hangul/Kana/Indic/…
// via transliteration): 李晨 arrives as "li李晨" and محمد as "mmhmdمحمد", so
// each sorts among its romanized letter's names and folds to that letter below
// because the first glyph is already Latin. Unmapped scripts, digits, and
// symbols still fold to `#`, consistent with where the list orders them.

// Latin letters whose accents do NOT decompose under Unicode NFD, so a plain
// combining-mark strip leaves them non-ASCII. Mapped to the base letter they
// sort nearest, matching the P38-07 collator's intent (Øystein → O).
const STROKE_FOLD: Record<string, string> = {
  ø: "o",
  æ: "a",
  œ: "o",
  đ: "d",
  ð: "d",
  ł: "l",
  ħ: "h",
  ŧ: "t",
  þ: "t",
  ß: "s",
  ı: "i",
};

/**
 * Fold a name key to its A–Z index letter, or `#` for numbers, symbols, and
 * scripts with no Latin mapping.
 *
 * `sortName` is expected pre-lowercased (as the server ships it); we lowercase
 * again defensively so the function is safe to call on any string.
 */
export function bucketLetter(sortName: string | null | undefined): string {
  const source = (sortName ?? "").trim().toLowerCase();
  if (!source) return "#";

  // NFD splits "é" into "e" + combining acute; drop the combining marks. Then
  // apply the stroke fold for the letters NFD can't reach.
  const folded = source
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[øæœđðłħŧþßı]/g, (ch) => STROKE_FOLD[ch] ?? ch);

  // Skip leading punctuation/quotes (e.g. "'t Hooft") to the first real glyph.
  const first = folded.replace(/^[^\p{L}\p{N}]+/u, "")[0] ?? "";
  return /[a-z]/.test(first) ? first.toUpperCase() : "#";
}

/**
 * Order index letters for the rail and section headers: A–Z first, then the
 * "#" bucket (numbers, symbols, unmapped scripts) LAST — the phone-book
 * convention (iOS-style), matching the P46-DB01 design where the rail ends on
 * `#`. The list's group order and the rail derive from this, so `#` contacts
 * appear at the bottom of the list too, not the top.
 */
export function compareBucketLetters(a: string, b: string): number {
  const rank = (letter: string) => (letter === "#" ? 1 : 0);
  return rank(a) - rank(b) || a.localeCompare(b);
}
