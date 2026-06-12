import { classifyColumn, type KontaxField, type ConfidenceTier } from "~/server/import/column-classifier";

export type ColumnMapping = {
  header: string;
  index: number;
  field: KontaxField | "custom";
  confidence: number;
  confidenceTier: ConfidenceTier;
  source: "profile" | "classifier";
  sampleValues: string[];
};

export type ContactPostalAddressInput = {
  label: string;
  formatted: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const parseContactStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

export const parseContactPostalAddresses = (value: unknown): ContactPostalAddressInput[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        if (!isRecord(item)) {
          return [];
        }

        const rawLabel = item.label;
        const rawFormatted = item.formatted;
        const label = typeof rawLabel === "string" ? rawLabel : "other";
        const formatted = typeof rawFormatted === "string" ? rawFormatted : null;

        return formatted?.trim().length ? [{ label, formatted }] : [];
      })
    : [];

export type PortableContactInput = {
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneticFirstName?: string | null;
  phoneticLastName?: string | null;
  nickname?: string | null;
  email?: string | null;
  emailAddresses?: string[] | null;
  phone?: string | null;
  phoneNumbers?: string[] | null;
  company?: string | null;
  phoneticCompany?: string | null;
  jobTitle?: string | null;
  website?: string | null;
  birthday?: string | null;
  address?: string | null;
  postalAddresses?: ContactPostalAddressInput[] | null;
  notes?: string | null;
};

export type CsvImportProfile = "GENERIC" | "GOOGLE" | "APPLE" | "OUTLOOK";

export type ExplicitColumnMapping = {
  index: number;
  targetField: string; // KontaxField | "custom" | "skip"
};

export type ImportPreviewIssue = {
  rowNumber: number;
  severity: "error" | "warning";
  message: string;
};

export type ImportPreviewContact = PortableContactInput & {
  rowNumber: number;
};

export type ImportPreviewDuplicateGroup = {
  kind: "email" | "phone" | "name-company";
  value: string;
  rowNumbers: number[];
  confidence: "high" | "medium";
};

type CsvParseResult = {
  contacts: ImportPreviewContact[];
  totalRows: number;
  skippedCount: number;
  issues: ImportPreviewIssue[];
  profile: CsvImportProfile;
  duplicateGroups: ImportPreviewDuplicateGroup[];
  canImport: boolean;
  blockingReasons: string[];
  columnMappings: ColumnMapping[];
};

const normalizeHeader = (value: string) => value.trim().toLowerCase();

const HEADER_ALIASES: Record<
  CsvImportProfile,
  {
    fullName: string[];
    firstName: string[];
    lastName: string[];
    phoneticFirstName: string[];
    phoneticLastName: string[];
    nickname: string[];
    email: string[];
    phone: string[];
    company: string[];
    phoneticCompany: string[];
    jobTitle: string[];
    website: string[];
    birthday: string[];
    address: string[];
    notes: string[];
  }
