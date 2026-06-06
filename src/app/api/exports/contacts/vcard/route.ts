import { assertCanUsePremiumExport } from "~/server/billing";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { contactsToVCard } from "~/server/contact-portability";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const job = await db.exportJob.create({
    data: {
      userId,
      format: "VCARD_4",
      status: "PROCESSING",
      includeArchived: false,
    },
  });

  try {
    await assertCanUsePremiumExport(userId);

    const contacts = await db.contact.findMany({
      where: {
        userId,
        archivedAt: null,
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

    const body = contactsToVCard(contacts);

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
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": `attachment; filename="kontax-contacts-${new Date().toISOString().slice(0, 10)}.vcf"`,
      },
    });
  } catch (error) {
    await db.exportJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorSummary: error instanceof Error ? error.message : "vCard export failed.",
        completedAt: new Date(),
      },
    });

    const message = error instanceof Error ? error.message : "Export failed";
    return new Response(message, { status: 403 });
  }
}
