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

const toPhoneticValue = (value: string | null | undefined) => {
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

  return transliterated.length > 0 ? transliterated : undefined;
};

type PhoneticFieldInput = {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phoneticFirstName?: string | null;
  phoneticLastName?: string | null;
  phoneticCompany?: string | null;
};

export const applyAutoFilledPhoneticFields = (
  input: PhoneticFieldInput,
  autoFillEnabled: boolean,
) => {
  const phoneticFirstName = normalizeValue(input.phoneticFirstName) || undefined;
  const phoneticLastName = normalizeValue(input.phoneticLastName) || undefined;
  const phoneticCompany = normalizeValue(input.phoneticCompany) || undefined;

  if (!autoFillEnabled) {
    return {
      phoneticFirstName,
      phoneticLastName,
      phoneticCompany,
    };
  }

  return {
    phoneticFirstName: phoneticFirstName ?? toPhoneticValue(input.firstName),
    phoneticLastName: phoneticLastName ?? toPhoneticValue(input.lastName),
    phoneticCompany: phoneticCompany ?? toPhoneticValue(input.company),
  };
};