> = {
  GENERIC: {
    fullName: [
      "fullname",
      "full name",
      "name",
      "display name",
      "file as",
      "contact name",
      "customer name",
      "contact",
    ],
    firstName: [
      "first name",
      "firstname",
      "given name",
      "givenname",
      "forename",
      "first",
    ],
    lastName: [
      "last name",
      "lastname",
      "family name",
      "familyname",
      "surname",
      "last",
      "second name",
    ],
    phoneticFirstName: [
      "pinyin first name",
      "phonetic first name",
      "yomi first name",
      "reading first name",
      "first name reading",
    ],
    phoneticLastName: [
      "pinyin last name",
      "phonetic last name",
      "yomi last name",
      "reading last name",
      "last name reading",
    ],
    nickname: ["nickname", "nick name", "short name", "preferred name", "alias"],
    email: [
      "email",
      "email address",
      "e-mail",
      "e-mail address",
      "e-mail 1 - value",
      "e-mail 2 - value",
      "e-mail 3 - value",
      "e-mail 1 address",
      "e-mail 2 address",
      "e-mail 3 address",
      "primary email",
      "email 1 value",
      "email 2 value",
      "email 3 value",
      "email 1",
      "email 2",
      "email 3",
      "home email",
      "work email",
      "other email",
    ],
    phone: [
      "phone",
      "mobile phone",
      "phone 1 - value",
      "phone 2 - value",
      "phone 3 - value",
      "primary phone",
      "phone 1 value",
      "phone 2 value",
      "phone 3 value",
      "cell phone",
      "telephone",
      "mobile",
      "home phone",
      "business phone",
      "work phone",
      "other phone",
      "main phone",
      "company main phone",
    ],
    company: [
      "company",
      "company name",
      "organization",
      "organisation",
      "organization 1 - name",
      "business name",
      "employer",
      "business",
    ],
    phoneticCompany: [
      "pinyin company",
      "phonetic company",
      "yomi company",
      "company reading",
      "organization yomi",
    ],
    jobTitle: ["job title", "title", "role", "position", "profession"],
    website: ["website", "web site", "url", "homepage", "home page"],
    birthday: ["birthday", "birth date", "date of birth", "dob"],
    address: [
      "address",
      "street address",
      "home address",
      "work address",
      "mailing address",
      "address 1 - formatted",
      "formatted address",
    ],
    notes: [
      "notes",
      "memo",
      "description",
      "comment",
      "comments",
      "note",
      "personal notes",
      "content",
    ],
  },
  GOOGLE: {
    fullName: ["name", "full name", "file as", "nickname"],
    firstName: ["given name", "first name", "additional name", "name prefix", "givenname"],
    lastName: ["family name", "last name", "name suffix", "familyname"],
    phoneticFirstName: ["given name yomi", "first name yomi", "pinyin first name"],
    phoneticLastName: ["family name yomi", "last name yomi", "pinyin last name"],
    nickname: ["nickname", "name"],
    email: [
      "e-mail 1 - value",
      "e-mail 2 - value",
      "e-mail 3 - value",
      "email",
      "email address",
      "e-mail address",
    ],
    phone: [
      "phone 1 - value",
      "phone 2 - value",
      "phone 3 - value",
      "mobile phone",
      "phone",
      "organization 1 - phone",
    ],
    company: [
      "organization 1 - name",
      "organization 2 - name",
      "company",
      "organization",
      "organization 1 - title",
    ],
    phoneticCompany: ["organization 1 yomi name", "organization 2 yomi name", "pinyin company"],
    jobTitle: ["organization 1 - title", "organization 2 - title", "job title", "title"],
    website: ["website 1 - value", "website 2 - value", "website", "homepage"],
    birthday: ["birthday", "event 1 - value", "date of birth"],
    address: ["address 1 - formatted", "address 2 - formatted", "formatted address", "home address"],
    notes: ["notes", "memo", "billing information", "directory server", "keywords"],
  },
  APPLE: {
    fullName: ["name", "full name", "display name", "card", "nickname"],
    firstName: ["first name", "given name", "first", "middle name"],
    lastName: ["last name", "family name", "last", "maiden name"],
    phoneticFirstName: ["phonetic first name", "first name phonetic", "pinyin first name"],
    phoneticLastName: ["phonetic last name", "last name phonetic", "pinyin last name"],
    nickname: ["nickname", "maiden name"],
    email: [
      "email",
      "email address",
      "home email",
      "work email",
      "icloud email",
      "other email",
    ],
    phone: [
      "phone",
      "mobile phone",
      "iphone",
      "main phone",
      "home phone",
      "work phone",
      "other phone",
    ],
    company: ["company", "organization", "department", "job title", "organization name"],
    phoneticCompany: ["phonetic company", "organization phonetic", "pinyin company"],
    jobTitle: ["job title", "title", "department"],
    website: ["url", "website", "homepage"],
    birthday: ["birthday", "date of birth"],
    address: ["address", "home address", "work address", "street"],
    notes: ["note", "notes", "related names", "label"],
  },
  OUTLOOK: {
    fullName: ["name", "full name", "file as", "display name"],
    firstName: ["first name", "given name", "forename", "middle name"],
    lastName: ["last name", "surname", "family name", "last"],
    phoneticFirstName: ["yomi first name", "phonetic first name", "pinyin first name"],
    phoneticLastName: ["yomi last name", "phonetic last name", "pinyin last name"],
    nickname: ["nickname", "yomi first name"],
    email: [
      "e-mail address",
      "e-mail 2 address",
      "e-mail 3 address",
      "email address",
      "email",
      "e-mail",
    ],
    phone: [
      "mobile phone",
      "business phone",
      "business phone 2",
      "home phone",
      "home phone 2",
      "car phone",
      "primary phone",
      "phone",
      "other phone",
      "radio phone",
    ],
    company: ["company", "organization", "department", "office location", "profession"],
    phoneticCompany: ["company yomi", "phonetic company", "pinyin company"],
    jobTitle: ["job title", "title", "profession", "department"],
    website: ["web page", "website", "homepage", "personal web page"],
    birthday: ["birthday", "anniversary", "date of birth"],
    address: ["business street", "home street", "other street", "street address", "address"],
    notes: ["notes", "description", "billing information", "location", "keywords"],
  },
};

