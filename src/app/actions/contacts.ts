"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "~/server/auth";
import { assertCanCreateContacts } from "~/server/billing";
import { mergeContactsForUser, undoMergedContactsForUser } from "~/server/contact-merge";
import { db } from "~/server/db";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const contactSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  firstName: z.string().trim().max(80).optional(),
  middleName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  namePrefix: z.string().trim().max(40).optional(),
  nameSuffix: z.string().trim().max(40).optional(),
  nickname: z.string().trim().max(80).optional(),
  email: z.string().trim().email("Enter a valid email address.").max(320).optional(),
  emailLabel: z.string().trim().max(40).optional(),
  secondaryEmail: z.string().trim().email("Enter a valid secondary email address.").max(320).optional(),
  secondaryEmailLabel: z.string().trim().max(40).optional(),
  additionalEmails: z.string().trim().max(4000).optional(),
  phone: z.string().trim().max(40).optional(),
  phoneLabel: z.string().trim().max(40).optional(),
  secondaryPhone: z.string().trim().max(40).optional(),
  secondaryPhoneLabel: z.string().trim().max(40).optional(),
  additionalPhones: z.string().trim().max(4000).optional(),
  company: z.string().trim().max(120).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  website: z.string().trim().url("Enter a valid website URL.").max(500).optional(),
  websiteLabel: z.string().trim().max(40).optional(),
  secondaryWebsite: z.string().trim().url("Enter a valid secondary website URL.").max(500).optional(),
  secondaryWebsiteLabel: z.string().trim().max(40).optional(),
  additionalWebsites: z.string().trim().max(4000).optional(),
  birthday: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid birthday in YYYY-MM-DD format.")
    .optional(),
  address: z.string().trim().max(500).optional(),
  addressLabel: z.string().trim().max(40).optional(),
  countryOrRegion: z.string().trim().max(120).optional(),
  streetLine1: z.string().trim().max(150).optional(),
  streetLine2: z.string().trim().max(150).optional(),
  cityOrTown: z.string().trim().max(120).optional(),
  postcode: z.string().trim().max(40).optional(),
  poBox: z.string().trim().max(40).optional(),
  additionalAddresses: z.string().trim().max(4000).optional(),
  avatarUrl: z.string().trim().url("Enter a valid avatar URL.").max(500).optional(),
  labels: z.string().trim().max(1000).optional(),
  isFavorite: z.enum(["true"]).optional(),
  significantDates: z.string().trim().max(4000).optional(),
  relatedPeople: z.string().trim().max(4000).optional(),
  customFields: z.string().trim().max(4000).optional(),
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

const getLineSeparatedValues = (value: string | undefined) =>
  value
    ?.split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0) ?? [];

const dedupeValues = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
};

const buildPostalAddresses = (primaryAddress: string | undefined, additionalAddresses: string[]) => {
  const values = dedupeValues([primaryAddress, ...additionalAddresses]);

  if (values.length === 0) {
    return undefined;
  }

  return values.map((formatted, index) => ({
    label: index === 0 ? "primary" : "other",
    formatted,
  }));
};

