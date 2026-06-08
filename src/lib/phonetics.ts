import { pinyin } from "pinyin-pro";
import { transliterate } from "transliteration";

const normalizeValue = (value: string | null | undefined) => value?.trim() ?? "";

const containsNonAscii = (value: string) => /[^\u0000-\u007f]/.test(value);
const containsHanScript = (value: string) => /\p{Script=Han}/u.test(value);

const toTitleCaseWords = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

export const toPhoneticValue = (value: string | null | undefined) => {
  const normalized = normalizeValue(value);

  if (!normalized || !containsNonAscii(normalized)) {
    return undefined;
  }

  if (containsHanScript(normalized)) {
    const pinyinValue = pinyin(normalized, {
      toneType: "none",
      type: "array",
    }).join(" ");
    const titleCasedPinyin = toTitleCaseWords(pinyinValue);

    return titleCasedPinyin.length > 0 ? titleCasedPinyin : undefined;
  }

  const transliterated = transliterate(normalized)
    .replace(/\s+/g, " ")
    .trim();

  if (transliterated.length === 0) {
    return undefined;
  }

  return toTitleCaseWords(transliterated);
};

export const normalizePhoneticValue = (value: string | null | undefined) =>
  normalizeValue(value) || undefined;