const splitCsvRows = (csvText: string) => {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;
  const text = csvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  currentRow.push(currentField);
  if (currentRow.some((field) => field.length > 0)) {
    rows.push(currentRow);
  }

  if (inQuotes) {
    throw new Error("The CSV appears to contain an unmatched quote. Please fix the file and try again.");
  }

  return rows;
};

const getIndexes = (headers: string[], aliases: readonly string[]) => {
  const aliasSet = new Set(aliases.map(normalizeHeader));
  return headers.flatMap((header, index) =>
    aliasSet.has(normalizeHeader(header)) ? [index] : [],
  );
};

const getValue = (row: string[], index: number) => {
  if (index < 0) {
    return undefined;
  }

  const value = row[index]?.trim();
  if (value === "") {
    return undefined;
  }

  return value;
};

const getFirstValue = (row: string[], indexes: number[]) => {
  for (const index of indexes) {
    const value = getValue(row, index);
    if (value != null) {
      return value;
    }
  }

  return undefined;
};

const getAllValues = (row: string[], indexes: number[]) => {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const index of indexes) {
    const value = getValue(row, index);
    if (!value) {
      continue;
    }

    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    values.push(value);
  }

  return values;
};

const escapeCsv = (value: string) => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

const escapeVCard = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getAliasesForField = (
  profile: CsvImportProfile,
  field: keyof (typeof HEADER_ALIASES)["GENERIC"],
) => {
  const profileAliases = HEADER_ALIASES[profile][field];
  const genericAliases = HEADER_ALIASES.GENERIC[field];
  return [...new Set([...profileAliases, ...genericAliases])];
};

