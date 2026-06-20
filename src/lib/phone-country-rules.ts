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
  leadingDigits?: string[];
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

const formatNanpExample = (digits: string) =>
  `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`.trim();

const buildNanpTerritoryRule = ({
  iso2,
  displayName,
  areaCodes,
  exampleFixed,
  exampleMobile,
}: {
  iso2: string;
  displayName: string;
  areaCodes: string[];
  exampleFixed: string;
  exampleMobile?: string;
}): PhoneCountryRule => ({
  iso2,
  displayName,
  callingCode: "1",
  allowLocalNationalInput: false,
  leadingDigits: areaCodes,
  nationalLengths: [10],
  labels: { mobile: "Phone", landline: "Phone" },
  examples: {
    mobile: formatNanpExample(exampleMobile ?? exampleFixed),
    landline: formatNanpExample(exampleFixed),
  },
  grouping: {
    internationalDefault: [3, 3, 4],
    nationalDefault: [3, 3, 4],
  },
});

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
    leadingDigits: [
      "204", "226", "236", "249", "250", "289", "306", "343", "354", "365", "367", "368",
      "382", "403", "416", "418", "431", "437", "438", "450", "468", "474", "506", "514",
      "519", "548", "579", "581", "584", "587", "600", "604", "613", "639", "647", "672",
      "683", "705", "709", "742", "753", "778", "780", "782", "807", "819", "825", "867",
      "873", "879", "902", "905", "942",
    ],
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
  buildNanpTerritoryRule({
    iso2: "AG",
    displayName: "Antigua and Barbuda",
    areaCodes: ["268"],
    exampleFixed: "2684601234",
    exampleMobile: "2684641234",
  }),
  buildNanpTerritoryRule({
    iso2: "AI",
    displayName: "Anguilla",
    areaCodes: ["264"],
    exampleFixed: "2644612345",
    exampleMobile: "2642351234",
  }),
  buildNanpTerritoryRule({
    iso2: "AS",
    displayName: "American Samoa",
    areaCodes: ["684"],
    exampleFixed: "6846221234",
    exampleMobile: "6847331234",
  }),
  buildNanpTerritoryRule({
    iso2: "BB",
    displayName: "Barbados",
    areaCodes: ["246"],
    exampleFixed: "2464123456",
    exampleMobile: "2462501234",
  }),
  buildNanpTerritoryRule({
    iso2: "BM",
    displayName: "Bermuda",
    areaCodes: ["441"],
    exampleFixed: "4414123456",
    exampleMobile: "4413701234",
  }),
  buildNanpTerritoryRule({
    iso2: "BS",
    displayName: "Bahamas",
    areaCodes: ["242"],
    exampleFixed: "2423456789",
    exampleMobile: "2423591234",
  }),
  buildNanpTerritoryRule({
    iso2: "DM",
    displayName: "Dominica",
    areaCodes: ["767"],
    exampleFixed: "7674201234",
    exampleMobile: "7672251234",
  }),
  buildNanpTerritoryRule({
    iso2: "DO",
    displayName: "Dominican Republic",
    areaCodes: ["809", "829", "849"],
    exampleFixed: "8092345678",
    exampleMobile: "8092345678",
  }),
  buildNanpTerritoryRule({
    iso2: "GD",
    displayName: "Grenada",
    areaCodes: ["473"],
    exampleFixed: "4732691234",
    exampleMobile: "4734031234",
  }),
  buildNanpTerritoryRule({
    iso2: "GU",
    displayName: "Guam",
    areaCodes: ["671"],
    exampleFixed: "6713001234",
    exampleMobile: "6713001234",
  }),
  buildNanpTerritoryRule({
    iso2: "JM",
    displayName: "Jamaica",
    areaCodes: ["876", "658"],
    exampleFixed: "8765230123",
    exampleMobile: "8762101234",
  }),
  buildNanpTerritoryRule({
    iso2: "KN",
    displayName: "Saint Kitts and Nevis",
    areaCodes: ["869"],
    exampleFixed: "8692361234",
    exampleMobile: "8697652917",
  }),
  buildNanpTerritoryRule({
    iso2: "KY",
    displayName: "Cayman Islands",
    areaCodes: ["345"],
    exampleFixed: "3452221234",
    exampleMobile: "3453231234",
  }),
  buildNanpTerritoryRule({
    iso2: "LC",
    displayName: "Saint Lucia",
    areaCodes: ["758"],
    exampleFixed: "7584305678",
    exampleMobile: "7582845678",
  }),
  buildNanpTerritoryRule({
    iso2: "MP",
    displayName: "Northern Mariana Islands",
    areaCodes: ["670"],
    exampleFixed: "6702345678",
    exampleMobile: "6702345678",
  }),
  buildNanpTerritoryRule({
    iso2: "MS",
    displayName: "Montserrat",
    areaCodes: ["664"],
    exampleFixed: "6644912345",
    exampleMobile: "6644923456",
  }),
  buildNanpTerritoryRule({
    iso2: "PR",
    displayName: "Puerto Rico",
    areaCodes: ["787", "939"],
    exampleFixed: "7872345678",
    exampleMobile: "7872345678",
  }),
  buildNanpTerritoryRule({
    iso2: "SX",
    displayName: "Sint Maarten",
    areaCodes: ["721"],
    exampleFixed: "7215425678",
    exampleMobile: "7215205678",
  }),
  buildNanpTerritoryRule({
    iso2: "TC",
    displayName: "Turks and Caicos Islands",
    areaCodes: ["649"],
    exampleFixed: "6497121234",
    exampleMobile: "6492311234",
  }),
  buildNanpTerritoryRule({
    iso2: "TT",
    displayName: "Trinidad and Tobago",
    areaCodes: ["868"],
    exampleFixed: "8682211234",
    exampleMobile: "8682911234",
  }),
  buildNanpTerritoryRule({
    iso2: "VC",
    displayName: "Saint Vincent and the Grenadines",
    areaCodes: ["784"],
    exampleFixed: "7842661234",
    exampleMobile: "7844301234",
  }),
  buildNanpTerritoryRule({
    iso2: "VG",
    displayName: "British Virgin Islands",
    areaCodes: ["284"],
    exampleFixed: "2842291234",
    exampleMobile: "2843001234",
  }),
  buildNanpTerritoryRule({
    iso2: "VI",
    displayName: "U.S. Virgin Islands",
    areaCodes: ["340"],
    exampleFixed: "3406421234",
    exampleMobile: "3406421234",
  }),
  {
    iso2: "IE",
    displayName: "Ireland",
    callingCode: "353",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [7, 8, 9],
    mobilePrefixes: ["8"],
    landlinePrefixes: ["1", "2", "4", "5", "6", "7", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+353 85 012 3456",
      landline: "+353 22 12345",
    },
    grouping: {
      internationalMobile: [2, 3, 4],
      nationalMobile: [2, 3, 4],
      internationalLandline: [2, 5],
      nationalLandline: [2, 5],
    },
  },
  {
    iso2: "FR",
    displayName: "France",
    callingCode: "33",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["6", "7"],
    landlinePrefixes: ["1", "2", "3", "4", "5"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+33 6 12 34 56 78",
      landline: "+33 1 23 45 67 89",
    },
    grouping: {
      internationalDefault: [1, 2, 2, 2, 2],
      nationalDefault: [1, 2, 2, 2, 2],
    },
  },
  {
    iso2: "DE",
    displayName: "Germany",
    callingCode: "49",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [8, 9, 10, 11],
    mobilePrefixes: ["15", "16", "17"],
    landlinePrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+49 151 234 56789",
      landline: "+49 30 123456",
    },
    grouping: {
      internationalMobile: [3, 3, 5],
      nationalMobile: [3, 3, 5],
      internationalLandline: [2, 6],
      nationalLandline: [2, 6],
    },
  },
  {
    iso2: "NL",
    displayName: "Netherlands",
    callingCode: "31",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["6"],
    landlinePrefixes: ["1", "2", "3", "4", "5"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+31 6 1234 5678",
      landline: "+31 10 123 4567",
    },
    grouping: {
      internationalMobile: [1, 4, 4],
      nationalMobile: [1, 4, 4],
      internationalLandline: [2, 3, 4],
      nationalLandline: [2, 3, 4],
    },
  },
  {
    iso2: "BE",
    displayName: "Belgium",
    callingCode: "32",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [8, 9],
    mobilePrefixes: ["4"],
    landlinePrefixes: ["1", "2", "3", "5", "6", "7", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+32 450 00 12 34",
      landline: "+32 12 34 56 78",
    },
    grouping: {
      internationalMobile: [3, 2, 2, 2],
      nationalMobile: [3, 2, 2, 2],
      internationalLandline: [2, 2, 2, 2],
      nationalLandline: [2, 2, 2, 2],
    },
  },
  {
    iso2: "CH",
    displayName: "Switzerland",
    callingCode: "41",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["7"],
    landlinePrefixes: ["2", "3", "4", "5", "6", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+41 78 123 45 67",
      landline: "+41 21 234 56 78",
    },
    grouping: {
      internationalDefault: [2, 3, 2, 2],
      nationalDefault: [2, 3, 2, 2],
    },
  },
  {
    iso2: "AT",
    displayName: "Austria",
    callingCode: "43",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9, 10],
    mobilePrefixes: ["6"],
    landlinePrefixes: ["1", "2", "3", "4", "5", "7", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+43 664 123456",
      landline: "+43 1 234567890",
    },
    grouping: {
      internationalMobile: [3, 6],
      nationalMobile: [3, 6],
      internationalLandline: [1, 9],
      nationalLandline: [1, 9],
    },
  },
  {
    iso2: "LU",
    displayName: "Luxembourg",
    callingCode: "352",
    allowLocalNationalInput: true,
    nationalLengths: [8, 9],
    mobilePrefixes: ["6"],
    landlinePrefixes: ["2", "3", "4", "5", "7", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+352 628 123 456",
      landline: "+352 27 12 34 56",
    },
    grouping: {
      internationalMobile: [3, 3, 3],
      nationalMobile: [3, 3, 3],
      internationalLandline: [2, 2, 2, 2],
      nationalLandline: [2, 2, 2, 2],
    },
  },
  {
    iso2: "LI",
    displayName: "Liechtenstein",
    callingCode: "423",
    allowLocalNationalInput: true,
    nationalLengths: [7, 9],
    mobilePrefixes: ["6", "7"],
    landlinePrefixes: ["2", "3"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+423 660 234 567",
      landline: "+423 234 56 78",
    },
    grouping: {
      internationalMobile: [3, 3, 3],
      nationalMobile: [3, 3, 3],
      internationalLandline: [3, 2, 2],
      nationalLandline: [3, 2, 2],
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
  {
    iso2: "PW",
    displayName: "Palau",
    callingCode: "680",
    allowLocalNationalInput: false,
    nationalLengths: [7],
    mobilePrefixes: [
      "620",
      "630",
      "640",
      "660",
      "680",
      "690",
      "770",
      "771",
      "772",
      "773",
      "774",
      "775",
      "776",
      "777",
      "778",
      "880",
      "881",
      "882",
      "883",
      "884",
    ],
    landlinePrefixes: [
      "255",
      "277",
      "345",
      "488",
      "535",
      "544",
      "587",
      "622",
      "654",
      "679",
      "733",
      "747",
      "824",
      "855",
      "876",
    ],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+680 770 1234",
      landline: "+680 488 1234",
    },
    grouping: {
      internationalDefault: [3, 4],
      nationalDefault: [3, 4],
    },
  },
  {
    iso2: "NC",
    displayName: "New Caledonia",
    callingCode: "687",
    allowLocalNationalInput: false,
    nationalLengths: [6],
    mobilePrefixes: [
      "50",
      "51",
      "52",
      "53",
      "54",
      "55",
      "56",
      "57",
      "58",
      "59",
      "70",
      "71",
      "72",
      "73",
      "74",
      "75",
      "76",
      "77",
      "78",
      "79",
      "80",
      "81",
      "82",
      "83",
      "84",
      "85",
      "86",
      "87",
      "89",
      "90",
      "91",
      "92",
      "93",
      "94",
      "95",
      "96",
      "97",
      "98",
      "99",
    ],
    landlinePrefixes: [
      "20",
      "23",
      "24",
      "25",
      "26",
      "27",
      "28",
      "29",
      "30",
      "31",
      "32",
      "33",
      "34",
      "35",
      "41",
      "42",
      "43",
      "44",
      "45",
      "46",
      "47",
    ],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+687 75 1234",
      landline: "+687 24 1234",
    },
    grouping: {
      internationalDefault: [2, 4],
      nationalDefault: [2, 4],
    },
  },
  {
    iso2: "PF",
    displayName: "French Polynesia",
    callingCode: "689",
    allowLocalNationalInput: false,
    nationalLengths: [8],
    mobilePrefixes: ["87", "88", "89"],
    landlinePrefixes: ["40", "49"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+689 87 12 34 56",
      landline: "+689 40 12 34 56",
    },
    grouping: {
      internationalDefault: [2, 2, 2, 2],
      nationalDefault: [2, 2, 2, 2],
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
  let fallback: { rule: PhoneCountryRule; nationalDigits: string } | null = null;

  for (const rule of CALLING_CODE_RULES) {
    if (!digits.startsWith(rule.callingCode)) {
      continue;
    }

    const nationalDigits = digits.slice(rule.callingCode.length);
    if (!matchesRuleNationalNumber(rule, nationalDigits)) {
      continue;
    }

    if (rule.leadingDigits?.length) {
      if (startsWithAny(nationalDigits, rule.leadingDigits)) {
        return { rule, nationalDigits };
      }
      continue;
    }

    fallback ??= { rule, nationalDigits };
  }

  return fallback;
};

export const findPhoneCountryRuleForLocalDigits = (digits: string) => {
  let fallback: { rule: PhoneCountryRule; nationalDigits: string } | null = null;

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

    if (rule.leadingDigits?.length) {
      if (startsWithAny(nationalDigits, rule.leadingDigits)) {
        return { rule, nationalDigits };
      }
      continue;
    }

    fallback ??= { rule, nationalDigits };
  }

  return fallback;
};

export const resolvePhoneNationalDigitsForRule = ({
  digits,
  hasPlus,
  rule,
}: {
  digits: string;
  hasPlus: boolean;
  rule: PhoneCountryRule;
}) => {
  if (!digits) {
    return null;
  }

  if (hasPlus || digits.startsWith(rule.callingCode)) {
    const internationalDigits = hasPlus
      ? digits
      : digits.startsWith(rule.callingCode)
        ? digits
        : "";
    if (internationalDigits.startsWith(rule.callingCode)) {
      const nationalDigits = internationalDigits.slice(rule.callingCode.length);
      if (matchesRuleNationalNumber(rule, nationalDigits)) {
        return nationalDigits;
      }
    }
  }

  if (!hasPlus && rule.allowLocalNationalInput !== false) {
    const nationalDigits = stripTrunkPrefix(digits, rule);
    if (
      matchesRuleNationalNumber(rule, nationalDigits) &&
      (!rule.trunkPrefix || digits.startsWith(rule.trunkPrefix))
    ) {
      return nationalDigits;
    }
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
