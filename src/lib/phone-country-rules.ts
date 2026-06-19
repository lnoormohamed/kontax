export type PhoneNumberType = "mobile" | "landline" | "unknown";

type PhoneGrouping = {
  internationalDefault?: number[];
  internationalMobile?: number[];
  internationalLandline?: number[];
  nationalDefault?: number[];
  nationalMobile?: number[];
  nationalLandline?: number[];
};

export type PhoneCountryRule = {
  iso2: string;
  displayName: string;
  callingCode: string;
  trunkPrefix?: string;
  allowLocalNationalInput?: boolean;
  nationalLengths: number[];
  mobilePrefixes?: string[];
  landlinePrefixes?: string[];
  labels?: {
    mobile?: string;
    landline?: string;
  };
  examples?: {
    mobile?: string;
    landline?: string;
  };
  grouping?: PhoneGrouping;
};

const PHONE_COUNTRY_RULE_LIST: PhoneCountryRule[] = [
  {
    iso2: "AU",
    displayName: "Australia",
    callingCode: "61",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["4"],
    landlinePrefixes: ["2", "3", "7", "8"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+61 410 000 083",
      landline: "+61 2 9000 1234",
    },
    grouping: {
      internationalMobile: [3, 3, 3],
      internationalLandline: [1, 4, 4],
      nationalMobile: [3, 3, 3],
      nationalLandline: [1, 4, 4],
    },
  },
  {
    iso2: "NZ",
    displayName: "New Zealand",
    callingCode: "64",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [8, 9],
    mobilePrefixes: ["2"],
    landlinePrefixes: ["3", "4", "6", "7", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+64 21 123 4567",
      landline: "+64 9 700 1234",
    },
    grouping: {
      internationalMobile: [2, 3, 4],
      internationalLandline: [1, 3, 4],
      nationalMobile: [2, 3, 4],
      nationalLandline: [1, 3, 4],
    },
  },
  {
    iso2: "GB",
    displayName: "United Kingdom",
    callingCode: "44",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [10],
    mobilePrefixes: ["7"],
    landlinePrefixes: ["1", "2"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+44 7700 900111",
      landline: "+44 1323 410051",
    },
    grouping: {
      internationalDefault: [4, 6],
      nationalDefault: [4, 6],
    },
  },
  {
    iso2: "US",
    displayName: "United States",
    callingCode: "1",
    allowLocalNationalInput: true,
    nationalLengths: [10],
    labels: { mobile: "Phone", landline: "Phone" },
    examples: {
      mobile: "+1 415 555 2671",
      landline: "+1 212 555 0100",
    },
    grouping: {
      internationalDefault: [3, 3, 4],
      nationalDefault: [3, 3, 4],
    },
  },
  {
    iso2: "CA",
    displayName: "Canada",
    callingCode: "1",
    allowLocalNationalInput: true,
    nationalLengths: [10],
    labels: { mobile: "Phone", landline: "Phone" },
    examples: {
      mobile: "+1 647 555 0100",
      landline: "+1 416 555 0100",
    },
    grouping: {
      internationalDefault: [3, 3, 4],
      nationalDefault: [3, 3, 4],
    },
  },
  {
    iso2: "FJ",
    displayName: "Fiji",
    callingCode: "679",
    allowLocalNationalInput: false,
    nationalLengths: [7],
    mobilePrefixes: ["2", "7", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+679 701 2345",
      landline: "+679 330 1234",
    },
    grouping: {
      internationalDefault: [3, 4],
      nationalDefault: [3, 4],
    },
  },
  {
    iso2: "PG",
    displayName: "Papua New Guinea",
    callingCode: "675",
    allowLocalNationalInput: false,
    nationalLengths: [7, 8],
    mobilePrefixes: ["7", "8"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+675 7123 4567",
      landline: "+675 320 1234",
    },
    grouping: {
      internationalDefault: [4, 4],
      nationalDefault: [4, 4],
    },
  },
  {
    iso2: "SB",
    displayName: "Solomon Islands",
    callingCode: "677",
    allowLocalNationalInput: false,
    nationalLengths: [5, 7],
    mobilePrefixes: ["7"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+677 742 1234",
      landline: "+677 21234",
    },
    grouping: {
      internationalDefault: [3, 4],
      nationalDefault: [3, 4],
    },
  },
  {
    iso2: "VU",
    displayName: "Vanuatu",
    callingCode: "678",
    allowLocalNationalInput: false,
    nationalLengths: [5, 7],
    mobilePrefixes: ["5", "7"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+678 591 2345",
      landline: "+678 22123",
    },
    grouping: {
      internationalDefault: [3, 4],
      nationalDefault: [3, 4],
    },
  },
  {
    iso2: "WS",
    displayName: "Samoa",
    callingCode: "685",
    allowLocalNationalInput: false,
    nationalLengths: [5, 6, 7, 10],
    mobilePrefixes: ["7", "83", "84", "85", "86", "87", "89"],
    landlinePrefixes: ["2", "3", "4", "5", "6"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+685 721 2345",
      landline: "+685 22123",
    },
    grouping: {
      internationalDefault: [3, 4],
      nationalDefault: [3, 4],
    },
  },
  {
    iso2: "TO",
    displayName: "Tonga",
    callingCode: "676",
    allowLocalNationalInput: false,
    nationalLengths: [5, 7],
    mobilePrefixes: ["7", "8"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+676 771 2345",
      landline: "+676 20123",
    },
    grouping: {
      internationalDefault: [3, 4],
      nationalDefault: [3, 4],
    },
  },
  {
    iso2: "KI",
    displayName: "Kiribati",
    callingCode: "686",
    allowLocalNationalInput: false,
    nationalLengths: [5, 8],
    mobilePrefixes: ["7", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+686 730 1234",
      landline: "+686 21000",
    },
    grouping: {
      internationalDefault: [4, 4],
      nationalDefault: [4, 4],
    },
  },
  {
    iso2: "TV",
    displayName: "Tuvalu",
    callingCode: "688",
    allowLocalNationalInput: false,
    nationalLengths: [5, 6],
    mobilePrefixes: ["9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+688 901234",
      landline: "+688 20123",
    },
    grouping: {
      internationalDefault: [3, 3],
      nationalDefault: [3, 3],
    },
  },
  {
    iso2: "NR",
    displayName: "Nauru",
    callingCode: "674",
    allowLocalNationalInput: false,
    nationalLengths: [4, 7],
    mobilePrefixes: ["55", "56", "57", "58"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+674 555 1234",
      landline: "+674 4444",
    },
    grouping: {
      internationalDefault: [3, 4],
      nationalDefault: [3, 4],
    },
  },
];