export const parseCsvContacts = (
  csvText: string,
  profile: CsvImportProfile = "GENERIC",
  explicitMappings?: ExplicitColumnMapping[],
): CsvParseResult => {
  const rows = splitCsvRows(csvText).filter((row) => row.some((field) => field.trim().length > 0));

  if (rows.length < 2) {
    throw new Error("Add a header row and at least one contact row to import CSV data.");
  }

  const headers = rows[0] ?? [];
  const normalizedHeaders = headers.map(normalizeHeader);
  const duplicateHeaders = normalizedHeaders.filter(
    (header, index) => header.length > 0 && normalizedHeaders.indexOf(header) !== index,
  );
  const blankHeaderCount = headers.filter((header) => header.trim() === "").length;
  let fullNameIndexes = getIndexes(headers, getAliasesForField(profile, "fullName"));
  let firstNameIndexes = getIndexes(headers, getAliasesForField(profile, "firstName"));
  let lastNameIndexes = getIndexes(headers, getAliasesForField(profile, "lastName"));
  let phoneticFirstNameIndexes = getIndexes(headers, getAliasesForField(profile, "phoneticFirstName"));
  let phoneticLastNameIndexes = getIndexes(headers, getAliasesForField(profile, "phoneticLastName"));
  let nicknameIndexes = getIndexes(headers, getAliasesForField(profile, "nickname"));
  let emailIndexes = getIndexes(headers, getAliasesForField(profile, "email"));
  let phoneIndexes = getIndexes(headers, getAliasesForField(profile, "phone"));
  let companyIndexes = getIndexes(headers, getAliasesForField(profile, "company"));
  let phoneticCompanyIndexes = getIndexes(headers, getAliasesForField(profile, "phoneticCompany"));
  let jobTitleIndexes = getIndexes(headers, getAliasesForField(profile, "jobTitle"));
  let websiteIndexes = getIndexes(headers, getAliasesForField(profile, "website"));
  let birthdayIndexes = getIndexes(headers, getAliasesForField(profile, "birthday"));
  let addressIndexes = getIndexes(headers, getAliasesForField(profile, "address"));
  let notesIndexes = getIndexes(headers, getAliasesForField(profile, "notes"));

  // When the user has confirmed a field mapping in the UI, override profile-based detection.
  if (explicitMappings && explicitMappings.length > 0) {
    fullNameIndexes = [];
    firstNameIndexes = [];
    lastNameIndexes = [];
    phoneticFirstNameIndexes = [];
    phoneticLastNameIndexes = [];
    nicknameIndexes = [];
    emailIndexes = [];
    phoneIndexes = [];
    companyIndexes = [];
    phoneticCompanyIndexes = [];
    jobTitleIndexes = [];
    websiteIndexes = [];
    birthdayIndexes = [];
    addressIndexes = [];
    notesIndexes = [];
    for (const { index, targetField } of explicitMappings) {
      switch (targetField) {
        case "firstName": firstNameIndexes.push(index); break;
        case "lastName": lastNameIndexes.push(index); break;
        case "fullName": fullNameIndexes.push(index); break;
        case "email": emailIndexes.push(index); break;
        case "phone": phoneIndexes.push(index); break;
        case "company": companyIndexes.push(index); break;
        case "jobTitle": jobTitleIndexes.push(index); break;
        case "address.street":
        case "address.city":
        case "address.state":
        case "address.postalCode":
        case "address.country":
          addressIndexes.push(index); break;
        case "birthday": birthdayIndexes.push(index); break;
        case "website": websiteIndexes.push(index); break;
        case "notes": notesIndexes.push(index); break;
        default: break; // "skip" and "custom" are excluded
      }
    }
  }
  const recognizedFieldIndexes = [
    ...fullNameIndexes,
    ...firstNameIndexes,
    ...lastNameIndexes,
    ...phoneticFirstNameIndexes,
    ...phoneticLastNameIndexes,
    ...nicknameIndexes,
    ...emailIndexes,
    ...phoneIndexes,
    ...companyIndexes,
    ...phoneticCompanyIndexes,
    ...jobTitleIndexes,
    ...websiteIndexes,
    ...birthdayIndexes,
    ...addressIndexes,
    ...notesIndexes,
  ];

  if (recognizedFieldIndexes.length === 0) {
    throw new Error(
      `We could not recognize any supported columns for the ${profile.toLowerCase()} CSV profile.`,
    );
  }

  // Build index→field reverse map for profile-matched columns so we can
  // report HIGH-confidence mappings without re-running the classifier on them.
  const profileFieldMap = new Map<number, KontaxField>();
  const profileIndexSets: Array<[KontaxField, number[]]> = [
    ["fullName", fullNameIndexes],
    ["firstName", firstNameIndexes],
    ["lastName", lastNameIndexes],
    ["email", emailIndexes],
    ["phone", phoneIndexes],
    ["company", companyIndexes],
    ["jobTitle", jobTitleIndexes],
    ["website", websiteIndexes],
    ["birthday", birthdayIndexes],
    ["notes", notesIndexes],
    // Phonetic and nickname fields map to their closest consumer-visible field.
    ["firstName", phoneticFirstNameIndexes],
    ["lastName", phoneticLastNameIndexes],
    ["fullName", nicknameIndexes],
    ["company", phoneticCompanyIndexes],
  ];
  for (const [field, indexes] of profileIndexSets) {
    for (const idx of indexes) {
      if (!profileFieldMap.has(idx)) profileFieldMap.set(idx, field);
    }
  }

  // address indexes are typed as a generic string field on the profile side;
  // map them to the address.street classifier field for consistency.
  for (const idx of addressIndexes) {
    if (!profileFieldMap.has(idx)) profileFieldMap.set(idx, "address.street");
  }

  const dataRows = rows.slice(1);
  const columnMappings: ColumnMapping[] = headers.map((header, index) => {
    const sampleValues = dataRows
      .slice(0, 5)
      .map((r) => r[index]?.trim() ?? "")
      .filter(Boolean);

    const profileField = profileFieldMap.get(index);
    if (profileField !== undefined) {
      return {
        header,
        index,
        field: profileField,
        confidence: 1.0,
        confidenceTier: "HIGH" as const,
        source: "profile" as const,
        sampleValues,
      };
    }

    const classification = classifyColumn(header, sampleValues, index);
    return {
      header,
      index,
      ...classification,
      source: "classifier" as const,
      sampleValues,
    };
  });

  const contacts: ImportPreviewContact[] = [];
  const issues: ImportPreviewIssue[] = [];
  let skippedCount = 0;
  const seenEmails = new Map<string, number[]>();
  const seenPhones = new Map<string, number[]>();
  const seenNameCompanyPairs = new Map<string, { label: string; rowNumbers: number[] }>();
  const ignoredHeaders = headers.filter(
    (_, index) => !recognizedFieldIndexes.includes(index),
  );

  if (duplicateHeaders.length > 0) {
    issues.push({
      rowNumber: 1,
      severity: "warning",
      message: `Duplicate headers detected: ${[...new Set(duplicateHeaders)].join(", ")}.`,
    });
  }

  if (blankHeaderCount > 0) {
    issues.push({
      rowNumber: 1,
      severity: "warning",
      message: `${blankHeaderCount} blank column header${blankHeaderCount === 1 ? "" : "s"} detected. Those columns will be ignored.`,
    });
  }

  if (ignoredHeaders.length > 0) {
    issues.push({
      rowNumber: 1,
      severity: "warning",
      message: `Ignoring unsupported columns: ${ignoredHeaders.slice(0, 6).join(", ")}${
        ignoredHeaders.length > 6 ? ", ..." : ""
      }.`,
    });
  }

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const expectedColumnCount = headers.length;
    const actualColumnCount = row.length;
    const explicitFullName = getFirstValue(row, fullNameIndexes);
    const firstName = getFirstValue(row, firstNameIndexes);
    const lastName = getFirstValue(row, lastNameIndexes);
    const phoneticFirstName = getFirstValue(row, phoneticFirstNameIndexes);
    const phoneticLastName = getFirstValue(row, phoneticLastNameIndexes);
    const nickname = getFirstValue(row, nicknameIndexes);
    const email = getFirstValue(row, emailIndexes)?.toLowerCase();
    const emailAddresses = getAllValues(row, emailIndexes).map((value) => value.toLowerCase());
    const phone = getFirstValue(row, phoneIndexes);
    const phoneNumbers = getAllValues(row, phoneIndexes);
    const company = getFirstValue(row, companyIndexes);
    const phoneticCompany = getFirstValue(row, phoneticCompanyIndexes);
    const jobTitle = getFirstValue(row, jobTitleIndexes);
    const website = getFirstValue(row, websiteIndexes);
    const birthday = getFirstValue(row, birthdayIndexes);
    const address = getFirstValue(row, addressIndexes);
    const postalAddressValues = getAllValues(row, addressIndexes);
    const notes = getFirstValue(row, notesIndexes);
    const fallbackName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const usedFallbackIdentifier =
      explicitFullName == null &&
      (fallbackName !== "" || email != null || phone != null || company != null);
    const fullName =
      explicitFullName ??
      (fallbackName === "" ? undefined : fallbackName) ??
      email ??
      phone ??
      company;

    if (!fullName) {
      skippedCount += 1;
      issues.push({
        rowNumber,
        severity: "error",
        message: "Skipped because the row had no name or usable identifier.",
      });
      return;
    }

    if (actualColumnCount !== expectedColumnCount) {
      issues.push({
        rowNumber,
        severity: "warning",
        message: `Column count mismatch: expected ${expectedColumnCount}, received ${actualColumnCount}. Review this row carefully before importing.`,
      });
    }

    const invalidEmailValue = emailAddresses.find((value) => !emailPattern.test(value));

    if (invalidEmailValue) {
      skippedCount += 1;
      issues.push({
        rowNumber,
        severity: "error",
        message: `Skipped because "${invalidEmailValue}" is not a valid email address.`,
      });
      return;
    }

    for (const emailValue of emailAddresses) {
      const duplicateEmailRows = seenEmails.get(emailValue) ?? [];
      if (duplicateEmailRows.length > 0) {
        issues.push({
          rowNumber,
          severity: "warning",
          message: `Shares email ${emailValue} with row ${duplicateEmailRows[0]}.`,
        });
      }
      seenEmails.set(emailValue, [...duplicateEmailRows, rowNumber]);
    }

    for (const phoneValue of phoneNumbers) {
      const duplicatePhoneRows = seenPhones.get(phoneValue) ?? [];
      if (duplicatePhoneRows.length > 0) {
        issues.push({
          rowNumber,
          severity: "warning",
          message: `Shares phone ${phoneValue} with row ${duplicatePhoneRows[0]}.`,
        });
      }
      seenPhones.set(phoneValue, [...duplicatePhoneRows, rowNumber]);
    }

    if (usedFallbackIdentifier) {
      issues.push({
        rowNumber,
        severity: "warning",
        message:
          "No explicit full name value was present, so Kontax will import this row using a fallback identifier.",
      });
    }

    if (email == null && phone == null) {
      issues.push({
        rowNumber,
        severity: "warning",
        message:
          "This row has no email or phone number, so future duplicate detection and sync matching may be weaker.",
      });
    }

    if (notes != null && notes.length > 500) {
      issues.push({
        rowNumber,
        severity: "warning",
        message:
          "Notes are unusually long for this contact and may need a quick review before import.",
      });
    }

    const nameCompanyKey = `${fullName.toLowerCase()}::${company?.toLowerCase() ?? ""}`;
    const duplicateNameCompanyGroup = seenNameCompanyPairs.get(nameCompanyKey);
    if (duplicateNameCompanyGroup) {
      issues.push({
        rowNumber,
        severity: "warning",
        message: `Shares the same name/company shape as row ${duplicateNameCompanyGroup.rowNumbers[0]}.`,
      });
    }
    seenNameCompanyPairs.set(nameCompanyKey, {
      label: duplicateNameCompanyGroup?.label ?? (company ? `${fullName} · ${company}` : fullName),
      rowNumbers: [...(duplicateNameCompanyGroup?.rowNumbers ?? []), rowNumber],
    });

    contacts.push({
      rowNumber,
      fullName,
      firstName,
      lastName,
      phoneticFirstName,
      phoneticLastName,
      nickname,
      email,
      emailAddresses,
      phone,
      phoneNumbers,
      company,
      phoneticCompany,
      jobTitle,
      website,
      birthday,
      address,
      postalAddresses:
        postalAddressValues.length > 0
          ? postalAddressValues.map((formatted, index) => ({
              label: index === 0 ? "primary" : "other",
              formatted,
            }))
          : undefined,
      notes,
    });
  });

  const duplicateGroups: ImportPreviewDuplicateGroup[] = [
    ...[...seenEmails.entries()]
      .filter(([, rowNumbers]) => rowNumbers.length > 1)
      .map(([value, rowNumbers]) => ({
        kind: "email" as const,
        value,
        rowNumbers,
        confidence: "high" as const,
      })),
    ...[...seenPhones.entries()]
      .filter(([, rowNumbers]) => rowNumbers.length > 1)
      .map(([value, rowNumbers]) => ({
        kind: "phone" as const,
        value,
        rowNumbers,
        confidence: "high" as const,
      })),
    ...[...seenNameCompanyPairs.values()]
      .filter((group) => group.rowNumbers.length > 1)
      .map((group) => ({
        kind: "name-company" as const,
        value: group.label,
        rowNumbers: group.rowNumbers,
        confidence: "medium" as const,
      })),
  ];

  const blockingReasons: string[] = [];

  if (contacts.length === 0) {
    blockingReasons.push("No importable contacts remain after validation.");
  }

  const blockingDuplicateGroups = duplicateGroups.filter((group) => group.confidence === "high");
  if (blockingDuplicateGroups.length > 0) {
    blockingReasons.push(
      `Resolve ${blockingDuplicateGroups.length} high-confidence duplicate group${
        blockingDuplicateGroups.length === 1 ? "" : "s"
      } before importing. Kontax blocks duplicate email and phone rows from the same CSV.`,
    );
  }

  return {
    contacts,
    totalRows: rows.length - 1,
    skippedCount,
    issues,
    profile,
    duplicateGroups,
    canImport: blockingReasons.length === 0,
    blockingReasons,
    columnMappings,
  };
};

