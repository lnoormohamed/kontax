export const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  email: "Email address",
  phone: "Phone",
  company: "Company",
  jobTitle: "Job title",
  "address.street": "Street address",
  "address.city": "City",
  "address.state": "State / Province",
  "address.postalCode": "Postal code",
  "address.country": "Country",
  birthday: "Birthday",
  website: "Website",
  notes: "Notes",
};

export type Suggestion = {
  field: KontaxField;
  confidence: number;
  label: string;
};

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

export const PHONE_LABEL_ALIASES: Record<string, string> = {
  mobile: "Mobile", cell: "Mobile", cellular: "Mobile",
  work: "Work", office: "Work", business: "Work",
  home: "Home", personal: "Home",
  fax: "Fax",
};

export function normalizeLabelAlias(label: string | null): string | null {
  if (!label) return null;
  return PHONE_LABEL_ALIASES[label.toLowerCase()] ?? label;
}

export function detectMultiValue(
  sampleValues: string[],
  field: KontaxField | "custom",
): { detected: boolean; delimiter: string | null; exampleCount: number } {
  if (field !== "phone" && field !== "email") {
    return { detected: false, delimiter: null, exampleCount: 0 };
  }
  const DELIMITERS = [";", "|", "\n", " :: "];
  for (const delimiter of DELIMITERS) {
    const multiValueCount = sampleValues.filter(
      (v) => v.includes(delimiter) && v.split(delimiter).length > 1,
    ).length;
    if (sampleValues.length > 0 && multiValueCount >= Math.ceil(sampleValues.length * 0.3)) {
      const maxCount = Math.max(...sampleValues.map((v) => v.split(delimiter).length));
      return { detected: true, delimiter, exampleCount: maxCount };
    }
  }
  return { detected: false, delimiter: null, exampleCount: 0 };
}

export function extractLabeledValues(
  rawValue: string,
  delimiter: string,
): Array<{ label: string | null; value: string }> {
  return rawValue
    .split(delimiter)
    .map((part) => {
      const trimmed = part.trim();
      const labelMatch = /^([A-Za-z\s]+):\s*(.+)$/.exec(trimmed);
      if (labelMatch) {
        return { label: labelMatch[1]!.trim(), value: labelMatch[2]!.trim() };
      }
      return { label: null, value: trimmed };
    })
    .filter((p) => p.value.length > 0);
}

export function generateSuggestions(
  header: string,
  sampleValues: string[],
  columnIndex: number,
): Suggestion[] {
  const allScores = COLUMN_PATTERNS.map((pattern) => {
    const headerScore = pattern.patterns.some((p) => p.test(header.trim())) ? 0.6 : 0;
    const validCount = pattern.valueValidator
      ? sampleValues.filter(pattern.valueValidator).length
      : 0;
    const valueScore = sampleValues.length > 0 ? (validCount / sampleValues.length) * 0.3 : 0;
    const positionScore = getPositionScore(pattern.field, columnIndex) * 0.1;
    return {
      field: pattern.field,
      confidence: headerScore + valueScore + positionScore,
      label: FIELD_LABELS[pattern.field] ?? pattern.field,
    };
  });

  return allScores
    .filter((s) => s.confidence > 0.1)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}
