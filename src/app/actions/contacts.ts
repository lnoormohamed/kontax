"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "~/server/auth";
import { assertCanCreateContacts } from "~/server/billing";
import { mergeContactsForUser, undoMergedContactsForUser } from "~/server/contact-merge";
import { db } from "~/server/db";

const contactSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(120),
  nickname: z.string().trim().max(80).optional(),
  email: z.string().trim().email("Enter a valid email address.").max(320).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  website: z.string().trim().url("Enter a valid website URL.").max(500).optional(),
  birthday: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid birthday in YYYY-MM-DD format.")
    .optional(),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const contactIdSchema = z.object({
  contactId: z.string().trim().min(1, "Missing contact id."),
});

const mergeDecisionSchema = z.object({
  decisionId: z.string().trim().min(1, "Missing merge decision id."),
});

const mergeContactSchema = z.object({
  primaryContactId: z.string().trim().min(1, "Missing primary contact id."),
  secondaryContactId: z.string().trim().min(1, "Missing secondary contact id."),
  suggestionId: z.string().trim().optional(),
  mergeSource: z.string().trim().min(1).default("manual-merge"),
  fullNameChoice: z.enum(["primary", "secondary"]).optional(),
  emailChoice: z.enum(["primary", "secondary"]).optional(),
  phoneChoice: z.enum(["primary", "secondary"]).optional(),
  companyChoice: z.enum(["primary", "secondary"]).optional(),
  notesChoice: z.enum(["primary", "secondary", "combine"]).optional(),
});

const getRequiredUserId = async () => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("You must be signed in to manage contacts.");
  }

  return userId;
};

const getOptionalString = (formData: FormData, key: string) => {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getRedirectTarget = (formData: FormData) => {
  const value = formData.get("redirectTo");
  return typeof value === "string" && value.startsWith("/") ? value : undefined;
};

const revalidateContactViews = (contactId?: string) => {
  revalidatePath("/");
  revalidatePath("/import-export");
  revalidatePath("/merge/manual");

  if (contactId) {
    revalidatePath(`/contacts/${contactId}`);
  }
};

const parseContactInput = (formData: FormData) => {
  const parsed = contactSchema.safeParse({
    fullName: formData.get("fullName"),
    nickname: getOptionalString(formData, "nickname"),
    email: getOptionalString(formData, "email")?.toLowerCase(),
    phone: getOptionalString(formData, "phone"),
    company: getOptionalString(formData, "company"),
    jobTitle: getOptionalString(formData, "jobTitle"),
    website: getOptionalString(formData, "website"),
    birthday: getOptionalString(formData, "birthday"),
    address: getOptionalString(formData, "address"),
    notes: getOptionalString(formData, "notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid contact details.");
  }

  return parsed.data;
};

const parseContactId = (formData: FormData) => {
  const parsed = contactIdSchema.safeParse({
    contactId: formData.get("contactId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid contact id.");
  }

  return parsed.data.contactId;
};

const parseMergeDecisionId = (formData: FormData) => {
  const parsed = mergeDecisionSchema.safeParse({
    decisionId: formData.get("decisionId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid merge decision id.");
  }

  return parsed.data.decisionId;
};

const parseMergeContactInput = (formData: FormData) => {
  const parsed = mergeContactSchema.safeParse({
    primaryContactId: formData.get("primaryContactId"),
    secondaryContactId: formData.get("secondaryContactId"),
    suggestionId: getOptionalString(formData, "suggestionId"),
    mergeSource: getOptionalString(formData, "mergeSource") ?? "manual-merge",
    fullNameChoice: getOptionalString(formData, "fullNameChoice"),
    emailChoice: getOptionalString(formData, "emailChoice"),
    phoneChoice: getOptionalString(formData, "phoneChoice"),
    companyChoice: getOptionalString(formData, "companyChoice"),
    notesChoice: getOptionalString(formData, "notesChoice"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid merge request.");
  }

  return parsed.data;
};

export const createContact = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const input = parseContactInput(formData);

  await assertCanCreateContacts(userId);

  await db.contact.create({
    data: {
      userId,
      ...input,
    },
  });

  revalidateContactViews();
};

export const updateContact = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const contactId = parseContactId(formData);
  const input = parseContactInput(formData);
  const redirectTo = getRedirectTarget(formData);

  await db.contact.updateMany({
    where: {
      id: contactId,
      userId,
    },
    data: {
      ...input,
      syncVersion: {
        increment: 1,
      },
    },
  });

  revalidateContactViews(contactId);

  if (redirectTo) {
    redirect(redirectTo);
  }
};

export const archiveContact = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const contactId = parseContactId(formData);

  await db.contact.updateMany({
    where: {
      id: contactId,
      userId,
      archivedAt: null,
    },
    data: {
      archivedAt: new Date(),
      syncTombstoneAt: new Date(),
      syncVersion: {
        increment: 1,
      },
    },
  });

  revalidateContactViews(contactId);

  const redirectTo = getRedirectTarget(formData);
  if (redirectTo) {
    redirect(redirectTo);
  }
};

export const restoreContact = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const contactId = parseContactId(formData);

  await db.contact.updateMany({
    where: {
      id: contactId,
      userId,
      NOT: {
        archivedAt: null,
      },
    },
    data: {
      archivedAt: null,
      syncTombstoneAt: null,
      syncVersion: {
        increment: 1,
      },
    },
  });

  revalidateContactViews(contactId);

  const redirectTo = getRedirectTarget(formData);
  if (redirectTo) {
    redirect(redirectTo);
  }
};

export const permanentlyDeleteContact = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const contactId = parseContactId(formData);
  const redirectTo = getRedirectTarget(formData);

  await db.contact.deleteMany({
    where: {
      id: contactId,
      userId,
    },
  });

  revalidateContactViews(contactId);

  if (redirectTo) {
    redirect(redirectTo);
  }
};

export const mergeContacts = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const input = parseMergeContactInput(formData);
  const redirectTo = getRedirectTarget(formData);

  const result = await mergeContactsForUser({
    userId,
    primaryContactId: input.primaryContactId,
    secondaryContactId: input.secondaryContactId,
    suggestionId: input.suggestionId,
    source: input.mergeSource,
    fieldChoices: {
      fullName: input.fullNameChoice,
      email: input.emailChoice,
      phone: input.phoneChoice,
      company: input.companyChoice,
      notes: input.notesChoice,
    },
  });

  revalidateContactViews(result.survivingContactId);

  if (redirectTo) {
    const separator = redirectTo.includes("?") ? "&" : "?";
    const mergedRedirect =
      result.decisionId != null
        ? `${redirectTo}${separator}merged=1&decisionId=${result.decisionId}`
        : `${redirectTo}${separator}merged=1`;
    redirect(mergedRedirect);
  }
};

export const undoMergeContacts = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const decisionId = parseMergeDecisionId(formData);
  const redirectTo = getRedirectTarget(formData);

  const survivingContactId = await undoMergedContactsForUser({
    userId,
    decisionId,
  });

  revalidateContactViews(survivingContactId);

  if (redirectTo) {
    const separator = redirectTo.includes("?") ? "&" : "?";
    redirect(`${redirectTo}${separator}mergeUndone=1`);
  }
};