export const contactsToCsv = (contacts: PortableContactInput[]) => {
  const header = [
    "Full Name",
    "First Name",
    "Last Name",
    "Pinyin First Name",
    "Pinyin Last Name",
    "Nickname",
    "Email",
    "Additional Emails",
    "Phone",
    "Additional Phones",
    "Company",
    "Pinyin Company",
    "Job Title",
    "Website",
    "Birthday",
    "Address",
    "Additional Addresses",
    "Notes",
  ];
  const rows = contacts.map((contact) => [
    escapeCsv(contact.fullName),
    escapeCsv(contact.firstName ?? ""),
    escapeCsv(contact.lastName ?? ""),
    escapeCsv(contact.phoneticFirstName ?? ""),
    escapeCsv(contact.phoneticLastName ?? ""),
    escapeCsv(contact.nickname ?? ""),
    escapeCsv(contact.email ?? ""),
    escapeCsv(
      (contact.emailAddresses ?? [])
        .filter((value) => value !== contact.email)
        .join(" | "),
    ),
    escapeCsv(contact.phone ?? ""),
    escapeCsv(
      (contact.phoneNumbers ?? [])
        .filter((value) => value !== contact.phone)
        .join(" | "),
    ),
    escapeCsv(contact.company ?? ""),
    escapeCsv(contact.phoneticCompany ?? ""),
    escapeCsv(contact.jobTitle ?? ""),
    escapeCsv(contact.website ?? ""),
    escapeCsv(contact.birthday ?? ""),
    escapeCsv(contact.address ?? ""),
    escapeCsv(
      (contact.postalAddresses ?? [])
        .filter((value) => value.formatted !== contact.address)
        .map((value) => value.formatted)
        .join(" | "),
    ),
    escapeCsv(contact.notes ?? ""),
  ]);

  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
};

