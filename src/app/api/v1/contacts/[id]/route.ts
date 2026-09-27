import { type NextRequest, NextResponse } from "next/server";

import { movePrimaryMembership } from "~/server/contact-book-membership";
import { deleteContactsPermanently } from "~/server/contact-deletion";
import { db } from "~/server/db";
import { markSyncLinksDirty } from "~/server/sync-dirty";
import { emitEvent } from "~/lib/activity";
import { corsHeaders } from "~/lib/api-cors";
import { API_CONTACT_SELECT, formatContactForApi, mapUpdateInputToDb } from "../../_lib/contact-mapper";
import { ContactUpdateSchema } from "../../_lib/schemas";
import { requireWriteScope, resolveOwnedBookId, withApiAuth } from "../../_lib/auth";

export function OPTIONS(_request: Request) {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return withApiAuth(req, async (userId) => {
    const { id } = await params;

    const contact = await db.contact.findFirst({
      // P49A-12: a permanently deleted contact awaiting purge is gone.
      where: { id, userId, deletedAt: null },
      select: API_CONTACT_SELECT,
    });

    if (!contact) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Contact not found." },
        { status: 404 },
      );
    }

    return NextResponse.json(formatContactForApi(contact));
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  return withApiAuth(req, async (userId, scope) => {
    const denied = requireWriteScope(scope);
    if (denied) return denied;

    const { id } = await params;

    const existing = await db.contact.findFirst({
      where: { id, userId, archivedAt: null },
      select: { id: true, fullName: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Contact not found." },
        { status: 404 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    const parsed = ContactUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Request body is invalid.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const patch = mapUpdateInputToDb(parsed.data);
    const updatedFields = Object.keys(parsed.data);

    // P40-06: if the book is changing, resolve a concrete target (null → default)
    // and dual-write the primary membership so the contact never loses its book.
    let movedBookId: string | null = null;
    if ("bookId" in patch) {
      // P48-05: the target book must belong to the token owner.
      const resolvedBook = await resolveOwnedBookId(
        userId,
        typeof patch.bookId === "string" ? patch.bookId : null,
      );
      if ("error" in resolvedBook) return resolvedBook.error;
      movedBookId = resolvedBook.bookId;
      patch.bookId = movedBookId;
    }

    const updated = await db.$transaction(async (tx) => {
      const contact = await tx.contact.update({
        where: { id },
        // P49A-02 (A-18): syncVersion is the CardDAV ETag. Without the bump a
        // device never refetches the API edit and later overwrites it.
        data: { ...patch, syncVersion: { increment: 1 } },
        select: API_CONTACT_SELECT,
      });
      if (movedBookId) await movePrimaryMembership(tx, id, movedBookId);
      // P49A-12 (A-17): an API edit reaches the linked sync providers.
      await markSyncLinksDirty(tx, id);
      await emitEvent(tx, {
        userId,
        contactId: id,
        eventType: "CONTACT_UPDATED",
        actor: "API",
        payload: {
          diffs: updatedFields.map((field) => ({ field, before: undefined, after: undefined })),
        },
      });
      return contact;
    });

    return NextResponse.json(formatContactForApi(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return withApiAuth(req, async (userId, scope) => {
    const denied = requireWriteScope(scope);
    if (denied) return denied;

    const { id } = await params;
    const permanent = new URL(req.url).searchParams.get("permanent") === "true";

    const contact = await db.contact.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true, fullName: true, email: true, phone: true },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Contact not found." },
        { status: 404 },
      );
    }

    if (permanent) {
      // P49A-12 (A-16): a contact still on a sync provider is hidden and purged
      // once each provider has deleted it — never hard-deleted under its links.
      await db.$transaction((tx) =>
        deleteContactsPermanently(tx, { userId, contactIds: [id], actor: "API", source: "API" }),
      );
      return new NextResponse(null, { status: 204 });
    }

    // Soft delete — archive
    await db.$transaction(async (tx) => {
      const now = new Date();
      await tx.contact.update({
        where: { id },
        // P49A-02 (A-18): bump the CardDAV ETag so devices see the change.
        // P49A-12: sync-tombstoned like a web archive, so every provider
        // deletes its copy on the next push.
        data: {
          archivedAt: now,
          syncTombstoneAt: now,
          lastMutatedBy: "API",
          syncVersion: { increment: 1 },
        },
      });
      await emitEvent(tx, {
        userId,
        contactId: id,
        eventType: "CONTACT_ARCHIVED",
        actor: "API",
        payload: {},
      });
    });

    return new NextResponse(null, { status: 204 });
  });
}
