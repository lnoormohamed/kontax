import {
  findPhoneCountryRuleByExactCallingCode,
  findPhoneCountryRuleByCallingCode,
  getPhoneCountryRule,
} from "./phone-country-rules";
import { normalizePhoneCandidate } from "./phone-normalization";

export type ParsedPhoneInputState = {
  iso2: string | null;
  value: string;
};

export const parsePhoneCountryInputValue = (
  value: string,
): ParsedPhoneInputState => {
  const raw = value.trim();
  if (!raw) {
    return { iso2: null, value: "" };
  }

  const candidate = normalizePhoneCandidate(raw);
  const iso2 = candidate.countryCode ?? null;
  const normalizedValue = candidate.displayInternational ?? candidate.value ?? raw;

  if (raw.startsWith("+")) {
    const match = /^\+(\d{1,4})/.exec(raw);
    const rule = match?.[1]
      ? findPhoneCountryRuleByCallingCode(match[1])?.rule ??
        findPhoneCountryRuleByExactCallingCode(match[1])
      : null;
    return {
      iso2: iso2 ?? rule?.iso2 ?? null,
      value: normalizedValue,
    };
  }

  return {
    iso2,
    value: normalizedValue,
  };
};

export const replacePhoneCallingCode = (
  currentValue: string,
  nextCallingCode: string,
) => {
  const parsedCurrent = parsePhoneCountryInputValue(currentValue);
  const normalizedCurrent = normalizePhoneCandidate(parsedCurrent.value);
  const existingRule = parsedCurrent.iso2
    ? getPhoneCountryRule(parsedCurrent.iso2)
    : null;

  let localNumber = "";
  if (normalizedCurrent.displayNational) {
    localNumber = normalizedCurrent.displayNational;
  } else if (existingRule) {
    const prefix = `+${existingRule.callingCode}`;
    localNumber = parsedCurrent.value.startsWith(prefix)
      ? parsedCurrent.value.slice(prefix.length).trim()
      : parsedCurrent.value.trim();
  } else if (parsedCurrent.value.startsWith("+")) {
    localNumber = parsedCurrent.value.replace(/^\+\d{1,4}\s*/, "").trim();
  } else {
    localNumber = parsedCurrent.value.trim();
  }

  return localNumber ? `+${nextCallingCode} ${localNumber}` : `+${nextCallingCode}`;
};