export const contactsToVCard = (contacts: PortableContactInput[]) =>
  contacts
    .map((contact) => {
      const lines = [
        "BEGIN:VCARD",
        "VERSION:4.0",
        `FN:${escapeVCard(contact.fullName)}`,
      ];

      if (contact.lastName || contact.firstName) {
        lines.push(
          `N:${escapeVCard(contact.lastName ?? "")};${escapeVCard(contact.firstName ?? "")};;;`,
        );
      }

      const pinyinName = [contact.phoneticFirstName, contact.phoneticLastName]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(" ")
        .trim();
      if (pinyinName) {
        lines.push(`SORT-STRING:${escapeVCard(pinyinName)}`);
        lines.push(`X-KONTAX-PINYIN-NAME:${escapeVCard(pinyinName)}`);
      }

      if (contact.phoneticFirstName) {
        lines.push(`X-KONTAX-PINYIN-FIRST-NAME:${escapeVCard(contact.phoneticFirstName)}`);
      }

      if (contact.phoneticLastName) {
        lines.push(`X-KONTAX-PINYIN-LAST-NAME:${escapeVCard(contact.phoneticLastName)}`);
      }

      if (contact.email) {
        lines.push(`EMAIL:${escapeVCard(contact.email)}`);
      }

      for (const emailValue of (contact.emailAddresses ?? []).filter(
        (value) => value !== contact.email,
      )) {
        lines.push(`EMAIL:${escapeVCard(emailValue)}`);
      }

      if (contact.phone) {
        lines.push(`TEL:${escapeVCard(contact.phone)}`);
      }

      for (const phoneValue of (contact.phoneNumbers ?? []).filter(
        (value) => value !== contact.phone,
      )) {
        lines.push(`TEL:${escapeVCard(phoneValue)}`);
      }

      if (contact.nickname) {
        lines.push(`NICKNAME:${escapeVCard(contact.nickname)}`);
      }

      if (contact.company) {
        lines.push(`ORG:${escapeVCard(contact.company)}`);
      }

      if (contact.phoneticCompany) {
        lines.push(`X-KONTAX-PINYIN-COMPANY:${escapeVCard(contact.phoneticCompany)}`);
      }

      if (contact.jobTitle) {
        lines.push(`TITLE:${escapeVCard(contact.jobTitle)}`);
      }

      if (contact.website) {
        lines.push(`URL:${escapeVCard(contact.website)}`);
      }

      if (contact.birthday) {
        lines.push(`BDAY:${escapeVCard(contact.birthday)}`);
      }

      if (contact.address) {
        lines.push(`ADR:;;${escapeVCard(contact.address)};;;;`);
      }

      for (const postalAddress of (contact.postalAddresses ?? []).filter(
        (value) => value.formatted !== contact.address,
      )) {
        lines.push(`ADR:;;${escapeVCard(postalAddress.formatted)};;;;`);
      }

      if (contact.notes) {
        lines.push(`NOTE:${escapeVCard(contact.notes)}`);
      }

      lines.push("END:VCARD");
      return lines.join("\r\n");
    })
    .join("\r\n");
