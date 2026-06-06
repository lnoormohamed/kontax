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
  const query = url.searchParams.get("q")?.trim() ?? "";
  const resultFileName = `kontax-contacts-${new Date().toISOString().slice(0, 10)}.csv`;

  const job = await db.exportJob.create({
    data: {
      userId,
      format: "CSV_GENERIC",
      status: "PROCESSING",
      includeArchived,
      filterQuery: query || null,
      resultFileName,
    },
  });

  try {
    const contacts = await db.contact.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { archivedAt: null }),
        ...(query
          ? {
              OR: [
                { fullName: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
                { company: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
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
        filterQuery: query || null,
        resultFileName,
        completedAt: new Date(),
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${resultFileName}"`,
      },
    });
  } catch (error) {
    await db.exportJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        filterQuery: query || null,
        resultFileName,
        errorSummary: error instanceof Error ? error.message : "CSV export failed.",
        completedAt: new Date(),
      },
    });

    return new Response("Export failed", { status: 500 });
  }
}
