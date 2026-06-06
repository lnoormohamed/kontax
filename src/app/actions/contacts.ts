"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "~/server/auth";
import { assertCanCreateContacts } from "~/server/billing";
import { db } from "~/server/db";

const contactSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(320).optional(),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const contactIdSchema = z.object({
  contactId: z.string().trim().min(1, "Missing contact id."),
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

  if (contactId) {
    revalidatePath(`/contacts/${contactId}`);
  }
};

const parseContactInput = (formData: FormData) => {
  const parsed = contactSchema.safeParse({
    fullName: formData.get("fullName"),
    email: getOptionalString(formData, "email")?.toLowerCase(),
    phone: getOptionalString(formData, "phone"),
    company: getOptionalString(formData, "company"),
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
    data: input,
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
