import { assertCanUsePremiumExport } from "~/server/billing";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  contactsToVCard,
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const resultFileName = `kontax-contacts-${new Date().toISOString().slice(0, 10)}.vcf`;

  const job = await db.exportJob.create({
    data: {
      userId,
      format: "VCARD_4",
      status: "PROCESSING",
      includeArchived: false,
      filterQuery: query || null,
      resultFileName,
    },
  });

  try {
    await assertCanUsePremiumExport(userId);

    const contacts = await db.contact.findMany({
      where: {
        userId,
        archivedAt: null,
        ...(query
          ? {
              OR: [
                { fullName: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
                { company: { contains: query, mode: "insensitive" } },
                { nickname: { contains: query, mode: "insensitive" } },
                { jobTitle: { contains: query, mode: "insensitive" } },
                { website: { contains: query, mode: "insensitive" } },
                { address: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        fullName: true,
        nickname: true,
        email: true,
        emailAddresses: true,
        phone: true,
        phoneNumbers: true,
        company: true,
        jobTitle: true,
        website: true,
        birthday: true,
        address: true,
        postalAddresses: true,
        notes: true,
      },
    });

    const body = contactsToVCard(
      contacts.map((contact) => ({
        ...contact,
        emailAddresses: parseContactStringArray(contact.emailAddresses),
        phoneNumbers: parseContactStringArray(contact.phoneNumbers),
        postalAddresses: parseContactPostalAddresses(contact.postalAddresses),
      })),
    );

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
        "Content-Type": "text/vcard; charset=utf-8",
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
        errorSummary: error instanceof Error ? error.message : "vCard export failed.",
        completedAt: new Date(),
      },
    });

    const message = error instanceof Error ? error.message : "Export failed";
    return new Response(message, { status: 403 });
  }
}
