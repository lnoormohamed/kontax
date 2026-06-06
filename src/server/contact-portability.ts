export type PortableContactInput = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
};

export type CsvImportProfile = "GENERIC" | "GOOGLE" | "APPLE" | "OUTLOOK";

export type ImportPreviewIssue = {
  rowNumber: number;
  severity: "error" | "warning";
  message: string;
};

export type ImportPreviewContact = PortableContactInput & {
  rowNumber: number;
};

type CsvParseResult = {
  contacts: ImportPreviewContact[];
  totalRows: number;
  skippedCount: number;
  issues: ImportPreviewIssue[];
  profile: CsvImportProfile;
};

const normalizeHeader = (value: string) => value.trim().toLowerCase();

const HEADER_ALIASES: Record<
  CsvImportProfile,
  {
    fullName: string[];
    firstName: string[];
    lastName: string[];
    email: string[];
    phone: string[];
    company: string[];
    notes: string[];
  }
> = {
  GENERIC: {
    fullName: ["fullname", "full name", "name", "display name"],
    firstName: ["first name", "firstname", "given name"],
    lastName: ["last name", "lastname", "family name", "surname"],
    email: ["email", "email address", "e-mail", "e-mail 1 - value"],
    phone: ["phone", "mobile phone", "phone 1 - value", "primary phone"],
    company: ["company", "organization", "organisation", "organization 1 - name"],
    notes: ["notes", "memo", "description"],
  },
  GOOGLE: {
    fullName: ["name", "full name"],
    firstName: ["given name", "first name"],
    lastName: ["family name", "last name"],
    email: ["e-mail 1 - value", "email", "email address"],
    phone: ["phone 1 - value", "mobile phone", "phone"],
    company: ["organization 1 - name", "company", "organization"],
    notes: ["notes", "memo"],
  },
  APPLE: {
    fullName: ["name", "full name"],
    firstName: ["first name", "given name"],
    lastName: ["last name", "family name"],
    email: ["email", "email address"],
    phone: ["phone", "mobile phone"],
    company: ["company", "organization"],
    notes: ["note", "notes"],
  },
  OUTLOOK: {
    fullName: ["name", "full name"],
    firstName: ["first name", "given name"],
    lastName: ["last name", "surname", "family name"],
    email: ["e-mail address", "email address", "email"],
    phone: ["mobile phone", "business phone", "phone"],
    company: ["company", "organization"],
    notes: ["notes", "description"],
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

  return rows;
};

const getIndex = (headers: string[], aliases: readonly string[]) => {
  const aliasSet = new Set(aliases.map(normalizeHeader));
  return headers.findIndex((header) => aliasSet.has(normalizeHeader(header)));
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
): CsvParseResult => {
  const rows = splitCsvRows(csvText).filter((row) => row.some((field) => field.trim().length > 0));

  if (rows.length < 2) {
    throw new Error("Add a header row and at least one contact row to import CSV data.");
  }

  const headers = rows[0] ?? [];
  const fullNameIndex = getIndex(headers, getAliasesForField(profile, "fullName"));
  const firstNameIndex = getIndex(headers, getAliasesForField(profile, "firstName"));
  const lastNameIndex = getIndex(headers, getAliasesForField(profile, "lastName"));
  const emailIndex = getIndex(headers, getAliasesForField(profile, "email"));
  const phoneIndex = getIndex(headers, getAliasesForField(profile, "phone"));
  const companyIndex = getIndex(headers, getAliasesForField(profile, "company"));
  const notesIndex = getIndex(headers, getAliasesForField(profile, "notes"));

  const contacts: ImportPreviewContact[] = [];
  const issues: ImportPreviewIssue[] = [];
  let skippedCount = 0;
  const seenEmails = new Map<string, number>();
  const seenPhones = new Map<string, number>();

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const explicitFullName = getValue(row, fullNameIndex);
    const firstName = getValue(row, firstNameIndex);
    const lastName = getValue(row, lastNameIndex);
    const email = getValue(row, emailIndex)?.toLowerCase();
    const phone = getValue(row, phoneIndex);
    const company = getValue(row, companyIndex);
    const notes = getValue(row, notesIndex);
    const fallbackName = [firstName, lastName].filter(Boolean).join(" ").trim();
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

    if (email && !emailPattern.test(email)) {
      skippedCount += 1;
      issues.push({
        rowNumber,
        severity: "error",
        message: `Skipped because "${email}" is not a valid email address.`,
      });
      return;
    }

    if (email) {
      const duplicateEmailRow = seenEmails.get(email);
      if (duplicateEmailRow) {
        issues.push({
          rowNumber,
          severity: "warning",
          message: `Shares email ${email} with row ${duplicateEmailRow}.`,
        });
      } else {
        seenEmails.set(email, rowNumber);
      }
    }

    if (phone) {
      const duplicatePhoneRow = seenPhones.get(phone);
      if (duplicatePhoneRow) {
        issues.push({
          rowNumber,
          severity: "warning",
          message: `Shares phone ${phone} with row ${duplicatePhoneRow}.`,
        });
      } else {
        seenPhones.set(phone, rowNumber);
      }
    }

    contacts.push({
      rowNumber,
      fullName,
      email,
      phone,
      company,
      notes,
    });
  });

  return {
    contacts,
    totalRows: rows.length - 1,
    skippedCount,
    issues,
    profile,
  };
};

export const contactsToCsv = (contacts: PortableContactInput[]) => {
  const header = ["Full Name", "Email", "Phone", "Company", "Notes"];
  const rows = contacts.map((contact) => [
    escapeCsv(contact.fullName),
    escapeCsv(contact.email ?? ""),
    escapeCsv(contact.phone ?? ""),
    escapeCsv(contact.company ?? ""),
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

      if (contact.email) {
        lines.push(`EMAIL:${escapeVCard(contact.email)}`);
      }

      if (contact.phone) {
        lines.push(`TEL:${escapeVCard(contact.phone)}`);
      }

      if (contact.company) {
        lines.push(`ORG:${escapeVCard(contact.company)}`);
      }

      if (contact.notes) {
        lines.push(`NOTE:${escapeVCard(contact.notes)}`);
      }

      lines.push("END:VCARD");
      return lines.join("\r\n");
    })
    .join("\r\n");
