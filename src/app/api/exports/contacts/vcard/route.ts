import { assertCanUsePremiumExport } from "~/server/billing";
import { isSessionError, requireUserId } from "~/server/auth/require-session";
import { db } from "~/server/db";
import {
  contactsToVCard,
  parseContactDateEntries,
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId(); // P48-02: exports stay available during the deletion grace period
  } catch (err) {
    if (isSessionError(err)) return new Response("Unauthorized", { status: 401 });
    throw err;
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

  // P48-11 item 6: assertCanUsePremiumExport throws a curated, user-safe
  // billing message ("vCard export is available on the Pro plan.", "This
  // account is locked…") — safe to surface with 403. Everything from the DB
  // query/serialize below is not: it used to fall through to the same
  // `error.message` passthrough at 403, which could leak a raw Prisma error.
  try {
    await assertCanUsePremiumExport(userId);
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

  try {
    const contacts = await db.contact.findMany({
      where: {
        userId,
        archivedAt: null,
        ...(query
          ? {
              OR: [
                { fullName: { contains: query, mode: "insensitive" } },
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } },
                { phoneticFirstName: { contains: query, mode: "insensitive" } },
                { phoneticLastName: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
                { company: { contains: query, mode: "insensitive" } },
                { phoneticCompany: { contains: query, mode: "insensitive" } },
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
        firstName: true,
        lastName: true,
        phoneticFirstName: true,
        phoneticLastName: true,
        nickname: true,
        email: true,
        emailAddresses: true,
        phone: true,
        phoneNumbers: true,
        company: true,
        phoneticCompany: true,
        jobTitle: true,
        website: true,
        birthday: true,
        significantDates: true,
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
        significantDates: parseContactDateEntries(contact.significantDates),
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
    console.error("[exports/contacts/vcard] unexpected failure", error);
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

    return new Response("Export failed. Please try again.", { status: 500 });
  }
}
