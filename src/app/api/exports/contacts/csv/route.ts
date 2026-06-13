import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import {
  contactsToCsv,
  contactsToCsvFiltered,
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
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const query = url.searchParams.get("q")?.trim() ?? "";
  // Explicit selection (bulk "Export" from the contacts list) takes precedence
  // over query/archived filters — export exactly the chosen contacts.
  const idsParam = url.searchParams.get("ids")?.trim() ?? "";
  const selectedIds = idsParam
    ? idsParam.split(",").map((value) => value.trim()).filter(Boolean)
    : [];
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
      where: selectedIds.length > 0
        ? { userId, id: { in: selectedIds } }
        : {
        userId,
        ...(includeArchived ? {} : { archivedAt: null }),
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
        address: true,
        postalAddresses: true,
        notes: true,
      },
    });

    const body = contactsToCsv(
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

const postSchema = z.object({
  fieldSelection: z.array(
    z.object({
      key: z.string(),
      included: z.boolean(),
      headerOverride: z.string().trim().max(80).optional(),
    }),
  ),
  includeArchived: z.boolean().optional(),
  ids: z.array(z.string()).optional(),
  q: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const raw: unknown = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) return new Response("Invalid request", { status: 400 });

  const { fieldSelection, includeArchived, ids, q: query } = parsed.data;
  const selectedIds = ids ?? [];
  const resultFileName = `kontax-contacts-${new Date().toISOString().slice(0, 10)}.csv`;

  const filterQuery = query ?? null;

  const job = await db.exportJob.create({
    data: {
      userId,
      format: "CSV_GENERIC",
      status: "PROCESSING",
      includeArchived: includeArchived ?? false,
      filterQuery,
      resultFileName,
    },
  });

  try {
    const contacts = await db.contact.findMany({
      where: selectedIds.length > 0
        ? { userId, id: { in: selectedIds } }
        : {
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
        fullName: true, firstName: true, lastName: true,
        phoneticFirstName: true, phoneticLastName: true,
        nickname: true, email: true, emailAddresses: true,
        phone: true, phoneNumbers: true,
        company: true, phoneticCompany: true,
        jobTitle: true, website: true, birthday: true,
        address: true, postalAddresses: true, notes: true, customFields: true,
      },
    });

    const body = contactsToCsvFiltered(
      contacts.map((c) => ({
        ...c,
        emailAddresses: parseContactStringArray(c.emailAddresses),
        phoneNumbers: parseContactStringArray(c.phoneNumbers),
        postalAddresses: parseContactPostalAddresses(c.postalAddresses),
        customFields:
          c.customFields && typeof c.customFields === "object" && !Array.isArray(c.customFields)
            ? (c.customFields as Record<string, string>)
            : null,
      })),
      fieldSelection,
    );

    await db.exportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        exportedCount: contacts.length,
        filterQuery,
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
        filterQuery,
        resultFileName,
        errorSummary: error instanceof Error ? error.message : "CSV export failed.",
        completedAt: new Date(),
      },
    });
    return new Response("Export failed", { status: 500 });
  }
}
