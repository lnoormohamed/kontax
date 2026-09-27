import type { Contact } from "../../../../../generated/prisma";
import { multiValueWriteData, readMultiValueEntries } from "~/server/contact-multi-values";
import type { ContactCreateInput, ContactUpdateInput } from "./schemas";

type StructuredEntry = { label: string; value: string; isPrimary: boolean };

// P49A-10: the API writes typed entries only; `multiValueWriteData` derives
// the legacy email/emailAddresses and phone/phoneNumbers columns from them.
function buildEmailEntries(emails: { value: string; label?: string }[] | undefined): StructuredEntry[] {
  const seen = new Set<string>();
  const deduped = (emails ?? []).filter((e) => {
    const key = e.value.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.map((e, i) => ({
    label: e.label ?? (i === 0 ? "primary" : "other"),
    value: e.value.trim(),
    isPrimary: i === 0,
  }));
}

function buildPhoneEntries(phones: { value: string; label?: string }[] | undefined): StructuredEntry[] {
  const seen = new Set<string>();
  const deduped = (phones ?? []).filter((p) => {
    const key = p.value.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.map((p, i) => ({
    label: p.label ?? (i === 0 ? "mobile" : "other"),
    value: p.value.trim(),
    isPrimary: i === 0,
  }));
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
    ...multiValueWriteData({
      emailEntries: buildEmailEntries(input.emails),
      phoneEntries: buildPhoneEntries(input.phones),
    }),
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

  // A family named in the PATCH body replaces the stored list; an absent one
  // is left untouched.
  Object.assign(
    patch,
    multiValueWriteData({
      emailEntries: "emails" in input ? buildEmailEntries(input.emails) : undefined,
      phoneEntries: "phones" in input ? buildPhoneEntries(input.phones) : undefined,
    }),
  );

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
  | "email" | "emailAddresses" | "phone" | "phoneNumbers"
  | "createdAt" | "updatedAt" | "sourceType" | "bookId"
>;

export function formatContactForApi(contact: ApiContactRow) {
  // P49A-10: entries through the canonical reader (legacy columns only for a
  // row the backfill has not reached — a CSV contact used to read as []).
  const { emailEntries, phoneEntries } = readMultiValueEntries(contact);
  return {
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: contact.fullName,
    company: contact.company,
    jobTitle: contact.jobTitle,
    notes: contact.notes,
    birthday: contact.birthday,
    emails: emailEntries,
    phones: phoneEntries,
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
  email: true,
  emailAddresses: true,
  phone: true,
  phoneNumbers: true,
  bookId: true,
  sourceType: true,
  createdAt: true,
  updatedAt: true,
} as const;
