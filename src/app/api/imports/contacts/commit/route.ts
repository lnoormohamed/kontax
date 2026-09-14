import { z } from "zod";

import { auth } from "~/server/auth";
import { assertCanImportContacts } from "~/server/billing";
import { parseCsvContacts } from "~/server/contact-portability";
import {
  approximateCsvRowCount,
  csvRowCountExceedsCap,
  MAX_CSV_ROWS,
  MAX_CSV_TEXT_LENGTH,
} from "~/server/import/csv-bounds";
import { db } from "~/server/db";

const getOptionalJsonArray = <T>(value: T[] | null | undefined) =>
  value && value.length > 0 ? value : undefined;

const commitRequestSchema = z.object({
  // P48-11 item 4: same 10 MB / 50,000-row bounds as the preview route.
  csvText: z
    .string()
    .min(1, "Paste CSV data or choose a CSV file.")
    .max(MAX_CSV_TEXT_LENGTH, "That CSV is too large (10 MB max)."),
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

/**
 * P48-11 item 6: marks an error whose message is already curated/user-facing
 * (a validation rejection, a plan-limit message) — safe to return as-is.
 * Anything else that reaches the outer catch is an unexpected failure: it's
 * logged server-side and masked with a fixed message for the caller.
 */
class KnownCommitError extends Error {}

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

  if (csvRowCountExceedsCap(parsedBody.data.csvText)) {
    return Response.json(
      {
        message: `That CSV has too many rows (${MAX_CSV_ROWS.toLocaleString()} max). Split it into smaller files.`,
      },
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
    // P48-11 item 4: check the quota against a cheap row-count estimate
    // *before* running the full classifier/dedupe parse — an over-quota
    // import shouldn't pay for a parse it can't commit anyway. The exact
    // check against preview.contacts.length below still runs (skipped rows
    // only ever make the real count lower than this estimate).
    try {
      await assertCanImportContacts(userId, approximateCsvRowCount(parsedBody.data.csvText) - 1);
    } catch (error) {
      throw new KnownCommitError(
        error instanceof Error ? error.message : "Import limit reached.",
      );
    }

    let preview: ReturnType<typeof parseCsvContacts>;
    try {
      preview = parseCsvContacts(
        parsedBody.data.csvText,
        parsedBody.data.profile,
        parsedBody.data.columnMappings,
      );
    } catch (error) {
      throw new KnownCommitError(
        error instanceof Error ? error.message : "Could not parse that CSV file.",
      );
    }
    const warningCount = preview.issues.filter((issue) => issue.severity === "warning").length;
    const errorCount = preview.issues.filter((issue) => issue.severity === "error").length;

    if (!preview.canImport) {
      throw new KnownCommitError(
        preview.blockingReasons[0] ?? "Import is blocked until duplicate conflicts are resolved.",
      );
    }

    if (preview.contacts.length === 0) {
      throw new KnownCommitError("No importable contacts were found in that CSV file.");
    }

    try {
      await assertCanImportContacts(userId, preview.contacts.length);
    } catch (error) {
      throw new KnownCommitError(
        error instanceof Error ? error.message : "Import limit reached.",
      );
    }

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
    const known = error instanceof KnownCommitError;
    const message = known
      ? error.message
      : error instanceof Error
        ? error.message
        : "Import failed.";
    if (!known) {
      console.error("[imports/contacts/commit] unexpected failure", error);
    }

    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        sourceProfile: parsedBody.data.profile,
        sourceFileName,
        sourceFileSizeBytes: parsedBody.data.sourceFileSizeBytes,
        errorSummary: message,
        committedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return Response.json(
      { message: known ? message : "Import failed. Please try again." },
      { status: known ? 400 : 500 },
    );
  }
}
