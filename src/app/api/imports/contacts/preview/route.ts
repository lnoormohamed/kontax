import { z } from "zod";

import { auth } from "~/server/auth";
import { parseCsvContacts } from "~/server/contact-portability";
import { db } from "~/server/db";

const previewRequestSchema = z.object({
  csvText: z.string().min(1, "Paste CSV data or choose a CSV file."),
  profile: z.enum(["GENERIC", "GOOGLE", "APPLE", "OUTLOOK"]),
  sourceFileName: z.string().trim().optional(),
  sourceFileSizeBytes: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const parsedBody = previewRequestSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return Response.json(
      { message: parsedBody.error.issues[0]?.message ?? "Invalid preview request." },
      { status: 400 },
    );
  }

  try {
    const preview = parseCsvContacts(parsedBody.data.csvText, parsedBody.data.profile);
    const emails = preview.contacts.flatMap((contact) => (contact.email ? [contact.email] : []));
    const phones = preview.contacts.flatMap((contact) => (contact.phone ? [contact.phone] : []));

    const existingContacts =
      emails.length > 0 || phones.length > 0
        ? await db.contact.findMany({
            where: {
              userId: session.user.id,
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
        userId: session.user.id,
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
      where: { userId_headerHash: { userId: session.user.id, headerHash: preview.headerHash } },
      select: { id: true, name: true, lastUsedAt: true, columnMappings: true },
    });

    return Response.json({
      ...preview,
      jobId: job.id,
      matchedPreset: matchedPreset ?? null,
    });
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Preview failed." },
      { status: 400 },
    );
  }
}
