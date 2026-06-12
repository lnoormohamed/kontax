export type KontaxField =
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "phone"
  | "company"
  | "jobTitle"
  | "address.street"
  | "address.city"
  | "address.state"
  | "address.postalCode"
  | "address.country"
  | "birthday"
  | "website"
  | "notes";

export type ConfidenceTier = "HIGH" | "MEDIUM" | "LOW";

export type ColumnClassification = {
  field: KontaxField | "custom";
  confidence: number;
  confidenceTier: ConfidenceTier;
};

type ColumnPattern = {
  field: KontaxField;
  patterns: RegExp[];
  valueValidator?: (v: string) => boolean;
};

const COLUMN_PATTERNS: ColumnPattern[] = [
  {
    field: "firstName",
    patterns: [/^(first\s*name|given\s*name|forename|pr[eé]nom|vorname)$/i],
  },
  {
    field: "lastName",
    patterns: [/^(last\s*name|surname|family\s*name|nom|nachname)$/i],
  },
  {
    field: "fullName",
    patterns: [/^(name|full\s*name|display\s*name|contact\s*name)$/i],
  },
  {
    field: "email",
    patterns: [/^(e[\s\-]?mail(\s*(address)?)?|e\.mail|correo)$/i],
    valueValidator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  },
  {
    field: "phone",
    patterns: [/^(phone|tel(ephone)?|mobile|cell|number|fax|work\s+phone|home\s+phone)$/i],
    valueValidator: (v) => /^[\d\s()+\-.]{7,20}$/.test(v),
  },
  {
    field: "company",
    patterns: [/^(company|organisation|organization|employer|firm|business)$/i],
  },
  {
    field: "jobTitle",
    patterns: [/^(title|job\s*title|position|role|occupation)$/i],
  },
  {
    field: "birthday",
    patterns: [/^(birth\s*day|date\s+of\s+birth|dob|born)$/i],
    valueValidator: (v) =>
      /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(v) ||
      /^\d{1,2}[-/]\d{1,2}([-/]\d{2,4})?$/.test(v),
  },
  {
    field: "website",
    patterns: [/^(website|url|web|homepage|site)$/i],
    valueValidator: (v) => /^https?:\/\//.test(v),
  },
  {
    field: "notes",
    patterns: [/^(notes?|comments?|description|memo|remarks?)$/i],
  },
  {
    field: "address.street",
    patterns: [/^(street|address(\s+1)?|addr|street\s+address)$/i],
  },
  {
    field: "address.city",
    patterns: [/^(city|town|locality|suburb)$/i],
  },
  {
    field: "address.state",
    patterns: [/^(state|province|region|county)$/i],
  },
  {
    field: "address.postalCode",
    patterns: [/^(postal\s*(code)?|zip(\s*code)?|postcode)$/i],
    valueValidator: (v) => /^[\dA-Z\s-]{3,10}$/i.test(v),
  },
  {
    field: "address.country",
    patterns: [/^(country|nation|land)$/i],
  },
];

function getPositionScore(field: KontaxField, index: number): number {
  if (index === 0 && field === "firstName") return 1;
  if (index === 1 && (field === "lastName" || field === "email")) return 0.5;
  return 0;
}

export function classifyColumn(
  header: string,
  sampleValues: string[],
  columnIndex: number,
): ColumnClassification {
  let bestField: KontaxField | "custom" = "custom";
  let bestScore = 0;

  for (const pattern of COLUMN_PATTERNS) {
    const headerMatch = pattern.patterns.some((p) => p.test(header.trim()));
    const headerScore = headerMatch ? 0.6 : 0;

    let valueScore = 0;
    if (pattern.valueValidator && sampleValues.length > 0) {
      const validCount = sampleValues.filter(pattern.valueValidator).length;
      valueScore = (validCount / sampleValues.length) * 0.3;
    }

    const positionScore = getPositionScore(pattern.field, columnIndex) * 0.1;
    const total = headerScore + valueScore + positionScore;

    if (total > bestScore) {
      bestScore = total;
      bestField = pattern.field;
    }
  }

  const field: KontaxField | "custom" = bestScore < 0.3 ? "custom" : bestField;
  const confidenceTier: ConfidenceTier =
    bestScore > 0.85 ? "HIGH" : bestScore > 0.5 ? "MEDIUM" : "LOW";

  return { field, confidence: bestScore, confidenceTier };
}