const buildStructuredEntries = (
  primaryValue: string | undefined,
  primaryLabel: string | undefined,
  additionalValues: string[],
  fallbackLabel: string,
) => {
  const values = dedupeValues([primaryValue, ...additionalValues]);

  if (values.length === 0) {
    return undefined;
  }

  return values.map((value, index) => ({
    label: index === 0 ? (primaryLabel ?? fallbackLabel) : "other",
    value,
    isPrimary: index === 0,
  }));
};

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const parseStructuredTextLines = (value: string | undefined, itemLabel: string) =>
  getLineSeparatedValues(value).map((line) => {
    const [rawLabel, ...rawValueParts] = line.split("|");
    const label = rawLabel?.trim();
    const entryValue = rawValueParts.join("|").trim();

    if (!label || !entryValue) {
      throw new Error(`Use ${itemLabel} in "Label | Value" format.`);
    }

    return {
      label,
      value: entryValue,
    };
  });

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
    firstName: getOptionalString(formData, "firstName"),
    middleName: getOptionalString(formData, "middleName"),
    lastName: getOptionalString(formData, "lastName"),
    namePrefix: getOptionalString(formData, "namePrefix"),
    nameSuffix: getOptionalString(formData, "nameSuffix"),
    nickname: getOptionalString(formData, "nickname"),
    email: getOptionalString(formData, "email")?.toLowerCase(),
    emailLabel: getOptionalString(formData, "emailLabel"),
    secondaryEmail: getOptionalString(formData, "secondaryEmail")?.toLowerCase(),
    secondaryEmailLabel: getOptionalString(formData, "secondaryEmailLabel"),
    additionalEmails: getOptionalString(formData, "additionalEmails"),
    phone: getOptionalString(formData, "phone"),
    phoneLabel: getOptionalString(formData, "phoneLabel"),
    secondaryPhone: getOptionalString(formData, "secondaryPhone"),
    secondaryPhoneLabel: getOptionalString(formData, "secondaryPhoneLabel"),
    additionalPhones: getOptionalString(formData, "additionalPhones"),
    company: getOptionalString(formData, "company"),
    jobTitle: getOptionalString(formData, "jobTitle"),
    website: getOptionalString(formData, "website"),
    websiteLabel: getOptionalString(formData, "websiteLabel"),
    secondaryWebsite: getOptionalString(formData, "secondaryWebsite"),
    secondaryWebsiteLabel: getOptionalString(formData, "secondaryWebsiteLabel"),
    additionalWebsites: getOptionalString(formData, "additionalWebsites"),
    birthday: getOptionalString(formData, "birthday"),
    address: getOptionalString(formData, "address"),
    addressLabel: getOptionalString(formData, "addressLabel"),
    countryOrRegion: getOptionalString(formData, "countryOrRegion"),
    streetLine1: getOptionalString(formData, "streetLine1"),
    streetLine2: getOptionalString(formData, "streetLine2"),
    cityOrTown: getOptionalString(formData, "cityOrTown"),
    postcode: getOptionalString(formData, "postcode"),
    poBox: getOptionalString(formData, "poBox"),
    additionalAddresses: getOptionalString(formData, "additionalAddresses"),
    avatarUrl: getOptionalString(formData, "avatarUrl"),
    labels: getOptionalString(formData, "labels"),
    isFavorite: formData.get("isFavorite") === "true" ? "true" : undefined,
    significantDates: getOptionalString(formData, "significantDates"),
    relatedPeople: getOptionalString(formData, "relatedPeople"),
    customFields: getOptionalString(formData, "customFields"),
    notes: getOptionalString(formData, "notes"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid contact details.");
  }

  if (!parsed.data.fullName && !parsed.data.company) {
    throw new Error("Add a full name or company name so Kontax can place this contact in the list.");
  }

  const additionalEmails = getLineSeparatedValues(parsed.data.additionalEmails).map((email) =>
    email.toLowerCase(),
  );
  const additionalPhones = getLineSeparatedValues(parsed.data.additionalPhones);
  const additionalWebsites = getLineSeparatedValues(parsed.data.additionalWebsites);
  const additionalAddresses = getLineSeparatedValues(parsed.data.additionalAddresses);
  const labels = dedupeValues(
    (parsed.data.labels ?? "")
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );

  const invalidAdditionalEmail = additionalEmails.find((email) => !emailPattern.test(email));
  if (invalidAdditionalEmail) {
    throw new Error(`Enter a valid additional email address: ${invalidAdditionalEmail}.`);
  }

  const invalidAdditionalWebsite = additionalWebsites.find((website) => !isValidUrl(website));
  if (invalidAdditionalWebsite) {
    throw new Error(`Enter a valid additional website URL: ${invalidAdditionalWebsite}.`);
  }

  const explicitSignificantDates = parseStructuredTextLines(
    parsed.data.significantDates,
    "significant dates",
  ).map((entry) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.value)) {
      throw new Error(`Use significant dates in "Label | YYYY-MM-DD" format: ${entry.value}.`);
    }

    return {
      label: entry.label,
      date: entry.value,
    };
  });
  const relatedPeople = parseStructuredTextLines(parsed.data.relatedPeople, "related people").map(
    (entry) => ({
      relationship: entry.label,
      name: entry.value,
    }),
  );
  const customFields = parseStructuredTextLines(parsed.data.customFields, "custom fields");

  const fullNameFromParts = [
    parsed.data.namePrefix,
    parsed.data.firstName,
    parsed.data.middleName,
    parsed.data.lastName,
    parsed.data.nameSuffix,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const canonicalFullName = fullNameFromParts || parsed.data.fullName || parsed.data.company;
  const primaryAddress =
    parsed.data.address ??
    dedupeValues([
      parsed.data.streetLine1,
      parsed.data.streetLine2,
      parsed.data.cityOrTown,
      parsed.data.postcode,
      parsed.data.countryOrRegion,
    ]).join(", ");
  const postalAddresses = buildPostalAddresses(primaryAddress || undefined, additionalAddresses);
  const addressEntries =
    postalAddresses?.map((entry, index) => ({
      label: index === 0 ? (parsed.data.addressLabel ?? "home") : "other",
      formatted: entry.formatted,
      isPrimary: index === 0,
      countryOrRegion: index === 0 ? parsed.data.countryOrRegion : undefined,
      streetLine1: index === 0 ? parsed.data.streetLine1 : undefined,
      streetLine2: index === 0 ? parsed.data.streetLine2 : undefined,
      cityOrTown: index === 0 ? parsed.data.cityOrTown : undefined,
      postcode: index === 0 ? parsed.data.postcode : undefined,
      poBox: index === 0 ? parsed.data.poBox : undefined,
    })) ?? undefined;
  const websiteEntries = buildStructuredEntries(
    parsed.data.website,
    parsed.data.websiteLabel,
    dedupeValues([parsed.data.secondaryWebsite, ...additionalWebsites]),
    "primary",
  );
  const significantDates = [
    ...(parsed.data.birthday
      ? [
          {
            label: "birthday",
            date: parsed.data.birthday,
            isPrimary: true,
          },
        ]
      : []),
    ...explicitSignificantDates
      .filter((entry) => !(entry.label.toLowerCase() === "birthday" && entry.date === parsed.data.birthday))
      .map((entry) => ({
        ...entry,
        isPrimary: false,
      })),
  ];

  return {
    fullName: canonicalFullName,
    firstName: parsed.data.firstName,
    middleName: parsed.data.middleName,
    lastName: parsed.data.lastName,
    namePrefix: parsed.data.namePrefix,
    nameSuffix: parsed.data.nameSuffix,
    nickname: parsed.data.nickname,
    email: parsed.data.email,
    emailAddresses: dedupeValues([parsed.data.email, parsed.data.secondaryEmail, ...additionalEmails]),
    emailEntries: buildStructuredEntries(
      parsed.data.email,
      parsed.data.emailLabel,
      dedupeValues([parsed.data.secondaryEmail, ...additionalEmails]),
      "primary",
    ),
    phone: parsed.data.phone,
    phoneNumbers: dedupeValues([parsed.data.phone, parsed.data.secondaryPhone, ...additionalPhones]),
    phoneEntries: buildStructuredEntries(
      parsed.data.phone,
      parsed.data.phoneLabel,
      dedupeValues([parsed.data.secondaryPhone, ...additionalPhones]),
      "mobile",
    ),
    company: parsed.data.company,
    jobTitle: parsed.data.jobTitle,
    website: parsed.data.website,
    websiteEntries,
    birthday: parsed.data.birthday,
    address: primaryAddress || undefined,
    avatarUrl: parsed.data.avatarUrl,
    isFavorite: parsed.data.isFavorite === "true",
    labels: labels.length > 0 ? labels : undefined,
    postalAddresses,
    addressEntries,
    significantDates: significantDates.length > 0 ? significantDates : undefined,
    relatedPeople: relatedPeople.length > 0 ? relatedPeople : undefined,
    customFields: customFields.length > 0 ? customFields : undefined,
    notes: parsed.data.notes,
  };
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

const parseContactIds = (formData: FormData) => {
  const values = formData.getAll("contactIds");
  const contactIds = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (contactIds.length === 0) {
    throw new Error("Select at least one contact.");
  }

  return [...new Set(contactIds)];
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
  const redirectTo = getRedirectTarget(formData);

  await assertCanCreateContacts(userId);

  const createdContact = await db.contact.create({
    data: {
      userId,
      ...input,
    },
  });

  revalidateContactViews();

  if (redirectTo) {
    redirect(redirectTo.replace(":id", createdContact.id));
  }
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

export const toggleFavoriteContact = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const contactId = parseContactId(formData);
  const redirectTo = getRedirectTarget(formData);

  const existingContact = await db.contact.findFirst({
    where: {
      id: contactId,
      userId,
    },
    select: {
      id: true,
      isFavorite: true,
    },
  });

  if (!existingContact) {
    throw new Error("Contact not found.");
  }

  await db.contact.update({
    where: {
      id: existingContact.id,
    },
    data: {
      isFavorite: !existingContact.isFavorite,
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

export const archiveContactsBulk = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const contactIds = parseContactIds(formData);
  const redirectTo = getRedirectTarget(formData);

  await db.contact.updateMany({
    where: {
      id: {
        in: contactIds,
      },
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

  revalidateContactViews();

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

export const restoreContactsBulk = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const contactIds = parseContactIds(formData);
  const redirectTo = getRedirectTarget(formData);

  await db.contact.updateMany({
    where: {
      id: {
        in: contactIds,
      },
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

  revalidateContactViews();

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