const PHONE_COUNTRY_RULES = new Map(
  PHONE_COUNTRY_RULE_LIST.map((rule) => [rule.iso2, rule] as const),
);

const CALLING_CODE_RULES = [...PHONE_COUNTRY_RULE_LIST]
  .sort((left, right) => right.callingCode.length - left.callingCode.length);

const applyGrouping = (digits: string, grouping: number[] | undefined) => {
  if (!grouping || grouping.length === 0) {
    return digits;
  }

  const total = grouping.reduce((sum, size) => sum + size, 0);
  if (total !== digits.length) {
    return digits;
  }

  let offset = 0;
  return grouping
    .map((size) => {
      const part = digits.slice(offset, offset + size);
      offset += size;
      return part;
    })
    .filter(Boolean)
    .join(" ");
};

const getGrouping = (
  rule: PhoneCountryRule,
  numberType: PhoneNumberType,
  scope: "international" | "national",
) => {
  const groups = rule.grouping;
  if (!groups) {
    return undefined;
  }

  if (scope === "international") {
    if (numberType === "mobile") {
      return groups.internationalMobile ?? groups.internationalDefault;
    }
    if (numberType === "landline") {
      return groups.internationalLandline ?? groups.internationalDefault;
    }
    return groups.internationalDefault;
  }

  if (numberType === "mobile") {
    return groups.nationalMobile ?? groups.nationalDefault;
  }
  if (numberType === "landline") {
    return groups.nationalLandline ?? groups.nationalDefault;
  }
  return groups.nationalDefault;
};

