import { Prisma } from "../../../../../generated/prisma";
import type { Contact } from "../../../../../generated/prisma";
import type { ContactCreateInput, ContactUpdateInput } from "./schemas";

type StructuredEntry = { label: string; value: string; isPrimary: boolean };

function buildEmailEntries(emails: { value: string; label?: string }[] | undefined): {
  email: string | undefined;
  emailAddresses: string[] | undefined;
  emailEntries: StructuredEntry[] | undefined;
} {
  if (!emails?.length) return { email: undefined, emailAddresses: undefined, emailEntries: undefined };

  const seen = new Set<string>();
  const deduped = emails.filter((e) => {
    const key = e.value.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const entries: StructuredEntry[] = deduped.map((e, i) => ({
    label: e.label ?? (i === 0 ? "primary" : "other"),
    value: e.value.trim(),
    isPrimary: i === 0,
  }));

  return {
    email: entries[0]?.value,
    emailAddresses: entries.map((e) => e.value),
    emailEntries: entries,
  };
}

function buildPhoneEntries(phones: { value: string; label?: string }[] | undefined): {
  phone: string | undefined;
  phoneNumbers: string[] | undefined;
  phoneEntries: StructuredEntry[] | undefined;
} {
  if (!phones?.length) return { phone: undefined, phoneNumbers: undefined, phoneEntries: undefined };

  const seen = new Set<string>();
  const deduped = phones.filter((p) => {
    const key = p.value.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const entries: StructuredEntry[] = deduped.map((p, i) => ({
    label: p.label ?? (i === 0 ? "mobile" : "other"),
    value: p.value.trim(),
    isPrimary: i === 0,
  }));

  return {
    phone: entries[0]?.value,
    phoneNumbers: entries.map((e) => e.value),
    phoneEntries: entries,
  };
}

export function deriveFullName(input: ContactCreateInput | ContactUpdateInput): string | null {
  const parts = [input.firstName, input.lastName].filter((v): v is string => !!v?.trim());
  const fromParts = parts.join(" ").trim();
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- empty-string fallback, not just null/undefined
  return input.fullName?.trim() || fromParts || input.company?.trim() || null;
}

export function mapCreateInputToDb(input: ContactCreateInput, userId: string) {
  const fullName = deriveFullName(input);
  if (!fullName) throw new Error("FULL_NAME_REQUIRED");

  const { email, emailAddresses, emailEntries } = buildEmailEntries(input.emails);
  const { phone, phoneNumbers, phoneEntries } = buildPhoneEntries(input.phones);

  return {
    userId,
    fullName,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    company: input.company ?? null,
    jobTitle: input.jobTitle ?? null,
    notes: input.notes ?? null,
    birthday: input.birthday ?? null,
    bookId: input.bookId ?? null,
    email: email ?? null,
    // Prisma requires JsonNull (not TS null) for nullable Json columns
    emailAddresses: emailAddresses ?? Prisma.JsonNull,
    emailEntries: emailEntries ?? Prisma.JsonNull,
    phone: phone ?? null,
    phoneNumbers: phoneNumbers ?? Prisma.JsonNull,
    phoneEntries: phoneEntries ?? Prisma.JsonNull,
    sourceType: "API" as const,
    lastMutatedBy: "API" as const,
  };
}

export function mapUpdateInputToDb(input: ContactUpdateInput) {
  const patch: Record<string, unknown> = {};

  if ("firstName" in input) patch.firstName = input.firstName ?? null;
  if ("lastName" in input) patch.lastName = input.lastName ?? null;
  if ("company" in input) patch.company = input.company ?? null;
  if ("jobTitle" in input) patch.jobTitle = input.jobTitle ?? null;
  if ("notes" in input) patch.notes = input.notes ?? null;
  if ("birthday" in input) patch.birthday = input.birthday ?? null;
  if ("bookId" in input) patch.bookId = input.bookId ?? null;

  if ("emails" in input) {
    const { email, emailAddresses, emailEntries } = buildEmailEntries(input.emails);
    patch.email = email ?? null;
    patch.emailAddresses = emailAddresses ?? Prisma.JsonNull;
    patch.emailEntries = emailEntries ?? Prisma.JsonNull;
  }

  if ("phones" in input) {
    const { phone, phoneNumbers, phoneEntries } = buildPhoneEntries(input.phones);
    patch.phone = phone ?? null;
    patch.phoneNumbers = phoneNumbers ?? Prisma.JsonNull;
    patch.phoneEntries = phoneEntries ?? Prisma.JsonNull;
  }

  // Recompute fullName if any name/company field changed
  if ("firstName" in input || "lastName" in input || "fullName" in input || "company" in input) {
    const full = deriveFullName(input);
    if (full) patch.fullName = full;
  }

  patch.lastMutatedBy = "API";
  return patch;
}

type ApiContactRow = Pick<
  Contact,
  | "id" | "firstName" | "lastName" | "fullName" | "company" | "jobTitle"
  | "notes" | "birthday" | "emailEntries" | "phoneEntries"
  | "createdAt" | "updatedAt" | "sourceType" | "bookId"
>;

export function formatContactForApi(contact: ApiContactRow) {
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: contact.fullName,
    company: contact.company,
    jobTitle: contact.jobTitle,
    notes: contact.notes,
    birthday: contact.birthday,
    emails: contact.emailEntries ?? [],
    phones: contact.phoneEntries ?? [],
    bookId: contact.bookId,
    source: contact.sourceType,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

export const API_CONTACT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  fullName: true,
  company: true,
  jobTitle: true,
  notes: true,
  birthday: true,
  emailEntries: true,
  phoneEntries: true,
  bookId: true,
  sourceType: true,
  createdAt: true,
  updatedAt: true,
} as const;
