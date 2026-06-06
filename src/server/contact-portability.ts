export type PortableContactInput = {
  fullName: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
};

type CsvParseResult = {
  contacts: PortableContactInput[];
  totalRows: number;
  skippedCount: number;
  errors: string[];
};

const normalizeHeader = (value: string) => value.trim().toLowerCase();

const HEADER_ALIASES = {
  fullName: ["fullname", "full name", "name", "display name"],
  firstName: ["first name", "firstname", "given name"],
  lastName: ["last name", "lastname", "family name", "surname"],
  email: ["email", "email address", "e-mail", "e-mail 1 - value"],
  phone: ["phone", "mobile phone", "phone 1 - value", "primary phone"],
  company: ["company", "organization", "organisation", "organization 1 - name"],
  notes: ["notes", "memo", "description"],
} as const;

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
  return value ? value : undefined;
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

export const parseCsvContacts = (csvText: string): CsvParseResult => {
  const rows = splitCsvRows(csvText).filter((row) => row.some((field) => field.trim().length > 0));

  if (rows.length < 2) {
    throw new Error("Add a header row and at least one contact row to import CSV data.");
  }

  const headers = rows[0] ?? [];
  const fullNameIndex = getIndex(headers, HEADER_ALIASES.fullName);
  const firstNameIndex = getIndex(headers, HEADER_ALIASES.firstName);
  const lastNameIndex = getIndex(headers, HEADER_ALIASES.lastName);
  const emailIndex = getIndex(headers, HEADER_ALIASES.email);
  const phoneIndex = getIndex(headers, HEADER_ALIASES.phone);
  const companyIndex = getIndex(headers, HEADER_ALIASES.company);
  const notesIndex = getIndex(headers, HEADER_ALIASES.notes);

  const contacts: PortableContactInput[] = [];
  const errors: string[] = [];
  let skippedCount = 0;

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
    const fullName = explicitFullName || fallbackName || email || phone || company;

    if (!fullName) {
      skippedCount += 1;
      errors.push(`Row ${rowNumber} skipped because it had no name or usable identifier.`);
      return;
    }

    contacts.push({
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
    errors,
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
