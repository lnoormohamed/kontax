// Future enhancement: generate an OpenAPI spec for this API.
// Base URL when created: https://api.getkontax.com/v1
import { type NextRequest, NextResponse } from "next/server";

import { assertCanCreateContactsTx, lockUserForPlanCheck } from "~/server/billing";
import { setPrimaryMembership } from "~/server/contact-book-membership";
import { db } from "~/server/db";
import { emitEvent } from "~/lib/activity";
import { corsHeaders } from "~/lib/api-cors";
import { API_CONTACT_SELECT, formatContactForApi, mapCreateInputToDb } from "../_lib/contact-mapper";
import { ContactCreateSchema } from "../_lib/schemas";
import { requireWriteScope, resolveOwnedBookId, withApiAuth } from "../_lib/auth";

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
        // P40-06: filter by membership (a contact can live in several books).
        ...(bookId ? { bookMemberships: { some: { addressBookId: bookId } } } : {}),
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

    // P40-06: every personal contact lives in a book. A null bookId historically
    // meant "the default book"; make that explicit so the membership read cutover
    // shows the contact, and dual-write the primary membership.
    // P48-05: the book must belong to the token owner.
    const resolvedBook = await resolveOwnedBookId(userId, data.bookId);
    if ("error" in resolvedBook) return resolvedBook.error;
    const bookId = resolvedBook.bookId;
    data.bookId = bookId;

    // P49A-06 (Fable review): the plan-cap check runs inside the inserting
    // transaction with the owner's User row locked, like every other create
    // path — a pre-check outside it let concurrent API POSTs all read "under
    // the cap" and all insert.
    const outcome = await db.$transaction(async (tx) => {
      await lockUserForPlanCheck(tx, userId);
      try {
        await assertCanCreateContactsTx(tx, userId);
      } catch (err) {
        return { refused: err instanceof Error ? err.message : "Plan limit reached." } as const;
      }
      const created = await tx.contact.create({ data, select: API_CONTACT_SELECT });
      await setPrimaryMembership(tx, created.id, bookId);
      await emitEvent(tx, {
        userId,
        contactId: created.id,
        eventType: "CONTACT_CREATED",
        actor: "API",
        payload: {},
      });
      return { created } as const;
    });

    if ("refused" in outcome) {
      return NextResponse.json({ error: "LIMIT_REACHED", message: outcome.refused }, { status: 403 });
    }

    return NextResponse.json(formatContactForApi(outcome.created), { status: 201 });
  });
}
