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

const buildIntlOnlyRule = ({
  iso2,
  displayName,
  callingCode,
  fixedExample,
  mobileExample,
  labels,
  mobilePrefixes,
  landlinePrefixes,
}: {
  iso2: string;
  displayName: string;
  callingCode: string;
  fixedExample: string;
  mobileExample?: string;
  labels?: {
    mobile?: string;
    landline?: string;
  };
  mobilePrefixes?: string[];
  landlinePrefixes?: string[];
}): PhoneCountryRule => ({
  iso2,
  displayName,
  callingCode,
  allowLocalNationalInput: false,
  nationalLengths: [...new Set([fixedExample.length, mobileExample?.length].filter(Boolean))] as number[],
  mobilePrefixes,
  landlinePrefixes,
  labels,
  examples: {
    mobile: mobileExample ? `+${callingCode} ${mobileExample}` : undefined,
    landline: `+${callingCode} ${fixedExample}`,
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
    iso2: "SE",
    displayName: "Sweden",
    callingCode: "46",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [8, 9],
    mobilePrefixes: ["7"],
    landlinePrefixes: ["1", "2", "3", "4", "6", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+46 70 123 4567",
      landline: "+46 8 123 4567",
    },
    grouping: {
      internationalMobile: [2, 3, 4],
      nationalMobile: [2, 3, 4],
      internationalLandline: [1, 3, 4],
      nationalLandline: [1, 3, 4],
    },
  },
  {
    iso2: "NO",
    displayName: "Norway",
    callingCode: "47",
    allowLocalNationalInput: true,
    nationalLengths: [8],
    mobilePrefixes: ["4", "9"],
    landlinePrefixes: ["2", "3", "5", "6", "7"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+47 406 12 345",
      landline: "+47 21 23 45 67",
    },
    grouping: {
      internationalDefault: [3, 2, 3],
      nationalDefault: [3, 2, 3],
    },
  },
  {
    iso2: "DK",
    displayName: "Denmark",
    callingCode: "45",
    allowLocalNationalInput: true,
    nationalLengths: [8],
    mobilePrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"],
    landlinePrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"],
    labels: { mobile: "Phone", landline: "Phone" },
    examples: {
      mobile: "+45 34 41 23 45",
      landline: "+45 32 12 34 56",
    },
    grouping: {
      internationalDefault: [2, 2, 2, 2],
      nationalDefault: [2, 2, 2, 2],
    },
  },
  {
    iso2: "FI",
    displayName: "Finland",
    callingCode: "358",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [8, 9],
    mobilePrefixes: ["4", "5"],
    landlinePrefixes: ["1", "2", "3", "6", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+358 41 234 5678",
      landline: "+358 13 123 4567",
    },
    grouping: {
      internationalMobile: [2, 3, 4],
      nationalMobile: [2, 3, 4],
      internationalLandline: [2, 3, 4],
      nationalLandline: [2, 3, 4],
    },
  },
  {
    iso2: "IS",
    displayName: "Iceland",
    callingCode: "354",
    allowLocalNationalInput: true,
    nationalLengths: [7],
    mobilePrefixes: ["6", "7", "8"],
    landlinePrefixes: ["4", "5"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+354 611 1234",
      landline: "+354 410 1234",
    },
    grouping: {
      internationalDefault: [3, 4],
      nationalDefault: [3, 4],
    },
  },
  {
    iso2: "EE",
    displayName: "Estonia",
    callingCode: "372",
    allowLocalNationalInput: true,
    nationalLengths: [7, 8],
    mobilePrefixes: ["5", "8"],
    landlinePrefixes: ["3", "4", "6", "7"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+372 5123 4567",
      landline: "+372 321 2345",
    },
    grouping: {
      internationalMobile: [4, 4],
      nationalMobile: [4, 4],
      internationalLandline: [3, 4],
      nationalLandline: [3, 4],
    },
  },
  {
    iso2: "LV",
    displayName: "Latvia",
    callingCode: "371",
    allowLocalNationalInput: true,
    nationalLengths: [8],
    mobilePrefixes: ["2"],
    landlinePrefixes: ["6"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+371 21 234 567",
      landline: "+371 63 123 456",
    },
    grouping: {
      internationalDefault: [2, 3, 3],
      nationalDefault: [2, 3, 3],
    },
  },
  {
    iso2: "LT",
    displayName: "Lithuania",
    callingCode: "370",
    allowLocalNationalInput: true,
    nationalLengths: [8],
    mobilePrefixes: ["6"],
    landlinePrefixes: ["3", "4", "5"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+370 612 34567",
      landline: "+370 31 234567",
    },
    grouping: {
      internationalMobile: [3, 5],
      nationalMobile: [3, 5],
      internationalLandline: [2, 6],
      nationalLandline: [2, 6],
    },
  },
  {
    iso2: "ES",
    displayName: "Spain",
    callingCode: "34",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["6", "7"],
    landlinePrefixes: ["8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+34 612 34 56 78",
      landline: "+34 810 12 34 56",
    },
    grouping: {
      internationalDefault: [3, 2, 2, 2],
      nationalDefault: [3, 2, 2, 2],
    },
  },
  {
    iso2: "PT",
    displayName: "Portugal",
    callingCode: "351",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["9"],
    landlinePrefixes: ["2"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+351 912 345 678",
      landline: "+351 212 345 678",
    },
    grouping: {
      internationalDefault: [3, 3, 3],
      nationalDefault: [3, 3, 3],
    },
  },
  {
    iso2: "IT",
    displayName: "Italy",
    callingCode: "39",
    allowLocalNationalInput: true,
    nationalLengths: [9, 10],
    mobilePrefixes: ["3"],
    landlinePrefixes: ["0"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+39 312 345 6789",
      landline: "+39 02 1234 5678",
    },
    grouping: {
      internationalMobile: [3, 3, 4],
      nationalMobile: [3, 3, 4],
      internationalLandline: [2, 4, 4],
      nationalLandline: [2, 4, 4],
    },
  },
  {
    iso2: "GR",
    displayName: "Greece",
    callingCode: "30",
    allowLocalNationalInput: true,
    nationalLengths: [10],
    mobilePrefixes: ["69"],
    landlinePrefixes: ["2"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+30 691 234 5678",
      landline: "+30 212 345 6789",
    },
    grouping: {
      internationalDefault: [3, 3, 4],
      nationalDefault: [3, 3, 4],
    },
  },
  {
    iso2: "MT",
    displayName: "Malta",
    callingCode: "356",
    allowLocalNationalInput: true,
    nationalLengths: [8],
    mobilePrefixes: ["7", "9", "5"],
    landlinePrefixes: ["2"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+356 9696 1234",
      landline: "+356 2100 1234",
    },
    grouping: {
      internationalDefault: [4, 4],
      nationalDefault: [4, 4],
    },
  },
  {
    iso2: "CY",
    displayName: "Cyprus",
    callingCode: "357",
    allowLocalNationalInput: true,
    nationalLengths: [8],
    mobilePrefixes: ["9", "7"],
    landlinePrefixes: ["2"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+357 96 123456",
      landline: "+357 22 345678",
    },
    grouping: {
      internationalDefault: [2, 6],
      nationalDefault: [2, 6],
    },
  },
  {
    iso2: "PL",
    displayName: "Poland",
    callingCode: "48",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["5", "6", "7", "8"],
    landlinePrefixes: ["1", "2", "3", "4", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+48 512 345 678", landline: "+48 123 456 789" },
    grouping: { internationalDefault: [3, 3, 3], nationalDefault: [3, 3, 3] },
  },
  {
    iso2: "CZ",
    displayName: "Czechia",
    callingCode: "420",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["6", "7"],
    landlinePrefixes: ["2", "3", "4", "5"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+420 601 123 456", landline: "+420 212 345 678" },
    grouping: { internationalDefault: [3, 3, 3], nationalDefault: [3, 3, 3] },
  },
  {
    iso2: "SK",
    displayName: "Slovakia",
    callingCode: "421",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["9"],
    landlinePrefixes: ["2", "3", "4", "5"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+421 912 123 456", landline: "+421 22 123 4567" },
    grouping: { internationalMobile: [3, 3, 3], nationalMobile: [3, 3, 3], internationalLandline: [2, 3, 4], nationalLandline: [2, 3, 4] },
  },
  buildIntlOnlyRule({ iso2: "HU", displayName: "Hungary", callingCode: "36", fixedExample: "12345678", mobileExample: "201234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["20"], landlinePrefixes: ["1"] }),
  buildIntlOnlyRule({ iso2: "SI", displayName: "Slovenia", callingCode: "386", fixedExample: "12345678", mobileExample: "31234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["3"], landlinePrefixes: ["1"] }),
  {
    iso2: "HR",
    displayName: "Croatia",
    callingCode: "385",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [8, 9],
    mobilePrefixes: ["9"],
    landlinePrefixes: ["1", "2", "3", "4", "5"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+385 92 123 4567", landline: "+385 1 234 5678" },
    grouping: { internationalMobile: [2, 3, 4], nationalMobile: [2, 3, 4], internationalLandline: [1, 3, 4], nationalLandline: [1, 3, 4] },
  },
  buildIntlOnlyRule({ iso2: "BA", displayName: "Bosnia and Herzegovina", callingCode: "387", fixedExample: "30212345", mobileExample: "61123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["3"] }),
  buildIntlOnlyRule({ iso2: "RS", displayName: "Serbia", callingCode: "381", fixedExample: "10234567", mobileExample: "601234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["1"] }),
  buildIntlOnlyRule({ iso2: "ME", displayName: "Montenegro", callingCode: "382", fixedExample: "30234567", mobileExample: "60123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["3"] }),
  buildIntlOnlyRule({ iso2: "XK", displayName: "Kosovo", callingCode: "383", fixedExample: "28012345", mobileExample: "43201234", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["4"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "MK", displayName: "North Macedonia", callingCode: "389", fixedExample: "22012345", mobileExample: "72345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "AL", displayName: "Albania", callingCode: "355", fixedExample: "22345678", mobileExample: "672123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["2"] }),
  {
    iso2: "RO",
    displayName: "Romania",
    callingCode: "40",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["7"],
    landlinePrefixes: ["2", "3"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+40 712 034 567", landline: "+40 21 123 4567" },
    grouping: { internationalDefault: [3, 3, 3], nationalDefault: [3, 3, 3] },
  },
  {
    iso2: "BG",
    displayName: "Bulgaria",
    callingCode: "359",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [8],
    mobilePrefixes: ["43", "87", "88", "89", "98", "99"],
    landlinePrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+359 43 012 345", landline: "+359 2 123 4567" },
    grouping: { internationalDefault: [2, 3, 3], nationalDefault: [2, 3, 3] },
  },
  buildIntlOnlyRule({ iso2: "MD", displayName: "Moldova", callingCode: "373", fixedExample: "22212345", mobileExample: "62112345", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["2"] }),
  {
    iso2: "UA",
    displayName: "Ukraine",
    callingCode: "380",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["5", "6", "7", "8", "9"],
    landlinePrefixes: ["3", "4"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+380 50 123 4567", landline: "+380 31 123 4567" },
    grouping: { internationalDefault: [2, 3, 4], nationalDefault: [2, 3, 4] },
  },
  buildIntlOnlyRule({ iso2: "BY", displayName: "Belarus", callingCode: "375", fixedExample: "152450911", mobileExample: "294911911", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["25", "29", "33", "44"], landlinePrefixes: ["1", "2", "3", "4"] }),
  buildIntlOnlyRule({ iso2: "RU", displayName: "Russia", callingCode: "7", fixedExample: "3011234567", mobileExample: "9123456789", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["3", "4", "8"] }),
  {
    iso2: "TR",
    displayName: "Turkey",
    callingCode: "90",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [10],
    mobilePrefixes: ["5"],
    landlinePrefixes: ["2", "3", "4"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+90 501 234 5678", landline: "+90 212 345 6789" },
    grouping: { internationalDefault: [3, 3, 4], nationalDefault: [3, 3, 4] },
  },
  {
    iso2: "IL",
    displayName: "Israel",
    callingCode: "972",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [8, 9],
    mobilePrefixes: ["5"],
    landlinePrefixes: ["2", "3", "4", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+972 50 234 5678", landline: "+972 2 123 4567" },
    grouping: { internationalMobile: [2, 3, 4], nationalMobile: [2, 3, 4], internationalLandline: [1, 3, 4], nationalLandline: [1, 3, 4] },
  },
  buildIntlOnlyRule({ iso2: "PS", displayName: "Palestine", callingCode: "970", fixedExample: "22234567", mobileExample: "599123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["59"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "JO", displayName: "Jordan", callingCode: "962", fixedExample: "62001234", mobileExample: "790123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["6"] }),
  buildIntlOnlyRule({ iso2: "LB", displayName: "Lebanon", callingCode: "961", fixedExample: "1123456", mobileExample: "71123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["1"] }),
  buildIntlOnlyRule({ iso2: "SY", displayName: "Syria", callingCode: "963", fixedExample: "112345678", mobileExample: "944567890", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["1"] }),
  buildIntlOnlyRule({ iso2: "IQ", displayName: "Iraq", callingCode: "964", fixedExample: "12345678", mobileExample: "7912345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["79"], landlinePrefixes: ["1"] }),
  buildIntlOnlyRule({ iso2: "IR", displayName: "Iran", callingCode: "98", fixedExample: "2123456789", mobileExample: "9123456789", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  {
    iso2: "SA",
    displayName: "Saudi Arabia",
    callingCode: "966",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["5"],
    landlinePrefixes: ["1", "2", "3", "4", "6", "7"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+966 51 234 5678", landline: "+966 11 234 5678" },
    grouping: { internationalDefault: [2, 3, 4], nationalDefault: [2, 3, 4] },
  },
  {
    iso2: "AE",
    displayName: "United Arab Emirates",
    callingCode: "971",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [8, 9],
    mobilePrefixes: ["5"],
    landlinePrefixes: ["2", "3", "4", "6", "7", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+971 50 123 4567", landline: "+971 2 234 5678" },
    grouping: { internationalMobile: [2, 3, 4], nationalMobile: [2, 3, 4], internationalLandline: [1, 3, 4], nationalLandline: [1, 3, 4] },
  },
  buildIntlOnlyRule({ iso2: "QA", displayName: "Qatar", callingCode: "974", fixedExample: "44123456", mobileExample: "33123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["3"], landlinePrefixes: ["4"] }),
  buildIntlOnlyRule({ iso2: "BH", displayName: "Bahrain", callingCode: "973", fixedExample: "17001234", mobileExample: "36001234", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["3"], landlinePrefixes: ["1"] }),
  buildIntlOnlyRule({ iso2: "KW", displayName: "Kuwait", callingCode: "965", fixedExample: "22345678", mobileExample: "50012345", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["5"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "OM", displayName: "Oman", callingCode: "968", fixedExample: "23123456", mobileExample: "92123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "YE", displayName: "Yemen", callingCode: "967", fixedExample: "1234567", mobileExample: "712345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["1"] }),
  {
    iso2: "EG",
    displayName: "Egypt",
    callingCode: "20",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9, 10],
    mobilePrefixes: ["10", "11", "12", "15"],
    landlinePrefixes: ["2", "3", "4", "5", "6", "7", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+20 100 123 4567", landline: "+20 2 345 67890" },
    grouping: { internationalMobile: [3, 3, 4], nationalMobile: [3, 3, 4], internationalLandline: [1, 3, 5], nationalLandline: [1, 3, 5] },
  },
  buildIntlOnlyRule({ iso2: "LY", displayName: "Libya", callingCode: "218", fixedExample: "212345678", mobileExample: "912345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "TN", displayName: "Tunisia", callingCode: "216", fixedExample: "30010123", mobileExample: "20123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["2"], landlinePrefixes: ["3"] }),
  buildIntlOnlyRule({ iso2: "DZ", displayName: "Algeria", callingCode: "213", fixedExample: "12345678", mobileExample: "551234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["5", "6", "7"], landlinePrefixes: ["1", "2", "3", "4"] }),
  {
    iso2: "MA",
    displayName: "Morocco",
    callingCode: "212",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["6", "7"],
    landlinePrefixes: ["5"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+212 650 123 456", landline: "+212 520 123 456" },
    grouping: { internationalDefault: [3, 3, 3], nationalDefault: [3, 3, 3] },
  },
  buildIntlOnlyRule({ iso2: "EH", displayName: "Western Sahara", callingCode: "212", fixedExample: "528812345", mobileExample: "650123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["5"] }),
  buildIntlOnlyRule({ iso2: "MR", displayName: "Mauritania", callingCode: "222", fixedExample: "35123456", mobileExample: "22123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["2"], landlinePrefixes: ["3"] }),
  {
    iso2: "NG",
    displayName: "Nigeria",
    callingCode: "234",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [10],
    mobilePrefixes: ["7", "8", "9"],
    landlinePrefixes: ["1", "2", "3", "4", "5", "6"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+234 802 123 4567", landline: "+234 20 3312 3456" },
    grouping: { internationalMobile: [3, 3, 4], nationalMobile: [3, 3, 4], internationalLandline: [2, 4, 4], nationalLandline: [2, 4, 4] },
  },
  {
    iso2: "GH",
    displayName: "Ghana",
    callingCode: "233",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["2", "5"],
    landlinePrefixes: ["3"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+233 23 123 4567", landline: "+233 30 234 5678" },
    grouping: { internationalDefault: [2, 3, 4], nationalDefault: [2, 3, 4] },
  },
  {
    iso2: "KE",
    displayName: "Kenya",
    callingCode: "254",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["7", "1"],
    landlinePrefixes: ["2", "4", "5", "6"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+254 712 123456", landline: "+254 20 2012345" },
    grouping: { internationalDefault: [3, 3, 3], nationalDefault: [3, 3, 3] },
  },
  {
    iso2: "UG",
    displayName: "Uganda",
    callingCode: "256",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["7"],
    landlinePrefixes: ["2", "3", "4"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+256 712 345678",
      landline: "+256 312 345678",
    },
    grouping: {
      internationalMobile: [3, 3, 3],
      internationalLandline: [3, 3, 3],
      nationalMobile: [3, 3, 3],
      nationalLandline: [3, 3, 3],
    },
  },
  {
    iso2: "TZ",
    displayName: "Tanzania",
    callingCode: "255",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["6", "7"],
    landlinePrefixes: ["2"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+255 621 234 567", landline: "+255 22 234 5678" },
    grouping: { internationalDefault: [3, 3, 3], nationalDefault: [3, 3, 3] },
  },
  buildIntlOnlyRule({ iso2: "RW", displayName: "Rwanda", callingCode: "250", fixedExample: "250123456", mobileExample: "720123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "ET", displayName: "Ethiopia", callingCode: "251", fixedExample: "111112345", mobileExample: "911234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["1"] }),
  {
    iso2: "ZA",
    displayName: "South Africa",
    callingCode: "27",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9],
    mobilePrefixes: ["6", "7", "8"],
    landlinePrefixes: ["1", "2", "3", "4", "5"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: { mobile: "+27 71 123 4567", landline: "+27 10 123 4567" },
    grouping: { internationalDefault: [2, 3, 4], nationalDefault: [2, 3, 4] },
  },
  buildIntlOnlyRule({ iso2: "NA", displayName: "Namibia", callingCode: "264", fixedExample: "61221234", mobileExample: "811234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["8"], landlinePrefixes: ["6"] }),
  buildIntlOnlyRule({ iso2: "BW", displayName: "Botswana", callingCode: "267", fixedExample: "2401234", mobileExample: "71123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "ZW", displayName: "Zimbabwe", callingCode: "263", fixedExample: "1312345", mobileExample: "712345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["1"] }),
  buildIntlOnlyRule({ iso2: "ZM", displayName: "Zambia", callingCode: "260", fixedExample: "211234567", mobileExample: "955123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "MZ", displayName: "Mozambique", callingCode: "258", fixedExample: "21123456", mobileExample: "821234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["8"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "AO", displayName: "Angola", callingCode: "244", fixedExample: "222123456", mobileExample: "923123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "CM", displayName: "Cameroon", callingCode: "237", fixedExample: "222123456", mobileExample: "671234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "CI", displayName: "Cote d'Ivoire", callingCode: "225", fixedExample: "2123456789", mobileExample: "0123456789", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "SN", displayName: "Senegal", callingCode: "221", fixedExample: "301012345", mobileExample: "701234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["3"] }),
  buildIntlOnlyRule({ iso2: "ML", displayName: "Mali", callingCode: "223", fixedExample: "20212345", mobileExample: "65012345", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "BF", displayName: "Burkina Faso", callingCode: "226", fixedExample: "20491234", mobileExample: "70123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "NE", displayName: "Niger", callingCode: "227", fixedExample: "20201234", mobileExample: "93123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "BJ", displayName: "Benin", callingCode: "229", fixedExample: "0120211234", mobileExample: "0195123456", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "TG", displayName: "Togo", callingCode: "228", fixedExample: "22212345", mobileExample: "90112345", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "SL", displayName: "Sierra Leone", callingCode: "232", fixedExample: "22221234", mobileExample: "25123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["2"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "LR", displayName: "Liberia", callingCode: "231", fixedExample: "21234567", mobileExample: "770123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "GN", displayName: "Guinea", callingCode: "224", fixedExample: "30241234", mobileExample: "601123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["3"] }),
  buildIntlOnlyRule({ iso2: "GW", displayName: "Guinea-Bissau", callingCode: "245", fixedExample: "443201234", mobileExample: "955012345", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["4"] }),
  buildIntlOnlyRule({ iso2: "GA", displayName: "Gabon", callingCode: "241", fixedExample: "01441234", mobileExample: "06031234", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "CG", displayName: "Republic of the Congo", callingCode: "242", fixedExample: "222123456", mobileExample: "061234567", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "CD", displayName: "Democratic Republic of the Congo", callingCode: "243", fixedExample: "1234567", mobileExample: "991234567", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "MW", displayName: "Malawi", callingCode: "265", fixedExample: "1234567", mobileExample: "991234567", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "MG", displayName: "Madagascar", callingCode: "261", fixedExample: "202123456", mobileExample: "321234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["3"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "MU", displayName: "Mauritius", callingCode: "230", fixedExample: "54480123", mobileExample: "52512345", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "SC", displayName: "Seychelles", callingCode: "248", fixedExample: "4217123", mobileExample: "2510123", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "CV", displayName: "Cape Verde", callingCode: "238", fixedExample: "2211234", mobileExample: "9911234", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "ST", displayName: "Sao Tome and Principe", callingCode: "239", fixedExample: "2221234", mobileExample: "9812345", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "ER", displayName: "Eritrea", callingCode: "291", fixedExample: "8370362", mobileExample: "7123456", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "DJ", displayName: "Djibouti", callingCode: "253", fixedExample: "21360003", mobileExample: "77831001", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "SO", displayName: "Somalia", callingCode: "252", fixedExample: "4012345", mobileExample: "71123456", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "SS", displayName: "South Sudan", callingCode: "211", fixedExample: "181234567", mobileExample: "977123456", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "BI", displayName: "Burundi", callingCode: "257", fixedExample: "22201234", mobileExample: "79561234", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "LS", displayName: "Lesotho", callingCode: "266", fixedExample: "22123456", mobileExample: "50123456", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "SZ", displayName: "Eswatini", callingCode: "268", fixedExample: "22171234", mobileExample: "76123456", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "KM", displayName: "Comoros", callingCode: "269", fixedExample: "7712345", mobileExample: "3212345", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "GQ", displayName: "Equatorial Guinea", callingCode: "240", fixedExample: "333091234", mobileExample: "222123456", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "GM", displayName: "Gambia", callingCode: "220", fixedExample: "5661234", mobileExample: "3012345", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "TD", displayName: "Chad", callingCode: "235", fixedExample: "22501234", mobileExample: "63012345", labels: { mobile: "Mobile", landline: "Landline" } }),
  buildIntlOnlyRule({ iso2: "CF", displayName: "Central African Republic", callingCode: "236", fixedExample: "21612345", mobileExample: "70012345", labels: { mobile: "Mobile", landline: "Landline" } }),
  {
    iso2: "IN",
    displayName: "India",
    callingCode: "91",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [10],
    mobilePrefixes: ["6", "7", "8", "9"],
    landlinePrefixes: ["1", "2", "3", "4", "5"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+91 81234 56789",
      landline: "+91 74 1041 0123",
    },
    grouping: {
      internationalMobile: [5, 5],
      internationalLandline: [2, 4, 4],
      nationalMobile: [5, 5],
      nationalLandline: [2, 4, 4],
    },
  },
  {
    iso2: "CN",
    displayName: "China",
    callingCode: "86",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [10, 11],
    mobilePrefixes: ["1"],
    landlinePrefixes: ["10", "2", "3", "4", "5", "6", "7", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+86 131 2345 6789",
      landline: "+86 10 1234 5678",
    },
    grouping: {
      internationalMobile: [3, 4, 4],
      internationalLandline: [2, 4, 4],
      nationalMobile: [3, 4, 4],
      nationalLandline: [2, 4, 4],
    },
  },
  {
    iso2: "JP",
    displayName: "Japan",
    callingCode: "81",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [9, 10],
    mobilePrefixes: ["70", "80", "90"],
    landlinePrefixes: ["1", "3", "4", "5", "6", "7", "8", "9"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+81 90 1234 5678",
      landline: "+81 3 1234 5678",
    },
    grouping: {
      internationalMobile: [2, 4, 4],
      internationalLandline: [1, 4, 4],
      nationalMobile: [3, 4, 4],
      nationalLandline: [2, 4, 4],
    },
  },
  {
    iso2: "KR",
    displayName: "South Korea",
    callingCode: "82",
    trunkPrefix: "0",
    allowLocalNationalInput: true,
    nationalLengths: [8, 9, 10],
    mobilePrefixes: ["10", "11", "16", "17", "18", "19"],
    landlinePrefixes: ["2", "31", "32", "33", "41", "42", "43", "44", "51", "52", "53", "54", "55", "61", "62", "63", "64"],
    labels: { mobile: "Mobile", landline: "Landline" },
    examples: {
      mobile: "+82 10 2000 0000",
      landline: "+82 2 2123 4567",
    },
    grouping: {
      internationalMobile: [2, 4, 4],
      internationalLandline: [1, 4, 4],
      nationalMobile: [3, 4, 4],
      nationalLandline: [2, 4, 4],
    },
  },
  {
    iso2: "BR",
    displayName: "Brazil",
    callingCode: "55",
    allowLocalNationalInput: true,
    nationalLengths: [10, 11],
    labels: { mobile: "Phone", landline: "Phone" },
    examples: {
      mobile: "+55 11 96123 4567",
      landline: "+55 11 2345 6789",
    },
    grouping: {
      internationalMobile: [2, 5, 4],
      internationalLandline: [2, 4, 4],
      nationalMobile: [2, 5, 4],
      nationalLandline: [2, 4, 4],
    },
  },
  {
    iso2: "MX",
    displayName: "Mexico",
    callingCode: "52",
    allowLocalNationalInput: true,
    nationalLengths: [10],
    labels: { mobile: "Phone", landline: "Phone" },
    examples: {
      mobile: "+52 222 123 4567",
      landline: "+52 200 123 4567",
    },
    grouping: {
      internationalDefault: [3, 3, 4],
      nationalDefault: [3, 3, 4],
    },
  },
  buildIntlOnlyRule({ iso2: "PK", displayName: "Pakistan", callingCode: "92", fixedExample: "2123456789", mobileExample: "3012345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["3"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "BD", displayName: "Bangladesh", callingCode: "880", fixedExample: "27111234", mobileExample: "1812345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["1"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "LK", displayName: "Sri Lanka", callingCode: "94", fixedExample: "112345678", mobileExample: "712345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["1"] }),
  buildIntlOnlyRule({ iso2: "NP", displayName: "Nepal", callingCode: "977", fixedExample: "14567890", mobileExample: "9841234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["1"] }),
  buildIntlOnlyRule({ iso2: "BT", displayName: "Bhutan", callingCode: "975", fixedExample: "2345678", mobileExample: "17123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["1", "7"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "MV", displayName: "Maldives", callingCode: "960", fixedExample: "6701234", mobileExample: "7712345", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["3", "6"] }),
  buildIntlOnlyRule({ iso2: "AF", displayName: "Afghanistan", callingCode: "93", fixedExample: "234567890", mobileExample: "701234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "HK", displayName: "Hong Kong", callingCode: "852", fixedExample: "21234567", mobileExample: "51234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["5", "6", "9"], landlinePrefixes: ["2", "3"] }),
  buildIntlOnlyRule({ iso2: "MO", displayName: "Macau", callingCode: "853", fixedExample: "28212345", mobileExample: "66123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "TW", displayName: "Taiwan", callingCode: "886", fixedExample: "221234567", mobileExample: "912345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "KP", displayName: "North Korea", callingCode: "850", fixedExample: "21234567", mobileExample: "1921234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["19"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "MN", displayName: "Mongolia", callingCode: "976", fixedExample: "53123456", mobileExample: "88123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["8"], landlinePrefixes: ["5"] }),
  buildIntlOnlyRule({ iso2: "ID", displayName: "Indonesia", callingCode: "62", fixedExample: "218350123", mobileExample: "812345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["8"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "MY", displayName: "Malaysia", callingCode: "60", fixedExample: "323856789", mobileExample: "123456789", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["1"], landlinePrefixes: ["3"] }),
  buildIntlOnlyRule({ iso2: "SG", displayName: "Singapore", callingCode: "65", fixedExample: "61234567", mobileExample: "81234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["8", "9"], landlinePrefixes: ["6"] }),
  buildIntlOnlyRule({ iso2: "TH", displayName: "Thailand", callingCode: "66", fixedExample: "21234567", mobileExample: "812345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["8", "9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "VN", displayName: "Vietnam", callingCode: "84", fixedExample: "2101234567", mobileExample: "912345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "PH", displayName: "Philippines", callingCode: "63", fixedExample: "232345678", mobileExample: "9051234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "KH", displayName: "Cambodia", callingCode: "855", fixedExample: "23756789", mobileExample: "91234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "LA", displayName: "Laos", callingCode: "856", fixedExample: "21212862", mobileExample: "2023123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["20"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "MM", displayName: "Myanmar", callingCode: "95", fixedExample: "1234567", mobileExample: "92123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["1"] }),
  buildIntlOnlyRule({ iso2: "BN", displayName: "Brunei", callingCode: "673", fixedExample: "2345678", mobileExample: "7123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "TL", displayName: "Timor-Leste", callingCode: "670", fixedExample: "2112345", mobileExample: "77212345", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "GT", displayName: "Guatemala", callingCode: "502", fixedExample: "22456789", mobileExample: "51234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["5"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "SV", displayName: "El Salvador", callingCode: "503", fixedExample: "21234567", mobileExample: "70123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "HN", displayName: "Honduras", callingCode: "504", fixedExample: "22123456", mobileExample: "91234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "NI", displayName: "Nicaragua", callingCode: "505", fixedExample: "21234567", mobileExample: "81234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["8"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "CR", displayName: "Costa Rica", callingCode: "506", fixedExample: "22123456", mobileExample: "83123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["8"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "PA", displayName: "Panama", callingCode: "507", fixedExample: "2001234", mobileExample: "61234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "CO", displayName: "Colombia", callingCode: "57", fixedExample: "6012345678", mobileExample: "3211234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["3"], landlinePrefixes: ["6"] }),
  buildIntlOnlyRule({ iso2: "VE", displayName: "Venezuela", callingCode: "58", fixedExample: "2121234567", mobileExample: "4121234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["4"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "EC", displayName: "Ecuador", callingCode: "593", fixedExample: "22123456", mobileExample: "991234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "PE", displayName: "Peru", callingCode: "51", fixedExample: "11234567", mobileExample: "912345678", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["1"] }),
  buildIntlOnlyRule({ iso2: "BO", displayName: "Bolivia", callingCode: "591", fixedExample: "22123456", mobileExample: "71234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "CL", displayName: "Chile", callingCode: "56", fixedExample: "600123456", mobileExample: "221234567", labels: { mobile: "Phone", landline: "Phone" } }),
  buildIntlOnlyRule({ iso2: "AR", displayName: "Argentina", callingCode: "54", fixedExample: "1123456789", mobileExample: "91123456789", labels: { mobile: "Phone", landline: "Phone" } }),
  buildIntlOnlyRule({ iso2: "UY", displayName: "Uruguay", callingCode: "598", fixedExample: "21231234", mobileExample: "94231234", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "PY", displayName: "Paraguay", callingCode: "595", fixedExample: "212345678", mobileExample: "961456789", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "GY", displayName: "Guyana", callingCode: "592", fixedExample: "2201234", mobileExample: "6091234", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "SR", displayName: "Suriname", callingCode: "597", fixedExample: "211234", mobileExample: "7412345", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["7"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "CU", displayName: "Cuba", callingCode: "53", fixedExample: "71234567", mobileExample: "51234567", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["5"], landlinePrefixes: ["7"] }),
  buildIntlOnlyRule({ iso2: "HT", displayName: "Haiti", callingCode: "509", fixedExample: "22453300", mobileExample: "34101234", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["3"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "AW", displayName: "Aruba", callingCode: "297", fixedExample: "5212345", mobileExample: "5601234", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["5"], landlinePrefixes: ["5"] }),
  buildIntlOnlyRule({ iso2: "CW", displayName: "Curacao", callingCode: "599", fixedExample: "94351234", mobileExample: "95181234", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["9"], landlinePrefixes: ["9"] }),
  buildIntlOnlyRule({ iso2: "BQ", displayName: "Bonaire", callingCode: "599", fixedExample: "7151234", mobileExample: "3181234", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["3"], landlinePrefixes: ["7"] }),
  buildIntlOnlyRule({ iso2: "GF", displayName: "French Guiana", callingCode: "594", fixedExample: "594101234", mobileExample: "694201234", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["5"] }),
  buildIntlOnlyRule({ iso2: "GP", displayName: "Guadeloupe", callingCode: "590", fixedExample: "590201234", mobileExample: "690001234", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["5"] }),
  buildIntlOnlyRule({ iso2: "MQ", displayName: "Martinique", callingCode: "596", fixedExample: "596301234", mobileExample: "696201234", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["5"] }),
  buildIntlOnlyRule({ iso2: "RE", displayName: "Reunion", callingCode: "262", fixedExample: "262161234", mobileExample: "692123456", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "YT", displayName: "Mayotte", callingCode: "262", fixedExample: "269601234", mobileExample: "639012345", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["6"], landlinePrefixes: ["2"] }),
  buildIntlOnlyRule({ iso2: "PM", displayName: "Saint Pierre and Miquelon", callingCode: "508", fixedExample: "430123", mobileExample: "551234", labels: { mobile: "Mobile", landline: "Landline" }, mobilePrefixes: ["5"], landlinePrefixes: ["4"] }),
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
