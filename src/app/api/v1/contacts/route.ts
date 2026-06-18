import { type NextRequest, NextResponse } from "next/server";

import { assertCanCreateContacts } from "~/server/billing";
import { db } from "~/server/db";
import { emitEvent } from "~/lib/activity";
import { corsHeaders } from "~/lib/api-cors";
import { API_CONTACT_SELECT, formatContactForApi, mapCreateInputToDb } from "../_lib/contact-mapper";
import { ContactCreateSchema } from "../_lib/schemas";
import { requireWriteScope, withApiAuth } from "../_lib/auth";

export function OPTIONS(_request: Request) {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withApiAuth(req, async (userId) => {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? undefined;
    const bookId = searchParams.get("bookId") ?? undefined;
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50"), 1), 100);
    const cursor = searchParams.get("cursor") ?? undefined;
    const archived = searchParams.get("archived") === "true";

    const contacts = await db.contact.findMany({
      where: {
        userId,
        ...(archived ? { NOT: { archivedAt: null } } : { archivedAt: null }),
        ...(bookId ? { bookId } : {}),
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { company: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { fullName: "asc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: API_CONTACT_SELECT,
    });

    const hasMore = contacts.length > limit;
    const items = hasMore ? contacts.slice(0, limit) : contacts;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    return NextResponse.json({
      contacts: items.map(formatContactForApi),
      pagination: { cursor: nextCursor, hasMore },
    });
  });
}

export async function POST(req: NextRequest) {
  return withApiAuth(req, async (userId, scope) => {
    const denied = requireWriteScope(scope);
    if (denied) return denied;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    const parsed = ContactCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Request body is invalid.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    let data: ReturnType<typeof mapCreateInputToDb>;
    try {
      data = mapCreateInputToDb(parsed.data, userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg === "FULL_NAME_REQUIRED") {
        return NextResponse.json(
          {
            error: "VALIDATION_ERROR",
            message: "Provide at least one of: firstName, lastName, fullName, or company.",
          },
          { status: 400 },
        );
      }
      throw err;
    }

    try {
      await assertCanCreateContacts(userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { error: "LIMIT_REACHED", message: msg },
        { status: 403 },
      );
    }

    const contact = await db.$transaction(async (tx) => {
      const created = await tx.contact.create({ data, select: API_CONTACT_SELECT });
      await emitEvent(tx, {
        userId,
        contactId: created.id,
        eventType: "CONTACT_CREATED",
        actor: "API",
        payload: {},
      });
      return created;
    });

    return NextResponse.json(formatContactForApi(contact), { status: 201 });
  });
}
