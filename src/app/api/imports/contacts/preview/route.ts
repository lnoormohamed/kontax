import { z } from "zod";

import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { parseCsvContacts } from "~/server/contact-portability";
import { csvRowCountExceedsCap, MAX_CSV_ROWS, MAX_CSV_TEXT_LENGTH } from "~/server/import/csv-bounds";
import { db } from "~/server/db";

const previewRequestSchema = z.object({
  // P48-11 item 4: an unbounded csvText ran the full classifier/dedupe pass
  // (parseCsvContacts) before anything checked size or row count.
  csvText: z
    .string()
    .min(1, "Paste CSV data or choose a CSV file.")
    .max(MAX_CSV_TEXT_LENGTH, "That CSV is too large (10 MB max)."),
  profile: z.enum(["GENERIC", "GOOGLE", "APPLE", "OUTLOOK"]),
  sourceFileName: z.string().trim().optional(),
  sourceFileSizeBytes: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId({ write: true });
  } catch (err) {
    if (isSessionError(err)) return Response.json({ message: "Unauthorized" }, { status: 401 });
    throw err;
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const parsedBody = previewRequestSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return Response.json(
      { message: parsedBody.error.issues[0]?.message ?? "Invalid preview request." },
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

  // parseCsvContacts throws a small, curated set of user-facing messages
  // (missing header row, unmatched quote, no recognized columns) — safe to
  // surface as-is. Anything from the DB calls below is not.
  let preview: ReturnType<typeof parseCsvContacts>;
  try {
    preview = parseCsvContacts(parsedBody.data.csvText, parsedBody.data.profile);
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Could not parse that CSV file." },
      { status: 400 },
    );
  }

  try {
    const emails = preview.contacts.flatMap((contact) => (contact.email ? [contact.email] : []));
    const phones = preview.contacts.flatMap((contact) => (contact.phone ? [contact.phone] : []));

    const existingContacts =
      emails.length > 0 || phones.length > 0
        ? await db.contact.findMany({
            where: {
              userId: userId,
              OR: [
                ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
                ...(phones.length > 0 ? [{ phone: { in: phones } }] : []),
              ],
            },
            select: {
              fullName: true,
              email: true,
              phone: true,
            },
          })
        : [];

    const existingByEmail = new Map(
      existingContacts
        .filter((contact) => contact.email)
        .map((contact) => [contact.email!, contact.fullName]),
    );
    const existingByPhone = new Map(
      existingContacts
        .filter((contact) => contact.phone)
        .map((contact) => [contact.phone!, contact.fullName]),
    );

    const duplicateWarnings = preview.contacts.flatMap((contact) => {
      const warnings = [];

      if (contact.email) {
        const existingName = existingByEmail.get(contact.email);
        if (existingName) {
          warnings.push({
            rowNumber: contact.rowNumber,
            severity: "warning" as const,
            message: `Matches existing contact ${existingName} by email ${contact.email}.`,
          });
        }
      }

      if (contact.phone) {
        const existingName = existingByPhone.get(contact.phone);
        if (existingName) {
          warnings.push({
            rowNumber: contact.rowNumber,
            severity: "warning" as const,
            message: `Matches existing contact ${existingName} by phone ${contact.phone}.`,
          });
        }
      }

      return warnings;
    });

    preview.issues.push(...duplicateWarnings);
    const warningCount = preview.issues.filter((issue) => issue.severity === "warning").length;
    const errorCount = preview.issues.filter((issue) => issue.severity === "error").length;

    const job = await db.importJob.create({
      data: {
        userId: userId,
        format: "CSV_GENERIC",
        status: "PENDING",
        sourceProfile: parsedBody.data.profile,
        sourceFileName: parsedBody.data.sourceFileName?.trim() ?? "pasted-import.csv",
        sourceFileSizeBytes: parsedBody.data.sourceFileSizeBytes,
        rowCount: preview.totalRows,
        previewContactCount: preview.contacts.length,
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
        previewedAt: new Date(),
      },
    });

    const matchedPreset = await db.importMappingPreset.findUnique({
      where: { userId_headerHash: { userId: userId, headerHash: preview.headerHash } },
      select: { id: true, name: true, lastUsedAt: true, columnMappings: true },
    });

    return Response.json({
      ...preview,
      jobId: job.id,
      matchedPreset: matchedPreset ?? null,
    });
  } catch (error) {
    // Unexpected — a DB failure, not a validation problem the user can act on.
    console.error("[imports/contacts/preview] unexpected failure", error);
    return Response.json({ message: "Preview failed. Please try again." }, { status: 500 });
  }
}
