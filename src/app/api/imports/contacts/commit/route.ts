import { z } from "zod";

import { auth } from "~/server/auth";
import { assertCanImportContacts } from "~/server/billing";
import { parseCsvContacts } from "~/server/contact-portability";
import { db } from "~/server/db";
import type { ExplicitColumnMapping } from "~/server/contact-portability";

const getOptionalJsonArray = <T>(value: T[] | null | undefined) =>
  value && value.length > 0 ? value : undefined;

const commitRequestSchema = z.object({
  csvText: z.string().min(1, "Paste CSV data or choose a CSV file."),
  profile: z.enum(["GENERIC", "GOOGLE", "APPLE", "OUTLOOK"]),
  sourceFileName: z.string().trim().optional(),
  sourceFileSizeBytes: z.number().int().nonnegative().optional(),
  jobId: z.string().trim().optional(),
  columnMappings: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        targetField: z.string(),
        customFieldKey: z.string().trim().max(50).optional(),
        splitMultiValue: z.boolean().optional(),
        multiValueDelimiter: z.string().max(10).optional(),
      }),
    )
    .optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const parsedBody = commitRequestSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return Response.json(
      { message: parsedBody.error.issues[0]?.message ?? "Invalid import request." },
      { status: 400 },
    );
  }

  const sourceFileName = parsedBody.data.sourceFileName?.trim() ?? "pasted-import.csv";
  const existingJob = parsedBody.data.jobId
    ? await db.importJob.findFirst({
        where: {
          id: parsedBody.data.jobId,
          userId,
        },
      })
    : null;

  const job = existingJob
    ? await db.importJob.update({
        where: { id: existingJob.id },
        data: {
          status: "PROCESSING",
          sourceProfile: parsedBody.data.profile,
          sourceFileName,
          sourceFileSizeBytes: parsedBody.data.sourceFileSizeBytes,
          startedAt: new Date(),
        },
      })
    : await db.importJob.create({
        data: {
          userId,
          format: "CSV_GENERIC",
          status: "PROCESSING",
          sourceProfile: parsedBody.data.profile,
          sourceFileName,
          sourceFileSizeBytes: parsedBody.data.sourceFileSizeBytes,
          startedAt: new Date(),
        },
      });

  try {
    const preview = parseCsvContacts(
      parsedBody.data.csvText,
      parsedBody.data.profile,
      parsedBody.data.columnMappings,
    );
    const warningCount = preview.issues.filter((issue) => issue.severity === "warning").length;
    const errorCount = preview.issues.filter((issue) => issue.severity === "error").length;

    if (!preview.canImport) {
      throw new Error(
        preview.blockingReasons[0] ?? "Import is blocked until duplicate conflicts are resolved.",
      );
    }

    if (preview.contacts.length === 0) {
      throw new Error("No importable contacts were found in that CSV file.");
    }

    await assertCanImportContacts(userId, preview.contacts.length);

    const created = await db.contact.createMany({
      data: preview.contacts.map((contact) => ({
        userId,
        importJobId: job.id,
        fullName: contact.fullName,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phoneticFirstName: contact.phoneticFirstName,
        phoneticLastName: contact.phoneticLastName,
        nickname: contact.nickname,
        email: contact.email,
        emailAddresses: getOptionalJsonArray(contact.emailAddresses),
        phone: contact.phone,
        phoneNumbers: getOptionalJsonArray(contact.phoneNumbers),
        company: contact.company,
        phoneticCompany: contact.phoneticCompany,
        jobTitle: contact.jobTitle,
        website: contact.website,
        birthday: contact.birthday,
        address: contact.address,
        postalAddresses: getOptionalJsonArray(contact.postalAddresses),
        notes: contact.notes,
        customFields: contact.customFields ?? undefined,
        sourceType: "IMPORT_CSV" as const,
        sourceDetail: sourceFileName,
        lastMutatedBy: "IMPORT_CSV" as const,
        lastMutatedByDetail: sourceFileName,
      })),
    });

    // P10-02: one CONTACT_IMPORTED event per created contact (batch insert).
    const importedContacts = await db.contact.findMany({
      where: { userId, importJobId: job.id },
      select: { id: true },
    });
    if (importedContacts.length > 0) {
      await db.activityEvent.createMany({
        data: importedContacts.map((contact) => ({
          userId,
          contactId: contact.id,
          eventType: "CONTACT_IMPORTED" as const,
          actor: "IMPORT" as const,
          actorDetail: sourceFileName,
          payload: { importJobId: job.id, sourceFileName },
        })),
      });
    }

    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        sourceProfile: parsedBody.data.profile,
        sourceFileName,
        sourceFileSizeBytes: parsedBody.data.sourceFileSizeBytes,
        rowCount: preview.totalRows,
        previewContactCount: preview.contacts.length,
        importedCount: created.count,
        skippedCount: preview.skippedCount,
        errorCount,
        warningCount,
        errorSummary:
          preview.issues.length > 0
            ? preview.issues
                .slice(0, 5)
                .map((issue) => `Row ${issue.rowNumber}: ${issue.message}`)
                .join(" | ")
            : null,
        previewedAt: existingJob?.previewedAt ?? job.previewedAt ?? null,
        committedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return Response.json({
      importedCount: created.count,
      skippedCount: preview.skippedCount,
      issueCount: preview.issues.length,
    });
  } catch (error) {
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        sourceProfile: parsedBody.data.profile,
        sourceFileName,
        sourceFileSizeBytes: parsedBody.data.sourceFileSizeBytes,
        errorSummary: error instanceof Error ? error.message : "Import failed.",
        committedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return Response.json(
      { message: error instanceof Error ? error.message : "Import failed." },
      { status: 400 },
    );
  }
}
