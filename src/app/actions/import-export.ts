"use server";

import { revalidatePath } from "next/cache";

import { auth } from "~/server/auth";
import { assertCanImportContacts } from "~/server/billing";
import { db } from "~/server/db";
import { parseCsvContacts } from "~/server/contact-portability";

const getRequiredUserId = async () => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("You must be signed in to import contacts.");
  }

  return userId;
};

const getCsvText = async (formData: FormData) => {
  const inlineText = formData.get("csvText");
  if (typeof inlineText === "string" && inlineText.trim().length > 0) {
    return {
      fileName: "pasted-import.csv",
      text: inlineText,
    };
  }

  const uploadedFile = formData.get("csvFile");
  if (uploadedFile instanceof File && uploadedFile.size > 0) {
    return {
      fileName: uploadedFile.name,
      text: await uploadedFile.text(),
    };
  }

  throw new Error("Paste CSV data or choose a CSV file to import.");
};

export const importContactsCsv = async (formData: FormData) => {
  const userId = await getRequiredUserId();
  const { fileName, text } = await getCsvText(formData);

  const job = await db.importJob.create({
    data: {
      userId,
      format: "CSV_GENERIC",
      status: "PROCESSING",
      sourceFileName: fileName,
    },
  });

  try {
    const parsed = parseCsvContacts(text);

    if (parsed.contacts.length === 0) {
      throw new Error("No importable contacts were found in that CSV file.");
    }

    await assertCanImportContacts(userId, parsed.contacts.length);

    const created = await db.contact.createMany({
      data: parsed.contacts.map((contact) => ({
        userId,
        fullName: contact.fullName,
        nickname: contact.nickname,
        email: contact.email,
        emailAddresses: contact.emailAddresses,
        phone: contact.phone,
        phoneNumbers: contact.phoneNumbers,
        company: contact.company,
        jobTitle: contact.jobTitle,
        website: contact.website,
        birthday: contact.birthday,
        address: contact.address,
        postalAddresses: contact.postalAddresses,
        notes: contact.notes,
      })),
    });

    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        rowCount: parsed.totalRows,
        importedCount: created.count,
        skippedCount: parsed.skippedCount,
        errorCount: parsed.issues.length,
        errorSummary:
          parsed.issues.length > 0
            ? parsed.issues
                .slice(0, 5)
                .map((issue) => `Row ${issue.rowNumber}: ${issue.message}`)
                .join(" | ")
            : null,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorSummary: error instanceof Error ? error.message : "Import failed.",
        completedAt: new Date(),
      },
    });

    throw error;
  }

  revalidatePath("/");
  revalidatePath("/import-export");
};
