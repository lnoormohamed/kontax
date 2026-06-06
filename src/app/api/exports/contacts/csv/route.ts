import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { contactsToCsv } from "~/server/contact-portability";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "true";

  const job = await db.exportJob.create({
    data: {
      userId,
      format: "CSV_GENERIC",
      status: "PROCESSING",
      includeArchived,
    },
  });

  try {
    const contacts = await db.contact.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        fullName: true,
        email: true,
        phone: true,
        company: true,
        notes: true,
      },
    });

    const body = contactsToCsv(contacts);

    await db.exportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        exportedCount: contacts.length,
        completedAt: new Date(),
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kontax-contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    await db.exportJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorSummary: error instanceof Error ? error.message : "CSV export failed.",
        completedAt: new Date(),
      },
    });

    return new Response("Export failed", { status: 500 });
  }
}
