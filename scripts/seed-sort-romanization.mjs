/**
 * P46-01 follow-up — Seed the CharRomanization lookup table (character → Latin
 * romanization). Han characters get toneless pinyin from pinyin-pro's
 * dictionary; other scripts (Arabic, Cyrillic, Greek, Hebrew, Hangul, Kana,
 * Indic, Thai, …) are romanized per character with the transliteration
 * package. The workspace sort keys use the table to prefix a leading
 * character's romanization so un-phoneticised non-Latin names sort and bucket
 * under their romanized letter (李 → "li" → L, محمد → "m…" → M) instead of "#".
 *
 * Idempotent: createMany with skipDuplicates; safe to re-run. Must be run once
 * per environment (staging done; prod is a P47 cutover checklist item).
 * Usage: node scripts/seed-sort-romanization.mjs
 */
import { PrismaClient } from "../generated/prisma/index.js";
import { pinyin } from "pinyin-pro";
import { transliterate } from "transliteration";

const prisma = new PrismaClient();

// Han gets pinyin-pro (better readings than generic transliteration).
// CJK Unified Ideographs + Extension A; higher-plane extensions are
// vanishingly rare in personal names.
const HAN_RANGES = [
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
];

// Alphabetic/syllabic scripts romanized per character. A first-character
// romanization is enough to pick the bucket letter and a stable sort position;
// the rest of the name keeps its raw script (consistent between sort and
// header, same as the Han path).
const TRANSLIT_RANGES = [
  [0x0370, 0x03ff], // Greek
  [0x0400, 0x052f], // Cyrillic + supplement
  [0x0530, 0x058f], // Armenian
  [0x0590, 0x05ff], // Hebrew
  [0x0600, 0x06ff], // Arabic
  [0x0750, 0x077f], // Arabic supplement
  [0x0900, 0x0d7f], // Indic: Devanagari … Malayalam
  [0x0e00, 0x0e7f], // Thai
  [0x0e80, 0x0eff], // Lao
  [0x10a0, 0x10ff], // Georgian
  [0x1200, 0x137f], // Ethiopic
  [0x3040, 0x30ff], // Hiragana + Katakana
  [0xac00, 0xd7a3], // Hangul syllables
];

// Fold a romanization to lowercase ASCII letters; null when nothing usable
// remains (the char then stays out of the table and folds to "#" as before).
function foldRoman(value) {
  if (!value) return null;
  const folded = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ü/g, "u")
    .replace(/[^a-z]/g, "");
  return /^[a-z]/.test(folded) ? folded : null;
}

function buildRows() {
  const rows = [];

  for (const [start, end] of HAN_RANGES) {
    for (let cp = start; cp <= end; cp++) {
      const ch = String.fromCodePoint(cp);
      const py = pinyin(ch, { toneType: "none", type: "array" })[0];
      // pinyin-pro echoes the input char back when it has no reading.
      if (!py || py === ch) continue;
      const roman = foldRoman(py);
      if (roman) rows.push({ ch, roman });
    }
  }

  for (const [start, end] of TRANSLIT_RANGES) {
    for (let cp = start; cp <= end; cp++) {
      const ch = String.fromCodePoint(cp);
      const roman = foldRoman(transliterate(ch));
      if (roman) rows.push({ ch, roman });
    }
  }

  return rows;
}

async function main() {
  const rows = buildRows();
  console.log(`Derived ${rows.length} character romanizations.`);

  let inserted = 0;
  const BATCH = 2000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await prisma.charRomanization.createMany({
      data: rows.slice(i, i + BATCH),
      skipDuplicates: true,
    });
    inserted += res.count;
  }
  const total = await prisma.charRomanization.count();
  console.log(`✓ Inserted ${inserted} new rows (table now has ${total}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