const startsWithAny = (value: string, prefixes: string[] | undefined) =>
  Boolean(prefixes?.some((prefix) => value.startsWith(prefix)));

const matchesRuleNationalNumber = (rule: PhoneCountryRule, nationalDigits: string) => {
  if (!rule.nationalLengths.includes(nationalDigits.length)) {
    return false;
  }

  if (startsWithAny(nationalDigits, rule.mobilePrefixes)) {
    return true;
  }

  if (startsWithAny(nationalDigits, rule.landlinePrefixes)) {
    return true;
  }

  return !rule.mobilePrefixes?.length && !rule.landlinePrefixes?.length;
};

const stripTrunkPrefix = (digits: string, rule: PhoneCountryRule) => {
  if (rule.trunkPrefix && digits.startsWith(rule.trunkPrefix)) {
    return digits.slice(rule.trunkPrefix.length);
  }
  return digits;
};

export const getPhoneCountryRule = (iso2: string) => PHONE_COUNTRY_RULES.get(iso2) ?? null;

export const inferPhoneNumberType = (
  nationalDigits: string,
  rule: PhoneCountryRule | null | undefined,
): PhoneNumberType => {
  if (!rule || !nationalDigits) {
    return "unknown";
  }

  if (startsWithAny(nationalDigits, rule.mobilePrefixes)) {
    return "mobile";
  }

  if (startsWithAny(nationalDigits, rule.landlinePrefixes)) {
    return "landline";
  }

  return "unknown";
};

export const getPhoneNumberTypeLabel = (
  rule: PhoneCountryRule | null | undefined,
  numberType: PhoneNumberType,
) => {
  if (!rule || numberType === "unknown") {
    return null;
  }

  if (numberType === "mobile") {
    return rule.labels?.mobile ?? "Mobile";
  }

  if (numberType === "landline") {
    return rule.labels?.landline ?? "Landline";
  }

  return null;
};

export const findPhoneCountryRuleByCallingCode = (digits: string) => {
  for (const rule of CALLING_CODE_RULES) {
    if (!digits.startsWith(rule.callingCode)) {
      continue;
    }

    const nationalDigits = digits.slice(rule.callingCode.length);
    if (!matchesRuleNationalNumber(rule, nationalDigits)) {
      continue;
    }

    return { rule, nationalDigits };
  }

  return null;
};

export const findPhoneCountryRuleForLocalDigits = (digits: string) => {
  for (const rule of PHONE_COUNTRY_RULE_LIST) {
    if (rule.allowLocalNationalInput === false) {
      continue;
    }
    const nationalDigits = stripTrunkPrefix(digits, rule);
    if (!matchesRuleNationalNumber(rule, nationalDigits)) {
      continue;
    }

    if (rule.trunkPrefix && !digits.startsWith(rule.trunkPrefix)) {
      continue;
    }

    return { rule, nationalDigits };
  }

  return null;
};

export const formatPhoneInternational = (
  nationalDigits: string,
  rule: PhoneCountryRule,
  numberType: PhoneNumberType,
) => `+${rule.callingCode} ${applyGrouping(nationalDigits, getGrouping(rule, numberType, "international"))}`.trim();

export const formatPhoneNational = (
  nationalDigits: string,
  rule: PhoneCountryRule,
  numberType: PhoneNumberType,
) => {
  const grouped = applyGrouping(nationalDigits, getGrouping(rule, numberType, "national"));
  return `${rule.trunkPrefix ?? ""}${grouped}`.trim();
};

export const PHONE_COUNTRY_RULES_LIST = PHONE_COUNTRY_RULE_LIST;
