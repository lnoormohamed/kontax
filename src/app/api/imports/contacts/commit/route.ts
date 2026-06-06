import { z } from "zod";

import { auth } from "~/server/auth";
import { assertCanImportContacts } from "~/server/billing";
import { parseCsvContacts } from "~/server/contact-portability";
import { db } from "~/server/db";

const commitRequestSchema = z.object({
  csvText: z.string().min(1, "Paste CSV data or choose a CSV file."),
  profile: z.enum(["GENERIC", "GOOGLE", "APPLE", "OUTLOOK"]),
  sourceFileName: z.string().trim().optional(),
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

  const sourceFileName = parsedBody.data.sourceFileName?.trim() || "pasted-import.csv";
  const job = await db.importJob.create({
    data: {
      userId,
      format: "CSV_GENERIC",
      status: "PROCESSING",
      sourceFileName,
    },
  });

  try {
    const preview = parseCsvContacts(parsedBody.data.csvText, parsedBody.data.profile);

    if (preview.contacts.length === 0) {
      throw new Error("No importable contacts were found in that CSV file.");
    }

    await assertCanImportContacts(userId, preview.contacts.length);

    const created = await db.contact.createMany({
      data: preview.contacts.map((contact) => ({
        userId,
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        notes: contact.notes,
      })),
    });

    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        rowCount: preview.totalRows,
        importedCount: created.count,
        skippedCount: preview.skippedCount,
        errorCount: preview.issues.length,
        errorSummary:
          preview.issues.length > 0
            ? preview.issues
                .slice(0, 5)
                .map((issue) => `Row ${issue.rowNumber}: ${issue.message}`)
                .join(" | ")
            : null,
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
        errorSummary: error instanceof Error ? error.message : "Import failed.",
        completedAt: new Date(),
      },
    });

    return Response.json(
      { message: error instanceof Error ? error.message : "Import failed." },
      { status: 400 },
    );
  }
}
